// @implements REQ-060 REQ-060a REQ-060b REQ-060e REQ-060f REQ-060g
// Debate-club Arena: manage_kb action-contract remediation (R6 F-R6-A-1..3).
// Drives the real server over stdio: ingest identity, the advertised
// max_results cap, the unconfigured/unopenable-KB errors, and the receipt and
// input refusals that previously existed only as handler branches.

import { afterAll, beforeAll, expect, test } from "vitest";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { startServer, type DebateServer } from "./client.js";
import { expectError, expectOk } from "./contracts.js";

let server: DebateServer;

beforeAll(async () => {
  server = await startServer();
  // The KB initializes after the MCP handshake; give it a beat.
  await new Promise((r) => setTimeout(r, 500));
});

afterAll(() => server.stop());

async function call(args: Record<string, unknown>): Promise<string> {
  return (await server.call("infobroker_manage_kb", args)).text;
}

function results(body: Record<string, unknown>): Array<Record<string, unknown>> {
  return body.results as Array<Record<string, unknown>>;
}

// @implements REQ-060b text-identity
test("ingest keeps a caller-supplied source_url for text-only content", async () => {
  const source = "https://example.com/arena-contract-note";
  const ingested = expectOk(
    await call({
      action: "ingest",
      title: "arena contract note",
      text: "Arena contract note about preserving the caller source identity.",
      source_url: source,
      collection: "arena-contract",
      source_type: "explicit",
    })
  );
  expect(results(ingested)[0].url).toBe(source);
  const chunks = Number((ingested.meta as Record<string, unknown>).chunks_ingested);
  expect(chunks).toBeGreaterThan(0);

  const fetched = expectOk(await call({ action: "get", source_url: source }));
  expect(String(results(fetched)[0].text)).toContain("preserving the caller source identity");

  const listed = expectOk(await call({ action: "list", collection: "arena-contract" }));
  const entries = results(listed);
  expect(entries).toHaveLength(1);
  expect(entries[0].source_url).toBe(source);
  expect(entries[0].chunk_count).toBe(chunks);
});

// @implements REQ-060b text-identity
test("ingest without a source identity stores one stable text identity", async () => {
  const ingested = expectOk(
    await call({
      action: "ingest",
      title: "Arena anonymous note",
      text: "Arena anonymous note content without a caller-supplied identity.",
      collection: "arena-anon",
      source_type: "explicit",
    })
  );
  expect(results(ingested)[0].url).toBe("text://arena-anonymous-note");
  const chunks = Number((ingested.meta as Record<string, unknown>).chunks_ingested);

  const listed = expectOk(await call({ action: "list", collection: "arena-anon" }));
  const entries = results(listed);
  expect(entries).toHaveLength(1);
  expect(entries[0].source_url).toBe("text://arena-anonymous-note");
  expect(entries[0].chunk_count).toBe(chunks);
});

// @implements REQ-060b report-identity
test("a report keeps its supplied identity and its receipt verifies under it", async () => {
  const source = "https://example.com/arena-report";
  const ingested = expectOk(
    await call({
      action: "ingest",
      title: "Arena report",
      text: "Arena report body with a deterministic claim for offline verification.",
      source_url: source,
      source_type: "report",
      collection: "arena-report",
      receipt: { claims: [{ claim: "The arena report body is deterministic." }] },
    })
  );
  expect((ingested.meta as Record<string, unknown>).report_id).toBe(source);

  const verified = expectOk(await call({ action: "verify_report", source_url: source }));
  expect(results(verified)[0].report_id).toBe(source);
  expect(results(verified)[0].state).toBe("verified");
});

// @implements REQ-060a max-results-default
test("search honors the advertised default and maximum result counts", async () => {
  for (let i = 0; i < 12; i++) {
    expectOk(
      await call({
        action: "ingest",
        title: `arena cap document ${i}`,
        text: `capmarker document number ${i} about arena result capacity.`,
        collection: "arena-cap",
        source_type: "explicit",
        source_url: `https://example.com/arena-cap-${i}`,
      })
    );
  }

  const capped = expectOk(
    await call({ action: "search", query: "capmarker", collection: "arena-cap", max_results: 3 })
  );
  expect(results(capped)).toHaveLength(3);

  const defaulted = expectOk(await call({ action: "search", query: "capmarker", collection: "arena-cap" }));
  expect(results(defaulted).length).toBeGreaterThan(0);
  expect(results(defaulted).length).toBeLessThanOrEqual(8);

  const maximum = expectOk(
    await call({ action: "search", query: "capmarker", collection: "arena-cap", max_results: 50 })
  );
  expect(results(maximum).length).toBe(12);
});

// @implements REQ-060 unconfigured
test("an unconfigured knowledge base returns the REQ-002 config error", async () => {
  const bare = await startServer({ configLayer: () => ({ kb: null }) });
  try {
    await new Promise((r) => setTimeout(r, 500));
    const response = (await bare.call("infobroker_manage_kb", { action: "search", query: "anything" })).text;
    const body = expectError(response, "config_error");
    expect((body.error as Record<string, unknown>).message).toMatch(/not configured/i);
    expect(body.results).toBeUndefined();
  } finally {
    bare.stop();
  }
});

// @implements REQ-060 unopenable-store
// @implements REQ-060g locked-reachability
test("an unopenable store returns the lock error while encryption stays reachable", async () => {
  const blocked = await startServer({
    configLayer: (tmpDir) => {
      const filePath = join(tmpDir, "not-a-directory");
      writeFileSync(filePath, "not a directory");
      return { kb: { storage_path: filePath } };
    },
  });
  try {
    await new Promise((r) => setTimeout(r, 500));
    const listed = (await blocked.call("infobroker_manage_kb", { action: "list" })).text;
    const body = expectError(listed, "config_error");
    expect((body.error as Record<string, unknown>).message).toMatch(/could not be opened/i);
    expect((body.error as Record<string, unknown>).remediation).toBeTruthy();

    const status = (await blocked.call("infobroker_manage_kb", { action: "encryption", operation: "status" })).text;
    expectOk(status);
  } finally {
    blocked.stop();
  }
});

// @implements REQ-060b receipt-refusal
test("a receipt outside a KB-backed report is refused without writing", async () => {
  const notReport = expectError(
    await call({
      action: "ingest",
      title: "arena refusal",
      text: "Refused receipt content.",
      collection: "arena-refusal",
      receipt: { claims: [{ claim: "Refused claim." }] },
    }),
    "invalid_input"
  );
  expect((notReport.error as Record<string, unknown>).message).toMatch(/only supported for source_type/i);

  const diskOnly = expectError(
    await call({
      action: "ingest",
      title: "arena refusal report",
      text: "Refused disk-only report.",
      source_type: "report",
      save_to: "disk",
      collection: "arena-refusal",
      receipt: { claims: [{ claim: "Refused report claim." }] },
    }),
    "receipt_requires_kb"
  );
  expect((diskOnly.error as Record<string, unknown>).remediation).toBeTruthy();

  expectError(await call({ action: "ingest", title: "arena empty ingest" }), "invalid_input");

  const listed = expectOk(await call({ action: "list", collection: "arena-refusal" }));
  expect(results(listed)).toHaveLength(0);
});
