import { db } from "@/lib/db";
import { JournalView } from "@/components/journal-view";
import { getNewYorkDayKey } from "@/lib/trading-day";
import { parsePsychologyTags } from "@/lib/trade-review";

export const dynamic = 'force-dynamic';

export default async function JournalPage() {
    const [trades, dailyEntries] = await Promise.all([
        db.trade.findMany({
            orderBy: { date: 'desc' },
            include: {
                executions: true,
                tags: true,
                review: true,
                _count: { select: { executions: true } }
            }
        }),
        db.dailyJournalEntry.findMany({ orderBy: { entryDate: "desc" } }),
    ]);

    const serializedTrades = trades.map((trade) => ({
        ...trade,

        netPl: Number(trade.netPl),
        grossPl: Number(trade.grossPl),
        initialBalance: Number(trade.initialBalance || 0),
        volume: Number(trade.volume),
        date: trade.date.toISOString(),
        createdAt: trade.createdAt.toISOString(),
        updatedAt: trade.updatedAt.toISOString(),
        dateKey: trade.date.toISOString().split("T")[0],
        executions: trade.executions.map((ex) => ({
            ...ex,
            price: Number(ex.price),
            fee: Number(ex.fee),
            pnl: ex.pnl !== null ? Number(ex.pnl) : null,
            time: ex.time.toISOString(),
        })),
        tags: trade.tags.map((tag) => ({ ...tag })),
        review: trade.review ? {
            entryQuality: trade.review.entryQuality,
            entryNotes: trade.review.entryNotes || "",
            exitQuality: trade.review.exitQuality,
            exitNotes: trade.review.exitNotes || "",
            psychologyTags: parsePsychologyTags(trade.review.psychologyTags),
            psychologyNotes: trade.review.psychologyNotes || "",
            riskQuality: trade.review.riskQuality,
            riskNotes: trade.review.riskNotes || "",
            lessonNotes: trade.review.lessonNotes || "",
            updatedAt: trade.review.updatedAt.toISOString(),
        } : null,
    }));

    const serializedDailyEntries = dailyEntries.map((entry) => ({
        entryDate: entry.entryDate,
        content: entry.content,
        updatedAt: entry.updatedAt.toISOString(),
    }));
    const todayDate = getNewYorkDayKey(new Date());
    const latestTradeDate = serializedTrades[0]?.dateKey;
    const latestNoteDate = serializedDailyEntries[0]?.entryDate;
    const initialDate = [latestTradeDate, latestNoteDate].filter(Boolean).sort().at(-1) || todayDate;

    return (
        <div className="p-8 space-y-8 bg-gray-900 min-h-screen text-white">
            <JournalView initialTrades={serializedTrades} dailyEntries={serializedDailyEntries} initialDate={initialDate} todayDate={todayDate} />
        </div>
    );
}

