"use client";

import { useMemo, useState } from "react";
import { BarChart2, BookOpen, CalendarDays, Clock, Search } from "lucide-react";
import { endOfMonth, endOfWeek, format, isWithinInterval, startOfMonth, startOfWeek } from "date-fns";

import { DailyJournalNote } from "@/components/daily-journal-note";
import { DatePicker } from "@/components/date-picker";
import { TradeDetailItem } from "@/components/trade-detail-item";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface DailyEntrySummary {
    entryDate: string;
    content: string;
    updatedAt: string;
}

interface JournalTrade {
    id: string;
    symbol: string;
    dateKey: string;
    netPl: number | null;
    volume: number;
    [key: string]: unknown;
}

interface JournalViewProps {
    initialTrades: JournalTrade[];
    dailyEntries: DailyEntrySummary[];
    initialDate: string;
    todayDate: string;
}

type ViewMode = "day" | "week" | "month" | "all";

export function JournalView({ initialTrades, dailyEntries, initialDate, todayDate }: JournalViewProps) {

    const [searchSymbol, setSearchSymbol] = useState("");
    const [filterDate, setFilterDate] = useState(initialDate);
    const [viewMode, setViewMode] = useState<ViewMode>("day");

    const entriesByDate = useMemo(() => new Map(dailyEntries.map((entry) => [entry.entryDate, entry])), [dailyEntries]);
    const referenceDate = useMemo(() => new Date(`${todayDate}T12:00:00`), [todayDate]);

    const filteredTrades = useMemo(() => {
        let filtered = initialTrades;
        if (searchSymbol) {
            const query = searchSymbol.toLowerCase();
            filtered = filtered.filter((trade) => trade.symbol.toLowerCase().includes(query));
        }

        if (viewMode === "day") {
            return filtered.filter((trade) => trade.dateKey === filterDate);
        }
        if (viewMode === "week") {
            const start = startOfWeek(referenceDate, { weekStartsOn: 1 });
            const end = endOfWeek(referenceDate, { weekStartsOn: 1 });
            return filtered.filter((trade) => isWithinInterval(new Date(`${trade.dateKey}T12:00:00`), { start, end }));
        }
        if (viewMode === "month") {
            const start = startOfMonth(referenceDate);
            const end = endOfMonth(referenceDate);
            return filtered.filter((trade) => isWithinInterval(new Date(`${trade.dateKey}T12:00:00`), { start, end }));
        }
        return filtered;
    }, [filterDate, initialTrades, referenceDate, searchSymbol, viewMode]);

    const groupedTrades = useMemo(() => {
        const groups: Record<string, JournalTrade[]> = {};
        filteredTrades.forEach((trade) => {
            if (!groups[trade.dateKey]) groups[trade.dateKey] = [];
            groups[trade.dateKey].push(trade);
        });
        return groups;
    }, [filteredTrades]);

    const dates = Object.keys(groupedTrades).sort((a, b) => b.localeCompare(a));
    const rangeStats = useMemo(() => ({
        pnl: filteredTrades.reduce((sum, trade) => sum + (Number(trade.netPl)), 0),
        volume: filteredTrades.reduce((sum, trade) => sum + (trade.volume), 0),
        count: filteredTrades.length,
    }), [filteredTrades]);

    const rangeLabel = useMemo(() => {
        if (viewMode === "day") return format(new Date(`${filterDate}T12:00:00`), "EEEE, MMM d, yyyy");
        if (viewMode === "week") {
            const start = startOfWeek(referenceDate, { weekStartsOn: 1 });
            const end = endOfWeek(referenceDate, { weekStartsOn: 1 });
            return `${format(start, "MMM d")} - ${format(end, "MMM d, yyyy")}`;
        }
        if (viewMode === "month") return format(referenceDate, "MMMM yyyy");
        return "All History";
    }, [filterDate, referenceDate, viewMode]);

    const selectMode = (mode: ViewMode) => {
        setViewMode(mode);
        if (mode === "day") setFilterDate(todayDate);
    };

    const clearFilters = () => {
        setSearchSymbol("");
        setFilterDate(initialDate);
        setViewMode("day");
    };

    const currentEntry = entriesByDate.get(filterDate);

    return (
        <div className="space-y-8">
            <div className="flex flex-col gap-6 pb-2 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex-1">
                    <h2 className="flex items-center gap-3 text-3xl font-bold tracking-tight">
                        <BookOpen className="h-8 w-8 text-yellow-500" /> Trading Journal
                    </h2>
                    <p className="text-gray-400">Capture the day, then review every trade by process.</p>
                </div>

                <div className="flex justify-center xl:flex-[1.5]">
                    <div className="flex flex-wrap items-center justify-center gap-1 rounded-2xl border border-gray-700/40 bg-gray-800/40 p-1.5 backdrop-blur-sm sm:gap-2">
                        {(["day", "week", "month", "all"] as ViewMode[]).map((mode) => {
                            const label = mode === "day" ? "Today" : mode === "week" ? "This Week" : mode === "month" ? "This Month" : "All";
                            const isActive = mode === "day"
                                ? viewMode === "day" && filterDate === todayDate
                                : viewMode === mode;
                            return (
                                <button key={mode} onClick={() => selectMode(mode)} className={cn("rounded-xl px-4 py-2 text-sm font-bold transition-all", isActive ? "bg-yellow-500 text-gray-950 shadow-lg shadow-yellow-950/30" : "text-gray-500 hover:bg-gray-700/60 hover:text-white")}>{label}</button>
                            );
                        })}
                    </div>
                </div>

                <div className="flex flex-1 flex-col items-stretch justify-end gap-3 sm:flex-row sm:items-center">
                    <div className="group relative sm:w-56">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500 transition-colors group-focus-within:text-yellow-500" />
                        <Input placeholder="Search Stock..." value={searchSymbol} onChange={(event) => setSearchSymbol(event.target.value)} className="h-11 rounded-xl border-gray-700 bg-gray-800/80 pl-9 text-white shadow-inner focus:ring-yellow-500" />
                    </div>
                    <div className="sm:w-48">
                        <DatePicker
                            date={new Date(`${filterDate}T00:00:00`)}
                            setDate={(date) => {
                                if (!date) return;
                                setFilterDate(format(date, "yyyy-MM-dd"));
                                setViewMode("day");
                            }}
                        />
                    </div>
                </div>
            </div>

            {viewMode === "day" ? (
                <DailyJournalNote
                    key={filterDate}
                    entryDate={filterDate}
                    initialContent={currentEntry?.content || ""}
                    initialUpdatedAt={currentEntry?.updatedAt || null}
                />
            ) : (
                <div className="flex items-center gap-3 rounded-xl border border-sky-500/15 bg-sky-500/[0.04] px-4 py-3 text-sm text-gray-400">
                    <CalendarDays className="h-4 w-4 text-sky-400" /> Select a specific date to write or edit Daily Notes.
                </div>
            )}

            <div className="space-y-12">
                <div className="flex flex-col gap-5 rounded-2xl border border-gray-800/50 bg-gray-900/50 p-5 shadow-2xl backdrop-blur-md sm:flex-row sm:items-center sm:justify-between sm:p-6">
                    <div className="flex flex-wrap items-center gap-4 sm:gap-6">
                        <h3 className="text-2xl font-black tracking-tighter text-white sm:text-3xl">{rangeLabel}</h3>
                        <div className={cn("rounded-full border px-5 py-1.5 text-lg font-black shadow-lg", rangeStats.pnl > 0 ? "border-green-500/30 bg-green-500/15 text-green-400" : rangeStats.pnl < 0 ? "border-red-500/30 bg-red-500/15 text-red-400" : "border-gray-700 bg-gray-800 text-gray-400")}>{rangeStats.pnl >= 0 ? "+" : ""}${rangeStats.pnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    </div>
                    <div className="flex items-center gap-8 text-sm font-bold text-gray-400 sm:gap-10">
                        <div><span className="mb-0.5 block text-[10px] uppercase tracking-widest text-gray-500">Total Volume</span><span className="flex items-center gap-2 text-white"><BarChart2 className="h-4 w-4 text-sky-500" /> {rangeStats.volume.toLocaleString()} Vol</span></div>
                        <div><span className="mb-0.5 block text-[10px] uppercase tracking-widest text-gray-500">Trade Count</span><span className="flex items-center gap-2 text-white"><Clock className="h-4 w-4 text-purple-500" /> {rangeStats.count} Trades</span></div>
                    </div>
                </div>

                {dates.length === 0 && (
                    <Card className="rounded-3xl border-dashed border-gray-700 bg-gray-800/30 px-6 py-20 text-center text-white">
                        <div className="mx-auto max-w-md space-y-5">
                            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-gray-700 bg-gray-800/50"><Search className="h-8 w-8 text-gray-500" /></div>
                            <div>
                                <p className="text-lg font-semibold text-gray-300">{viewMode === "day" && !searchSymbol ? "No trades for this day" : "No trades found matching your filters"}</p>
                                <p className="mt-2 text-sm text-gray-500">{viewMode === "day" && !searchSymbol ? "You can still save your Daily Notes above." : "Try another date, symbol, or time range."}</p>
                            </div>
                            {(searchSymbol || viewMode !== "day") && <Button variant="outline" onClick={clearFilters} className="border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white">Reset Filters</Button>}
                        </div>
                    </Card>
                )}

                {dates.map((dateKey) => (
                    <div key={dateKey} className="space-y-12">
                        {viewMode !== "day" && <div className="border-b border-gray-800 pb-3 text-sm font-bold uppercase tracking-widest text-gray-500">{format(new Date(`${dateKey}T12:00:00`), "EEEE, MMMM d, yyyy")}</div>}
                        {groupedTrades[dateKey].map((trade) => <TradeDetailItem key={trade.id} trade={trade} />)}
                    </div>
                ))}
            </div>
        </div>
    );
}
