import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";

const loadModule = createRequire(import.meta.url);
const {
    analyzeEdgeTrades,
    deriveScopeKey,
} = loadModule("../lib/edge-analysis.ts") as typeof import("../lib/edge-analysis");

type EdgeAnalysisResponse = import("../lib/edge-analysis-types").EdgeAnalysisResponse;
type EdgeAnalysisScope = import("../lib/edge-analysis-types").EdgeAnalysisScope;
type EdgeDimensionKey = import("../lib/edge-analysis-types").EdgeDimensionKey;
type EdgeGroup = import("../lib/edge-analysis-types").EdgeGroup;
type EdgeSourceExecution = import("../lib/edge-analysis-types").EdgeSourceExecution;
type EdgeSourceTrade = import("../lib/edge-analysis-types").EdgeSourceTrade;

const ALL_TIME: EdgeAnalysisScope = {
    from: null,
    to: null,
    symbol: null,
    tag: null,
    label: "All Time",
};

function trade(
    id: string,
    overrides: Partial<EdgeSourceTrade> = {},
): EdgeSourceTrade {
    return {
        id,
        symbol: "TEST",
        date: "2025-01-06T05:00:00.000Z",
        direction: "LONG",
        netPl: 0,
        tags: [],
        executions: [],
        ...overrides,
    };
}

function execution(
    id: string,
    time: string,
    price = 10,
    quantity = 100,
    side = "BUY",
): EdgeSourceExecution {
    return { id, time, price, quantity, side };
}

function collection(
    result: EdgeAnalysisResponse,
    key: EdgeDimensionKey,
) {
    const found = result.dimensionGroups.find((candidate) => candidate.key === key);
    assert.ok(found, `Missing dimension ${key}`);
    return found;
}

function groupByKey(
    result: EdgeAnalysisResponse,
    dimension: EdgeDimensionKey,
    key: string,
): EdgeGroup {
    const found = collection(result, dimension).groups.find((candidate) => candidate.key === key);
    assert.ok(found, `Missing ${dimension} group ${key}`);
    return found;
}

function assertJsonSafe(value: unknown): void {
    if (typeof value === "number") {
        assert.ok(Number.isFinite(value), `Expected finite JSON number, received ${value}`);
        return;
    }
    if (Array.isArray(value)) {
        value.forEach(assertJsonSafe);
        return;
    }
    if (value && typeof value === "object") {
        Object.values(value).forEach(assertJsonSafe);
    }
}

function dateForIndex(index: number): string {
    return new Date(Date.UTC(2025, 0, 6 + (index % 10), 17)).toISOString();
}

function balancedSeries(
    prefix: string,
    count: number,
    direction: "LONG" | "SHORT",
    tags: string[],
    win: number,
    loss: number,
    symbol = prefix.toUpperCase(),
): EdgeSourceTrade[] {
    return Array.from({ length: count }, (_, index) => trade(`${prefix}-${index}`, {
        symbol,
        date: dateForIndex(index),
        direction,
        tags,
        netPl: index % 2 === 0 ? win : loss,
    }));
}

test("empty analysis returns all collections and JSON-safe zero baseline", () => {
    const result = analyzeEdgeTrades([], ALL_TIME);

    assert.equal(result.analysisVersion, "v1");
    assert.equal(result.baseline.sampleSize, 0);
    assert.equal(result.baseline.expectancyDelta, 0);
    assert.equal(result.dimensionGroups.length, 10);
    assert.equal(result.pairGroups.length, 4);
    assert.deepEqual(result.topEdges, []);
    assert.deepEqual(result.topLeaks, []);
    assert.deepEqual(result.actions, []);
    assert.equal(result.dataQuality.tagCoverage, 0);
    assertJsonSafe(result);
    assert.doesNotThrow(() => JSON.stringify(result));
});

test("baseline metrics match a hand-calculated win/loss/scratch example", () => {
    const pnl = [100, 50, -40, -10, 0];
    const result = analyzeEdgeTrades(pnl.map((netPl, index) => trade(`metric-${index}`, {
        netPl,
        date: dateForIndex(index),
    })), ALL_TIME);

    assert.deepEqual(result.baseline, {
        sampleSize: 5,
        tradeDayCount: 5,
        netPl: 100,
        expectancy: 20,
        winners: 2,
        losers: 2,
        scratches: 1,
        winRate: 50,
        avgWin: 75,
        avgLoss: -25,
        payoff: 3,
        profitFactor: 3,
        medianPl: 0,
        expectancyDelta: 0,
    });
});

test("all-win, all-loss, all-scratch, and invalid numeric inputs remain JSON-safe", () => {
    const allWin = analyzeEdgeTrades([
        trade("w1", { netPl: 10 }),
        trade("w2", { netPl: 20 }),
    ], ALL_TIME);
    assert.equal(allWin.baseline.profitFactor, null);
    assert.equal(allWin.baseline.payoff, null);
    assert.equal(allWin.baseline.winRate, 100);

    const allLoss = analyzeEdgeTrades([
        trade("l1", { netPl: -10 }),
        trade("l2", { netPl: -20 }),
    ], ALL_TIME);
    assert.equal(allLoss.baseline.profitFactor, 0);
    assert.equal(allLoss.baseline.payoff, null);
    assert.equal(allLoss.baseline.winRate, 0);

    const allScratch = analyzeEdgeTrades([
        trade("s1", { netPl: 0 }),
        trade("s2", { netPl: "0" }),
    ], ALL_TIME);
    assert.equal(allScratch.baseline.winRate, null);
    assert.equal(allScratch.baseline.profitFactor, null);
    assert.equal(allScratch.baseline.medianPl, 0);

    const invalid = analyzeEdgeTrades([
        trade("nan", { netPl: Number.NaN }),
        trade("inf", { netPl: Number.POSITIVE_INFINITY }),
        trade("null", { netPl: null }),
        trade("valid", { netPl: 1 }),
    ], ALL_TIME);
    assert.equal(invalid.dataQuality.excludedInvalidPnl, 3);
    assert.equal(invalid.baseline.sampleSize, 1);

    [allWin, allLoss, allScratch, invalid].forEach(assertJsonSafe);
});

test("first-execution price bands use the specified exact boundaries", () => {
    const prices = [1.99, 2, 4.999, 5, 10, 20, 50, 100];
    const result = analyzeEdgeTrades(prices.map((price, index) => trade(`price-${index}`, {
        netPl: index,
        executions: [execution(`price-ex-${index}`, "2025-01-06T15:00:00.000Z", price)],
    })), ALL_TIME);
    const groups = new Map(collection(result, "firstExecutionPrice").groups.map((item) => [item.key, item.metrics.sampleSize]));

    assert.equal(groups.get("lt2"), 1);
    assert.equal(groups.get("2-5"), 2);
    assert.equal(groups.get("5-10"), 1);
    assert.equal(groups.get("10-20"), 1);
    assert.equal(groups.get("20-50"), 1);
    assert.equal(groups.get("50-100"), 1);
    assert.equal(groups.get("gte100"), 1);
});

test("New York execution-time buckets honor boundaries in standard and daylight time", () => {
    const times = [
        ["pre", "2025-01-06T14:29:00.000Z", "premarket"],
        ["open", "2025-01-06T14:30:00.000Z", "0930-1030"],
        ["mid", "2025-01-06T15:30:00.000Z", "1030-1400"],
        ["close", "2025-01-06T19:00:00.000Z", "1400-1600"],
        ["after", "2025-01-06T21:00:00.000Z", "afterhours"],
        ["summer-open", "2025-07-07T13:30:00.000Z", "0930-1030"],
    ] as const;
    const result = analyzeEdgeTrades(times.map(([id, time], index) => trade(id, {
        netPl: index,
        executions: [execution(`${id}-ex`, time)],
    })), ALL_TIME);

    for (const [, , expectedKey] of times) {
        assert.ok(groupByKey(result, "firstExecutionTime", expectedKey));
    }
    assert.equal(groupByKey(result, "firstExecutionTime", "0930-1030").metrics.sampleSize, 2);
});

test("execution-count and execution-window buckets honor every boundary", () => {
    const counts = [0, 1, 2, 3, 5, 6, 9, 10, 19, 20];
    const countTrades = counts.map((count, tradeIndex) => trade(`count-${count}`, {
        netPl: tradeIndex,
        executions: Array.from({ length: count }, (_, executionIndex) => execution(
            `count-${count}-${executionIndex}`,
            new Date(Date.UTC(2025, 0, 6, 15, 0, executionIndex)).toISOString(),
        )),
    }));
    const countResult = analyzeEdgeTrades(countTrades, ALL_TIME);
    const countGroups = new Map(collection(countResult, "executionCount").groups.map((item) => [item.key, item.metrics.sampleSize]));
    assert.deepEqual(Object.fromEntries(countGroups), {
        "1": 1,
        "2": 1,
        "3-5": 2,
        "6-9": 2,
        "10-19": 2,
        "20+": 1,
        unavailable: 1,
    });

    const start = Date.parse("2025-01-06T15:00:00.000Z");
    const durations = [
        ["lt15", 899],
        ["15-30", 900],
        ["15-30-b", 1799],
        ["30-60", 1800],
        ["30-60-b", 3599],
        ["60-120", 3600],
        ["60-120-b", 7199],
        ["gte120", 7200],
    ] as const;
    const windowTrades = durations.map(([id, seconds], index) => trade(`window-${id}`, {
        netPl: index,
        executions: [
            execution(`${id}-first`, new Date(start).toISOString()),
            execution(`${id}-last`, new Date(start + (seconds * 1_000)).toISOString()),
        ],
    }));
    windowTrades.push(trade("window-single", {
        executions: [execution("single", new Date(start).toISOString())],
    }));
    windowTrades.push(trade("window-missing", { executions: [] }));
    const windowResult = analyzeEdgeTrades(windowTrades, ALL_TIME);
    const windowGroups = new Map(collection(windowResult, "executionWindow").groups.map((item) => [item.key, item.metrics.sampleSize]));

    assert.equal(windowGroups.get("single"), 1);
    assert.equal(windowGroups.get("lt15"), 1);
    assert.equal(windowGroups.get("15-30"), 2);
    assert.equal(windowGroups.get("30-60"), 2);
    assert.equal(windowGroups.get("60-120"), 2);
    assert.equal(windowGroups.get("gte120"), 1);
    assert.equal(windowGroups.get("unavailable"), 1);
});

test("inclusive New York date scopes cover the full DST transition day and leap day", () => {
    const dstTrades = [
        trade("dst-start", { date: "2024-03-10T05:00:00.000Z", netPl: 1 }),
        trade("dst-end", { date: "2024-03-11T03:59:59.999Z", netPl: 2 }),
        trade("next-day", { date: "2024-03-11T04:00:00.000Z", netPl: 4 }),
        trade("leap", { date: "2024-02-29T05:00:00.000Z", netPl: 8 }),
    ];
    const dstResult = analyzeEdgeTrades(dstTrades, {
        ...ALL_TIME,
        from: "2024-03-10",
        to: "2024-03-10",
        label: "DST day",
    });
    assert.equal(dstResult.baseline.sampleSize, 2);
    assert.equal(dstResult.baseline.netPl, 3);

    const leapResult = analyzeEdgeTrades(dstTrades, {
        ...ALL_TIME,
        from: "2024-02-29",
        to: "2024-02-29",
        label: "Leap day",
    });
    assert.equal(leapResult.baseline.sampleSize, 1);
    assert.equal(leapResult.baseline.netPl, 8);
});

test("multi-tag membership is deduplicated, non-additive, and exact tag filtering is enforced", () => {
    const trades = [
        trade("tag-1", { symbol: "ABCD", tags: ["Breakout", "breakout", "News"], netPl: 10 }),
        trade("tag-2", { symbol: "XYZ", tags: ["Breakout"], netPl: -5 }),
        trade("tag-3", { symbol: "NOPE", tags: [], netPl: 1 }),
    ];
    const result = analyzeEdgeTrades(trades, ALL_TIME);
    const tagCollection = collection(result, "tag");
    const breakout = tagCollection.groups.find((group) => group.key === "breakout");
    const news = tagCollection.groups.find((group) => group.key === "news");
    assert.equal(tagCollection.mutuallyExclusive, false);
    assert.equal(breakout?.metrics.sampleSize, 2);
    assert.equal(news?.metrics.sampleSize, 1);
    assert.ok(tagCollection.groups.reduce((sum, group) => sum + group.metrics.sampleSize, 0) > result.baseline.sampleSize);

    const exact = analyzeEdgeTrades(trades, { ...ALL_TIME, tag: "breakout" });
    const partial = analyzeEdgeTrades(trades, { ...ALL_TIME, tag: "break" });
    const symbol = analyzeEdgeTrades(trades, { ...ALL_TIME, symbol: "bc" });
    assert.equal(exact.baseline.sampleSize, 2);
    assert.equal(partial.baseline.sampleSize, 0);
    assert.equal(symbol.baseline.sampleSize, 1);

    assert.deepEqual(result.pairGroups.map((pair) => pair.key), [
        "directionTag",
        "directionTime",
        "directionPrice",
        "tagTime",
    ]);
    assert.ok(result.pairGroups.every((pair) => !String(pair.key).includes("weekday")));
});

test("signed quantities use summed absolute execution notional", () => {
    const result = analyzeEdgeTrades([
        trade("round-trip", {
            netPl: 10,
            executions: [
                execution("buy", "2025-01-06T15:00:00.000Z", 10, 10, "BUY"),
                execution("sell", "2025-01-06T15:10:00.000Z", 10, -10, "SELL"),
            ],
        }),
        trade("small", {
            netPl: -1,
            executions: [execution("small-buy", "2025-01-06T15:00:00.000Z", 5, 10)],
        }),
    ], ALL_TIME);

    assert.equal(result.dataQuality.tradesWithNotional, 2);
    assert.equal(groupByKey(result, "notionalQuartile", "q4").metrics.sampleSize, 1);
    assert.equal(groupByKey(result, "notionalQuartile", "q1").metrics.sampleSize, 1);
});

test("source fingerprint is order-stable, ignores unrelated display fields, and tracks relevant source changes", () => {
    type ExtendedTrade = EdgeSourceTrade & { displayScale?: number; notes?: string };
    const first: ExtendedTrade = {
        ...trade("fingerprint-a", {
            netPl: 10,
            tags: ["A"],
            executions: [execution("fp-ex", "2025-01-06T15:00:00.000Z", 10, 5, "BUY")],
        }),
        displayScale: 1,
        notes: "ignored",
    };
    const second: ExtendedTrade = {
        ...trade("fingerprint-b", { netPl: -5 }),
        displayScale: 2,
    };
    const baseline = analyzeEdgeTrades([first, second], ALL_TIME);
    const displaySecond: ExtendedTrade = { ...second, displayScale: 99 };
    const displayFirst: ExtendedTrade = { ...first, displayScale: 20, notes: "also ignored" };
    const reorderedAndDisplayed = analyzeEdgeTrades([displaySecond, displayFirst], ALL_TIME);
    assert.equal(reorderedAndDisplayed.sourceFingerprint, baseline.sourceFingerprint);
    assert.deepEqual(reorderedAndDisplayed.baseline, baseline.baseline);

    const sideChanged = analyzeEdgeTrades([
        {
            ...first,
            executions: [execution("fp-ex", "2025-01-06T15:00:00.000Z", 10, 5, "SELL")],
        },
        second,
    ], ALL_TIME);
    const pnlChanged = analyzeEdgeTrades([{ ...first, netPl: 11 }, second], ALL_TIME);
    assert.notEqual(sideChanged.sourceFingerprint, baseline.sourceFingerprint);
    assert.notEqual(pnlChanged.sourceFingerprint, baseline.sourceFingerprint);
});

test("scope keys ignore display labels and normalize filter case", () => {
    const first = deriveScopeKey({
        from: "2025-01-01",
        to: "2025-02-01",
        symbol: "abcd",
        tag: "Breakout",
        label: "One",
    });
    const second = deriveScopeKey({
        from: "2025-01-01",
        to: "2025-02-01",
        symbol: "ABCD",
        tag: "breakout",
        label: "Two",
    });
    assert.equal(first, second);
});

test("single-dimension qualification and confidence thresholds are exact", () => {
    const qualified = analyzeEdgeTrades([
        ...balancedSeries("long", 30, "LONG", ["A"], 20, -10),
        ...balancedSeries("short", 30, "SHORT", ["B"], 10, -20),
    ], ALL_TIME);
    const long = groupByKey(qualified, "direction", "long");
    assert.equal(long.metrics.sampleSize, 30);
    assert.equal(long.metrics.tradeDayCount, 10);
    assert.equal(long.eligible, true);
    assert.equal(long.confidence, "initial");
    assert.equal(long.observedEdge, "positive");

    const below = analyzeEdgeTrades([
        ...balancedSeries("under", 29, "LONG", ["A"], 20, -10),
        ...balancedSeries("other", 30, "SHORT", ["B"], 10, -20),
    ], ALL_TIME);
    const under = groupByKey(below, "direction", "long");
    assert.equal(under.eligible, false);
    assert.equal(under.confidence, "insufficient");

    const medium = analyzeEdgeTrades(balancedSeries("medium", 60, "LONG", ["A"], 20, -10), ALL_TIME);
    const high = analyzeEdgeTrades(balancedSeries("high", 100, "LONG", ["A"], 20, -10), ALL_TIME);
    assert.equal(groupByKey(medium, "direction", "long").confidence, "medium");
    assert.equal(groupByKey(high, "direction", "long").confidence, "high");
});

test("day and win/loss qualification minimums accept exact boundaries and reject one below", () => {
    const exact = Array.from({ length: 30 }, (_, index) => trade(`minimum-${index}`, {
        date: dateForIndex(index),
        netPl: index < 5 ? 10 : index < 10 ? -10 : 0,
    }));
    assert.equal(groupByKey(analyzeEdgeTrades(exact, ALL_TIME), "direction", "long").eligible, true);

    const fourWins = Array.from({ length: 30 }, (_, index) => trade(`four-wins-${index}`, {
        date: dateForIndex(index),
        netPl: index < 4 ? 10 : index < 9 ? -10 : 0,
    }));
    const fourWinGroup = groupByKey(analyzeEdgeTrades(fourWins, ALL_TIME), "direction", "long");
    assert.equal(fourWinGroup.eligible, false);
    assert.ok(fourWinGroup.qualificationReasons.some((reason) => reason.includes("5 winning")));

    const nineDays = exact.map((source, index) => ({
        ...source,
        id: `nine-days-${index}`,
        date: new Date(Date.UTC(2025, 0, 6 + (index % 9), 17)).toISOString(),
    }));
    const nineDayGroup = groupByKey(analyzeEdgeTrades(nineDays, ALL_TIME), "direction", "long");
    assert.equal(nineDayGroup.eligible, false);
    assert.ok(nineDayGroup.qualificationReasons.some((reason) => reason.includes("10 trading days")));
});

test("whitelisted pair groups require n=40 and incremental improvement over both parents", () => {
    const incremental = analyzeEdgeTrades([
        ...balancedSeries("long-a", 40, "LONG", ["A"], 20, -10),
        ...balancedSeries("long-b", 40, "LONG", ["B"], 10, -10),
        ...balancedSeries("short-a", 40, "SHORT", ["A"], 10, -10),
    ], ALL_TIME);
    const directionTag = incremental.pairGroups.find((pair) => pair.key === "directionTag");
    assert.ok(directionTag);
    const longA = directionTag.groups.find((group) => group.label === "Long × A");
    assert.ok(longA);
    assert.equal(longA.metrics.sampleSize, 40);
    assert.equal(longA.eligible, true);
    assert.equal(longA.observedEdge, "positive");
    assert.equal(longA.parentGroupIds.length, 2);

    const underMinimum = analyzeEdgeTrades([
        ...balancedSeries("under-a", 39, "LONG", ["A"], 20, -10),
        ...balancedSeries("under-b", 40, "LONG", ["B"], 10, -10),
        ...balancedSeries("under-short", 40, "SHORT", ["A"], 10, -10),
    ], ALL_TIME);
    const underPair = underMinimum.pairGroups
        .find((pair) => pair.key === "directionTag")!
        .groups.find((group) => group.label === "Long × A");
    assert.ok(underPair);
    assert.equal(underPair.metrics.sampleSize, 39);
    assert.equal(underPair.eligible, false);

    const parentDominates = analyzeEdgeTrades([
        ...balancedSeries("parent-pair", 40, "LONG", ["A"], 20, -10),
        ...balancedSeries("parent-long", 40, "LONG", ["B"], 30, -10),
        ...balancedSeries("parent-short", 80, "SHORT", ["A"], 10, -30),
    ], ALL_TIME);
    const blockedPair = parentDominates.pairGroups
        .find((pair) => pair.key === "directionTag")!
        .groups.find((group) => group.label === "Long × A");
    assert.ok(blockedPair);
    assert.equal(blockedPair.eligible, true);
    assert.equal(blockedPair.observedEdge, "neutral");
    assert.ok(blockedPair.qualificationReasons.some((reason) => reason.includes("both parent groups")));
});

test("outlier-sensitive groups are marked and excluded from Top conclusions and actions", () => {
    const longTrades = Array.from({ length: 30 }, (_, index) => trade(`spike-${index}`, {
        symbol: "SPIKE",
        date: dateForIndex(index),
        direction: "LONG",
        tags: ["Spike"],
        netPl: index === 0 ? 1_000 : index < 5 ? 1 : -10,
    }));
    const shortTrades = Array.from({ length: 30 }, (_, index) => trade(`control-${index}`, {
        symbol: "CONTROL",
        date: dateForIndex(index),
        direction: "SHORT",
        tags: ["Control"],
        netPl: index < 5 ? 10 : -10,
    }));
    const result = analyzeEdgeTrades([...longTrades, ...shortTrades], ALL_TIME);
    const long = groupByKey(result, "direction", "long");

    assert.equal(long.eligible, true);
    assert.equal(long.observedEdge, "positive");
    assert.equal(long.outlierSensitive, true);
    assert.ok((long.outlierAdjustedExpectancy ?? 0) < 0);
    assert.ok(!result.topEdges.some((group) => group.id === long.id));
    assert.ok(!result.actions.some((action) => action.groupId === long.id));
});

test("recurring Symbol groups expose actual tickers and suppress symbols below n=5", () => {
    const result = analyzeEdgeTrades([
        ...Array.from({ length: 4 }, (_, index) => trade(`abc-${index}`, { symbol: "ABC", netPl: index })),
        ...Array.from({ length: 5 }, (_, index) => trade(`xyz-${index}`, { symbol: "XYZ", netPl: index })),
        trade("solo", { symbol: "SOLO", netPl: 1 }),
    ], ALL_TIME);
    const symbols = collection(result, "repeatSymbol").groups;

    assert.deepEqual(symbols.map((group) => group.label), ["XYZ"]);
    assert.equal(symbols[0].metrics.sampleSize, 5);
});

test("recurring Symbol response cap preserves every conclusion-eligible ticker", () => {
    const exploratory = Array.from({ length: 45 }, (_, symbolIndex) => (
        Array.from({ length: 5 }, (_, tradeIndex) => trade(`s-${symbolIndex}-${tradeIndex}`, {
            symbol: `S${String(symbolIndex).padStart(2, "0")}`,
            date: dateForIndex(tradeIndex),
            netPl: tradeIndex - 2,
        }))
    )).flat();
    const eligible = balancedSeries("must-keep", 30, "LONG", ["A"], 20, -10, "MUSTKEEP");
    const result = analyzeEdgeTrades([...exploratory, ...eligible], ALL_TIME);
    const symbols = collection(result, "repeatSymbol").groups;

    assert.equal(symbols.length, 40);
    assert.ok(symbols.some((group) => group.label === "MUSTKEEP"));
});

test("weekday and selected-trades-per-day dimensions use New York dates", () => {
    const dayCounts = [1, 2, 3, 6, 10];
    const trades = dayCounts.flatMap((count, dayIndex) => Array.from({ length: count }, (_, index) => trade(
        `daily-${dayIndex}-${index}`,
        {
            date: new Date(Date.UTC(2025, 0, 6 + dayIndex, 17)).toISOString(),
            symbol: `D${dayIndex}-${index}`,
            netPl: index,
        },
    )));
    const result = analyzeEdgeTrades(trades, ALL_TIME);
    const daily = new Map(collection(result, "dailyTradeCount").groups.map((item) => [item.key, item.metrics.sampleSize]));

    assert.equal(daily.get("1"), 1);
    assert.equal(daily.get("2"), 2);
    assert.equal(daily.get("3-5"), 3);
    assert.equal(daily.get("6-9"), 6);
    assert.equal(daily.get("10+"), 10);
    assert.equal(groupByKey(result, "weekday", "monday").metrics.sampleSize, 1);
    assert.equal(groupByKey(result, "weekday", "friday").metrics.sampleSize, 10);
});

test("deterministic actions use only qualified non-outlier Observed Edge evidence", () => {
    const result = analyzeEdgeTrades([
        ...balancedSeries("action-long", 60, "LONG", ["Good"], 20, -10),
        ...balancedSeries("action-short", 60, "SHORT", ["Bad"], 10, -20),
    ], ALL_TIME);

    assert.ok(result.topEdges.length > 0);
    assert.ok(result.topLeaks.length > 0);
    assert.ok(result.actions.length > 0);
    for (const action of result.actions) {
        const group = [...result.topEdges, ...result.topLeaks].find((candidate) => candidate.id === action.groupId);
        assert.ok(group);
        assert.equal(group.eligible, true);
        assert.equal(group.outlierSensitive, false);
        assert.match(action.detail, /historical association/i);
    }

    const repeated = analyzeEdgeTrades([
        ...balancedSeries("action-long", 60, "LONG", ["Good"], 20, -10),
        ...balancedSeries("action-short", 60, "SHORT", ["Bad"], 10, -20),
    ], ALL_TIME);
    assert.deepEqual(repeated.topEdges.map((group) => group.id), result.topEdges.map((group) => group.id));
    assert.deepEqual(repeated.topLeaks.map((group) => group.id), result.topLeaks.map((group) => group.id));
    assert.deepEqual(repeated.actions, result.actions);
});
