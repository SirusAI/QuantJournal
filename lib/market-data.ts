import "server-only";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { getMarketSecret, getSettings } from "./local-settings";
import { availableYfinanceIntervals, cleanMarketBars, validateMarketRequest, valueAt } from "./market-types";
import type { MarketBar, MarketDataResult, MarketRequest, MarketDataProvider } from "./market-types";
import type { CustomMarketConfig, MarketInterval, MarketSettings } from "./settings-types";
const execute = promisify(execFile);
const cacheRoot = () => path.join(process.cwd(), ".local", "market-cache");
let queue: Promise<unknown> = Promise.resolve();
let lastRequest = 0;
async function queued<T>(spacingMs: number, operation: () => Promise<T>): Promise<T> {
  const running = queue.then(async () => {
    const delay = Math.max(0, spacingMs - (Date.now()-lastRequest));
    if (delay) await new Promise(resolve => setTimeout(resolve, delay));
    lastRequest = Date.now(); return operation();
  }); queue = running.catch(() => {}); return running;
}
export function pythonCommand(): string {
  const configured = getSettings().market.pythonCommand.trim();
  if (configured) return configured;
  const local = path.join(process.cwd(), ".local", "python", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
  return existsSync(local) ? local : process.platform === "win32" ? "python" : "python3";
}
export async function runMarketPython(args: string[], timeout = 60000): Promise<Record<string, unknown>> {
  try {
    const { stdout } = await execute(pythonCommand(), [path.join(process.cwd(), "scripts", "market_data.py"), ...args], { timeout, maxBuffer: 16*1024*1024, windowsHide: true });
    return JSON.parse(stdout) as Record<string, unknown>;
  } catch { throw new Error("Python/yfinance unavailable or timed out. Run npm run setup:market-data or set the Python executable in Settings."); }
}
export async function checkPython() {
  try { return await runMarketPython(["check"], 15000); }
  catch (error) { return { available: false, error: (error as Error).message }; }
}
function dateInZone(seconds: number, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(seconds*1000));
}
async function fetchJson(url: string, headers: Record<string,string> = {}): Promise<Record<string,unknown>> {
  let response: Response;
  try { response = await fetch(url, { headers, signal: AbortSignal.timeout(30000), cache: "no-store", redirect: "error" }); }
  catch { throw new Error("Market endpoint unavailable or timed out."); }
  if (!response.ok) throw new Error(response.status === 401 || response.status === 403 ? "Market key invalid or account lacks the requested historical-data permission." : response.status === 429 ? "Market requests are rate-limited. Retry later." : `Market provider request failed (${response.status}).`);
  return await response.json() as Record<string,unknown>;
}
export async function customBars(request: MarketRequest, custom: CustomMarketConfig, key: string): Promise<MarketBar[]> {
  const substitutions: Record<string,string> = { symbol: request.symbol, from: request.from, to: request.to, interval: request.interval, prepost: String(request.prepost ?? true) };
  const expand = (value: string) => value.replace(/\{(symbol|from|to|interval|prepost)\}/g, (_, name) => substitutions[name]);
  const url = new URL(expand(custom.url));
  for (const [name,value] of Object.entries(custom.query)) url.searchParams.set(name, expand(value));
  const headers: Record<string,string> = {};
  if (custom.auth !== "none" && !key) throw new Error("The custom market connection requires your API key.");
  if (custom.auth === "bearer") headers.Authorization = `Bearer ${key}`;
  if (custom.auth === "header") headers[custom.keyName] = key;
  if (custom.auth === "query") url.searchParams.set(custom.keyName, key);
  const payload = await fetchJson(url.toString(), headers); const rows = valueAt(payload, custom.dataPath);
  if (!Array.isArray(rows)) throw new Error("Custom API response has no array at the configured data path.");
  return rows.map(row => {
    const raw = valueAt(row, custom.fields.time);
    const dateOnly = custom.timeFormat === "iso" && /^\d{4}-\d{2}-\d{2}$/.test(String(raw));
    const ambiguousIso = custom.timeFormat === "iso" && !dateOnly && !/(Z|[+-]\d{2}:\d{2})$/i.test(String(raw));
    const time = ambiguousIso || (dateOnly && request.interval !== "1d") ? NaN : custom.timeFormat === "iso" ? Date.parse(String(raw) + (dateOnly ? "T12:00:00Z" : "")) / 1000 : Number(raw) / (custom.timeFormat === "milliseconds" ? 1000 : 1);
    return { time, date: dateOnly ? String(raw) : Number.isFinite(time) ? dateInZone(time, custom.timeZone) : "", open: Number(valueAt(row, custom.fields.open)), high: Number(valueAt(row, custom.fields.high)),
      low: Number(valueAt(row, custom.fields.low)), close: Number(valueAt(row, custom.fields.close)), volume: custom.fields.volume && valueAt(row,custom.fields.volume) != null ? Number(valueAt(row,custom.fields.volume)) : null };
  });
}
async function massiveBars(request: MarketRequest): Promise<MarketBar[]> {
  const key = getMarketSecret("massive"); if (!key) throw new Error("Add your own Massive API key in Settings. Access depends on your subscription.");
  const size = request.interval === "1d" ? 1 : parseInt(request.interval);
  const unit = request.interval === "1d" ? "day" : "minute";
  let url: string | null = `https://api.massive.com/v2/aggs/ticker/${encodeURIComponent(request.symbol)}/range/${size}/${unit}/${request.from}/${request.to}?adjusted=false&sort=asc&limit=50000`;
  const bars: MarketBar[] = []; let pages = 0;
  while (url) {
    if (++pages > 100 || new URL(url).origin !== "https://api.massive.com") throw new Error("Market pagination limit or invalid provider URL.");
    const payload = await fetchJson(url, { Authorization: `Bearer ${key}` });
    if (payload.status === "ERROR" || payload.status === "NOT_AUTHORIZED") throw new Error("Massive account lacks access to this request.");
    for (const row of (payload.results ?? []) as Record<string,number>[]) { const time = row.t/1000;
      bars.push({ time, date: dateInZone(time,"America/New_York"), open: row.o, high: row.h, low: row.l, close: row.c, volume: row.v ?? null }); }
    url = typeof payload.next_url === "string" ? payload.next_url : null;
  }
  return bars;
}
function availableIntervals(request: MarketRequest, market: MarketSettings): MarketInterval[] {
  if (request.source === "yfinance") return availableYfinanceIntervals(request.from);
  return request.source === "custom" ? market.custom.intervals : ["1m","2m","5m","15m","30m","60m","90m","1d"];
}
export async function getMarketDataResult(request: MarketRequest): Promise<MarketDataResult> {
  validateMarketRequest(request); const market = getSettings().market;
  const resolved: MarketRequest = { ...request, symbol: request.symbol.toUpperCase(), source: request.source ?? (request.interval === "1d" ? market.dailySource : market.intradaySource), prepost: request.prepost ?? market.prepost };
  if (!["yfinance","massive","custom"].includes(resolved.source!)) throw new Error("Invalid market source.");
  const base: MarketDataResult = { status: "no_data", bars: [], source: resolved.source!, interval: resolved.interval,
    timeZone: resolved.source === "custom" ? market.custom.timeZone : "America/New_York",
    adjustment: resolved.source === "yfinance" ? "split-adjusted" : resolved.source === "custom" ? market.custom.adjustment : "unadjusted",
    requested: { from: resolved.from, to: resolved.to }, coverage: null, limitations: [], availableIntervals: availableIntervals(resolved,market) };
  if (!base.availableIntervals.includes(resolved.interval)) return { ...base, status: "unsupported", limitations: ["Requested interval/range exceeds this source's conservative coverage. Select an available coarser interval, recent dates, another source, or daily-only context."] };
  if (resolved.source === "custom" && market.custom.maxHistoryDays && Date.now()-Date.parse(resolved.from) > market.custom.maxHistoryDays*86400000) return { ...base, status: "unsupported", limitations: ["Requested dates exceed the custom connection's configured history."] };
  const digest = createHash("sha256").update(JSON.stringify({ version: 2, resolved, market, credential: resolved.source === "yfinance" ? "" : getMarketSecret(resolved.source!) })).digest("hex");
  const file = path.join(cacheRoot(),`${digest}.json`);
  try { if (existsSync(file)) { const saved = JSON.parse(readFileSync(file,"utf8")); if (Date.now()-saved.at < 3600000) return saved.result; } } catch { /* Fetch again after invalid cache. */ }
  try {
    const result = await queued(resolved.source === "massive" && ["basic","unknown"].includes(market.massivePlan) ? 12500 : 500, async () => {
      if (resolved.source === "massive") return { bars: await massiveBars(resolved), limitations: [] as string[] };
      if (resolved.source === "custom") return { bars: await customBars(resolved, market.custom, getMarketSecret("custom")), limitations: [] as string[] };
      const payload = await runMarketPython(["bars",resolved.symbol,resolved.from,resolved.to,resolved.interval,String(resolved.prepost)]);
      if (payload.error) throw new Error(String(payload.error));
      return { bars: payload.bars as MarketBar[], limitations: (payload.limitations ?? []) as string[] };
    });
    const clean = cleanMarketBars(result.bars);
    if (clean.length < result.bars.length) base.limitations.push("Invalid or duplicate provider bars were removed.");
    base.bars = clean.filter(bar => bar.date >= resolved.from && bar.date <= resolved.to && (resolved.prepost || resolved.interval === "1d" || isRegularSession(bar.time)));
    base.limitations.push(...result.limitations);
    if (!base.bars.length) base.limitations.push("No real bars returned. The dates may be non-trading days or unavailable for this source.");
    else {
      if (resolved.interval === "1d" && new Set(base.bars.map(bar=>bar.date)).size !== base.bars.length) throw new Error("The provider returned multiple bars per day. Check the custom interval/query mapping; intraday bars cannot be labeled daily bars.");
      base.coverage = resolved.interval === "1d" ? { from: base.bars[0].date, to: base.bars.at(-1)!.date } : { from: new Date(base.bars[0].time*1000).toISOString(), to: new Date(base.bars.at(-1)!.time*1000).toISOString() };
      base.status = base.limitations.length ? "partial" : "ok";
    }
    if (base.bars.length) { mkdirSync(cacheRoot(),{recursive:true}); writeFileSync(file,JSON.stringify({at:Date.now(),result:base}),{mode:0o600}); }
    return base;
  } catch (error) { return { ...base, bars: [], coverage: null, status: "unavailable", limitations: [error instanceof Error ? error.message : "Market provider unavailable."] }; }
}
function isRegularSession(time: number) {
  const parts = new Intl.DateTimeFormat("en-US",{timeZone:"America/New_York",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date(time*1000));
  const minute = Number(parts.find(p=>p.type==="hour")?.value)*60 + Number(parts.find(p=>p.type==="minute")?.value);
  return minute>=570 && minute<960;
}
export async function getMarketData(symbol: string, date: string) {
  const result = await getMarketDataResult({symbol,from:date,to:date,interval:getSettings().market.intradayInterval});
  if (result.adjustment !== "unadjusted") throw new Error("Exact price calculations require unadjusted market bars.");
  return result.bars;
}
export const marketDataProvider: MarketDataProvider = { getBars: getMarketDataResult };
