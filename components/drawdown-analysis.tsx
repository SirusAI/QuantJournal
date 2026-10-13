"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { Lock } from "lucide-react";
import { CumulativePnlChart } from "./cumulative-pnl-chart";
import { format } from "date-fns";

interface DrawdownAnalysisProps {
    trades: any[];
}

export function DrawdownAnalysis({ trades }: DrawdownAnalysisProps) {
    // 1. Calculate Equity Curve & Drawdown
    // Sort trades by date
    const sortedTrades = [...trades].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let runningPl = 0;
    let peakPl = -Infinity;
    let maxDrawdown = 0;
    let currentDrawdown = 0;

    // For chart
    const drawdownData = [];

    // Track drawdowns
    const drawdowns: number[] = [];
    let isInDrawdown = false;

    // Track drawdown periods
    const drawdownPeriods: { start: Date, end: Date | null, tradeCount: number }[] = [];
    let currentPeriod: typeof drawdownPeriods[0] | null = null;

    for (let i = 0; i < sortedTrades.length; i++) {
        const t = sortedTrades[i];
        runningPl += Number(t.netPl);

        if (runningPl >= peakPl) {
            peakPl = runningPl;
            if (currentPeriod) {
                currentPeriod.end = new Date(t.date);
                drawdownPeriods.push(currentPeriod);
                currentPeriod = null;
            }
        } else {
            if (!currentPeriod) {
                // Period starts from the trade AFTER the peak
                // or just the date of this trade as start?
                // Let's use the date of the trade that caused the first dip.
                currentPeriod = { start: new Date(t.date), end: null, tradeCount: 0 };
            }
            currentPeriod.tradeCount++;
        }

        currentDrawdown = peakPl - runningPl;
        if (currentDrawdown > maxDrawdown) maxDrawdown = currentDrawdown;
        if (currentDrawdown > 0) drawdowns.push(currentDrawdown);

        drawdownData.push({
            time: format(new Date(t.date), "yyyy-MM-dd"),
            value: -currentDrawdown
        });
    }

    // Handle ongoing drawdown
    if (currentPeriod) {
        // Use last trade date or current date? Last trade date is safer for historical report.
        currentPeriod.end = new Date(sortedTrades[sortedTrades.length - 1].date);
        drawdownPeriods.push(currentPeriod);
    }

    const avgDrawdown = drawdowns.length > 0 ? drawdowns.reduce((a, b) => a + b, 0) / drawdowns.length : 0;

    // Drawdown Period Stats
    const totalDaysInDD = drawdownPeriods.reduce((sum, p) => {
        if (!p.end) return sum;
        return sum + Math.ceil((p.end.getTime() - p.start.getTime()) / (1000 * 60 * 60 * 24));
    }, 0);

    const avgDaysInDD = drawdownPeriods.length > 0 ? totalDaysInDD / drawdownPeriods.length : 0;
    const avgTradesInDD = drawdownPeriods.length > 0
        ? drawdownPeriods.reduce((sum, p) => sum + p.tradeCount, 0) / drawdownPeriods.length
        : 0;

    return (
        <div className="space-y-6">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Card className="bg-gray-800 border-gray-700">
                    <CardHeader><CardTitle className="text-zinc-400 text-sm">Average Drawdown</CardTitle></CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-white">{formatCurrency(avgDrawdown)}</div>
                    </CardContent>
                </Card>
                <Card className="bg-gray-800 border-gray-700">
                    <CardHeader><CardTitle className="text-zinc-400 text-sm">Max Drawdown</CardTitle></CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-500">{formatCurrency(maxDrawdown)}</div>
                    </CardContent>
                </Card>
                <Card className="bg-gray-800 border-gray-700">
                    <CardHeader><CardTitle className="text-zinc-400 text-sm">Average Trades in Drawdown</CardTitle></CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-amber-500">{avgTradesInDD.toFixed(1)}</div>
                    </CardContent>
                </Card>
                <Card className="bg-gray-800 border-gray-700">
                    <CardHeader><CardTitle className="text-zinc-400 text-sm">Average Days in Drawdown</CardTitle></CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-amber-500">{avgDaysInDD.toFixed(1)} days</div>
                    </CardContent>
                </Card>
                <Card className="bg-gray-800 border-gray-700">
                    <CardHeader><CardTitle className="text-zinc-400 text-sm">Total Days in Drawdown</CardTitle></CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-400">{totalDaysInDD} days</div>
                    </CardContent>
                </Card>
            </div>

            <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                    <CardTitle>Drawdown Curve</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="h-[300px] w-full">
                        {/* Reusing CumulativeChart but passing negative drawdown values */}
                        <CumulativePnlChart data={drawdownData} />
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
