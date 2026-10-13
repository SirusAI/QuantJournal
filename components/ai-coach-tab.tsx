"use client";
import { useJournal } from "@/components/journal-runtime";
import { useEffect,useState } from "react";

import { AiConnectionPicker } from "./ai-connection-picker";
import type { Stats } from "@/lib/stats";
interface Session{id:string;advice:string;createdAt:Date|string}
export function AICoachTab({stats}:{stats:Partial<Stats>}){
 const client = useJournal();
 const { getAiCoachAdvice, getCoachingHistory, deleteCoachingSession } = client;
 const [connectionId,setConnectionId]=useState("");const [advice,setAdvice]=useState("");const [message,setMessage]=useState("");const [busy,setBusy]=useState(false);const [history,setHistory]=useState<Session[]>([]);
 useEffect(()=>{getCoachingHistory().then(r=>setHistory(r.history)).catch(()=>setMessage("Unable to load coaching history."));},[]);
 async function analyze(){setBusy(true);setMessage("");try{const r=await getAiCoachAdvice(stats,connectionId);if(r.success&&r.advice){setAdvice(r.advice);setHistory((await getCoachingHistory()).history);}else setMessage(r.error??"Generation failed.");}catch{setMessage("Generation failed. Your previous advice was kept.");}finally{setBusy(false);}}
 return <div className="space-y-5"><h2 className="text-xl font-bold">AI Coach</h2><AiConnectionPicker feature="ai-coach" value={connectionId} onChange={setConnectionId}/><button className="rounded bg-sky-700 px-4 py-2 disabled:opacity-40" disabled={busy||!connectionId} onClick={analyze}>{busy?"Analyzing…":"Analyze selected statistics"}</button>{message&&<p role="status" className="text-amber-200">{message}</p>}{advice&&<article className="rounded-xl border border-gray-700 p-6 whitespace-pre-wrap">{advice}</article>}<h3 className="font-bold">Saved coaching history</h3>{history.length?history.map(item=><div key={item.id} className="rounded border border-gray-700 p-3 flex gap-3"><button className="flex-1 text-left text-sm text-sky-400" onClick={()=>setAdvice(item.advice)}>{new Date(item.createdAt).toLocaleString()}</button><button className="text-sm text-gray-400" onClick={async()=>{if(window.confirm("Delete this coaching session?")){await deleteCoachingSession(item.id);setHistory(h=>h.filter(x=>x.id!==item.id));}}}>Delete</button></div>):<p className="text-sm text-gray-400">No saved sessions.</p>}</div>;
}
