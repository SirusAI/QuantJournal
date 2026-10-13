"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { Lock } from "lucide-react";

interface DailyPerformanceProps {
    trades: any[];
}

export function DailyPerformance({ trades }: DailyPerformanceProps) {
    // 1. Group by Day
    const dailyData: Record<string, { pl: number, trades: number, vol: number }> = {};

    trades.forEach(t => {
        const dateKey = new Date(t.date).toISOString().split('T')[0];
        if (!dailyData[dateKey]) dailyData[dateKey] = { pl: 0, trades: 0, vol: 0 };
        dailyData[dateKey].pl += Number(t.netPl);
        dailyData[dateKey].trades += 1;
        dailyData[dateKey].vol += Number(t.volume);
    });

    const days = Object.values(dailyData);
    const winDays = days.filter(d => d.pl > 0);
    const lossDays = days.filter(d => d.pl < 0);

    const calculateDailyStats = (dataSet: typeof days) => {
        if (dataSet.length === 0) return { totalPl: 0, avgPl: 0, avgTrades: 0, avgVol: 0 };
        const totalPl = dataSet.reduce((sum, d) => sum + d.pl, 0);
        return {
            totalPl,
            avgPl: totalPl / dataSet.length,
            avgTrades: dataSet.reduce((sum, d) => sum + d.trades, 0) / dataSet.length,
            avgVol: dataSet.reduce((sum, d) => sum + d.vol, 0) / dataSet.length
        };
    };

    const winStats = calculateDailyStats(winDays);
    const lossStats = calculateDailyStats(lossDays);

    const StatRow = ({ label, valWin, valLoss, isCurrency = false }: any) => (
        <div className="grid grid-cols-2 gap-8 border-b border-gray-700 py-3 last:border-0 hover:bg-white/5">
            <div className="flex justify-between">
                <span className="text-zinc-400 font-medium">{label}</span>
                <span className="text-white font-bold">{isCurrency ? formatCurrency(valWin) : valWin.toLocaleString(undefined, { maximumFractionDigits: 1 })}</span>
            </div>
            <div className="flex justify-between">
                <span className="text-zinc-400 font-medium">{label}</span>
                <span className="text-white font-bold">{isCurrency ? formatCurrency(valLoss) : valLoss.toLocaleString(undefined, { maximumFractionDigits: 1 })}</span>
            </div>
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 gap-8">
                <div className="text-xl font-bold text-blue-400 border-b border-blue-500 pb-2">Winning Days ({winDays.length})</div>
                <div className="text-xl font-bold text-orange-400 border-b border-orange-500 pb-2">Losing Days ({lossDays.length})</div>
            </div>

            <Card className="bg-gray-800 border-gray-700">
                <CardContent className="p-6">
                    <StatRow label="Total Gain / Loss" valWin={winStats.totalPl} valLoss={lossStats.totalPl} isCurrency />
                    <StatRow label="Avg Daily Gain / Loss" valWin={winStats.avgPl} valLoss={lossStats.avgPl} isCurrency />
                    <StatRow label="Avg Daily Volume" valWin={winStats.avgVol} valLoss={lossStats.avgVol} />
                    <StatRow label="Avg Trades / Day" valWin={winStats.avgTrades} valLoss={lossStats.avgTrades} />

                </CardContent>
            </Card>
        </div>
    );
}
