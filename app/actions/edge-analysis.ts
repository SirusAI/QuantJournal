"use server";

import { revalidatePath } from "next/cache";

import {
    EdgeAiInsight,
    EdgeAiSummary,
    EdgeAnalysisEvidenceSnapshot,
    EdgeAnalysisScope,
    EdgeAnalysisSessionDto,
} from "@/lib/edge-analysis-types";
import { db } from "@/lib/db";
import { getEdgeAnalysis } from "@/lib/edge-analysis-service";
import { generateAi } from "@/lib/ai-client";
import { getSettings, resolveConnection } from "@/lib/local-settings";
import { createHash } from "node:crypto";

const EDGE_AI_SCHEMA = {
    type: "object",
    additionalProperties: false,
    required: ["strengths", "leaks", "actions", "limitations"],
    properties: {
        strengths: {
            type: "array",
            maxItems: 3,
            items: {
                type: "object",
                additionalProperties: false,
                required: ["title", "detail", "evidence"],
                properties: {
                    title: { type: "string" },
                    detail: { type: "string" },
                    evidence: { type: "array", items: { type: "string" }, maxItems: 4 },
                },
            },
        },
        leaks: {
            type: "array",
            maxItems: 3,
            items: {
                type: "object",
                additionalProperties: false,
                required: ["title", "detail", "evidence"],
                properties: {
                    title: { type: "string" },
                    detail: { type: "string" },
                    evidence: { type: "array", items: { type: "string" }, maxItems: 4 },
                },
            },
        },
        actions: { type: "array", items: { type: "string" }, maxItems: 5 },
        limitations: { type: "array", items: { type: "string" }, maxItems: 5 },
    },
} as const;

function safeParseJson<T>(value: string): T {
    return JSON.parse(value) as T;
}

function cleanText(value: unknown, maxLength = 1200): string {
    return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function normalizeInsights(value: unknown): EdgeAiInsight[] {
    if (!Array.isArray(value)) return [];
    return value.slice(0, 3).map((item) => {
        const source = item && typeof item === "object" ? item as Record<string, unknown> : {};
        return {
            title: cleanText(source.title, 160) || "Observed pattern",
            detail: cleanText(source.detail),
            evidence: Array.isArray(source.evidence)
                ? source.evidence.map((entry) => cleanText(entry, 300)).filter(Boolean).slice(0, 4)
                : [],
        };
    });
}

function normalizeStringList(value: unknown, limit: number): string[] {
    return Array.isArray(value)
        ? value.map((entry) => cleanText(entry, 600)).filter(Boolean).slice(0, limit)
        : [];
}

function normalizeAiSummary(value: unknown): EdgeAiSummary {
    const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
    return {
        strengths: normalizeInsights(source.strengths),
        leaks: normalizeInsights(source.leaks),
        actions: normalizeStringList(source.actions, 5),
        limitations: normalizeStringList(source.limitations, 5),
    };
}

function serializeSession(session: {
    id: string;
    scopeKey: string;
    scopeJson: string;
    sourceFingerprint: string;
    analysisVersion: string;
    modelId: string;
    modelName: string | null;
    summaryJson: string;
    evidenceJson: string;
    createdAt: Date;
}): EdgeAnalysisSessionDto {
    return {
        id: session.id,
        scope: safeParseJson<EdgeAnalysisScope>(session.scopeJson),
        scopeKey: session.scopeKey,
        sourceFingerprint: session.sourceFingerprint,
        analysisVersion: session.analysisVersion,
        modelId: session.modelId,
        modelName: session.modelName,
        summary: safeParseJson<EdgeAiSummary>(session.summaryJson),
        evidence: safeParseJson<EdgeAnalysisEvidenceSnapshot>(session.evidenceJson),
        createdAt: session.createdAt.toISOString(),
    };
}

function buildAiPrompt(scope: EdgeAnalysisScope, evidence: EdgeAnalysisEvidenceSnapshot): string {
    return [
        "Analyze the following deterministic trading-journal evidence.",
        "Use only the supplied metrics. Never invent market cap, float, gap, RVOL, news, risk, or causality.",
        "Describe findings as historical associations or observed edge, not predictions.",
        "Every strength or leak must cite sample size and at least one supplied performance metric.",
        "A Trade is a symbol-day execution collection, so call first-to-last timing an execution window, not holding time.",
        "Dollar expectancy is not risk-adjusted. Respect all data-quality limitations.",
        `Scope: ${JSON.stringify(scope)}`,
        `Evidence: ${JSON.stringify(evidence)}`,
    ].join("\n\n");
}

export async function getEdgeAnalysisModels() {
    const settings = getSettings();
    return { success: true, models: settings.connections.map(c => ({ id: c.id, modelId: c.modelId, name: `${c.name} · ${c.modelId}`, isDefault: c.id === settings.selections["edge-analysis"] })) };
}

export async function generateEdgeAnalysisSummary({
    scope,
    connectionId,
    force = false,
}: {
    scope: EdgeAnalysisScope;
    connectionId: string;
    force?: boolean;
}) {
    try {
        const selectedModel = resolveConnection(connectionId, "edge-analysis");
        const connectionKey = createHash("sha256").update(JSON.stringify([selectedModel.id, selectedModel.provider, selectedModel.baseUrl, selectedModel.modelId])).digest("hex");
        const analysis = await getEdgeAnalysis(scope);
        if (analysis.baseline.sampleSize === 0) {
            return { success: false, error: "There are no closed trades in this analysis scope." };
        }

        if (!force) {
            const cached = await db.edgeAnalysisSession.findFirst({
                where: {
                    scopeKey: analysis.scopeKey,
                    sourceFingerprint: analysis.sourceFingerprint,
                    analysisVersion: analysis.analysisVersion,
                    modelId: selectedModel.modelId,
                    connectionKey,
                },
                orderBy: { createdAt: "desc" },
            });
            if (cached) {
                return { success: true, cached: true, session: serializeSession(cached) };
            }
        }

        const evidence: EdgeAnalysisEvidenceSnapshot = {
            baseline: analysis.baseline,
            dataQuality: analysis.dataQuality,
            topEdges: analysis.topEdges,
            topLeaks: analysis.topLeaks,
            deterministicActions: analysis.actions,
        };
        const generated = JSON.parse(await generateAi(selectedModel, {
            system: "You are a cautious, evidence-first trading-journal analyst.",
            user: buildAiPrompt(analysis.scope, evidence), schema: EDGE_AI_SCHEMA,
            schemaName: "edge_analysis_summary", maxTokens: 8192,
        }));
        const summary = normalizeAiSummary(generated);

        const saved = await db.edgeAnalysisSession.create({
            data: {
                scopeKey: analysis.scopeKey,
                scopeJson: JSON.stringify(analysis.scope),
                sourceFingerprint: analysis.sourceFingerprint,
                analysisVersion: analysis.analysisVersion,
                modelId: selectedModel.modelId,
                connectionKey,
                modelName: selectedModel.name,
                summaryJson: JSON.stringify(summary),
                evidenceJson: JSON.stringify(evidence),
            },
        });

        revalidatePath("/reports");
        return { success: true, cached: false, session: serializeSession(saved) };
    } catch (error) {
        return { success: false, error: (error as Error).message };
    }
}

export async function listEdgeAnalysisSessions() {
    try {
        const sessions = await db.edgeAnalysisSession.findMany({
            orderBy: { createdAt: "desc" },
            select: {
                id: true,
                scopeKey: true,
                scopeJson: true,
                sourceFingerprint: true,
                analysisVersion: true,
                modelId: true,
                modelName: true,
                createdAt: true,
            },
        });
        return {
            success: true,
            sessions: sessions.map((session) => ({
                id: session.id,
                scope: safeParseJson<EdgeAnalysisScope>(session.scopeJson),
                scopeKey: session.scopeKey,
                sourceFingerprint: session.sourceFingerprint,
                analysisVersion: session.analysisVersion,
                modelId: session.modelId,
                modelName: session.modelName,
                createdAt: session.createdAt.toISOString(),
            })),
        };
    } catch (error) {
        return { success: false, error: (error as Error).message };
    }
}

export async function getEdgeAnalysisSession(id: string) {
    try {
        const session = await db.edgeAnalysisSession.findUnique({ where: { id } });
        return session
            ? { success: true, session: serializeSession(session) }
            : { success: false, error: "Edge analysis session not found." };
    } catch (error) {
        return { success: false, error: (error as Error).message };
    }
}

export async function deleteEdgeAnalysisSession(id: string) {
    try {
        const result = await db.edgeAnalysisSession.deleteMany({ where: { id } });
        if (result.count === 0) return { success: false, error: "Edge analysis session not found." };
        revalidatePath("/reports");
        return { success: true };
    } catch (error) {
        return { success: false, error: (error as Error).message };
    }
}
