"use client";

import {
    buildCalendarWeeks,
    CALENDAR_VIEW_MONTH_COUNTS,
    getCalendarDateKey,
    getCalendarMonths,
    type CalendarDailyStats,
    type CalendarView,
} from "@/lib/calendar-stats";
import { cn, formatPnlSpecial } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Eye, EyeOff } from "lucide-react";
import { Link } from "@/components/journal-runtime";
import { useState } from "react";

interface CalendarGridProps {
    dailyData: Record<string, CalendarDailyStats>;
    year: number;
    month: number;
    view: CalendarView;
}

interface CalendarTotals {
    pnl: number;
    trades: number;
    wins: number;
    losses: number;
    winRate: number;
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const VIEW_OPTIONS: { value: CalendarView; label: string }[] = [
    { value: "month", label: "Month" },
    { value: "3m", label: "3M" },
    { value: "6m", label: "6M" },
    { value: "12m", label: "12M" },
];

function getCalendarLink(year: number, month: number, view: CalendarView) {
    const date = new Date(year, month, 1);
    const viewParam = view === "month" ? "" : `&view=${view}`;
    return `/calendar?month=${date.getMonth()}&year=${date.getFullYear()}${viewParam}`;
}

function formatMonthYear(year: number, month: number, format: "long" | "short" = "long") {
    return new Intl.DateTimeFormat("en-US", { month: format, year: "numeric" }).format(new Date(year, month, 1));
}

function getViewPnlLabel(view: CalendarView) {
    return view === "month" ? "Monthly P&L" : `${view.toUpperCase()} P&L`;
}

function getMonthTotals(dailyData: Record<string, CalendarDailyStats>, year: number, month: number): CalendarTotals {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const totals: CalendarTotals = { pnl: 0, trades: 0, wins: 0, losses: 0, winRate: 0 };

    for (let day = 1; day <= daysInMonth; day++) {
        const stats = dailyData[getCalendarDateKey(year, month, day)];
        if (!stats) continue;

        totals.pnl += stats.pnl;
        totals.trades += stats.trades;
        totals.wins += stats.wins;
        totals.losses += stats.losses;
    }

    const totalWinLoss = totals.wins + totals.losses;
    totals.winRate = totalWinLoss > 0 ? (totals.wins / totalWinLoss) * 100 : 0;

    return totals;
}

function getRangeTotals(dailyData: Record<string, CalendarDailyStats>, months: { year: number; month: number }[]): CalendarTotals {
    const totals = months.reduce<CalendarTotals>((range, currentMonth) => {
        const monthTotals = getMonthTotals(dailyData, currentMonth.year, currentMonth.month);

        return {
            pnl: range.pnl + monthTotals.pnl,
            trades: range.trades + monthTotals.trades,
            wins: range.wins + monthTotals.wins,
            losses: range.losses + monthTotals.losses,
            winRate: 0,
        };
    }, { pnl: 0, trades: 0, wins: 0, losses: 0, winRate: 0 });

    const totalWinLoss = totals.wins + totals.losses;
    totals.winRate = totalWinLoss > 0 ? (totals.wins / totalWinLoss) * 100 : 0;

    return totals;
}

export function CalendarGrid({ dailyData, year, month, view }: CalendarGridProps) {

    const [showPnl, setShowPnl] = useState(true);

    const isMultiMonth = view !== "month";
    const months = getCalendarMonths(year, month, view);
    const rangeTotals = getRangeTotals(dailyData, months);
    const rangePnl = rangeTotals.pnl;
    const hasData = rangeTotals.trades > 0;

    const prevDate = new Date(year, month - 1, 1);
    const nextDate = new Date(year, month + 1, 1);
    const prevLink = getCalendarLink(prevDate.getFullYear(), prevDate.getMonth(), view);
    const nextLink = getCalendarLink(nextDate.getFullYear(), nextDate.getMonth(), view);
    const rangeLabel = isMultiMonth
        ? `${formatMonthYear(months[months.length - 1].year, months[months.length - 1].month, "short")} - ${formatMonthYear(months[0].year, months[0].month, "short")}`
        : formatMonthYear(year, month);

    return (
        <div className="space-y-8">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Calendar</h2>
                    <p className="text-gray-400">
                        {isMultiMonth
                            ? `${CALENDAR_VIEW_MONTH_COUNTS[view]}-month overview of your trading P&L.`
                            : "Monthly overview of your trading P&L."}
                    </p>
                </div>

                <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                    <div className="flex w-full rounded-lg border border-gray-700 bg-gray-800 p-1 lg:w-auto">
                        {VIEW_OPTIONS.map((option) => (
                            <Link
                                key={option.value}
                                href={getCalendarLink(year, month, option.value)}
                                className={cn(
                                    "flex-1 rounded-md px-3 py-2 text-center text-xs font-black uppercase tracking-wide transition lg:flex-none",
                                    view === option.value
                                        ? "bg-sky-500 text-white shadow-[0_0_10px_rgba(14,165,233,0.25)]"
                                        : "text-gray-400 hover:bg-gray-700 hover:text-white"
                                )}
                            >
                                {option.label}
                            </Link>
                        ))}
                    </div>

                    <button
                        onClick={() => setShowPnl(!showPnl)}
                        className="flex items-center justify-center gap-2 rounded border border-gray-700 bg-gray-800 px-3 py-2 text-gray-300 transition hover:bg-gray-700"
                    >
                        {showPnl ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        {showPnl ? "Hide P&L" : "Show P&L"}
                    </button>

                    <div className="flex items-center justify-between rounded-lg border border-gray-700 bg-gray-800 p-1 lg:min-w-[280px]">
                        <Link href={prevLink} className="rounded p-2 transition hover:bg-gray-700" aria-label="Previous month">
                            <ChevronLeft className="h-5 w-5" />
                        </Link>
                        <span className="min-w-[180px] px-3 text-center text-lg font-bold">{rangeLabel}</span>
                        <Link href={nextLink} className="rounded p-2 transition hover:bg-gray-700" aria-label="Next month">
                            <ChevronRight className="h-5 w-5" />
                        </Link>
                    </div>
                </div>
            </div>

            {hasData && (
                <div className="flex flex-col gap-4 rounded-xl border border-gray-700/50 bg-gray-800/50 p-4 shadow-xl backdrop-blur-sm xl:flex-row xl:items-center xl:justify-between">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-6">
                        <div className="rounded-lg border border-gray-700 bg-gray-900/50 px-4 py-2.5">
                            <span className="mb-0.5 block text-[10px] font-bold uppercase text-gray-500">{getViewPnlLabel(view)}</span>
                            <div className={cn(
                                "text-2xl font-black tracking-tight",
                                rangePnl > 0 ? "text-green-400" : rangePnl < 0 ? "text-red-400" : "text-gray-400"
                            )}>
                                {showPnl ? formatPnlSpecial(rangePnl) : "---"}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4 border-t border-gray-700/50 pt-4 sm:grid-cols-3 lg:border-l lg:border-t-0 lg:px-6 lg:pt-0 xl:gap-10">
                            <div>
                                <span className="mb-0.5 block text-[10px] font-bold uppercase text-gray-500">Total Trades</span>
                                <span className="text-xl font-bold tracking-tight text-white">{rangeTotals.trades}</span>
                            </div>
                            <div>
                                <span className="mb-0.5 block text-[10px] font-bold uppercase text-gray-500">W / L</span>
                                <div className="text-xl font-bold tracking-tight">
                                    <span className="text-green-400">{rangeTotals.wins}</span>
                                    <span className="mx-1.5 text-gray-600">/</span>
                                    <span className="text-red-400">{rangeTotals.losses}</span>
                                </div>
                            </div>
                            <div>
                                <span className="mb-0.5 block text-[10px] font-bold uppercase text-gray-500">Win Rate</span>
                                <span className={cn(
                                    "text-xl font-bold tracking-tight",
                                    rangeTotals.winRate >= 50 ? "text-green-400" : "text-red-400"
                                )}>
                                    {rangeTotals.winRate.toFixed(1)}%
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="hidden rounded-lg border border-sky-500/20 bg-sky-500/10 px-4 py-2 lg:block">
                        <span className="mb-0.5 block text-[10px] font-bold uppercase text-sky-400">Performance Status</span>
                        <span className="text-sm font-medium italic tracking-wide text-white">
                            {rangeTotals.pnl > 0
                                ? `Positive ${isMultiMonth ? "Range" : "Month"} - Keep Scaling`
                                : rangeTotals.pnl < 0
                                    ? `Negative ${isMultiMonth ? "Range" : "Month"} - Review Strategies`
                                    : `Breakeven ${isMultiMonth ? "Range" : "Month"}`}
                        </span>
                    </div>
                </div>
            )}

            {isMultiMonth ? (
                <MultiMonthCalendar dailyData={dailyData} months={months} showPnl={showPnl} />
            ) : (
                <MonthlyCalendar dailyData={dailyData} year={year} month={month} showPnl={showPnl} />
            )}
        </div>
    );
}

function MonthlyCalendar({
    dailyData,
    year,
    month,

    showPnl,
}: {
    dailyData: Record<string, CalendarDailyStats>;
    year: number;
    month: number;

    showPnl: boolean;
}) {
    const calendarWeeks = buildCalendarWeeks(year, month);

    return (
        <div className="grid grid-cols-8 gap-px overflow-hidden rounded-xl border border-gray-700 bg-gray-700 shadow-2xl">
            {[...DAY_LABELS, "Weekly Sum"].map((day) => (
                <div key={day} className={cn(
                    "border-b border-gray-700 bg-gray-800 p-4 text-center text-xs font-bold uppercase tracking-wider",
                    day === "Weekly Sum" ? "bg-gray-800/80 text-sky-400" : "text-gray-500"
                )}>
                    {day}
                </div>
            ))}
            {calendarWeeks.map((week, weekIdx) => {
                let weeklySum = 0;
                let weeklyTrades = 0;
                let weeklyWins = 0;
                let weeklyLosses = 0;

                const weekCells = week.map((day, dayIdx) => {
                    if (day === null) return <div key={`empty-${weekIdx}-${dayIdx}`} className="bg-gray-900/50" />;

                    const dateKey = getCalendarDateKey(year, month, day);
                    const stats = dailyData[dateKey];
                    const hasData = stats !== undefined;
                    const pnl = (stats?.pnl || 0);
                    const isProfit = pnl > 0;
                    const isLoss = pnl < 0;

                    if (hasData) {
                        weeklySum += pnl;
                        weeklyTrades += stats.trades;
                        weeklyWins += stats.wins;
                        weeklyLosses += stats.losses;
                    }

                    const cellBg = hasData
                        ? (isProfit ? "bg-green-900/40 hover:bg-green-900/50" : (isLoss ? "bg-red-900/40 hover:bg-red-900/50" : "bg-gray-800 hover:bg-gray-700/50"))
                        : "bg-gray-800 hover:bg-gray-700/50";

                    return (
                        <div key={day} className={`${cellBg} group relative flex min-h-[140px] flex-col border-r border-t border-gray-700/50 p-2 transition`}>
                            <span className="mb-1 text-sm font-medium text-gray-400">{day}</span>

                            {hasData && (
                                <div className="flex flex-1 flex-col justify-between text-xs">
                                    <div className={`mb-2 text-center text-sm font-bold ${isProfit ? "text-green-400" : isLoss ? "text-red-400" : "text-gray-400"}`}>
                                        {showPnl ? formatPnlSpecial(pnl) : "---"}
                                    </div>

                                    <div className="space-y-1 text-[10px] text-gray-300">
                                        <div className="flex justify-between">
                                            <span>Trades:</span>
                                            <span className="font-bold text-white">{stats.trades}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>W / L:</span>
                                            <span>
                                                <span className="text-green-400">{stats.wins}</span> / <span className="text-red-400">{stats.losses}</span>
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Win Rate:</span>
                                            <span className={stats.winRate >= 50 ? "text-green-400" : "text-red-400"}>{stats.winRate.toFixed(1)}%</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {hasData && (
                                <Link
                                    href={`/trades?date=${dateKey}`}
                                    className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-black/10 opacity-0 group-hover:pointer-events-auto group-hover:opacity-100"
                                >
                                    <span className="translate-y-2 rounded bg-sky-600 px-2 py-1 text-[10px] font-bold shadow-lg transition group-hover:translate-y-0">
                                        View Trades
                                    </span>
                                </Link>
                            )}
                        </div>
                    );
                });

                const sumIsProfit = weeklySum > 0;
                const sumIsLoss = weeklySum < 0;
                const weeklyWinLossTotal = weeklyWins + weeklyLosses;
                const weeklyWinRate = weeklyWinLossTotal > 0 ? (weeklyWins / weeklyWinLossTotal) * 100 : 0;

                const sumCell = (
                    <div key={`sum-${weekIdx}`} className="flex min-h-[140px] flex-col border-t border-gray-700/50 bg-gray-900/80 p-2 transition">
                        <span className="mb-1 text-[10px] font-bold uppercase text-gray-500">Week {weekIdx + 1}</span>

                        <div className="flex flex-1 flex-col justify-between text-xs">
                            <div className={cn(
                                "mb-2 text-center text-lg font-black",
                                sumIsProfit ? "text-green-400" : sumIsLoss ? "text-red-400" : "text-gray-400 shadow-none"
                            )}>
                                {showPnl ? formatPnlSpecial(weeklySum) : "---"}
                            </div>

                            <div className="space-y-1 text-[10px] text-gray-300">
                                <div className="flex justify-between">
                                    <span>Trades:</span>
                                    <span className="font-bold text-white">{weeklyTrades}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>W / L:</span>
                                    <span>
                                        <span className="text-green-400">{weeklyWins}</span> / <span className="text-red-400">{weeklyLosses}</span>
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Win Rate:</span>
                                    <span className={weeklyWinRate >= 50 ? "text-green-400" : "text-red-400"}>{weeklyWinRate.toFixed(1)}%</span>
                                </div>
                            </div>

                            {weeklySum !== 0 && (
                                <div className="mt-2 h-1 w-full overflow-hidden rounded-full border border-gray-700 bg-gray-800">
                                    <div
                                        className={cn("h-full", sumIsProfit ? "bg-green-500" : "bg-red-500")}
                                        style={{ width: `${Math.min(100, (Math.abs(weeklySum) / 10000) * 100)}%` }}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                );

                return [...weekCells, sumCell];
            })}
        </div>
    );
}

function MultiMonthCalendar({
    dailyData,
    months,

    showPnl,
}: {
    dailyData: Record<string, CalendarDailyStats>;
    months: { year: number; month: number }[];

    showPnl: boolean;
}) {
    return (
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {months.map((monthItem) => {
                const monthTotals = getMonthTotals(dailyData, monthItem.year, monthItem.month);
                const monthPnl = monthTotals.pnl;
                const monthIsProfit = monthPnl > 0;
                const monthIsLoss = monthPnl < 0;
                const weeks = buildCalendarWeeks(monthItem.year, monthItem.month, true);

                return (
                    <section key={`${monthItem.year}-${monthItem.month}`} className="overflow-hidden rounded-xl border border-gray-700 bg-gray-800/50 shadow-xl">
                        <div className="flex items-center justify-between gap-3 border-b border-gray-700 bg-gray-800 px-4 py-3">
                            <div>
                                <h3 className="text-base font-black text-white">{formatMonthYear(monthItem.year, monthItem.month)}</h3>
                                <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">{monthTotals.trades} trades</p>
                            </div>
                            <div className="min-w-[112px] rounded-lg border border-gray-700 bg-gray-900/60 px-3 py-2 text-right">
                                <span className="block text-[9px] font-bold uppercase tracking-wide text-gray-500">Total P&L</span>
                                <span className={cn(
                                    "block truncate text-sm font-black tabular-nums",
                                    monthIsProfit ? "text-green-400" : monthIsLoss ? "text-red-400" : "text-gray-400"
                                )}>
                                    {showPnl ? formatPnlSpecial(monthPnl) : "---"}
                                </span>
                            </div>
                        </div>

                        <div className="grid grid-cols-7 gap-px bg-gray-700">
                            {DAY_LABELS.map((day) => (
                                <div key={day} className="bg-gray-900/70 px-1 py-2 text-center text-[10px] font-black uppercase tracking-wide text-gray-500">
                                    {day}
                                </div>
                            ))}

                            {weeks.flatMap((week, weekIdx) => week.map((day, dayIdx) => {
                                if (day === null) {
                                    return (
                                        <div
                                            key={`empty-${monthItem.year}-${monthItem.month}-${weekIdx}-${dayIdx}`}
                                            className="min-h-[58px] border-r border-t border-gray-700/40 bg-gray-900/70"
                                        />
                                    );
                                }

                                const dateKey = getCalendarDateKey(monthItem.year, monthItem.month, day);
                                const stats = dailyData[dateKey];
                                const hasDayData = stats !== undefined;
                                const pnl = (stats?.pnl || 0);
                                const isProfit = pnl > 0;
                                const isLoss = pnl < 0;
                                const cellClassName = cn(
                                    "flex min-h-[58px] min-w-0 flex-col border-r border-t border-gray-700/40 p-1.5 text-center transition",
                                    hasDayData ? "items-center justify-between" : "items-start justify-start",
                                    hasDayData
                                        ? isProfit
                                            ? "bg-green-900/40 hover:bg-green-900/50"
                                            : isLoss
                                                ? "bg-red-900/40 hover:bg-red-900/50"
                                                : "bg-gray-800 hover:bg-gray-700/50"
                                        : "bg-gray-800/90"
                                );
                                const dayContent = (
                                    <>
                                        <span className={cn(
                                            "text-xs font-bold",
                                            hasDayData ? "text-gray-300" : "text-gray-500"
                                        )}>
                                            {day}
                                        </span>
                                        {hasDayData && (
                                            <span className={cn(
                                                "block w-full truncate text-[10px] font-black leading-tight tabular-nums",
                                                isProfit ? "text-green-400" : isLoss ? "text-red-400" : "text-gray-400"
                                            )}>
                                                {showPnl ? formatPnlSpecial(pnl) : "---"}
                                            </span>
                                        )}
                                    </>
                                );

                                if (!hasDayData) {
                                    return (
                                        <div key={dateKey} className={cellClassName}>
                                            {dayContent}
                                        </div>
                                    );
                                }

                                return (
                                    <Link key={dateKey} href={`/trades?date=${dateKey}`} className={cellClassName}>
                                        {dayContent}
                                    </Link>
                                );
                            }))}
                        </div>
                    </section>
                );
            })}
        </div>
    );
}
