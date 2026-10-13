import { MARKET_INTERVALS } from "./settings-types.ts";
import type { MarketInterval, MarketSource } from "./settings-types.ts";
export interface MarketBar { time: number; date: string; open: number; high: number; low: number; close: number; volume: number | null }
export interface MarketRequest { symbol: string; from: string; to: string; interval: MarketInterval; source?: MarketSource; prepost?: boolean }
export interface MarketDataResult {
  status: "ok" | "partial" | "no_data" | "unsupported" | "unavailable";
  bars: MarketBar[]; source: MarketSource; interval: MarketInterval; timeZone: string;
  adjustment: "unadjusted" | "split-adjusted" | "unknown";
  requested: { from: string; to: string }; coverage: { from: string; to: string } | null;
  limitations: string[]; availableIntervals: MarketInterval[];
}
export interface MarketDataProvider { getBars(request: MarketRequest): Promise<MarketDataResult> }
export function yfinanceHistoryDays(interval: MarketInterval): number | null {
  return interval === "1d" ? null : interval === "1m" ? 8 : interval === "60m" ? 730 : 60;
}
export function availableYfinanceIntervals(from: string, now = new Date()): MarketInterval[] {
  const age = (now.getTime() - new Date(`${from}T00:00:00Z`).getTime()) / 86400000;
  return MARKET_INTERVALS.filter(interval => { const days = yfinanceHistoryDays(interval); return days === null || age < days; });
}
export function valueAt(input: unknown, dottedPath: string): unknown {
  if (!dottedPath) return input;
  return dottedPath.split(".").reduce<unknown>((value, key) => value && typeof value === "object" ? (value as Record<string, unknown>)[key] : undefined, input);
}
export function validateMarketRequest(request: MarketRequest) {
  if (!/^[A-Za-z0-9^][A-Za-z0-9.^=_-]{0,30}$/.test(request.symbol)) throw new Error("Invalid ticker symbol.");
  for (const date of [request.from, request.to]) if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0,10) !== date) throw new Error("Invalid market date.");
  if (request.from > request.to || !MARKET_INTERVALS.includes(request.interval)) throw new Error("Invalid market range or interval.");
}
export function cleanMarketBars(bars: MarketBar[]): MarketBar[] {
  const unique = new Map<number, MarketBar>();
  for (const bar of bars) {
    if (![bar.time, bar.open, bar.high, bar.low, bar.close].every(Number.isFinite) || Math.min(bar.open, bar.high, bar.low, bar.close) <= 0 || bar.low > Math.min(bar.open, bar.close) || bar.high < Math.max(bar.open, bar.close)) continue;
    unique.set(bar.time, { ...bar, volume: bar.volume !== null && Number.isFinite(bar.volume) ? bar.volume : null });
  }
  return [...unique.values()].sort((a,b) => a.time-b.time);
}
