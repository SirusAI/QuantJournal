"use client";
import { useJournal } from "@/components/journal-runtime";
import { useEffect,useState } from "react";
import { Link } from "@/components/journal-runtime";
import { IntradayTradeChart } from "./intraday-trade-chart";
import { MARKET_INTERVALS } from "@/lib/settings-types";
import type { MarketInterval,MarketSource,SettingsDto } from "@/lib/settings-types";
import type { MarketDataResult } from "@/lib/market-types";
import { availableYfinanceIntervals } from "@/lib/market-types";
interface Execution {time:Date|string|number;side:string;price:number;quantity:number}
export function MarketChartPanel({symbol,date,executions}:{symbol:string;date:string;executions:Execution[]}){
 const client = useJournal();
 const [source,setSource]=useState<MarketSource>("yfinance");const [interval,setInterval]=useState<MarketInterval>("5m");const [ready,setReady]=useState(false);
 const [response,setResponse]=useState<{key:string;result?:MarketDataResult;error?:string}|null>(null);
 useEffect(()=>{let live=true;client.getSettings().then(r=>r.json()).then((s:SettingsDto)=>{if(live){setSource(s.market.intradaySource);setInterval(s.market.intradayInterval);setReady(true);}}).catch(()=>{if(live)setReady(true);});return()=>{live=false;};},[]);
 const key=JSON.stringify([symbol,date,source,interval]);const shown=response?.key===key?response:null;
 useEffect(()=>{if(!ready)return;const abort=new AbortController();
 client.getMarketData(symbol,date,source,interval,abort.signal).then(r=>r.json()).then(payload=>{if(!abort.signal.aborted)setResponse(payload.error?{key,error:payload.error}:{key,result:payload});}).catch(()=>{if(!abort.signal.aborted)setResponse({key,error:"Market data unavailable. Your trading records were kept."});});return()=>abort.abort();},[ready,key,symbol,date,source,interval]);
 const available=source==="yfinance"?availableYfinanceIntervals(date, client.referenceDate ? new Date(client.referenceDate + "T23:59:59Z") : new Date()):shown?.result?.availableIntervals??[...MARKET_INTERVALS];
 const result=shown?.result;const exact=result?.adjustment==="unadjusted"&&interval==="1m";
 return <div className="space-y-3">{client.mode === "demo" && <p className="font-bold text-xs text-amber-300">Synthetic market data · No provider contacted</p>}<div className="flex flex-wrap gap-3 text-sm"><label>Source <select aria-label="Chart market source" className="rounded bg-gray-800 p-2" value={source} onChange={e=>setSource(e.target.value as MarketSource)}>{["yfinance","massive","custom"].map(s=><option key={s}>{s}</option>)}</select></label><label>Bar interval <select aria-label="Chart bar interval" className="rounded bg-gray-800 p-2" value={interval} onChange={e=>setInterval(e.target.value as MarketInterval)}>{MARKET_INTERVALS.map(i=><option key={i} value={i} disabled={!available.includes(i)}>{i}{!available.includes(i)?" — beyond coverage":""}</option>)}</select></label><Link href="/settings" className="text-sky-400 underline self-center">Settings / keys</Link></div>
 <p className="text-xs text-gray-400">{client.mode === "demo" ? "Simulated provider behavior; no key or endpoint is used. Configure real market data in your local installation." : source==="yfinance"?"Free Yahoo data has limited history and may be rate-limited. Choose an available interval or change dates/source.":source==="massive"?"Uses your Massive key; access depends on your plan.":"Uses your configured custom HTTP API."} Date: {date} · Exchange timezone: {result?.timeZone??"America/New_York"} · Display: America/New_York</p>
 {shown?.error&&<p role="status" className="text-amber-200 text-sm">{shown.error}</p>}{!shown&&<p className="text-sm text-gray-400">Loading market data…</p>}
 {result&&<><p className="text-xs text-gray-400">{result.source} · {result.interval} · {result.adjustment} · {result.bars.length} bars · Coverage: {result.coverage?result.coverage.from+" → "+result.coverage.to:"none"}</p>{result.limitations.map((message,i)=><p role="status" key={i} className="text-sm text-amber-200">{message}</p>)}{!exact&&result.bars.length>0&&<p className="text-xs text-amber-200">Execution-price overlays are disabled for coarse or price-adjusted data. Actual executions remain in the trade table.</p>}{result.bars.length>0?<IntradayTradeChart symbol={symbol} executions={exact?executions:[]} candles={result.bars}/>:<p className="rounded border border-gray-700 p-5 text-gray-400 text-sm">{client.mode === "demo" ? "No synthetic fixture bars for this symbol/date. Trading records are still available." : "No real market bars to display. Select another interval, recent trading dates, another source, or daily bars."}</p>}</>}
 </div>;
}
