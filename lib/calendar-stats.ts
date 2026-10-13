export type CalendarView = "month" | "3m" | "6m" | "12m";

export interface CalendarDailyStats {
    pnl: number;
    trades: number;
    wins: number;
    losses: number;
    winRate: number;
    volume?: number;
}

interface CalendarTrade {
    date: Date | string;
    netPl: unknown;
    winLoss?: string | null;
    volume?: number | null;
}

export const CALENDAR_VIEW_MONTH_COUNTS: Record<CalendarView, number> = {
    month: 1,
    "3m": 3,
    "6m": 6,
    "12m": 12,
};

export function normalizeCalendarView(view: string | undefined): CalendarView {
    if (view === "3m" || view === "6m" || view === "12m") return view;
    return "month";
}

export function getCalendarDateRange(year: number, month: number, view: CalendarView) {
    const monthCount = CALENDAR_VIEW_MONTH_COUNTS[view];

    return {
        startDate: new Date(year, month - (monthCount - 1), 1),
        endDate: new Date(year, month + 1, 1),
    };
}

export function getCalendarMonths(year: number, month: number, view: CalendarView) {
    const monthCount = CALENDAR_VIEW_MONTH_COUNTS[view];

    return Array.from({ length: monthCount }, (_, index) => {
        const date = new Date(year, month - index, 1);
        return {
            year: date.getFullYear(),
            month: date.getMonth(),
        };
    });
}

export function getCalendarDateKey(year: number, month: number, day: number) {
    return new Date(Date.UTC(year, month, day)).toISOString().split("T")[0];
}

export function buildCalendarWeeks(year: number, month: number, fillToSixWeeks = false): (number | null)[][] {
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const calendarWeeks: (number | null)[][] = [];
    let currentWeek: (number | null)[] = [];

    for (let i = 0; i < firstDayOfMonth; i++) {
        currentWeek.push(null);
    }

    for (let day = 1; day <= daysInMonth; day++) {
        currentWeek.push(day);

        if (currentWeek.length === 7) {
            calendarWeeks.push(currentWeek);
            currentWeek = [];
        }
    }

    if (currentWeek.length > 0) {
        while (currentWeek.length < 7) {
            currentWeek.push(null);
        }
        calendarWeeks.push(currentWeek);
    }

    if (fillToSixWeeks) {
        while (calendarWeeks.length < 6) {
            calendarWeeks.push([null, null, null, null, null, null, null]);
        }
    }

    return calendarWeeks;
}

export function buildDailyCalendarStats(trades: CalendarTrade[]): Record<string, CalendarDailyStats> {
    const dailyData: Record<string, CalendarDailyStats> = {};

    trades.forEach((trade) => {
        const dateKey = new Date(trade.date).toISOString().split("T")[0];
        const rawPnl = Number(trade.netPl ?? 0);
        const pnl = Number.isFinite(rawPnl) ? rawPnl : 0;

        if (!dailyData[dateKey]) {
            dailyData[dateKey] = { pnl: 0, trades: 0, wins: 0, losses: 0, winRate: 0 };
        }

        dailyData[dateKey].pnl += pnl;
        dailyData[dateKey].trades += 1;
        dailyData[dateKey].volume = (dailyData[dateKey].volume ?? 0) + Number(trade.volume ?? 0);

        if (trade.winLoss === "WIN") {
            dailyData[dateKey].wins += 1;
        } else if (trade.winLoss === "LOSS") {
            dailyData[dateKey].losses += 1;
        } else if (pnl > 0) {
            dailyData[dateKey].wins += 1;
        } else if (pnl < 0) {
            dailyData[dateKey].losses += 1;
        }
    });

    Object.values(dailyData).forEach((day) => {
        const winLossTotal = day.wins + day.losses;
        day.winRate = winLossTotal > 0 ? (day.wins / winLossTotal) * 100 : 0;
    });

    return dailyData;
}
