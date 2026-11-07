// gate-retirement.ts — advisory-gate policy, ledger, and run classification.
//
// Role: library (imported by `scripts/gate-cost-report.ts`, `scripts/weekly.ts`,
// and `scripts/run-gates.ts`). It reads the local timing record and the
// committed ledger; no network and no process exit, so the policy is
// unit-testable.
//
// "No findings" is read as "no failing run": the timing record carries only
// `pass`/`fail`, so a gate becomes eligible after CLEAN_RUNS consecutive
// passing rows. Eligibility is a recommendation; only an explicit
// `gate-cost --retire <gate>` writes a decision. Deleting a gate stays a
// manual manifest edit. Retirement is opt-in per gate: the manifest must mark
// a gate `retirable`, so a gate added later is protected until a reviewed
// manifest edit opts it in, and a ledger entry naming an unmarked gate is
// ignored at read time.

import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { percentile } from "./delivery.js";
import { GATES, isRetirable } from "./gate-manifest.js";
import { timingPath } from "./gate-run-manifest.js";

/** Consecutive passing runs that make a gate a retirement candidate. */
export const CLEAN_RUNS = 20;

export type RunStatus = "pass" | "fail";

/** One row of `$TMPDIR/infobroker/gate-timing-<repoKey>.json`. */
export interface TimingRow {
  at: string;
  mode: "fast" | "full";
  head: string;
  gate: string;
  ms: number;
  status: RunStatus;
}

export interface GateCost {
  runs: number;
  failures: number;
  medianMs: number;
  p95Ms: number;
  maxMs: number;
  lastRunAt: string;
  lastFailureAt: string | null;
  /** Consecutive `pass` rows counted backward from the newest row. */
  cleanRuns: number;
  /** Median share of the sum of all gate medians, 0–1. */
  costShare: number;
}

export interface LedgerEvidence {
  runs: number;
  clean_runs: number;
  median_ms: number;
  p95_ms: number;
}

export interface LedgerEntry {
  status: "advisory";
  decided_at: string;
  evidence: LedgerEvidence;
  note?: string;
}

export interface Ledger {
  schema: 1;
  gates: Record<string, LedgerEntry>;
}

export interface LedgerRead {
  ledger: Ledger;
  warnings: string[];
}

export type RetirementState = "advisory" | "protected" | "eligible" | "insufficient" | "blocked";

export type Decision =
  | { ok: true; ledger: Ledger }
  | { ok: false; reason: string };

/** emptyLedger — the shape a repository ships before any decision. */
export function emptyLedger(): Ledger {
  return { schema: 1, gates: {} };
}

function isTimingRow(value: unknown): value is TimingRow {
  if (typeof value !== "object" || value === null) return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.gate === "string" &&
    row.gate.length > 0 &&
    typeof row.at === "string" &&
    typeof row.ms === "number" &&
    Number.isFinite(row.ms) &&
    row.ms >= 0 &&
    (row.status === "pass" || row.status === "fail")
  );
}

/**
 * readTiming — the local timing rows, oldest first. A missing file is an empty
 * record with no warning (a fresh checkout has not run the suite yet); a
 * corrupt file is disposable local state, so it becomes an empty record with a
 * warning rather than a failure.
 */
export function readTiming(root: string): { rows: TimingRow[]; warning: string | null } {
  const path = timingPath(root);
  if (!existsSync(path)) return { rows: [], warning: null };
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return { rows: [], warning: "gate-timing record is not valid JSON" };
  }
  if (!Array.isArray(parsed)) {
    return { rows: [], warning: "gate-timing record is not an array" };
  }
  const rows = parsed.filter(isTimingRow);
  const skipped = parsed.length - rows.length;
  return {
    rows,
    warning: skipped > 0 ? `gate-timing record: ${skipped} malformed row(s) skipped` : null,
  };
}

/**
 * summarizeGateCost — per-gate cost and clean streak. Rows sort by `at`, with
 * file order as the tie-break, so two runs in the same millisecond keep the
 * order the runner wrote them.
 */
export function summarizeGateCost(rows: TimingRow[]): Record<string, GateCost> {
  const ordered = rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => a.row.at.localeCompare(b.row.at) || a.index - b.index)
    .map((entry) => entry.row);

  const byGate = new Map<string, TimingRow[]>();
  for (const row of ordered) {
    const list = byGate.get(row.gate) ?? [];
    list.push(row);
    byGate.set(row.gate, list);
  }

  const costs: Record<string, GateCost> = {};
  for (const [gate, list] of byGate) {
    const durations = list.map((row) => row.ms);
    let cleanRuns = 0;
    for (let i = list.length - 1; i >= 0; i -= 1) {
      if (list[i]?.status !== "pass") break;
      cleanRuns += 1;
    }
    const failures = list.filter((row) => row.status === "fail");
    costs[gate] = {
      runs: list.length,
      failures: failures.length,
      medianMs: percentile(durations, 0.5),
      p95Ms: percentile(durations, 0.95),
      maxMs: Math.max(...durations),
      lastRunAt: list[list.length - 1]?.at ?? "",
      lastFailureAt: failures[failures.length - 1]?.at ?? null,
      cleanRuns,
      costShare: 0,
    };
  }

  const total = Object.values(costs).reduce((sum, cost) => sum + cost.medianMs, 0);
  if (total > 0) {
    for (const cost of Object.values(costs)) cost.costShare = cost.medianMs / total;
  }
  return costs;
}

/** ledgerPath — the committed decision ledger. */
export function ledgerPath(root: string): string {
  return join(root, "scripts", "gate-ledger.json");
}

const KNOWN_GATES = new Set(GATES.map((gate) => gate.name));

function isEvidence(value: unknown): value is LedgerEvidence {
  if (typeof value !== "object" || value === null) return false;
  const evidence = value as Record<string, unknown>;
  return (
    typeof evidence.runs === "number" &&
    typeof evidence.clean_runs === "number" &&
    typeof evidence.median_ms === "number" &&
    typeof evidence.p95_ms === "number"
  );
}

/**
 * readLedger — the committed ledger, fail closed. A missing file is an empty
 * ledger; a corrupt file or a malformed entry leaves the affected gate gating
 * and produces a warning. An unknown gate name is a stale-entry warning with
 * no effect. Never throws.
 */
export function readLedger(root: string): LedgerRead {
  const path = ledgerPath(root);
  if (!existsSync(path)) return { ledger: emptyLedger(), warnings: [] };
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return {
      ledger: emptyLedger(),
      warnings: ["gate-ledger.json is not valid JSON — every gate stays gating"],
    };
  }
  if (typeof parsed !== "object" || parsed === null) {
    return {
      ledger: emptyLedger(),
      warnings: ["gate-ledger.json is not an object — every gate stays gating"],
    };
  }
  const record = parsed as Record<string, unknown>;
  if (record.schema !== 1 || typeof record.gates !== "object" || record.gates === null) {
    return {
      ledger: emptyLedger(),
      warnings: ["gate-ledger.json has no schema 1 gates object — every gate stays gating"],
    };
  }

  const warnings: string[] = [];
  const ledger = emptyLedger();
  for (const [gate, entry] of Object.entries(record.gates as Record<string, unknown>)) {
    if (!KNOWN_GATES.has(gate)) {
      warnings.push(`gate-ledger.json: unknown gate "${gate}" — stale entry ignored`);
      continue;
    }
    if (!isRetirable(gate)) {
      warnings.push(`gate-ledger.json: "${gate}" is not retirable — entry ignored`);
      continue;
    }
    if (typeof entry !== "object" || entry === null) {
      warnings.push(`gate-ledger.json: entry "${gate}" is malformed — gate stays gating`);
      continue;
    }
    const candidate = entry as Record<string, unknown>;
    if (
      candidate.status !== "advisory" ||
      typeof candidate.decided_at !== "string" ||
      candidate.decided_at.length === 0 ||
      !isEvidence(candidate.evidence)
    ) {
      warnings.push(`gate-ledger.json: entry "${gate}" is malformed — gate stays gating`);
      continue;
    }
    ledger.gates[gate] = {
      status: "advisory",
      decided_at: candidate.decided_at,
      evidence: candidate.evidence,
      ...(typeof candidate.note === "string" && candidate.note.length > 0
        ? { note: candidate.note }
        : {}),
    };
  }
  return { ledger, warnings };
}

/** advisoryGates — the set the runner and reports consult. */
export function advisoryGates(ledger: Ledger): Set<string> {
  return new Set(Object.keys(ledger.gates));
}

/** retirementState — the policy verdict for one gate. */
export function retirementState(
  cost: GateCost | undefined,
  advisory: boolean,
  { retirable = true, policy = CLEAN_RUNS }: { retirable?: boolean; policy?: number } = {},
): RetirementState {
  if (advisory) return "advisory";
  if (!retirable) return "protected";
  if (!cost || cost.runs === 0) return "insufficient";
  if (cost.cleanRuns === 0) return "blocked";
  return cost.cleanRuns >= policy ? "eligible" : "insufficient";
}

/**
 * decideRetirement — the pure decision. Refuses an unknown gate, an already
 * advisory gate, and a gate below the policy; the caller writes the ledger.
 */
export function decideRetirement(
  ledger: Ledger,
  gate: string,
  cost: GateCost | undefined,
  now: Date = new Date(),
  note?: string,
): Decision {
  if (!KNOWN_GATES.has(gate)) {
    return { ok: false, reason: `unknown gate "${gate}" (not in the manifest)` };
  }
  if (!isRetirable(gate)) {
    return { ok: false, reason: `"${gate}" is not marked retirable in the manifest` };
  }
  if (ledger.gates[gate]) {
    return { ok: false, reason: `"${gate}" is already advisory` };
  }
  if (!cost || cost.runs === 0) {
    return { ok: false, reason: `"${gate}" has no timing rows` };
  }
  if (cost.cleanRuns < CLEAN_RUNS) {
    return {
      ok: false,
      reason: `"${gate}" clean streak is ${cost.cleanRuns}, below the policy of ${CLEAN_RUNS}`,
    };
  }
  return {
    ok: true,
    ledger: {
      ...ledger,
      gates: {
        ...ledger.gates,
        [gate]: {
          status: "advisory",
          decided_at: now.toISOString(),
          evidence: {
            runs: cost.runs,
            clean_runs: cost.cleanRuns,
            median_ms: cost.medianMs,
            p95_ms: cost.p95Ms,
          },
          ...(note ? { note } : {}),
        },
      },
    },
  };
}

/** decideRestore — the pure reversal; the entry's removal is the git audit trail. */
export function decideRestore(ledger: Ledger, gate: string): Decision {
  if (!ledger.gates[gate]) {
    return { ok: false, reason: `"${gate}" is not advisory` };
  }
  const gates = { ...ledger.gates };
  delete gates[gate];
  return { ok: true, ledger: { ...ledger, gates } };
}

/** writeLedger — atomic replace, so an interrupted write cannot truncate it. */
export function writeLedger(root: string, ledger: Ledger): void {
  const path = ledgerPath(root);
  const temporary = `${path}.tmp-${process.pid}`;
  writeFileSync(temporary, `${JSON.stringify(ledger, null, 2)}\n`, { mode: 0o644 });
  renameSync(temporary, path);
}

export interface RunResultLike {
  gate: { name: string };
  code: number | null;
  fatal?: string;
}

export interface Classification {
  code: 0 | 1 | 2;
  advisoryFailures: string[];
  gatingFailure: string | null;
  fatal: string | null;
}

/**
 * classifyResults — the exit contract with advisory gates removed. A fatal
 * start failure wins, then any gating failure, then advisory-only failures,
 * which are reported but do not fail the suite.
 */
export function classifyResults(
  results: RunResultLike[],
  advisory: Set<string>,
): Classification {
  const advisoryFailures: string[] = [];
  let gatingFailure: string | null = null;
  let fatal: string | null = null;
  for (const result of results) {
    if (result.fatal) {
      fatal ??= result.gate.name;
      continue;
    }
    if (result.code === 0) continue;
    if (advisory.has(result.gate.name)) advisoryFailures.push(result.gate.name);
    else gatingFailure ??= result.gate.name;
  }
  const code: 0 | 1 | 2 = fatal ? 2 : gatingFailure ? 1 : 0;
  return { code, advisoryFailures, gatingFailure, fatal };
}
