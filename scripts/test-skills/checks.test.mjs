// checks.test.mjs — Deterministic unit tests for the pure skill-check evaluator.
// Run via `npm run check-skill-harness` (node --test).

import test from "node:test";
import assert from "node:assert/strict";
import { evaluateChecks } from "./checks.mjs";

test("passes when required facts are present", () => {
  const manifest = { checks: { required_facts: ["alpha", "beta"] } };
  const result = evaluateChecks(manifest, "alpha and beta");
  assert.equal(result.passed, true);
  assert.deepEqual(result.failed, []);
});

test("fails a missing required fact", () => {
  const manifest = { checks: { required_facts: ["alpha", "gamma"] } };
  const result = evaluateChecks(manifest, "alpha and beta");
  assert.equal(result.passed, false);
  assert.match(result.failed.join("\n"), /required_facts: gamma/);
});

test("fails when a preserved item is missing", () => {
  const manifest = { checks: { must_be_preserved: ["HTTP 202", "behaviour"] } };
  const result = evaluateChecks(manifest, "HTTP 202", { before: "HTTP 202 behaviour", after: "HTTP 202 behavior" });
  assert.equal(result.passed, false);
  assert.match(result.failed.join("\n"), /must_be_preserved: behaviour/);
});

test("fails when require_file_change has no workdir evidence", () => {
  const manifest = { checks: { require_file_change: true } };
  const result = evaluateChecks(manifest, "done");
  assert.equal(result.passed, false);
  assert.match(result.failed.join("\n"), /workdir input missing/);
});

test("passes when the file changed", () => {
  const manifest = { checks: { require_file_change: true } };
  const result = evaluateChecks(manifest, "done", { before: "old", after: "new" });
  assert.equal(result.passed, true);
  assert.equal(result.file_changed, true);
});

test("advisory failures are reported but do not fail the run", () => {
  const manifest = {
    checks: {
      required_facts: ["alpha"],
      required_any: ["never"],
      advisory: { required_any: "research harness is unreliable here" },
    },
  };
  const result = evaluateChecks(manifest, "alpha");
  assert.equal(result.passed, true);
  assert.deepEqual(result.failed, []);
  assert.match(result.advisory_failed.join("\n"), /required_any: none of: never/);
});
