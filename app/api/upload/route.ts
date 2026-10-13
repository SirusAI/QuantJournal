import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseBrokerCsv, parseBrokerPaste } from "@/lib/broker-import";
import type { BrokerGroup } from "@/lib/broker-import";
import { signedImportedQuantity } from "@/lib/import-metrics";
export const dynamic = "force-dynamic";
export async function POST(request: NextRequest) {
  let groups: BrokerGroup[];
  try {
    if(request.headers.get("content-type")?.includes("application/json")) {
      const body=await request.json(); if(typeof body.text!=="string"||body.text.length>8_000_000)throw new Error("Paste an execution table smaller than 8 MB.");
      groups=parseBrokerPaste(body.text);
    } else {
      const form=await request.formData(); const files=form.getAll("files") as File[];
      if(!files.length)throw new Error("Select at least one CSV file."); groups=[];
      for(const file of files){if(!file.name.toLowerCase().endsWith(".csv")||file.size>8_000_000)throw new Error("Select CSV files smaller than 8 MB each.");groups.push(...parseBrokerCsv(await file.text(),file.name,String(form.get("defaultDate")??"")));}
    }
  } catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Check the CSV format and trading date."},{status:400});}
  try {
    const result=await db.$transaction(async tx=>{
      let count=0,skipped=0;
      for(const item of groups){const date=new Date(item.date+"T12:00:00Z");
        if(await tx.trade.findFirst({where:{symbol:item.symbol,date,volume:item.volume,netPl:item.netPl}})){skipped++;continue;}
        await tx.trade.create({data:{symbol:item.symbol,date,status:"CLOSED",direction:item.direction,volume:item.volume,netPl:item.netPl,grossPl:item.grossPl,winLoss:item.netPl>0?"WIN":item.netPl<0?"LOSS":"BREAK_EVEN",executions:{create:item.executions.map(e=>({time:new Date(e.time),side:e.side,price:e.price,quantity:signedImportedQuantity(e),fee:e.fee,route:e.route,pnl:e.reportedPnl}))}}});count++;
      }return {success:true,count,skipped};
    });return NextResponse.json(result);
  }catch{return NextResponse.json({error:"Import could not be saved. No trades in this import were added; please retry."},{status:500});}
}
