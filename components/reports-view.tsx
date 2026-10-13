"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatsGrid } from "./stats-grid";
import { DailyPerformance } from "./daily-performance";
import { DrawdownAnalysis } from "./drawdown-analysis";
import { calculateStats, Trade } from "@/lib/stats";
import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Search, Target, X } from "lucide-react";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MarketChartPanel } from "./market-chart-panel";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePickerWithRange } from "./date-range-picker";
import { PERIOD_LABELS, PeriodSelector, type PeriodValue } from "./period-selector";
import type { DateRange } from "react-day-picker";
import { AICoachTab } from "./ai-coach-tab";
import { SpyPerformanceChart } from "./spy-performance-chart";
import { SpyGapChart } from "./spy-gap-chart";
import { lazyClient as dynamic } from "@/components/journal-runtime";
import { format } from "date-fns";
import type { EdgeAnalysisScope } from "@/lib/edge-analysis-types";

interface ReportTag {
    name: string;
}

interface ReportExecution {
    time: Date | string | number;
    side: string;
    price: number;
    quantity: number;
}


interface ReportTrade {
    id: string;
    symbol: string;
    date: Date | string;
    status: string;
    direction: string;
    netPl: number;
    grossPl: number;
    volume: number;
    fee: number;
    commission?: number;
    duration?: number;
    mae?: number;
    mfe?: number;
    tags: ReportTag[];
    executions: ReportExecution[];
}

const EdgeAnalysisTab = dynamic<{ scope: EdgeAnalysisScope; active: boolean }>(
    () => import("./edge-analysis-tab").then(module => ({ default: module.EdgeAnalysisTab })),
    {
        loading: () => (
            <div className="flex min-h-[360px] items-center justify-center rounded-2xl border border-gray-700/60 bg-gray-800/30 text-sm text-zinc-500">
                Loading Edge Analysis…
            </div>
        ),
    },
);

export function ReportsView({ trades }: { trades: ReportTrade[] }) {

    const [symbolFilter, setSymbolFilter] = useState("");
    const [tagFilter, setTagFilter] = useState("all");
    const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
    const [period, setPeriod] = useState<PeriodValue>("all");
    const [activeTab, setActiveTab] = useState("overview");
    const [edgeOpened, setEdgeOpened] = useState(false);
    const [selectedTradeForChart, setSelectedTradeForChart] = useState<ReportTrade | null>(null);


    const availableTags = useMemo(() => {
        const uniqueTags = new Set<string>();
        trades.forEach(t => t.tags?.forEach(tag => uniqueTags.add(tag.name)));
        return Array.from(uniqueTags).sort();
    }, [trades]);


    const filteredTrades = useMemo(() => {
        // ... (existing filtering logic)
        let filtered = trades;

        if (symbolFilter) {
            filtered = filtered.filter(t =>
                t.symbol.toLowerCase().includes(symbolFilter.toLowerCase())
            );
        }

        if (tagFilter && tagFilter !== "all") {
            filtered = filtered.filter(t => t.tags?.some(tag => tag.name === tagFilter));
        }

        if (dateRange?.from) {
            filtered = filtered.filter(t => {
                const tradeDate = new Date(t.date).getTime();
                const fromDate = dateRange.from!.getTime();
                const toDate = dateRange.to ? dateRange.to.getTime() + 86400000 : fromDate + 86400000; // inclusive to end of day if to exists, else same day
                return tradeDate >= fromDate && tradeDate < toDate;
            });
        }

        return filtered;
    }, [trades, symbolFilter, tagFilter, dateRange]);

    const stats = calculateStats(filteredTrades as Trade[]);

    const edgeScope = useMemo<EdgeAnalysisScope>(() => ({
        from: dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : null,
        to: dateRange?.to
            ? format(dateRange.to, "yyyy-MM-dd")
            : dateRange?.from
                ? format(dateRange.from, "yyyy-MM-dd")
                : null,
        symbol: symbolFilter.trim() || null,
        tag: tagFilter !== "all" ? tagFilter : null,
        label: PERIOD_LABELS[period],
    }), [dateRange, period, symbolFilter, tagFilter]);

    const handleTabChange = (value: string) => {
        setActiveTab(value);
        if (value === "edge-analysis") setEdgeOpened(true);
    };

    return (
        <div className="space-y-6 text-white pb-20">
            {/* Top Actions */}
            <div className="flex items-center justify-between gap-4">
                <div className="flex flex-1 flex-wrap gap-4">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                        <Input
                            placeholder="Search Symbol..."
                            value={symbolFilter}
                            onChange={(e) => setSymbolFilter(e.target.value)}
                            className="pl-9 bg-gray-800 border-gray-700 text-white placeholder:text-zinc-500 focus:ring-emerald-500"
                        />
                    </div>
                    <div className="w-48">
                        <Select value={tagFilter} onValueChange={setTagFilter}>
                            <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                                <SelectValue placeholder="Filter by Tag" />
                            </SelectTrigger>
                            <SelectContent className="bg-gray-800 border-gray-700 text-white">
                                <SelectItem value="all">All Tags</SelectItem>
                                {availableTags.map(tag => (
                                    <SelectItem key={tag} value={tag}>{tag}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <DatePickerWithRange
                            date={dateRange}
                            setDate={(range) => {
                                setDateRange(range);
                                setPeriod(range ? "custom" : "all");
                            }}
                        />
                    </div>
                    <div>
                        <PeriodSelector
                            value={period}
                            onValueChange={setPeriod}
                            onSelect={setDateRange}
                        />
                    </div>
                    {(symbolFilter || (tagFilter && tagFilter !== "all") || dateRange) && (
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                                setSymbolFilter("");
                                setTagFilter("all");
                                setDateRange(undefined);
                                setPeriod("all");
                            }}
                            className="h-10 w-10 text-zinc-400 hover:text-white hover:bg-gray-800 border border-transparent hover:border-gray-700"
                            title="Clear All Filters"
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    )}
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full space-y-6">
                <TabsList className="h-auto max-w-full flex-wrap bg-gray-800/50 p-1 border border-gray-700/50 text-white">
                    <TabsTrigger value="overview" className="px-6 data-[state=active]:bg-gray-700 data-[state=active]:text-white font-bold transition-all text-zinc-100">Overview</TabsTrigger>
                    <TabsTrigger value="daily" className="px-6 data-[state=active]:bg-gray-700 data-[state=active]:text-white font-bold transition-all text-zinc-100">Win/Loss Days</TabsTrigger>
                    <TabsTrigger value="drawdown" className="px-6 data-[state=active]:bg-gray-700 data-[state=active]:text-white font-bold transition-all text-zinc-100">Drawdown Analysis</TabsTrigger>
                    <TabsTrigger value="edge-analysis" className="px-6 data-[state=active]:bg-cyan-600 data-[state=active]:text-white font-bold transition-all text-cyan-200 hover:text-white">
                        <Target className="h-4 w-4" /> Edge Analysis
                    </TabsTrigger>
                    <TabsTrigger value="ai-coach" className="px-6 data-[state=active]:bg-indigo-600 data-[state=active]:text-white font-bold transition-all text-indigo-200 hover:text-white">AI Coach</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-6">
                    <StatsGrid stats={stats} />
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <SpyPerformanceChart trades={filteredTrades} />
                        <SpyGapChart trades={filteredTrades} />
                    </div>

                    {/* Basic Trade History */}
                    <Card className="bg-gray-800 border-gray-700 text-white shadow-2xl">
                        <CardHeader className="border-b border-gray-700/50">
                            <CardTitle className="text-white">Trade History</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="relative w-full overflow-auto max-h-[600px] scrollbar-hide">
                                <table className="w-full caption-bottom text-sm text-left">
                                    <thead className="[&_tr]:border-b [&_tr]:border-gray-700 sticky top-0 bg-gray-900 z-10">
                                        <tr className="border-b border-gray-700">
                                            <th className="h-12 px-6 text-white font-black uppercase tracking-tighter text-[11px]">Date</th>
                                            <th className="h-12 px-4 text-white font-black uppercase tracking-tighter text-[11px]">Symbol</th>
                                            <th className="h-12 px-4 text-white font-black uppercase tracking-tighter text-[11px]">Status</th>
                                            <th className="h-12 px-4 text-white font-black uppercase tracking-tighter text-[11px]">Side</th>
                                            <th className="h-12 px-4 text-white font-black uppercase tracking-tighter text-[11px] text-right">Entry Price</th>
                                            <th className="h-12 px-4 text-white font-black uppercase tracking-tighter text-[11px] text-right">Exit Price</th>
                                            <th className="h-12 px-4 text-white font-black uppercase tracking-tighter text-[11px] text-right">Volume</th>
                                            <th className="h-12 px-6 text-white font-black uppercase tracking-tighter text-[11px] text-right">Net P&L</th>
                                        </tr>
                                    </thead>
                                    <tbody className="[&_tr:last-child]:border-0">
                                        {filteredTrades.length === 0 && (
                                            <tr>
                                                <td colSpan={8} className="h-24 text-center text-zinc-500 italic">
                                                    No trades found for this filter.
                                                </td>
                                            </tr>
                                        )}
                                        {filteredTrades.map((trade) => {
                                            const sortedExecs = [...(trade.executions || [])].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
                                            const entryPrice = sortedExecs.length > 0 ? sortedExecs[0].price : 0;
                                            const exitPrice = sortedExecs.length > 1 ? sortedExecs[sortedExecs.length - 1].price : (sortedExecs.length === 1 ? sortedExecs[0].price : 0);

                                            return (
                                                <tr key={trade.id} className="border-b transition-colors hover:bg-emerald-500/5 group border-gray-700/50">
                                                    <td
                                                        className="p-4 px-6 align-middle font-mono text-emerald-400 cursor-pointer hover:underline underline-offset-4 decoration-emerald-500/40"
                                                        onClick={() => setSelectedTradeForChart(trade)}
                                                    >
                                                        {new Date(trade.date).toLocaleDateString()}
                                                    </td>
                                                    <td className="p-4 align-middle font-black text-white">
                                                        {trade.symbol}
                                                    </td>
                                                    <td className="p-4 align-middle">
                                                        <span className="inline-flex items-center rounded bg-gray-900 border border-gray-700 px-2 py-0.5 text-[10px] font-bold text-zinc-400 uppercase">
                                                            {trade.status}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 align-middle">
                                                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${trade.direction === 'LONG' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                                                            {trade.direction}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 align-middle text-right text-zinc-300 font-mono">
                                                        ${entryPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </td>
                                                    <td className="p-4 align-middle text-right text-zinc-300 font-mono">
                                                        ${exitPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </td>
                                                    <td className="p-4 align-middle text-right text-white font-black">
                                                        {trade.volume.toLocaleString()}
                                                    </td>
                                                    <td className={`p-4 px-6 align-middle text-right font-black ${Number(trade.netPl) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                        {formatCurrency(trade.netPl)}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="daily">
                    <DailyPerformance trades={filteredTrades} />
                </TabsContent>

                <TabsContent value="drawdown">
                    <DrawdownAnalysis trades={filteredTrades} />
                </TabsContent>

                {edgeOpened && (
                    <TabsContent value="edge-analysis" forceMount hidden={activeTab !== "edge-analysis"}>
                        <EdgeAnalysisTab scope={edgeScope} active={activeTab === "edge-analysis"} />
                    </TabsContent>
                )}

                <TabsContent value="ai-coach">
                    <AICoachTab stats={stats} />
                </TabsContent>
            </Tabs>

            {/* Date Click Intraday View Dialog */}
            <Dialog open={!!selectedTradeForChart} onOpenChange={(open) => !open && setSelectedTradeForChart(null)}>
                <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-5xl p-6 shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-2xl font-black">
                            {selectedTradeForChart?.symbol} Execution Details
                            <span className="text-zinc-500 text-sm font-normal">
                                {selectedTradeForChart && new Date(selectedTradeForChart.date).toLocaleDateString()}
                            </span>
                        </DialogTitle>
                    </DialogHeader>
                    {selectedTradeForChart && (
                        <div className="py-4">
                            <MarketChartPanel
                                    symbol={selectedTradeForChart.symbol}
                                    executions={selectedTradeForChart.executions}
                                    date={new Date(selectedTradeForChart.date).toISOString().slice(0,10)}
                                />

                            <div className="mt-6 space-y-2">
                                <h4 className="text-xs font-black uppercase text-zinc-500 tracking-wider">Raw Executions</h4>
                                <div className="rounded-lg border border-gray-800 overflow-hidden">
                                    <table className="w-full text-[10px]">
                                        <thead className="bg-gray-800 text-zinc-400">
                                            <tr>
                                                <th className="p-2 text-left">Time</th>
                                                <th className="p-2 text-left">Side</th>
                                                <th className="p-2 text-right">Price</th>
                                                <th className="p-2 text-right">Qty</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {selectedTradeForChart.executions.map((ex, idx) => (
                                                <tr key={idx} className="border-t border-gray-800 transition-colors hover:bg-white/5">
                                                    <td className="p-2 text-zinc-400">
                                                        {new Date(ex.time).toLocaleTimeString("en-US", {
                                                            timeZone: "America/New_York",
                                                            hour: '2-digit',
                                                            minute: '2-digit',
                                                            second: '2-digit',
                                                            hour12: true
                                                        })}
                                                    </td>
                                                    <td className={`p-2 font-bold ${ex.side === 'BUY' || ex.side === 'B' ? 'text-green-500' : 'text-red-500'}`}>{ex.side}</td>
                                                    <td className="p-2 text-right text-white font-mono">${Number(ex.price).toFixed(2)}</td>
                                                    <td className="p-2 text-right text-white font-mono">{ex.quantity}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
