export const ENTRY_QUALITY_OPTIONS = [
    "PLAN_FOLLOWED",
    "CHASED_IMPULSIVE",
] as const;

export const EXIT_QUALITY_OPTIONS = [
    "EXITED_TO_PLAN",
    "CUT_WINNER_EARLY",
    "MOVED_STOP_LET_LOSER_RUN",
] as const;

export const RISK_QUALITY_OPTIONS = [
    "PLAN_FOLLOWED",
    "OVERSIZED",
    "UNDERSIZED",
    "NO_CLEAR_RISK_PLAN",
] as const;

export const PSYCHOLOGY_OPTIONS = [
    "Calm",
    "Focused",
    "Anxious",
    "Fearful",
    "Greedy",
    "FOMO",
    "Revenge Trading",
    "Frustrated / Tilted",
    "Hesitant",
    "Overconfident",
] as const;

export type EntryQuality = (typeof ENTRY_QUALITY_OPTIONS)[number];
export type ExitQuality = (typeof EXIT_QUALITY_OPTIONS)[number];
export type RiskQuality = (typeof RISK_QUALITY_OPTIONS)[number];
export type PsychologyTag = (typeof PSYCHOLOGY_OPTIONS)[number];

export interface TradeReviewInput {
    entryQuality: EntryQuality | null;
    entryNotes: string;
    exitQuality: ExitQuality | null;
    exitNotes: string;
    psychologyTags: PsychologyTag[];
    psychologyNotes: string;
    riskQuality: RiskQuality | null;
    riskNotes: string;
    lessonNotes: string;
    additionalNotes: string;
}

export const EMPTY_TRADE_REVIEW: TradeReviewInput = {
    entryQuality: null,
    entryNotes: "",
    exitQuality: null,
    exitNotes: "",
    psychologyTags: [],
    psychologyNotes: "",
    riskQuality: null,
    riskNotes: "",
    lessonNotes: "",
    additionalNotes: "",
};

export function parsePsychologyTags(value: string | null | undefined): PsychologyTag[] {
    if (!value) return [];
    try {
        const parsed = JSON.parse(value);
        if (!Array.isArray(parsed)) return [];
        return parsed.filter((tag): tag is PsychologyTag =>
            typeof tag === "string" && (PSYCHOLOGY_OPTIONS as readonly string[]).includes(tag)
        );
    } catch {
        return [];
    }
}
