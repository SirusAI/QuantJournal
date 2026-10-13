import "server-only";
import type { AiConnection } from "./settings-types";

export class AiError extends Error {
  constructor(public kind: string, message: string, public status?: number) { super(message); }
}
type Connection = AiConnection & { apiKey: string };
type JsonSchema = { type?: string | string[]; required?: readonly string[]; properties?: Record<string, JsonSchema>; items?: JsonSchema };
type RecordValue = Record<string, unknown>;
function record(value: unknown): RecordValue { return value && typeof value === "object" ? value as RecordValue : {}; }
function array(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
function textParts(value: unknown): string {
  if (typeof value === "string") return value;
  return array(value).map(part => String(record(part).text ?? "")).join("");
}
function assertSchema(value: unknown, schema: JsonSchema) {
  if (schema.type === "object") {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new AiError("invalid_output", "The model returned an invalid report object.");
    for (const key of schema.required ?? []) if (!(key in record(value))) throw new AiError("invalid_output", "The model omitted required report fields.");
    for (const [key, child] of Object.entries(schema.properties ?? {})) if (key in record(value)) assertSchema(record(value)[key], child);
  } else if (schema.type === "array") {
    if (!Array.isArray(value)) throw new AiError("invalid_output", "The model returned an invalid report list.");
    if (schema.items) value.forEach(item => assertSchema(item, schema.items!));
  } else if (schema.type === "string" && typeof value !== "string") throw new AiError("invalid_output", "The model returned invalid report text.");
}
function parseJson(content: string): unknown {
  const candidate = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try { return JSON.parse(candidate); } catch { throw new AiError("invalid_output", "The model did not return valid JSON. Try another model or regenerate."); }
}
async function request(connection: Connection, endpoint: string, method: string, body?: unknown, extraHeaders: Record<string, string> = {}): Promise<RecordValue> {
  const headers: Record<string, string> = { "Content-Type": "application/json", ...extraHeaders };
  if (connection.apiKey) {
    if (connection.provider === "google") headers["x-goog-api-key"] = connection.apiKey;
    else if (connection.provider === "anthropic") headers["x-api-key"] = connection.apiKey;
    else headers.Authorization = `Bearer ${connection.apiKey}`;
  }
  if (connection.provider === "anthropic") headers["anthropic-version"] = "2023-06-01";
  let response: Response;
  try { response = await fetch(`${connection.baseUrl}${endpoint}`, { method, headers, body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(connection.timeoutSeconds * 1000), cache: "no-store", redirect: "error" }); }
  catch { throw new AiError("unavailable", "The AI endpoint timed out or could not be reached. Check the URL and local server."); }
  const payload = record(await response.json().catch(() => ({})));
  if (!response.ok || payload.error) {
    const status = response.ok ? Number(record(payload.error).code) || 502 : response.status;
    const raw = String(record(payload.error).message ?? "");
    const unsupported = status === 400 && /response_format|json_schema|structured|output_config|format/i.test(raw);
    throw new AiError(unsupported ? "unsupported_format" : "request_failed", status === 401 || status === 403 ? "The AI key is invalid or lacks access to this model." : status === 429 ? "The provider is rate-limiting requests. Retry later." : unsupported ? "This model does not support structured output." : `AI request failed (${status}). Check the model ID and account access.`, status);
  }
  return payload;
}
export async function generateAi(connection: Connection, args: { system: string; user: string; schema?: JsonSchema; schemaName?: string; maxTokens?: number }): Promise<string> {
  const { system, user, schema } = args;
  const budget = args.maxTokens ?? 8192;
  const prompt = schema ? `${system}\nReturn only valid JSON matching this schema: ${JSON.stringify(schema)}` : system;
  const messages = [{ role: "system", content: prompt }, { role: "user", content: user }];
  for (let attempt = 0; attempt < 2; attempt++) {
    const structured = !!schema && attempt === 0;
    let endpoint: string; let body: RecordValue;
    if (connection.provider === "openai") {
      endpoint = "/responses"; body = { model: connection.modelId, input: messages, max_output_tokens: budget, store: false };
      if (structured) body.text = { format: { type: "json_schema", name: args.schemaName ?? "report", strict: true, schema } };
    } else if (connection.provider === "google") {
      endpoint = `/models/${encodeURIComponent(connection.modelId.replace(/^models\//, ""))}:generateContent`;
      body = { systemInstruction: { parts: [{ text: prompt }] }, contents: [{ role: "user", parts: [{ text: user }] }], generationConfig: {
        maxOutputTokens: budget, ...(structured ? { responseMimeType: "application/json", responseJsonSchema: schema } : {}) } };
    } else if (connection.provider === "anthropic") {
      endpoint = "/messages"; body = { model: connection.modelId, system: prompt, messages: [{ role: "user", content: user }], max_tokens: budget };
      if (structured) body.output_config = { format: { type: "json_schema", schema } };
    } else if (connection.provider === "ollama") {
      endpoint = "/api/chat"; body = { model: connection.modelId, messages, stream: false, options: { num_predict: budget } };
      if (schema) body.format = structured ? schema : "json";
    } else {
      endpoint = "/chat/completions"; body = { model: connection.modelId, messages, stream: false, max_tokens: budget };
      if (schema && connection.provider === "deepseek") body.response_format = { type: "json_object" };
      else if (structured) body.response_format = { type: "json_schema", json_schema: { name: args.schemaName ?? "report", strict: true, schema } };
    }
    try {
      const payload = await request(connection, endpoint, "POST", body);
      const choice = record(array(payload.choices)[0]); const candidate = record(array(payload.candidates)[0]);
      if (payload.status === "incomplete" || payload.stop_reason === "max_tokens" || choice.finish_reason === "length" || candidate.finishReason === "MAX_TOKENS") throw new AiError("truncated", "The model reached its output limit. Choose another model or reduce the analysis scope.");
      let content: string;
      if (connection.provider === "openai") content = array(payload.output).map(item => textParts(record(item).content)).join("");
      else if (connection.provider === "google") content = textParts(array(record(candidate.content).parts).filter(part => !record(part).thought));
      else if (connection.provider === "anthropic") content = textParts(array(payload.content).filter(part => record(part).type === "text"));
      else if (connection.provider === "ollama") content = String(record(payload.message).content ?? "");
      else content = textParts(record(choice.message).content);
      if (!content.trim()) throw new AiError("empty_output", "The model returned no report text or declined this request.");
      if (schema) assertSchema(parseJson(content), schema);
      return schema ? JSON.stringify(parseJson(content)) : content;
    } catch (error) {
      if (attempt === 0 && schema && error instanceof AiError && error.kind === "unsupported_format") continue;
      throw error;
    }
  }
  throw new AiError("request_failed", "AI generation failed.");
}
export async function fetchAiModels(connection: Connection): Promise<string[]> {
  const models = new Set<string>(); let token: string | undefined;
  for (let page = 0; page < 20; page++) {
    const endpoint = connection.provider === "ollama" ? "/api/tags" : "/models";
    const payload = await request(connection, endpoint + (token ? `?pageToken=${encodeURIComponent(token)}` : ""), "GET");
    for (const item of array(payload.models ?? payload.data)) {
      if (connection.provider === "google" && Array.isArray(record(item).supportedGenerationMethods) && !array(record(item).supportedGenerationMethods).includes("generateContent")) continue;
      const id = String(record(item).id ?? record(item).model ?? record(item).name ?? "").replace(/^models\//, "");
      if (id) models.add(id);
    }
    token = typeof payload.nextPageToken === "string" ? payload.nextPageToken : undefined;
    if (!token) break;
  }
  return [...models].sort();
}
