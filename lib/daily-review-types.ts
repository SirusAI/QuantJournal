import type { AiProvider } from "./settings-types";
export type DailyReviewProvider = AiProvider;

export interface DailyReviewModel {
    name: string;
    model: string;
    provider: DailyReviewProvider;
    modifiedAt: string;
    size: number;
    family: string | null;
    parameterSize: string | null;
    quantizationLevel: string | null;
    remoteHost: string | null;
}

export type OllamaModel = DailyReviewModel;

export interface DailyReviewObservation {
    title: string;
    detail: string;
    evidence: string[];
}

export interface DailyReviewSymbolNarrative {
    symbol: string;
    observations: string[];
}

export interface DailyReviewTradeEvidenceItem {
    symbol: string;
    headline: string;
    details: string[];
}

export interface DailyReviewStructured {
    summary: string;
    strengths: DailyReviewObservation[];
    weaknesses: DailyReviewObservation[];
    marketContext: {
        overview: string;
        spy: string[];
        symbols: DailyReviewSymbolNarrative[];
    };
    tradeEvidence: DailyReviewTradeEvidenceItem[];
    actionItems: string[];
    limitations: string[];
}

export interface DailyReviewSymbolConcentration {
    symbol: string;
    tradeCount: number;
    executionCount: number;
    volume: number;
    estimatedNetPl: number;
}

export interface DailyReviewTradeSnapshot {
    tradeId: string;
    symbol: string;
    direction: string;
    status: string;
    executionCountForDay: number;
    totalExecutionCount: number;
    hasExecutionsOutsideDay: boolean;
    firstExecutionTimeNy: string;
    lastExecutionTimeNy: string;
    holdMinutes: number;
    estimatedNetPl: number;
    totalFees: number;
    totalVolume: number;
    entryPrice: number | null;
    exitPrice: number | null;
    dayPriceChangePct: number | null;
    tags: string[];
    notesExcerpt: string | null;
}

export interface DailyReviewMarketInstrumentContext {
    symbol: string;
    previousClose: number | null;
    open: number | null;
    close: number | null;
    high: number | null;
    low: number | null;
    gapPct: number | null;
    dayChangePct: number | null;
    rangePct: number | null;
    regime: string;
    totalBars: number;
    dataSource?: string;
    interval?: string;
    adjustment?: string;
    firstExecutionPrice: number | null;
    lastExecutionPrice: number | null;
    firstExecutionOffsetMinutes: number | null;
    lastExecutionOffsetMinutes: number | null;
}

export interface DailyReviewMarketNewsItem {
    symbol: string;
    source: "massive" | "yfinance";
    title: string;
    publisher: string | null;
    publishedUtc: string | null;
    description: string | null;
    url: string | null;
}

export interface DailyReviewMacroMetric {
    symbol: string;
    label: string;
    source: "yfinance";
    close: number | null;
    dayChangePct: number | null;
}

export interface DailyReviewSourceSnapshot {
    date: string;
    timeZone: string;
    totals: {
        tradeCount: number;
        executionCount: number;
        estimatedNetPl: number;
        totalFees: number;
        winningTrades: number;
        losingTrades: number;
        breakevenTrades: number;
        longTrades: number;
        shortTrades: number;
        uniqueSymbols: number;
        symbols: string[];
    };
    timing: {
        premarketExecutions: number;
        openingExecutions: number;
        middayExecutions: number;
        closingExecutions: number;
        aftermarketExecutions: number;
        firstExecutionTimeNy: string | null;
        lastExecutionTimeNy: string | null;
    };
    symbolConcentration: DailyReviewSymbolConcentration[];
    trades: DailyReviewTradeSnapshot[];
    marketContext: {
        spy: DailyReviewMarketInstrumentContext | null;
        symbols: DailyReviewMarketInstrumentContext[];
        news?: DailyReviewMarketNewsItem[];
        macro?: DailyReviewMacroMetric[];
    };
    limitations: string[];
}

export interface DailyReviewHistoryItem {
    reviewDate: string;
    provider: string;
    modelId: string;
    modelName: string | null;
    tradeCount: number;
    executionCount: number;
    updatedAt: string;
}

export interface SerializedDailyReview {
    id: string;
    reviewDate: string;
    provider: string;
    modelId: string;
    modelName: string | null;
    analysisVersion: string;
    tradeCount: number;
    executionCount: number;
    renderedReport: string;
    review: DailyReviewStructured | null;
    sourceSnapshot: DailyReviewSourceSnapshot | null;
    createdAt: string;
    updatedAt: string;
}
