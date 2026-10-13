import { db } from "@/lib/db";
import { CalendarGrid } from "@/components/calendar-grid";
import {
    buildDailyCalendarStats,
    getCalendarDateRange,
    normalizeCalendarView,
} from "@/lib/calendar-stats";

export const dynamic = 'force-dynamic';

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ month?: string, year?: string, view?: string }> }) {
    const { month, year, view } = await searchParams;
    const now = new Date();

    // Parse params or use current date. Note: month is 0-indexed in JS Date, but we might pass 1-indexed or use Date parsing
    // Let's rely on basic integer parsing.
    const currentMonth = month ? parseInt(month) : now.getMonth();
    const currentYear = year ? parseInt(year) : now.getFullYear();
    const currentView = normalizeCalendarView(view);

    const { startDate, endDate } = getCalendarDateRange(currentYear, currentMonth, currentView);

    const trades = await db.trade.findMany({
        where: {
            date: {
                gte: startDate,
                lt: endDate
            }
        }
    });

    const dailyData = buildDailyCalendarStats(trades);

    return (
        <div className="p-8 bg-gray-900 min-h-screen text-white">
            <CalendarGrid dailyData={dailyData} year={currentYear} month={currentMonth} view={currentView} />
        </div>
    );
}
