import React from "react";
import { AbsoluteFill, Composition, Img, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { CSV_HEADER, SAMPLE_CSV } from "../lib/broker-import";

export const scenes = [
  {start:6,end:14,title:"Start with your broker’s executions",caption:"Export stock fills as CSV. Holdings and account summaries are different records.",image:"import-guide",step:"01 · EXPORT"},
  {start:14,end:22,title:"Prepare the eight-column template",caption:"One CSV per trading date. Convert execution times to America/New_York.",image:"import-guide",step:"02 · PREPARE",template:true},
  {start:22,end:29,title:"Choose the date and import the CSV",caption:"A filename such as 06-30-2026.csv overrides the fallback date.",image:"import-dialog",step:"03 · IMPORT"},
  {start:29,end:36,title:"Reconcile every fill and fee",caption:"Buy 10 at $100 → sell 10 at $102. Gross $20 − fees $1 = net $19.",image:"sample-trade",step:"04 · VERIFY"},
  {start:36,end:41,title:"Review the complete trade record",caption:"Check price, side, quantity and execution time. Correct mistakes before reviewing results.",image:"trades",step:"TRADES"},
  {start:41,end:43,title:"Edit executions and organize tags",caption:"Use execution details and tags to keep your records consistent.",image:"sample-trade",step:"TRADES"},
  {start:43,end:46,title:"Add a trade or paste a compatible table",caption:"New Trade supports manual entry and the tab-separated Smart Format template.",image:"new-trade",step:"NEW TRADE"},
  {start:46,end:54,title:"See performance in one place",caption:"Filter your history and inspect P&L, win rate, hold times and fees.",image:"dashboard",step:"DASHBOARD"},
  {start:54,end:62,title:"Explore your trading calendar",caption:"Move between monthly and longer views, then open the trades behind each day.",image:"calendar",step:"CALENDAR"},
  {start:62,end:68,title:"Capture the day before judging it",caption:"Save your plan, observations and decisions in Daily Notes.",image:"journal",step:"JOURNAL"},
  {start:68,end:74,title:"Review process, not just outcome",caption:"Evaluate entry, exit, psychology and risk. Record one specific lesson.",image:"trade-review",step:"TRADE REVIEW"},
  {start:74,end:79,title:"Compare wins, losses and statistics",caption:"Reports summarize the selected period. Sample results describe fictional records.",image:"reports-overview",step:"REPORTS"},
  {start:79,end:84,title:"Understand the drawdown",caption:"Inspect losing stretches and recovery periods in the Drawdown tab.",image:"reports-drawdown",step:"DRAWDOWN"},
  {start:84,end:90,title:"Explore deterministic Edge Analysis",caption:"Compare groups with sample size and evidence limits. Associations are not predictions.",image:"reports-edge",step:"EDGE ANALYSIS"},
  {start:90,end:97,title:"Turn the day into a structured review",caption:"Daily Review preserves evidence, actions and limitations. This demo response is simulated.",image:"daily-review",step:"SIMULATED AI"},
  {start:97,end:104,title:"Explore AI Coach and saved history",caption:"Choose a connection and analyze selected statistics. No provider is contacted in this demo.",image:"ai-coach",step:"SIMULATED AI"},
  {start:104,end:110,title:"Configure your own AI in the local app",caption:"OpenAI, DeepSeek, Claude, Google, OpenRouter, Nvidia, Ollama and compatible endpoints.",image:"settings",step:"AI SETTINGS"},
  {start:110,end:116,title:"Choose market data and interval",caption:"yfinance, Massive or custom HTTP. History limits depend on source and interval.",image:"market-settings",step:"MARKET SETTINGS"},
] as const;
const palette={bg:"#070f1d",white:"#f1f5f9",muted:"#94a3b8",green:"#34d399",blue:"#38bdf8"};
function Intro({closing=false}:{closing?:boolean}) {
  const frame=useCurrentFrame();const {fps}=useVideoConfig();const reveal=spring({frame,fps,config:{damping:24}});
  return <AbsoluteFill style={{background:`radial-gradient(circle at 80% 25%, #12352f 0%, ${palette.bg} 60%)`,color:palette.white,fontFamily:"Arial, Helvetica, sans-serif",padding:110}}>
    <div style={{display:"flex",alignItems:"center",gap:26,opacity:reveal,transform:`translateY(${(1-reveal)*30}px)`}}><div style={{width:90,height:90,borderRadius:45,display:"flex",alignItems:"center",justifyContent:"center",background:"#10b981",fontSize:62,fontWeight:800}}>Q</div><span style={{fontSize:60,fontWeight:800}}>QuantJournal</span></div>
    <div style={{fontSize:84,lineHeight:1.12,fontWeight:800,marginTop:90,maxWidth:1600,whiteSpace:"pre-line",opacity:interpolate(frame,[12,35],[0,1],{extrapolateLeft:"clamp",extrapolateRight:"clamp"})}}>{closing?"Try the sample.\nExplore. Reset. Repeat.":"Execution history.\nClearer reviews."}</div>
    <p style={{fontSize:34,lineHeight:1.5,color:palette.muted,maxWidth:1550,marginTop:45,whiteSpace:"pre-line"}}>{closing?"Import real broker records in your local installation.\nUse the public demo to practice the workflow.":"Import your executions. Explore performance, journaling,\nand configurable AI in a two-minute walkthrough."}</p>
    <div style={{position:"absolute",bottom:115,left:110,display:"flex",gap:18}}>{["FICTIONAL TRADES","SYNTHETIC PRICES","SIMULATED AI"].map(label=><div key={label} style={{border:"1px solid #466256",borderRadius:12,padding:"15px 23px",fontSize:24,color:palette.green,letterSpacing:1.5}}>{label}</div>)}</div>
  </AbsoluteFill>;
}
function ScreenScene({scene}:{scene:typeof scenes[number]}) {
  const frame=useCurrentFrame();const {fps}=useVideoConfig();const duration=(scene.end-scene.start)*fps;
  const opacity=interpolate(frame,[0,10,duration-10,duration],[0,1,1,0],{extrapolateLeft:"clamp",extrapolateRight:"clamp"});
  const zoom=interpolate(frame,[0,duration],[1,1.035],{extrapolateRight:"clamp"});
  const reveal=spring({frame,fps,config:{damping:24}});
  return <AbsoluteFill style={{background:palette.bg,color:palette.white,fontFamily:"Arial, Helvetica, sans-serif",opacity}}>
    <div style={{position:"absolute",left:72,top:32,color:palette.green,fontWeight:800,fontSize:22,letterSpacing:3}}>{scene.step}</div>
    <div style={{position:"absolute",left:72,top:72,right:72,fontSize:47,fontWeight:800,transform:`translateX(${(1-reveal)*30}px)`}}>{scene.title}</div>
    <div style={{position:"absolute",left:72,top:154,width:1776,height:730,overflow:"hidden",borderRadius:18,border:"2px solid #34516b",boxShadow:"0 20px 70px #0009"}}>
      <Img src={staticFile(`media/${scene.image}.jpg`)} style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:"top center",transform:`scale(${zoom})`,transformOrigin:"center top"}}/>
      {"template" in scene&&scene.template&&<div style={{position:"absolute",inset:65,borderRadius:18,background:"#081525f5",border:"2px solid #34d399",padding:45,transform:`translateY(${(1-reveal)*25}px)`}}><p style={{color:palette.green,fontSize:26,fontWeight:800}}>MAP YOUR BROKER’S FILLS TO THIS FORMAT</p><pre style={{fontSize:29,lineHeight:1.9,color:palette.white,marginTop:32,whiteSpace:"pre-wrap"}}>{SAMPLE_CSV}</pre><p style={{fontSize:29,color:palette.muted}}>Time is New York wall time · Fee is per fill · Pnl is optional net P&amp;L</p><p style={{fontSize:26,color:palette.blue,marginTop:30}}>Keep all eight columns: {CSV_HEADER}</p></div>}
      <div style={{position:"absolute",left:14,top:14,right:14,bottom:14,border:`2px solid rgba(56,189,248,${0.12+Math.sin(frame/18)*0.06})`,borderRadius:10,pointerEvents:"none"}}/>
    </div>
    <div style={{position:"absolute",left:72,right:72,top:917,fontSize:31,lineHeight:1.35,paddingLeft:24,borderLeft:"5px solid #34d399",transform:`translateY(${(1-reveal)*15}px)`}}>{scene.caption}</div>
    <div style={{position:"absolute",left:72,bottom:26,fontSize:17,color:palette.muted}}>Fictional practice data · The public demo saves edits only in your browser</div>
  </AbsoluteFill>;
}
export function QuantJournalTour(){const frame=useCurrentFrame();return <AbsoluteFill style={{background:palette.bg}}><Sequence durationInFrames={180}><Intro/></Sequence>{scenes.map(scene=><Sequence key={scene.start} from={scene.start*30} durationInFrames={(scene.end-scene.start)*30}><ScreenScene scene={scene}/></Sequence>)}<Sequence from={3480} durationInFrames={120}><Intro closing/></Sequence><div style={{position:"absolute",left:0,bottom:0,height:5,width:`${frame/3599*100}%`,background:palette.green}}/></AbsoluteFill>;}
export function VideoRoot(){return <Composition id="QuantJournalTour" component={QuantJournalTour} durationInFrames={3600} fps={30} width={1920} height={1080}/>;}
