// @implements REQ-109 REQ-060h
// Debate-club Arena: an unsourced batch finding reaches the claim ledger
// (R6 F-R6-F-1). `verify_claims` retains a claim no provider could corroborate
// in batch mode; the ledger must persist it as a claim record with no source
// edges, and the `claims` action must return it.
import { afterAll, beforeAll, expect, test } from "vitest";
import { join } from "node:path";

import { startServer, type DebateServer } from "./client.js";
import { expectOk } from "./contracts.js";

let server: DebateServer;

beforeAll(async () => {
  server = await startServer({
    configLayer: (tmpDir) => ({
      kb: {
        storage_path: join(tmpDir, "kb"),
        keys_path: join(tmpDir, "keys"),
        reports_path: join(tmpDir, "reports"),
        auto_index: false,
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

const CLAIM = "the harbourside crane was inspected in 2026";

test("an unsourced batch finding is persisted with no source edges", async () => {
  // DuckDuckGo is a builtin provider with no fixture host, so the replay answers
  // it with the synthetic 599 and every provider in the pool fails.
  const out = await call("infobroker_verify_claims", {
    claims: [CLAIM],
    providers: ["duckduckgo"],
    max_iterations: 1,
  });
  const body = expectOk(out);
  const findings = body.findings as Array<Record<string, unknown>>;
  const finding = findings.find((candidate) => candidate.claim === CLAIM);
  // Precondition: the batch finding must exist and be unsourced. If the pool
  // restriction leaves nothing to verify, this fails rather than passing vacuously.
  expect(finding, "verify_claims must retain the unsourced batch claim").toBeTruthy();
  expect(finding!.sources).toEqual([]);

  const ledger = expectOk(
    await call("infobroker_manage_kb", { action: "claims", query: "harbourside crane" })
  );
  const rows = ledger.results as Array<Record<string, unknown>>;
  const row = rows.find((candidate) => candidate.claim === CLAIM);
  expect(row, "the ledger must persist the unsourced finding").toBeTruthy();
  expect(row!.sources).toEqual([]);
});
