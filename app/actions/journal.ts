"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { isValidDateKey } from "@/lib/trading-day";
import {
    ENTRY_QUALITY_OPTIONS,
    EXIT_QUALITY_OPTIONS,
    PSYCHOLOGY_OPTIONS,
    RISK_QUALITY_OPTIONS,
    TradeReviewInput,
} from "@/lib/trade-review";

const MAX_DAILY_NOTE_LENGTH = 100_000;
const MAX_REVIEW_TEXT_LENGTH = 20_000;

function cleanText(value: unknown, maxLength: number): string {
    if (typeof value !== "string") return "";
    return value.slice(0, maxLength);
}

function isAllowed<T extends string>(value: unknown, options: readonly T[]): value is T {
    return typeof value === "string" && options.includes(value as T);
}

export async function saveDailyJournalEntry(entryDate: string, content: string) {
    if (!isValidDateKey(entryDate)) {
        return { success: false as const, error: "Invalid journal date." };
    }

    if (typeof content !== "string" || content.length > MAX_DAILY_NOTE_LENGTH) {
        return { success: false as const, error: "Daily note is too long." };
    }

    try {
        const entry = await db.dailyJournalEntry.upsert({
            where: { entryDate },
            update: { content },
            create: { entryDate, content },
        });
        revalidatePath("/journal");
        return { success: true as const, updatedAt: entry.updatedAt.toISOString() };
    } catch (error) {
        console.error("Failed to save daily journal entry:", error);
        return { success: false as const, error: "Failed to save daily note." };
    }
}

export async function saveTradeReview(tradeId: string, input: TradeReviewInput) {
    if (!tradeId || !input || typeof input !== "object") {
        return { success: false as const, error: "Invalid trade review." };
    }

    if (input.entryQuality !== null && !isAllowed(input.entryQuality, ENTRY_QUALITY_OPTIONS)) {
        return { success: false as const, error: "Invalid entry quality selection." };
    }
    if (input.exitQuality !== null && !isAllowed(input.exitQuality, EXIT_QUALITY_OPTIONS)) {
        return { success: false as const, error: "Invalid exit quality selection." };
    }
    if (input.riskQuality !== null && !isAllowed(input.riskQuality, RISK_QUALITY_OPTIONS)) {
        return { success: false as const, error: "Invalid risk quality selection." };
    }
    if (!Array.isArray(input.psychologyTags)) {
        return { success: false as const, error: "Invalid psychology selection." };
    }

    const psychologyTags = [...new Set(input.psychologyTags)];
    if (psychologyTags.some((tag) => !isAllowed(tag, PSYCHOLOGY_OPTIONS))) {
        return { success: false as const, error: "Invalid psychology selection." };
    }

    const textFields = [
        input.entryNotes,
        input.exitNotes,
        input.psychologyNotes,
        input.riskNotes,
        input.lessonNotes,
        input.additionalNotes,
    ];
    if (textFields.some((value) => typeof value !== "string" || value.length > MAX_REVIEW_TEXT_LENGTH)) {
        return { success: false as const, error: "A review response is too long." };
    }

    try {
        const reviewData = {
            entryQuality: input.entryQuality,
            entryNotes: cleanText(input.entryNotes, MAX_REVIEW_TEXT_LENGTH),
            exitQuality: input.exitQuality,
            exitNotes: cleanText(input.exitNotes, MAX_REVIEW_TEXT_LENGTH),
            psychologyTags: JSON.stringify(psychologyTags),
            psychologyNotes: cleanText(input.psychologyNotes, MAX_REVIEW_TEXT_LENGTH),
            riskQuality: input.riskQuality,
            riskNotes: cleanText(input.riskNotes, MAX_REVIEW_TEXT_LENGTH),
            lessonNotes: cleanText(input.lessonNotes, MAX_REVIEW_TEXT_LENGTH),
        };

        const [, review] = await db.$transaction([
            db.trade.update({
                where: { id: tradeId },
                data: { notes: cleanText(input.additionalNotes, MAX_REVIEW_TEXT_LENGTH) },
            }),
            db.tradeReview.upsert({
                where: { tradeId },
                update: reviewData,
                create: { tradeId, ...reviewData },
            }),
        ]);

        revalidatePath("/journal");
        revalidatePath(`/journal/${tradeId}`);
        revalidatePath("/trades");
        return { success: true as const, updatedAt: review.updatedAt.toISOString() };
    } catch (error) {
        console.error("Failed to save trade review:", error);
        return { success: false as const, error: "Failed to save trade review." };
    }
}
