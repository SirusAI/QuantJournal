import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { prepareManualTrade } from "@/lib/broker-import";
import { signedImportedQuantity } from "@/lib/import-metrics";
export const dynamic="force-dynamic";
export async function POST(request:NextRequest){
  let input:ReturnType<typeof prepareManualTrade>;
  try{input=prepareManualTrade(await request.json());}catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Check the trade fields."},{status:400});}
  try{const trade=await db.trade.create({data:{symbol:input.symbol,date:new Date(input.date+"T12:00:00Z"),notes:input.notes,status:input.status,direction:input.direction,netPl:input.netPl,grossPl:input.grossPl,volume:input.volume,winLoss:input.winLoss,isManualPnl:input.isManualPnl,tags:{connectOrCreate:input.tags.map(name=>({where:{name},create:{name}}))},executions:{create:input.executions.map(e=>({time:new Date(e.time),side:e.side,price:e.price,quantity:signedImportedQuantity(e),fee:e.fee,pnl:e.reportedPnl}))}}});return NextResponse.json(trade);}catch{return NextResponse.json({error:"Trade could not be saved. Please retry."},{status:500});}
}
