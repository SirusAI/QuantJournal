import { db } from "@/lib/db";
import { TradesTable } from "@/components/trades-table";

export const dynamic = 'force-dynamic';

export default async function TradesPage() {
    const trades = await db.trade.findMany({
        orderBy: { date: 'desc' },
        include: {
            _count: { select: { executions: true } },
            executions: true,
            tags: true
        }
    });

    // Convert Decimal to number for client compatibility
    // Convert Decimal to number for client compatibility
    const serializedTrades = trades.map((t) => ({
        ...t,

        netPl: Number(t.netPl),
        grossPl: Number(t.grossPl),
        initialBalance: Number(t.initialBalance || 0),
        mae: t.mae ? Number(t.mae) : 0,
        mfe: t.mfe ? Number(t.mfe) : 0,
        volume: Number(t.volume),
        date: t.date.toISOString(),
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
        executions: t.executions.map((ex) => ({
            ...ex,
            price: Number(ex.price),
            fee: Number(ex.fee),
            pnl: ex.pnl ? Number(ex.pnl) : 0
        }))
    }));

    return (
        <div className="p-8 space-y-8 bg-gray-900 min-h-screen text-white">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Trades</h2>
                    <p className="text-gray-400">Review all your trade executions and performance.</p>
                </div>
            </div>

            <TradesTable trades={serializedTrades} />
        </div>
    );
}

