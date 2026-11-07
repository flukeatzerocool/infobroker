#!/usr/bin/env npx tsx
/**
 * run-gates.ts — run the project gate suite from one manifest. [gate]
 *
 * Purpose: replace the package.json `&&` chain with one definition of what
 * `check` and `check:fast` run. `--full` reproduces the historical chain
 * (sequential, stops at the first failure). `--fast` runs the subset that needs
 * no network and no build artifact, with at most four gates in flight, and
 * reports each gate's own output so a failure is attributed to its gate rather
 * than interleaved with its siblings.
 *
 * `--timing` appends per-gate durations to `$TMPDIR/infobroker/gate-timing-<repoKey>.json`
 * (local, never committed) so gate cost is measurable. `--record` writes the tree-
 * keyed run record the pre-push hook reads; it is refused for a dirty tree and
 * only applies to a full run. `--list` prints the manifest, and
 * `--list --format md` prints the block pasted into AGENTS.md.
 *
 * Usage: npx tsx scripts/run-gates.ts --full|--fast [--timing] [--record]
 *        npx tsx scripts/run-gates.ts --recorded
 *        npx tsx scripts/run-gates.ts --list [--format plain|md]
 * Exit codes: 0 = every gate passed, 1 = a gate failed, 2 = fatal.
 */
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { handleHelp, parseFlag, parseValueFlag, rejectUnknown } from "./lib/args.js";
import {
  GATES,
  fastGates,
  gateCommand,
  renderGatesBlock,
  type Gate,
} from "./lib/gate-manifest.js";
import {
  advisoryGates,
  classifyResults,
  readLedger,
} from "./lib/gate-retirement.js";
import { recordedMode, timingPath, writeGateRun } from "./lib/gate-run-manifest.js";

const ROOT = join(import.meta.dirname, "..");
const TIMING_CAP = 4000;
const MAX_IN_FLIGHT = 4;

const USAGE = `Usage: npx tsx scripts/run-gates.ts --full|--fast [--timing] [--record]
       npx tsx scripts/run-gates.ts --recorded
       npx tsx scripts/run-gates.ts --list [--format plain|md]

  --full       Run every gate sequentially, stopping at the first failure.
  --fast       Run the gates that need no network or build artifact, up to four
               at a time; each gate's output is buffered and shown on failure.
  --timing     Append per-gate durations to .infobroker/gate-timing.json.
  --record     With --full: write the tree-keyed record the pre-push hook reads.
               Refused for a dirty tree (the record could never match).
  --record-only
               Write the record without running the suite. Used by the push
               pipeline, whose final gate ran before the commit. Never fails
               the caller: a dirty tree simply leaves no record.
  --recorded   Print the level already verified for this exact tree
               (full, fast, or none) and exit.
  --list       Print the manifest and exit.
  --format     With --list: "plain" (default) or "md" (the AGENTS.md block).
  --help       Show this message.
`;

type Mode = "fast" | "full";

interface TimingRecord {
  at: string;
  mode: Mode;
  head: string;
  gate: string;
  ms: number;
  status: "pass" | "fail";
}

interface Result {
  gate: Gate;
  code: number | null;
  stdout: string;
  stderr: string;
  ms: number;
  fatal?: string;
}

interface SuiteResult {
  code: number;
  results: Result[];
}

function runGate(gate: Gate, capture: boolean): Promise<Result> {
  const command = gateCommand(gate);
  const started = Date.now();
  return new Promise((resolve) => {
    const child = spawn(command[0], command.slice(1), {
      cwd: ROOT,
      stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
    });
    let stdout = "";
    let stderr = "";
    if (capture) {
      child.stdout?.on("data", (chunk: Buffer) => {
        stdout += chunk.toString();
      });
      child.stderr?.on("data", (chunk: Buffer) => {
        stderr += chunk.toString();
      });
    }
    child.on("error", (error) => {
      resolve({
        gate,
        code: null,
        stdout,
        stderr,
        ms: Date.now() - started,
        fatal: `could not start ${command.join(" ")}: ${error.message}`,
      });
    });
    child.on("close", (code) => {
      resolve({ gate, code, stdout, stderr, ms: Date.now() - started });
    });
  });
}

function printFailure(result: Result): void {
  process.stderr.write(`\n--- ${result.gate.name} output ---\n`);
  if (result.stdout) process.stderr.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
}

async function runFull(advisory: Set<string>): Promise<SuiteResult> {
  const results: Result[] = [];
  for (const gate of GATES) {
    const result = await runGate(gate, false);
    results.push(result);
    if (result.fatal) {
      process.stderr.write(`gates: fatal: ${result.fatal}\n`);
      return { code: 2, results };
    }
    if (result.code !== 0) {
      if (advisory.has(gate.name)) {
        process.stderr.write(`ADVISORY FAIL ${gate.name}\n`);
        continue;
      }
      process.stderr.write(`FAIL ${gate.name}\n`);
      return { code: 1, results };
    }
  }
  return { code: classifyResults(results, advisory).code, results };
}

async function runFast(advisory: Set<string>): Promise<SuiteResult> {
  const gates = fastGates();
  const order = new Map(gates.map((gate, index) => [gate.name, index]));
  const results: Result[] = [];
  const queue = [...gates];

  const worker = async (): Promise<void> => {
    for (;;) {
      const gate = queue.shift();
      if (!gate) return;
      results.push(await runGate(gate, true));
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(MAX_IN_FLIGHT, gates.length) }, () => worker()),
  );
  results.sort((a, b) => (order.get(a.gate.name) ?? 0) - (order.get(b.gate.name) ?? 0));

  let fatal = false;
  for (const result of results) {
    if (result.fatal) {
      fatal = true;
      process.stderr.write(`FATAL ${result.gate.name}: ${result.fatal}\n`);
    } else if (result.code !== 0) {
      if (advisory.has(result.gate.name)) {
        process.stderr.write(`ADVISORY FAIL ${result.gate.name}\n`);
      } else {
        process.stderr.write(`FAIL ${result.gate.name}\n`);
        printFailure(result);
      }
    } else {
      process.stdout.write(`PASS ${result.gate.name}\n`);
    }
  }
  const classification = classifyResults(results, advisory);
  if (fatal) return { code: 2, results };
  return { code: classification.code, results };
}

function headSha(): string {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { cwd: ROOT, encoding: "utf-8" }).trim();
  } catch {
    // Not a git repo or no commit yet: timing rows still record the gate.
    return "-";
  }
}

function recordTiming(results: Result[], mode: Mode): void {
  const path = timingPath(ROOT);
  let existing: TimingRecord[] = [];
  if (existsSync(path)) {
    try {
      const parsed = JSON.parse(readFileSync(path, "utf-8")) as TimingRecord[];
      if (Array.isArray(parsed)) existing = parsed;
    } catch {
      // A corrupt timing file is replaced: timings are measurements, not state.
      existing = [];
    }
  }
  const at = new Date().toISOString();
  const head = headSha();
  const rows: TimingRecord[] = results.map((result) => ({
    at,
    mode,
    head,
    gate: result.gate.name,
    ms: result.ms,
    status: result.code === 0 ? "pass" : "fail",
  }));
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  writeFileSync(path, `${JSON.stringify([...existing, ...rows].slice(-TIMING_CAP), null, 2)}\n`, {
    mode: 0o600,
  });
}

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  handleHelp(argv, USAGE);
  rejectUnknown(
    argv,
    new Set([
      "--full",
      "--fast",
      "--timing",
      "--record",
      "--record-only",
      "--recorded",
      "--list",
      "--format",
      "--help",
      "-h",
    ]),
    USAGE,
  );

  if (parseFlag(argv, "--record-only")) {
    const saved = writeGateRun(ROOT, "full");
    if (saved) {
      process.stdout.write(`gates: recorded full run for ${saved.head.slice(0, 12)}\n`);
    } else {
      process.stdout.write("gates: not recorded — working tree is dirty or not a git repo\n");
    }
    return 0;
  }

  if (parseFlag(argv, "--list")) {
    const format = parseValueFlag(argv, "--format") ?? "plain";
    if (format === "md") {
      process.stdout.write(`${renderGatesBlock()}\n`);
    } else if (format === "plain") {
      const advisory = advisoryGates(readLedger(ROOT).ledger);
      for (const gate of GATES) {
        const marker = advisory.has(gate.name) ? "  [advisory]" : "";
        process.stdout.write(`${gate.name}\t${gate.description}${marker}\n`);
      }
    } else {
      process.stderr.write(`unknown --format value: ${format}\n${USAGE}`);
      return 2;
    }
    return 0;
  }
  if (parseFlag(argv, "--format") || parseValueFlag(argv, "--format")) {
    process.stderr.write(`--format requires --list\n${USAGE}`);
    return 2;
  }

  if (parseFlag(argv, "--recorded")) {
    process.stdout.write(`${recordedMode(ROOT) ?? "none"}\n`);
    return 0;
  }

  const full = parseFlag(argv, "--full");
  const fast = parseFlag(argv, "--fast");
  if (full === fast) {
    process.stderr.write(`exactly one of --full or --fast is required\n${USAGE}`);
    return 2;
  }
  const record = parseFlag(argv, "--record");
  if (record && fast) {
    process.stderr.write(
      "--record is only valid with --full (a fast run may not satisfy the pre-push gate)\n",
    );
    return 2;
  }

  const mode: Mode = full ? "full" : "fast";
  const { ledger, warnings } = readLedger(ROOT);
  for (const warning of warnings) process.stderr.write(`gates: ${warning}\n`);
  const advisory = advisoryGates(ledger);
  const started = Date.now();
  const { code, results } = full ? await runFull(advisory) : await runFast(advisory);
  const elapsed = Date.now() - started;

  if (parseFlag(argv, "--timing") && results.length > 0) recordTiming(results, mode);

  if (code === 0) {
    process.stdout.write(`gates: PASS (${mode}, ${(elapsed / 1000).toFixed(1)}s)\n`);
    if (record) {
      const saved = writeGateRun(ROOT, "full");
      if (saved) {
        process.stdout.write(`gates: recorded full run for ${saved.head.slice(0, 12)}\n`);
      } else {
        process.stderr.write("gates: not recorded — working tree is dirty or not a git repo\n");
      }
    }
  } else if (code === 1) {
    process.stderr.write(`gates: FAIL (${mode})\n`);
  }
  return code;
}

main()
  .then((code) => {
    process.exit(code);
  })
  .catch((error: Error) => {
    process.stderr.write(`run-gates: fatal: ${error.message}\n`);
    process.exit(2);
  });
