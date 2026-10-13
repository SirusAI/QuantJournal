import type {
    EdgeAction,
    EdgeAnalysisResponse,
    EdgeAnalysisScope,
    EdgeConfidence,
    EdgeDataQuality,
    EdgeDimensionKey,
    EdgeGroup,
    EdgeGroupCollection,
    EdgeMetrics,
    EdgeNumeric,
    EdgeObservedDirection,
    EdgePairKey,
    EdgeSourceExecution,
    EdgeSourceTrade,
} from "./edge-analysis-types";

const NEW_YORK_TIME_ZONE = "America/New_York";
const EDGE_ANALYSIS_VERSION = "v1" as const;
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const PAIR_KEY_SEPARATOR = "\u001f";
const MIN_RECURRING_SYMBOL_SAMPLE = 5;
const MAX_RECURRING_SYMBOL_GROUPS = 40;

interface FeatureValue {
    key: string;
    label: string;
}

interface NormalizedExecution {
    id: string;
    time: Date | null;
    timeValue: number | null;
    price: number | null;
    quantity: number | null;
}

interface NormalizedTrade {
    id: string;
    symbol: string;
    dayKey: string;
    dateValue: number;
    pnl: number;
    direction: FeatureValue;
    tags: FeatureValue[];
    executions: NormalizedExecution[];
    firstExecutionTime: FeatureValue;
    firstExecutionPrice: FeatureValue;
    weekday: FeatureValue;
    executionCount: FeatureValue;
    executionWindow: FeatureValue;
    repeatSymbol: FeatureValue;
    dailyTradeCount: FeatureValue;
    notionalQuartile: FeatureValue;
    executionNotional: number | null;
}

interface GroupSeed {
    key: string;
    label: string;
    trades: NormalizedTrade[];
    parentGroupIds: string[];
}

interface CollectionDefinition {
    key: EdgeDimensionKey;
    label: string;
    description: string;
    mutuallyExclusive: boolean;
}

interface PairDefinition {
    key: EdgePairKey;
    label: string;
    description: string;
    left: EdgeDimensionKey;
    right: EdgeDimensionKey;
    mutuallyExclusive: boolean;
}

const DIMENSION_DEFINITIONS: readonly CollectionDefinition[] = [
    {
        key: "direction",
        label: "Direction",
        description: "Trade direction recorded on the Symbol × Day trade.",
        mutuallyExclusive: true,
    },
    {
        key: "tag",
        label: "User Tag",
        description: "User-assigned tags. A multi-tag trade appears once in every matching tag group.",
        mutuallyExclusive: false,
    },
    {
        key: "firstExecutionTime",
        label: "First execution time (ET)",
        description: "New York session bucket containing the first recorded execution.",
        mutuallyExclusive: true,
    },
    {
        key: "firstExecutionPrice",
        label: "First execution price",
        description: "Price band of the first recorded execution; no external market data is used.",
        mutuallyExclusive: true,
    },
    {
        key: "weekday",
        label: "Weekday",
        description: "New York calendar weekday of the trade.",
        mutuallyExclusive: true,
    },
    {
        key: "executionCount",
        label: "Execution count",
        description: "Number of recorded fills in the Symbol × Day trade.",
        mutuallyExclusive: true,
    },
    {
        key: "executionWindow",
        label: "Execution window",
        description: "Elapsed time between first and last fills; this is not a strict holding period.",
        mutuallyExclusive: true,
    },
    {
        key: "repeatSymbol",
        label: "Recurring Symbol",
        description: "Up to 40 most frequent symbols with at least 5 selected trades; sparse symbols are suppressed.",
        mutuallyExclusive: true,
    },
    {
        key: "dailyTradeCount",
        label: "Selected trades per day",
        description: "Number of selected Symbol × Day trades on the same New York date.",
        mutuallyExclusive: true,
    },
    {
        key: "notionalQuartile",
        label: "Execution notional quartile",
        description: "Quartiles of summed absolute price × quantity. This is activity, not risk-adjusted return.",
        mutuallyExclusive: true,
    },
] as const;

const PAIR_DEFINITIONS: readonly PairDefinition[] = [
    {
        key: "directionTag",
        label: "Direction × Tag",
        description: "Exploratory Direction × User Tag association.",
        left: "direction",
        right: "tag",
        mutuallyExclusive: false,
    },
    {
        key: "directionTime",
        label: "Direction × First execution time",
        description: "Exploratory Direction × first execution time association.",
        left: "direction",
        right: "firstExecutionTime",
        mutuallyExclusive: true,
    },
    {
        key: "directionPrice",
        label: "Direction × First execution price",
        description: "Exploratory Direction × first execution price association.",
        left: "direction",
        right: "firstExecutionPrice",
        mutuallyExclusive: true,
    },
    {
        key: "tagTime",
        label: "Tag × First execution time",
        description: "Exploratory User Tag × first execution time association.",
        left: "tag",
        right: "firstExecutionTime",
        mutuallyExclusive: false,
    },
] as const;

const DIMENSION_LABELS = new Map<EdgeDimensionKey, string>(
    DIMENSION_DEFINITIONS.map((definition) => [definition.key, definition.label]),
);

const PAIR_LABELS = new Map<EdgePairKey, string>(
    PAIR_DEFINITIONS.map((definition) => [definition.key, definition.label]),
);

const datePartsFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: NEW_YORK_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
});

const timePartsFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: NEW_YORK_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
});

function normalizeNegativeZero(value: number): number {
    return Object.is(value, -0) ? 0 : value;
}

function finiteNumberOrZero(value: number): number {
    return Number.isFinite(value) ? normalizeNegativeZero(value) : 0;
}

function finiteNumberOrNull(value: number): number | null {
    return Number.isFinite(value) ? normalizeNegativeZero(value) : null;
}

function toFiniteNumber(value: EdgeNumeric): number | null {
    if (value === null || value === undefined || value === "") return null;

    let parsed: number;
    try {
        parsed = typeof value === "number" ? value : Number(value.toString());
    } catch {
        return null;
    }

    return Number.isFinite(parsed) ? normalizeNegativeZero(parsed) : null;
}

function toValidDate(value: Date | string): Date | null {
    const parsed = value instanceof Date ? new Date(value.getTime()) : new Date(value);
    return Number.isFinite(parsed.getTime()) ? parsed : null;
}

function getPart(
    parts: Intl.DateTimeFormatPart[],
    type: Intl.DateTimeFormatPartTypes,
): string {
    return parts.find((part) => part.type === type)?.value ?? "";
}

function getNewYorkDateKey(date: Date): string {
    const parts = datePartsFormatter.formatToParts(date);
    return `${getPart(parts, "year")}-${getPart(parts, "month")}-${getPart(parts, "day")}`;
}

function getNewYorkMinutes(date: Date): number {
    const parts = timePartsFormatter.formatToParts(date);
    return (Number(getPart(parts, "hour")) * 60) + Number(getPart(parts, "minute"));
}

function isValidDateKey(value: string | null | undefined): value is string {
    if (!value || !DATE_KEY_PATTERN.test(value)) return false;
    const [year, month, day] = value.split("-").map(Number);
    const check = new Date(Date.UTC(year, month - 1, day));
    return check.getUTCFullYear() === year
        && check.getUTCMonth() === month - 1
        && check.getUTCDate() === day;
}

function normalizeScope(scope: EdgeAnalysisScope): EdgeAnalysisScope {
    const from = isValidDateKey(scope.from) ? scope.from : null;
    const to = isValidDateKey(scope.to) ? scope.to : null;
    const symbol = scope.symbol?.trim().toUpperCase() || null;
    const tag = scope.tag?.trim() || null;
    let label = scope.label?.trim();

    if (!label) {
        if (!from && !to) label = "All Time";
        else if (from && to) label = `${from} – ${to}`;
        else if (from) label = `From ${from}`;
        else label = `Through ${to}`;
    }

    return { from, to, symbol, tag, label };
}

/** Stable cache key for a normalized filter scope. The display label is intentionally ignored. */
export function deriveScopeKey(scope: EdgeAnalysisScope): string {
    const normalized = normalizeScope(scope);
    const values = [
        normalized.from ?? "*",
        normalized.to ?? "*",
        normalized.symbol?.toLocaleLowerCase("en-US") ?? "*",
        normalized.tag?.toLocaleLowerCase("en-US") ?? "*",
    ];
    return `edge:${EDGE_ANALYSIS_VERSION}:${values.map(encodeURIComponent).join("|")}`;
}

function normalizeDirection(direction: string | null): FeatureValue {
    const normalized = direction?.trim().toLocaleUpperCase("en-US") ?? "";
    if (normalized === "LONG") return { key: "long", label: "Long" };
    if (normalized === "SHORT") return { key: "short", label: "Short" };
    if (!normalized) return { key: "unknown", label: "Unknown" };
    return { key: normalized.toLocaleLowerCase("en-US"), label: normalized };
}

function normalizeTags(tags: EdgeSourceTrade["tags"]): FeatureValue[] {
    const byKey = new Map<string, FeatureValue>();

    for (const tag of tags ?? []) {
        const name = (typeof tag === "string" ? tag : tag.name).trim();
        if (!name) continue;
        const key = name.toLocaleLowerCase("en-US");
        if (!byKey.has(key)) byKey.set(key, { key, label: name });
    }

    if (byKey.size === 0) return [{ key: "__untagged__", label: "Untagged" }];
    return [...byKey.values()].sort((left, right) => left.label.localeCompare(right.label));
}

function normalizeExecutions(executions: EdgeSourceTrade["executions"]): NormalizedExecution[] {
    return (executions ?? []).map((execution, index) => {
        const time = toValidDate(execution.time);
        return {
            id: execution.id ?? String(index),
            time,
            timeValue: time?.getTime() ?? null,
            price: toFiniteNumber(execution.price),
            quantity: toFiniteNumber(execution.quantity),
        };
    });
}

function firstTimedExecution(executions: readonly NormalizedExecution[]): NormalizedExecution | null {
    let first: NormalizedExecution | null = null;
    for (const execution of executions) {
        if (execution.timeValue === null) continue;
        if (first?.timeValue === null || first === null || execution.timeValue < first.timeValue!) {
            first = execution;
        }
    }
    return first;
}

function executionTimeBucket(execution: NormalizedExecution | null): FeatureValue {
    if (!execution?.time) return { key: "unavailable", label: "Unavailable" };
    const minutes = getNewYorkMinutes(execution.time);
    if (minutes < 570) return { key: "premarket", label: "Premarket" };
    if (minutes < 630) return { key: "0930-1030", label: "9:30–10:30 ET" };
    if (minutes < 840) return { key: "1030-1400", label: "10:30–14:00 ET" };
    if (minutes < 960) return { key: "1400-1600", label: "14:00–16:00 ET" };
    return { key: "afterhours", label: "After hours" };
}

function executionPriceBucket(execution: NormalizedExecution | null): FeatureValue {
    const price = execution?.price;
    if (price === null || price === undefined || price <= 0) {
        return { key: "unavailable", label: "Unavailable" };
    }
    if (price < 2) return { key: "lt2", label: "<$2" };
    if (price < 5) return { key: "2-5", label: "$2–5" };
    if (price < 10) return { key: "5-10", label: "$5–10" };
    if (price < 20) return { key: "10-20", label: "$10–20" };
    if (price < 50) return { key: "20-50", label: "$20–50" };
    if (price < 100) return { key: "50-100", label: "$50–100" };
    return { key: "gte100", label: "$100+" };
}

function executionCountBucket(count: number): FeatureValue {
    if (count <= 0) return { key: "unavailable", label: "No fills" };
    if (count === 1) return { key: "1", label: "1 fill" };
    if (count === 2) return { key: "2", label: "2 fills" };
    if (count <= 5) return { key: "3-5", label: "3–5 fills" };
    if (count <= 9) return { key: "6-9", label: "6–9 fills" };
    if (count <= 19) return { key: "10-19", label: "10–19 fills" };
    return { key: "20+", label: "20+ fills" };
}

function executionWindowBucket(executions: readonly NormalizedExecution[]): FeatureValue {
    const timed = executions
        .filter((execution): execution is NormalizedExecution & { timeValue: number } => execution.timeValue !== null)
        .sort((left, right) => left.timeValue - right.timeValue);

    if (executions.length === 1 && timed.length === 1) {
        return { key: "single", label: "Single fill" };
    }
    if (timed.length < 2) return { key: "unavailable", label: "Unavailable" };

    const durationMinutes = Math.max(0, (timed.at(-1)!.timeValue - timed[0].timeValue) / 60_000);
    if (durationMinutes < 15) return { key: "lt15", label: "<15m" };
    if (durationMinutes < 30) return { key: "15-30", label: "15–30m" };
    if (durationMinutes < 60) return { key: "30-60", label: "30–60m" };
    if (durationMinutes < 120) return { key: "60-120", label: "1–2h" };
    return { key: "gte120", label: "≥2h" };
}

function weekdayBucket(dayKey: string): FeatureValue {
    const weekday = new Date(`${dayKey}T12:00:00Z`).getUTCDay();
    return [
        { key: "sunday", label: "Sunday" },
        { key: "monday", label: "Monday" },
        { key: "tuesday", label: "Tuesday" },
        { key: "wednesday", label: "Wednesday" },
        { key: "thursday", label: "Thursday" },
        { key: "friday", label: "Friday" },
        { key: "saturday", label: "Saturday" },
    ][weekday];
}

function dailyTradeCountBucket(count: number): FeatureValue {
    if (count <= 1) return { key: "1", label: "1 selected trade/day" };
    if (count === 2) return { key: "2", label: "2 selected trades/day" };
    if (count <= 5) return { key: "3-5", label: "3–5 selected trades/day" };
    if (count <= 9) return { key: "6-9", label: "6–9 selected trades/day" };
    return { key: "10+", label: "10+ selected trades/day" };
}

function executionNotional(executions: readonly NormalizedExecution[]): number | null {
    let total = 0;
    let usable = 0;

    for (const execution of executions) {
        if (execution.price === null || execution.price <= 0 || execution.quantity === null) continue;
        const value = Math.abs(execution.price * execution.quantity);
        if (!Number.isFinite(value) || value <= 0) continue;
        total += value;
        usable++;
    }

    return usable > 0 && Number.isFinite(total) && total > 0 ? total : null;
}

function quantile(sortedValues: readonly number[], percentile: number): number {
    if (sortedValues.length === 0) return 0;
    const position = (sortedValues.length - 1) * percentile;
    const lowerIndex = Math.floor(position);
    const upperIndex = Math.ceil(position);
    if (lowerIndex === upperIndex) return sortedValues[lowerIndex];
    const weight = position - lowerIndex;
    return sortedValues[lowerIndex] + ((sortedValues[upperIndex] - sortedValues[lowerIndex]) * weight);
}

function notionalQuartileBucket(
    notional: number | null,
    quartiles: readonly [number, number, number],
): FeatureValue {
    if (notional === null) return { key: "unavailable", label: "Unavailable" };
    if (notional <= quartiles[0]) return { key: "q1", label: "Q1 (lowest notional)" };
    if (notional <= quartiles[1]) return { key: "q2", label: "Q2" };
    if (notional <= quartiles[2]) return { key: "q3", label: "Q3" };
    return { key: "q4", label: "Q4 (highest notional)" };
}

function scopeIncludesTrade(
    trade: EdgeSourceTrade,
    scope: EdgeAnalysisScope,
): { included: boolean; date: Date | null; dayKey: string | null; tags: FeatureValue[] } {
    const date = toValidDate(trade.date);
    const dayKey = date ? getNewYorkDateKey(date) : null;
    const tags = normalizeTags(trade.tags);

    if (scope.symbol && !trade.symbol.toLocaleUpperCase("en-US").includes(scope.symbol.toLocaleUpperCase("en-US"))) {
        return { included: false, date, dayKey, tags };
    }
    if (scope.tag) {
        const requestedTag = scope.tag.toLocaleLowerCase("en-US");
        if (!tags.some((tag) => tag.key === requestedTag)) {
            return { included: false, date, dayKey, tags };
        }
    }
    if (scope.from && (!dayKey || dayKey < scope.from)) {
        return { included: false, date, dayKey, tags };
    }
    if (scope.to && (!dayKey || dayKey > scope.to)) {
        return { included: false, date, dayKey, tags };
    }

    return { included: true, date, dayKey, tags };
}

function canonicalDate(value: Date | string): string {
    const parsed = toValidDate(value);
    return parsed?.toISOString() ?? `invalid:${String(value)}`;
}

function canonicalNumber(value: EdgeNumeric): number | null {
    return toFiniteNumber(value);
}

function stableHash(value: string): string {
    let hashA = 0x811c9dc5;
    let hashB = 0x9e3779b9;
    let hashC = 0x85ebca6b;
    let hashD = 0xc2b2ae35;

    for (let index = 0; index < value.length; index++) {
        const code = value.charCodeAt(index);
        hashA = Math.imul(hashA ^ code, 0x01000193);
        hashB = Math.imul(hashB ^ code, 0x27d4eb2d);
        hashC = Math.imul(hashC ^ code, 0x165667b1);
        hashD = Math.imul(hashD ^ code, 0x9e3779b1);
    }

    return [hashA, hashB, hashC, hashD]
        .map((hash) => (hash >>> 0).toString(16).padStart(8, "0"))
        .join("");
}

function deriveSourceFingerprint(trades: readonly EdgeSourceTrade[]): string {
    const canonicalTrades = trades.map((trade) => ({
        id: trade.id,
        symbol: trade.symbol.trim().toLocaleUpperCase("en-US"),
        date: canonicalDate(trade.date),
        direction: normalizeDirection(trade.direction).key,
        netPl: canonicalNumber(trade.netPl),
        tags: normalizeTags(trade.tags).map((tag) => tag.key).sort(),
        executions: (trade.executions ?? []).map((execution: EdgeSourceExecution, index) => ({
            id: execution.id ?? String(index),
            time: canonicalDate(execution.time),
            price: canonicalNumber(execution.price),
            quantity: canonicalNumber(execution.quantity),
            side: execution.side?.trim().toLocaleUpperCase("en-US") ?? null,
        })).sort((left, right) => (
            left.time.localeCompare(right.time)
            || left.id.localeCompare(right.id)
        )),
    })).sort((left, right) => left.id.localeCompare(right.id));

    return `${EDGE_ANALYSIS_VERSION}-${stableHash(JSON.stringify(canonicalTrades))}`;
}

function normalizeSelectedTrades(
    selectedTrades: readonly EdgeSourceTrade[],
): { trades: NormalizedTrade[]; excludedInvalidPnl: number; excludedInvalidDate: number } {
    const normalized: NormalizedTrade[] = [];
    let excludedInvalidPnl = 0;
    let excludedInvalidDate = 0;

    for (const source of selectedTrades) {
        const date = toValidDate(source.date);
        if (!date) {
            excludedInvalidDate++;
            continue;
        }
        const pnl = toFiniteNumber(source.netPl);
        if (pnl === null) {
            excludedInvalidPnl++;
            continue;
        }

        const executions = normalizeExecutions(source.executions);
        const firstExecution = firstTimedExecution(executions);
        const dayKey = getNewYorkDateKey(date);

        normalized.push({
            id: source.id,
            symbol: source.symbol.trim().toLocaleUpperCase("en-US") || "UNKNOWN",
            dayKey,
            dateValue: date.getTime(),
            pnl,
            direction: normalizeDirection(source.direction),
            tags: normalizeTags(source.tags),
            executions,
            firstExecutionTime: executionTimeBucket(firstExecution),
            firstExecutionPrice: executionPriceBucket(firstExecution),
            weekday: weekdayBucket(dayKey),
            executionCount: executionCountBucket(executions.length),
            executionWindow: executionWindowBucket(executions),
            repeatSymbol: { key: "pending", label: "Pending" },
            dailyTradeCount: { key: "pending", label: "Pending" },
            notionalQuartile: { key: "pending", label: "Pending" },
            executionNotional: executionNotional(executions),
        });
    }

    const dayCounts = new Map<string, number>();
    for (const trade of normalized) {
        dayCounts.set(trade.dayKey, (dayCounts.get(trade.dayKey) ?? 0) + 1);
    }

    const notionals = normalized
        .map((trade) => trade.executionNotional)
        .filter((value): value is number => value !== null)
        .sort((left, right) => left - right);
    const quartiles: [number, number, number] = [
        quantile(notionals, 0.25),
        quantile(notionals, 0.5),
        quantile(notionals, 0.75),
    ];

    for (const trade of normalized) {
        trade.repeatSymbol = {
            key: trade.symbol.toLocaleLowerCase("en-US"),
            label: trade.symbol,
        };
        trade.dailyTradeCount = dailyTradeCountBucket(dayCounts.get(trade.dayKey) ?? 1);
        trade.notionalQuartile = notionalQuartileBucket(trade.executionNotional, quartiles);
    }

    return { trades: normalized, excludedInvalidPnl, excludedInvalidDate };
}

function featureValuesForDimension(
    trade: NormalizedTrade,
    dimension: EdgeDimensionKey,
): FeatureValue[] {
    switch (dimension) {
        case "direction": return [trade.direction];
        case "tag": return trade.tags;
        case "firstExecutionTime": return [trade.firstExecutionTime];
        case "firstExecutionPrice": return [trade.firstExecutionPrice];
        case "weekday": return [trade.weekday];
        case "executionCount": return [trade.executionCount];
        case "executionWindow": return [trade.executionWindow];
        case "repeatSymbol": return [trade.repeatSymbol];
        case "dailyTradeCount": return [trade.dailyTradeCount];
        case "notionalQuartile": return [trade.notionalQuartile];
    }
}

function makeGroupId(
    kind: "dimension" | "pair",
    dimension: EdgeDimensionKey | EdgePairKey,
    key: string,
): string {
    return `${kind}:${dimension}:${encodeURIComponent(key)}`;
}

function collectDimensionSeeds(
    trades: readonly NormalizedTrade[],
    dimension: EdgeDimensionKey,
): GroupSeed[] {
    const groups = new Map<string, GroupSeed>();

    for (const trade of trades) {
        for (const value of featureValuesForDimension(trade, dimension)) {
            let group = groups.get(value.key);
            if (!group) {
                group = { key: value.key, label: value.label, trades: [], parentGroupIds: [] };
                groups.set(value.key, group);
            }
            group.trades.push(trade);
        }
    }

    if (dimension === "repeatSymbol") {
        const byFrequencyThenLabel = (left: GroupSeed, right: GroupSeed) => (
            right.trades.length - left.trades.length || left.label.localeCompare(right.label)
        );
        const conclusionEligible = [...groups.values()]
            .filter((group) => group.trades.length >= 30)
            .sort(byFrequencyThenLabel);
        const exploratory = [...groups.values()]
            .filter((group) => (
                group.trades.length >= MIN_RECURRING_SYMBOL_SAMPLE
                && group.trades.length < 30
            ))
            .sort(byFrequencyThenLabel)
            .slice(0, Math.max(0, MAX_RECURRING_SYMBOL_GROUPS - conclusionEligible.length));
        return [...conclusionEligible, ...exploratory];
    }

    return [...groups.values()].sort((left, right) => (
        featureSortIndex(dimension, left.key) - featureSortIndex(dimension, right.key)
        || left.label.localeCompare(right.label)
    ));
}

function collectPairSeeds(
    trades: readonly NormalizedTrade[],
    definition: PairDefinition,
): GroupSeed[] {
    const groups = new Map<string, GroupSeed>();

    for (const trade of trades) {
        const leftValues = featureValuesForDimension(trade, definition.left);
        const rightValues = featureValuesForDimension(trade, definition.right);

        for (const left of leftValues) {
            for (const right of rightValues) {
                const key = `${left.key}${PAIR_KEY_SEPARATOR}${right.key}`;
                let group = groups.get(key);
                if (!group) {
                    group = {
                        key,
                        label: `${left.label} × ${right.label}`,
                        trades: [],
                        parentGroupIds: [
                            makeGroupId("dimension", definition.left, left.key),
                            makeGroupId("dimension", definition.right, right.key),
                        ],
                    };
                    groups.set(key, group);
                }
                group.trades.push(trade);
            }
        }
    }

    return [...groups.values()].sort((left, right) => left.label.localeCompare(right.label));
}

const FEATURE_SORT_ORDERS: Partial<Record<EdgeDimensionKey, readonly string[]>> = {
    direction: ["long", "short", "unknown"],
    firstExecutionTime: ["premarket", "0930-1030", "1030-1400", "1400-1600", "afterhours", "unavailable"],
    firstExecutionPrice: ["lt2", "2-5", "5-10", "10-20", "20-50", "50-100", "gte100", "unavailable"],
    weekday: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"],
    executionCount: ["1", "2", "3-5", "6-9", "10-19", "20+", "unavailable"],
    executionWindow: ["single", "lt15", "15-30", "30-60", "60-120", "gte120", "unavailable"],
    dailyTradeCount: ["1", "2", "3-5", "6-9", "10+"],
    notionalQuartile: ["q1", "q2", "q3", "q4", "unavailable"],
};

function featureSortIndex(dimension: EdgeDimensionKey, key: string): number {
    const index = FEATURE_SORT_ORDERS[dimension]?.indexOf(key) ?? -1;
    return index < 0 ? Number.MAX_SAFE_INTEGER : index;
}

function calculateMetrics(
    trades: readonly NormalizedTrade[],
    baselineExpectancy: number,
): EdgeMetrics {
    if (trades.length === 0) {
        return {
            sampleSize: 0,
            tradeDayCount: 0,
            netPl: 0,
            expectancy: 0,
            winners: 0,
            losers: 0,
            scratches: 0,
            winRate: null,
            avgWin: null,
            avgLoss: null,
            payoff: null,
            profitFactor: null,
            medianPl: null,
            expectancyDelta: finiteNumberOrZero(-baselineExpectancy),
        };
    }

    const pnlValues = trades.map((trade) => trade.pnl);
    const wins = pnlValues.filter((pnl) => pnl > 0);
    const losses = pnlValues.filter((pnl) => pnl < 0);
    const scratches = pnlValues.length - wins.length - losses.length;
    const netPl = finiteNumberOrZero(pnlValues.reduce((sum, pnl) => sum + pnl, 0));
    const expectancy = finiteNumberOrZero(netPl / pnlValues.length);
    const grossProfit = finiteNumberOrZero(wins.reduce((sum, pnl) => sum + pnl, 0));
    const grossLossAbsolute = finiteNumberOrZero(Math.abs(losses.reduce((sum, pnl) => sum + pnl, 0)));
    const avgWin = wins.length > 0 ? finiteNumberOrNull(grossProfit / wins.length) : null;
    const avgLoss = losses.length > 0 ? finiteNumberOrNull(-grossLossAbsolute / losses.length) : null;
    const winLossCount = wins.length + losses.length;
    const sortedPnl = [...pnlValues].sort((left, right) => left - right);
    const middle = Math.floor(sortedPnl.length / 2);
    const median = sortedPnl.length % 2 === 0
        ? (sortedPnl[middle - 1] + sortedPnl[middle]) / 2
        : sortedPnl[middle];

    return {
        sampleSize: pnlValues.length,
        tradeDayCount: new Set(trades.map((trade) => trade.dayKey)).size,
        netPl,
        expectancy,
        winners: wins.length,
        losers: losses.length,
        scratches,
        winRate: winLossCount > 0 ? finiteNumberOrNull((wins.length / winLossCount) * 100) : null,
        avgWin,
        avgLoss,
        payoff: avgWin !== null && avgLoss !== null && avgLoss !== 0
            ? finiteNumberOrNull(avgWin / Math.abs(avgLoss))
            : null,
        profitFactor: grossLossAbsolute > 0
            ? finiteNumberOrNull(grossProfit / grossLossAbsolute)
            : null,
        medianPl: finiteNumberOrNull(median),
        expectancyDelta: finiteNumberOrZero(expectancy - baselineExpectancy),
    };
}

function confidenceForSample(sampleSize: number): EdgeConfidence {
    if (sampleSize < 30) return "insufficient";
    if (sampleSize < 60) return "initial";
    if (sampleSize < 100) return "medium";
    return "high";
}

function qualification(
    metrics: EdgeMetrics,
    kind: "dimension" | "pair",
): { eligible: boolean; reasons: string[] } {
    const reasons: string[] = [];
    const minimumSample = kind === "pair" ? 40 : 30;
    if (metrics.sampleSize < minimumSample) reasons.push(`Requires at least ${minimumSample} trades.`);
    if (metrics.tradeDayCount < 10) reasons.push("Requires at least 10 trading days.");
    if (metrics.winners < 5) reasons.push("Requires at least 5 winning trades.");
    if (metrics.losers < 5) reasons.push("Requires at least 5 losing trades.");
    return { eligible: reasons.length === 0, reasons };
}

function getOutlierResult(trades: readonly NormalizedTrade[]): {
    sensitive: boolean;
    adjustedExpectancy: number | null;
} {
    if (trades.length <= 1) return { sensitive: false, adjustedExpectancy: null };

    let largestIndex = 0;
    for (let index = 1; index < trades.length; index++) {
        const candidateAbsolute = Math.abs(trades[index].pnl);
        const currentAbsolute = Math.abs(trades[largestIndex].pnl);
        if (
            candidateAbsolute > currentAbsolute
            || (candidateAbsolute === currentAbsolute && trades[index].id < trades[largestIndex].id)
        ) {
            largestIndex = index;
        }
    }

    const originalTotal = trades.reduce((sum, trade) => sum + trade.pnl, 0);
    const adjustedExpectancy = finiteNumberOrNull(
        (originalTotal - trades[largestIndex].pnl) / (trades.length - 1),
    );
    if (adjustedExpectancy === null) return { sensitive: false, adjustedExpectancy: null };

    const originalExpectancy = originalTotal / trades.length;
    const sensitive = (originalExpectancy > 0 && adjustedExpectancy <= 0)
        || (originalExpectancy < 0 && adjustedExpectancy >= 0);
    return { sensitive, adjustedExpectancy };
}

function classifyObservedEdge(
    metrics: EdgeMetrics,
    eligible: boolean,
    unavailable: boolean,
    parentMetrics: readonly EdgeMetrics[],
): EdgeObservedDirection {
    if (!eligible || unavailable || metrics.profitFactor === null) return "neutral";

    const positive = metrics.expectancy > 0
        && metrics.profitFactor > 1
        && metrics.expectancyDelta > 0
        && parentMetrics.every((parent) => metrics.expectancy > parent.expectancy);
    if (positive) return "positive";

    const negative = metrics.expectancy < 0
        && metrics.profitFactor < 1
        && metrics.expectancyDelta < 0
        && parentMetrics.every((parent) => metrics.expectancy < parent.expectancy);
    return negative ? "negative" : "neutral";
}

function buildGroup(
    kind: "dimension" | "pair",
    dimension: EdgeDimensionKey | EdgePairKey,
    seed: GroupSeed,
    baselineExpectancy: number,
    parentMetrics: readonly EdgeMetrics[] = [],
): EdgeGroup {
    const metrics = calculateMetrics(seed.trades, baselineExpectancy);
    const sampleQualification = qualification(metrics, kind);
    const outlier = getOutlierResult(seed.trades);
    const unavailable = seed.key.split(PAIR_KEY_SEPARATOR).includes("unavailable");
    const observedEdge = classifyObservedEdge(
        metrics,
        sampleQualification.eligible,
        unavailable,
        parentMetrics,
    );
    const qualificationReasons = [...sampleQualification.reasons];

    if (unavailable) {
        qualificationReasons.push("Unavailable-data groups are descriptive and do not produce Top conclusions.");
    }
    if (outlier.sensitive) {
        qualificationReasons.push("Removing the largest absolute-P&L trade flips the expectancy sign.");
    }
    if (kind === "pair" && sampleQualification.eligible && parentMetrics.length === 2 && observedEdge === "neutral") {
        qualificationReasons.push("A pair must outperform or underperform both parent groups.");
    }

    return {
        id: makeGroupId(kind, dimension, seed.key),
        kind,
        dimension,
        dimensionLabel: kind === "dimension"
            ? DIMENSION_LABELS.get(dimension as EdgeDimensionKey) ?? String(dimension)
            : PAIR_LABELS.get(dimension as EdgePairKey) ?? String(dimension),
        key: seed.key,
        label: seed.label,
        metrics,
        confidence: confidenceForSample(metrics.sampleSize),
        eligible: sampleQualification.eligible,
        observedEdge,
        outlierSensitive: outlier.sensitive,
        outlierAdjustedExpectancy: outlier.adjustedExpectancy,
        parentGroupIds: seed.parentGroupIds,
        qualificationReasons,
    };
}

function buildDimensionCollections(
    trades: readonly NormalizedTrade[],
    baselineExpectancy: number,
): EdgeGroupCollection[] {
    return DIMENSION_DEFINITIONS.map((definition) => ({
        key: definition.key,
        label: definition.label,
        description: definition.description,
        mutuallyExclusive: definition.mutuallyExclusive,
        groups: collectDimensionSeeds(trades, definition.key).map((seed) => (
            buildGroup("dimension", definition.key, seed, baselineExpectancy)
        )),
    }));
}

function buildPairCollections(
    trades: readonly NormalizedTrade[],
    baselineExpectancy: number,
    dimensionGroupsById: ReadonlyMap<string, EdgeGroup>,
): EdgeGroupCollection[] {
    return PAIR_DEFINITIONS.map((definition) => ({
        key: definition.key,
        label: definition.label,
        description: definition.description,
        mutuallyExclusive: definition.mutuallyExclusive,
        groups: collectPairSeeds(trades, definition).map((seed) => {
            const parentMetrics = seed.parentGroupIds
                .map((id) => dimensionGroupsById.get(id)?.metrics)
                .filter((metrics): metrics is EdgeMetrics => metrics !== undefined);
            return buildGroup("pair", definition.key, seed, baselineExpectancy, parentMetrics);
        }),
    }));
}

function compareTopEdges(left: EdgeGroup, right: EdgeGroup): number {
    return right.metrics.expectancyDelta - left.metrics.expectancyDelta
        || right.metrics.sampleSize - left.metrics.sampleSize
        || left.id.localeCompare(right.id);
}

function compareTopLeaks(left: EdgeGroup, right: EdgeGroup): number {
    return left.metrics.expectancyDelta - right.metrics.expectancyDelta
        || right.metrics.sampleSize - left.metrics.sampleSize
        || left.id.localeCompare(right.id);
}

function formatMoney(value: number): string {
    const sign = value < 0 ? "-" : "";
    return `${sign}$${Math.abs(value).toFixed(2)}`;
}

function actionForGroup(group: EdgeGroup, baseline: EdgeMetrics): EdgeAction {
    const reducing = group.observedEdge === "negative";
    let detail = reducing
        ? `This historical association underperformed the selected baseline. Review the trades and consider a stricter checklist or smaller test exposure while collecting new evidence.`
        : `This historical association outperformed the selected baseline. Document the repeatable setup and test it prospectively; it is not a guarantee of future results.`;

    if (group.dimension === "executionWindow") {
        detail += " The measured value is an execution window, not a strict holding period.";
    }
    if (group.dimension === "notionalQuartile") {
        detail += " Execution notional describes activity and is not a risk-adjusted return measure.";
    }

    return {
        id: `action:${reducing ? "reduce" : "reinforce"}:${group.id}`,
        kind: reducing ? "reduce" : "reinforce",
        title: `${reducing ? "Review" : "Preserve"} Observed Edge: ${group.dimensionLabel} — ${group.label}`,
        detail,
        evidence: [
            `n=${group.metrics.sampleSize} across ${group.metrics.tradeDayCount} trading days`,
            `Expectancy ${formatMoney(group.metrics.expectancy)} vs ${formatMoney(baseline.expectancy)} baseline`,
            `Profit factor ${group.metrics.profitFactor?.toFixed(2) ?? "n/a"}`,
        ],
        groupId: group.id,
    };
}

function percentage(numerator: number, denominator: number): number {
    return denominator > 0 ? finiteNumberOrZero((numerator / denominator) * 100) : 0;
}

function buildDataQuality(
    sourceTradeCount: number,
    trades: readonly NormalizedTrade[],
    excludedInvalidPnl: number,
    excludedInvalidDate: number,
): EdgeDataQuality {
    const taggedTradeCount = trades.filter((trade) => (
        !(trade.tags.length === 1 && trade.tags[0].key === "__untagged__")
    )).length;
    const tradesWithExecutions = trades.filter((trade) => trade.executions.length > 0).length;
    const tradesWithFirstExecutionPrice = trades.filter((trade) => (
        trade.firstExecutionPrice.key !== "unavailable"
    )).length;
    const tradesWithNotional = trades.filter((trade) => trade.executionNotional !== null).length;
    const limitations = [
        "Observed Edge describes historical association, not causation or a guarantee of future results.",
        "Each Trade is a Symbol × Day execution collection; execution window is not a strict holding period.",
        "No external market data, MAE/MFE, fees, market cap, float, Gap%, or RVOL is used.",
        "Execution notional is summed absolute price × quantity and is not a risk-adjusted return measure.",
    ];

    if (taggedTradeCount < trades.length) {
        limitations.push(`${trades.length - taggedTradeCount} analyzed trades have no user tag.`);
    }
    if (trades.some((trade) => trade.tags.length > 1)) {
        limitations.push("Tag groups overlap because a trade with multiple tags appears once in each tag group.");
    }
    if (tradesWithExecutions < trades.length) {
        limitations.push(`${trades.length - tradesWithExecutions} analyzed trades have no executions; execution-derived groups show them as unavailable.`);
    }
    if (excludedInvalidPnl > 0 || excludedInvalidDate > 0) {
        limitations.push(`${excludedInvalidPnl} trades with invalid net P&L and ${excludedInvalidDate} trades with invalid dates were excluded.`);
    }

    return {
        sourceTradeCount,
        analyzedTradeCount: trades.length,
        tradeDayCount: new Set(trades.map((trade) => trade.dayKey)).size,
        taggedTradeCount,
        tagCoverage: percentage(taggedTradeCount, trades.length),
        tradesWithExecutions,
        executionCoverage: percentage(tradesWithExecutions, trades.length),
        tradesWithFirstExecutionPrice,
        firstExecutionPriceCoverage: percentage(tradesWithFirstExecutionPrice, trades.length),
        tradesWithNotional,
        notionalCoverage: percentage(tradesWithNotional, trades.length),
        excludedInvalidPnl,
        excludedInvalidDate,
        limitations,
    };
}

/**
 * Pure Edge Analysis entry point. It does not read the database or depend on presentation state.
 * The supplied scope uses inclusive New York calendar dates.
 */
export function analyzeEdgeTrades(
    sourceTrades: readonly EdgeSourceTrade[],
    scope: EdgeAnalysisScope,
): EdgeAnalysisResponse {
    const normalizedScope = normalizeScope(scope);
    const selectedSourceTrades = sourceTrades.filter((trade) => (
        scopeIncludesTrade(trade, normalizedScope).included
    ));
    const sourceFingerprint = deriveSourceFingerprint(selectedSourceTrades);
    const normalized = normalizeSelectedTrades(selectedSourceTrades);
    const baseline = {
        ...calculateMetrics(normalized.trades, 0),
        expectancyDelta: 0,
    };
    const dimensionGroups = buildDimensionCollections(normalized.trades, baseline.expectancy);
    const dimensionGroupsById = new Map(
        dimensionGroups.flatMap((collection) => collection.groups).map((group) => [group.id, group]),
    );
    const pairGroups = buildPairCollections(
        normalized.trades,
        baseline.expectancy,
        dimensionGroupsById,
    );
    const allGroups = [
        ...dimensionGroups.flatMap((collection) => collection.groups),
        ...pairGroups.flatMap((collection) => collection.groups),
    ];
    const topEdges = allGroups
        .filter((group) => group.observedEdge === "positive" && !group.outlierSensitive)
        .sort(compareTopEdges)
        .slice(0, 3);
    const topLeaks = allGroups
        .filter((group) => group.observedEdge === "negative" && !group.outlierSensitive)
        .sort(compareTopLeaks)
        .slice(0, 3);
    const actions = [
        ...topLeaks.map((group) => actionForGroup(group, baseline)),
        ...topEdges.map((group) => actionForGroup(group, baseline)),
    ];

    return {
        analysisVersion: EDGE_ANALYSIS_VERSION,
        scope: normalizedScope,
        baseline,
        dataQuality: buildDataQuality(
            selectedSourceTrades.length,
            normalized.trades,
            normalized.excludedInvalidPnl,
            normalized.excludedInvalidDate,
        ),
        dimensionGroups,
        pairGroups,
        topEdges,
        topLeaks,
        actions,
        scopeKey: deriveScopeKey(normalizedScope),
        sourceFingerprint,
    };
}
