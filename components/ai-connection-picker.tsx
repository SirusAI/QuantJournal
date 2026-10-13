"use client";
import { useJournal } from "@/components/journal-runtime";
import { useEffect, useState } from "react";
import { Link } from "@/components/journal-runtime";
import type { AiFeature, AiConnection, SettingsDto } from "@/lib/settings-types";
export function AiConnectionPicker({ feature, value, onChange }: { feature: AiFeature; value: string; onChange: (id: string) => void }) {
 const client = useJournal();
  const [connections, setConnections] = useState<AiConnection[]>([]);
  useEffect(() => {
    let cancelled = false;
    client.getSettings().then(r=>r.json()).then((s: SettingsDto)=> {
      if (cancelled) return; setConnections(s.connections);
      if (!value && s.selections[feature]) onChange(s.selections[feature]!);
    }).catch(()=>{});
    return ()=>{cancelled=true;};
  }, [feature,value,onChange]);
  return <div className="flex flex-wrap items-center gap-3"><label className="text-sm">AI connection <select aria-label="AI connection" value={value} onChange={e=>onChange(e.target.value)} className="ml-2 rounded border border-gray-600 bg-gray-800 p-2"><option value="">Choose a connection</option>{connections.map(c=><option key={c.id} value={c.id}>{c.name} · {c.provider} · {c.modelId}</option>)}</select></label><Link href="/settings" className="text-sm text-sky-400 underline">Configure APIs</Link><p className="w-full text-xs text-gray-400">{client.mode === "demo" ? "Simulated AI responses are produced locally; nothing is sent to a provider." : "Generation sends the selected analysis data to this connection. Saved keys stay on your local server."}</p></div>;
}
