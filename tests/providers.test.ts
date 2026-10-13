import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";
import { AI_PROVIDERS, DEFAULT_MARKET } from "../lib/settings-types.ts";
import type { AiProvider, AiConnectionInput } from "../lib/settings-types.ts";
import { availableYfinanceIntervals, cleanMarketBars, validateMarketRequest, valueAt } from "../lib/market-types.ts";

const nativeRequire = createRequire(import.meta.url);
function load<T>(file: string, dependencies: Record<string, unknown>, extras: Record<string, unknown> = {}): T {
  const source = readFileSync(path.resolve(file), "utf8");
  const exports = {};
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  vm.runInNewContext(code, { exports, require: (name: string) => name === "server-only" ? {} : name in dependencies ? dependencies[name] : nativeRequire(name),
    Buffer, URL, AbortSignal, structuredClone, Intl, setTimeout, clearTimeout, process, ...extras });
  return exports as T;
}
const schema = { type: "object", additionalProperties: false, required: ["summary"], properties: { summary: { type: "string" } } };
const report = JSON.stringify({ summary: "Evidence-based report" });
function envelope(provider: AiProvider) {
  if (provider === "openai") return { status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: report }] }] };
  if (provider === "google") return { candidates: [{ content: { parts: [{ thought: true, text: "private reasoning" }, { text: report }] } }] };
  if (provider === "anthropic") return { content: [{ type: "thinking", thinking: "private reasoning" }, { type: "text", text: report }], stop_reason: "end_turn" };
  if (provider === "ollama") return { message: { content: report } };
  return { choices: [{ finish_reason: "stop", message: { content: report } }] };
}
for (const provider of Object.keys(AI_PROVIDERS) as AiProvider[]) {
  test(`${provider}: native request, authentication and validated structured report`, async () => {
    const requests: { url: string; headers: Record<string,string>; body: Record<string,unknown> }[] = [];
    const api = load<typeof import("../lib/ai-client")>("lib/ai-client.ts", {}, { fetch: async (url: string, options: RequestInit) => {
      requests.push({ url, headers: options.headers as Record<string,string>, body: JSON.parse(options.body as string) });
      return { ok: true, json: async () => envelope(provider) };
    } });
    const connection = { id: "test", name: "Test", provider, baseUrl: "https://example.test/v1", modelId: "test-model", timeoutSeconds: 30, hasApiKey: true, apiKey: "test-only-key" };
    const result = await api.generateAi(connection, { system: "Analyze", user: "Synthetic evidence", schema });
    assert.deepEqual(JSON.parse(result), JSON.parse(report));
    assert.equal(requests.length, 1);
    assert.equal(JSON.stringify(requests[0].body).includes("test-only-key"), false);
    assert.equal(JSON.stringify(result).includes("private reasoning"), false);
    if (provider === "google") { assert.match(requests[0].url, /generateContent$/); assert.equal(requests[0].headers["x-goog-api-key"], "test-only-key"); }
    else if (provider === "anthropic") { assert.match(requests[0].url, /messages$/); assert.equal(requests[0].headers["x-api-key"], "test-only-key"); }
    else { assert.equal(requests[0].headers.Authorization, "Bearer test-only-key"); }
    if (provider === "openai") assert.equal(requests[0].body.store, false);
    if (provider === "deepseek") assert.equal((requests[0].body.response_format as {type:string}).type,"json_object");
  });
}
test("AI failure preserves privacy and rejects malformed, incomplete or missing reports", async () => {
  const connection = { id: "test", name: "Test", provider: "openrouter" as const, baseUrl: "https://example.test", modelId: "test", timeoutSeconds: 30, hasApiKey: true, apiKey: "never-log-this" };
  for (const response of [
    { ok: false, status: 401, data: { error: { message: "never-log-this sensitive request" } } },
    { ok: true, status: 200, data: { choices: [{ finish_reason: "length", message: { content: report } }] } },
    { ok: true, status: 200, data: { choices: [{ message: { content: '{"wrong":"field"}' } }] } },
    { ok: true, status: 200, data: { choices: [{ message: { content: "not JSON" } }] } },
    { ok: true, status: 200, data: { choices: [{ message: { reasoning_content: "secret reasoning" } }] } },
  ]) {
    const api = load<typeof import("../lib/ai-client")>("lib/ai-client.ts",{}, {fetch: async()=>({ok:response.ok,status:response.status,json:async()=>response.data})});
    await assert.rejects(api.generateAi(connection,{system:"Analyze",user:"evidence",schema}), (error: Error)=>!error.message.includes("never-log-this")&&!error.message.includes("secret reasoning"));
  }
});
test("Unsupported structured format retries once on the same provider; authentication does not retry", async () => {
  const urls:string[]=[];const bodies:Record<string,unknown>[]=[];
  const api=load<typeof import("../lib/ai-client")>("lib/ai-client.ts",{}, {fetch:async(url:string,options:RequestInit)=>{
    urls.push(url);bodies.push(JSON.parse(options.body as string));
    return bodies.length===1?{ok:false,status:400,json:async()=>({error:{message:"response_format unsupported"}})}:{ok:true,json:async()=>envelope("compatible")};
  }});
  await api.generateAi({id:"x",name:"x",provider:"compatible",baseUrl:"http://localhost:1234/v1",modelId:"local",timeoutSeconds:30,hasApiKey:false,apiKey:""},{system:"Analyze",user:"evidence",schema});
  assert.equal(urls.length,2);assert.equal(urls[0],urls[1]);assert.ok(bodies[0].response_format);assert.equal(bodies[1].response_format,undefined);
});
test("Local settings encrypt keys, never return them, retain/clear keys and remove deleted selections", () => {
  const directory=mkdtempSync(path.join(tmpdir(),"quantjournal-settings-test-"));
  try {
    const settings=load<typeof import("../lib/local-settings")>("lib/local-settings.ts",{"./settings-types":{AI_PROVIDERS,DEFAULT_MARKET,MARKET_INTERVALS:["1m","2m","5m","15m","30m","60m","90m","1d"]}}, {process:{cwd:()=>directory}});
    const input:AiConnectionInput={name:"Test",provider:"openai",baseUrl:"https://example.test/v1",modelId:"test-model",timeoutSeconds:30,apiKey:"private-test-credential"};
    settings.saveConnection(input);const dto=settings.getSettings();const id=dto.connections[0].id;
    assert.equal(dto.connections[0].hasApiKey,true);assert.equal(JSON.stringify(dto).includes("private-test-credential"),false);
    assert.equal(readFileSync(path.join(directory,".local/settings.json"),"utf8").includes("private-test-credential"),false);
    assert.equal(settings.resolveConnection(id,"daily-review").apiKey,"private-test-credential");
    settings.saveConnection({...input,id,apiKey:""});assert.equal(settings.resolveConnection(id,"daily-review").apiKey,"private-test-credential");
    settings.saveConnection({...input,id,apiKey:"",clearApiKey:true});assert.equal(settings.getSettings().connections[0].hasApiKey,false);
    settings.deleteConnection(id);assert.equal(settings.getSettings().connections.length,0);assert.equal(Object.keys(settings.getSettings().selections).length,0);
    assert.throws(()=>settings.validateBaseUrl("https://user:secret@example.test/v1"));
  } finally { rmSync(directory,{recursive:true,force:true}); }
});
test("yfinance coverage is interval-specific and never silently becomes a coarser interval", () => {
  const now=new Date("2026-10-13T12:00:00Z");
  assert.equal(availableYfinanceIntervals("2026-10-12",now).includes("1m"),true);
  assert.equal(availableYfinanceIntervals("2026-09-13",now).includes("1m"),false);
  assert.equal(availableYfinanceIntervals("2026-09-13",now).includes("5m"),true);
  assert.deepEqual(availableYfinanceIntervals("2026-01-01",now),["60m","1d"]);
  assert.deepEqual(availableYfinanceIntervals("2023-01-01",now),["1d"]);
});
test("Bar normalization rejects invalid bars, sorts/deduplicates and validates date boundaries", () => {
  const bar={time:2,date:"2026-10-12",open:10,high:12,low:9,close:11,volume:null};
  const result=cleanMarketBars([bar,{...bar,time:1},{...bar,time:1},{...bar,time:3,high:8}]);
  assert.deepEqual(result.map(b=>b.time),[1,2]);
  assert.throws(()=>validateMarketRequest({symbol:"SPY",from:"2026-02-30",to:"2026-03-01",interval:"1d"}));
  assert.throws(()=>validateMarketRequest({symbol:"SPY",from:"2026-10-13",to:"2026-10-12",interval:"1d"}));
  assert.equal(valueAt({data:{rows:[{o:10}]}},"data.rows.0.o"),10);
});
test("Custom mapping handles milliseconds and ISO session dates without shifting daily dates",async()=>{
  const runtime=load<typeof import("../lib/market-data")>("lib/market-data.ts",{
    "./local-settings":{getSettings:()=>({market:DEFAULT_MARKET})},
    "./market-types":{availableYfinanceIntervals,cleanMarketBars,validateMarketRequest,valueAt},
  },{fetch:async()=>({ok:true,json:async()=>({bars:[{t:"2026-10-12",o:100,h:102,l:99,c:101,v:20}]})})});
  const custom={...DEFAULT_MARKET.custom,url:"https://example.test/{symbol}",timeFormat:"iso" as const,fields:{time:"t",open:"o",high:"h",low:"l",close:"c",volume:"v"}};
  const bars=await runtime.customBars({symbol:"SPY",from:"2026-10-12",to:"2026-10-12",interval:"1d"},custom,"");
  assert.equal(bars[0].date,"2026-10-12");assert.equal(bars[0].close,101);
});
test("Market provider failures return empty bars and useful states without random prices", async () => {
  const directory=mkdtempSync(path.join(tmpdir(),"quantjournal-market-test-"));
  const day=new Date().toISOString().slice(0,10);
  try {
    const runtime=load<typeof import("../lib/market-data")>("lib/market-data.ts",{
      "./local-settings":{getSettings:()=>({market:DEFAULT_MARKET}),getMarketSecret:()=>""},
      "./market-types":{availableYfinanceIntervals,cleanMarketBars,validateMarketRequest,valueAt},
      "node:util":{promisify:()=>async()=>{throw new Error("private Python diagnostic");}},
    },{process:{cwd:()=>directory,platform:process.platform},setTimeout:(callback:()=>void)=>setTimeout(callback,0)});
    const missing=await runtime.getMarketDataResult({symbol:"SPY",from:day,to:day,interval:"1d",source:"yfinance"});
    assert.equal(missing.status,"unavailable");assert.equal(missing.bars.length,0);assert.match(missing.limitations[0],/Python\/yfinance/);
    assert.equal(missing.limitations[0].includes("private Python diagnostic"),false);
    const noKey=await runtime.getMarketDataResult({symbol:"SPY",from:day,to:day,interval:"1d",source:"massive"});
    assert.equal(noKey.status,"unavailable");assert.equal(noKey.bars.length,0);assert.match(noKey.limitations[0],/your own Massive/);
    const old=await runtime.getMarketDataResult({symbol:"SPY",from:"2020-01-02",to:"2020-01-02",interval:"5m",source:"yfinance"});
    assert.equal(old.status,"unsupported");assert.equal(old.interval,"5m");assert.equal(old.bars.length,0);
  } finally {rmSync(directory,{recursive:true,force:true});}
});
test("AI timeout and rate limits fail without retrying or exposing provider payloads",async()=>{
  const connection={id:"x",name:"x",provider:"openai" as const,baseUrl:"https://example.test",modelId:"test",timeoutSeconds:10,hasApiKey:true,apiKey:"private-test-key"};
  for(const mode of ["timeout","rate-limit"]){let calls=0;
    const client=load<typeof import("../lib/ai-client")>("lib/ai-client.ts",{}, {fetch:async()=>{calls++;if(mode==="timeout")throw new Error("private-test-key endpoint diagnostic");return {ok:false,status:429,json:async()=>({error:{message:"private-test-key"}})};}});
    await assert.rejects(client.generateAi(connection,{system:"Analyze",user:"synthetic"}),(error:Error)=>!error.message.includes("private-test-key"));
    assert.equal(calls,1);
  }
});
