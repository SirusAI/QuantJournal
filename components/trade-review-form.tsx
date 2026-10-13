"use client";
import { useJournal } from "@/components/journal-runtime";

import { useMemo, useState } from "react";
import { Brain, CheckCircle2, ChevronDown, ChevronUp, CircleAlert, Loader2, Save, Sparkles } from "lucide-react";


import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
    ENTRY_QUALITY_OPTIONS,
    EntryQuality,
    EXIT_QUALITY_OPTIONS,
    ExitQuality,
    PSYCHOLOGY_OPTIONS,
    PsychologyTag,
    RISK_QUALITY_OPTIONS,
    RiskQuality,
    TradeReviewInput,
} from "@/lib/trade-review";
import { cn } from "@/lib/utils";

interface TradeReviewFormProps {
    tradeId: string;
    initialReview: TradeReviewInput;
    initialUpdatedAt?: string | null;
}

type SaveState = "idle" | "saving" | "saved" | "failed";

const entryLabels: Record<EntryQuality, string> = {
    PLAN_FOLLOWED: "Plan followed",
    CHASED_IMPULSIVE: "Chased / Impulsive",
};

const exitLabels: Record<ExitQuality, string> = {
    EXITED_TO_PLAN: "Exited according to plan",
    CUT_WINNER_EARLY: "Cut winner too early (Fear)",
    MOVED_STOP_LET_LOSER_RUN: "Moved stop loss / let loser run (Hope)",
};

const riskLabels: Record<RiskQuality, string> = {
    PLAN_FOLLOWED: "Plan followed",
    OVERSIZED: "Oversized",
    UNDERSIZED: "Undersized",
    NO_CLEAR_RISK_PLAN: "No clear risk plan",
};

function ChoiceButton({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
    return (
        <button
            type="button"
            aria-pressed={selected}
            onClick={onClick}
            className={cn(
                "rounded-lg border px-3 py-2 text-left text-sm font-medium transition-all",
                selected
                    ? "border-emerald-400/70 bg-emerald-500/15 text-emerald-200 shadow-sm shadow-emerald-950"
                    : "border-gray-700 bg-gray-950/50 text-gray-400 hover:border-gray-500 hover:text-white"
            )}
        >
            {children}
        </button>
    );
}

function QuestionCard({ number, title, question, children, className }: {
    number: number;
    title: string;
    question: string;
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <section className={cn("space-y-4 rounded-2xl border border-gray-700/80 bg-gray-900/55 p-5", className)}>
            <div className="flex items-start gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-500/15 text-sm font-black text-sky-300 ring-1 ring-sky-500/25">
                    {number}
                </span>
                <div>
                    <h4 className="font-bold text-white">{title}</h4>
                    <p className="mt-1 text-sm leading-6 text-gray-400">{question}</p>
                </div>
            </div>
            {children}
        </section>
    );
}

export function TradeReviewForm({ tradeId, initialReview, initialUpdatedAt = null }: TradeReviewFormProps) {
 const client = useJournal();
 const { saveTradeReview } = client;
    const [isExpanded, setIsExpanded] = useState(false);
    const [review, setReview] = useState<TradeReviewInput>(initialReview);
    const [savedSnapshot, setSavedSnapshot] = useState(() => JSON.stringify(initialReview));
    const [updatedAt, setUpdatedAt] = useState(initialUpdatedAt);
    const [saveState, setSaveState] = useState<SaveState>("idle");
    const [error, setError] = useState("");

    const snapshot = JSON.stringify(review);
    const isDirty = snapshot !== savedSnapshot;
    const completedSections = useMemo(() => [
        Boolean(review.entryQuality || review.entryNotes.trim()),
        Boolean(review.exitQuality || review.exitNotes.trim()),
        Boolean(review.psychologyTags.length || review.psychologyNotes.trim()),
        Boolean(review.riskQuality || review.riskNotes.trim()),
        Boolean(review.lessonNotes.trim()),
    ].filter(Boolean).length, [review]);

    const updateReview = <K extends keyof TradeReviewInput>(key: K, value: TradeReviewInput[K]) => {
        setReview((current) => ({ ...current, [key]: value }));
        setSaveState("idle");
        setError("");
    };

    const togglePsychology = (tag: PsychologyTag) => {
        const next = review.psychologyTags.includes(tag)
            ? review.psychologyTags.filter((item) => item !== tag)
            : [...review.psychologyTags, tag];
        updateReview("psychologyTags", next);
    };

    const handleSave = async () => {
        setSaveState("saving");
        setError("");
        const result = await saveTradeReview(tradeId, review);
        if (!result.success) {
            setSaveState("failed");
            setError(result.error);
            return;
        }
        setSavedSnapshot(snapshot);
        setUpdatedAt(result.updatedAt);
        setSaveState("saved");
    };

    const statusLabel = saveState === "saving" ? "Saving..." : saveState === "failed" ? "Failed" : isDirty ? "Unsaved" : saveState === "saved" ? "Saved" : "No changes";
    const statusClass = saveState === "failed" ? "text-red-400" : isDirty ? "text-amber-400" : saveState === "saved" ? "text-emerald-400" : "text-gray-500";

    return (
        <Card className="overflow-hidden border-purple-500/20 bg-gradient-to-br from-gray-800 to-gray-900 text-white shadow-2xl">
            <CardHeader className={cn("bg-purple-500/[0.04]", isExpanded && "border-b border-gray-700/70")}>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2 text-xl">
                            <Brain className="h-5 w-5 text-purple-400" /> The Review
                            <span className="rounded-full bg-purple-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-purple-300">Process over outcome</span>
                        </CardTitle>
                        <p className="mt-2 text-sm text-gray-400">Be honest, stay specific, and turn the trade into a repeatable lesson.</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="text-right">
                            <div className="text-sm font-bold text-white">{completedSections}/5 sections</div>
                            <div className="mt-1 h-1.5 w-28 overflow-hidden rounded-full bg-gray-700">
                                <div className="h-full rounded-full bg-purple-500 transition-all" style={{ width: `${completedSections * 20}%` }} />
                            </div>
                        </div>
                        <Sparkles className="h-5 w-5 text-purple-400" />
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            aria-expanded={isExpanded}
                            aria-controls={`trade-review-${tradeId}`}
                            onClick={() => setIsExpanded((expanded) => !expanded)}
                            className="min-w-28 border border-purple-500/20 bg-purple-500/10 text-purple-200 hover:bg-purple-500/20 hover:text-white"
                        >
                            {isExpanded ? (
                                <><ChevronUp className="mr-1.5 h-4 w-4" /> Fold</>
                            ) : (
                                <><ChevronDown className="mr-1.5 h-4 w-4" /> Open Review</>
                            )}
                        </Button>
                    </div>
                </div>
            </CardHeader>
            {isExpanded && <CardContent id={`trade-review-${tradeId}`} className="space-y-6 p-5 sm:p-6">
                <div className="grid gap-5 xl:grid-cols-2">
                    <QuestionCard number={1} title="Entry Quality" question="Did I wait for my trigger, or did I jump the gun out of FOMO?">
                        <div className="grid gap-2 sm:grid-cols-2">
                            {ENTRY_QUALITY_OPTIONS.map((option) => (
                                <ChoiceButton key={option} selected={review.entryQuality === option} onClick={() => updateReview("entryQuality", review.entryQuality === option ? null : option)}>
                                    {entryLabels[option]}
                                </ChoiceButton>
                            ))}
                        </div>
                        <Textarea value={review.entryNotes} onChange={(event) => updateReview("entryNotes", event.target.value)} placeholder="What did you see, and why did you enter?" className="min-h-28 resize-y border-gray-700 bg-gray-950/70 leading-6" />
                    </QuestionCard>

                    <QuestionCard number={2} title="Management & Exit Quality" question="Did I honor my stop loss and take-profit targets exactly?">
                        <div className="grid gap-2">
                            {EXIT_QUALITY_OPTIONS.map((option) => (
                                <ChoiceButton key={option} selected={review.exitQuality === option} onClick={() => updateReview("exitQuality", review.exitQuality === option ? null : option)}>
                                    {exitLabels[option]}
                                </ChoiceButton>
                            ))}
                        </div>
                        <Textarea value={review.exitNotes} onChange={(event) => updateReview("exitNotes", event.target.value)} placeholder="Explain your management and exit decisions." className="min-h-28 resize-y border-gray-700 bg-gray-950/70 leading-6" />
                    </QuestionCard>

                    <QuestionCard number={3} title="Psychology Gauge" question="What was my mental state during this trade?">
                        <div className="flex flex-wrap gap-2">
                            {PSYCHOLOGY_OPTIONS.map((tag) => (
                                <ChoiceButton key={tag} selected={review.psychologyTags.includes(tag)} onClick={() => togglePsychology(tag)}>{tag}</ChoiceButton>
                            ))}
                        </div>
                        <Textarea value={review.psychologyNotes} onChange={(event) => updateReview("psychologyNotes", event.target.value)} placeholder="What triggered these emotions, and how did they affect your decisions?" className="min-h-28 resize-y border-gray-700 bg-gray-950/70 leading-6" />
                    </QuestionCard>

                    <QuestionCard number={4} title="Risk & Sizing Discipline" question="Was my position size and initial risk clearly defined and within my plan?">
                        <div className="grid gap-2 sm:grid-cols-2">
                            {RISK_QUALITY_OPTIONS.map((option) => (
                                <ChoiceButton key={option} selected={review.riskQuality === option} onClick={() => updateReview("riskQuality", review.riskQuality === option ? null : option)}>
                                    {riskLabels[option]}
                                </ChoiceButton>
                            ))}
                        </div>
                        <Textarea value={review.riskNotes} onChange={(event) => updateReview("riskNotes", event.target.value)} placeholder="Explain any sizing or risk deviation." className="min-h-28 resize-y border-gray-700 bg-gray-950/70 leading-6" />
                    </QuestionCard>

                    <QuestionCard number={5} title="Lesson & Next Action" question="What worked, what needs improvement, and what is one specific action I will take next time?" className="xl:col-span-2">
                        <Textarea value={review.lessonNotes} onChange={(event) => updateReview("lessonNotes", event.target.value)} placeholder="Write the lesson you want your future self to remember..." className="min-h-36 resize-y border-gray-700 bg-gray-950/70 leading-6" />
                    </QuestionCard>
                </div>

                <section className="space-y-3 rounded-2xl border border-gray-700/80 bg-gray-950/35 p-5">
                    <div>
                        <h4 className="font-bold text-white">Additional Notes <span className="font-normal text-gray-500">(Optional)</span></h4>
                        <p className="mt-1 text-sm text-gray-500">Your previous free-form trade notes are preserved here.</p>
                    </div>
                    <Textarea value={review.additionalNotes} onChange={(event) => updateReview("additionalNotes", event.target.value)} placeholder="Anything else worth remembering about this trade..." className="min-h-28 resize-y border-gray-700 bg-gray-950/70 leading-6" />
                </section>

                <div className="flex flex-col gap-3 border-t border-gray-700 pt-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-sm">
                        <span className={cn("inline-flex items-center gap-1.5 font-medium", statusClass)}>
                            {saveState === "saving" ? <Loader2 className="h-4 w-4 animate-spin" /> : saveState === "saved" && !isDirty ? <CheckCircle2 className="h-4 w-4" /> : <CircleAlert className="h-4 w-4" />}
                            {statusLabel}
                        </span>
                        {updatedAt && !isDirty && <span className="ml-2 text-gray-600">Last saved {new Date(updatedAt).toLocaleString()}</span>}
                        {error && <span className="ml-2 text-red-400">{error}</span>}
                    </div>
                    <Button onClick={handleSave} disabled={!isDirty || saveState === "saving"} className="min-w-44 bg-emerald-600 font-bold text-white hover:bg-emerald-500 disabled:bg-gray-700">
                        {saveState === "saving" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Save Trade Review
                    </Button>
                </div>
            </CardContent>}
        </Card>
    );
}
