// @implements REQ-001
// @implements REQ-021j
// Structured-output contract: the text envelope is parsed into
// `structuredContent` on every tool, and fetch_page's raw mode returns plain
// text with metadata in the structured object. Unit tests cover the pure
// helpers; one stdio test proves the live SDK accepts the registered schema.
import { test, expect } from "vitest";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { isolatedConfigEnv } from "./lib/test-isolation.js";
import {
  finalizeToolResult,
  parseEnvelopeObject,
  rawRequestError,
  rawTextFromEnvelope,
} from "./structured-output.js";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function textResult(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

test("parseEnvelopeObject reads OK and ERROR envelopes", () => {
  expect(parseEnvelopeObject(`[OK] ${JSON.stringify({ status: "ok", provider: "wikipedia", results: [] })}`)).toEqual({
    status: "ok",
    provider: "wikipedia",
    results: [],
  });
  expect(
    parseEnvelopeObject(
      `[ERROR] ${JSON.stringify({ status: "error", provider: "none", error: { code: "rate_limited", message: "m" } })}`,
    ),
  ).toMatchObject({ status: "error", error: { code: "rate_limited" } });
});

test("parseEnvelopeObject rejects non-envelope text", () => {
  expect(parseEnvelopeObject("plain text")).toBeUndefined();
  expect(parseEnvelopeObject("[OK] not json")).toBeUndefined();
  expect(parseEnvelopeObject("[OK] [1,2]")).toBeUndefined();
});

test("finalizeToolResult attaches the parsed envelope", () => {
  const result = textResult(`[OK] ${JSON.stringify({ status: "ok", provider: "github", results: [{ title: "x" }] })}`);
  const finalized = finalizeToolResult(result, []);
  expect(finalized.structuredContent).toEqual({ status: "ok", provider: "github", results: [{ title: "x" }] });
});

test("finalizeToolResult synthesizes an object for non-JSON text", () => {
  const finalized = finalizeToolResult(textResult("plain text"), []);
  expect(finalized.structuredContent).toMatchObject({ status: "ok", provider: "none", results: [], message: "plain text" });
});

test("finalizeToolResult merges notices into structured content", () => {
  const notice = { code: "config_drift", message: "drift" };
  const result = textResult(`[OK] ${JSON.stringify({ status: "ok", provider: "x", results: [] })}`);
  const finalized = finalizeToolResult(result, [notice]);
  expect(finalized.structuredContent.notices).toEqual([notice]);
});

test("finalizeToolResult respects a handler-provided structuredContent", () => {
  const result = {
    ...textResult("raw page text"),
    structuredContent: { status: "ok", provider: "jina", results: [], raw: true },
  };
  const finalized = finalizeToolResult(result, []);
  expect(finalized.structuredContent).toMatchObject({ raw: true, provider: "jina" });
});

test("rawRequestError accepts only a single URL without crawl or extract", () => {
  expect(rawRequestError("https://example.com", false, false)).toBeUndefined();
  expect(rawRequestError(["https://a", "https://b"], false, false)).toMatch(/single URL/);
  expect(rawRequestError("https://example.com", true, false)).toMatch(/single URL/);
  expect(rawRequestError("https://example.com", false, true)).toMatch(/single URL/);
});

test("rawTextFromEnvelope prefers the top result, then snippets, then note", () => {
  expect(rawTextFromEnvelope({ results: [{ snippet: "top passage" }], snippets: [{ text: "other" }] })).toBe("top passage");
  expect(rawTextFromEnvelope({ results: [], snippets: [{ text: "first snippet" }] })).toBe("first snippet");
  expect(rawTextFromEnvelope({ results: [], note: "no passage addressed the question" })).toBe("no passage addressed the question");
});

interface RpcMessage {
  jsonrpc: "2.0";
  id?: number;
  result?: unknown;
  error?: { code: number; message: string };
}

async function withServer<T>(fn: (call: (method: string, params: unknown) => Promise<RpcMessage>) => Promise<T>): Promise<T> {
  const child = spawn(join(REPO_ROOT, "node_modules", ".bin", "tsx"), [join(REPO_ROOT, "src", "index.ts")], {
    cwd: REPO_ROOT,
    stdio: ["pipe", "pipe", "pipe"],
    env: isolatedConfigEnv(),
  });
  const pending = new Map<number, (msg: RpcMessage) => void>();
  const rl = createInterface({ input: child.stdout! });
  rl.on("line", (line) => {
    let msg: RpcMessage;
    try {
      msg = JSON.parse(line) as RpcMessage;
    } catch {
      return; // non-JSON stdout line — not an RPC response
    }
    if (typeof msg.id === "number" && pending.has(msg.id)) {
      const resolve = pending.get(msg.id)!;
      pending.delete(msg.id);
      resolve(msg);
    }
  });
  let nextId = 1;
  const send = (obj: unknown) => child.stdin!.write(JSON.stringify(obj) + "\n");
  const call = (method: string, params: unknown): Promise<RpcMessage> => {
    const id = nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`${method} timed out`)), 20000);
      pending.set(id, (msg) => {
        clearTimeout(timer);
        resolve(msg);
      });
      send({ jsonrpc: "2.0", id, method, params });
    });
  };
  try {
    const init = await call("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "structured-output-test", version: "1.0.0" },
    });
    expect(init.error).toBeUndefined();
    send({ jsonrpc: "2.0", method: "notifications/initialized" });
    return await fn(call);
  } finally {
    child.kill();
  }
}

test("live tools expose structuredContent and reject an invalid raw combination", async () => {
  await withServer(async (call) => {
    const listed = await call("tools/list", {});
    expect(listed.error).toBeUndefined();
    const tools = (listed.result as { tools?: Array<{ name: string; outputSchema?: Record<string, unknown> }> }).tools ?? [];
    expect(tools).toHaveLength(7);
    for (const tool of tools) {
      expect(tool.outputSchema, `${tool.name} missing outputSchema`).toBeTruthy();
      expect(Object.keys(tool.outputSchema!).length).toBeGreaterThan(0);
    }

    const listedCall = await call("tools/call", { name: "infobroker_inspect_providers", arguments: { action: "list" } });
    expect(listedCall.error).toBeUndefined();
    const result = listedCall.result as { content: Array<{ text: string }>; structuredContent?: Record<string, unknown> };
    expect(result.structuredContent, "inspect_providers returned no structuredContent").toBeTruthy();
    expect(result.structuredContent!.status).toBe("ok");
    expect(result.structuredContent).toEqual(parseEnvelopeObject(result.content[0].text));

    const rawInvalid = await call("tools/call", {
      name: "infobroker_fetch_page",
      arguments: { url: ["https://a.example", "https://b.example"], raw: true },
    });
    expect(rawInvalid.error).toBeUndefined();
    const invalid = rawInvalid.result as { content: Array<{ text: string }>; structuredContent?: Record<string, unknown> };
    expect(invalid.content[0].text.startsWith("[ERROR]")).toBe(true);
    expect(invalid.structuredContent!.status).toBe("error");
    expect((invalid.structuredContent!.error as { code: string }).code).toBe("invalid_input");
  });
}, 30000);
