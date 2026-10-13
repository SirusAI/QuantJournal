"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatPnlSpecial } from "@/lib/utils";
import { StatsGrid } from "./stats-grid";
import { CumulativePnlChart } from "./cumulative-pnl-chart";
import { calculateStats, Trade } from "@/lib/stats";
import { useMemo } from "react";
import { TrendingUp, Activity, ArrowUpRight, DollarSign, X } from "lucide-react";
import { DatePickerWithRange } from "./date-range-picker";
import { PeriodSelector } from "./period-selector";
import { DateRange } from "react-day-picker";
import { useState } from "react";

interface DashboardViewProps {
    initialTrades: (Trade & { symbol: string; status: string })[];
}

export function DashboardView({ initialTrades }: DashboardViewProps) {

    const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

    const filteredTrades = useMemo(() => {
        let filtered = initialTrades;

        if (dateRange?.from) {
            filtered = filtered.filter(t => {
                const tradeDate = new Date(t.date).getTime();
                const fromDate = dateRange.from!.getTime();
                const toDate = dateRange.to ? dateRange.to.getTime() + 86400000 : fromDate + 86400000;
                return tradeDate >= fromDate && tradeDate < toDate;
            });
        }

        return filtered;
    }, [initialTrades, dateRange]);

    const stats = calculateStats(filteredTrades as Trade[]);

    // Chart Data
    const chartData = useMemo(() => {
        const sorted = [...filteredTrades].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        return sorted.reduce<Array<{ time: string; value: number }>>((points, trade) => [...points, {
            time: new Date(trade.date).toISOString().split("T")[0],
            value: (points.at(-1)?.value ?? 0) + Number(trade.netPl),
        }], []);
    }, [filteredTrades]);

    return (
        <div className="space-y-8 text-white">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
                    <p className="text-gray-400">Overview of your trading performance.</p>
                </div>
                <div className="flex items-center gap-2">
                    <PeriodSelector onSelect={setDateRange} />
                    <DatePickerWithRange date={dateRange} setDate={setDateRange} />
                    {dateRange && (
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDateRange(undefined)}
                            className="h-10 w-10 text-zinc-400 hover:text-white hover:bg-gray-800 border border-transparent hover:border-gray-700"
                            title="Clear Date Filter"
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    )}
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="bg-gray-800 border-gray-700 text-white overflow-hidden">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-4">
                        <CardTitle className="text-xs font-bold uppercase tracking-wider text-zinc-500">Total P&L</CardTitle>
                        <DollarSign className="h-3.5 w-3.5 text-emerald-500" />
                    </CardHeader>
                    <CardContent className="pb-3 px-4">
                        <div className={`text-xl font-black ${stats.totalGainLoss >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {formatPnlSpecial(stats.totalGainLoss)}
                        </div>
                        <p className="text-[10px] font-bold text-orange-400 mt-0.5">
                            {stats.totalTrades} trades total
                        </p>
                    </CardContent>
                </Card>
                <Card className="bg-gray-800 border-gray-700 text-white overflow-hidden">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-4">
                        <CardTitle className="text-xs font-bold uppercase tracking-wider text-zinc-500">Win Rate</CardTitle>
                        <Activity className="h-3.5 w-3.5 text-sky-500" />
                    </CardHeader>
                    <CardContent className="pb-3 px-4">
                        <div className="text-xl font-black text-white">{stats.winRate.toFixed(1)}%</div>
                        <p className="text-[10px] font-bold mt-0.5">
                            <span className="text-green-400">{stats.winningTrades}W</span>
                            <span className="text-zinc-600 mx-1">-</span>
                            <span className="text-red-400">{stats.losingTrades}L</span>
                        </p>
                    </CardContent>
                </Card>
                <Card className="bg-gray-800 border-gray-700 text-white overflow-hidden">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-4">
                        <CardTitle className="text-xs font-bold uppercase tracking-wider text-zinc-500">Profit Factor</CardTitle>
                        <TrendingUp className="h-3.5 w-3.5 text-purple-500" />
                    </CardHeader>
                    <CardContent className="pb-3 px-4">
                        <div className="text-xl font-black text-white">{stats.profitFactor.toFixed(2)}</div>
                    </CardContent>
                </Card>
                <Card className="bg-gray-800 border-gray-700 text-white overflow-hidden">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-4">
                        <CardTitle className="text-xs font-bold uppercase tracking-wider text-zinc-500">Avg Daily Gain/Loss</CardTitle>
                        <ArrowUpRight className="h-3.5 w-3.5 text-orange-500" />
                    </CardHeader>
                    <CardContent className="pb-3 px-4">
                        <div className={`text-xl font-black ${stats.avgDailyGainLoss >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {formatPnlSpecial(stats.avgDailyGainLoss)}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <Card className="col-span-7 bg-gray-800 border-gray-700 text-white">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle>Cumulative P&L</CardTitle>
                        <div className="flex items-center gap-2">
                            <span className="flex items-center gap-1 text-[10px] text-zinc-500 font-bold uppercase tracking-widest bg-gray-900/50 px-2 py-0.5 rounded border border-gray-700">
                                <div className="h-1.5 w-1.5 rounded-full bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.5)]" />
                                Profit
                            </span>
                            <span className="flex items-center gap-1 text-[10px] text-zinc-500 font-bold uppercase tracking-widest bg-gray-900/50 px-2 py-0.5 rounded border border-gray-700">
                                <div className="h-1.5 w-1.5 rounded-full bg-red-500 shadow-[0_0_5px_rgba(239,68,68,0.5)]" />
                                Loss
                            </span>
                        </div>
                    </CardHeader>
                    <CardContent className="pl-2">
                        <div className="h-[400px] w-full">
                            <CumulativePnlChart data={chartData} />
                        </div>
                    </CardContent>
                </Card>
            </div>

            <StatsGrid stats={stats} />
        </div>
    );
}
