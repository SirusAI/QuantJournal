"use client";
import NextLink from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { JournalContext } from "./journal-runtime";
import type { JournalClient } from "@/lib/journal-client";
import { updateTradeNotes, updateExecution, addTagToTrade, removeTagFromTrade, addTagToTrades } from "@/app/actions";
import { saveDailyJournalEntry, saveTradeReview } from "@/app/actions/journal";
import { getAiCoachAdvice, getCoachingHistory, deleteCoachingSession } from "@/app/actions/ai-coach";
import { generateDailyReview } from "@/app/actions/daily-review";
import { getEdgeAnalysisModels, generateEdgeAnalysisSummary, listEdgeAnalysisSessions, getEdgeAnalysisSession, deleteEdgeAnalysisSession } from "@/app/actions/edge-analysis";
const post = (url: string, body: unknown) => fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const client: JournalClient = {
  mode: "local", assetUrl: path => "/" + path.replace(/^\//, ""),
  updateTradeNotes, updateExecution, addTagToTrade, removeTagFromTrade, addTagToTrades,
  saveDailyJournalEntry, saveTradeReview, getAiCoachAdvice, getCoachingHistory, deleteCoachingSession,
  generateDailyReview, getEdgeAnalysisModels, generateEdgeAnalysisSummary, listEdgeAnalysisSessions, getEdgeAnalysisSession, deleteEdgeAnalysisSession,
  getSettings: () => fetch("/api/settings"), updateSettings: body => post("/api/settings", body),
  createTrade: body => post("/api/trades", body), deleteTrade: id => fetch("/api/trades/" + encodeURIComponent(id), { method: "DELETE" }),
  deleteTrades: ids => post("/api/trades/batch", { ids }),
  importFiles: (files, date) => { const form = new FormData(); for (const file of files) form.append("files", file); form.append("defaultDate", date); return fetch("/api/upload", { method: "POST", body: form }); },
  importPasted: text => post("/api/upload", { text }),
  getMarketData: (symbol, date, source, interval, signal) => fetch(`/api/market-data/${encodeURIComponent(symbol)}/${date}?` + new URLSearchParams({ source, interval }), { signal }),
  getSpyDaily: (from, to) => fetch("/api/spy-daily?" + new URLSearchParams({ startDate: from, endDate: to })),
  getEdgeAnalysis: (params, signal) => fetch("/api/edge-analysis?" + params, { signal }),
};
export function LocalJournalProvider({ children }: { children: ReactNode }) {
  const router = useRouter(); const pathname = usePathname();
  return <JournalContext.Provider value={{ client, navigation: { pathname, push: router.push, refresh: router.refresh }, LinkComponent: NextLink }}>{children}</JournalContext.Provider>;
}
