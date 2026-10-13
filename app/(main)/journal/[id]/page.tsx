import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { TradeDetailView } from "@/components/trade-detail-view";
import { parsePsychologyTags } from "@/lib/trade-review";

export const dynamic = 'force-dynamic';

export default async function TradeDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    const trade = await db.trade.findUnique({
        where: { id },
        include: { executions: true, tags: true, review: true }
    });

    if (!trade) {
        notFound();
    }


    // Convert Decimal and Date to plain types for client component
    const serializedTrade = {
        ...trade,

        netPl: Number(trade.netPl),
        grossPl: Number(trade.grossPl),
        initialBalance: Number(trade.initialBalance || 0),
        volume: Number(trade.volume),
        date: trade.date.toISOString(),
        createdAt: trade.createdAt.toISOString(),
        updatedAt: trade.updatedAt.toISOString(),
        executions: trade.executions.map((ex) => ({
            ...ex,
            price: Number(ex.price),
            fee: Number(ex.fee),
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
    };

    return (
        <div className="p-8 bg-gray-900 min-h-screen">
            <TradeDetailView trade={serializedTrade} chartData={[]} />
        </div>
    );
}
