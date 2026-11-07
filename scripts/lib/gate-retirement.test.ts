// gate-retirement.test — unit tests for the advisory-gate policy and ledger.
// Role: test.
//
// The policy decides when a gate is a retirement candidate and the runner's
// exit contract depends on the ledger, so both are exercised here: clean
// streaks, failure resets, fail-closed ledger reads, and the advisory/gating/
// fatal classification.

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  CLEAN_RUNS,
  advisoryGates,
  classifyResults,
  decideRestore,
  decideRetirement,
  emptyLedger,
  readLedger,
  readTiming,
  retirementState,
  summarizeGateCost,
  writeLedger,
  type Ledger,
  type TimingRow,
} from "./gate-retirement.js";
import { timingPath } from "./gate-run-manifest.js";

const NOW = new Date("2026-11-07T12:00:00.000Z");
const roots: string[] = [];

function tempRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "infobroker-gate-retirement-"));
  roots.push(root);
  return root;
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function row(index: number, status: "pass" | "fail", gate = "typecheck"): TimingRow {
  const minute = String(index % 60).padStart(2, "0");
  return {
    at: `2026-11-07T10:${minute}:00.000Z`,
    mode: "fast",
    head: "abc123",
    gate,
    ms: 1000 + index,
    status,
  };
}

function rows(...statuses: Array<"pass" | "fail">): TimingRow[] {
  return statuses.map((status, index) => row(index, status));
}

describe("summarizeGateCost", () => {
  it("counts a clean streak from the newest row", () => {
    const costs = summarizeGateCost(rows("pass", "pass", "pass"));
    expect(costs.typecheck?.runs).toBe(3);
    expect(costs.typecheck?.failures).toBe(0);
    expect(costs.typecheck?.cleanRuns).toBe(3);
  });

  it("resets the streak on the newest failure", () => {
    const costs = summarizeGateCost(rows("pass", "fail"));
    expect(costs.typecheck?.cleanRuns).toBe(0);
    expect(costs.typecheck?.failures).toBe(1);
    expect(costs.typecheck?.lastFailureAt).toBe("2026-11-07T10:01:00.000Z");
  });

  it("counts passes after an older failure", () => {
    const costs = summarizeGateCost(rows("fail", "pass", "pass"));
    expect(costs.typecheck?.failures).toBe(1);
    expect(costs.typecheck?.cleanRuns).toBe(2);
  });

  it("sorts by timestamp before counting the streak", () => {
    const later = { ...row(1, "pass"), at: "2026-11-07T11:00:00.000Z" };
    const earlier = { ...row(0, "fail"), at: "2026-11-07T09:00:00.000Z" };
    const costs = summarizeGateCost([later, earlier]);
    expect(costs.typecheck?.cleanRuns).toBe(1);
  });

  it("splits gates and computes a cost share", () => {
    const fast = summarizeGateCost([row(0, "pass", "typecheck"), row(1, "pass", "test")]);
    expect(Object.keys(fast).sort()).toEqual(["test", "typecheck"]);
    const share = Object.values(fast).reduce((sum, cost) => sum + cost.costShare, 0);
    expect(share).toBeCloseTo(1);
  });
});

describe("retirementState", () => {
  const clean = (cleanRuns: number) => ({
    runs: Math.max(cleanRuns, 1),
    failures: 0,
    medianMs: 100,
    p95Ms: 100,
    maxMs: 100,
    lastRunAt: "2026-11-07T10:00:00.000Z",
    lastFailureAt: null,
    cleanRuns,
    costShare: 0.5,
  });

  it("requires the full clean-run policy", () => {
    expect(retirementState(clean(CLEAN_RUNS - 1), false)).toBe("insufficient");
    expect(retirementState(clean(CLEAN_RUNS), false)).toBe("eligible");
  });

  it("reports a newest failure as blocked", () => {
    expect(retirementState(clean(0), false)).toBe("blocked");
  });

  it("reports an advisory gate as advisory regardless of streak", () => {
    expect(retirementState(clean(0), true)).toBe("advisory");
  });

  it("treats a gate with no rows as insufficient", () => {
    expect(retirementState(undefined, false)).toBe("insufficient");
  });
});

describe("decideRetirement", () => {
  const cost = {
    runs: 23,
    failures: 0,
    medianMs: 400,
    p95Ms: 500,
    maxMs: 600,
    lastRunAt: "2026-11-07T10:00:00.000Z",
    lastFailureAt: null,
    cleanRuns: 23,
    costShare: 0.1,
  };

  it("records one eligible gate with its evidence snapshot", () => {
    const decision = decideRetirement(emptyLedger(), "check-non-goals", cost, NOW, "narrow docs gate");
    expect(decision.ok).toBe(true);
    if (!decision.ok) return;
    const entry = decision.ledger.gates["check-non-goals"];
    expect(entry?.status).toBe("advisory");
    expect(entry?.decided_at).toBe(NOW.toISOString());
    expect(entry?.evidence).toEqual({ runs: 23, clean_runs: 23, median_ms: 400, p95_ms: 500 });
    expect(entry?.note).toBe("narrow docs gate");
  });

  it("refuses an unknown gate", () => {
    const decision = decideRetirement(emptyLedger(), "not-a-gate", cost, NOW);
    expect(decision.ok).toBe(false);
    if (decision.ok) return;
    expect(decision.reason).toContain("unknown gate");
  });

  it("refuses a gate below the policy", () => {
    const decision = decideRetirement(emptyLedger(), "check-non-goals", { ...cost, cleanRuns: 5 }, NOW);
    expect(decision.ok).toBe(false);
    if (decision.ok) return;
    expect(decision.reason).toContain("below the policy");
  });

  it("refuses an already advisory gate", () => {
    const first = decideRetirement(emptyLedger(), "check-non-goals", cost, NOW);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const second = decideRetirement(first.ledger, "check-non-goals", cost, NOW);
    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.reason).toContain("already advisory");
  });

  it("restores by removing the entry", () => {
    const first = decideRetirement(emptyLedger(), "check-non-goals", cost, NOW);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const restored = decideRestore(first.ledger, "check-non-goals");
    expect(restored.ok).toBe(true);
    if (!restored.ok) return;
    expect(restored.ledger.gates["check-non-goals"]).toBeUndefined();
  });
});

describe("readLedger", () => {
  function write(root: string, body: unknown): void {
    mkdirSync(join(root, "scripts"), { recursive: true });
    writeFileSync(join(root, "scripts", "gate-ledger.json"), JSON.stringify(body));
  }

  it("treats a missing ledger as empty with no warning", () => {
    const result = readLedger(tempRoot());
    expect(result.ledger).toEqual(emptyLedger());
    expect(result.warnings).toEqual([]);
  });

  it("reads a valid advisory entry", () => {
    const root = tempRoot();
    write(root, {
      schema: 1,
      gates: {
        "check-non-goals": {
          status: "advisory",
          decided_at: NOW.toISOString(),
          evidence: { runs: 23, clean_runs: 23, median_ms: 400, p95_ms: 500 },
          note: "narrow docs gate",
        },
      },
    });
    const result = readLedger(root);
    expect(result.warnings).toEqual([]);
    expect(advisoryGates(result.ledger)).toEqual(new Set(["check-non-goals"]));
  });

  it("fails closed on corrupt JSON", () => {
    const root = tempRoot();
    mkdirSync(join(root, "scripts"), { recursive: true });
    writeFileSync(join(root, "scripts", "gate-ledger.json"), "{nope");
    const result = readLedger(root);
    expect(advisoryGates(result.ledger)).toEqual(new Set());
    expect(result.warnings[0]).toContain("not valid JSON");
  });

  it("ignores an unknown gate with a warning", () => {
    const root = tempRoot();
    write(root, {
      schema: 1,
      gates: {
        "not-a-gate": {
          status: "advisory",
          decided_at: NOW.toISOString(),
          evidence: { runs: 1, clean_runs: 1, median_ms: 1, p95_ms: 1 },
        },
      },
    });
    const result = readLedger(root);
    expect(advisoryGates(result.ledger)).toEqual(new Set());
    expect(result.warnings[0]).toContain("unknown gate");
  });

  it("leaves a malformed entry gating with a warning", () => {
    const root = tempRoot();
    write(root, {
      schema: 1,
      gates: { "check-non-goals": { status: "advisory", decided_at: NOW.toISOString() } },
    });
    const result = readLedger(root);
    expect(advisoryGates(result.ledger)).toEqual(new Set());
    expect(result.warnings[0]).toContain("malformed");
  });
});

describe("writeLedger", () => {
  it("writes a ledger that reads back", () => {
    const root = tempRoot();
    mkdirSync(join(root, "scripts"), { recursive: true });
    const ledger: Ledger = {
      schema: 1,
      gates: {
        "check-non-goals": {
          status: "advisory",
          decided_at: NOW.toISOString(),
          evidence: { runs: 23, clean_runs: 23, median_ms: 400, p95_ms: 500 },
        },
      },
    };
    writeLedger(root, ledger);
    expect(readLedger(root).ledger).toEqual(ledger);
  });
});

describe("readTiming", () => {
  it("returns an empty record when the file is absent", () => {
    const result = readTiming(tempRoot());
    expect(result.rows).toEqual([]);
    expect(result.warning).toBeNull();
  });

  it("warns and skips malformed rows", () => {
    const root = tempRoot();
    const path = timingPath(root);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify([row(0, "pass"), { gate: "test" }]));
    const result = readTiming(root);
    expect(result.rows).toHaveLength(1);
    expect(result.warning).toContain("malformed");
    rmSync(path, { force: true });
  });
});

describe("classifyResults", () => {
  const advisory = new Set(["check-non-goals"]);

  it("lets an advisory-only failure pass", () => {
    const result = classifyResults(
      [{ gate: { name: "check-non-goals" }, code: 1 }],
      advisory,
    );
    expect(result.code).toBe(0);
    expect(result.advisoryFailures).toEqual(["check-non-goals"]);
  });

  it("fails on a gating failure", () => {
    const result = classifyResults([{ gate: { name: "typecheck" }, code: 1 }], advisory);
    expect(result.code).toBe(1);
    expect(result.gatingFailure).toBe("typecheck");
  });

  it("reports a fatal start failure as exit 2", () => {
    const result = classifyResults(
      [{ gate: { name: "check-pack" }, code: null, fatal: "spawn failed" }],
      advisory,
    );
    expect(result.code).toBe(2);
    expect(result.fatal).toBe("check-pack");
  });

  it("passes when every result is clean", () => {
    expect(classifyResults([{ gate: { name: "typecheck" }, code: 0 }], advisory).code).toBe(0);
  });
});
