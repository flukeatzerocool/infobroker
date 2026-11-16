#!/usr/bin/env node
// evaluate-research.test.mjs — Deterministic tests for the research-scenario
// evaluator's token/section scope. Each case writes a synthetic opencode JSON
// event stream and a scenario file into a temp dir, runs the evaluator as a
// child process, and parses its one-line JSON result. No network: every
// fixture sets citation_sample to 0.
//
// Run: node --test scripts/test-research/evaluate-research.test.mjs
// (wired into `npm run check-skill-harness`, part of `npm run check`).
//
// Role: test. Exit 0 when the plan holds; non-zero (via node:test) otherwise.

import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { sampleCitations } from "../lib/citations.mjs";

const EVALUATOR = join(dirname(fileURLToPath(import.meta.url)), "evaluate-research.mjs");
const roots = [];

function runCase({ scenario, events }) {
  const dir = mkdtempSync(join(tmpdir(), "eval-research-"));
  roots.push(dir);
  const scenarioPath = join(dir, "scenario.json");
  const transcriptPath = join(dir, "transcript.ndjson");
  const outDir = join(dir, "out");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(scenarioPath, JSON.stringify({ citation_sample: 0, ...scenario }));
  writeFileSync(transcriptPath, events.map((e) => JSON.stringify(e)).join("\n") + "\n");
  const res = spawnSync(process.execPath, [EVALUATOR, scenarioPath, transcriptPath, outDir], {
    encoding: "utf8",
  });
  assert.equal(res.status, 0, `evaluator exited ${res.status}: ${res.stderr}`);
  return JSON.parse(res.stdout.trim());
}

function assistant(text, messageID) {
  return { type: "text", part: { type: "text", role: "assistant", messageID, text } };
}

function user(text, messageID) {
  return { type: "text", part: { type: "text", role: "user", messageID, text } };
}

after(() => {
  for (const dir of roots) rmSync(dir, { recursive: true, force: true });
});

const PHASE = "research-analysis complete.";
const CLOSE = "analysis-loop complete.";

test("session scope: a phase token in an intermediate block satisfies the gate", () => {
  const result = runCase({
    scenario: { id: "T1", label: "t1", shape: "gated-analysis", mode: "positive", token_scope: "session", tokens: [PHASE, CLOSE], sections: ["Uncertainty Register"], tool_audit: { uses_infobroker: false } },
    events: [
      assistant(PHASE, "m1"),
      { type: "tool_use", tool: "infobroker_infobroker_search_web" },
      assistant(`${CLOSE}\n\n## Uncertainty Register\n\nnone.`, "m2"),
    ],
  });
  assert.equal(result.status, "pass", JSON.stringify(result));
  assert.equal(result.token_scope, "session");
});

test("final scope: the same stream fails on the intermediate phase token", () => {
  const result = runCase({
    scenario: { id: "T2", label: "t2", shape: "gated-analysis", mode: "positive", token_scope: "final", tokens: [PHASE, CLOSE], sections: ["Uncertainty Register"], tool_audit: { uses_infobroker: false } },
    events: [
      assistant(PHASE, "m1"),
      assistant(`${CLOSE}\n\n## Uncertainty Register\n\nnone.`, "m2"),
    ],
  });
  assert.equal(result.status, "fail");
  assert.deepEqual(result.missing, [PHASE]);
  assert.equal(result.token_scope, "final");
});

test("user-role text never satisfies a token, under either scope", () => {
  for (const scope of ["session", "final"]) {
    const result = runCase({
      scenario: { id: `T3-${scope}`, label: "t3", shape: "gated-analysis", mode: "positive", token_scope: scope, tokens: [CLOSE], sections: [], tool_audit: { uses_infobroker: false } },
      events: [
        user(`${CLOSE} — please use this wording`, "u1"),
        assistant("A report with no completion token.", "m1"),
      ],
    });
    assert.equal(result.status, "fail", `${scope}: ${JSON.stringify(result)}`);
    assert.deepEqual(result.missing, [CLOSE], scope);
  }
});

test("section needles are OR-sets of accepted synonyms", () => {
  const result = runCase({
    scenario: { id: "T4", label: "t4", shape: "gated-analysis", mode: "negative", tokens: [], sections: ["zero usable|no usable|nonexistent"], tool_audit: { uses_infobroker: false } },
    events: [assistant("The service is nonexistent; no provider could confirm it.", "m1")],
  });
  assert.equal(result.status, "pass", JSON.stringify(result));
  assert.deepEqual(result.missingSections, []);
});

// --- citation sampler ---

function stubFetch(statuses, { delayMs = 10 } = {}) {
  const state = { inFlight: 0, maxInFlight: 0, calls: [] };
  state.impl = async (url) => {
    state.calls.push(url);
    state.inFlight += 1;
    state.maxInFlight = Math.max(state.maxInFlight, state.inFlight);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    state.inFlight -= 1;
    return { status: statuses[url] ?? 200 };
  };
  return state;
}

test("sampleCitations preserves input order under concurrency", async () => {
  const urls = ["a", "b", "c", "d", "e", "f"];
  const stub = stubFetch(Object.fromEntries(urls.map((u) => [u, 200])));
  const results = await sampleCitations(urls, { fetchImpl: stub.impl, limit: 4 });
  assert.deepEqual(results.map((r) => r.url), urls);
  assert.ok(results.every((r) => r.status === "reachable"));
});

test("sampleCitations never exceeds the concurrency cap", async () => {
  const urls = Array.from({ length: 10 }, (_, i) => `u${i}`);
  const stub = stubFetch({}, { delayMs: 5 });
  await sampleCitations(urls, { fetchImpl: stub.impl, limit: 3 });
  assert.equal(stub.maxInFlight, 3, `peak ${stub.maxInFlight}`);
  assert.equal(stub.calls.length, 10);
});

test("sampleCitations classifies HTTP outcomes", async () => {
  const urls = ["ok", "blocked", "invalid", "boom"];
  const stub = stubFetch({ ok: 200, blocked: 403, invalid: 404, boom: 500 });
  const results = await sampleCitations(urls, { fetchImpl: stub.impl });
  assert.deepEqual(results.map((r) => r.status), ["reachable", "blocked", "invalid", "status-500"]);
});

test("sampleCitations honours count and reports aborts as errors", async () => {
  const stub = { impl: async (url, { signal }) => {
    if (url === "slow") throw Object.assign(new Error("aborted"), { name: "AbortError" });
    assert.ok(signal, "signal passed");
    return { status: 200 };
  } };
  const results = await sampleCitations(["slow", "fast", "ignored"], { fetchImpl: stub.impl, count: 2 });
  assert.deepEqual(results.map((r) => r.status), ["error", "reachable"]);
});

test("sampleCitations requires an injectable fetch", async () => {
  await assert.rejects(() => sampleCitations(["a"], {}), /requires fetchImpl/);
  assert.deepEqual(await sampleCitations([], { fetchImpl: async () => ({ status: 200 }) }), []);
});
