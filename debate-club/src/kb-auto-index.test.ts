// @implements REQ-064
// Debate-club Arena: the three REQ-064 auto-index hook sites (R6 F-R6-B-1).
// Drives the real server over stdio with auto-indexing enabled: search_web,
// fetch_page, and verify_claims must each store their content after the tool
// response returns, without failing the originating call.
import { afterAll, beforeAll, expect, test } from "vitest";
import { join } from "node:path";

import { startServer, type DebateServer } from "./client.js";
import { expectOk } from "./contracts.js";

let server: DebateServer;

beforeAll(async () => {
  server = await startServer({
    configLayer: (tmpDir) => ({
      // The fetch_page hook is gated on the global policy disposition; pin it
      // so an ambient user layer cannot suppress the branch under test.
      content_policy: { mode: "off" },
      kb: {
        storage_path: join(tmpDir, "kb"),
        keys_path: join(tmpDir, "keys"),
        reports_path: join(tmpDir, "reports"),
        auto_index: true,
        maintenance_interval_minutes: 0,
      },
    }),
  });
  // The KB initializes after the MCP handshake; give it a beat.
  await new Promise((resolve) => setTimeout(resolve, 500));
});

afterAll(() => server.stop());

async function call(name: string, args: Record<string, unknown>): Promise<string> {
  return (await server.call(name, args)).text;
}

/** Poll `manage_kb get` until the deferred auto-index has stored the URL. */
async function waitForStored(url: string): Promise<Record<string, unknown>> {
  for (let attempt = 0; attempt < 60; attempt++) {
    const text = await call("infobroker_manage_kb", { action: "get", source_url: url });
    if (text.startsWith("[OK] ")) {
      return expectOk(text);
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`auto-index did not store ${url} within 3s`);
}

test("search_web indexes its returned results after the response", async () => {
  const out = await call("infobroker_search_web", {
    query: "retrieval augmented generation",
    provider: "wikipedia",
    max_results: 2,
    deep: false,
  });
  const body = expectOk(out);
  const first = (body.results as Array<Record<string, unknown>>)[0];
  const url = String(first.url);
  expect(url).toMatch(/^https?:\/\//);

  const stored = await waitForStored(url);
  const document = (stored.results as Array<Record<string, unknown>>)[0];
  expect(document.source_url).toBe(url);
  expect(String(document.text).length).toBeGreaterThan(0);
});

test("fetch_page indexes the rendered page after the response", async () => {
  const url = "https://example.com/doc";
  const out = await call("infobroker_fetch_page", { url, renderer: "jina", detect_date: false });
  expectOk(out);

  const stored = await waitForStored(url);
  const document = (stored.results as Array<Record<string, unknown>>)[0];
  expect(document.source_url).toBe(url);
  expect(document.source_type).toBe("fetch_page");
  expect(String(document.text).length).toBeGreaterThan(0);
});

test("verify_claims indexes its sourced findings after the response", async () => {
  const out = await call("infobroker_verify_claims", {
    query: "Does retrieval augmented generation reduce hallucination?",
    providers: ["wikipedia"],
    max_iterations: 1,
    confidence_threshold: 0.8,
  });
  const body = expectOk(out);
  const findings = body.findings as Array<Record<string, unknown>>;
  const url = findings
    .flatMap((finding) => (finding.sources as Array<Record<string, unknown>> | undefined) ?? [])
    .map((source) => source.url)
    .find((candidate): candidate is string => typeof candidate === "string" && candidate.length > 0);
  expect(url).toBeTruthy();

  const stored = await waitForStored(url!);
  const document = (stored.results as Array<Record<string, unknown>>)[0];
  expect(document.source_url).toBe(url);
  expect(document.source_type).toBe("corroborate");
});
