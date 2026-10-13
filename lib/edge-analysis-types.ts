/**
 * Shared, JSON-safe types for the deterministic Edge Analysis feature.
 * Percentages in these DTOs use the 0..100 scale.
 */

export const EDGE_ANALYSIS_VERSION = "v1" as const;

export type EdgeNumeric =
    | number
    | string
    | { toString(): string }
    | null
    | undefined;

export interface EdgeSourceTag {
    id?: string;
    name: string;
}

export interface EdgeSourceExecution {
    id?: string;
    time: Date | string;
    price: EdgeNumeric;
    quantity: EdgeNumeric;
    side?: string | null;
}

/** The minimum database projection needed by the analysis core. */
export interface EdgeSourceTrade {
    id: string;
    symbol: string;
    date: Date | string;
    direction: string | null;
    netPl: EdgeNumeric;
    tags?: readonly (EdgeSourceTag | string)[] | null;
    executions?: readonly EdgeSourceExecution[] | null;
}

/** A normalized, inclusive calendar-date scope in America/New_York. */
export interface EdgeAnalysisScope {
    from: string | null;
    to: string | null;
    symbol: string | null;
    tag: string | null;
    label: string;
}

export type EdgeDimensionKey =
    | "direction"
    | "tag"
    | "firstExecutionTime"
    | "firstExecutionPrice"
    | "weekday"
    | "executionCount"
    | "executionWindow"
    | "repeatSymbol"
    | "dailyTradeCount"
    | "notionalQuartile";

export type EdgePairKey =
    | "directionTag"
    | "directionTime"
    | "directionPrice"
    | "tagTime";

export type EdgeConfidence = "insufficient" | "initial" | "medium" | "high";
export type EdgeObservedDirection = "positive" | "negative" | "neutral";

export interface EdgeMetrics {
    sampleSize: number;
    tradeDayCount: number;
    netPl: number;
    expectancy: number;
    winners: number;
    losers: number;
    scratches: number;
    /** Excludes scratch trades. Null when there are no wins or losses. */
    winRate: number | null;
    avgWin: number | null;
    /** Kept negative so the value has the same sign as the source P&L. */
    avgLoss: number | null;
    /** Average win divided by the absolute average loss. */
    payoff: number | null;
    /** Gross profits divided by absolute gross losses. Null for an infinite/undefined result. */
    profitFactor: number | null;
    medianPl: number | null;
    /** Group expectancy minus the selected-scope baseline expectancy. */
    expectancyDelta: number;
}

export interface EdgeGroup {
    id: string;
    kind: "dimension" | "pair";
    dimension: EdgeDimensionKey | EdgePairKey;
    dimensionLabel: string;
    key: string;
    label: string;
    metrics: EdgeMetrics;
    confidence: EdgeConfidence;
    /** Meets sample/day/win/loss minimums; conclusion rules are represented separately. */
    eligible: boolean;
    observedEdge: EdgeObservedDirection;
    outlierSensitive: boolean;
    outlierAdjustedExpectancy: number | null;
    parentGroupIds: string[];
    qualificationReasons: string[];
}

export interface EdgeGroupCollection {
    key: EdgeDimensionKey | EdgePairKey;
    label: string;
    description: string;
    /** False for user-tag collections because one trade can carry multiple tags. */
    mutuallyExclusive: boolean;
    groups: EdgeGroup[];
}

export interface EdgeDataQuality {
    /** Trades inside the requested scope before invalid-P&L exclusion. */
    sourceTradeCount: number;
    analyzedTradeCount: number;
    tradeDayCount: number;
    taggedTradeCount: number;
    tagCoverage: number;
    tradesWithExecutions: number;
    executionCoverage: number;
    tradesWithFirstExecutionPrice: number;
    firstExecutionPriceCoverage: number;
    tradesWithNotional: number;
    notionalCoverage: number;
    excludedInvalidPnl: number;
    excludedInvalidDate: number;
    limitations: string[];
}

export interface EdgeAction {
    id: string;
    kind: "reinforce" | "reduce";
    title: string;
    detail: string;
    evidence: string[];
    groupId: string;
}

export interface EdgeAnalysisResponse {
    analysisVersion: typeof EDGE_ANALYSIS_VERSION;
    scope: EdgeAnalysisScope;
    baseline: EdgeMetrics;
    dataQuality: EdgeDataQuality;
    dimensionGroups: EdgeGroupCollection[];
    pairGroups: EdgeGroupCollection[];
    topEdges: EdgeGroup[];
    topLeaks: EdgeGroup[];
    actions: EdgeAction[];
    scopeKey: string;
    sourceFingerprint: string;
}

export interface EdgeAiInsight {
    title: string;
    detail: string;
    evidence: string[];
}

export interface EdgeAiSummary {
    strengths: EdgeAiInsight[];
    leaks: EdgeAiInsight[];
    actions: string[];
    limitations: string[];
}

export interface EdgeAnalysisEvidenceSnapshot {
    baseline: EdgeMetrics;
    dataQuality: EdgeDataQuality;
    topEdges: EdgeGroup[];
    topLeaks: EdgeGroup[];
    deterministicActions: EdgeAction[];
}

export interface EdgeAnalysisSessionDto {
    id: string;
    scope: EdgeAnalysisScope;
    scopeKey: string;
    sourceFingerprint: string;
    analysisVersion: string;
    modelId: string;
    modelName: string | null;
    summary: EdgeAiSummary;
    evidence: EdgeAnalysisEvidenceSnapshot;
    createdAt: string;
}
