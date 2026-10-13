import { NextRequest, NextResponse } from "next/server";

import {
    EdgeAnalysisInputError,
    getEdgeAnalysis,
} from "@/lib/edge-analysis-service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    const startedAt = performance.now();

    try {
        const params = request.nextUrl.searchParams;
        const analysis = await getEdgeAnalysis({
            from: params.get("from"),
            to: params.get("to"),
            symbol: params.get("symbol"),
            tag: params.get("tag"),
            label: params.get("label"),
        });
        const duration = performance.now() - startedAt;

        return NextResponse.json(analysis, {
            headers: {
                "Cache-Control": "private, no-store, max-age=0",
                "Server-Timing": `edge;dur=${duration.toFixed(1)}`,
            },
        });
    } catch (error) {
        if (error instanceof EdgeAnalysisInputError) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }

        console.error("Edge analysis failed", error);
        return NextResponse.json(
            { error: "Unable to analyze trades for this scope." },
            { status: 500 }
        );
    }
}
