"use client";
import { Link } from "@/components/journal-runtime";
import { useJournal } from "@/components/journal-runtime";

import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Info } from "lucide-react";

interface SpyDay {
    date: string;
    pctChange: number;
    open: number;
    close: number;
}

interface SpyGapChartProps {
    trades: any[];
}

const BUCKET_KEYS = [
    "< -3%",
    "-3% to -2%",
    "-2% to -1%",
    "-1% to 0",
    "0 to +1%",
    "+1% to +2%",
    "+2% to +3%",
    "> +3%",
] as const;

type BucketKey = (typeof BUCKET_KEYS)[number];

function getBucketKey(pctChange: number): BucketKey {
    if (pctChange < -3) return "< -3%";
    if (pctChange >= -3 && pctChange < -2) return "-3% to -2%";
    if (pctChange >= -2 && pctChange < -1) return "-2% to -1%";
    if (pctChange >= -1 && pctChange < 0) return "-1% to 0";
    if (pctChange >= 0 && pctChange < 1) return "0 to +1%";
    if (pctChange >= 1 && pctChange < 2) return "+1% to +2%";
    if (pctChange >= 2 && pctChange < 3) return "+2% to +3%";
    return "> +3%";
}

function pearsonCorrelation(xs: number[], ys: number[]): number {
    const n = xs.length;
    if (n < 3) return 0;
    const meanX = xs.reduce((a, b) => a + b, 0) / n;
    const meanY = ys.reduce((a, b) => a + b, 0) / n;
    let num = 0, denX = 0, denY = 0;
    for (let i = 0; i < n; i++) {
        const dx = xs[i] - meanX;
        const dy = ys[i] - meanY;
        num += dx * dy;
        denX += dx * dx;
        denY += dy * dy;
    }
    const den = Math.sqrt(denX * denY);
    return den === 0 ? 0 : num / den;
}

function correlationLabel(r: number): { text: string; color: string } {
    const abs = Math.abs(r);
    const dir = r >= 0 ? "Positive" : "Negative";
    if (abs >= 0.7) return { text: `Strong ${dir}`, color: r >= 0 ? "text-[#2ccd65]" : "text-red-400" };
    if (abs >= 0.4) return { text: `Moderate ${dir}`, color: r >= 0 ? "text-emerald-400" : "text-orange-400" };
    if (abs >= 0.2) return { text: `Weak ${dir}`, color: "text-yellow-400" };
    return { text: "No Correlation", color: "text-zinc-500" };
}

interface BucketStats {
    totalPl: number;
    count: number;
    wins: number;
    losses: number;
    avgPl: number;
    winRate: number;
}

export function SpyGapChart({ trades }: SpyGapChartProps) {
 const client = useJournal();
    const [marketNotice, setMarketNotice] = useState("Daily market data uses your saved settings.");
    const [spyData, setSpyData] = useState<SpyDay[]>([]);
    const [loading, setLoading] = useState(false);
    const [showInfo, setShowInfo] = useState(false);

    useEffect(() => {
        if (trades.length === 0) {
            setSpyData([]);
            return;
        }

        const dates = trades.map((t) => new Date(t.date).getTime());
        const minDate = new Date(Math.min(...dates));
        minDate.setDate(minDate.getDate() - 5);
        const minStr = minDate.toISOString().split("T")[0];
        const maxStr = new Date(Math.max(...dates)).toISOString().split("T")[0];

        let cancelled = false;
        setLoading(true);

        client.getSpyDaily(minStr, maxStr)
            .then((res) => res.json())
            .then((data) => {
                if (cancelled) return;
                setSpyData(Array.isArray(data.data) ? data.data : []); setMarketNotice([`${data.source ?? "market source"} · ${data.interval ?? "1d"} · ${data.adjustment ?? "unknown"}`, ...(data.limitations ?? []), ...(data.error ? [data.error] : [])].join(" · "));
            })
            .catch((err) => {
                console.error("[SpyGapChart] fetch error", err);
                if (!cancelled) setSpyData([]);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => { cancelled = true; };
    }, [trades]);

    const gapMap = useMemo(() => {
        const map = new Map<string, number>();
        if (spyData.length < 2) return map;
        for (let i = 1; i < spyData.length; i++) {
            const prevClose = spyData[i - 1].close;
            const todayOpen = spyData[i].open;
            if (prevClose > 0) {
                map.set(spyData[i].date, ((todayOpen - prevClose) / prevClose) * 100);
            }
        }
        return map;
    }, [spyData]);

    const { bucketStats, maxAbsValue, correlation } = useMemo(() => {
        const stats: Record<BucketKey, BucketStats> = {} as any;
        BUCKET_KEYS.forEach((k) => {
            stats[k] = { totalPl: 0, count: 0, wins: 0, losses: 0, avgPl: 0, winRate: 0 };
        });

        if (gapMap.size === 0) return { bucketStats: stats, maxAbsValue: 0, correlation: 0 };

        const gapXs: number[] = [];
        const plYs: number[] = [];

        trades.forEach((trade) => {
            const tradeDate = new Date(trade.date).toISOString().split("T")[0];
            const gapPct = gapMap.get(tradeDate);
            if (gapPct !== undefined) {
                const netPl = Number(trade.netPl);
                const key = getBucketKey(gapPct);
                stats[key].totalPl += netPl;
                stats[key].count += 1;
                if (netPl > 0) stats[key].wins += 1;
                if (netPl < 0) stats[key].losses += 1;
                gapXs.push(gapPct);
                plYs.push(netPl);
            }
        });

        BUCKET_KEYS.forEach((k) => {
            const s = stats[k];
            s.avgPl = s.count > 0 ? s.totalPl / s.count : 0;
            s.winRate = (s.wins + s.losses) > 0 ? (s.wins / (s.wins + s.losses)) * 100 : 0;
        });

        const maxAbs = Math.max(...BUCKET_KEYS.map((k) => Math.abs(stats[k].totalPl)), 1);
        const r = pearsonCorrelation(gapXs, plYs);
        return { bucketStats: stats, maxAbsValue: maxAbs, correlation: r };
    }, [gapMap, trades]);

    const corr = correlationLabel(correlation);

    if (trades.length === 0) return null;

    return (
        <Card className="bg-gray-800 border-gray-700 text-white shadow-2xl min-h-[400px]">
            <CardHeader className="border-b border-gray-700/50 pb-4">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-[11px] font-bold uppercase tracking-widest text-zinc-300">
                        Performance by SPY Gap %
                    </CardTitle>
                    <button
                        onClick={() => setShowInfo(!showInfo)}
                        className="text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                        <Info className="h-4 w-4" />
                    </button>
                </div>
                <div className="flex items-center gap-2 mt-2">
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Correlation:</span>
                    <span className={`text-[11px] font-black ${corr.color}`}>
                        {correlation.toFixed(3)} — {corr.text}
                    </span>
                </div>
                {showInfo && (
                    <p className="text-[10px] text-zinc-500 mt-2 leading-relaxed">
                        Your Net P&L grouped by SPY&apos;s overnight gap % (prev close → today open).
                        Each row shows win rate and trade count for that gap range.
                    </p>
                )}
            </CardHeader>
            <CardContent className="pt-4 pb-4 px-4">
                <p role="status" className="mb-3 text-xs text-amber-200">{marketNotice} <Link href="/settings" className="underline text-sky-400">Market settings</Link></p>
                {loading ? (
                    <div className="h-[380px] flex items-center justify-center">
                        <div className="flex flex-col items-center gap-4 backdrop-blur-sm">
                            <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                            <p className="text-[10px] text-zinc-500 animate-pulse font-bold tracking-widest uppercase">
                                Loading SPY Gap Data...
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="bg-[#1f232c] rounded-lg p-4 space-y-0">
                        {BUCKET_KEYS.map((key) => {
                            const s = bucketStats[key];
                            const isPositive = s.totalPl >= 0;
                            const widthPct = maxAbsValue > 0 ? (Math.abs(s.totalPl) / maxAbsValue) * 100 : 0;
                            const winRateColor = s.winRate >= 60 ? "text-[#2ccd65]" : s.winRate >= 45 ? "text-yellow-400" : s.count > 0 ? "text-red-400" : "text-zinc-600";

                            return (
                                <div key={key} className="flex items-center h-9 group">
                                    <div className="w-[72px] shrink-0 text-right pr-2">
                                        <span className="text-[10px] font-black tracking-wider text-zinc-300">{key}</span>
                                    </div>

                                    <div className="flex-1 flex items-center relative h-7">
                                        <div className="absolute inset-0 flex">
                                            <div className="w-1/4 border-r border-gray-700/50" />
                                            <div className="w-1/4 border-r border-gray-700/50" />
                                            <div className="w-1/4 border-r border-gray-700/50" />
                                            <div className="w-1/4" />
                                        </div>
                                        <div className="w-1/2 flex justify-end h-full relative">
                                            {!isPositive && widthPct > 0 && (
                                                <div
                                                    className="h-full bg-red-500 hover:bg-red-400 rounded-l transition-all duration-300 ease-out"
                                                    style={{ width: `${widthPct}%` }}
                                                    title={`${key}: $${s.totalPl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} | ${s.count} trades | Win Rate: ${s.winRate.toFixed(0)}% | Avg: $${s.avgPl.toFixed(2)}`}
                                                />
                                            )}
                                        </div>
                                        <div className="w-px bg-white shrink-0 h-full z-10" />
                                        <div className="w-1/2 flex justify-start h-full relative">
                                            {isPositive && widthPct > 0 && (
                                                <div
                                                    className="h-full bg-[#2ccd65] hover:bg-[#3be077] rounded-r transition-all duration-300 ease-out"
                                                    style={{ width: `${widthPct}%` }}
                                                    title={`${key}: +$${s.totalPl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} | ${s.count} trades | Win Rate: ${s.winRate.toFixed(0)}% | Avg: $${s.avgPl.toFixed(2)}`}
                                                />
                                            )}
                                        </div>
                                    </div>

                                    <div className="w-[100px] shrink-0 text-left pl-2 flex items-center gap-1.5">
                                        {s.count > 0 ? (
                                            <>
                                                <span className={`text-[9px] font-black ${winRateColor}`}>
                                                    {s.winRate.toFixed(0)}%
                                                </span>
                                                <span className="text-[8px] text-zinc-600">
                                                    ({s.wins}W {s.losses}L)
                                                </span>
                                            </>
                                        ) : (
                                            <span className="text-[8px] text-zinc-700">—</span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
