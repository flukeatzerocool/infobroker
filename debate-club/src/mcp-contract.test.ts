// @implements REQ-001 REQ-002 REQ-003 REQ-004 REQ-013 REQ-021a REQ-027 REQ-060 REQ-089
// Debate-club Arena: drives the real Infobroker MCP server over stdio with
// every outbound request served from committed fixtures, and asserts the
// mechanical response contracts (envelope, error taxonomy, result shape,
// provider selection, KB roundtrip, SSRF refusal). No model, no network.

import { afterAll, beforeAll, beforeEach, test, expect } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { startServer, fingerprint, type DebateServer } from "./client.js";
import {
  parseEnvelope,
  expectOk,
  expectError,
  expectSearchResultShape,
  countResults,
  providerOf,
} from "./contracts.js";
import { makeRecord, toJsonl, type TelemetryRecord } from "./telemetry.js";

const RUN_ID = new Date().toISOString();
const records: TelemetryRecord[] = [];
let server: DebateServer;
let scenario = "setup";
let expectedError: string | undefined;

interface Observed {
  text: string;
  latencyMs: number;
  prefix: "[OK]" | "[ERROR]";
  status: "ok" | "error";
  provider: string;
  errorCode?: string;
  results: number;
  bytes: number;
}

async function call(tool: string, args: Record<string, unknown>): Promise<Observed> {
  const r = await server.call(tool, args);
  const e = parseEnvelope(r.text);
  const err = e.body.error as { code?: string } | undefined;
  const observed: Observed = {
    text: r.text,
    latencyMs: r.latencyMs,
    prefix: e.prefix,
    status: e.ok ? "ok" : "error",
    provider: providerOf(e.body),
    errorCode: err?.code,
    results: countResults(e.body),
    bytes: e.bytes,
  };
  records.push(
    makeRecord({
      run_id: RUN_ID,
      scenario_id: scenario,
      tool,
      prefix: observed.prefix,
      status: observed.status,
      provider: observed.provider,
      error_code: observed.errorCode,
      expected_error_code: expectedError,
      results_count: observed.results,
      response_bytes: observed.bytes,
      latency_ms: Math.round(observed.latencyMs),
      fingerprint: fingerprint(),
    })
  );
  return observed;
}

beforeEach(() => {
  expectedError = undefined;
});

beforeAll(async () => {
  server = await startServer();
  // The KB initializes after the MCP handshake; give it a beat so manage_kb
  // is configured before the KB scenarios run.
  await new Promise((r) => setTimeout(r, 500));
}, 60000);

afterAll(() => {
  const dir = join(import.meta.dirname, "..", ".runs", "latest");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "telemetry.ndjson"), toJsonl(records));
  writeFileSync(join(dir, "unmatched.log"), server.unmatched().join("\n"));
  server.stop();
});

test("tools/list advertises exactly the seven-tool surface", async () => {
  scenario = "surface";
  const names = (await server.listTools()).sort();
  expect(names).toEqual([
    "infobroker_fetch_page",
    "infobroker_get_citations",
    "infobroker_inspect_providers",
    "infobroker_manage_kb",
    "infobroker_reload_config",
    "infobroker_search_web",
    "infobroker_verify_claims",
  ]);
});

test("search_web returns a shape-valid result set from the pinned provider", async () => {
  scenario = "search-wikipedia";
  const out = await call("infobroker_search_web", {
    query: "retrieval augmented generation",
    provider: "wikipedia",
    max_results: 3,
    deep: false,
  });
  const body = expectOk(out.text);
  expect(providerOf(body)).toBe("wikipedia");
  expectSearchResultShape(body.results as Array<Record<string, unknown>>);
  expect((body.results as unknown[]).length).toBeGreaterThan(0);
});

test("search_web rejects an unknown provider with invalid_input", async () => {
  scenario = "search-bad-provider";
  expectedError = "invalid_input";
  const out = await call("infobroker_search_web", { query: "x", provider: "does-not-exist" });
  expect(out.status).toBe("error");
  expectError(out.text, "invalid_input");
});

test("fetch_page renders through the pinned renderer", async () => {
  scenario = "fetch-jina";
  const out = await call("infobroker_fetch_page", {
    url: "https://example.com/doc",
    renderer: "jina",
    detect_date: false,
  });
  const body = expectOk(out.text);
  expect(providerOf(body)).toBe("jina");
  expect(JSON.stringify(body)).toContain("debate-club");
});

test("fetch_page refuses a private network target", async () => {
  scenario = "fetch-ssrf";
  expectedError = "network_target_refused";
  const out = await call("infobroker_fetch_page", { url: "http://127.0.0.1/", detect_date: false });
  expect(out.status).toBe("error");
  expectError(out.text, "network_target_refused");
});

test("get_citations returns BibTeX-bearing academic references", async () => {
  scenario = "citations";
  const out = await call("infobroker_get_citations", {
    query: "retrieval augmented generation",
    max_results: 5,
  });
  const body = expectOk(out.text);
  expect(providerOf(body)).toBe("academic");
  expect((body.results as unknown[]).length).toBeGreaterThan(0);
  const first = (body.results as Array<Record<string, unknown>>)[0];
  expect(typeof first.bibtex).toBe("string");
  expect(first.bibtex).toContain("@");
});

test("verify_claims conforms to the REQ-001 envelope", async () => {
  scenario = "verify";
  const out = await call("infobroker_verify_claims", {
    query: "Does retrieval augmented generation reduce hallucination?",
    providers: ["wikipedia"],
    max_iterations: 1,
    confidence_threshold: 0.8,
  });
  // REQ-001: every tool body carries status/provider/results. The corroboration
  // payload (findings, agreement_map) is preserved alongside them.
  const body = expectOk(out.text);
  expect(providerOf(body)).toBe("corroborate");
  expect(Array.isArray(body.results)).toBe(true);
  expect(Array.isArray(body.findings)).toBe(true);
  expect(body.agreement_map).toBeTruthy();
});

test("inspect_providers list and spec report operational state", async () => {
  scenario = "inspect-list";
  const list = expectOk((await call("infobroker_inspect_providers", { action: "list" })).text);
  expect((list.results as unknown[]).length).toBeGreaterThan(0);
  scenario = "inspect-spec";
  const spec = expectOk((await call("infobroker_inspect_providers", { action: "spec" })).text);
  expect(JSON.stringify(spec)).toContain("tool_count");
});

test("manage_kb ingests, searches, and reports stats", async () => {
  scenario = "kb-ingest";
  const ingest = expectOk(
    (
      await call("infobroker_manage_kb", {
        action: "ingest",
        title: "debate-club arena note",
        text: "The debate club arena stores a deterministic note about retrieval augmented generation.",
        source_type: "report",
      })
    ).text
  );
  expect(Number((ingest.meta as Record<string, unknown>).chunks_ingested)).toBeGreaterThan(0);

  scenario = "kb-search";
  const search = expectOk(
    (
      await call("infobroker_manage_kb", {
        action: "search",
        query: "deterministic arena note",
        collection: "reports",
      })
    ).text
  );
  expect((search.results as unknown[]).length).toBeGreaterThan(0);

  scenario = "kb-stats";
  const stats = expectOk((await call("infobroker_manage_kb", { action: "stats" })).text);
  const statsBody = (stats.results as Array<Record<string, unknown>>)[0];
  expect(Number(statsBody.chunk_count)).toBeGreaterThan(0);
});

test("reload_config applies a patch without erroring", async () => {
  scenario = "reload";
  const out = await call("infobroker_reload_config", { patch: { output: { verbose: true } } });
  const body = expectOk(out.text);
  const first = (body.results as Array<Record<string, unknown>>)[0];
  expect(Number(first.provider_count)).toBeGreaterThan(0);
});

test("no fixture-host request went unmatched during the run", () => {
  expect(server.unmatched()).toEqual([]);
});
