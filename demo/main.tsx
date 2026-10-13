import React, { useState, useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import type { AnchorHTMLAttributes } from "react";
import "./style.css";
import { JournalContext } from "../components/journal-runtime";
import { Sidebar } from "../components/sidebar";
import { DashboardView } from "../components/dashboard-view";
import { CalendarGrid } from "../components/calendar-grid";
import { ReportsView } from "../components/reports-view";
import { TradesTable } from "../components/trades-table";
import { JournalView } from "../components/journal-view";
import { TradeDetailView } from "../components/trade-detail-view";
import { TradeForm } from "../components/trade-form";
import { DailyReviewView } from "../components/daily-review-view";
import { SettingsView } from "../components/settings-view";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../components/ui/dialog";
import { ImportGuide } from "../components/import-guide";
import { buildDailyCalendarStats, normalizeCalendarView } from "../lib/calendar-stats";
import { isValidDateKey } from "../lib/trading-day";
import { createDemoStore } from "./store";
import { DEMO_DATE } from "./fixtures";
const base=import.meta.env.BASE_URL;
let storage:Storage|null=null;try{storage=window.localStorage;}catch{}
const store=createDemoStore(storage,"quantjournal-demo:v1:"+new URL(".",window.location.href).pathname,base);
const subscribeHash=(listener:()=>void)=>{window.addEventListener("hashchange",listener);return()=>window.removeEventListener("hashchange",listener);};
const getHash=()=>window.location.hash.slice(1)||"/dashboard";
const routes=[["Dashboard","/dashboard"],["Calendar","/calendar"],["Reports","/reports"],["Trades","/trades"],["Journal","/journal"],["Daily Review","/daily-review"],["New Trade","/new-trade"],["Settings","/settings"],["Import Guide","/import-guide"],["Watch Tour","/tour"]];
function DemoLink({href,...props}:AnchorHTMLAttributes<HTMLAnchorElement>&{href:string}){return <a href={href.startsWith("/")?"#"+href:href} {...props}/>;}
function Tour(){return <section className="mx-auto max-w-5xl space-y-6"><h1 className="text-3xl font-bold">Explore QuantJournal in two minutes</h1><p className="text-gray-400">Follow the broker import tutorial, then explore reports, journaling, and the sample AI features. All shown trading records and prices are fictional.</p><video className="w-full rounded-xl border border-gray-700" controls playsInline preload="none" poster={base+"media/quantjournal-poster.png"}><source src={base+"media/quantjournal-tour.mp4"} type="video/mp4"/><track kind="captions" src={base+"media/quantjournal-tour.vtt"} srcLang="en" label="English"/>Your browser does not support HTML video.</video><a href={base+"media/quantjournal-tour.mp4"} download className="text-sky-400 underline">Download the walkthrough</a><img className="w-full rounded-xl" src={base+"media/quantjournal-features.svg"} alt="QuantJournal features and broker execution import workflow"/></section>;}
function App(){
  const state=useSyncExternalStore(store.subscribe,store.getState),location=useSyncExternalStore(subscribeHash,getHash),[resetVersion,setResetVersion]=useState(0),[confirmAction,setConfirmAction]=useState<"reset"|"clear"|null>(null);
  const url=new URL(location,"https://demo.invalid"),pathname=url.pathname,params=url.searchParams;
  const navigation={pathname,push:(path:string)=>{window.location.hash=path;window.scrollTo(0,0);},refresh:()=>{}};
  const trades=[...state.trades].sort((a,b)=>b.date.localeCompare(a.date));
  const date=isValidDateKey(params.get("date"))?params.get("date")!:DEMO_DATE;
  let page:React.ReactNode;
  if(pathname==="/dashboard")page=<DashboardView initialTrades={[...trades].reverse()}/>;
  else if(pathname==="/calendar")page=<CalendarGrid dailyData={buildDailyCalendarStats(trades)} year={Number(params.get("year")||2026)} month={Math.max(0,Math.min(11,Number(params.get("month")??5)))} view={normalizeCalendarView(params.get("view")??undefined)}/>;
  else if(pathname==="/reports")page=<ReportsView trades={trades}/>;
  else if(pathname==="/trades")page=<><h1 className="mb-6 text-3xl font-bold">Trades</h1>{params.has("date")&&<p className="mb-4 text-sm text-sky-300">Trading date: {date} · <DemoLink href="/trades" className="underline">Show all dates</DemoLink></p>}<TradesTable trades={params.has("date")?trades.filter(t=>t.dateKey===date):trades}/></>;
  else if(pathname==="/journal")page=<JournalView key={date} initialTrades={trades.map(t=>({...t}))} dailyEntries={state.notes} initialDate={date} todayDate={DEMO_DATE}/>;
  else if(pathname.startsWith("/journal/")){const trade=trades.find(t=>t.id===decodeURIComponent(pathname.split("/")[2]));page=trade?<TradeDetailView trade={trade} chartData={[]}/>:<div><h1 className="text-2xl font-bold">Trade not found</h1><DemoLink className="text-sky-400 underline" href="/trades">Return to Trades</DemoLink></div>;}
  else if(pathname==="/new-trade")page=<TradeForm/>;
  else if(pathname==="/daily-review")page=<DailyReviewView key={date} selectedDate={date} initialReview={state.reviews[date]?.review??null} initialHistory={Object.values(state.reviews).map(({review})=>({...review})).sort((a,b)=>b.reviewDate.localeCompare(a.reviewDate))}/>;
  else if(pathname==="/settings")page=<SettingsView/>;
  else if(pathname==="/import-guide")page=<ImportGuide/>;
  else if(pathname==="/tour")page=<Tour/>;
  else page=<div><h1 className="text-2xl font-bold">Page not found</h1><DemoLink href="/dashboard" className="text-sky-400 underline">Open Dashboard</DemoLink></div>;
  function reset(empty:boolean){store.reset(empty);setResetVersion(v=>v+1);setConfirmAction(null);navigation.push("/dashboard");}
  const confirmation=<Dialog open={confirmAction!==null} onOpenChange={open=>{if(!open)setConfirmAction(null);}}><DialogContent><DialogHeader><DialogTitle>{confirmAction==="clear"?"Clear demo data?":"Reset the demo?"}</DialogTitle><DialogDescription>{confirmAction==="clear"?"Remove this demo’s trades, notes and reports from browser storage. Reset Demo can restore the fictional dataset afterward.":"Restore 180 fictional trades and the sample notes, reports and settings. Your changes in this demo will be replaced."}</DialogDescription></DialogHeader><DialogFooter><button className="rounded border border-gray-600 px-4 py-2" onClick={()=>setConfirmAction(null)}>Cancel</button><button className="rounded bg-sky-700 px-4 py-2 text-white hover:bg-sky-600" onClick={()=>reset(confirmAction==="clear")}>{confirmAction==="clear"?"Clear demo data":"Restore fictional data"}</button></DialogFooter></DialogContent></Dialog>;
  return <JournalContext.Provider value={{client:store.client,navigation,LinkComponent:DemoLink}}>{confirmation}<div className="min-h-screen bg-gray-900 text-white"><aside className="fixed inset-y-0 left-0 hidden w-72 flex-col lg:flex"><Sidebar/><div className="border-t border-gray-800 bg-[#111827] px-6 py-4 text-sm space-y-2"><DemoLink className="block text-sky-400" href="/import-guide">Broker Import Tutorial</DemoLink><DemoLink className="block text-sky-400" href="/tour">Watch the two-minute tour</DemoLink></div></aside><div className="lg:ml-72"><header className="demo-banner sticky top-0 z-40 border-b border-amber-800 bg-gray-950/95 px-4 py-3 backdrop-blur"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-semibold text-amber-300">Demo — fictional data, changes saved only in this browser</p><p className="mt-1 text-xs text-gray-400">Sample timeline: January–June 2026 · Reference date: June 30 · AI and market providers are simulated</p></div><div className="flex gap-2"><button className="rounded border border-gray-600 px-3 py-2 text-xs hover:bg-gray-800" onClick={()=>setConfirmAction("reset")}>Reset Demo</button><button className="rounded border border-gray-600 px-3 py-2 text-xs hover:bg-gray-800" onClick={()=>setConfirmAction("clear")}>Clear Data</button></div></div>{store.getWarning()&&<p role="status" className="mt-2 text-sm text-amber-300">{store.getWarning()}</p>}<nav className="mt-3 lg:hidden"><label className="text-sm">Navigate <select aria-label="Demo navigation" className="ml-2 rounded bg-gray-800 p-2" value={routes.some(([,path])=>path===pathname)?pathname:"/journal"} onChange={e=>navigation.push(e.target.value)}>{routes.map(([label,path])=><option key={path} value={path}>{label}</option>)}</select></label></nav></header><main key={resetVersion+":"+pathname} className="p-4 md:p-8">{page}</main><footer className="p-6 text-center text-xs text-gray-500">Fictional practice environment · Your real trading records belong in your local QuantJournal installation.</footer></div></div></JournalContext.Provider>;
}
createRoot(document.getElementById("root")!).render(<React.StrictMode><App/></React.StrictMode>);
