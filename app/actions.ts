"use server";

import { computeImportedMetrics, signedImportedQuantity } from "@/lib/import-metrics";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getMarketData } from "@/lib/market-data";

export async function fetchMarketDataAction(symbol: string, dateStr: string) {
    return await getMarketData(symbol, dateStr);
}

export async function updateTradeNotes(tradeId: string, notes: string) {
    try {
        await db.trade.update({
            where: { id: tradeId },
            data: { notes }
        });
        revalidatePath("/trades");
        revalidatePath(`/trades/${tradeId}`);
        revalidatePath("/journal");
        return { success: true };
    } catch (error) {
        console.error("Failed to update notes:", error);
        return { success: false, error: "Failed to update notes" };
    }
}

export async function updateExecution(executionId: string, data: { time?: string, side?: string, quantity?: number, price?: number, fee?: number, pnl?: number | null }) {
    try {
        const execution = await db.execution.findUnique({ where: { id: executionId } });
        if (!execution) return { success: false, error: "Execution not found." };
        await db.$transaction(async tx => {
            const trade = await tx.trade.findUniqueOrThrow({ where: { id: execution.tradeId }, include: { executions: true } });
            const quantity = signedImportedQuantity({ side: data.side ?? execution.side, quantity: data.quantity ?? execution.quantity });
            const time = data.time ? new Date(data.time) : execution.time;
            const price = data.price ?? Number(execution.price), fee = data.fee ?? Number(execution.fee);
            if (!Number.isFinite(time.getTime()) || !Number.isInteger(quantity) || quantity === 0 || !Number.isFinite(price) || price <= 0 || !Number.isFinite(fee) || (data.pnl !== undefined && data.pnl !== null && !Number.isFinite(data.pnl))) throw new Error("Check the execution time, price, whole-share quantity and fees.");
            const pnl = data.pnl !== undefined ? data.pnl : execution.pnl === null ? null : Number(execution.pnl);
            const projected = trade.executions.map(e => e.id === executionId ? { ...e, time, price, fee, quantity, side: data.side ?? e.side, pnl } : e).sort((a,b) => a.time.getTime() - b.time.getTime());
            const metrics = computeImportedMetrics(projected.map(e => ({ side: e.side, quantity: e.quantity, price: Number(e.price), fee: Number(e.fee), reportedPnl: trade.isManualPnl ? 0 : e.pnl === null ? null : Number(e.pnl) })));
            await tx.execution.update({ where: { id: executionId }, data: { time, side: data.side ?? execution.side, quantity, price, fee, pnl } });
            await tx.trade.update({ where: { id: trade.id }, data: { volume: metrics.volume, direction: signedImportedQuantity(projected[0]) < 0 ? "SHORT" : "LONG", grossPl: trade.isManualPnl ? Number(trade.netPl ?? 0) + metrics.fees : metrics.grossPl, ...(trade.isManualPnl ? {} : { netPl: metrics.netPl, winLoss: metrics.netPl > 0 ? "WIN" : metrics.netPl < 0 ? "LOSS" : "BREAK_EVEN" }) } });
        });
        for (const path of ["/dashboard", "/calendar", "/reports", "/trades", "/journal", `/journal/${execution.tradeId}`]) revalidatePath(path);
        return { success: true };
    } catch (error) { return { success: false, error: error instanceof Error ? error.message : "Execution could not be saved." }; }
}

export async function addTagToTrade(tradeId: string, tagName: string) {
    try {
        const normalizedName = tagName.trim();
        if (!normalizedName) return { success: false, error: "Tag name cannot be empty" };

        const tag = await db.tag.upsert({
            where: { name: normalizedName },
            update: {},
            create: { name: normalizedName }
        });

        await db.trade.update({
            where: { id: tradeId },
            data: {
                tags: {
                    connect: { id: tag.id }
                }
            }
        });
        revalidatePath("/trades");
        revalidatePath(`/trades/${tradeId}`);
        revalidatePath("/journal");
        revalidatePath("/reports");
        return { success: true, tag };
    } catch (error) {
        console.error("Failed to add tag:", error);
        return { success: false, error: "Failed to add tag" };
    }
}

export async function addTagToTrades(tradeIds: string[], tagName: string) {
    try {
        const normalizedName = tagName.trim();
        if (!normalizedName) return { success: false, error: "Tag name cannot be empty" };

        const tag = await db.tag.upsert({
            where: { name: normalizedName },
            update: {},
            create: { name: normalizedName }
        });

        await db.$transaction(
            tradeIds.map(id =>
                db.trade.update({
                    where: { id },
                    data: {
                        tags: {
                            connect: { id: tag.id }
                        }
                    }
                })
            )
        );

        revalidatePath("/trades");
        revalidatePath("/journal");
        revalidatePath("/reports");
        return { success: true, tag };
    } catch (error) {
        console.error("Failed to batch add tags:", error);
        return { success: false, error: "Failed to batch add tags" };
    }
}

export async function removeTagFromTrade(tradeId: string, tagId: string) {
    try {
        await db.trade.update({
            where: { id: tradeId },
            data: {
                tags: {
                    disconnect: { id: tagId }
                }
            }
        });
        revalidatePath("/trades");
        revalidatePath(`/trades/${tradeId}`);
        revalidatePath("/journal");
        revalidatePath("/reports");
        return { success: true };
    } catch (error) {
        console.error("Failed to remove tag:", error);
        return { success: false, error: "Failed to remove tag" };
    }
}
