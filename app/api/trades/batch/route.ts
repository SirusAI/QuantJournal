import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { ids } = body;

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return NextResponse.json({ error: "Invalid IDs" }, { status: 400 });
        }

        // Delete multiple trades
        // Executions will cascade delete if relations are set up, but safer to delete manual if Prisma setup is unsure.
        // Assuming cascade for simplicity or explicit delete if needed.
        // Let's do explicit delete of executions first to be safe.
        await db.execution.deleteMany({
            where: { tradeId: { in: ids } }
        });

        const result = await db.trade.deleteMany({
            where: { id: { in: ids } }
        });

        return NextResponse.json({ success: true, count: result.count });
    } catch (e) {
        console.error("Batch delete error:", e);
        return NextResponse.json({ error: "Failed to delete trades" }, { status: 500 });
    }
}
