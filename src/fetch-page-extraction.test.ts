// @implements REQ-004 REQ-021b content-mode REQ-021b full-content-mode REQ-021c date-determinable REQ-021c crawl-date REQ-021c extract-date REQ-021g cache-hit REQ-021j REQ-021k REQ-021d attempt-cap
// @implements REQ-021a redirect-hop-cap
// @implements REQ-021d depth-cap
// @implements REQ-021d per-hop-guard
// @implements REQ-021f renderer-fallthrough
// fetch_page extraction is asserted through the spawned server against a
// loopback page stub, so the no-match metadata, the plain/raw envelope, the
// publication/modification split, and the crawl/extract truncation are measured
// on the real handler rather than on a copy of it.
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { createInterface } from "node:readline";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { isBotChallenge } from "./lib/bot-challenge.js";
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
let auditLogPath: string | undefined;
const stubs: StubProvider[] = [];

afterAll(() => {
  server?.close();
});

beforeAll(async () => {
  const cfg = writeHermeticConfig("http://127.0.0.1:1", {
    fetch: {
      allow_private_urls: true,
      cache: { kb_read: false, kb_max_age_hours: 24 },
      crawl_max_pages: 4,
      crawl_max_depth: 1,
    },
    // REQ-021a: a non-default hop cap, so the assertion below proves the
    // configured value reaches the redirect guard instead of a literal.
    output: { max_redirect_hops: 2 },
    kb: { auto_index: true },
    // REQ-098/REQ-021d: a file sink so the crawl's refusal audit trail can be
    // asserted, not just its response shape.
    fileLogs: true,
  });
  root = cfg.root;
  auditLogPath = cfg.auditLogPath;
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
async function waitForStoredOn(srv: Server, url: string): Promise<Record<string, unknown>> {
  for (let attempt = 0; attempt < 60; attempt++) {
    const response = await srv.call("tools/call", {
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

function waitForStored(url: string): Promise<Record<string, unknown>> {
  return waitForStoredOn(server, url);
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

describe("crawl and extract date detection (F-R4-C-4 / REQ-021c crawl-date extract-date)", () => {
  const MODIFIED_PAGE =
    '<html><head><meta property="og:updated_time" content="2025-07-09T08:00:00Z"></head><body><p>Crawled and extracted.</p></body></html>';
  const PUBLISHED_PAGE =
    '<html><head><meta property="article:published_time" content="2024-03-05T10:00:00Z"></head><body><p>Published once.</p></body></html>';

  test("a crawl reports a page date from document metadata with no extra request", async () => {
    const { server: stub, url } = await page({ body: MODIFIED_PAGE });
    const before = stub.requests;
    const { envelope } = await fetchPage({ url, crawl: true, detect_date: true });

    const pages = envelope.results as Array<Record<string, unknown>>;
    expect(pages[0].last_updated).toBe("2025-07-09");
    expect(pages[0].date_source).toBe("meta");
    expect(pages[0].date_confidence).toBe("high");
    // The date comes from the already-fetched HTML: one request for the page.
    // A per-page HEAD or metadata GET would make this 2 or 3.
    expect(stub.requests - before).toBe(1);
  });

  test("a crawl reports a publication date as published_date, never last_updated", async () => {
    const { url } = await page({ body: PUBLISHED_PAGE });
    const { envelope } = await fetchPage({ url, crawl: true, detect_date: true });

    const pages = envelope.results as Array<Record<string, unknown>>;
    expect(pages[0].published_date).toBe("2024-03-05");
    expect(pages[0].last_updated).toBeUndefined();
  });

  test("an extract reports the same document date evidence", async () => {
    const { url } = await page({ body: MODIFIED_PAGE });
    const { envelope } = await fetchPage({ url, extract: true, detect_date: true });

    expect(envelope.last_updated).toBe("2025-07-09");
    expect(envelope.date_source).toBe("meta");
    const first = (envelope.results as Array<Record<string, unknown>>)[0];
    expect(first.last_updated).toBe("2025-07-09");
  });
});

describe("metadata date after a HEAD redirect (F-R4-C-6 / REQ-021c date-determinable)", () => {
  test("a redirected page still yields document-metadata evidence", async () => {
    const http = createServer((req, res) => {
      const path = req.url ?? "/";
      if (path === "/start") {
        // Both HEAD and GET redirect; only the redirect walk can reach the HTML.
        res.writeHead(302, { location: "/article" });
        res.end();
        return;
      }
      if (path === "/article") {
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        res.end(
          '<html><head><meta property="og:updated_time" content="2025-07-09T08:00:00Z"></head><body><p>Redirect target.</p></body></html>'
        );
        return;
      }
      res.writeHead(404);
      res.end();
    });
    await new Promise<void>((resolve) => http.listen(0, "127.0.0.1", resolve));
    const address = http.address();
    const port = typeof address === "object" && address ? address.port : 0;
    try {
      const { envelope } = await fetchPage({ url: `http://127.0.0.1:${port}/start`, detect_date: true });
      expect(envelope.last_updated).toBe("2025-07-09");
      expect(envelope.date_source).toBe("meta");
    } finally {
      await new Promise<void>((resolve) => http.close(() => resolve()));
    }
  });
});

describe("knowledge-base cache parity for a question (F-R4-C-5 / REQ-021g cache-hit)", () => {
  /** A second spawned server whose cache read is on (the shared one sets it off). */
  async function startCacheServer(): Promise<Server> {
    const cfg = writeHermeticConfig("http://127.0.0.1:1", {
      fetch: {
        allow_private_urls: true,
        cache: { kb_read: true, kb_max_age_hours: 24 },
        detect_date: false,
      },
      kb: { auto_index: true },
    });
    const srv = startServer(cfg.env);
    const init = await srv.call("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "fetch-cache-parity-test", version: "1.0.0" },
    });
    expect(init.error).toBeUndefined();
    await new Promise((resolve) => setTimeout(resolve, 500));
    return srv;
  }

  async function callFetch(
    srv: Server,
    args: Record<string, unknown>,
  ): Promise<{ result: ToolResult; envelope: Record<string, unknown> }> {
    const response = await srv.call("tools/call", {
      name: "infobroker_fetch_page",
      arguments: { renderer: "native_fetch", ...args },
    });
    expect(response.error).toBeUndefined();
    const result = response.result as ToolResult;
    return { result, envelope: payload(result) };
  }

  async function storedPage(body: string): Promise<{ srv: Server; stub: StubProvider; url: string }> {
    const srv = await startCacheServer();
    const stub = await startStubProvider({ pageBody: body });
    stubs.push(stub);
    const url = `${stub.url}/page/1`;
    await callFetch(srv, { url, detect_date: false });
    await waitForStoredOn(srv, url);
    return { srv, stub, url };
  }

  test("a question is answered from a fresh copy without an outbound request", async () => {
    const { srv, stub, url } = await storedPage(
      "<html><body><p>The reactor core produces one point two terawatts of output.</p></body></html>"
    );
    try {
      const before = stub.requests;
      const { envelope } = await callFetch(srv, { url, detect_date: false, question: "reactor core output" });

      expect(envelope.provider).toBe("knowledge_base");
      expect(envelope.extraction_mode).toBe("content");
      expect(envelope.question).toBe("reactor core output");
      const meta = envelope.meta as Record<string, unknown>;
      expect(meta.cache).toBe("hit");
      expect(meta.passages_returned).toBeGreaterThan(0);
      expect(meta.match_quality).not.toBe("none");
      expect(stub.requests).toBe(before);
    } finally {
      srv.close();
    }
  });

  test("a zero-passage cache hit returns the full content with the hit reported", async () => {
    const { srv, url } = await storedPage(
      "<html><body><p>The reactor core produces one point two terawatts of output.</p></body></html>"
    );
    try {
      const { envelope } = await callFetch(srv, {
        url,
        detect_date: false,
        question: "quantum chromodynamics lattice",
      });

      expect(envelope.provider).toBe("knowledge_base");
      expect(envelope.extraction_mode).toBe("full_content");
      expect(envelope.note).toContain("No passage addressed the question");
      const meta = envelope.meta as Record<string, unknown>;
      expect(meta.cache).toBe("hit");
      expect(meta.passages_returned).toBe(0);
      expect(meta.match_quality).toBe("none");
    } finally {
      srv.close();
    }
  });

  test("raw mode refuses a JSON-array string instead of running a batch", async () => {
    const response = await server.call("tools/call", {
      name: "infobroker_fetch_page",
      arguments: {
        raw: true,
        url: JSON.stringify(["http://127.0.0.1:1/page/1", "http://127.0.0.1:1/page/2"]),
      },
    });
    expect(response.error).toBeUndefined();
    const text = (response.result as ToolResult).content[0]?.text ?? "";
    expect(text.startsWith("[ERROR] ")).toBe(true);
    expect(text).toContain("single URL");
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

describe("crawl depth cap (F-R4-C-3 / REQ-021d depth-cap)", () => {
  test("stops expanding at the configured depth and reports each page's depth", async () => {
    // A loopback chain: /0 links to /1, /1 links to /2, and so on. The file's
    // config sets crawl_max_depth: 1, so only /0 and /1 may be returned even
    // though the page cap would allow more.
    const http = createServer((req, res) => {
      const path = req.url ?? "/";
      const index = Number(path.replace("/", ""));
      if (!Number.isFinite(index) || index < 0 || index > 6) {
        res.writeHead(404);
        res.end();
        return;
      }
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(`<html><body><a href="/${index + 1}">deeper</a><p>level ${index}</p></body></html>`);
    });
    await new Promise<void>((resolve) => http.listen(0, "127.0.0.1", resolve));
    const address = http.address();
    const port = typeof address === "object" && address ? address.port : 0;

    try {
      const { envelope } = await fetchPage({
        url: `http://127.0.0.1:${port}/0`,
        crawl: true,
        detect_date: false,
      });
      const results = envelope.results as Array<Record<string, unknown>>;
      const depths = results.map((page) => Number(page.depth));

      expect(depths[0]).toBe(0);
      expect(Math.max(...depths)).toBe(1);
      expect(results).toHaveLength(2);
    } finally {
      await new Promise<void>((resolve) => http.close(() => resolve()));
    }
  });
});

describe("redirect-hop cap (F-R4-A-3 / REQ-021a redirect-hop-cap)", () => {
  /** A loopback chain: /start 302s to /r/1, ... and /r/<redirects> answers 200. */
  async function redirectChain(redirects: number): Promise<{ url: string; close: () => Promise<void> }> {
    const http = createServer((req, res) => {
      const path = req.url ?? "/";
      if (path === "/start") {
        res.writeHead(302, { location: "/r/1" });
        res.end();
        return;
      }
      const hop = Number(path.replace("/r/", ""));
      if (Number.isFinite(hop) && hop > 0 && hop <= redirects) {
        if (hop < redirects) {
          res.writeHead(302, { location: `/r/${hop + 1}` });
          res.end();
          return;
        }
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        res.end(`<html><body><p>terminal page after ${redirects} redirect(s)</p></body></html>`);
        return;
      }
      res.writeHead(404);
      res.end();
    });
    await new Promise<void>((resolve) => http.listen(0, "127.0.0.1", resolve));
    const address = http.address();
    const port = typeof address === "object" && address ? address.port : 0;
    return {
      url: `http://127.0.0.1:${port}/start`,
      close: () => new Promise<void>((resolve) => http.close(() => resolve())),
    };
  }

  test("follows a chain within the configured cap", async () => {
    const chain = await redirectChain(1);
    try {
      const { envelope } = await fetchPage({ url: chain.url, detect_date: false });
      const results = envelope.results as Array<Record<string, unknown>>;
      expect(String(results[0].snippet ?? results[0].content ?? "")).toContain("terminal page");
    } finally {
      await chain.close();
    }
  });

  test("refuses a chain longer than the configured cap", async () => {
    // The file's config sets output.max_redirect_hops: 2; a literal 5 in the
    // handler would let this two-redirect chain through.
    const chain = await redirectChain(2);
    try {
      const response = await server.call("tools/call", {
        name: "infobroker_fetch_page",
        arguments: { url: chain.url, renderer: "native_fetch", detect_date: false },
      });
      expect(response.error).toBeUndefined();
      const text = (response.result as ToolResult).content[0]?.text ?? "";
      expect(text.startsWith("[ERROR] ")).toBe(true);
      expect(text.toLowerCase()).toContain("redirect");
    } finally {
      await chain.close();
    }
  });
});

describe("renderer fall-through on an anti-bot challenge (REQ-021f renderer-fallthrough)", () => {
  // The reader answers with a verification page instead of the target. The
  // "Just a moment..." title is a decisive marker (src/lib/bot-challenge.ts:11),
  // and the case asserts the fixture is a challenge so it cannot rot.
  const CHALLENGE = `Title: Just a moment...

URL Source: http://127.0.0.1/page/1

Markdown Content:

Checking your browser before accessing the target page.
`;

  test("a challenge from the primary renderer falls through to the native renderer", async () => {
    expect(isBotChallenge(CHALLENGE)).toBe(true);

    const readerPaths: string[] = [];
    const http = createServer((req, res) => {
      const path = req.url ?? "/";
      // The reader calls `<base><target>`, so its request path embeds the
      // target URL and is distinguishable from the page request itself.
      if (path.startsWith("/http://")) {
        readerPaths.push(path);
        res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
        res.end(CHALLENGE);
        return;
      }
      if (path === "/page/1") {
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        res.end("<html><body><p>real page body from the native renderer</p></body></html>");
        return;
      }
      res.writeHead(404);
      res.end();
    });
    await new Promise<void>((resolve) => http.listen(0, "127.0.0.1", resolve));
    const address = http.address();
    const port = typeof address === "object" && address ? address.port : 0;
    const base = `http://127.0.0.1:${port}`;

    const cfg = writeHermeticConfig("http://127.0.0.1:1", {
      // HEDGING OFF is the point: with hedging on, a hedge win satisfies the
      // provider assertion without the challenge ever being classified
      // (src/hedge.ts:118-123), which would make this case vacuous.
      output: { hedge_enabled: false },
      enable: ["jina"],
      chains: { content_fetch: ["jina", "native_fetch"] },
      fetch: {
        allow_private_urls: true,
        cache: { kb_read: false, kb_max_age_hours: 24 },
        detect_date: false,
      },
      kb: { auto_index: false },
    });
    cfg.env.INFOBROKER_JINA_URL = `${base}/`;
    const caseServer = startServer(cfg.env);
    try {
      const init = await caseServer.call("initialize", {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "jina-fallthrough-test", version: "1.0.0" },
      });
      expect(init.error).toBeUndefined();
      await new Promise((resolve) => setTimeout(resolve, 500));

      const response = await caseServer.call("tools/call", {
        name: "infobroker_fetch_page",
        arguments: { url: `${base}/page/1`, detect_date: false },
      });
      expect(response.error).toBeUndefined();
      const envelope = payload(response.result as ToolResult);

      expect(envelope.status).toBe("ok");
      expect(envelope.provider).toBe("native_fetch");
      const results = JSON.stringify(envelope.results ?? envelope.result ?? envelope);
      expect(results).toContain("real page body from the native renderer");
      expect(results).not.toContain("Just a moment");
      expect(readerPaths).toHaveLength(1);
    } finally {
      caseServer.close();
      await new Promise<void>((resolve) => http.close(() => resolve()));
    }
  });
});

describe("crawl per-hop refusal (REQ-021d per-hop-guard)", () => {
  test("a hop refused at its redirect is skipped, audited, and the crawl continues", async () => {
    const http = createServer((req, res) => {
      const path = req.url ?? "/";
      if (path === "/start") {
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        res.end(
          '<html><body><a href="/hop1">refused hop</a><a href="/hop2">good hop</a><p>crawl root page</p></body></html>'
        );
        return;
      }
      // A redirect out of HTTP is refused by the safety guard even though the
      // config permits private targets, because the protocol test does not
      // consult that flag (src/lib/url-guard.ts:94-96).
      if (path === "/hop1") {
        res.writeHead(302, { location: "ftp://example.com/x" });
        res.end();
        return;
      }
      if (path === "/hop2") {
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        res.end("<html><body><p>good hop page</p></body></html>");
        return;
      }
      res.writeHead(404);
      res.end();
    });
    await new Promise<void>((resolve) => http.listen(0, "127.0.0.1", resolve));
    const address = http.address();
    const port = typeof address === "object" && address ? address.port : 0;
    const base = `http://127.0.0.1:${port}`;

    try {
      const { envelope } = await fetchPage({ url: `${base}/start`, crawl: true, detect_date: false });
      const results = envelope.results as Array<Record<string, unknown>>;
      expect(results.map((page) => page.url)).toEqual([`${base}/start`, `${base}/hop2`]);

      const meta = envelope.meta as Record<string, unknown>;
      // The refused hop consumed a page-cap attempt and returned no page.
      expect(meta.attempts).toBe(3);
      expect(meta.pages).toBe(2);

      // REQ-098: the refusal is recorded against the hop the crawl asked for.
      expect(auditLogPath).toBeTruthy();
      expect(existsSync(auditLogPath!)).toBe(true);
      const audit = readFileSync(auditLogPath!, "utf-8");
      expect(audit).toContain("network_target_refused");
      expect(audit).toContain(`${base}/hop1`);
    } finally {
      await new Promise<void>((resolve) => http.close(() => resolve()));
    }
  });
});
