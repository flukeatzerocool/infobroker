// @implements REQ-060 REQ-060d REQ-060f REQ-060g REQ-060h REQ-060i REQ-084
// Debate-club Arena: tool-level action evidence (R6 F-R6-A-5/A-6). Drives the
// real server over stdio for the handler-only branches: the delete filter
// requirement, the get/no-document error, the locked-store error with encryption
// reachability, and verify_report's document-basis absent-source state.

import { afterAll, beforeAll, expect, test } from "vitest";
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

// @implements REQ-060d filter-required
test("delete requires at least one filter", async () => {
  const refused = expectError(await call({ action: "delete" }), "invalid_input");
  expect((refused.error as Record<string, unknown>).message).toMatch(/at least one of collection or source_url/i);
  expect((refused.error as Record<string, unknown>).remediation).toBeTruthy();

  // A filter that matches nothing is a valid call, not an error.
  const empty = expectOk(await call({ action: "delete", collection: "arena-no-such-collection" }));
  expect((empty.meta as Record<string, unknown>).chunks_removed).toBe(0);
});

// @implements REQ-060f no-document
test("get returns an error for a source URL with no stored document", async () => {
  const body = expectError(
    await call({ action: "get", source_url: "report://absent-document" }),
    "internal_error"
  );
  const error = body.error as Record<string, unknown>;
  expect(error.message).toContain("report://absent-document");
  expect(error.remediation).toMatch(/list/i);
  expect(body.results).toBeUndefined();
});

// @implements REQ-060i absent-source
test("verify_report reports a document-basis source absent from the cache as unverifiable", async () => {
  const sourceUrl = "https://example.com/arena-evidence-source";
  const reportId = "report://arena-evidence-report";

  expectOk(
    await call({
      action: "ingest",
      title: "Arena evidence source",
      text: "The archived inspection found the retaining wall sound after the 2026 review.",
      source_url: sourceUrl,
      collection: "arena-evidence",
      source_type: "fetch_page",
    })
  );

  expectOk(
    await call({
      action: "ingest",
      title: "Arena evidence report",
      text: "The retaining wall remains sound according to the archived inspection.",
      source_url: reportId,
      collection: "arena-evidence",
      source_type: "report",
      receipt: {
        claims: [
          {
            claim: "the retaining wall remains sound",
            sources: [{ url: sourceUrl, retrieved_at: "2026-10-02T09:00:00.000Z" }],
          },
        ],
      },
    })
  );

  // Removing the cached source leaves the receipt's document-basis hash with
  // nothing to rehash: that is unverifiable, never drift.
  const removed = expectOk(await call({ action: "delete", source_url: sourceUrl }));
  expect((removed.meta as Record<string, unknown>).chunks_removed).toBeGreaterThan(0);

  const verified = expectOk(await call({ action: "verify_report", source_url: reportId }));
  const result = results(verified)[0]!;
  expect(result.report).toBe("verified");
  expect(result.state).toBe("unverifiable");
  const sources = result.sources as Record<string, unknown>;
  expect(sources.unverifiable).toBe(1);
  expect(sources.drift).toBe(0);
  expect((sources.details as Array<Record<string, unknown>>)[0]).toMatchObject({
    url: sourceUrl,
    state: "unverifiable",
    hash_basis: "document",
  });
});

// @implements REQ-060h locked-store
// @implements REQ-060g locked-reachability
test("a locked store returns the REQ-002 error while encryption stays reachable", async () => {
  const locked = await startServer({
    configLayer: (tmpDir) => ({
      kb: {
        storage_path: join(tmpDir, "kb"),
        keys_path: join(tmpDir, "keys"),
        reports_path: join(tmpDir, "reports"),
        auto_index: false,
        encryption: { enabled: true, key_file: join(tmpDir, "keys", "missing.key") },
      },
    }),
  });
  try {
    await new Promise((r) => setTimeout(r, 500));

    for (const action of ["claims", "list"] as const) {
      const body = expectError(
        (await locked.call("infobroker_manage_kb", { action })).text,
        "config_error"
      );
      const error = body.error as Record<string, unknown>;
      expect(error.remediation).toMatch(/key/i);
      expect(body.results).toBeUndefined();
    }

    // REQ-060g: the recovery surface stays reachable under the lock.
    expectOk((await locked.call("infobroker_manage_kb", { action: "encryption", operation: "status" })).text);
  } finally {
    locked.stop();
  }
});
