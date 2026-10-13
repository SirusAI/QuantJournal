import "server-only";

import fs from "fs";
import path from "path";

import { db } from "@/lib/db";
import {
    DailyReviewHistoryItem,
    DailyReviewMarketInstrumentContext,
    DailyReviewMarketNewsItem,
    DailyReviewMacroMetric,
    DailyReviewObservation,
    DailyReviewSourceSnapshot,
    DailyReviewStructured,
    DailyReviewSymbolNarrative,
    DailyReviewTradeEvidenceItem,
    DailyReviewTradeSnapshot,
    SerializedDailyReview,
} from "@/lib/daily-review-types";
import { getDailyReviewProviderLabel } from "@/lib/daily-review-models";
import { generateAi } from "@/lib/ai-client";
import { getSettings, resolveConnection } from "@/lib/local-settings";
import { getMarketDataResult, runMarketPython } from "@/lib/market-data";
import { createHash } from "node:crypto";
import {
    NEW_YORK_TIME_ZONE,
    addDaysToDateKey,
    formatDateForDisplay,
    formatTimeInTimeZone,
    getMinutesSinceMarketOpen,
    getMinutesSinceMidnightInTimeZone,
    getNewYorkDayBounds,
} from "@/lib/trading-day";

const DAILY_REVIEW_ANALYSIS_VERSION = "v3";
const REGULAR_MARKET_OPEN_MINUTES = (9 * 60) + 30;
const REGULAR_MARKET_CLOSE_MINUTES = 16 * 60;
const DEFAULT_EMPTY_SUMMARY = "No summary returned.";
const DEFAULT_EMPTY_MARKET_CONTEXT = "Market context was limited.";




interface AggregateBar {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number | null;
    dateKey: string;
}

interface DayExecutionSlice {
    time: Date;
    side: string;
    price: number;
    quantity: number;
    fee: number;
    pnl: number | null;
}

interface TradeSliceSummary {
    tradeId: string;
    symbol: string;
    direction: string;
    status: string;
    dayExecutions: DayExecutionSlice[];
    totalExecutionCount: number;
    hasExecutionsOutsideDay: boolean;
    estimatedNetPl: number;
    totalFees: number;
    totalVolume: number;
    holdMinutes: number;
    entryPrice: number | null;
    exitPrice: number | null;
    dayPriceChangePct: number | null;
    tags: string[];
    notesExcerpt: string | null;
}

type StoredDailyReviewRecord = Awaited<ReturnType<typeof db.dailyReview.findUnique>>;

const DAILY_REVIEW_RESPONSE_SCHEMA: Record<string, unknown> = {
    type: "object",
    required: ["summary", "strengths", "weaknesses", "marketContext", "tradeEvidence", "actionItems", "limitations"],
    properties: {
        summary: { type: "string" },
        strengths: {
            type: "array",
            items: {
                type: "object",
                required: ["title", "detail", "evidence"],
                properties: {
                    title: { type: "string" },
                    detail: { type: "string" },
                    evidence: {
                        type: "array",
                        items: { type: "string" },
                    },
                },
            },
        },
        weaknesses: {
            type: "array",
            items: {
                type: "object",
                required: ["title", "detail", "evidence"],
                properties: {
                    title: { type: "string" },
                    detail: { type: "string" },
                    evidence: {
                        type: "array",
                        items: { type: "string" },
                    },
                },
            },
        },
        marketContext: {
            type: "object",
            required: ["overview", "spy", "symbols"],
            properties: {
                overview: { type: "string" },
                spy: {
                    type: "array",
                    items: { type: "string" },
                },
                symbols: {
                    type: "array",
                    items: {
                        type: "object",
                        required: ["symbol", "observations"],
                        properties: {
                            symbol: { type: "string" },
                            observations: {
                                type: "array",
                                items: { type: "string" },
                            },
                        },
                    },
                },
            },
        },
        tradeEvidence: {
            type: "array",
            items: {
                type: "object",
                required: ["symbol", "headline", "details"],
                properties: {
                    symbol: { type: "string" },
                    headline: { type: "string" },
                    details: {
                        type: "array",
                        items: { type: "string" },
                    },
                },
            },
        },
        actionItems: {
            type: "array",
            items: { type: "string" },
        },
        limitations: {
            type: "array",
            items: { type: "string" },
        },
    },
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown, fallback = ""): string {
    return typeof value === "string" ? value.trim() : fallback;
}

function asStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
        return [];
    }

    return value
        .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
        .filter((entry) => entry.length > 0);
}

function safeParseJson<T>(value: string): T | null {
    try {
        return JSON.parse(value) as T;
    } catch {
        return null;
    }
}

function formatSignedPercent(value: number | null): string | null {
    if (value === null || Number.isNaN(value)) {
        return null;
    }

    const sign = value >= 0 ? "+" : "";
    return `${sign}${value.toFixed(2)}%`;
}

function formatCurrencyValue(value: number | null): string | null {
    if (value === null || Number.isNaN(value)) {
        return null;
    }

    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 2,
    }).format(value);
}

function formatExecutionOffsetLabel(offsetMinutes: number | null): string | null {
    if (offsetMinutes === null) {
        return null;
    }

    if (offsetMinutes === 0) {
        return "at the open";
    }

    const absoluteMinutes = Math.abs(offsetMinutes);
    return offsetMinutes > 0
        ? `${absoluteMinutes} minutes after the open`
        : `${absoluteMinutes} minutes before the open`;
}

function isMissingStructuredText(value: string | null | undefined, placeholder: string): boolean {
    if (!value) {
        return true;
    }

    const normalizedValue = value.trim().toLowerCase();
    return normalizedValue.length === 0 || normalizedValue === placeholder.trim().toLowerCase();
}

function dedupeStrings(values: string[]): string[] {
    return [...new Set(values.filter((value) => value.trim().length > 0))];
}

function dedupeNewsItems(items: DailyReviewMarketNewsItem[]): DailyReviewMarketNewsItem[] {
    const seen = new Set<string>();

    return items.filter((item) => {
        const key = `${item.symbol}|${item.url ?? item.title}`;
        if (seen.has(key)) {
            return false;
        }

        seen.add(key);
        return true;
    });
}

function normalizeObservationArray(value: unknown): DailyReviewObservation[] {
    if (!Array.isArray(value)) {
        return [];
    }

    return value
        .map((entry) => {
            if (typeof entry === "string" && entry.trim()) {
                return {
                    title: entry.trim(),
                    detail: entry.trim(),
                    evidence: [],
                };
            }

            if (!isRecord(entry)) {
                return null;
            }

            const title = asString(entry.title ?? entry.headline ?? entry.label, "Observation");
            const detail = asString(entry.detail ?? entry.summary ?? entry.description, "");
            const evidence = asStringArray(entry.evidence);

            if (!title && !detail) {
                return null;
            }

            return { title, detail: detail || title, evidence };
        })
        .filter((entry): entry is DailyReviewObservation => entry !== null);
}

function normalizeSymbolNarratives(value: unknown): DailyReviewSymbolNarrative[] {
    if (!Array.isArray(value)) {
        return [];
    }

    return value
        .map((entry) => {
            if (!isRecord(entry)) {
                return null;
            }

            const symbol = asString(entry.symbol, "");
            const observations = asStringArray(entry.observations);

            if (!symbol) {
                return null;
            }

            return { symbol, observations };
        })
        .filter((entry): entry is DailyReviewSymbolNarrative => entry !== null);
}

function normalizeTradeEvidence(value: unknown): DailyReviewTradeEvidenceItem[] {
    if (!Array.isArray(value)) {
        return [];
    }

    return value
        .map((entry) => {
            if (!isRecord(entry)) {
                return null;
            }

            const symbol = asString(entry.symbol, "");
            const headline = asString(entry.headline ?? entry.title, "");
            const details = asStringArray(entry.details ?? entry.evidence);

            if (!symbol || !headline) {
                return null;
            }

            return { symbol, headline, details };
        })
        .filter((entry): entry is DailyReviewTradeEvidenceItem => entry !== null);
}

function normalizeDailyReview(value: unknown): DailyReviewStructured {
    const record = isRecord(value) ? value : {};
    const marketContext = isRecord(record.marketContext) ? record.marketContext : {};

    return {
        summary: asString(record.summary, DEFAULT_EMPTY_SUMMARY),
        strengths: normalizeObservationArray(record.strengths),
        weaknesses: normalizeObservationArray(record.weaknesses),
        marketContext: {
            overview: asString(marketContext.overview, DEFAULT_EMPTY_MARKET_CONTEXT),
            spy: asStringArray(marketContext.spy),
            symbols: normalizeSymbolNarratives(marketContext.symbols),
        },
        tradeEvidence: normalizeTradeEvidence(record.tradeEvidence),
        actionItems: asStringArray(record.actionItems),
        limitations: asStringArray(record.limitations),
    };
}

function renderObservationLines(observations: DailyReviewObservation[]): string[] {
    if (observations.length === 0) {
        return ["- No structured observations returned."];
    }

    return observations.flatMap((observation) => {
        const firstLine = `- ${observation.title}: ${observation.detail}`;
        const evidenceLines = observation.evidence.map((evidence) => `  Evidence: ${evidence}`);
        return [firstLine, ...evidenceLines];
    });
}

function renderTradeEvidenceLines(items: DailyReviewTradeEvidenceItem[]): string[] {
    if (items.length === 0) {
        return ["- No trade-specific evidence was returned."];
    }

    return items.flatMap((item) => {
        const headline = `- ${item.symbol}: ${item.headline}`;
        const detailLines = item.details.map((detail) => `  ${detail}`);
        return [headline, ...detailLines];
    });
}

function getSymbolContext(sourceSnapshot: DailyReviewSourceSnapshot, symbol: string): DailyReviewMarketInstrumentContext | null {
    return sourceSnapshot.marketContext.symbols.find((entry) => entry.symbol === symbol) ?? null;
}

function getNewsForSymbol(sourceSnapshot: DailyReviewSourceSnapshot, symbol: string): DailyReviewMarketNewsItem[] {
    return (sourceSnapshot.marketContext.news ?? []).filter((item) => item.symbol === symbol);
}

function buildFallbackStrengths(sourceSnapshot: DailyReviewSourceSnapshot): DailyReviewObservation[] {
    const strengths: DailyReviewObservation[] = [];
    const winningTrade = [...sourceSnapshot.trades]
        .filter((trade) => trade.estimatedNetPl > 0)
        .sort((left, right) => right.estimatedNetPl - left.estimatedNetPl)[0] ?? null;

    if (winningTrade) {
        strengths.push({
            title: `${winningTrade.symbol} was the strongest realized contributor`,
            detail: `${winningTrade.symbol} added ${formatCurrencyValue(winningTrade.estimatedNetPl)} across ${winningTrade.executionCountForDay} executions${winningTrade.holdMinutes ? ` over ${winningTrade.holdMinutes} minutes` : ""}.`,
            evidence: [
                `Trade P&L: ${formatCurrencyValue(winningTrade.estimatedNetPl)}`,
                `Executions: ${winningTrade.executionCountForDay}`,
                ...(winningTrade.tags.length > 0 ? [`Tags: ${winningTrade.tags.join(", ")}`] : []),
            ],
        });
    }

    const totalExecutions = sourceSnapshot.totals.executionCount;
    const totalTrades = sourceSnapshot.totals.tradeCount || 1;
    if ((totalExecutions / totalTrades) <= 4) {
        strengths.push({
            title: "Execution count stayed relatively controlled",
            detail: `The day averaged ${(totalExecutions / totalTrades).toFixed(1)} executions per trade, which suggests less churn than a highly fragmented session.`,
            evidence: [
                `Trades: ${sourceSnapshot.totals.tradeCount}`,
                `Executions: ${sourceSnapshot.totals.executionCount}`,
            ],
        });
    }

    return strengths.slice(0, 3);
}

function buildFallbackWeaknesses(sourceSnapshot: DailyReviewSourceSnapshot): DailyReviewObservation[] {
    const weaknesses: DailyReviewObservation[] = [];
    const losingTrade = [...sourceSnapshot.trades]
        .filter((trade) => trade.estimatedNetPl < 0)
        .sort((left, right) => left.estimatedNetPl - right.estimatedNetPl)[0] ?? null;

    if (losingTrade) {
        weaknesses.push({
            title: `${losingTrade.symbol} was the biggest drag on the day`,
            detail: `${losingTrade.symbol} lost ${formatCurrencyValue(losingTrade.estimatedNetPl)} with ${losingTrade.executionCountForDay} executions${losingTrade.holdMinutes ? ` across ${losingTrade.holdMinutes} minutes` : ""}.`,
            evidence: [
                `Trade P&L: ${formatCurrencyValue(losingTrade.estimatedNetPl)}`,
                `Executions: ${losingTrade.executionCountForDay}`,
                ...(losingTrade.tags.length > 0 ? [`Tags: ${losingTrade.tags.join(", ")}`] : []),
            ],
        });
    }

    if (sourceSnapshot.timing.premarketExecutions > 0) {
        weaknesses.push({
            title: "Premarket activity increased timing risk",
            detail: `${sourceSnapshot.timing.premarketExecutions} executions happened before the regular session, which can make fills and thesis validation less reliable.`,
            evidence: [
                `Premarket executions: ${sourceSnapshot.timing.premarketExecutions}`,
                `First execution: ${sourceSnapshot.timing.firstExecutionTimeNy ?? "unknown"}`,
            ],
        });
    }

    return weaknesses.slice(0, 3);
}

function buildFallbackSummary(sourceSnapshot: DailyReviewSourceSnapshot): string {
    const totals = sourceSnapshot.totals;
    const bestSymbol = [...sourceSnapshot.symbolConcentration].sort((left, right) => right.estimatedNetPl - left.estimatedNetPl)[0] ?? null;
    const worstSymbol = [...sourceSnapshot.symbolConcentration].sort((left, right) => left.estimatedNetPl - right.estimatedNetPl)[0] ?? null;
    const spyContext = sourceSnapshot.marketContext.spy;
    const spyRegime = spyContext?.regime && spyContext.regime !== "unknown" ? spyContext.regime : "unclear market regime";
    const spyChange = formatSignedPercent(spyContext?.dayChangePct ?? null);
    const pnlDescriptor = totals.estimatedNetPl > 0 ? "profitable" : totals.estimatedNetPl < 0 ? "losing" : "flat";

    const sentences = [
        `${formatDateForDisplay(sourceSnapshot.date)} was a ${pnlDescriptor} session at ${formatCurrencyValue(totals.estimatedNetPl)} across ${totals.tradeCount} trades and ${totals.executionCount} executions.`,
        `Closed-trade results finished ${totals.winningTrades} winners, ${totals.losingTrades} losers, and ${totals.breakevenTrades} breakeven trades.`,
        spyContext
            ? `SPY traded in a ${spyRegime}${spyChange ? ` and closed ${spyChange}` : ""}${formatSignedPercent(spyContext.gapPct) ? ` after opening ${formatSignedPercent(spyContext.gapPct)} from the prior close` : ""}.`
            : "Broader market context was only partially available.",
        bestSymbol
            ? `${bestSymbol.symbol} contributed the most at ${formatCurrencyValue(bestSymbol.estimatedNetPl)}.`
            : null,
        worstSymbol && worstSymbol.symbol !== bestSymbol?.symbol
            ? `${worstSymbol.symbol} was the main drag at ${formatCurrencyValue(worstSymbol.estimatedNetPl)}.`
            : null,
    ].filter((sentence): sentence is string => Boolean(sentence));

    return sentences.join(" ");
}

function buildFallbackMarketContext(sourceSnapshot: DailyReviewSourceSnapshot): DailyReviewStructured["marketContext"] {
    const spyContext = sourceSnapshot.marketContext.spy;
    const macroMetrics = sourceSnapshot.marketContext.macro ?? [];
    const newsItems = sourceSnapshot.marketContext.news ?? [];

    const spyLines = [
        spyContext && spyContext.gapPct !== null ? `SPY gap: ${formatSignedPercent(spyContext.gapPct)}` : null,
        spyContext && spyContext.dayChangePct !== null ? `SPY day change: ${formatSignedPercent(spyContext.dayChangePct)}` : null,
        spyContext && spyContext.rangePct !== null ? `SPY intraday range: ${formatSignedPercent(spyContext.rangePct)}` : null,
        spyContext?.regime && spyContext.regime !== "unknown" ? `SPY regime: ${spyContext.regime}` : null,
        ...macroMetrics.map((metric) => `${metric.label}: ${metric.close ?? "n/a"}${formatSignedPercent(metric.dayChangePct) ? ` (${formatSignedPercent(metric.dayChangePct)})` : ""}`),
        ...newsItems
            .filter((item) => item.symbol === "SPY")
            .slice(0, 2)
            .map((item) => `SPY news: ${item.title}`),
    ].filter((line): line is string => Boolean(line));

    const symbolNarratives = sourceSnapshot.totals.symbols.map((symbol) => {
        const symbolContext = getSymbolContext(sourceSnapshot, symbol);
        const symbolNews = getNewsForSymbol(sourceSnapshot, symbol);
        const observations = [
            symbolContext && symbolContext.gapPct !== null ? `Gap: ${formatSignedPercent(symbolContext.gapPct)}` : null,
            symbolContext && symbolContext.dayChangePct !== null ? `Day change: ${formatSignedPercent(symbolContext.dayChangePct)}` : null,
            symbolContext && symbolContext.rangePct !== null ? `Range: ${formatSignedPercent(symbolContext.rangePct)}` : null,
            symbolContext?.regime && symbolContext.regime !== "unknown" ? `Regime: ${symbolContext.regime}` : null,
            ...symbolNews.slice(0, 2).map((item) => `News: ${item.title}`),
        ].filter((line): line is string => Boolean(line));

        return {
            symbol,
            observations: observations.length > 0 ? observations : ["Market context was limited for this symbol."],
        };
    });

    const overviewParts = [
        spyContext?.regime && spyContext.regime !== "unknown" ? `SPY showed a ${spyContext.regime} session.` : null,
        macroMetrics.length > 0 ? `Macro context included ${macroMetrics.map((metric) => metric.label).join(" and ")}.` : null,
        newsItems.length > 0 ? `${newsItems.length} news item${newsItems.length === 1 ? "" : "s"} were captured for the reviewed symbols.` : null,
    ].filter((part): part is string => Boolean(part));

    return {
        overview: overviewParts.join(" ") || DEFAULT_EMPTY_MARKET_CONTEXT,
        spy: spyLines,
        symbols: symbolNarratives,
    };
}

function buildFallbackTradeEvidence(sourceSnapshot: DailyReviewSourceSnapshot): DailyReviewTradeEvidenceItem[] {
    return [...sourceSnapshot.trades]
        .sort((left, right) => Math.abs(right.estimatedNetPl) - Math.abs(left.estimatedNetPl))
        .slice(0, 4)
        .map((trade) => {
            const symbolContext = getSymbolContext(sourceSnapshot, trade.symbol);
            const symbolNews = getNewsForSymbol(sourceSnapshot, trade.symbol);
            const details = [
                `${trade.direction} ${trade.status.toLowerCase()} trade with ${trade.executionCountForDay} executions and ${formatCurrencyValue(trade.estimatedNetPl)} estimated P&L.`,
                trade.holdMinutes > 0 ? `Held for ${trade.holdMinutes} minutes from ${trade.firstExecutionTimeNy} to ${trade.lastExecutionTimeNy}.` : `Execution window: ${trade.firstExecutionTimeNy}.`,
                trade.entryPrice !== null && trade.exitPrice !== null ? `Entry ${trade.entryPrice.toFixed(2)}, exit ${trade.exitPrice.toFixed(2)}.` : null,
                symbolContext?.gapPct !== null || symbolContext?.dayChangePct !== null
                    ? `${trade.symbol} context: ${[formatSignedPercent(symbolContext?.gapPct ?? null) ? `gap ${formatSignedPercent(symbolContext?.gapPct ?? null)}` : null, formatSignedPercent(symbolContext?.dayChangePct ?? null) ? `day change ${formatSignedPercent(symbolContext?.dayChangePct ?? null)}` : null, symbolContext?.regime && symbolContext.regime !== "unknown" ? `regime ${symbolContext.regime}` : null].filter(Boolean).join(", ")}.`
                    : null,
                symbolContext?.firstExecutionOffsetMinutes !== null && symbolContext?.firstExecutionOffsetMinutes !== undefined
                    ? `First execution was ${formatExecutionOffsetLabel(symbolContext.firstExecutionOffsetMinutes)}.`
                    : null,
                trade.tags.length > 0 ? `Tags: ${trade.tags.join(", ")}.` : null,
                trade.notesExcerpt ? `Notes: ${trade.notesExcerpt}` : null,
                ...symbolNews.slice(0, 1).map((item) => `Relevant news: ${item.title}`),
            ].filter((detail): detail is string => Boolean(detail));

            return {
                symbol: trade.symbol,
                headline: `${trade.symbol} accounted for ${formatCurrencyValue(trade.estimatedNetPl)} of realized day P&L`,
                details,
            };
        });
}

function buildFallbackActionItems(sourceSnapshot: DailyReviewSourceSnapshot): string[] {
    const actions: string[] = [];
    const totalTrades = sourceSnapshot.totals.tradeCount || 1;
    const executionsPerTrade = sourceSnapshot.totals.executionCount / totalTrades;
    const dominantSymbol = [...sourceSnapshot.symbolConcentration]
        .sort((left, right) => Math.abs(right.estimatedNetPl) - Math.abs(left.estimatedNetPl))[0] ?? null;
    const dominantShare = dominantSymbol && sourceSnapshot.totals.estimatedNetPl !== 0
        ? Math.abs(dominantSymbol.estimatedNetPl) / Math.max(Math.abs(sourceSnapshot.totals.estimatedNetPl), 0.01)
        : null;

    if (executionsPerTrade > 5) {
        actions.push(`Reduce intraday churn: the day averaged ${executionsPerTrade.toFixed(1)} executions per trade.`);
    }

    if (sourceSnapshot.timing.premarketExecutions > 0) {
        actions.push(`Review premarket entries separately: ${sourceSnapshot.timing.premarketExecutions} executions happened before 9:30 AM ET.`);
    }

    if (dominantSymbol && dominantShare !== null && dominantShare > 0.5) {
        actions.push(`Cap single-name risk more tightly; ${dominantSymbol.symbol} drove ${Math.round(dominantShare * 100)}% of absolute realized P&L.`);
    }

    if (sourceSnapshot.totals.totalFees > Math.max(Math.abs(sourceSnapshot.totals.estimatedNetPl) * 0.1, 0.25)) {
        actions.push(`Monitor fee efficiency; total fees reached ${formatCurrencyValue(sourceSnapshot.totals.totalFees)} on the session.`);
    }

    const notesMissing = sourceSnapshot.trades.every((trade) => !trade.notesExcerpt);
    if (notesMissing) {
        actions.push("Add a brief pre-trade note or thesis tag before entry so the review can compare plan versus execution.");
    }

    return actions.slice(0, 5);
}

function hydrateDailyReview(review: DailyReviewStructured, sourceSnapshot: DailyReviewSourceSnapshot | null): DailyReviewStructured {
    if (!sourceSnapshot) {
        return review;
    }

    const fallbackStrengths = review.strengths.length > 0 ? review.strengths : buildFallbackStrengths(sourceSnapshot);
    const fallbackWeaknesses = review.weaknesses.length > 0 ? review.weaknesses : buildFallbackWeaknesses(sourceSnapshot);
    const fallbackMarketContext = buildFallbackMarketContext(sourceSnapshot);
    const fallbackTradeEvidence = review.tradeEvidence.length > 0 ? review.tradeEvidence : buildFallbackTradeEvidence(sourceSnapshot);
    const fallbackActionItems = review.actionItems.length > 0 ? review.actionItems : buildFallbackActionItems(sourceSnapshot);

    return {
        summary: isMissingStructuredText(review.summary, DEFAULT_EMPTY_SUMMARY)
            ? buildFallbackSummary(sourceSnapshot)
            : review.summary,
        strengths: fallbackStrengths,
        weaknesses: fallbackWeaknesses,
        marketContext: {
            overview: isMissingStructuredText(review.marketContext.overview, DEFAULT_EMPTY_MARKET_CONTEXT)
                ? fallbackMarketContext.overview
                : review.marketContext.overview,
            spy: review.marketContext.spy.length > 0 ? review.marketContext.spy : fallbackMarketContext.spy,
            symbols: review.marketContext.symbols.length > 0 ? review.marketContext.symbols : fallbackMarketContext.symbols,
        },
        tradeEvidence: fallbackTradeEvidence,
        actionItems: fallbackActionItems,
        limitations: dedupeStrings([
            ...review.limitations,
            ...sourceSnapshot.limitations,
        ]),
    };
}

function renderDailyReviewReport(reviewDate: string, review: DailyReviewStructured, metadata: { provider: string; modelName: string }): string {
    const lines = [
        `# Daily Review - ${reviewDate}`,
        "",
        "## Executive Summary",
        review.summary,
        "",
        "## What Went Well",
        ...renderObservationLines(review.strengths),
        "",
        "## What Went Poorly",
        ...renderObservationLines(review.weaknesses),
        "",
        "## Market Context",
        review.marketContext.overview,
        ...review.marketContext.spy.map((line) => `- ${line}`),
        ...review.marketContext.symbols.flatMap((symbol) => [
            `- ${symbol.symbol}`,
            ...symbol.observations.map((observation) => `  ${observation}`),
        ]),
        "",
        "## Per-Trade Evidence",
        ...renderTradeEvidenceLines(review.tradeEvidence),
        "",
        "## Action Items",
        ...(review.actionItems.length > 0 ? review.actionItems.map((item) => `- ${item}`) : ["- No action items returned."]),
        "",
        "## Limitations",
        ...(review.limitations.length > 0 ? review.limitations.map((item) => `- ${item}`) : ["- No explicit limitations returned."]),
        "",
        "## Metadata",
        `- Provider: ${metadata.provider}`,
        `- Model: ${metadata.modelName}`,
        `- Review Date: ${reviewDate}`,
    ];

    return lines.join("\n");
}

function formatDailyReviewGenerationFailure(_provider: string, error: unknown): string {
    return error instanceof Error ? error.message : "AI generation failed. The last report was left unchanged.";
}

function limitNotes(notes: string | null): string | null {
    if (!notes) {
        return null;
    }

    const compact = notes.replace(/\s+/g, " ").trim();
    return compact.length > 280 ? `${compact.slice(0, 277)}...` : compact;
}

function isSellExecutionSide(side: string): boolean {
    const normalizedSide = side.trim().toUpperCase();
    return normalizedSide === "S" || normalizedSide === "SELL" || normalizedSide === "SS" || normalizedSide === "SELLSHORT";
}

function getSignedExecutionQuantity(execution: Pick<DayExecutionSlice, "side" | "quantity">): number {
    const absoluteQuantity = Math.abs(execution.quantity);
    return isSellExecutionSide(execution.side) ? -absoluteQuantity : absoluteQuantity;
}

function classifyRegime(gapPct: number | null, dayChangePct: number | null, rangePct: number | null, open: number | null, high: number | null, low: number | null, close: number | null): string {
    if (open === null || high === null || low === null || close === null || dayChangePct === null || rangePct === null) {
        return "unknown";
    }

    const closeLocation = high === low ? 0.5 : (close - low) / (high - low);

    if (Math.abs(dayChangePct) < 0.35 && rangePct < 1) {
        return "tight range";
    }

    if (dayChangePct >= 0.75 && closeLocation >= 0.65) {
        return "bull trend";
    }

    if (dayChangePct <= -0.75 && closeLocation <= 0.35) {
        return "bear trend";
    }

    if (gapPct !== null && Math.sign(gapPct) !== Math.sign(dayChangePct) && Math.abs(dayChangePct) >= 0.4) {
        return "gap fade / reversal";
    }

    if (closeLocation > 0.4 && closeLocation < 0.6) {
        return "two-sided range";
    }

    return "mixed session";
}

async function fetchYfinanceSupplementalContext(reviewDate: string, symbols: string[]): Promise<{ news: DailyReviewMarketNewsItem[]; macro: DailyReviewMacroMetric[]; limitations: string[] }> {
    if (!getSettings().market.supplemental) return { news: [], macro: [], limitations: ["Optional news and macro context is disabled."] };
    try {
        const data = await runMarketPython(["supplemental", reviewDate, ...symbols]);
        if (data.error) throw new Error(String(data.error));
        return { news: data.news as DailyReviewMarketNewsItem[] ?? [], macro: data.macro as DailyReviewMacroMetric[] ?? [], limitations: data.limitations as string[] ?? [] };
    } catch { return { news: [], macro: [], limitations: ["Optional yfinance news/macro data was unavailable for this date."] }; }
}

function findNearestBarPrice(bars: AggregateBar[], target: Date): number | null {
    if (bars.length === 0) {
        return null;
    }

    const targetTime = target.getTime();
    let nearestBar = bars[0];
    let smallestDistance = Math.abs(nearestBar.time - targetTime);

    for (const bar of bars) {
        const distance = Math.abs(bar.time - targetTime);
        if (distance < smallestDistance) {
            nearestBar = bar;
            smallestDistance = distance;
        }
    }

    return nearestBar.close;
}

async function buildInstrumentMarketContext(symbol: string, reviewDate: string, executions: DayExecutionSlice[]): Promise<{ context: DailyReviewMarketInstrumentContext | null; limitation?: string }> {
    try {
        const dailyResult = await getMarketDataResult({ symbol, from: addDaysToDateKey(reviewDate,-7), to: reviewDate, interval: "1d" });
        const dayBars = dailyResult.bars.map(bar => ({ ...bar, time: bar.time*1000, dateKey: bar.date }));
        const previousDayBar = [...dayBars].filter((bar) => bar.dateKey < reviewDate).at(-1) ?? null;
        const currentDayBar = dayBars.find((bar) => bar.dateKey === reviewDate) ?? null;

        const settings = getSettings().market;
        const intraday = await getMarketDataResult({ symbol, from: reviewDate, to: reviewDate, interval: settings.intradayInterval });
        const minuteBars = intraday.bars.map(bar => ({ ...bar, time: bar.time * 1000, dateKey: bar.date }));
        const exactPriceComparison = intraday.adjustment === "unadjusted" && settings.intradayInterval === "1m";
        const regularSessionBars = minuteBars.filter((bar) => {
            const minutesSinceMidnight = getMinutesSinceMidnightInTimeZone(new Date(bar.time), NEW_YORK_TIME_ZONE);
            return minutesSinceMidnight >= REGULAR_MARKET_OPEN_MINUTES && minutesSinceMidnight <= REGULAR_MARKET_CLOSE_MINUTES;
        });
        const barsForContext = regularSessionBars.length > 0 ? regularSessionBars : minuteBars;

        const sessionOpen = currentDayBar?.open ?? barsForContext[0]?.open ?? null;
        const sessionClose = currentDayBar?.close ?? barsForContext.at(-1)?.close ?? null;
        const sessionHigh = currentDayBar?.high ?? (barsForContext.length > 0 ? Math.max(...barsForContext.map((bar) => bar.high)) : null);
        const sessionLow = currentDayBar?.low ?? (barsForContext.length > 0 ? Math.min(...barsForContext.map((bar) => bar.low)) : null);

        const gapPct = previousDayBar && sessionOpen
            ? ((sessionOpen - previousDayBar.close) / previousDayBar.close) * 100
            : null;
        const dayChangePct = sessionOpen && sessionClose
            ? ((sessionClose - sessionOpen) / sessionOpen) * 100
            : null;
        const rangePct = sessionOpen && sessionHigh !== null && sessionLow !== null
            ? ((sessionHigh - sessionLow) / sessionOpen) * 100
            : null;

        const firstExecution = executions[0] ?? null;
        const lastExecution = executions.at(-1) ?? null;

        return {
            limitation: [`Daily source: ${dailyResult.source}; price basis: ${dailyResult.adjustment}. Intraday source: ${intraday.source}; interval: ${intraday.interval}; price basis: ${intraday.adjustment}.`, ...(intraday.coverage ? [`Intraday bars span ${intraday.coverage.from} through ${intraday.coverage.to}.`] : []), ...dailyResult.limitations, ...intraday.limitations, ...(currentDayBar ? [] : ["Day-level OHLC metrics use only the available intraday bars; a complete daily session was unavailable."]), ...(exactPriceComparison ? [] : ["Exact execution-price comparison is unavailable at this interval or price basis."])].join(" "),
            context: {
                symbol,
                previousClose: previousDayBar?.close ?? null,
                open: sessionOpen,
                close: sessionClose,
                high: sessionHigh,
                low: sessionLow,
                gapPct,
                dayChangePct,
                rangePct,
                regime: classifyRegime(gapPct, dayChangePct, rangePct, sessionOpen, sessionHigh, sessionLow, sessionClose),
                totalBars: barsForContext.length,
                dataSource: intraday.source, interval: settings.intradayInterval, adjustment: intraday.adjustment,
                firstExecutionPrice: firstExecution && exactPriceComparison ? findNearestBarPrice(barsForContext, firstExecution.time) : null,
                lastExecutionPrice: lastExecution && exactPriceComparison ? findNearestBarPrice(barsForContext, lastExecution.time) : null,
                firstExecutionOffsetMinutes: firstExecution ? getMinutesSinceMarketOpen(firstExecution.time, NEW_YORK_TIME_ZONE) : null,
                lastExecutionOffsetMinutes: lastExecution ? getMinutesSinceMarketOpen(lastExecution.time, NEW_YORK_TIME_ZONE) : null,
            },
        };
    } catch (error) {
        return {
            context: null,
            limitation: `${symbol} market context was unavailable: ${(error as Error).message}`,
        };
    }
}

function calculateEstimatedNetPl(executions: DayExecutionSlice[]): number {
    const manualPnls = executions.filter((execution) => execution.pnl !== null);

    if (manualPnls.length > 0) {
        return manualPnls.reduce((sum, execution) => sum + (execution.pnl ?? 0), 0);
    }

    return executions.reduce((sum, execution) => {
        const signedQuantity = getSignedExecutionQuantity(execution);
        return sum + (-1 * signedQuantity * execution.price) - execution.fee;
    }, 0);
}

function createTimingSummary(tradeSlices: TradeSliceSummary[]): DailyReviewSourceSnapshot["timing"] {
    let premarketExecutions = 0;
    let openingExecutions = 0;
    let middayExecutions = 0;
    let closingExecutions = 0;
    let aftermarketExecutions = 0;

    const allExecutions = tradeSlices
        .flatMap((tradeSlice) => tradeSlice.dayExecutions)
        .sort((left, right) => left.time.getTime() - right.time.getTime());

    for (const execution of allExecutions) {
        const minutesSinceMidnight = getMinutesSinceMidnightInTimeZone(execution.time, NEW_YORK_TIME_ZONE);

        if (minutesSinceMidnight < REGULAR_MARKET_OPEN_MINUTES) {
            premarketExecutions++;
        } else if (minutesSinceMidnight < ((10 * 60) + 30)) {
            openingExecutions++;
        } else if (minutesSinceMidnight < (14 * 60)) {
            middayExecutions++;
        } else if (minutesSinceMidnight <= REGULAR_MARKET_CLOSE_MINUTES) {
            closingExecutions++;
        } else {
            aftermarketExecutions++;
        }
    }

    return {
        premarketExecutions,
        openingExecutions,
        middayExecutions,
        closingExecutions,
        aftermarketExecutions,
        firstExecutionTimeNy: allExecutions[0] ? formatTimeInTimeZone(allExecutions[0].time, NEW_YORK_TIME_ZONE) : null,
        lastExecutionTimeNy: allExecutions.at(-1) ? formatTimeInTimeZone(allExecutions.at(-1)!.time, NEW_YORK_TIME_ZONE) : null,
    };
}

function createTradeSnapshots(tradeSlices: TradeSliceSummary[]): DailyReviewTradeSnapshot[] {
    return tradeSlices.map((tradeSlice) => ({
        tradeId: tradeSlice.tradeId,
        symbol: tradeSlice.symbol,
        direction: tradeSlice.direction,
        status: tradeSlice.status,
        executionCountForDay: tradeSlice.dayExecutions.length,
        totalExecutionCount: tradeSlice.totalExecutionCount,
        hasExecutionsOutsideDay: tradeSlice.hasExecutionsOutsideDay,
        firstExecutionTimeNy: formatTimeInTimeZone(tradeSlice.dayExecutions[0].time, NEW_YORK_TIME_ZONE),
        lastExecutionTimeNy: formatTimeInTimeZone(tradeSlice.dayExecutions.at(-1)!.time, NEW_YORK_TIME_ZONE),
        holdMinutes: tradeSlice.holdMinutes,
        estimatedNetPl: tradeSlice.estimatedNetPl,
        totalFees: tradeSlice.totalFees,
        totalVolume: tradeSlice.totalVolume,
        entryPrice: tradeSlice.entryPrice,
        exitPrice: tradeSlice.exitPrice,
        dayPriceChangePct: tradeSlice.dayPriceChangePct,
        tags: tradeSlice.tags,
        notesExcerpt: tradeSlice.notesExcerpt,
    }));
}

function buildDailyReviewUserPrompt(reviewDate: string, sourceSnapshot: DailyReviewSourceSnapshot): string {
    return [
        `Create a trading daily review for ${reviewDate} (${formatDateForDisplay(reviewDate)}).`,
        "",
        "Instructions:",
        "- Use only the supplied trade database evidence and market context.",
        "- Focus on execution quality, timing, market alignment, fee drag, concentration, overtrading, and rule adherence.",
        "- Use market news and macro context when it is present in the structured input.",
        "- Be specific and evidence-based.",
        "- If data is incomplete, say so in limitations rather than guessing.",
        "- Strengths and weaknesses should be concrete observations, not generic coaching language.",
        "- Action items should be short, practical, and directly tied to today's evidence.",
        "",
        "Structured input:",
        JSON.stringify(sourceSnapshot),
    ].join("\n");
}

function loadDailyReviewSystemPrompt(): string {
    const promptPath = path.join(process.cwd(), "Daily Review LLM.md");
    if (fs.existsSync(promptPath)) {
        return fs.readFileSync(promptPath, "utf8");
    }

    return "You are a trading performance reviewer. Produce a concise, evidence-based daily review that only uses the supplied data.";
}

export function serializeDailyReview(review: NonNullable<StoredDailyReviewRecord>): SerializedDailyReview {
    const parsedSourceSnapshot = safeParseJson<DailyReviewSourceSnapshot>(review.sourceSnapshot);
    const parsedReview = safeParseJson<unknown>(review.reviewJson);

    return {
        id: review.id,
        reviewDate: review.reviewDate,
        provider: review.provider,
        modelId: review.modelId,
        modelName: review.modelName,
        analysisVersion: review.analysisVersion,
        tradeCount: review.tradeCount,
        executionCount: review.executionCount,
        renderedReport: review.renderedReport,
        review: parsedReview ? hydrateDailyReview(normalizeDailyReview(parsedReview), parsedSourceSnapshot) : null,
        sourceSnapshot: parsedSourceSnapshot,
        createdAt: review.createdAt.toISOString(),
        updatedAt: review.updatedAt.toISOString(),
    };
}

function buildTradeSliceSummaries(reviewDate: string, trades: Array<{
    id: string;
    symbol: string;
    direction: string;
    status: string;
    notes: string | null;
    netPl: unknown;
    executions: Array<{
        time: Date;
        side: string;
        price: unknown;
        quantity: number;
        fee: unknown;
        pnl: unknown;
    }>;
    tags: Array<{ name: string }>;
}>): { tradeSlices: TradeSliceSummary[]; limitations: string[] } {
    const { start, end } = getNewYorkDayBounds(reviewDate);
    const limitations = new Set<string>();
    const tradeSlices: TradeSliceSummary[] = [];

    for (const trade of trades) {
        const dayExecutions = trade.executions
            .filter((execution) => execution.time >= start && execution.time < end)
            .map((execution) => ({
                time: execution.time,
                side: execution.side,
                price: Number(execution.price),
                quantity: execution.quantity,
                fee: Number(execution.fee),
                pnl: execution.pnl === null || execution.pnl === undefined ? null : Number(execution.pnl),
            }));

        if (dayExecutions.length === 0) {
            continue;
        }

        const sortedDayExecutions = [...dayExecutions].sort((left, right) => left.time.getTime() - right.time.getTime());
        const totalFees = sortedDayExecutions.reduce((sum, execution) => sum + execution.fee, 0);
        const totalVolume = sortedDayExecutions.reduce((sum, execution) => sum + Math.abs(execution.quantity), 0);
        const hasExecutionsOutsideDay = trade.executions.length !== sortedDayExecutions.length;
        const canUseCanonicalTradeNetPl = !hasExecutionsOutsideDay
            && trade.status === "CLOSED"
            && trade.netPl !== null
            && trade.netPl !== undefined;
        const estimatedNetPl = canUseCanonicalTradeNetPl
            ? Number(trade.netPl)
            : calculateEstimatedNetPl(sortedDayExecutions);
        const firstExecution = sortedDayExecutions[0];
        const lastExecution = sortedDayExecutions.at(-1) ?? firstExecution;
        const holdMinutes = Math.max(0, Math.round((lastExecution.time.getTime() - firstExecution.time.getTime()) / (1000 * 60)));
        const entryPrice = firstExecution.price ?? null;
        const exitPrice = lastExecution.price ?? null;
        const dayPriceChangePct = entryPrice && exitPrice
            ? ((exitPrice - entryPrice) / entryPrice) * 100
            : null;

        if (hasExecutionsOutsideDay) {
            limitations.add(`At least one reviewed trade has executions outside ${reviewDate}, so day-slice P&L is an estimate.`);
        } else if (!canUseCanonicalTradeNetPl) {
            limitations.add(`At least one reviewed trade could not reuse its saved trade P&L, so execution-based estimation was used for part of ${reviewDate}.`);
        }

        tradeSlices.push({
            tradeId: trade.id,
            symbol: trade.symbol,
            direction: trade.direction,
            status: trade.status,
            dayExecutions: sortedDayExecutions,
            totalExecutionCount: trade.executions.length,
            hasExecutionsOutsideDay,
            estimatedNetPl,
            totalFees,
            totalVolume,
            holdMinutes,
            entryPrice,
            exitPrice,
            dayPriceChangePct,
            tags: trade.tags.map((tag) => tag.name),
            notesExcerpt: limitNotes(trade.notes),
        });
    }

    return {
        tradeSlices,
        limitations: [...limitations],
    };
}

function createSourceSnapshot(
    reviewDate: string,
    tradeSlices: TradeSliceSummary[],
    marketContext: {
        spy: DailyReviewMarketInstrumentContext | null;
        symbols: DailyReviewMarketInstrumentContext[];
        news: DailyReviewMarketNewsItem[];
        macro: DailyReviewMacroMetric[];
    },
    limitations: string[]
): DailyReviewSourceSnapshot {
    const trades = createTradeSnapshots(tradeSlices);
    const wins = tradeSlices.filter((tradeSlice) => tradeSlice.estimatedNetPl > 0).length;
    const losses = tradeSlices.filter((tradeSlice) => tradeSlice.estimatedNetPl < 0).length;
    const breakeven = tradeSlices.length - wins - losses;
    const longTrades = tradeSlices.filter((tradeSlice) => tradeSlice.direction === "LONG").length;
    const shortTrades = tradeSlices.filter((tradeSlice) => tradeSlice.direction === "SHORT").length;
    const uniqueSymbols = [...new Set(tradeSlices.map((tradeSlice) => tradeSlice.symbol))];

    const concentrationMap = new Map<string, { tradeCount: number; executionCount: number; volume: number; estimatedNetPl: number }>();
    for (const tradeSlice of tradeSlices) {
        const current = concentrationMap.get(tradeSlice.symbol) ?? { tradeCount: 0, executionCount: 0, volume: 0, estimatedNetPl: 0 };
        current.tradeCount += 1;
        current.executionCount += tradeSlice.dayExecutions.length;
        current.volume += tradeSlice.totalVolume;
        current.estimatedNetPl += tradeSlice.estimatedNetPl;
        concentrationMap.set(tradeSlice.symbol, current);
    }

    const symbolConcentration = [...concentrationMap.entries()]
        .map(([symbol, value]) => ({
            symbol,
            tradeCount: value.tradeCount,
            executionCount: value.executionCount,
            volume: value.volume,
            estimatedNetPl: value.estimatedNetPl,
        }))
        .sort((left, right) => right.executionCount - left.executionCount);

    return {
        date: reviewDate,
        timeZone: NEW_YORK_TIME_ZONE,
        totals: {
            tradeCount: tradeSlices.length,
            executionCount: tradeSlices.reduce((sum, tradeSlice) => sum + tradeSlice.dayExecutions.length, 0),
            estimatedNetPl: tradeSlices.reduce((sum, tradeSlice) => sum + tradeSlice.estimatedNetPl, 0),
            totalFees: tradeSlices.reduce((sum, tradeSlice) => sum + tradeSlice.totalFees, 0),
            winningTrades: wins,
            losingTrades: losses,
            breakevenTrades: breakeven,
            longTrades,
            shortTrades,
            uniqueSymbols: uniqueSymbols.length,
            symbols: uniqueSymbols,
        },
        timing: createTimingSummary(tradeSlices),
        symbolConcentration,
        trades,
        marketContext,
        limitations,
    };
}

export async function getStoredDailyReview(reviewDate: string): Promise<SerializedDailyReview | null> {
    const review = await db.dailyReview.findUnique({
        where: { reviewDate },
    });

    if (!review || review.analysisVersion !== DAILY_REVIEW_ANALYSIS_VERSION) {
        return null;
    }

    return serializeDailyReview(review);
}

export async function listStoredDailyReviews(): Promise<DailyReviewHistoryItem[]> {
    const reviews = await db.dailyReview.findMany({
        where: {
            analysisVersion: DAILY_REVIEW_ANALYSIS_VERSION,
        },
        orderBy: { reviewDate: "desc" },
        select: {
            reviewDate: true,
            provider: true,
            modelId: true,
            modelName: true,
            tradeCount: true,
            executionCount: true,
            updatedAt: true,
        },
    });

    return reviews.map((review) => ({
        reviewDate: review.reviewDate,
        provider: review.provider,
        modelId: review.modelId,
        modelName: review.modelName,
        tradeCount: review.tradeCount,
        executionCount: review.executionCount,
        updatedAt: review.updatedAt.toISOString(),
    }));
}

export async function generateAndStoreDailyReview(reviewDate: string, connectionId: string, force: boolean, includeNotes = false): Promise<
    | { status: "success"; cached: boolean; review: SerializedDailyReview }
    | { status: "no_trades"; message: string }
    | { status: "generation_failed"; message: string; review: SerializedDailyReview | null }
> {
    const connection = resolveConnection(connectionId, "daily-review");
    const reviewProvider = connection.provider;
    const modelId = connection.modelId;
    const existingReview = await db.dailyReview.findUnique({
        where: { reviewDate },
    });

    const { start, end } = getNewYorkDayBounds(reviewDate);
    const trades = await db.trade.findMany({
        where: {
            executions: {
                some: {
                    time: {
                        gte: start,
                        lt: end,
                    },
                },
            },
        },
        include: {
            executions: {
                orderBy: { time: "asc" },
            },
            tags: true,
        },
        orderBy: {
            createdAt: "asc",
        },
    });

    const sanitizedTrades = trades.map(trade => ({ ...trade, notes: includeNotes ? trade.notes : null }));
    const cacheKey = createHash("sha256").update(JSON.stringify([sanitizedTrades, connection.id, connection.provider, connection.baseUrl, modelId, getSettings().market, includeNotes])).digest("hex");
    if (existingReview?.cacheKey === cacheKey && !force && existingReview.analysisVersion === DAILY_REVIEW_ANALYSIS_VERSION) return { status: "success", cached: true, review: serializeDailyReview(existingReview) };
    const { tradeSlices, limitations: sliceLimitations } = buildTradeSliceSummaries(reviewDate, sanitizedTrades);

    if (tradeSlices.length === 0) {
        return {
            status: "no_trades",
            message: `No executions were found for ${reviewDate}.`,
        };
    }

    const symbolExecutions = new Map<string, DayExecutionSlice[]>();
    for (const tradeSlice of tradeSlices) {
        const current = symbolExecutions.get(tradeSlice.symbol) ?? [];
        current.push(...tradeSlice.dayExecutions);
        symbolExecutions.set(tradeSlice.symbol, current.sort((left, right) => left.time.getTime() - right.time.getTime()));
    }

    const marketLimitations = new Set<string>(sliceLimitations);
    const reviewedSymbols = [...symbolExecutions.keys()].sort();
    const contextSymbols = dedupeStrings(["SPY", ...reviewedSymbols]);

    const [spyContextResult, symbolContextResults, yfinanceSupplemental] = await Promise.all([
        buildInstrumentMarketContext("SPY", reviewDate, []),
        Promise.all(
            [...symbolExecutions.entries()].map(async ([symbol, executions]) => ({
                symbol,
                result: await buildInstrumentMarketContext(symbol, reviewDate, executions),
            }))
        ),
        fetchYfinanceSupplementalContext(reviewDate, contextSymbols),
    ]);

    if (spyContextResult.limitation) {
        marketLimitations.add(spyContextResult.limitation);
    }

    const symbolContexts = symbolContextResults
        .map(({ symbol, result }) => {
            if (result.limitation) {
                marketLimitations.add(result.limitation);
            }

            if (!result.context) {
                return null;
            }

            return symbol === "SPY" && spyContextResult.context
                ? spyContextResult.context
                : result.context;
        })
        .filter((context): context is DailyReviewMarketInstrumentContext => context !== null);

    for (const limitation of yfinanceSupplemental.limitations) marketLimitations.add(limitation);
    const combinedNews = dedupeNewsItems(yfinanceSupplemental.news);
    const sourceSnapshot = createSourceSnapshot(
        reviewDate,
        tradeSlices,
        {
            spy: spyContextResult.context,
            symbols: symbolContexts,
            news: combinedNews,
            macro: yfinanceSupplemental.macro,
        },
        [...marketLimitations]
    );

    let review: DailyReviewStructured;
    try {
        const systemPrompt = loadDailyReviewSystemPrompt();
        const rawReview = JSON.parse(await generateAi(connection, { system: systemPrompt, user: buildDailyReviewUserPrompt(reviewDate, sourceSnapshot), schema: DAILY_REVIEW_RESPONSE_SCHEMA, schemaName: "daily_review" }));
        review = hydrateDailyReview(normalizeDailyReview(rawReview), sourceSnapshot);
    } catch (error) {


        return {
            status: "generation_failed",
            message: formatDailyReviewGenerationFailure(reviewProvider, error),
            review: existingReview && existingReview.analysisVersion === DAILY_REVIEW_ANALYSIS_VERSION
                ? serializeDailyReview(existingReview)
                : null,
        };
    }

    const modelName = `${connection.name} · ${modelId}`;
    const renderedReport = renderDailyReviewReport(reviewDate, review, {
        provider: getDailyReviewProviderLabel(reviewProvider),
        modelName,
    });

    const savedReview = await db.dailyReview.upsert({
        where: { reviewDate },
        create: {
            reviewDate,
            cacheKey,
            provider: reviewProvider,
            modelId,
            modelName,
            analysisVersion: DAILY_REVIEW_ANALYSIS_VERSION,
            tradeCount: sourceSnapshot.totals.tradeCount,
            executionCount: sourceSnapshot.totals.executionCount,
            renderedReport,
            reviewJson: JSON.stringify(review),
            sourceSnapshot: JSON.stringify(sourceSnapshot),
        },
        update: {
            cacheKey,
            provider: reviewProvider,
            modelId,
            modelName,
            analysisVersion: DAILY_REVIEW_ANALYSIS_VERSION,
            tradeCount: sourceSnapshot.totals.tradeCount,
            executionCount: sourceSnapshot.totals.executionCount,
            renderedReport,
            reviewJson: JSON.stringify(review),
            sourceSnapshot: JSON.stringify(sourceSnapshot),
        },
    });

    return {
        status: "success",
        cached: false,
        review: serializeDailyReview(savedReview),
    };
}
