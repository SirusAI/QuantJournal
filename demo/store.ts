import type { JournalClient, TradeInput } from "../lib/journal-client.ts";
import type { AiConnectionInput, AiFeature, SettingsDto, MarketSettings } from "../lib/settings-types.ts";
import type { SerializedDailyReview } from "../lib/daily-review-types.ts";
import type { EdgeAnalysisScope, EdgeAnalysisSessionDto } from "../lib/edge-analysis-types.ts";
import { analyzeEdgeTrades } from "../lib/edge-analysis.ts";
import { calculateStats } from "../lib/stats.ts";
import { parseBrokerCsv, parseBrokerPaste, prepareManualTrade } from "../lib/broker-import.ts";
import type { BrokerGroup } from "../lib/broker-import.ts";
import { computeImportedMetrics, signedImportedQuantity } from "../lib/import-metrics.ts";
import { EMPTY_TRADE_REVIEW } from "../lib/trade-review.ts";
import { isValidDateKey } from "../lib/trading-day.ts";
import { DEMO_DATE, seedSettings, seedTrades } from "./fixtures.ts";
import type { DemoTrade } from "./fixtures.ts";
import { syntheticMarket } from "./market.ts";

export interface DemoState {
  version: 1; trades: DemoTrade[]; settings: SettingsDto;
  notes: { entryDate: string; content: string; updatedAt: string }[];
  reviews: Record<string, { key: string; review: SerializedDailyReview }>;
  coaching: { id: string; advice: string; stats: string | null; createdAt: string }[];
  edges: (EdgeAnalysisSessionDto & { connectionKey: string })[];
}
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
const stamp = () => new Date().toISOString();
const id = () => crypto.randomUUID();
const delay = () => new Promise<void>(resolve => setTimeout(resolve, 250));
function makeReview(trades:DemoTrade[],date:string,connection:SettingsDto["connections"][number],includeNotes:boolean):SerializedDailyReview {
  const selected=trades.filter(t=>t.dateKey===date),stats=calculateStats(selected),executions=selected.reduce((n,t)=>n+t.executions.length,0);
  const summary=`Simulated AI response. ${selected.length} recorded trades on ${date}, ${executions} executions, and $${stats.totalGainLoss.toFixed(2)} net P&L. This text is generated locally from the selected records; no AI provider was contacted.`;
  return {id:id(),reviewDate:date,provider:connection.provider,modelId:connection.modelId,modelName:connection.name,analysisVersion:"demo-v1",tradeCount:selected.length,executionCount:executions,renderedReport:summary,sourceSnapshot:null,createdAt:stamp(),updatedAt:stamp(),review:{
    summary,strengths:[{title:"Review the complete record",detail:"Compare the entry and exit decisions with the documented plan.",evidence:[`${executions} recorded fills`,`${stats.winningTrades} winning trades`]}],
    weaknesses:[{title:"Investigate losses individually",detail:"Statistics describe outcomes; they do not establish the cause of a loss.",evidence:[`${stats.losingTrades} losing trades`,`${stats.totalTrades} total trades`]}],
    marketContext:{overview:"Synthetic market fixtures demonstrate the report layout. They are not historical prices.",spy:["SPY charts in this demo contain fictional OHLCV bars."],symbols:[...new Set(selected.map(t=>t.symbol))].map(symbol=>({symbol,observations:["No real-market or precise execution-price evaluation is performed."]}))},
    tradeEvidence:selected.map(t=>({symbol:t.symbol,headline:`${t.symbol}: $${t.netPl.toFixed(2)} net`,details:[`${t.direction} · ${t.executions.length} executions · $${t.fee.toFixed(2)} fees`,...(includeNotes&&t.notes?[`Included local note: ${t.notes}`]:[])]})),
    actionItems:["Reconcile fills and fees with the execution report.","Record one concrete lesson for the next trading session."],limitations:["Simulated AI response; no model or provider was contacted.","Synthetic prices cannot evaluate real trading performance.",includeNotes?"Notes were included locally; nothing was sent to an API.":"Trade notes were excluded."]}};
}
function edgeSession(trades:DemoTrade[],scope:EdgeAnalysisScope,connection:SettingsDto["connections"][number]) {
  const analysis=analyzeEdgeTrades(trades.filter(t=>t.status==="CLOSED"),scope);
  const evidence={baseline:analysis.baseline,dataQuality:analysis.dataQuality,topEdges:analysis.topEdges,topLeaks:analysis.topLeaks,deterministicActions:analysis.actions};
  return {id:id(),scope:analysis.scope,scopeKey:analysis.scopeKey,sourceFingerprint:analysis.sourceFingerprint,analysisVersion:analysis.analysisVersion,modelId:connection.modelId,modelName:connection.name,connectionKey:JSON.stringify(connection),createdAt:stamp(),evidence,
    summary:{strengths:analysis.topEdges.slice(0,3).map(g=>({title:g.label,detail:`Simulated explanation of ${g.metrics.sampleSize} trades and $${g.metrics.expectancy.toFixed(2)} expectancy.`,evidence:[`Sample: ${g.metrics.sampleSize}`,`Confidence: ${g.confidence}`]})),leaks:analysis.topLeaks.slice(0,3).map(g=>({title:g.label,detail:"Examine the underlying records before changing a trading rule.",evidence:[`Net P&L: $${g.metrics.netPl.toFixed(2)}`]})),actions:analysis.actions.map(a=>a.title),limitations:["Simulated AI response. Deterministic evidence above is calculated from the browser-local trades.","Historical associations do not establish causation."]}};
}
export function initialDemoState(empty=false):DemoState {
  const trades=empty?[]:seedTrades(),settings=seedSettings();
  const state:DemoState={version:1,trades,settings,notes:empty?[]:[{entryDate:DEMO_DATE,content:"Fictional practice journal: review the plan, record each execution, and reconcile the fees.",updatedAt:DEMO_DATE+"T20:00:00Z"}],reviews:{},coaching:[],edges:[]};
  if(!empty){for(const date of [DEMO_DATE,"2026-06-29"]){state.reviews[date]={key:"seed",review:makeReview(trades,date,settings.connections[0],false)};}
    state.coaching=[{id:"demo-coach",advice:"Simulated AI response. Start with the selected statistics, examine losses individually, and record a repeatable review process. No provider was contacted.",stats:null,createdAt:DEMO_DATE+"T20:00:00Z"}];
    state.edges=[edgeSession(trades,{from:null,to:null,symbol:null,tag:null,label:"All Time"},settings.connections[2])];}
  return state;
}
export function createDemoStore(storage:Pick<Storage,"getItem"|"setItem"|"removeItem">|null,key:string,assetBase="/") {
  let state:DemoState;let warning="";const listeners=new Set<()=>void>();
  try {const raw=storage?.getItem(key);if(raw){const parsed=JSON.parse(raw);if(parsed.version!==1||!Array.isArray(parsed.trades)||!parsed.settings?.connections||!Array.isArray(parsed.notes)||!parsed.reviews||!Array.isArray(parsed.coaching)||!Array.isArray(parsed.edges)||parsed.trades.some((t:DemoTrade)=>typeof t.id!=="string"||!Array.isArray(t.executions)||!isValidDateKey(t.dateKey)))throw new Error("Invalid state");state=parsed;}else state=initialDemoState();}
  catch{state=initialDemoState();warning="Saved demo data could not be read. A fresh fictional dataset was loaded.";}
  if(!storage)warning="Browser storage is unavailable. Changes last only until this page closes.";
  function commit(){state={...state,trades:[...state.trades]};try{if(storage)storage.setItem(key,JSON.stringify(state));}catch{warning="Browser storage is full or blocked. Changes are temporary until this page closes.";}for(const listener of listeners)listener();}
  function trade(tradeId:string){const found=state.trades.find(t=>t.id===tradeId);if(!found)throw new Error("Trade not found.");return found;}
  function connection(connectionId:string|undefined,feature:AiFeature){const found=state.settings.connections.find(c=>c.id===(connectionId||state.settings.selections[feature]));if(!found)throw new Error("Choose a demo connection in Settings.");return found;}
  function recalculate(t:DemoTrade){if(t.executions.some(e=>!Number.isFinite(Date.parse(e.time))||!Number.isInteger(e.quantity)||e.quantity===0||!Number.isFinite(e.price)||e.price<=0||!Number.isFinite(e.fee)||(e.pnl!==null&&!Number.isFinite(e.pnl))))throw new Error("Check the execution time, price, whole-share quantity and fees.");t.executions.sort((a,b)=>a.time.localeCompare(b.time));const metrics=computeImportedMetrics(t.executions.map(e=>({...e,reportedPnl:t.isManualPnl?0:e.pnl})));t.volume=metrics.volume;t.fee=metrics.fees;t.commission=metrics.fees;if(!t.isManualPnl){t.netPl=metrics.netPl;t.grossPl=metrics.grossPl;}else t.grossPl=t.netPl+metrics.fees;t.direction=t.executions[0]?.quantity<0?"SHORT":"LONG";t.duration=t.executions.length>1?(Date.parse(t.executions.at(-1)!.time)-Date.parse(t.executions[0].time))/60000:0;t.winLoss=t.netPl>0?"WIN":t.netPl<0?"LOSS":"BREAK_EVEN";t._count={executions:t.executions.length};t.updatedAt=stamp();}
  function addGroups(groups:BrokerGroup[]){let count=0,skipped=0;for(const g of groups){if(state.trades.some(t=>t.symbol===g.symbol&&t.dateKey===g.date&&t.volume===g.volume&&t.netPl===g.netPl)){skipped++;continue;}
    const tradeId=id(),executions=g.executions.map((e,n)=>({id:tradeId+"-"+n,tradeId,time:e.time,side:e.side,price:e.price,quantity:signedImportedQuantity(e),fee:e.fee,pnl:e.reportedPnl,route:e.route,broker:"Imported locally",type:"Stock"}));
    state.trades.push({id:tradeId,symbol:g.symbol,date:g.date+"T12:00:00Z",dateKey:g.date,status:"CLOSED",direction:g.direction,notes:"",netPl:g.netPl,grossPl:g.grossPl,volume:g.volume,winLoss:g.netPl>0?"WIN":g.netPl<0?"LOSS":"BREAK_EVEN",initialBalance:0,isManualPnl:false,mae:0,mfe:0,fee:g.fees,commission:g.fees,duration:executions.length>1?(Date.parse(executions.at(-1)!.time)-Date.parse(executions[0].time))/60000:0,createdAt:stamp(),updatedAt:stamp(),executions,tags:[],review:null,_count:{executions:executions.length}});count++;}commit();return json({success:true,count,skipped});}
  function deleteIds(ids:string[]){state.trades=state.trades.filter(t=>!ids.includes(t.id));commit();return json({success:true});}
  function tagTrade(tradeId:string,name:string){const t=trade(tradeId),clean=name.trim();if(!clean)throw new Error("Tag name cannot be empty.");if(!t.tags.some(tag=>tag.name===clean)){const existing=state.trades.flatMap(t=>t.tags).find(tag=>tag.name===clean);t.tags=[...t.tags,existing??{id:id(),name:clean}];}}
  async function safeResponse(action:()=>Response|Promise<Response>){try{return await action();}catch(error){return json({error:error instanceof Error?error.message:"Demo operation failed."},400);}}
  const client:JournalClient={mode:"demo",referenceDate:DEMO_DATE,storageKey:key,assetUrl:path=>assetBase+path.replace(/^\//,""),
    getSettings:async()=>json(state.settings),
    updateSettings:async command=>safeResponse(()=>{
      const body=command as {action:string;connection?:AiConnectionInput;id?:string;feature?:AiFeature;market?:MarketSettings;from?:string;to?:string;source?:"yfinance"|"massive"|"custom";interval?:"1d"|"5m"};
      if(body.action==="save-connection"){const c=body.connection!;if(!c.name?.trim()||!c.modelId?.trim())throw new Error("Enter a connection name and model ID.");new URL(c.baseUrl);const saved={id:c.id||id(),name:c.name,provider:c.provider,baseUrl:c.baseUrl,modelId:c.modelId,timeoutSeconds:c.timeoutSeconds,hasApiKey:false};state.settings={...state.settings,connections:[...state.settings.connections.filter(item=>item.id!==saved.id),saved]};}
      else if(body.action==="delete-connection"){state.settings={...state.settings,connections:state.settings.connections.filter(c=>c.id!==body.id),selections:Object.fromEntries(Object.entries(state.settings.selections).filter(([,value])=>value!==body.id))};}
      else if(body.action==="select"){if(!state.settings.connections.some(c=>c.id===body.id))throw new Error("Connection not found.");state.settings={...state.settings,selections:{...state.settings.selections,[body.feature!]:body.id}};}
      else if(body.action==="save-market"){const market=structuredClone(body.market!);market.hasMassiveKey=false;market.hasCustomKey=false;state.settings={...state.settings,market};}
      else if(body.action==="models")return json({models:["simulated-model","demo-small","demo-reasoning"],message:"Example model IDs only; no provider was contacted."});
      else if(body.action==="test-ai")return json({message:"Demo connection test completed. No provider was contacted; no credential was used."});
      else if(body.action==="check-python")return json({available:false,message:"Demo simulation. Python/yfinance runs only in the local application."});
      else if(body.action==="test-market")return json({...syntheticMarket("SPY",body.from??DEMO_DATE,body.to??DEMO_DATE,body.source??"yfinance",body.interval??"5m",state.settings.market),message:"Synthetic market test completed; no endpoint was contacted."});
      else throw new Error("Unknown demo settings operation.");commit();return json(state.settings);
    }),
    createTrade:async(input:TradeInput)=>safeResponse(()=>{
      const entry=prepareManualTrade(input),tradeId=id();
      const executions=entry.executions.map((e,n)=>({id:tradeId+"-"+n,tradeId,time:e.time,side:e.side,quantity:signedImportedQuantity(e),price:e.price,fee:e.fee,pnl:e.reportedPnl,route:"",broker:"Manual",type:"Stock"}));
      const item:DemoTrade={id:tradeId,symbol:entry.symbol,date:entry.date+"T12:00:00Z",dateKey:entry.date,status:entry.status,direction:entry.direction,notes:entry.notes,netPl:entry.netPl,grossPl:entry.grossPl,volume:entry.volume,fee:entry.fees,commission:entry.fees,duration:executions.length>1?(Date.parse(executions.at(-1)!.time)-Date.parse(executions[0].time))/60000:0,winLoss:entry.winLoss,initialBalance:0,isManualPnl:entry.isManualPnl,mae:0,mfe:0,createdAt:stamp(),updatedAt:stamp(),tags:[],review:null,executions,_count:{executions:executions.length}};
      state.trades.push(item);for(const tag of entry.tags)tagTrade(tradeId,tag);commit();return json({id:tradeId});
    }),
    deleteTrade:async tradeId=>deleteIds([tradeId]),deleteTrades:async ids=>deleteIds(ids),
    importFiles:async(files,date)=>safeResponse(async()=>{const groups:BrokerGroup[]=[];if(!files.length)throw new Error("Select a CSV file.");for(const file of files){if(!file.name.toLowerCase().endsWith(".csv")||file.size>8_000_000)throw new Error("Select CSV files smaller than 8 MB each.");groups.push(...parseBrokerCsv(await file.text(),file.name,date));}return addGroups(groups);}),
    importPasted:async text=>safeResponse(()=>addGroups(parseBrokerPaste(text))),
    updateTradeNotes:async(tradeId,notes)=>{trade(tradeId).notes=notes;commit();return {success:true};},
    updateExecution:async(executionId,data)=>{try{const t=state.trades.find(t=>t.executions.some(e=>e.id===executionId));if(!t)throw new Error("Execution not found.");const copy=structuredClone(t),e=copy.executions.find(e=>e.id===executionId)!;Object.assign(e,data);if(data.quantity!==undefined||data.side)e.quantity=signedImportedQuantity(e);recalculate(copy);state.trades=state.trades.map(t=>t.id===copy.id?copy:t);commit();return {success:true};}catch(error){return {success:false,error:String(error)};}},
    addTagToTrade:async(tradeId,name)=>{tagTrade(tradeId,name);commit();return {success:true,tag:trade(tradeId).tags.find(t=>t.name===name.trim())!};},
    removeTagFromTrade:async(tradeId,tagId)=>{const t=trade(tradeId);t.tags=t.tags.filter(tag=>tag.id!==tagId);commit();return {success:true};},
    addTagToTrades:async(ids,name)=>{for(const tradeId of ids)tagTrade(tradeId,name);commit();return {success:true,tag:state.trades.flatMap(t=>t.tags).find(t=>t.name===name.trim())??{id:"",name}};},
    saveDailyJournalEntry:async(entryDate,content)=>{if(!isValidDateKey(entryDate))return {success:false as const,error:"Invalid journal date."};const updatedAt=stamp();state.notes=[...state.notes.filter(n=>n.entryDate!==entryDate),{entryDate,content,updatedAt}];commit();return {success:true as const,updatedAt};},
    saveTradeReview:async(tradeId,input)=>{const t=trade(tradeId),updatedAt=stamp();t.review={...EMPTY_TRADE_REVIEW,...input,updatedAt};t.notes=input.additionalNotes;commit();return {success:true as const,updatedAt};},
    getAiCoachAdvice:async(stats,connectionId)=>{try{const c=connection(connectionId,"ai-coach");await delay();const advice=`Simulated AI response · ${c.name}\n\nSelected statistics: ${stats.totalTrades??0} trades, $${Number(stats.totalGainLoss??0).toFixed(2)} net P&L, ${Number(stats.winRate??0).toFixed(1)}% win rate.\n\nReview the loss distribution, compare planned and actual execution, and record a specific lesson. These observations describe your supplied records; they do not predict returns.\n\nNo provider was contacted.`;state.coaching=[{id:id(),advice,stats:JSON.stringify({stats,connection:c}),createdAt:stamp()},...state.coaching].slice(0,100);commit();return {success:true,advice};}catch(error){return {success:false,error:String(error)};}},
    getCoachingHistory:async()=>({success:true,history:state.coaching.map(s=>({...s,createdAt:new Date(s.createdAt)}))}),
    deleteCoachingSession:async sessionId=>{state.coaching=state.coaching.filter(s=>s.id!==sessionId);commit();return {success:true};},
    generateDailyReview:async({reviewDate,connectionId,force=false,includeNotes=false})=>{try{const c=connection(connectionId,"daily-review"),selected=state.trades.filter(t=>t.dateKey===reviewDate);if(!selected.length)return {success:true,noTrades:true,message:"No trades on this date. Your saved review was kept."};
      const key=JSON.stringify([selected.map(t=>({...t,notes:includeNotes?t.notes:"",review:undefined})),c,state.settings.market,includeNotes,"demo-v1"]),old=state.reviews[reviewDate];if(!force&&old?.key===key)return {success:true,cached:true,review:old.review};
      await delay();const review=makeReview(state.trades,reviewDate,c,includeNotes);state.reviews={...state.reviews,[reviewDate]:{key,review}};commit();return {success:true,cached:false,review};}catch(error){return {success:false,error:String(error)};}},
    getMarketData:async(symbol,date,source,interval,signal)=>{if(signal?.aborted)throw new DOMException("Aborted","AbortError");return json(syntheticMarket(symbol,date,date,source,interval,state.settings.market));},
    getSpyDaily:async(from,to)=>{const result=syntheticMarket("SPY",from,to,state.settings.market.dailySource,"1d",state.settings.market);return json({...result,data:result.bars.map((bar,i)=>({date:bar.date,open:bar.open,close:bar.close,pctChange:(bar.close/bar.open-1)*100,gapPct:i?(bar.open/result.bars[i-1].close-1)*100:0}))});},
    getEdgeAnalysis:async params=>json(analyzeEdgeTrades(state.trades.filter(t=>t.status==="CLOSED"),{from:params.get("from"),to:params.get("to"),symbol:params.get("symbol"),tag:params.get("tag"),label:params.get("label")??"All Time"})),
    getEdgeAnalysisModels:async()=>({success:true,models:state.settings.connections.map(c=>({id:c.id,modelId:c.modelId,name:c.name+" · "+c.modelId,isDefault:c.id===state.settings.selections["edge-analysis"]}))}),
    generateEdgeAnalysisSummary:async({scope,connectionId,force=false})=>{try{const c=connection(connectionId,"edge-analysis"),next=edgeSession(state.trades,scope,c);if(next.evidence.baseline.sampleSize===0)return {success:false,error:"No closed trades in this scope."};const previous=state.edges.find(s=>s.scopeKey===next.scopeKey&&s.sourceFingerprint===next.sourceFingerprint&&s.connectionKey===next.connectionKey);if(!force&&previous)return {success:true,cached:true,session:previous};await delay();state.edges=[next,...state.edges].slice(0,100);commit();return {success:true,cached:false,session:next};}catch(error){return {success:false,error:String(error)};}},
    listEdgeAnalysisSessions:async()=>({success:true,sessions:state.edges}),getEdgeAnalysisSession:async sessionId=>{const session=state.edges.find(s=>s.id===sessionId);return session?{success:true,session}:{success:false,error:"Session not found."};},
    deleteEdgeAnalysisSession:async sessionId=>{state.edges=state.edges.filter(s=>s.id!==sessionId);commit();return {success:true};},
  };
  return {client,getState:()=>state,getWarning:()=>warning,subscribe:(listener:()=>void)=>{listeners.add(listener);return()=>{listeners.delete(listener);};},reset:(empty=false)=>{state=initialDemoState(empty);try{storage?.removeItem(key+":tags");}catch{}commit();}};
}
