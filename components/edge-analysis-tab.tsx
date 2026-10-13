"use client";
import { useJournal } from "@/components/journal-runtime";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    AlertTriangle,
    BrainCircuit,
    CheckCircle2,
    Database,
    History,
    Loader2,
    RefreshCw,
    Sparkles,
    Target,
    Trash2,
    TrendingDown,
    TrendingUp,
} from "lucide-react";


import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import type {
    EdgeAnalysisResponse,
    EdgeAnalysisScope,
    EdgeGroup,
} from "@/lib/edge-analysis-types";
import { cn } from "@/lib/utils";

interface EdgeAnalysisTabProps {
    scope: EdgeAnalysisScope;
    active: boolean;
}

interface EdgeModel {
    id: string;
    modelId: string;
    name: string;
    isDefault: boolean;
}

type UnknownRecord = Record<string, unknown>;

const moneyFormatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
});

function asRecord(value: unknown): UnknownRecord | null {
    return typeof value === "object" && value !== null && !Array.isArray(value)
        ? value as UnknownRecord
        : null;
}

function finiteNumber(value: unknown): number | null {
    const number = typeof value === "number" ? value : Number(value);
    return Number.isFinite(number) ? number : null;
}

function firstNumber(record: unknown, keys: string[]): number | null {
    const object = asRecord(record);
    if (!object) return null;
    for (const key of keys) {
        const value = finiteNumber(object[key]);
        if (value !== null) return value;
    }
    return null;
}

function firstString(record: unknown, keys: string[]): string | null {
    const object = asRecord(record);
    if (!object) return null;
    for (const key of keys) {
        if (typeof object[key] === "string" && object[key]) return object[key] as string;
    }
    return null;
}

function formatMoney(value: number | null | undefined) {
    return typeof value === "number" && Number.isFinite(value) ? moneyFormatter.format(value) : "—";
}

function formatPercent(value: number | null | undefined) {
    return typeof value === "number" && Number.isFinite(value) ? `${value.toFixed(1)}%` : "—";
}

function formatRatio(value: number | null | undefined) {
    return typeof value === "number" && Number.isFinite(value) ? value.toFixed(2) : "—";
}

function metricTone(value: number | null | undefined) {
    if (typeof value !== "number" || !Number.isFinite(value) || value === 0) return "text-zinc-300";
    return value > 0 ? "text-emerald-400" : "text-rose-400";
}

function confidenceLabel(confidence: EdgeGroup["confidence"]) {
    switch (confidence) {
        case "high": return "Higher sample confidence";
        case "medium": return "Medium sample confidence";
        case "initial": return "Initial sample";
        default: return "Insufficient sample";
    }
}

function coverageValue(dataQuality: unknown, keys: string[]) {
    const raw = firstNumber(dataQuality, keys);
    if (raw === null) return null;
    return Math.min(100, Math.max(0, raw));
}

function qualityLimitations(dataQuality: unknown) {
    const object = asRecord(dataQuality);
    if (!object) return [];
    const candidates = [object.limitations, object.warnings, object.notes];
    return candidates.flatMap(value => Array.isArray(value) ? value : [])
        .filter((value): value is string => typeof value === "string");
}

function MetricCard({ label, value, detail }: { label: string; value: string; detail?: string }) {
    return (
        <Card className="gap-3 border-gray-700 bg-gray-800 py-4 text-white">
            <CardContent className="px-5">
                <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">{label}</p>
                <p className="mt-2 text-2xl font-black tracking-tight text-white">{value}</p>
                {detail && <p className="mt-1 text-xs text-zinc-500">{detail}</p>}
            </CardContent>
        </Card>
    );
}

function InsightCard({ group, tone }: { group: EdgeGroup; tone: "edge" | "leak" }) {
    const positive = tone === "edge";
    return (
        <div className={cn(
            "rounded-xl border p-4",
            positive ? "border-emerald-500/25 bg-emerald-500/[0.06]" : "border-rose-500/25 bg-rose-500/[0.06]",
        )}>
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{group.dimensionLabel}</p>
                    <h4 className="mt-1 truncate font-bold text-white" title={group.label}>{group.label}</h4>
                </div>
                <Badge className={cn(
                    "border text-[10px]",
                    positive
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                        : "border-rose-500/30 bg-rose-500/10 text-rose-300",
                )}>
                    {positive ? "Observed Edge" : "Historical Leak"}
                </Badge>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
                <div>
                    <p className="text-[10px] uppercase text-zinc-500">Expectancy</p>
                    <p className={cn("font-mono font-bold", metricTone(group.metrics.expectancy))}>
                        {formatMoney(group.metrics.expectancy)}
                    </p>
                </div>
                <div>
                    <p className="text-[10px] uppercase text-zinc-500">Profit factor</p>
                    <p className="font-mono font-bold text-zinc-200">{formatRatio(group.metrics.profitFactor)}</p>
                </div>
                <div>
                    <p className="text-[10px] uppercase text-zinc-500">Sample</p>
                    <p className="font-mono font-bold text-zinc-200">{group.metrics.sampleSize}</p>
                </div>
            </div>
            <p className="mt-3 text-[11px] text-zinc-500">
                {confidenceLabel(group.confidence)} · {group.metrics.tradeDayCount} trading days · expectancy delta {formatMoney(group.metrics.expectancyDelta)}
            </p>
        </div>
    );
}

function GroupTable({ groups }: { groups: EdgeGroup[] }) {
    return (
        <Table className="min-w-[1280px]">
            <TableHeader className="bg-gray-900/80 text-[10px] uppercase tracking-wider text-zinc-500">
                <TableRow className="border-gray-700 hover:bg-gray-900/80">
                    <TableHead className="pl-4 text-zinc-400">Group</TableHead>
                    <TableHead className="text-right text-zinc-400">N / Days</TableHead>
                    <TableHead className="text-right text-zinc-400">Net P&amp;L</TableHead>
                    <TableHead className="text-right text-zinc-400">Expectancy</TableHead>
                    <TableHead className="text-right text-zinc-400">vs Overall</TableHead>
                    <TableHead className="text-right text-zinc-400">W / L / S</TableHead>
                    <TableHead className="text-right text-zinc-400">Avg Win</TableHead>
                    <TableHead className="text-right text-zinc-400">Avg Loss</TableHead>
                    <TableHead className="text-right text-zinc-400">Win Rate</TableHead>
                    <TableHead className="text-right text-zinc-400">Payoff</TableHead>
                    <TableHead className="text-right text-zinc-400">PF</TableHead>
                    <TableHead className="text-right text-zinc-400">Median</TableHead>
                    <TableHead className="pr-4 text-right text-zinc-400">Evidence</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {groups.map(group => (
                    <TableRow key={group.id} className="border-gray-700/60 hover:bg-white/[0.03]">
                        <TableCell className="max-w-[280px] whitespace-normal pl-4">
                            <div className="flex items-center gap-2">
                                <span className="font-semibold text-white">{group.label}</span>
                                {group.outlierSensitive && (
                                    <span title="The direction flips after removing the largest absolute P&L trade.">
                                        <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                                    </span>
                                )}
                            </div>
                        </TableCell>
                        <TableCell className="text-right font-mono text-zinc-300">
                            {group.metrics.sampleSize} / {group.metrics.tradeDayCount}
                        </TableCell>
                        <TableCell className={cn("text-right font-mono", metricTone(group.metrics.netPl))}>
                            {formatMoney(group.metrics.netPl)}
                        </TableCell>
                        <TableCell className={cn("text-right font-mono", metricTone(group.metrics.expectancy))}>
                            {formatMoney(group.metrics.expectancy)}
                        </TableCell>
                        <TableCell className={cn("text-right font-mono", metricTone(group.metrics.expectancyDelta))}>
                            {formatMoney(group.metrics.expectancyDelta)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-zinc-300">
                            {group.metrics.winners} / {group.metrics.losers} / {group.metrics.scratches}
                        </TableCell>
                        <TableCell className="text-right font-mono text-emerald-400">
                            {formatMoney(group.metrics.avgWin)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-rose-400">
                            {formatMoney(group.metrics.avgLoss)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-zinc-300">{formatPercent(group.metrics.winRate)}</TableCell>
                        <TableCell className="text-right font-mono text-zinc-300">{formatRatio(group.metrics.payoff)}</TableCell>
                        <TableCell className="text-right font-mono text-zinc-300">{formatRatio(group.metrics.profitFactor)}</TableCell>
                        <TableCell className={cn("text-right font-mono", metricTone(group.metrics.medianPl))}>
                            {formatMoney(group.metrics.medianPl)}
                        </TableCell>
                        <TableCell className="pr-4 text-right">
                            <Badge className={cn(
                                "border bg-transparent text-[10px]",
                                group.eligible ? "border-sky-500/30 text-sky-300" : "border-gray-700 text-zinc-500",
                            )}>
                                {confidenceLabel(group.confidence)}
                            </Badge>
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
}

interface SummaryItem {
    title: string | null;
    detail: string;
}

function sessionSummary(session: unknown) {
    const object = asRecord(session);
    if (!object) return null;
    const raw = object.summary ?? object.structuredSummary ?? object.analysis;
    if (typeof raw !== "string") return raw;
    try {
        return JSON.parse(raw) as unknown;
    } catch {
        return { actions: [raw] };
    }
}

function summaryItems(summary: unknown, key: string): SummaryItem[] {
    const object = asRecord(summary);
    const values = object && Array.isArray(object[key]) ? object[key] as unknown[] : [];
    return values.flatMap(value => {
        if (typeof value === "string") return [{ title: null, detail: value }];
        const item = asRecord(value);
        if (!item) return [];
        const title = firstString(item, ["title", "name", "headline"]);
        const detail = firstString(item, ["detail", "description", "text", "reasoning", "recommendation"])
            ?? (title ? "" : JSON.stringify(item));
        const evidence = Array.isArray(item.evidence)
            ? item.evidence.filter((entry): entry is string => typeof entry === "string").join(" · ")
            : "";
        return [{ title, detail: [detail, evidence].filter(Boolean).join(" — ") }];
    });
}

function SummarySection({ title, items, tone }: { title: string; items: SummaryItem[]; tone: "good" | "bad" | "neutral" }) {
    const colors = tone === "good"
        ? "border-emerald-500/20 bg-emerald-500/[0.05]"
        : tone === "bad"
            ? "border-rose-500/20 bg-rose-500/[0.05]"
            : "border-sky-500/20 bg-sky-500/[0.05]";
    return (
        <div className={cn("rounded-xl border p-4", colors)}>
            <h4 className="text-xs font-black uppercase tracking-widest text-zinc-300">{title}</h4>
            {items.length ? (
                <div className="mt-3 space-y-3">
                    {items.map((item, index) => (
                        <div key={`${item.title}-${index}`} className="text-sm leading-relaxed text-zinc-300">
                            {item.title && <p className="font-bold text-white">{item.title}</p>}
                            {item.detail && <p>{item.detail}</p>}
                        </div>
                    ))}
                </div>
            ) : (
                <p className="mt-3 text-sm text-zinc-500">None reported.</p>
            )}
        </div>
    );
}

export function EdgeAnalysisTab({ scope, active }: EdgeAnalysisTabProps) {
 const client = useJournal();
 const { deleteEdgeAnalysisSession, generateEdgeAnalysisSummary, getEdgeAnalysisModels, getEdgeAnalysisSession, listEdgeAnalysisSessions } = client;
    const [debouncedSymbol, setDebouncedSymbol] = useState(scope.symbol);
    const [analysis, setAnalysis] = useState<EdgeAnalysisResponse | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [reloadToken, setReloadToken] = useState(0);
    const cacheRef = useRef(new Map<string, EdgeAnalysisResponse>());

    const [models, setModels] = useState<EdgeModel[]>([]);
    const [selectedModel, setSelectedModel] = useState("");
    const [modelsLoading, setModelsLoading] = useState(true);
    const [historyItems, setHistoryItems] = useState<unknown[]>([]);
    const [historyLoading, setHistoryLoading] = useState(true);
    const [selectedSession, setSelectedSession] = useState<unknown>(null);
    const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
    const [sessionLoadingId, setSessionLoadingId] = useState<string | null>(null);
    const [aiLoading, setAiLoading] = useState(false);
    const [aiError, setAiError] = useState<string | null>(null);
    const [wasCached, setWasCached] = useState(false);

    useEffect(() => {
        const timeout = window.setTimeout(() => setDebouncedSymbol(scope.symbol), 250);
        return () => window.clearTimeout(timeout);
    }, [scope.symbol]);

    const requestScope = useMemo<EdgeAnalysisScope>(() => ({
        from: scope.from,
        to: scope.to,
        symbol: debouncedSymbol?.trim() || null,
        tag: scope.tag,
        label: scope.label,
    }), [debouncedSymbol, scope.from, scope.label, scope.tag, scope.to]);

    const requestKey = useMemo(() => JSON.stringify(requestScope), [requestScope]);

    useEffect(() => {
        if (!active) return;

        const controller = new AbortController();
        const cached = cacheRef.current.get(requestKey);

        setAiError(null);
        setSelectedSession(null);
        setSelectedSessionId(null);

        if (cached) {
            setAnalysis(cached);
            setLoadError(null);
            setIsLoading(false);
            return () => controller.abort();
        }

        setAnalysis(null);
        setIsLoading(true);
        setLoadError(null);

        const params = new URLSearchParams();
        if (requestScope.from) params.set("from", requestScope.from);
        if (requestScope.to) params.set("to", requestScope.to);
        if (requestScope.symbol) params.set("symbol", requestScope.symbol);
        if (requestScope.tag) params.set("tag", requestScope.tag);
        if (requestScope.label) params.set("label", requestScope.label);

        void (async () => {
            try {
                const response = await client.getEdgeAnalysis(params, controller.signal);
                const payload = await response.json().catch(() => null) as unknown;
                if (!response.ok) {
                    throw new Error(firstString(payload, ["error", "message"]) ?? `Analysis request failed (${response.status}).`);
                }
                const envelope = asRecord(payload);
                const next = (envelope?.analysis ?? payload) as EdgeAnalysisResponse;
                if (!next || !next.baseline || !Array.isArray(next.dimensionGroups) || !Array.isArray(next.pairGroups)) {
                    throw new Error("The analysis service returned an invalid response.");
                }
                cacheRef.current.set(requestKey, next);
                setAnalysis(next);
            } catch (error) {
                if (error instanceof DOMException && error.name === "AbortError") return;
                setLoadError(error instanceof Error ? error.message : "Unable to load Edge Analysis.");
            } finally {
                if (!controller.signal.aborted) setIsLoading(false);
            }
        })();

        return () => controller.abort();
    }, [active, reloadToken, requestKey, requestScope]);

    const loadHistory = useCallback(async () => {
        setHistoryLoading(true);
        try {
            const result = await listEdgeAnalysisSessions();
            if (result.success) setHistoryItems(result.sessions ?? []);
        } finally {
            setHistoryLoading(false);
        }
    }, []);

    useEffect(() => {
        let active = true;
        void (async () => {
            try {
                const result = await getEdgeAnalysisModels();
                if (!active) return;
                if (result.success && result.models) {
                    const nextModels = result.models as EdgeModel[];
                    setModels(nextModels);
                    const preferred = nextModels.find(model => model.isDefault);
                    setSelectedModel(current => nextModels.some(model => model.id === current)
                        ? current
                        : preferred?.id ?? "");
                }
            } finally {
                if (active) setModelsLoading(false);
            }
        })();
        void loadHistory();
        return () => { active = false; };
    }, [loadHistory]);

    const refreshAnalysis = () => {
        cacheRef.current.delete(requestKey);
        setReloadToken(value => value + 1);
    };

    const generateSummary = async (force: boolean) => {
        if (!analysis || !selectedModel) return;
        setAiLoading(true);
        setAiError(null);
        try {
            const result = await generateEdgeAnalysisSummary({
                scope: analysis.scope,
                connectionId: selectedModel,
                force,
            });
            if (!result.success || !result.session) {
                throw new Error(result.error ?? "AI summary could not be generated.");
            }
            setSelectedSession(result.session);
            setSelectedSessionId(firstString(result.session, ["id"]));
            setWasCached(Boolean(result.cached));
            await loadHistory();
        } catch (error) {
            setAiError(error instanceof Error ? error.message : "AI summary could not be generated.");
        } finally {
            setAiLoading(false);
        }
    };

    const openSession = async (id: string) => {
        setSessionLoadingId(id);
        setAiError(null);
        try {
            const result = await getEdgeAnalysisSession(id);
            if (!result.success || !result.session) throw new Error(result.error ?? "Session not found.");
            setSelectedSession(result.session);
            setSelectedSessionId(id);
            setWasCached(false);
        } catch (error) {
            setAiError(error instanceof Error ? error.message : "Unable to open this session.");
        } finally {
            setSessionLoadingId(null);
        }
    };

    const removeSession = async (id: string) => {
        if (!window.confirm("Delete this Edge Analysis summary?")) return;
        const result = await deleteEdgeAnalysisSession(id);
        if (!result.success) {
            setAiError(result.error ?? "Unable to delete this session.");
            return;
        }
        setHistoryItems(items => items.filter(item => firstString(item, ["id"]) !== id));
        if (selectedSessionId === id) {
            setSelectedSession(null);
            setSelectedSessionId(null);
        }
    };

    if (isLoading && !analysis) {
        return (
            <div className="flex min-h-[420px] flex-col items-center justify-center rounded-2xl border border-gray-700/60 bg-gray-800/30">
                <Loader2 className="h-9 w-9 animate-spin text-cyan-400" />
                <p className="mt-4 font-semibold text-zinc-300">Analyzing real trade history…</p>
                <p className="mt-1 text-xs text-zinc-500">Aggregating the selected scope using actual trading records.</p>
            </div>
        );
    }

    if (loadError || !analysis) {
        return (
            <div className="flex min-h-[360px] flex-col items-center justify-center rounded-2xl border border-rose-500/20 bg-rose-500/[0.04] p-8 text-center">
                <AlertTriangle className="h-10 w-10 text-rose-400" />
                <h3 className="mt-4 text-lg font-bold text-white">Edge Analysis is unavailable</h3>
                <p className="mt-2 max-w-xl text-sm text-rose-200/70">{loadError ?? "No analysis was returned."}</p>
                <Button onClick={refreshAnalysis} className="mt-5 bg-rose-600 text-white hover:bg-rose-500">
                    <RefreshCw className="mr-2 h-4 w-4" /> Try again
                </Button>
            </div>
        );
    }

    const tagCoverage = coverageValue(analysis.dataQuality, ["tagCoveragePct", "tagCoveragePercent", "tagCoverage"]);
    const executionCoverage = coverageValue(analysis.dataQuality, ["executionCoveragePct", "executionCoveragePercent", "executionCoverage"]);
    const dynamicLimitations = qualityLimitations(analysis.dataQuality);
    const summary = sessionSummary(selectedSession);
    const summaryStrengths = summaryItems(summary, "strengths");
    const summaryLeaks = summaryItems(summary, "leaks");
    const summaryActions = summaryItems(summary, "actions");
    const summaryLimitations = summaryItems(summary, "limitations");

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex flex-col gap-4 rounded-2xl border border-cyan-500/20 bg-gradient-to-r from-cyan-500/[0.08] via-gray-900 to-emerald-500/[0.06] p-6 lg:flex-row lg:items-center lg:justify-between">
                <div>
                    <div className="flex items-center gap-2">
                        <Target className="h-5 w-5 text-cyan-400" />
                        <h2 className="text-xl font-black tracking-tight text-white">Observed Edge Analysis</h2>
                    </div>
                    <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-400">
                        Historical associations in your real Trade P&amp;L, tags, and executions. These results describe past patterns and do not guarantee future performance.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                        <Badge className="border border-cyan-500/20 bg-cyan-500/10 text-cyan-200">{analysis.scope.label}</Badge>
                        {analysis.scope.symbol && <Badge className="border border-gray-700 bg-gray-800 text-zinc-300">Symbol: {analysis.scope.symbol}</Badge>}
                        {analysis.scope.tag && <Badge className="border border-gray-700 bg-gray-800 text-zinc-300">Tag: {analysis.scope.tag}</Badge>}
                        <Badge className="border border-emerald-500/20 bg-emerald-500/10 text-emerald-200">Actual trading records</Badge>
                    </div>
                </div>
                <Button variant="outline" onClick={refreshAnalysis} disabled={isLoading} className="border-gray-700 bg-gray-800 text-zinc-200 hover:bg-gray-700 hover:text-white">
                    <RefreshCw className={cn("mr-2 h-4 w-4", isLoading && "animate-spin")} /> Refresh data
                </Button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                <MetricCard label="Period" value={analysis.scope.label} detail={analysis.scope.from && analysis.scope.to ? `${analysis.scope.from} — ${analysis.scope.to}` : "Complete available history"} />
                <MetricCard label="Trades" value={analysis.baseline.sampleSize.toLocaleString()} detail="Symbol × trading-day records" />
                <MetricCard label="Trading Days" value={analysis.baseline.tradeDayCount.toLocaleString()} />
                <MetricCard label="Tag Coverage" value={tagCoverage === null ? "—" : `${tagCoverage.toFixed(1)}%`} detail="Trades with at least one user tag" />
                <MetricCard label="Execution Coverage" value={executionCoverage === null ? "—" : `${executionCoverage.toFixed(1)}%`} detail="Trades with execution data" />
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
                <Card className="border-emerald-500/20 bg-gray-800/70 text-white">
                    <CardHeader className="border-b border-gray-700/60">
                        <CardTitle className="flex items-center gap-2 text-base"><TrendingUp className="h-5 w-5 text-emerald-400" /> Top Historical Strengths</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {analysis.topEdges.length
                            ? analysis.topEdges.slice(0, 3).map(group => <InsightCard key={group.id} group={group} tone="edge" />)
                            : <p className="py-8 text-center text-sm text-zinc-500">No group meets the evidence threshold for a positive Observed Edge in this scope.</p>}
                    </CardContent>
                </Card>
                <Card className="border-rose-500/20 bg-gray-800/70 text-white">
                    <CardHeader className="border-b border-gray-700/60">
                        <CardTitle className="flex items-center gap-2 text-base"><TrendingDown className="h-5 w-5 text-rose-400" /> Top Historical Weaknesses</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {analysis.topLeaks.length
                            ? analysis.topLeaks.slice(0, 3).map(group => <InsightCard key={group.id} group={group} tone="leak" />)
                            : <p className="py-8 text-center text-sm text-zinc-500">No group meets the evidence threshold for a negative historical association in this scope.</p>}
                    </CardContent>
                </Card>
            </div>

            <Card className="border-sky-500/20 bg-gray-800/70 text-white">
                <CardHeader className="border-b border-gray-700/60">
                    <CardTitle className="flex items-center gap-2 text-base"><CheckCircle2 className="h-5 w-5 text-sky-400" /> Evidence-based Improvement Actions</CardTitle>
                </CardHeader>
                <CardContent>
                    {analysis.actions.length ? (
                        <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
                            {analysis.actions.map(action => (
                                <div key={action.id} className="rounded-xl border border-gray-700 bg-gray-900/60 p-4">
                                    <Badge className={cn(
                                        "mb-3 border text-[10px] uppercase",
                                        action.kind === "reinforce"
                                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                                            : "border-rose-500/30 bg-rose-500/10 text-rose-300",
                                    )}>{action.kind}</Badge>
                                    <h4 className="font-bold text-white">{action.title}</h4>
                                    <p className="mt-2 text-sm leading-relaxed text-zinc-400">{action.detail}</p>
                                    {action.evidence.length > 0 && (
                                        <ul className="mt-3 space-y-1 text-xs text-zinc-500">
                                            {action.evidence.map((item, index) => <li key={index}>• {item}</li>)}
                                        </ul>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="py-6 text-center text-sm text-zinc-500">More eligible samples are needed before generating improvement actions.</p>
                    )}
                </CardContent>
            </Card>

            <div className="space-y-5">
                <div>
                    <h3 className="text-lg font-black text-white">Single-feature breakdowns</h3>
                    <p className="mt-1 text-sm text-zinc-500">Each group is evaluated independently. Tag groups can overlap and should not be added together.</p>
                </div>
                {analysis.dimensionGroups.map(collection => (
                    <Card key={collection.key} className="gap-0 overflow-hidden border-gray-700 bg-gray-800/70 py-0 text-white">
                        <CardHeader className="border-b border-gray-700/60 py-5">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                    <CardTitle className="text-base">{collection.label}</CardTitle>
                                    <p className="mt-1 text-xs text-zinc-500">{collection.description}</p>
                                </div>
                                <Badge className="border border-gray-700 bg-gray-900 text-zinc-400">
                                    {collection.mutuallyExclusive ? "Mutually exclusive" : "Overlapping groups"}
                                </Badge>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0"><GroupTable groups={collection.groups} /></CardContent>
                    </Card>
                ))}
            </div>

            <div className="space-y-5">
                <div>
                    <h3 className="text-lg font-black text-white">Exploratory two-feature combinations</h3>
                    <p className="mt-1 text-sm text-zinc-500">Only approved pairs are tested. A pair must also improve on or underperform both parent groups to become a conclusion.</p>
                </div>
                {analysis.pairGroups.map(collection => (
                    <Card key={collection.key} className="gap-0 overflow-hidden border-gray-700 bg-gray-800/70 py-0 text-white">
                        <CardHeader className="border-b border-gray-700/60 py-5">
                            <CardTitle className="text-base">{collection.label}</CardTitle>
                            <p className="text-xs text-zinc-500">{collection.description}</p>
                        </CardHeader>
                        <CardContent className="p-0"><GroupTable groups={collection.groups} /></CardContent>
                    </Card>
                ))}
            </div>

            <Card className="border-indigo-500/20 bg-gray-800/70 text-white">
                <CardHeader className="border-b border-gray-700/60">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2 text-base"><BrainCircuit className="h-5 w-5 text-indigo-400" /> AI Edge Summary</CardTitle>
                            <p className="mt-2 text-xs text-zinc-500">Generated only when requested. The model receives aggregated evidence, coverage, and limitations—not raw executions or notes.</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <Select value={selectedModel} onValueChange={setSelectedModel} disabled={modelsLoading || models.length === 0}>
                                <SelectTrigger className="w-[240px] border-gray-700 bg-gray-900 text-white"><SelectValue placeholder={modelsLoading ? "Loading connections…" : "Select a connection"} /></SelectTrigger>
                                <SelectContent className="border-gray-700 bg-gray-800 text-white">
                                    {models.map(model => <SelectItem key={model.id} value={model.id}>{model.name}{model.isDefault ? " · Default" : ""}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <Button onClick={() => generateSummary(false)} disabled={aiLoading || !selectedModel} className="bg-indigo-600 text-white hover:bg-indigo-500">
                                {aiLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                                {selectedSession ? "Use cache / Generate" : "Generate Summary"}
                            </Button>
                            {selectedSession !== null && (
                                <Button variant="outline" onClick={() => generateSummary(true)} disabled={aiLoading || !selectedModel} className="border-gray-700 bg-gray-900 text-zinc-200 hover:bg-gray-700 hover:text-white">
                                    <RefreshCw className="mr-2 h-4 w-4" /> Refresh
                                </Button>
                            )}
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {aiError && (
                        <div className="mb-5 rounded-lg border border-rose-500/20 bg-rose-500/[0.06] p-4 text-sm text-rose-300">
                            <AlertTriangle className="mr-2 inline h-4 w-4" />{aiError}
                            <p className="mt-1 pl-6 text-xs text-zinc-500">The deterministic analysis above remains available.</p>
                        </div>
                    )}
                    {!modelsLoading && models.length === 0 && (
                        <div className="mb-5 rounded-lg border border-amber-500/20 bg-amber-500/[0.05] p-4 text-sm text-amber-200">No LLM model is configured. Add one in AI Coach model settings to enable summaries.</div>
                    )}
                    <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
                        <div>
                            {selectedSession ? (
                                <div className="space-y-4">
                                    <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                                        <Badge className="border border-indigo-500/30 bg-indigo-500/10 text-indigo-300">Structured summary</Badge>
                                        {wasCached && <Badge className="border border-gray-700 bg-gray-900 text-zinc-400">Reused matching cache</Badge>}
                                        {firstString(selectedSession, ["modelName", "modelId", "model"]) && <span>{firstString(selectedSession, ["modelName", "modelId", "model"])}</span>}
                                    </div>
                                    <div className="grid gap-4 md:grid-cols-2">
                                        <SummarySection title="Strengths" items={summaryStrengths} tone="good" />
                                        <SummarySection title="Leaks" items={summaryLeaks} tone="bad" />
                                        <SummarySection title="Actions" items={summaryActions} tone="neutral" />
                                        <SummarySection title="Limitations" items={summaryLimitations} tone="neutral" />
                                    </div>
                                </div>
                            ) : (
                                <div className="flex min-h-[280px] flex-col items-center justify-center rounded-xl border border-dashed border-gray-700 bg-gray-900/30 p-8 text-center">
                                    <Sparkles className="h-9 w-9 text-indigo-500/50" />
                                    <h4 className="mt-4 font-bold text-white">Deterministic analysis is ready</h4>
                                    <p className="mt-2 max-w-md text-sm text-zinc-500">Choose a model and generate an optional summary, or open a prior session from history.</p>
                                </div>
                            )}
                        </div>
                        <div className="rounded-xl border border-gray-700 bg-gray-900/50">
                            <div className="flex items-center gap-2 border-b border-gray-700 px-4 py-3 text-sm font-bold text-white"><History className="h-4 w-4 text-indigo-400" /> Independent History</div>
                            <div className="max-h-[420px] space-y-2 overflow-y-auto p-3">
                                {historyLoading && <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-indigo-400" /></div>}
                                {!historyLoading && historyItems.length === 0 && <p className="py-10 text-center text-sm text-zinc-600">No Edge summary history yet.</p>}
                                {historyItems.map((item, index) => {
                                    const id = firstString(item, ["id"]);
                                    if (!id) return null;
                                    const createdAt = firstString(item, ["createdAt"]);
                                    const itemScope = asRecord(asRecord(item)?.scope);
                                    const label = firstString(item, ["scopeLabel"]) ?? firstString(itemScope, ["label"]) ?? "Saved scope";
                                    const model = firstString(item, ["modelName", "modelId", "model"]);
                                    return (
                                        <div key={`${id}-${index}`} className={cn("rounded-lg border p-3", selectedSessionId === id ? "border-indigo-500/40 bg-indigo-500/10" : "border-gray-700/70 bg-gray-800/60")}>
                                            <button type="button" onClick={() => openSession(id)} className="w-full text-left">
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="min-w-0">
                                                        <p className="truncate text-sm font-semibold text-zinc-200">{label}</p>
                                                        <p className="mt-1 truncate text-[10px] text-zinc-500">{createdAt ? new Date(createdAt).toLocaleString() : ""}{model ? ` · ${model}` : ""}</p>
                                                    </div>
                                                    {sessionLoadingId === id && <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />}
                                                </div>
                                            </button>
                                            <button type="button" onClick={() => removeSession(id)} className="mt-2 flex items-center gap-1 text-[10px] text-zinc-600 transition-colors hover:text-rose-400"><Trash2 className="h-3 w-3" /> Delete</button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card className="border-amber-500/15 bg-amber-500/[0.035] text-white">
                <CardContent className="flex gap-4">
                    <Database className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
                    <div>
                        <h3 className="text-sm font-bold text-amber-100">Data interpretation limits</h3>
                        <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-zinc-400">
                            {dynamicLimitations.map((item, index) => <li key={index}>• {item}</li>)}
                            <li>• Results are historical associations, not causal claims or future guarantees.</li>
                            <li>• A Trade is a Symbol × Day execution collection; “execution window” is not strict holding time.</li>
                            <li>• MAE/MFE, fees, market cap, float, Gap%, RVOL, and external market data are not analyzed.</li>
                            <li>• Execution notional is descriptive and is not presented as risk-adjusted return.</li>
                        </ul>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
