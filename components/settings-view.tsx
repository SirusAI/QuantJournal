"use client";
import { useJournal } from "@/components/journal-runtime";
import { useEffect, useState } from "react";
import { AI_PROVIDERS, DEFAULT_MARKET, MARKET_INTERVALS } from "@/lib/settings-types";
import type { AiConnection, AiConnectionInput, AiFeature, AiProvider, MarketInterval, MarketSettings, MarketSource, SettingsDto } from "@/lib/settings-types";
const field = "rounded border border-gray-600 bg-gray-950 p-2 text-white w-full";
const button = "rounded border border-gray-600 bg-gray-800 px-4 py-2 hover:bg-gray-700 disabled:opacity-40";
const blankConnection = (): AiConnectionInput => ({ name: "", provider: "openai", baseUrl: AI_PROVIDERS.openai.baseUrl, modelId: "", apiKey: "", timeoutSeconds: 120 });
function InputField({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) { return <label className="block text-sm text-gray-300">{label}<input className={`${field} mt-1`} {...props}/></label>; }
export function SettingsView() {
 const client = useJournal();
  const [settings,setSettings] = useState<SettingsDto>({connections:[],selections:{},market:DEFAULT_MARKET});
  const [connection,setConnection] = useState<AiConnectionInput>(blankConnection);
  const [market,setMarket] = useState<MarketSettings>(DEFAULT_MARKET);
  const [massiveKey,setMassiveKey] = useState(""); const [customKey,setCustomKey] = useState("");
  const [clearMassiveKey,setClearMassiveKey] = useState(false); const [clearCustomKey,setClearCustomKey] = useState(false);
  const [query,setQuery] = useState("{}"); const [notice,setNotice] = useState(""); const [busy,setBusy] = useState(false);
  const [modelList,setModelList] = useState<string[]>([]);
  useEffect(()=>{client.getSettings().then(r=>r.json()).then((s: SettingsDto)=>{setSettings(s);setMarket(s.market);setQuery(JSON.stringify(s.market.custom.query,null,2));}).catch(()=>setNotice("Unable to load settings."));},[]);
  async function action(payload: unknown) {
    setBusy(true);setNotice("");
    try { const response = await client.updateSettings(payload);
      const result = await response.json(); if (!response.ok || result.error) throw new Error(result.error ?? "Operation failed.");
      if (result.connections) {setSettings(result);setNotice("Settings saved.");}
      else if (result.models) {setModelList(result.models);setNotice(client.mode === "demo" ? "Example model IDs loaded; no provider was contacted." : `${result.models.length} model IDs loaded. You can also enter one manually.`);}
      else setNotice(result.message ?? (result.available ? `Python/yfinance ready (${result.version}).` : JSON.stringify(result)));
      return true;
    } catch(error){setNotice(error instanceof Error ? error.message : "Operation failed.");return false;}
    finally{setBusy(false);}
  }
  function edit(c: AiConnection) {setConnection({...c,apiKey:"",clearApiKey:false});setModelList([]);}
  const set = <K extends keyof MarketSettings>(key: K, value: MarketSettings[K]) => setMarket(m=>({...m,[key]:value}));
  return <div className="space-y-8">
    <header><h1 className="text-3xl font-bold">AI & Market Settings</h1><p className="mt-2 text-gray-400">{client.mode === "demo" ? "Demo configuration: tests and model lists are simulated. Credential fields are disabled; no provider is contacted." : "Local single-user settings. Keys are encrypted on this machine and never returned by the settings API."}</p></header>
    {notice && <p role="status" className="rounded border border-sky-800 bg-sky-950 p-4 whitespace-pre-wrap break-words">{notice}</p>}
    <section className="space-y-4 rounded-xl border border-gray-700 p-6"><h2 className="text-xl font-bold">AI connections</h2>
      <div className="space-y-3">{settings.connections.map(c=><div key={c.id} className="flex flex-wrap items-center gap-3 border-b border-gray-700 pb-3"><span className="flex-1">{c.name} · {AI_PROVIDERS[c.provider].label} · {c.modelId}<span className="ml-3 text-xs text-gray-400">{client.mode === "demo" ? "Simulated connection" : c.hasApiKey?"Key saved":"No key"}</span></span><button className={button} onClick={()=>edit(c)}>Edit</button><button disabled={busy} className={button} onClick={()=>action({action:"test-ai",id:c.id})}>Test</button><button disabled={busy} className={button} onClick={()=>{if(window.confirm(`Delete ${c.name}? Saved reviews will remain.`))void action({action:"delete-connection",id:c.id});}}>Delete</button></div>)}</div>
      <form className="grid gap-4 md:grid-cols-2" onSubmit={async e=>{e.preventDefault();if(await action({action:"save-connection",connection}))setConnection(blankConnection());}}>
        <InputField label="Connection name" required value={connection.name} onChange={e=>setConnection({...connection,name:e.target.value})}/>
        <label className="text-sm">Provider<select className={`${field} mt-1`} value={connection.provider} onChange={e=>{const provider=e.target.value as AiProvider;setConnection({...connection,provider,baseUrl:AI_PROVIDERS[provider].baseUrl});}}>{Object.entries(AI_PROVIDERS).map(([id,p])=><option key={id} value={id}>{p.label}</option>)}</select></label>
        <InputField label="Base URL" required value={connection.baseUrl} onChange={e=>setConnection({...connection,baseUrl:e.target.value})}/>
        <label className="text-sm">Model ID<input required list="ai-model-ids" className={`${field} mt-1`} value={connection.modelId} onChange={e=>setConnection({...connection,modelId:e.target.value})}/><datalist id="ai-model-ids">{modelList.map(id=><option key={id} value={id}/>)}</datalist></label>
        <InputField label="API key (blank keeps the saved key; optional for local services)" type="password" disabled={client.mode === "demo"} autoComplete="new-password" value={connection.apiKey??""} onChange={e=>setConnection({...connection,apiKey:e.target.value})}/>
        <InputField label="Timeout (seconds, 10–600)" type="number" min={10} max={600} value={connection.timeoutSeconds} onChange={e=>setConnection({...connection,timeoutSeconds:Number(e.target.value)})}/>
        <label className="text-sm"><input type="checkbox" checked={!!connection.clearApiKey} onChange={e=>setConnection({...connection,clearApiKey:e.target.checked})}/> Clear this connection&apos;s saved key</label>
        <div className="flex gap-2"><button disabled={busy} className={button}>Save connection</button><button type="button" className={button} onClick={()=>setConnection(blankConnection())}>New</button><button type="button" disabled={busy||!connection.id} className={button} onClick={()=>action({action:"models",id:connection.id})}>Refresh model IDs</button></div>
      </form><p className="text-xs text-gray-400">Save first, then test or refresh model IDs. Some endpoints cannot list models; manual IDs always work.</p>
      <div className="grid gap-3 md:grid-cols-3">{(["daily-review","ai-coach","edge-analysis"] as AiFeature[]).map(feature=><label key={feature} className="text-sm">{feature}<select className={`${field} mt-1`} value={settings.selections[feature]??""} disabled={busy} onChange={e=>action({action:"select",feature,id:e.target.value})}><option value="">Choose a connection</option>{settings.connections.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>)}</div>
    </section>
    <section className="space-y-4 rounded-xl border border-gray-700 p-6"><h2 className="text-xl font-bold">Market data</h2>
      <form className="space-y-4" onSubmit={async e=>{e.preventDefault();try {const mappings=JSON.parse(query);if(!mappings||Array.isArray(mappings)||typeof mappings!=="object"||!Object.values(mappings).every(v=>typeof v==="string"))throw new Error("Query mappings must be a JSON object of strings.");if(await action({action:"save-market",market:{...market,custom:{...market.custom,query:mappings}},keys:{massiveKey,customKey,clearMassiveKey,clearCustomKey}})){setMassiveKey("");setCustomKey("");setClearMassiveKey(false);setClearCustomKey(false);}}catch(error){setNotice((error as Error).message);}}}>
        <div className="grid gap-4 md:grid-cols-3">{(["dailySource","intradaySource"] as const).map(key=><label key={key} className="text-sm">{key==="dailySource"?"Daily bars source":"Intraday source"}<select className={`${field} mt-1`} value={market[key]} onChange={e=>set(key,e.target.value as MarketSource)}>{["yfinance","massive","custom"].map(id=><option key={id}>{id}</option>)}</select></label>)}<label className="text-sm">Intraday interval<select className={`${field} mt-1`} value={market.intradayInterval} onChange={e=>set("intradayInterval",e.target.value as MarketInterval)}>{MARKET_INTERVALS.filter(i=>i!=="1d").map(i=><option key={i}>{i}</option>)}</select></label></div>
        <div className="rounded border border-gray-700 bg-gray-950 p-4 text-sm"><strong>yfinance: free access with limited history</strong><p className="mt-2">Daily bars depend on the ticker&apos;s available history. Conservative intraday windows: 1m ≈ 8 days; 2m/5m/15m/30m/90m ≈ 60 days; 60m ≈ 730 days. These are availability hints, not guaranteed coverage. No fixed free request quota is promised; Yahoo can rate-limit requests. Data is intended for personal use.</p><a className="text-sky-400 underline" href="https://ranaroussi.github.io/yfinance/reference/api/yfinance.download.html" target="_blank" rel="noreferrer">yfinance documentation</a></div>
        <div className="grid gap-4 md:grid-cols-2"><InputField label="Python executable (blank uses local environment or system Python)" value={market.pythonCommand} onChange={e=>set("pythonCommand",e.target.value)}/><div className="text-sm text-gray-400">Install with <code>npm run setup:market-data</code><br/><button type="button" disabled={busy} className={`${button} mt-2`} onClick={()=>action({action:"check-python"})}>Check Python & yfinance</button></div></div>
        <label className="block text-sm"><input type="checkbox" checked={market.prepost} onChange={e=>set("prepost",e.target.checked)}/> Include pre-market and after-hours bars when available</label>
        <label className="block text-sm"><input type="checkbox" checked={market.supplemental} onChange={e=>set("supplemental",e.target.checked)}/> Optional yfinance news and macro context for Daily Review (historical news may be unavailable)</label>
        <div className="rounded border border-gray-700 p-4 space-y-3"><h3 className="font-semibold">Massive</h3><p className="text-sm text-gray-400">Supply your own key. Free Basic and paid plans have different historical coverage, request limits and permissions. Select your plan for request pacing; entitlement is checked by the actual API response. <a className="text-sky-400 underline" href="https://massive.com/pricing?product=stocks" target="_blank" rel="noreferrer">View current plans</a></p><div className="grid gap-3 md:grid-cols-2"><InputField label={settings.market.hasMassiveKey?"Massive key saved — blank keeps it":"Massive API key"} type="password" disabled={client.mode === "demo"} autoComplete="new-password" value={massiveKey} onChange={e=>setMassiveKey(e.target.value)}/><label className="text-sm">Plan<select className={`${field} mt-1`} value={market.massivePlan} onChange={e=>set("massivePlan",e.target.value as MarketSettings["massivePlan"])}>{["unknown","basic","starter","developer","advanced"].map(p=><option key={p}>{p}</option>)}</select></label></div><label className="text-sm"><input type="checkbox" checked={clearMassiveKey} onChange={e=>setClearMassiveKey(e.target.checked)}/> Clear saved Massive key</label></div>
        <details className="rounded border border-gray-700 p-4"><summary className="cursor-pointer font-semibold">Custom HTTP OHLCV API</summary><div className="mt-4 grid gap-3 md:grid-cols-2">
          <InputField label="GET URL template (no query; placeholders: {symbol}, {from}, {to}, {interval})" value={market.custom.url} onChange={e=>set("custom",{...market.custom,url:e.target.value})}/>
          <InputField label="Response array path (blank for root array)" value={market.custom.dataPath} onChange={e=>set("custom",{...market.custom,dataPath:e.target.value})}/>
          <label className="text-sm">Authentication<select className={`${field} mt-1`} value={market.custom.auth} onChange={e=>set("custom",{...market.custom,auth:e.target.value as MarketSettings["custom"]["auth"]})}>{["none","bearer","header","query"].map(a=><option key={a}>{a}</option>)}</select></label>
          <InputField label="Credential header / query name" value={market.custom.keyName} onChange={e=>set("custom",{...market.custom,keyName:e.target.value})}/>
          <InputField label={settings.market.hasCustomKey?"Custom key saved — blank keeps it":"Custom API key"} type="password" disabled={client.mode === "demo"} autoComplete="new-password" value={customKey} onChange={e=>setCustomKey(e.target.value)}/>
          <label className="text-sm"><input type="checkbox" checked={clearCustomKey} onChange={e=>setClearCustomKey(e.target.checked)}/> Clear saved custom key</label>
          {Object.entries(market.custom.fields).map(([name,value])=><InputField key={name} label={`${name} field path`} value={value} onChange={e=>set("custom",{...market.custom,fields:{...market.custom.fields,[name]:e.target.value}})}/>)}
          <label className="text-sm">Time format<select className={`${field} mt-1`} value={market.custom.timeFormat} onChange={e=>set("custom",{...market.custom,timeFormat:e.target.value as MarketSettings["custom"]["timeFormat"]})}>{["seconds","milliseconds","iso"].map(f=><option key={f}>{f}</option>)}</select></label>
          <InputField label="Exchange timezone" value={market.custom.timeZone} onChange={e=>set("custom",{...market.custom,timeZone:e.target.value})}/>
          <label className="text-sm">Price adjustment<select className={`${field} mt-1`} value={market.custom.adjustment} onChange={e=>set("custom",{...market.custom,adjustment:e.target.value as MarketSettings["custom"]["adjustment"]})}>{["unknown","unadjusted","split-adjusted"].map(f=><option key={f}>{f}</option>)}</select></label>
          <InputField label="Maximum history in days (blank for unspecified)" type="number" min={1} value={market.custom.maxHistoryDays??""} onChange={e=>set("custom",{...market.custom,maxHistoryDays:e.target.value?Number(e.target.value):null})}/>
          <label className="text-sm md:col-span-2">Query parameter mappings (JSON)<textarea className={`${field} mt-1 font-mono`} rows={4} value={query} onChange={e=>setQuery(e.target.value)}/></label>
          <div className="md:col-span-2 text-sm">Supported intervals<div className="flex flex-wrap gap-4 mt-2">{MARKET_INTERVALS.map(i=><label key={i}><input type="checkbox" checked={market.custom.intervals.includes(i)} onChange={e=>set("custom",{...market.custom,intervals:e.target.checked?[...market.custom.intervals,i]:market.custom.intervals.filter(v=>v!==i)})}/> {i}</label>)}</div></div>
        </div></details><button disabled={busy} className={button}>Save market settings</button><p className="text-xs text-gray-400">Graphs use saved settings. Missing market data never changes your imported trading results.</p>
      </form>
    </section>
  </div>;
}
