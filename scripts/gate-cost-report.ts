#!/usr/bin/env npx tsx
/**
 * gate-cost-report.ts — per-gate cost, clean streaks, and retirement decisions.
 * [build tool]
 *
 * Purpose: turn the timing record `run-gates --timing` already writes into a
 * report a maintainer can act on. A gate with no failing run across CLEAN_RUNS
 * consecutive runs is a retirement candidate; the report recommends, and only
 * an explicit `--retire <gate>` writes the committed advisory decision. The
 * "no findings" proxy is "no failing run" because the record carries only
 * pass/fail. Retiring one gate at a time is deliberate: the current record can
 * make many gates eligible at once, and a bulk apply would weaken the suite in
 * one keystroke.
 *
 * Usage: npx tsx scripts/gate-cost-report.ts [--json] [--retire <gate> [--note <text>]]
 *        npx tsx scripts/gate-cost-report.ts --restore <gate>
 *        (add --dry-run to either mutation to print the ledger without writing)
 *
 * Exit codes: 0 = report printed or decision recorded, 1 = refused or write
 * failed, 2 = usage or fatal.
 */
import { join } from "node:path";
import { handleHelp, parseFlag, parseValueFlag, rejectUnknown } from "./lib/args.js";
import { isRetirable } from "./lib/gate-manifest.js";
import {
  CLEAN_RUNS,
  advisoryGates,
  decideRestore,
  decideRetirement,
  readLedger,
  readTiming,
  retirementState,
  summarizeGateCost,
  writeLedger,
  type GateCost,
  type Ledger,
  type RetirementState,
} from "./lib/gate-retirement.js";

const ROOT = join(import.meta.dirname, "..");

const USAGE = `Usage: npx tsx scripts/gate-cost-report.ts [--json]
       npx tsx scripts/gate-cost-report.ts --retire <gate> [--note <text>] [--dry-run]
       npx tsx scripts/gate-cost-report.ts --restore <gate> [--dry-run]

  (default)    Print per-gate cost, clean streaks, and retirement candidates.
  --json       Emit the report as JSON.
  --retire     Record one eligible gate as advisory in scripts/gate-ledger.json.
  --restore    Remove a gate's advisory decision.
  --note       With --retire: the rationale stored in the ledger entry.
  --dry-run    Print the resulting ledger without writing it.
  --help       Show this message.

Policy: a gate with ${CLEAN_RUNS} consecutive runs and no failing run is a
retirement candidate. "No findings" is read as "no failing run": the timing
record carries only pass/fail. Deleting a gate is a manual manifest edit.
`;

function seconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

interface ReportGate extends GateCost {
  state: RetirementState;
}

function buildReport(
  costs: Record<string, GateCost>,
  advisory: Set<string>,
  rows: { length: number },
  lastAt: string | null,
): {
  schema: 1;
  policy: { clean_runs: number };
  timing: { rows: number; last_at: string | null };
  gates: Record<string, ReportGate>;
  advisory: string[];
  eligible: string[];
  protected: string[];
} {
  const gates: Record<string, ReportGate> = {};
  for (const [name, cost] of Object.entries(costs)) {
    gates[name] = {
      ...cost,
      state: retirementState(cost, advisory.has(name), { retirable: isRetirable(name) }),
    };
  }
  const advisoryList = Object.keys(gates)
    .filter((name) => gates[name]?.state === "advisory")
    .sort();
  const eligible = Object.keys(gates)
    .filter((name) => gates[name]?.state === "eligible")
    .sort();
  const protectedList = Object.keys(gates)
    .filter((name) => gates[name]?.state === "protected")
    .sort();
  return {
    schema: 1,
    policy: { clean_runs: CLEAN_RUNS },
    timing: { rows: rows.length, last_at: lastAt },
    gates,
    advisory: advisoryList,
    eligible,
    protected: protectedList,
  };
}

function printReport(report: ReturnType<typeof buildReport>): void {
  process.stdout.write(
    `\nGate cost (local timing record: ${report.timing.rows} rows, last ${report.timing.last_at ?? "none"})\n\n`,
  );
  const names = Object.keys(report.gates).sort(
    (a, b) => (report.gates[b]?.medianMs ?? 0) - (report.gates[a]?.medianMs ?? 0),
  );
  process.stdout.write(
    `  ${"gate".padEnd(27)} ${"runs".padStart(4)} ${"fails".padStart(5)} ${"median".padStart(7)} ${"p95".padStart(7)} ${"share".padStart(6)} ${"streak".padStart(6)}  state\n`,
  );
  for (const name of names) {
    const gate = report.gates[name];
    if (!gate) continue;
    process.stdout.write(
      `  ${name.padEnd(27)} ${String(gate.runs).padStart(4)} ${String(gate.failures).padStart(5)} ${seconds(gate.medianMs).padStart(7)} ${seconds(gate.p95Ms).padStart(7)} ${`${(gate.costShare * 100).toFixed(0)}%`.padStart(6)} ${String(gate.cleanRuns).padStart(6)}  ${gate.state}\n`,
    );
  }
  process.stdout.write(
    `\nPolicy: ${CLEAN_RUNS} consecutive clean runs. ${report.eligible.length} eligible, ${report.advisory.length} advisory, ${report.protected.length} protected.\n`,
  );
  if (report.eligible.length > 0) {
    process.stdout.write(
      `  Record one decision: npm run gate-cost -- --retire <gate> --note "why"\n`,
    );
    process.stdout.write(`  Eligible: ${report.eligible.join(", ")}\n`);
  }
  process.stdout.write(
    `  Advisory: ${report.advisory.length > 0 ? report.advisory.join(", ") : "none"}\n\n`,
  );
}

function mutate(
  argv: string[],
  ledger: Ledger,
  costs: Record<string, GateCost>,
): number {
  const retire = parseValueFlag(argv, "--retire");
  const restore = parseValueFlag(argv, "--restore");
  const note = parseValueFlag(argv, "--note");
  const dryRun = parseFlag(argv, "--dry-run");

  if (retire !== null && restore !== null) {
    process.stderr.write("gate-cost: choose one of --retire or --restore\n");
    return 2;
  }
  if (argv.includes("--retire") && retire === null) {
    process.stderr.write("gate-cost: --retire requires a gate name\n");
    return 2;
  }
  if (argv.includes("--restore") && restore === null) {
    process.stderr.write("gate-cost: --restore requires a gate name\n");
    return 2;
  }
  if (note !== null && retire === null) {
    process.stderr.write("gate-cost: --note is only valid with --retire\n");
    return 2;
  }

  const decision = retire !== null
    ? decideRetirement(ledger, retire, costs[retire], new Date(), note ?? undefined)
    : restore !== null
      ? decideRestore(ledger, restore)
      : null;
  if (!decision) {
    process.stderr.write("gate-cost: --dry-run requires --retire or --restore\n");
    return 2;
  }
  if (!decision.ok) {
    process.stderr.write(`gate-cost: ${decision.reason}\n`);
    return 1;
  }
  if (dryRun) {
    process.stdout.write(`${JSON.stringify(decision.ledger, null, 2)}\n`);
    return 0;
  }
  try {
    writeLedger(ROOT, decision.ledger);
  } catch (error) {
    process.stderr.write(`gate-cost: could not write the ledger: ${(error as Error).message}\n`);
    return 1;
  }
  if (retire !== null) {
    const cost = costs[retire];
    process.stdout.write(
      `gate-cost: "${retire}" is advisory (${cost?.cleanRuns ?? 0}/${CLEAN_RUNS} clean runs).\n`,
    );
  } else {
    process.stdout.write(`gate-cost: "${restore}" is gating again.\n`);
  }
  return 0;
}

function main(): number {
  const argv = process.argv.slice(2);
  handleHelp(argv, USAGE);
  rejectUnknown(
    argv,
    new Set(["--json", "--retire", "--restore", "--note", "--dry-run", "--help", "-h"]),
    USAGE,
  );

  const { rows, warning } = readTiming(ROOT);
  if (warning) process.stderr.write(`gate-cost: ${warning}\n`);
  const { ledger, warnings } = readLedger(ROOT);
  for (const entry of warnings) process.stderr.write(`gate-cost: ${entry}\n`);
  const costs = summarizeGateCost(rows);
  const advisory = advisoryGates(ledger);

  if (parseFlag(argv, "--retire") || parseFlag(argv, "--restore")) {
    return mutate(argv, ledger, costs);
  }
  if (parseFlag(argv, "--dry-run") || parseFlag(argv, "--note")) {
    process.stderr.write("gate-cost: --dry-run and --note require --retire or --restore\n");
    return 2;
  }

  const lastAt = rows.length > 0 ? (rows[rows.length - 1]?.at ?? null) : null;
  const report = buildReport(costs, advisory, rows, lastAt);
  if (parseFlag(argv, "--json")) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else if (rows.length === 0) {
    process.stdout.write("Gate cost: no timing record (run `npm run check` with --timing)\n");
    process.stdout.write(`Advisory: ${report.advisory.length > 0 ? report.advisory.join(", ") : "none"}\n`);
  } else {
    printReport(report);
  }
  return 0;
}

try {
  process.exit(main());
} catch (error) {
  process.stderr.write(`gate-cost: fatal: ${(error as Error).message}\n`);
  process.exit(2);
}
