// @implements REQ-004 REQ-021b content-mode REQ-021b full-content-mode REQ-021c date-determinable REQ-021j REQ-021k REQ-021d attempt-cap
// fetch_page extraction is asserted through the spawned server against a
// loopback page stub, so the no-match metadata, the plain/raw envelope, the
// publication/modification split, and the crawl/extract truncation are measured
// on the real handler rather than on a copy of it.
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  startStubProvider,
  writeHermeticConfig,
  type StubProvider,
} from "./lib/stub-provider.js";

const REPO_ROOT = join(import.meta.dirname, "..");

interface RpcMessage {
  jsonrpc: "2.0";
  id?: number;
  result?: unknown;
  error?: { code: number; message: string };
}

interface ToolResult {
  content: Array<{ type: string; text: string }>;
  structuredContent?: Record<string, unknown>;
}

interface Server {
  call(method: string, params: unknown): Promise<RpcMessage>;
  close(): void;
}

function startServer(env: NodeJS.ProcessEnv): Server {
  const child = spawn(join(REPO_ROOT, "node_modules", ".bin", "tsx"), [join(REPO_ROOT, "src", "index.ts")], {
    cwd: REPO_ROOT,
    stdio: ["pipe", "pipe", "pipe"],
    env,
  });
  const pending = new Map<number, (msg: RpcMessage) => void>();
  const rl = createInterface({ input: child.stdout! });
  rl.on("line", (line) => {
    let msg: RpcMessage;
    try {
      msg = JSON.parse(line) as RpcMessage;
    } catch {
      return; // non-JSON stdout line is not an RPC response
    }
    if (typeof msg.id === "number" && pending.has(msg.id)) {
      const resolve = pending.get(msg.id)!;
      pending.delete(msg.id);
      resolve(msg);
    }
  });
  let nextId = 1;
  const call = (method: string, params: unknown): Promise<RpcMessage> => {
    const id = nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`${method} timed out`)), 20000);
      pending.set(id, (msg) => {
        clearTimeout(timer);
        resolve(msg);
      });
      child.stdin!.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
    });
  };
  return { call, close: () => child.kill() };
}

/** Parse an `[OK]` envelope; a non-OK prefix fails the assertion with the body. */
function payload(result: unknown): Record<string, unknown> {
  const r = result as ToolResult;
  const text = r.content[0]?.text ?? "";
  expect(text.startsWith("[OK] ")).toBe(true);
  return JSON.parse(text.slice("[OK] ".length)) as Record<string, unknown>;
}

let server: Server;
let root: string;
const stubs: StubProvider[] = [];

afterAll(() => {
  server?.close();
});

beforeAll(async () => {
  const cfg = writeHermeticConfig("http://127.0.0.1:1", {
    fetch: { allow_private_urls: true, cache: { kb_read: false, kb_max_age_hours: 24 }, crawl_max_pages: 4 },
    kb: { auto_index: true },
  });
  root = cfg.root;
  server = startServer(cfg.env);
  const init = await server.call("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "fetch-page-extraction-test", version: "1.0.0" },
  });
  expect(init.error).toBeUndefined();
  // The KB initializes after the MCP handshake.
  await new Promise((resolve) => setTimeout(resolve, 500));
});

afterAll(async () => {
  for (const stub of stubs.splice(0)) await stub.close();
});

async function page(options: { body?: string; headers?: Record<string, string> } = {}): Promise<{ server: StubProvider; url: string }> {
  const stub = await startStubProvider({
    pageBody: options.body,
    pageHeaders: options.headers,
  });
  stubs.push(stub);
  return { server: stub, url: `${stub.url}/page/1` };
}

async function fetchPage(args: Record<string, unknown>): Promise<{ result: ToolResult; envelope: Record<string, unknown> }> {
  const response = await server.call("tools/call", {
    name: "infobroker_fetch_page",
    arguments: { renderer: "native_fetch", ...args },
  });
  expect(response.error).toBeUndefined();
  const result = response.result as ToolResult;
  return { result, envelope: payload(result) };
}

/** Poll `manage_kb get` until the deferred auto-index has stored the URL. */
async function waitForStored(url: string): Promise<Record<string, unknown>> {
  for (let attempt = 0; attempt < 60; attempt++) {
    const response = await server.call("tools/call", {
      name: "infobroker_manage_kb",
      arguments: { action: "get", source_url: url },
    });
    const text = (response.result as ToolResult).content[0]?.text ?? "";
    if (text.startsWith("[OK] ")) {
      return payload(response.result);
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`auto-index did not store ${url} within 3s`);
}

const LONG_BODY =
  "<html><body><p>" +
  Array.from({ length: 12 }, (_, i) => `Sentence number ${i + 1} carries enough words to exceed the bound.`).join(" ") +
  "</p></body></html>";

describe("no-match extraction metadata (F-R4-D-1)", () => {
  test("an unreadable page reports full content with zero passages and a none band", async () => {
    const { url } = await page({ body: "<html><body></body></html>" });
    const { envelope } = await fetchPage({ url, question: "what is the population", detect_date: false });

    expect(envelope.extraction_mode).toBe("full_content");
    expect(envelope.question).toBe("what is the population");
    expect(envelope.note).toContain("No passage addressed the question");
    const meta = envelope.meta as Record<string, unknown>;
    expect(meta.passages_returned).toBe(0);
    expect(meta.match_quality).toBe("none");
  });
});

describe("plain and raw envelope metadata (F-R4-D-3)", () => {
  test("a plain fetch reports url, extraction mode, and a zero passage count", async () => {
    const { url } = await page();
    const { envelope } = await fetchPage({ url, detect_date: false });

    expect(envelope.url).toBe(url);
    expect(envelope.extraction_mode).toBe("content");
    const meta = envelope.meta as Record<string, unknown>;
    expect(meta.passages_returned).toBe(0);
  });

  test("a raw fetch exposes the same metadata in structuredContent", async () => {
    const { url } = await page();
    const response = await server.call("tools/call", {
      name: "infobroker_fetch_page",
      arguments: { url, renderer: "native_fetch", detect_date: false, raw: true },
    });
    expect(response.error).toBeUndefined();
    const result = response.result as ToolResult;
    // REQ-021j: plain text, not a JSON envelope.
    expect(result.content[0].text.startsWith("[OK]")).toBe(false);
    expect(result.content[0].text).toContain("Stub page content");
    const structured = result.structuredContent!;
    expect(structured.status).toBe("ok");
    expect(structured.provider).toBe("native_fetch");
    expect(structured.url).toBe(url);
    expect(structured.extraction_mode).toBe("content");
    expect((structured.meta as Record<string, unknown>).passages_returned).toBe(0);
    expect(structured.raw).toBe(true);
  });
});

describe("date evidence classification (F-R4-C-2)", () => {
  test("a publication-only page reports published_date, never last_updated", async () => {
    const { url } = await page({
      body: '<html><head><meta property="article:published_time" content="2024-03-05T10:00:00Z"></head><body><p>Published once.</p></body></html>',
    });
    const { envelope } = await fetchPage({ url, detect_date: true });

    expect(envelope.published_date).toBe("2024-03-05");
    expect(envelope.date_source).toBe("meta");
    expect(envelope.date_confidence).toBe("medium");
    expect(envelope.last_updated).toBeUndefined();
    const first = (envelope.results as Array<Record<string, unknown>>)[0];
    expect(first.published_date).toBe("2024-03-05");
    expect(first.last_updated).toBeUndefined();
  });

  test("modified evidence wins over publication evidence on the same page", async () => {
    const { url } = await page({
      body:
        '<html><head><meta property="article:published_time" content="2024-03-05T10:00:00Z">' +
        '<meta property="og:updated_time" content="2025-07-09T08:00:00Z"></head><body><p>Updated later.</p></body></html>',
    });
    const { envelope } = await fetchPage({ url, detect_date: true });

    expect(envelope.last_updated).toBe("2025-07-09");
    expect(envelope.date_confidence).toBe("high");
    expect(envelope.published_date).toBeUndefined();
  });

  test("only modified evidence is stored as a KB source date", async () => {
    const published = await page({
      body: '<html><head><meta property="article:published_time" content="2024-03-05T10:00:00Z"></head><body><p>Stored without an update date.</p></body></html>',
    });
    await fetchPage({ url: published.url, detect_date: true });
    const publishedDoc = (await waitForStored(published.url)).results as Array<Record<string, unknown>>;
    expect(publishedDoc[0].source_updated_at).toBeUndefined();

    const modified = await page({
      headers: { "last-modified": "Wed, 12 Mar 2025 10:00:00 GMT" },
      body: "<html><body><p>Stored with an update date.</p></body></html>",
    });
    await fetchPage({ url: modified.url, detect_date: true });
    const modifiedDoc = (await waitForStored(modified.url)).results as Array<Record<string, unknown>>;
    expect(modifiedDoc[0].source_updated_at).toBe("2025-03-12");
  });
});

describe("crawl and extract truncation (F-R4-C-9)", () => {
  function truncationFiles(): string[] {
    try {
      return readdirSync(join(root, "infobroker")).filter((name) => name.startsWith("trunc-"));
    } catch {
      return [];
    }
  }

  test("a clipped crawl page reports its own truncation and one full-text file", async () => {
    const before = truncationFiles().length;
    const { url } = await page({ body: LONG_BODY });
    const { envelope } = await fetchPage({ url, crawl: true, max_length: 60, detect_date: false });

    expect(envelope.truncated).toBe(true);
    const meta = envelope.meta as Record<string, unknown>;
    expect(meta.truncated_pages).toBe(1);
    const first = (envelope.results as Array<Record<string, unknown>>)[0];
    expect(first.truncated).toBe(true);
    const outputPath = String(first.output_path);
    expect(statSync(outputPath).mode & 0o777).toBe(0o600);
    expect(truncationFiles().length - before).toBe(1);
  });

  test("a clipped extract response reports truncation and one full-text file", async () => {
    const before = truncationFiles().length;
    const { url } = await page({ body: LONG_BODY });
    const { envelope } = await fetchPage({ url, extract: true, max_length: 60, detect_date: false });

    expect(envelope.extraction_mode).toBe("structured");
    expect(envelope.truncated).toBe(true);
    const outputPath = String(envelope.output_path);
    expect(statSync(outputPath).mode & 0o777).toBe(0o600);
    expect(truncationFiles().length - before).toBe(1);
  });
});

describe("crawl attempt cap (F-R4-C-8 / REQ-021d attempt-cap)", () => {
  test("counts outbound attempts, not returned pages", async () => {
    // The root links to eight paths the stub answers with 404, then to eight
    // real pages. The page cap is 4 (extended into the file's fetch config), so
    // the crawl must stop after four outbound requests and return ONE page —
    // the start page — instead of walking every dead link first and returning
    // four pages after twelve requests.
    const dead = Array.from(
      { length: 8 },
      (_, i) => `<a href="/dead/${i + 1}">dead ${i + 1}</a>`,
    ).join("");
    const good = Array.from(
      { length: 8 },
      (_, i) => `<a href="/page/${i + 2}">page ${i + 2}</a>`,
    ).join("");
    const stub = await startStubProvider({
      // `missing` 404s every path that is not `/page/N`, which is exactly the
      // dead-link shape this test needs.
      mode: "missing",
      pageBody: `<html><body>${dead}${good}<p>crawl root</p></body></html>`,
    });
    stubs.push(stub);

    const { envelope } = await fetchPage({
      url: `${stub.url}/page/1`,
      crawl: true,
      detect_date: false,
    });
    const results = envelope.results as Array<Record<string, unknown>>;
    const meta = envelope.meta as Record<string, unknown>;

    expect(meta.attempts).toBe(4);
    expect(results).toHaveLength(1);
    expect(stub.requests).toBe(4);
  });
});
