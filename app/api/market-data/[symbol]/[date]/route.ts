import { NextRequest,NextResponse } from "next/server";
import { getMarketDataResult } from "@/lib/market-data";
import { getSettings } from "@/lib/local-settings";
import type { MarketInterval,MarketSource } from "@/lib/settings-types";
export async function GET(req:NextRequest,{params}:{params:Promise<{symbol:string;date:string}>}){
 try{const {symbol,date}=await params;const interval=(req.nextUrl.searchParams.get("interval")??getSettings().market.intradayInterval) as MarketInterval;
 const source=(req.nextUrl.searchParams.get("source")??undefined) as MarketSource|undefined;
 return NextResponse.json(await getMarketDataResult({symbol,from:date,to:date,interval,source}));
 }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Market request failed."},{status:400});}
}
