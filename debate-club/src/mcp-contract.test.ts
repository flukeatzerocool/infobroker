// @implements REQ-001 REQ-002 REQ-003 REQ-004 REQ-013 REQ-020 REQ-020a REQ-127 REQ-021 REQ-021a REQ-021h REQ-021i REQ-024 REQ-024a REQ-024b REQ-024c REQ-026g REQ-026h REQ-027 REQ-060 REQ-081 REQ-089
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
  // REQ-020: the Wikipedia provider's real snippet survives normalization.
  expect(String((body.results as Array<Record<string, unknown>>)[0].snippet)).not.toBe("");
});

test("search_web analyze attaches in-process analysis (REQ-127)", async () => {
  scenario = "search-analyze";
  const out = await call("infobroker_search_web", {
    query: "retrieval augmented generation",
    provider: "wikipedia",
    max_results: 3,
    analyze: true,
  });
  const body = expectOk(out.text);
  const analysis = (body.meta as Record<string, unknown>).analysis as Record<string, unknown>;
  expect(analysis).toBeTruthy();
  expect(Array.isArray(analysis.topics)).toBe(true);
  expect(Array.isArray(analysis.entities)).toBe(true);
  expect(Array.isArray(analysis.clusters)).toBe(true);
  expect(analysis.timeline).toBeTruthy();
  expectSearchResultShape(body.results as Array<Record<string, unknown>>);
});

test("search_web coerces a JSON-encoded array string into a batch", async () => {
  scenario = "search-stringified-batch";
  const out = await call("infobroker_search_web", {
    query: '["retrieval augmented generation", "information retrieval"]',
    provider: "wikipedia",
    max_results: 3,
  });
  const body = expectOk(out.text);
  const perQuery = (body.meta as Record<string, unknown>).per_query as unknown[];
  expect(Array.isArray(perQuery)).toBe(true);
  expect(perQuery.length).toBe(2);
  expect((body.results as unknown[]).length).toBeGreaterThan(0);
});

test("search_web rejects an unknown provider with invalid_input", async () => {
  scenario = "search-bad-provider";
  expectedError = "invalid_input";
  const out = await call("infobroker_search_web", { query: "x", provider: "does-not-exist" });
  expect(out.status).toBe("error");
  expectError(out.text, "invalid_input");
});

// REQ-020a: the response reports the selected task type, an automatic
// classifier hit and a caller override are both observable, and the override
// serves from the named chain rather than the automatically classified one.
test("search_web reports the selected task type and honors the override", async () => {
  const academicChain = [
    "semantic_scholar",
    "arxiv",
    "openalex",
    "europe_pmc",
    "crossref",
  ];

  // Auto: the whole-word "wikipedia" signal selects the encyclopedia chain.
  scenario = "search-task-type-auto";
  const auto = await call("infobroker_search_web", {
    query: "retrieval augmented generation wikipedia",
    max_results: 2,
  });
  const autoBody = expectOk(auto.text);
  expect((autoBody.meta as Record<string, unknown>).task_type).toBe("encyclopedia");
  expect(providerOf(autoBody)).toBe("wikipedia");

  // Override: the same query is served from the academic chain without
  // reclassifying, and meta reports the forced type.
  scenario = "search-task-type-override";
  const forced = await call("infobroker_search_web", {
    query: "retrieval augmented generation wikipedia",
    task_type: "academic",
    max_results: 2,
  });
  const forcedBody = expectOk(forced.text);
  expect((forcedBody.meta as Record<string, unknown>).task_type).toBe("academic");
  expect(academicChain).toContain(providerOf(forcedBody));

  // Automatic scholarly routing: a bare DOI classifies academic with no
  // provider hint. This is the classifier regression guard.
  scenario = "search-task-type-doi";
  const doi = await call("infobroker_search_web", {
    query: "10.1038/nature12373",
    max_results: 2,
  });
  const doiBody = expectOk(doi.text);
  expect((doiBody.meta as Record<string, unknown>).task_type).toBe("academic");
  expect(academicChain).toContain(providerOf(doiBody));
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

test("fetch_page converts native HTML to text", async () => {
  scenario = "fetch-native-html";
  const out = await call("infobroker_fetch_page", {
    url: "https://example.com/html",
    renderer: "native_fetch",
    detect_date: false,
  });
  const body = expectOk(out.text);
  const snippet = String((body.results as Array<Record<string, unknown>>)[0].snippet);
  expect(providerOf(body)).toBe("native_fetch");
  expect(snippet).toContain("Fixture Article");
  expect(snippet).not.toContain("<script");
  expect(snippet).not.toContain("<style");
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
  // REQ-027a: the response reports per-provider status and dedupes by DOI.
  const meta = body.meta as Record<string, unknown>;
  const providers = meta.providers as Array<Record<string, unknown>>;
  expect(Array.isArray(providers)).toBe(true);
  expect(providers.some((p) => p.slug === "openalex" && p.status === "ok")).toBe(true);
  expect(providers.some((p) => p.slug === "crossref" && p.status === "ok")).toBe(true);
  expect(Number(meta.deduped)).toBeGreaterThanOrEqual(1);
  expect((body.results as Array<Record<string, unknown>>).some((r) => typeof r.doi === "string")).toBe(true);
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
  // REQ-026: findings are seeded from the caller claim, not page titles.
  const findings = body.findings as Array<Record<string, unknown>>;
  expect(findings.length).toBe(1);
  expect(findings[0].claim).toBe("Does retrieval augmented generation reduce hallucination");
  expect((findings[0].sources as unknown[]).length).toBeGreaterThan(0);
});

test("verify_claims batch returns one finding per claim in order (REQ-026g)", async () => {
  scenario = "verify-batch";
  const claims = [
    "retrieval augmented generation reduces hallucination",
    "information retrieval finds relevant resources",
  ];
  const out = await call("infobroker_verify_claims", {
    claims,
    providers: ["wikipedia"],
    max_iterations: 1,
    confidence_threshold: 0.8,
  });
  const body = expectOk(out.text);
  const batchFindings = body.findings as Array<Record<string, unknown>>;
  expect(body.batch).toBe(true);
  expect(batchFindings.length).toBe(2);
  expect(batchFindings.map((f) => f.claim)).toEqual(claims);
  expect(batchFindings.map((f) => f.claim_index)).toEqual([0, 1]);
  // REQ-026h: each attributed source carries a span that indexes its snippet.
  const firstSource = (batchFindings[0]!.sources as Array<Record<string, unknown>>)[0];
  const span = firstSource?.span as Record<string, unknown> | undefined;
  expect(typeof firstSource?.modality).toBe("string");
  expect(typeof span?.start).toBe("number");
  expect(typeof span?.end).toBe("number");
  expect(String(firstSource?.snippet).slice(Number(span?.start), Number(span?.end))).toBe(span?.text);
});

test("verify_claims rejects a batch above the configured cap (REQ-026g)", async () => {
  scenario = "verify-batch-cap";
  expectedError = "invalid_input";
  const out = await call("infobroker_verify_claims", {
    claims: Array.from({ length: 11 }, (_, i) => `claim number ${i}`),
    providers: ["wikipedia"],
    max_iterations: 1,
  });
  const body = expectError(out.text, "invalid_input");
  expect(String((body.error as Record<string, unknown>).remediation)).toContain("claims");
});

test("verify_claims rejects supplying both query and claims (REQ-026g)", async () => {
  scenario = "verify-both-inputs";
  expectedError = "invalid_input";
  const out = await call("infobroker_verify_claims", {
    query: "one claim",
    claims: ["another claim"],
    providers: ["wikipedia"],
  });
  expectError(out.text, "invalid_input");
});

test("inspect_providers list and spec report operational state", async () => {
  scenario = "inspect-list";
  const list = expectOk((await call("infobroker_inspect_providers", { action: "list" })).text);
  const listRows = list.results as Array<Record<string, unknown>>;
  expect(listRows.length).toBeGreaterThan(0);
  // REQ-024a: the inline renderer fallback is reported and marked.
  const inline = listRows.find((r) => r.slug === "native_fetch");
  expect(inline?.inline_fallback).toBe(true);
  scenario = "inspect-spec";
  const spec = expectOk((await call("infobroker_inspect_providers", { action: "spec" })).text);
  expect(JSON.stringify(spec)).toContain("tool_count");
  // REQ-024c: counts reconcile and exclude the inline fallback.
  const specRow = (spec.results as Array<Record<string, unknown>>)[0];
  const providerCount = Number(specRow.provider_count);
  const enabledCount = Number(specRow.enabled_provider_count);
  const activeCount = Number(specRow.active_provider_count);
  expect(providerCount).toBeGreaterThan(0);
  expect(enabledCount).toBeLessThanOrEqual(providerCount);
  expect(activeCount).toBeLessThanOrEqual(enabledCount);
  expect(listRows.filter((r) => r.slug !== "native_fetch").length).toBe(providerCount);
  // REQ-081: the token-footprint record is present, numeric, and derived.
  const footprint = specRow.token_footprint as Record<string, unknown>;
  expect(typeof footprint.tool_schema_bytes).toBe("number");
  expect(Number(footprint.tool_schema_bytes)).toBeGreaterThan(0);
  expect(typeof footprint.median_response_bytes).toBe("number");
  expect(Number(footprint.median_response_bytes)).toBeGreaterThanOrEqual(0);
});

test("inspect_providers health runs a live probe against the pinned provider", async () => {
  scenario = "inspect-health";
  const health = expectOk(
    (await call("infobroker_inspect_providers", { action: "health", provider: "wikipedia" })).text
  );
  const row = (health.results as Array<Record<string, unknown>>)[0];
  // REQ-024b: a live probe returns a status and a latency measurement.
  expect(["active", "degraded", "inactive"]).toContain(row.status);
  expect(typeof row.avg_latency_ms).toBe("number");
  expect(row.slug).toBe("wikipedia");
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

test("manage_kb stores report manifest metadata and verifies it offline", async () => {
  scenario = "kb-manifest";
  const ingest = expectOk(
    (
      await call("infobroker_manage_kb", {
        action: "ingest",
        title: "Arena manifest report",
        text: "The arena manifest records a report revision for offline verification.",
        source_type: "report",
        save_to: "kb",
        receipt: {
          claims: [
            {
              claim: "the arena records a report revision",
              grade: "A",
              verdict: "True",
              confidence: "High",
              likelihood: "likely",
              sources: [{ url: "https://example.com/arena-source", snippet: "arena source excerpt" }],
            },
          ],
          report: {
            shape: "Fact-Check",
            audience: "analyst",
            methodology: "one deterministic fixture",
            assumptions: ["the fixture is stable"],
            alternatives: ["recheck against a live source"],
            gaps: ["no live source in the arena"],
            supersedes: "report://arena-manifest-v1",
            revision: 2,
          },
        },
      })
    ).text
  );
  const receiptMeta = (ingest.meta as Record<string, unknown>).receipt as Record<string, unknown>;
  expect(receiptMeta).toBeDefined();
  const reportId = String(receiptMeta.report_id);

  const verify = expectOk(
    (await call("infobroker_manage_kb", { action: "verify_report", source_url: reportId })).text
  );
  const row = (verify.results as Array<Record<string, unknown>>)[0]!;
  expect(row.digest_match).toBe(true);
  expect((row.report_meta as Record<string, unknown>).shape).toBe("Fact-Check");
  expect(row.revision).toBe(2);
  expect(row.supersedes).toBe("report://arena-manifest-v1");
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

test("search_web resolves a measurable attribute from the Wikipedia infobox (REQ-021i)", async () => {
  scenario = "structured-fact-infobox";
  const out = await call("infobroker_search_web", {
    query: "Survivor Series 1997 attendance",
    max_results: 3,
  });
  const body = expectOk(out.text);
  const meta = body.meta as Record<string, unknown>;
  expect(meta.task_type).toBe("structured_fact");
  expect(meta.fact_status).toBe("resolved");
  const facts = body.facts as Array<Record<string, unknown>>;
  expect(Array.isArray(facts)).toBe(true);
  expect(facts[0]).toMatchObject({
    kind: "attendance",
    value: 20593,
    display: "20,593",
    source: "wikipedia",
  });
  // The fact is placed before the prose results.
  const first = (body.results as Array<Record<string, unknown>>)[0];
  expect(first.source_type).toBe("structured_fact");
});

test("fetch_page falls back to Crossref metadata for a paywalled DOI (REQ-021h)", async () => {
  scenario = "fetch-doi-metadata";
  const out = await call("infobroker_fetch_page", {
    url: "https://doi.org/10.1162/dram_c_00764",
    detect_date: false,
  });
  const body = expectOk(out.text);
  const meta = body.meta as Record<string, unknown>;
  expect(meta.fallback_used).toBe(true);
  expect(meta.fallback_kind).toBe("metadata");
  expect(body.extraction_mode).toBe("metadata");
  const first = (body.results as Array<Record<string, unknown>>)[0];
  expect(first.doi).toBe("10.1162/dram_c_00764");
  expect(String(first.title)).toContain("Working Loose");
});

test("fetch_page falls back to an Internet Archive snapshot (REQ-021h)", async () => {
  scenario = "fetch-wayback";
  const out = await call("infobroker_fetch_page", {
    url: "https://example.com/paywalled",
    renderer: "jina",
    detect_date: false,
  });
  const body = expectOk(out.text);
  const meta = body.meta as Record<string, unknown>;
  expect(meta.fallback_used, out.text).toBe(true);
  expect(meta.fallback_kind).toBe("wayback");
  expect(providerOf(body)).toBe("internet_archive");
  expect(out.text).toContain("archived copy of the paywalled article");
});

test("fetch_page reports a paywall as access_blocked (REQ-021h)", async () => {
  scenario = "fetch-access-blocked";
  expectedError = "access_blocked";
  const out = await call("infobroker_fetch_page", {
    url: "https://example.com/blocked",
    renderer: "jina",
    detect_date: false,
  });
  expect(out.text).toContain("[ERROR]");
  const body = expectError(out.text, "access_blocked");
  const details = (body.error as Record<string, unknown>).details as Record<string, unknown>;
  expect(details.cause).toBe("paywall");
});

test("fetch_page reports a transport failure as network_error (REQ-021h)", async () => {
  scenario = "fetch-network-error";
  expectedError = "network_error";
  const out = await call("infobroker_fetch_page", {
    url: "https://example.com/network",
    renderer: "jina",
    detect_date: false,
  });
  expect(out.text).toContain("[ERROR]");
  const body = expectError(out.text, "network_error");
  expect(String((body.error as Record<string, unknown>).remediation)).toMatch(/connectivity/i);
});

test("fetch_page sends a non-http URL to the read tool (REQ-021h)", async () => {
  scenario = "fetch-file-protocol";
  expectedError = "invalid_input";
  const out = await call("infobroker_fetch_page", { url: "file:///tmp/notes.md" });
  const body = expectError(out.text, "invalid_input");
  expect(String((body.error as Record<string, unknown>).remediation)).toMatch(/read tool/);
});