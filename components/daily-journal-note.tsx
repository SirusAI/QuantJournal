"use client";
import { useJournal } from "@/components/journal-runtime";

import { useState } from "react";
import { BookOpenText, CheckCircle2, CircleAlert, Loader2, Save } from "lucide-react";


import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { formatDateForDisplay } from "@/lib/trading-day";

interface DailyJournalNoteProps {
    entryDate: string;
    initialContent: string;
    initialUpdatedAt: string | null;
}

type SaveState = "idle" | "saving" | "saved" | "failed";

export function DailyJournalNote({ entryDate, initialContent, initialUpdatedAt }: DailyJournalNoteProps) {
 const client = useJournal();
 const { saveDailyJournalEntry } = client;
    const [content, setContent] = useState(initialContent);
    const [savedContent, setSavedContent] = useState(initialContent);
    const [updatedAt, setUpdatedAt] = useState(initialUpdatedAt);
    const [saveState, setSaveState] = useState<SaveState>("idle");
    const [error, setError] = useState("");
    const isDirty = content !== savedContent;

    const handleSave = async () => {
        setSaveState("saving");
        setError("");
        const result = await saveDailyJournalEntry(entryDate, content);
        if (!result.success) {
            setSaveState("failed");
            setError(result.error);
            return;
        }
        setSavedContent(content);
        setUpdatedAt(result.updatedAt);
        setSaveState("saved");
    };

    const status = saveState === "saving"
        ? { label: "Saving...", icon: Loader2, className: "text-sky-400", spin: true }
        : saveState === "failed"
            ? { label: "Failed", icon: CircleAlert, className: "text-red-400", spin: false }
            : isDirty
                ? { label: "Unsaved", icon: CircleAlert, className: "text-amber-400", spin: false }
                : saveState === "saved"
                    ? { label: "Saved", icon: CheckCircle2, className: "text-emerald-400", spin: false }
                    : null;

    return (
        <Card className="overflow-hidden border-sky-500/20 bg-gradient-to-br from-gray-800 to-gray-900 text-white shadow-xl">
            <CardHeader className="border-b border-gray-700/70 bg-sky-500/[0.04] pb-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2 text-xl">
                            <BookOpenText className="h-5 w-5 text-sky-400" /> Daily Notes
                        </CardTitle>
                        <p className="mt-1 text-sm text-gray-400">{formatDateForDisplay(entryDate)}</p>
                    </div>
                    <div className="text-left text-xs text-gray-500 sm:text-right">
                        {updatedAt ? `Last saved ${new Date(updatedAt).toLocaleString()}` : "Not saved yet"}
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-4 p-5 sm:p-6">
                <Textarea
                    value={content}
                    onChange={(event) => {
                        setContent(event.target.value);
                        setSaveState("idle");
                        setError("");
                    }}
                    placeholder="Write down today's plan, observations, decisions, and thoughts..."
                    className="min-h-[240px] resize-y border-gray-600 bg-gray-950/60 p-4 text-base leading-7 text-white placeholder:text-gray-600 focus-visible:border-sky-500 focus-visible:ring-sky-500/30"
                />
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-h-5 text-sm">
                        {status && (
                            <span className={`inline-flex items-center gap-1.5 font-medium ${status.className}`}>
                                <status.icon className={`h-4 w-4 ${status.spin ? "animate-spin" : ""}`} />
                                {status.label}
                            </span>
                        )}
                        {error && <span className="ml-2 text-red-400">{error}</span>}
                    </div>
                    <Button
                        onClick={handleSave}
                        disabled={!isDirty || saveState === "saving"}
                        className="min-w-36 bg-sky-600 font-bold text-white hover:bg-sky-500 disabled:bg-gray-700"
                    >
                        {saveState === "saving" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Save Daily Notes
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
