import { NextRequest,NextResponse } from "next/server";
import { getMarketDataResult } from "@/lib/market-data";
export async function GET(req:NextRequest){
 try{const from=req.nextUrl.searchParams.get("startDate")??"";const to=req.nextUrl.searchParams.get("endDate")??"";
 const result=await getMarketDataResult({symbol:"SPY",from,to,interval:"1d"});
 return NextResponse.json({...result,data:result.bars.map(bar=>({date:bar.date,open:bar.open,close:bar.close,pctChange:(bar.close-bar.open)/bar.open*100}))});
 }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Market request failed."},{status:400});}
}
