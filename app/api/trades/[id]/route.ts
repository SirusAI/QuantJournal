import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;

        // Delete executions first (cascade should handle this but explicit is safer or if relation requires it)
        await db.execution.deleteMany({
            where: { tradeId: id }
        });

        await db.trade.delete({
            where: { id }
        });

        return NextResponse.json({ success: true });
    } catch (e) {
        console.error("Delete error:", e);
        return NextResponse.json({ error: "Failed to delete trade" }, { status: 500 });
    }
}
