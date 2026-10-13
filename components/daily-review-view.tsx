"use client";
import { useJournal } from "@/components/journal-runtime";
import { Link } from "@/components/journal-runtime";
import { useState } from "react";
import { useRouter } from "@/components/journal-runtime";

import { AiConnectionPicker } from "./ai-connection-picker";
import type { DailyReviewHistoryItem,SerializedDailyReview } from "@/lib/daily-review-types";
function ReviewContent({review}:{review:SerializedDailyReview}) {
 const data=review.review;
 if(!data)return <div className="whitespace-pre-wrap text-sm">{review.renderedReport}</div>;
 return <div className="space-y-6 text-sm leading-relaxed"><section><h2 className="text-lg font-bold mb-2">Executive summary</h2><p>{data.summary}</p></section>
 <div className="grid gap-5 lg:grid-cols-2">{[["What went well",data.strengths],["What to improve",data.weaknesses]].map(([title,items])=><section key={String(title)} className="rounded-lg border border-gray-700 p-4"><h2 className="font-bold mb-3">{String(title)}</h2>{(items as typeof data.strengths).length?(items as typeof data.strengths).map((item,i)=><div key={i} className="mb-3"><h3 className="font-semibold">{item.title}</h3><p className="text-gray-300">{item.detail}</p><ul className="list-disc pl-5 text-gray-400">{item.evidence.map((e,j)=><li key={j}>{e}</li>)}</ul></div>):<p className="text-gray-400">No additional observations.</p>}</section>)}</div>
 <section><h2 className="text-lg font-bold mb-2">Market context</h2><p>{data.marketContext.overview}</p><ul className="list-disc pl-5">{data.marketContext.spy.map((text,i)=><li key={i}>{text}</li>)}</ul>{data.marketContext.symbols.map((item,i)=><div key={i} className="mt-3"><h3 className="font-semibold">{item.symbol}</h3><ul className="list-disc pl-5">{item.observations.map((text,j)=><li key={j}>{text}</li>)}</ul></div>)}</section>
 <section><h2 className="text-lg font-bold mb-2">Trade evidence</h2>{data.tradeEvidence.map((item,i)=><div key={i} className="mb-3"><h3 className="font-semibold">{item.headline}</h3><ul className="list-disc pl-5 text-gray-300">{item.details.map((text,j)=><li key={j}>{text}</li>)}</ul></div>)}</section>
 <section><h2 className="text-lg font-bold mb-2">Action items</h2><ul className="list-disc pl-5">{data.actionItems.map((text,i)=><li key={i}>{text}</li>)}</ul></section>
 <section className="rounded-lg border border-amber-900 p-4 text-amber-200"><h2 className="font-bold mb-2">Data limitations</h2><ul className="list-disc pl-5">{data.limitations.map((text,i)=><li key={i}>{text}</li>)}</ul></section></div>;
}
export function DailyReviewView({selectedDate,initialReview,initialHistory}:{selectedDate:string;initialReview:SerializedDailyReview|null;initialHistory:DailyReviewHistoryItem[]}){
 const client = useJournal();
 const { generateDailyReview } = client;
 const router=useRouter();const [connectionId,setConnectionId]=useState("");const [includeNotes,setIncludeNotes]=useState(false);
 const [review,setReview]=useState(initialReview);const [message,setMessage]=useState("");const [busy,setBusy]=useState(false);
 async function generate(force:boolean){setBusy(true);setMessage("");try{const result=await generateDailyReview({reviewDate:selectedDate,connectionId,force,includeNotes});
 if(result.review)setReview(result.review);setMessage(result.error??result.message??(result.cached?"Showing the saved review for these inputs.":"Review saved."));router.refresh();
 }catch{setMessage("Generation failed. Your saved review was left unchanged.");}finally{setBusy(false);}}
 return <div className="space-y-6"><header><h1 className="text-3xl font-bold">Daily Review</h1><p className="mt-2 text-gray-400">{client.mode === "demo" ? "Simulated AI review based on browser-local trading records." : "Evidence from your trading day, generated using your own AI connection."}</p></header>
 <div className="rounded-xl border border-gray-700 p-5 space-y-4"><label className="text-sm">Review date (New York) <input type="date" className="ml-3 rounded bg-gray-800 p-2" value={selectedDate} onChange={e=>{if(e.target.value)router.push("/daily-review?date="+e.target.value);}}/></label>
 <AiConnectionPicker feature="daily-review" value={connectionId} onChange={setConnectionId}/>
 <label className="block text-sm"><input type="checkbox" checked={includeNotes} onChange={e=>setIncludeNotes(e.target.checked)}/> {client.mode === "demo" ? "Include trade notes in the local sample report" : "Include trade notes in data sent to this connection"}</label>
 <p className="text-sm text-gray-400">Market data uses your saved daily and intraday settings. Missing or coarse data is listed in the report limitations. <Link href="/settings" className="text-sky-400 underline">Change market settings</Link></p>
 <div className="flex gap-3"><button className="rounded bg-sky-700 px-4 py-2 disabled:opacity-40" disabled={busy||!connectionId} onClick={()=>generate(false)}>{busy?"Generating…":"Generate review"}</button><button className="rounded border border-gray-600 px-4 py-2 disabled:opacity-40" disabled={busy||!connectionId||!review} onClick={()=>generate(true)}>Regenerate</button></div>
 {message&&<p role="status" className="text-amber-200">{message}</p>}</div>
 {review?<article className="rounded-xl border border-gray-700 p-6"><p className="mb-4 text-xs text-gray-400">{review.reviewDate} · {review.provider} · {review.modelName??review.modelId} · {review.tradeCount} trades · {review.executionCount} executions</p><ReviewContent review={review}/></article>:<p className="rounded-xl border border-gray-700 p-8 text-gray-400">No saved review for this date. Import trading records and configure your API connection to begin.</p>}
 <section className="rounded-xl border border-gray-700 p-5"><h2 className="mb-3 text-lg font-bold">Saved review history</h2><div className="flex flex-wrap gap-2">{initialHistory.length?initialHistory.map(item=><Link className="rounded bg-gray-800 px-3 py-2 text-sm" key={item.reviewDate} href={"/daily-review?date="+item.reviewDate}>{item.reviewDate} · {item.modelName??item.modelId}</Link>):<p className="text-sm text-gray-400">No reviews yet.</p>}</div></section></div>;
}
