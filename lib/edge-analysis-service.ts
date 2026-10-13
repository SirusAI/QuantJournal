import "server-only";

import { Prisma } from "@prisma/client";

import { analyzeEdgeTrades, deriveScopeKey } from "@/lib/edge-analysis";
import {
    EdgeAnalysisResponse,
    EdgeAnalysisScope,
    EdgeSourceTrade,
} from "@/lib/edge-analysis-types";
import { db } from "@/lib/db";
import { getNewYorkDayBounds, isValidDateKey } from "@/lib/trading-day";

export class EdgeAnalysisInputError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "EdgeAnalysisInputError";
    }
}

export interface EdgeAnalysisScopeInput {
    from?: string | null;
    to?: string | null;
    symbol?: string | null;
    tag?: string | null;
    label?: string | null;
}

interface CachedEdgeAnalysis {
    sourceVersion: string;
    response: EdgeAnalysisResponse;
}

const MAX_CACHE_ENTRIES = 32;
const globalForEdgeAnalysis = globalThis as typeof globalThis & {
    edgeAnalysisCache?: Map<string, CachedEdgeAnalysis>;
};
const edgeAnalysisCache = globalForEdgeAnalysis.edgeAnalysisCache ?? new Map<string, CachedEdgeAnalysis>();
if (process.env.NODE_ENV !== "production") globalForEdgeAnalysis.edgeAnalysisCache = edgeAnalysisCache;

function cleanOptionalText(value: string | null | undefined, maxLength: number): string | null {
    const cleaned = value?.trim() ?? "";
    if (!cleaned) return null;
    if (cleaned.length > maxLength) {
        throw new EdgeAnalysisInputError(`Filter values must be ${maxLength} characters or fewer.`);
    }
    return cleaned;
}

function isValidCalendarDateKey(value: string): boolean {
    if (!isValidDateKey(value)) return false;
    const [year, month, day] = value.split("-").map(Number);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    return parsed.getUTCFullYear() === year
        && parsed.getUTCMonth() === month - 1
        && parsed.getUTCDate() === day;
}

export function normalizeEdgeAnalysisScope(input: EdgeAnalysisScopeInput): EdgeAnalysisScope {
    const from = cleanOptionalText(input.from, 10);
    let to = cleanOptionalText(input.to, 10);

    if (from && !isValidCalendarDateKey(from)) {
        throw new EdgeAnalysisInputError("Invalid from date. Use YYYY-MM-DD.");
    }
    if (to && !isValidCalendarDateKey(to)) {
        throw new EdgeAnalysisInputError("Invalid to date. Use YYYY-MM-DD.");
    }
    if (to && !from) {
        throw new EdgeAnalysisInputError("A from date is required when a to date is supplied.");
    }

    // A one-day custom selection is represented by a lone `from` date.
    if (from && !to) to = from;
    if (from && to && from > to) {
        throw new EdgeAnalysisInputError("The from date must be on or before the to date.");
    }

    const symbol = cleanOptionalText(input.symbol, 32);
    const tag = cleanOptionalText(input.tag, 120);
    const requestedLabel = cleanOptionalText(input.label, 120);
    const dateLabel = from && to
        ? (from === to ? from : `${from} to ${to}`)
        : "All Time";
    const filters = [symbol ? `Symbol: ${symbol}` : null, tag ? `Tag: ${tag}` : null]
        .filter(Boolean)
        .join(" · ");

    return {
        from,
        to,
        symbol,
        tag,
        label: requestedLabel ?? `${dateLabel}${filters ? ` · ${filters}` : ""}`,
    };
}

function buildTradeWhere(scope: EdgeAnalysisScope): Prisma.TradeWhereInput {
    const where: Prisma.TradeWhereInput = {
        status: "CLOSED",
        netPl: { not: null },
    };

    if (scope.from && scope.to) {
        const start = getNewYorkDayBounds(scope.from).start;
        const end = getNewYorkDayBounds(scope.to).end;
        where.date = { gte: start, lt: end };
    }

    if (scope.symbol) {
        // SQLite LIKE (used by Prisma `contains`) is case-insensitive for ASCII symbols.
        where.symbol = { contains: scope.symbol };
    }
    if (scope.tag) {
        where.tags = { some: { name: scope.tag } };
    }

    return where;
}

function makeSourceVersion(count: number, latestUpdatedAt: Date | null): string {
    return `${count}:${latestUpdatedAt?.toISOString() ?? "none"}`;
}

async function getCurrentSourceVersion(where: Prisma.TradeWhereInput): Promise<string> {
    const aggregate = await db.trade.aggregate({
        where,
        _count: { _all: true },
        _max: { updatedAt: true },
    });
    return makeSourceVersion(aggregate._count._all, aggregate._max.updatedAt);
}

function rememberAnalysis(scopeKey: string, entry: CachedEdgeAnalysis) {
    edgeAnalysisCache.delete(scopeKey);
    edgeAnalysisCache.set(scopeKey, entry);
    while (edgeAnalysisCache.size > MAX_CACHE_ENTRIES) {
        const oldestKey = edgeAnalysisCache.keys().next().value as string | undefined;
        if (!oldestKey) break;
        edgeAnalysisCache.delete(oldestKey);
    }
}

export async function getEdgeAnalysis(input: EdgeAnalysisScopeInput): Promise<EdgeAnalysisResponse> {
    const scope = normalizeEdgeAnalysisScope(input);
    const scopeKey = deriveScopeKey(scope);
    const where = buildTradeWhere(scope);
    const cached = edgeAnalysisCache.get(scopeKey);
    if (cached) {
        const sourceVersion = await getCurrentSourceVersion(where);
        if (sourceVersion === cached.sourceVersion) {
            // The display label is not part of scopeKey, so preserve the caller's current label.
            return { ...cached.response, scope, scopeKey };
        }
        edgeAnalysisCache.delete(scopeKey);
    }

    const trades = await db.trade.findMany({
        where,
        select: {
            id: true,
            symbol: true,
            date: true,
            direction: true,
            netPl: true,
            updatedAt: true,
            tags: {
                select: { name: true },
            },
            executions: {
                select: {
                    time: true,
                    price: true,
                    quantity: true,
                },
            },
        },
    });

    const sourceTrades: EdgeSourceTrade[] = trades.map((trade) => ({
        id: trade.id,
        symbol: trade.symbol,
        date: trade.date,
        direction: trade.direction,
        netPl: trade.netPl,
        tags: trade.tags,
        executions: trade.executions,
    }));

    const response = analyzeEdgeTrades(sourceTrades, scope);
    const latestUpdatedAt = trades.reduce<Date | null>((latest, trade) => (
        !latest || trade.updatedAt > latest ? trade.updatedAt : latest
    ), null);
    rememberAnalysis(scopeKey, {
        sourceVersion: makeSourceVersion(trades.length, latestUpdatedAt),
        response,
    });
    return response;
}
