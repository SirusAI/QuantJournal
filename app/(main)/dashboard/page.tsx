import { db } from "@/lib/db";
import { DashboardView } from "@/components/dashboard-view";

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
    const trades = await db.trade.findMany({
        orderBy: { date: 'asc' },
        include: { executions: true }
    });

    const plainTrades = trades.map((t) => ({
        ...t,
        grossPl: Number(t.grossPl),
        netPl: Number(t.netPl),
        initialBalance: Number(t.initialBalance || 0),
        mae: t.mae ? Number(t.mae) : 0,
        mfe: t.mfe ? Number(t.mfe) : 0,
        fee: t.executions.reduce((sum: number, e) => sum + Number(e.fee), 0),
        commission: 0, // Placeholder if column not exist
        executions: t.executions.map((e) => ({
            ...e,
            price: Number(e.price),
            fee: Number(e.fee),
            pnl: e.pnl ? Number(e.pnl) : 0
        }))
    }));

    return (
        <div className="p-8 space-y-8 bg-gray-900 min-h-screen text-white">
            <DashboardView initialTrades={plainTrades} />
        </div>
    );
}
