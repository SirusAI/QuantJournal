export const AI_PROVIDERS = {
  openai: { label: "OpenAI", baseUrl: "https://api.openai.com/v1" },
  deepseek: { label: "DeepSeek", baseUrl: "https://api.deepseek.com/v1" },
  google: { label: "Google AI Studio", baseUrl: "https://generativelanguage.googleapis.com/v1beta" },
  anthropic: { label: "Claude", baseUrl: "https://api.anthropic.com/v1" },
  openrouter: { label: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1" },
  nvidia: { label: "Nvidia NIM", baseUrl: "https://integrate.api.nvidia.com/v1" },
  ollama: { label: "Ollama Local", baseUrl: "http://localhost:11434" },
  compatible: { label: "OpenAI Compatible / LM Studio", baseUrl: "http://localhost:1234/v1" },
} as const;
export type AiProvider = keyof typeof AI_PROVIDERS;
export type AiFeature = "daily-review" | "ai-coach" | "edge-analysis";
export interface AiConnection {
  id: string; name: string; provider: AiProvider; baseUrl: string; modelId: string;
  timeoutSeconds: number; hasApiKey: boolean;
}
export interface AiConnectionInput extends Omit<AiConnection, "id" | "hasApiKey"> {
  id?: string; apiKey?: string; clearApiKey?: boolean;
}
export const MARKET_INTERVALS = ["1m", "2m", "5m", "15m", "30m", "60m", "90m", "1d"] as const;
export type MarketInterval = typeof MARKET_INTERVALS[number];
export type MarketSource = "yfinance" | "massive" | "custom";
export interface CustomMarketConfig {
  url: string; auth: "none" | "bearer" | "header" | "query"; keyName: string;
  query: Record<string, string>; dataPath: string;
  fields: { time: string; open: string; high: string; low: string; close: string; volume: string };
  timeFormat: "seconds" | "milliseconds" | "iso";
  timeZone: string; adjustment: "unadjusted" | "split-adjusted" | "unknown";
  intervals: MarketInterval[]; maxHistoryDays: number | null;
}
export interface MarketSettings {
  dailySource: MarketSource; intradaySource: MarketSource; intradayInterval: MarketInterval;
  prepost: boolean; pythonCommand: string; supplemental: boolean;
  massivePlan: "basic" | "starter" | "developer" | "advanced" | "unknown";
  hasMassiveKey: boolean; hasCustomKey: boolean; custom: CustomMarketConfig;
}
export interface SettingsDto {
  connections: AiConnection[]; selections: Partial<Record<AiFeature, string>>; market: MarketSettings;
}
export const DEFAULT_MARKET: MarketSettings = {
  dailySource: "yfinance", intradaySource: "yfinance", intradayInterval: "5m", prepost: true,
  pythonCommand: "", supplemental: false, massivePlan: "unknown", hasMassiveKey: false, hasCustomKey: false,
  custom: { url: "", auth: "none", keyName: "X-API-Key", query: {}, dataPath: "bars",
    fields: { time: "time", open: "open", high: "high", low: "low", close: "close", volume: "volume" },
    timeFormat: "seconds", timeZone: "America/New_York", adjustment: "unknown",
    intervals: [...MARKET_INTERVALS], maxHistoryDays: null },
};
