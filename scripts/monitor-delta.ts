#!/usr/bin/env npx tsx
// monitor-delta.ts — entry point: deterministic offline comparison of two report
// manifests (REQ-117). When a stored report identity is supplied the baseline is
// revalidated through `manage_kb action=verify_report` before comparing, and the
// verification outcome is recorded on the delta. Without one, the run is marked
// `baseline_verified: false` rather than silently claiming a verified baseline.
//
// Role: entry point. Exit codes: 0 = comparison completed; 1 = invalid input, an
// unverified baseline, or a revision-contract violation; 2 = fatal.

import { readFileSync, existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { handleHelp } from "./lib/args.js";
import {
  readSnapshot,
  diffReports,
  successionIssues,
  type ReportDelta,
  type ReportSnapshot,
} from "../src/lib/report-delta.js";

const USAGE = `monitor-delta — compare two report manifests offline (REQ-117)

Usage:
  monitor-delta --baseline <report.md> --current <report.md> [OPTIONS]

Options:
  --baseline <path>     Earlier report Markdown file.
  --current <path>      Later report Markdown file.
  --receipt <id>        Stored report identity (for example report://slug) whose
                        verification receipt revalidates the baseline before
                        comparing. Requires --baseline.
  --baseline-id <id>    Identity the current report's "supersedes" must name.
                        Defaults to --receipt when given.
  --json                Emit the delta as JSON on stdout.
  --help, -h            Show this help (exit 0).

Exit codes: 0 = comparison completed; 1 = invalid input, unverified baseline, or
revision-contract violation; 2 = fatal.
`;

/**
 * Deterministic subset of a `verify_report` result. Clock-derived fields
 * (`age_days`, `stale`, `created_at`) are deliberately dropped so the delta is
 * byte-identical across runs.
 */
export interface VerificationSummary {
  state: string;
  digest_match: boolean;
  report: string;
  report_revision: number | null;
  report_supersedes: string | null;
  source_drift: string[];
  unverifiable_sources: string[];
  report_source_drift: { total: number; drift: number; unverifiable: number };
  /** Claim count recorded in the receipt, for the baseline identity check. */
  claim_count: number | null;
}

export interface Comparison extends ReportDelta {
  baseline_verified: boolean;
  baseline_unverified?: string;
  verification?: VerificationSummary;
}

export type VerifyParse =
  | { ok: true; verification: Record<string, unknown> }
  | { ok: false; error: string };

/** Classify a `manage_kb action=verify_report` response. The transport delivers
 * an `[ERROR]` body as ordinary content, so the envelope decides success. */
export function parseVerifyReport(text: string): VerifyParse {
  const trimmed = text.trim();
  if (trimmed.startsWith("[ERROR]")) {
    return { ok: false, error: trimmed.slice("[ERROR]".length).trim() };
  }
  const body = trimmed.startsWith("[OK] ") ? trimmed.slice(5) : trimmed;
  try {
    const parsed = JSON.parse(body) as { results?: unknown };
    const first = Array.isArray(parsed.results) ? parsed.results[0] : undefined;
    if (typeof first !== "object" || first === null) {
      return { ok: false, error: "response carried no verification result" };
    }
    return { ok: true, verification: first as Record<string, unknown> };
  } catch {
    // A non-JSON body is an unreadable response; treat it as a failed baseline
    // so the comparison never claims a verification it did not receive.
    return { ok: false, error: "response was not JSON" };
  }
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function summarizeVerification(raw: Record<string, unknown>): VerificationSummary {
  const sources = typeof raw["sources"] === "object" && raw["sources"] !== null
    ? (raw["sources"] as Record<string, unknown>)
    : {};
  const details = Array.isArray(sources["details"]) ? (sources["details"] as Record<string, unknown>[]) : [];
  const drift: string[] = [];
  const unverifiable: string[] = [];
  for (const entry of details) {
    const url = entry["url"];
    if (typeof url !== "string") continue;
    if (entry["state"] === "drift") drift.push(url);
    else if (entry["state"] === "unverifiable") unverifiable.push(url);
  }
  const totals = (value: unknown): { total: number; drift: number; unverifiable: number } => {
    const record = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
    const num = (key: string): number => (typeof record[key] === "number" ? (record[key] as number) : 0);
    return { total: num("total"), drift: num("drift"), unverifiable: num("unverifiable") };
  };
  return {
    state: typeof raw["state"] === "string" ? raw["state"] : "unknown",
    digest_match: raw["digest_match"] === true,
    report: typeof raw["report"] === "string" ? raw["report"] : "unknown",
    report_revision: numberOrNull(raw["revision"]),
    report_supersedes: typeof raw["supersedes"] === "string" ? raw["supersedes"] : null,
    source_drift: [...new Set(drift)].sort(),
    unverifiable_sources: [...new Set(unverifiable)].sort(),
    report_source_drift: totals(raw["report_sources"]),
    claim_count: numberOrNull(raw["claims"]),
  };
}

/** Refusals that stop a comparison: the stored baseline is not trustworthy. */
export function baselineProblems(summary: VerificationSummary | null, claimCount?: number): string[] {
  if (summary === null) return [];
  const problems: string[] = [];
  if (!summary.digest_match) {
    problems.push("baseline-digest-mismatch: the stored receipt manifest does not match its digest");
  }
  if (summary.report !== "verified") {
    problems.push(`baseline-report-${summary.report}: the stored report did not verify against its receipt`);
  }
  if (claimCount !== undefined && summary.claim_count !== null && summary.claim_count !== claimCount) {
    problems.push(
      `baseline-claim-count-mismatch: the receipt records ${summary.claim_count} claim(s) but the baseline file has ${claimCount}`
    );
  }
  return problems;
}

export function buildComparison(
  baseline: ReportSnapshot,
  current: ReportSnapshot,
  opts: { baseline: string; current: string; verification?: VerificationSummary }
): Comparison {
  const delta = diffReports(baseline, current);
  const base: Comparison = { baseline: opts.baseline, current: opts.current, ...delta, baseline_verified: false };
  if (opts.verification === undefined) {
    return { ...base, baseline_unverified: "no receipt supplied; the baseline was not revalidated" };
  }
  return { ...base, baseline_verified: true, verification: opts.verification };
}

/** Exit decision for a comparison: receipt refusals plus the revision contract. */
export function comparisonVerdict(
  delta: Omit<ReportDelta, "baseline" | "current">,
  opts: { verification?: VerificationSummary | null; claimCount?: number; baselineId?: string } = {}
): { exit: 0 | 1; problems: string[] } {
  const problems: string[] = [];
  if (opts.verification !== undefined) {
    problems.push(...baselineProblems(opts.verification, opts.claimCount));
  }
  for (const issue of successionIssues(delta, opts.baselineId)) problems.push(issue.message);
  return { exit: problems.length === 0 ? 0 : 1, problems };
}

function load(path: string): string {
  if (!existsSync(path)) throw new Error(`report not found: ${path}`);
  return readFileSync(path, "utf-8");
}

async function verifyStored(receipt: string): Promise<VerifyParse> {
  const client = new Client({ name: "infobroker-monitor-delta", version: "1.0.0" });
  const transport = new StdioClientTransport({
    command: process.platform === "win32" ? "npx.cmd" : "npx",
    args: ["tsx", "src/index.ts"],
    cwd: process.cwd(),
  });
  await client.connect(transport);
  try {
    const result = await client.callTool({
      name: "infobroker_manage_kb",
      arguments: { action: "verify_report", source_url: receipt },
    });
    const text = Array.isArray(result.content)
      ? result.content.map((item) => ("text" in item && typeof item.text === "string" ? item.text : "")).join("")
      : "";
    return parseVerifyReport(text);
  } finally {
    await client.close();
  }
}

async function main(): Promise<void> {
  handleHelp(process.argv.slice(2), USAGE);
  let baseline: string | undefined;
  let current: string | undefined;
  let receipt: string | undefined;
  let baselineId: string | undefined;
  let json = false;
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--baseline") baseline = argv[++i];
    else if (arg.startsWith("--baseline=")) baseline = arg.slice("--baseline=".length);
    else if (arg === "--current") current = argv[++i];
    else if (arg.startsWith("--current=")) current = arg.slice("--current=".length);
    else if (arg === "--receipt") receipt = argv[++i];
    else if (arg.startsWith("--receipt=")) receipt = arg.slice("--receipt=".length);
    else if (arg === "--baseline-id") baselineId = argv[++i];
    else if (arg.startsWith("--baseline-id=")) baselineId = arg.slice("--baseline-id=".length);
    else if (arg === "--json") json = true;
    else {
      console.error(`unknown flag: ${arg}`);
      console.error(USAGE);
      process.exit(1);
    }
  }
  if (baseline === undefined || current === undefined) {
    console.error("--baseline and --current are required");
    console.error(USAGE);
    process.exit(1);
  }
  try {
    const baselineText = load(baseline);
    const baselineSnapshot = readSnapshot(baseline, baselineText);

    let summary: VerificationSummary | undefined;
    if (receipt !== undefined) {
      const parsed = await verifyStored(receipt);
      if (!parsed.ok) {
        console.error(`baseline unverified: ${parsed.error}`);
        process.exit(1);
      }
      summary = summarizeVerification(parsed.verification);
      const refusals = baselineProblems(summary, baselineSnapshot.claims.length);
      if (refusals.length > 0) {
        for (const problem of refusals) console.error(problem);
        process.exit(1);
      }
    } else {
      console.error("warning: no --receipt supplied; the baseline is marked unverified");
    }

    const comparison = buildComparison(baselineSnapshot, readSnapshot(current, load(current)), {
      baseline,
      current,
      ...(summary !== undefined ? { verification: summary } : {}),
    });
    const verdict = comparisonVerdict(comparison, {
      ...(summary !== undefined ? { verification: summary } : {}),
      claimCount: baselineSnapshot.claims.length,
      ...(baselineId ?? receipt ? { baselineId: baselineId ?? receipt! } : {}),
    });

    if (json) {
      console.log(JSON.stringify(comparison, null, 2));
    } else {
      console.log(`baseline_verified: ${comparison.baseline_verified}`);
      console.log(`revision: ${comparison.baseline_revision ?? "unset"} → ${comparison.current_revision ?? "unset"}`);
      console.log(`supersedes: ${comparison.current_supersedes ?? "none"}`);
      console.log(`new claims: ${comparison.new_claims.length}`);
      for (const claim of comparison.new_claims) console.log(`  + ${claim}`);
      console.log(`changed claims: ${comparison.changed_claims.length}`);
      for (const change of comparison.changed_claims) console.log(`  ~ ${change.claim} (${change.changed.join("; ")})`);
      console.log(`removed claims: ${comparison.removed_claims.length}`);
      for (const claim of comparison.removed_claims) console.log(`  - ${claim}`);
      console.log(`new sources: ${comparison.new_sources.join(", ") || "none"}`);
      console.log(`changed sources: ${comparison.changed_sources.length}`);
      for (const change of comparison.changed_sources) console.log(`  ~ ${change.id} (${change.changed.join("; ")})`);
      console.log(`removed sources: ${comparison.removed_sources.join(", ") || "none"}`);
      if (comparison.verification) {
        const v = comparison.verification;
        console.log(`verification: ${v.state} (digest_match ${v.digest_match}, report ${v.report})`);
        console.log(`verified drift: ${v.source_drift.join(", ") || "none"}`);
        console.log(`verified unverifiable: ${v.unverifiable_sources.join(", ") || "none"}`);
      } else {
        console.log(`verification: ${comparison.baseline_unverified ?? "none"}`);
      }
    }

    if (verdict.problems.length > 0) {
      for (const problem of verdict.problems) console.error(problem);
      process.exit(1);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(2);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(2);
  });
}
