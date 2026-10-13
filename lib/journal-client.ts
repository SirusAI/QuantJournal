import type { MarketInterval, MarketSource } from "./settings-types";

export interface TradeInput {
  symbol: string; date: string; notes?: string; tags?: string; pnl?: number;
  executions?: { side: string; quantity: number; price: number; time: string; fee?: number; pnl?: number | string }[];
}
type TradeActions = Pick<typeof import("../app/actions"), "updateTradeNotes" | "updateExecution" | "addTagToTrade" | "removeTagFromTrade" | "addTagToTrades">;
type JournalActions = Pick<typeof import("../app/actions/journal"), "saveDailyJournalEntry" | "saveTradeReview">;
type CoachActions = Pick<typeof import("../app/actions/ai-coach"), "getAiCoachAdvice" | "getCoachingHistory" | "deleteCoachingSession">;
type ReviewActions = Pick<typeof import("../app/actions/daily-review"), "generateDailyReview">;
type EdgeActions = Pick<typeof import("../app/actions/edge-analysis"), "getEdgeAnalysisModels" | "generateEdgeAnalysisSummary" | "listEdgeAnalysisSessions" | "getEdgeAnalysisSession" | "deleteEdgeAnalysisSession">;

/** Transport boundary shared by the local server and the offline browser demo. */
export interface JournalClient extends TradeActions, JournalActions, CoachActions, ReviewActions, EdgeActions {
  mode: "local" | "demo";
  referenceDate?: string;
  storageKey?: string;
  assetUrl(path: string): string;
  getSettings(): Promise<Response>;
  updateSettings(command: unknown): Promise<Response>;
  createTrade(input: TradeInput): Promise<Response>;
  deleteTrade(id: string): Promise<Response>;
  deleteTrades(ids: string[]): Promise<Response>;
  importFiles(files: File[], defaultDate: string): Promise<Response>;
  importPasted(text: string): Promise<Response>;
  getMarketData(symbol: string, date: string, source: MarketSource, interval: MarketInterval, signal?: AbortSignal): Promise<Response>;
  getSpyDaily(from: string, to: string): Promise<Response>;
  getEdgeAnalysis(params: URLSearchParams, signal?: AbortSignal): Promise<Response>;
}
