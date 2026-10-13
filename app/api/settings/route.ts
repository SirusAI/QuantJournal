import { NextRequest, NextResponse } from "next/server";
import { deleteConnection, getSettings, resolveConnection, saveConnection, saveMarketSettings, selectConnection } from "@/lib/local-settings";
import { fetchAiModels, generateAi } from "@/lib/ai-client";
import { checkPython, getMarketDataResult } from "@/lib/market-data";
export const runtime = "nodejs";
export async function GET() { return NextResponse.json(getSettings(), { headers: { "Cache-Control": "no-store" } }); }
export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (origin && origin !== req.nextUrl.origin) return NextResponse.json({ error: "Same-origin requests only." }, { status: 403 });
  try {
    const body = await req.json();
    if (body.action === "save-connection") saveConnection(body.connection);
    else if (body.action === "delete-connection") deleteConnection(body.id);
    else if (body.action === "select") selectConnection(body.feature, body.id);
    else if (body.action === "save-market") saveMarketSettings(body.market, body.keys ?? {});
    else if (body.action === "models") return NextResponse.json({ models: await fetchAiModels(resolveConnection(body.id, "daily-review")) });
    else if (body.action === "test-ai") {
      await generateAi(resolveConnection(body.id, "daily-review"), { system: "You are testing an API connection.", user: "Reply with OK.", maxTokens: 128 });
      return NextResponse.json({ message: "Connection succeeded. No trading data was sent." });
    } else if (body.action === "check-python") return NextResponse.json(await checkPython());
    else if (body.action === "test-market") return NextResponse.json(await getMarketDataResult({ symbol: "SPY", from: body.from, to: body.to, interval: body.interval, source: body.source }));
    else throw new Error("Unknown settings action.");
    return NextResponse.json(getSettings());
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Settings operation failed." }, { status: 400 }); }
}
