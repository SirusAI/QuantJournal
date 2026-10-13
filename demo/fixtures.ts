import { getTimeZoneOffset } from "../lib/trading-day.ts";
import { EMPTY_TRADE_REVIEW } from "../lib/trade-review.ts";
import { DEFAULT_MARKET, AI_PROVIDERS } from "../lib/settings-types.ts";
import type { SettingsDto } from "../lib/settings-types.ts";
import type { TradeReviewInput } from "../lib/trade-review.ts";

export const DEMO_DATE = "2026-06-30";
export const DEMO_SYMBOLS = ["SPY", "AAPL", "MSFT", "NVDA", "TSLA"];
export const DEMO_PRICES = [590, 220, 410, 140, 300];
export interface DemoExecution { id: string; tradeId: string; time: string; side: string; price: number; quantity: number; fee: number; pnl: number | null; route: string; broker: string; type: string }
export interface DemoTrade {
  id: string; symbol: string; date: string; dateKey: string; status: string; direction: string;
  notes: string; netPl: number; grossPl: number; volume: number; winLoss: string; initialBalance: number; isManualPnl: boolean;
  mae: number; mfe: number; fee: number; commission: number; duration: number;
  createdAt: string; updatedAt: string; executions: DemoExecution[]; tags: { id: string; name: string }[];
  review: (TradeReviewInput & { updatedAt: string }) | null; _count: { executions: number };
}
export function nyTimestamp(date: string, minutes: number) { const time=`${String(Math.floor(minutes/60)).padStart(2,"0")}:${String(minutes%60).padStart(2,"0")}:00`; return new Date(`${date}T${time}${getTimeZoneOffset(date,time)}`).toISOString(); }
export function seedTrades(): DemoTrade[] {
  const days: string[]=[];
  for(let ms=Date.parse("2026-01-02T12:00:00Z");ms<=Date.parse(DEMO_DATE+"T12:00:00Z");ms+=86400000){const d=new Date(ms);if(d.getUTCDay()>0&&d.getUTCDay()<6)days.push(d.toISOString().slice(0,10));}
  return Array.from({length:180},(_,i)=>{
    const date=days[Math.floor(i*(days.length-1)/179)],id=`demo-${String(i+1).padStart(3,"0")}`,symbol=DEMO_SYMBOLS[i%5];
    const quantity=[10,20,50,100][i%4],short=i%3===0,win=i%11<7,entry=DEMO_PRICES[i%5]+i%12;
    const delta=(win?1:-1)*(0.5+(i%7)*0.25)*(short?-1:1),exit=entry+delta,split=i%4===0;
    const start=580+(i%5)*52, end=start+18+i%45;
    const legs=split?[[start,entry,Math.floor(quantity/2)],[start+5,entry,quantity-Math.floor(quantity/2)],[end,exit,-quantity]]:[[start,entry,quantity],[end,exit,-quantity]];
    const executions:DemoExecution[]=legs.map(([minute,price,q],n)=>({id:`${id}-fill-${n}`,tradeId:id,time:nyTimestamp(date,minute),side:q>0?(short?"SS":"B"):(short?"B":"S"),price,quantity:q*(short?-1:1),fee:0.3,pnl:null,route:"DEMO",broker:"Fictional",type:"Stock"}));
    const fee=executions.length*0.3,grossPl=Number((quantity*delta*(short?-1:1)).toFixed(2)),netPl=Number((grossPl-fee).toFixed(2));
    const tags=["Demo breakout","Demo pullback","Demo range"];
    return {id,symbol,date:date+"T12:00:00Z",dateKey:date,status:"CLOSED",direction:short?"SHORT":"LONG",notes:"Fictional training record. Follow the entry plan and review execution quality.",netPl,grossPl,volume:quantity*2,winLoss:netPl>0?"WIN":"LOSS",initialBalance:10000,isManualPnl:false,mae:0,mfe:0,fee,commission:fee,duration:end-start,createdAt:date+"T20:00:00Z",updatedAt:date+"T20:00:00Z",executions,tags:[{id:`tag-${i%3}`,name:tags[i%3]}],review:i%8===0?{...EMPTY_TRADE_REVIEW,entryQuality:"PLAN_FOLLOWED",exitQuality:"EXITED_TO_PLAN",riskQuality:"PLAN_FOLLOWED",psychologyTags:["Focused"],lessonNotes:"Fictional example: record the reason for each execution and compare it with the plan.",updatedAt:date+"T20:00:00Z"}:null,_count:{executions:executions.length}};
  });
}
export function seedSettings(): SettingsDto {
  const connections = (["openai","ollama","deepseek"] as const).map(provider=>({id:`demo-${provider}`,name:`Demo ${AI_PROVIDERS[provider].label}`,provider,baseUrl:AI_PROVIDERS[provider].baseUrl,modelId:"simulated-model",timeoutSeconds:120,hasApiKey:false}));
  return {connections,selections:{"daily-review":connections[0].id,"ai-coach":connections[1].id,"edge-analysis":connections[2].id},market:structuredClone(DEFAULT_MARKET)};
}
