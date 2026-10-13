import "server-only";
import { randomBytes, randomUUID, createCipheriv, createDecipheriv } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import path from "node:path";
import { AI_PROVIDERS, DEFAULT_MARKET, MARKET_INTERVALS } from "./settings-types";
import type { AiConnection, AiConnectionInput, AiFeature, MarketSettings, SettingsDto } from "./settings-types";

export interface PrivateConnection extends AiConnection { encryptedKey?: string }
interface Store {
  connections: PrivateConnection[]; selections: SettingsDto["selections"]; market: MarketSettings;
  massiveKey?: string; customKey?: string;
}
const root = () => path.join(process.cwd(), ".local");
const filename = () => path.join(root(), "settings.json");
function read(): Store {
  if (!existsSync(filename())) return { connections: [], selections: {}, market: structuredClone(DEFAULT_MARKET) };
  return JSON.parse(readFileSync(filename(), "utf8")) as Store;
}
function write(data: Store) {
  mkdirSync(root(), { recursive: true, mode: 0o700 });
  const temporary = `${filename()}.${randomUUID()}.tmp`;
  writeFileSync(temporary, JSON.stringify(data, null, 2), { mode: 0o600 });
  renameSync(temporary, filename());
}
function localKey(): Buffer {
  mkdirSync(root(), { recursive: true, mode: 0o700 });
  const file = path.join(root(), "credentials.key");
  if (!existsSync(file)) {
    try { writeFileSync(file, randomBytes(32), { flag: "wx", mode: 0o600 }); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; }
  }
  return readFileSync(file);
}
export function encryptSecret(secret: string): string {
  const iv = randomBytes(12); const cipher = createCipheriv("aes-256-gcm", localKey(), iv);
  return Buffer.concat([iv, cipher.update(secret, "utf8"), cipher.final(), cipher.getAuthTag()]).toString("base64");
}
function decryptSecret(value?: string): string {
  if (!value) return "";
  const buffer = Buffer.from(value, "base64");
  const decipher = createDecipheriv("aes-256-gcm", localKey(), buffer.subarray(0, 12));
  decipher.setAuthTag(buffer.subarray(-16));
  return Buffer.concat([decipher.update(buffer.subarray(12, -16)), decipher.final()]).toString("utf8");
}
export function validateBaseUrl(value: string): string {
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.hash || url.search) throw new Error("Use an HTTP(S) base URL without credentials, query or fragment.");
  return url.toString().replace(/\/$/, "");
}
export function getSettings(): SettingsDto {
  const data = read();
  return { connections: data.connections.map(({ encryptedKey, ...connection }) => ({ ...connection, hasApiKey: !!encryptedKey })),
    selections: data.selections, market: { ...data.market, hasMassiveKey: !!data.massiveKey, hasCustomKey: !!data.customKey } };
}
export function saveConnection(input: AiConnectionInput) {
  if (!Object.hasOwn(AI_PROVIDERS, input.provider) || !input.name.trim() || !input.modelId.trim()) throw new Error("Name, provider and model ID are required.");
  if (!Number.isInteger(input.timeoutSeconds) || input.timeoutSeconds < 10 || input.timeoutSeconds > 600) throw new Error("Timeout must be 10–600 seconds.");
  const data = read(); const old = data.connections.find(c => c.id === input.id);
  if (input.id && !old) throw new Error("Connection no longer exists.");
  const connection: PrivateConnection = { id: old?.id ?? randomUUID(), name: input.name.trim(), provider: input.provider,
    baseUrl: validateBaseUrl(input.baseUrl), modelId: input.modelId.trim(), timeoutSeconds: input.timeoutSeconds,
    hasApiKey: false, encryptedKey: input.clearApiKey ? undefined : input.apiKey?.trim() ? encryptSecret(input.apiKey.trim()) : old?.encryptedKey };
  data.connections = [...data.connections.filter(c => c.id !== connection.id), connection];
  for (const feature of ["daily-review", "ai-coach", "edge-analysis"] as AiFeature[]) if (!data.selections[feature]) data.selections[feature] = connection.id;
  write(data);
}
export function deleteConnection(id: string) {
  const data = read(); data.connections = data.connections.filter(c => c.id !== id);
  for (const feature of Object.keys(data.selections) as AiFeature[]) if (data.selections[feature] === id) delete data.selections[feature];
  write(data);
}
export function selectConnection(feature: AiFeature, id: string) {
  if (!["daily-review", "ai-coach", "edge-analysis"].includes(feature)) throw new Error("Invalid AI feature.");
  const data = read(); if (!data.connections.some(c => c.id === id)) throw new Error("Select an existing connection.");
  data.selections[feature] = id; write(data);
}
export function resolveConnection(id: string | undefined, feature: AiFeature): AiConnection & { apiKey: string } {
  const data = read(); const selected = id || data.selections[feature];
  const connection = data.connections.find(c => c.id === selected);
  if (!connection) throw new Error("Configure and select an AI connection in Settings first.");
  const { encryptedKey, ...publicConnection } = connection;
  const apiKey = decryptSecret(encryptedKey);
  if (!apiKey && !["ollama", "compatible"].includes(connection.provider)) throw new Error("This connection needs your API key. Update it in Settings.");
  return { ...publicConnection, apiKey };
}
export function saveMarketSettings(market: MarketSettings, keys: { massiveKey?: string; customKey?: string; clearMassiveKey?: boolean; clearCustomKey?: boolean }) {
  if (![market.dailySource, market.intradaySource].every(source => ["yfinance", "massive", "custom"].includes(source)) || !MARKET_INTERVALS.includes(market.intradayInterval) || market.intradayInterval === "1d") throw new Error("Select valid market sources and an intraday interval.");
  if (market.custom.url) {
    const url = new URL(market.custom.url.replace(/\{\w+\}/g, "test"));
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.hash || url.search) throw new Error("Custom URL must be HTTP(S), without credentials or query. Use query mappings for parameters.");
  }
  if (!market.custom.intervals.length || !market.custom.intervals.every(i => MARKET_INTERVALS.includes(i))) throw new Error("Select supported custom intervals.");
  if (market.custom.maxHistoryDays !== null && (!Number.isInteger(market.custom.maxHistoryDays) || market.custom.maxHistoryDays < 1)) throw new Error("History days must be a positive integer or blank.");
  new Intl.DateTimeFormat("en", { timeZone: market.custom.timeZone });
  if (!["none", "bearer", "header", "query"].includes(market.custom.auth) || !["seconds", "milliseconds", "iso"].includes(market.custom.timeFormat) || !["unknown", "unadjusted", "split-adjusted"].includes(market.custom.adjustment)) throw new Error("Invalid custom API format.");
  if (!/^[\w-]+$/.test(market.custom.keyName)) throw new Error("Use a valid credential parameter name.");
  const data = read(); data.market = market;
  for (const name of ["massiveKey", "customKey"] as const) {
    const clear = name === "massiveKey" ? keys.clearMassiveKey : keys.clearCustomKey;
    if (clear) delete data[name]; else if (keys[name]?.trim()) data[name] = encryptSecret(keys[name]!.trim());
  }
  write(data);
}
export function getMarketSecret(source: "massive" | "custom") { return decryptSecret(read()[source === "massive" ? "massiveKey" : "customKey"]); }
