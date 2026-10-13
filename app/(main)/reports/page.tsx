import { db } from "@/lib/db";
import { ReportsView } from "@/components/reports-view";

export const dynamic = 'force-dynamic';

export default async function ReportsPage() {
    const trades = await db.trade.findMany({
        include: {
            executions: true,
            tags: true,
        },
        orderBy: {
            date: 'desc'
        }
    });

    const serializedTrades = trades.map(trade => {
        const executions = trade.executions.map(ex => ({
            ...ex,
            price: Number(ex.price),
            fee: Number(ex.fee),
            pnl: ex.pnl ? Number(ex.pnl) : 0
        }));

        const totalFees = executions.reduce((sum, ex) => sum + ex.fee, 0);

        // Duration Logic
        let duration = 0;
        if (executions.length > 1) {
            const times = executions.map(ex => new Date(ex.time).getTime());
            const minTime = Math.min(...times);
            const maxTime = Math.max(...times);
            duration = (maxTime - minTime) / (1000 * 60); // Minutes
        }

        return {
            ...trade,
            grossPl: trade.grossPl ? Number(trade.grossPl) : 0,
            netPl: trade.netPl ? Number(trade.netPl) : 0,
            initialBalance: trade.initialBalance ? Number(trade.initialBalance) : 0,
            mae: trade.mae ? Number(trade.mae) : 0,
            mfe: trade.mfe ? Number(trade.mfe) : 0,
            fee: totalFees,
            commission: totalFees, // Assuming commission is fee for now
            duration,
            executions
        };
    });

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold tracking-tight text-white">Reports</h1>
            </div>
            <ReportsView trades={serializedTrades} />
        </div>
    );
}
