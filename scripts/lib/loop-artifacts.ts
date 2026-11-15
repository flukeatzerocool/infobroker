// loop-artifacts.ts — increment artifact discovery and validation.
//
// Shared by scripts/check-loop-artifacts.ts (gate) and scripts/session-close.ts
// (entry point) so the increment contract is defined once. Pure filesystem
// reads; no git, no writes.

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";

const REPO_ROOT = join(import.meta.dirname, "..", "..");

/** The default record store: local state beside the session scratch file. */
export const DEFAULT_INCREMENTS_DIR = ".opencode/plans";

/**
 * incrementsDir — the record store. `INFOBROKER_PLANS_DIR` overrides it; a
 * relative value resolves against the root passed in (the repository root by
 * default), so a test can point at a throwaway tree.
 */
export function incrementsDir(root: string = REPO_ROOT): string {
  const configured = process.env.INFOBROKER_PLANS_DIR?.trim();
  const target = configured && configured.length > 0 ? configured : DEFAULT_INCREMENTS_DIR;
  return isAbsolute(target) ? target : resolve(root, target);
}

/**
 * CAP_CONTRACT_FROM — the first increment date that must declare and record a
 * review cap. Earlier increments are grandfathered, so no closed plan is
 * edited to satisfy a rule that did not exist when it was written.
 */
export const CAP_CONTRACT_FROM = "2026-11-14";

/** Length budgets apply to increments from this date; earlier ones are grandfathered. */
export const LENGTH_BUDGET_FROM = "2026-11-15";
export const PLAN_MAX_LINES = 200;
export const AAR_MAX_LINES = 120;

/** The marker must begin a line; a quotation inside prose is not a declaration. */
const CAP_LINE = /^\*\*Review cap:\*\*[ \t]*(.*)$/m;
const CAP_PLAN_VALUE = /^\d+/;
const CAP_AAR_VALUE = /;\s*used\s+\d+\s+pass(?:es)?\b/i;

/**
 * The terminal token is the LAST occurrence in the file. An AAR that mentions
 * `LOOP OPEN` in a findings table and ends `LOOP PAUSED` is paused; four
 * historical records also wrap the token sentence or backtick the token.
 */
const LOOP_TOKEN = /`?LOOP (PAUSED|OPEN)\b/g;

/** The Done bar must also begin a line, for the same reason as the cap marker. */
const DONE_BAR = /^\*\*Done bar:?\*\*[ \t]*(.+)$/m;

export type Level = "error" | "warning";

export interface Finding {
  increment: string;
  level: Level;
  message: string;
}

export interface Increment {
  name: string;
  dir: string;
  hasPlan: boolean;
  hasTasks: boolean;
  hasAar: boolean;
  loopToken: "LOOP PAUSED" | "LOOP OPEN" | null;
  doneBar: string | null;
  planReviewCap: string | null;
  aarReviewCap: string | null;
  planLines?: number;
  aarLines?: number;
}

/** listIncrements — every directory in the record store, oldest first. */
export function listIncrements(root: string): Increment[] {
  const base = incrementsDir(root);
  if (!existsSync(base)) return [];
  const dirs = readdirSync(base, { withFileTypes: true }).filter((entry) => entry.isDirectory());
  const increments: Increment[] = [];
  for (const dir of dirs) {
    const path = join(base, dir.name);
    const hasPlan = existsSync(join(path, "plan.md"));
    const hasTasks = existsSync(join(path, "tasks.md"));
    const hasAar = existsSync(join(path, "aar.md"));
    const aar = hasAar ? readFileSync(join(path, "aar.md"), "utf-8") : "";
    const plan = hasPlan ? readFileSync(join(path, "plan.md"), "utf-8") : "";
    const doneBar = plan.match(DONE_BAR);
    const planCap = plan.match(CAP_LINE);
    const aarCap = aar.match(CAP_LINE);
    increments.push({
      name: dir.name,
      dir: path,
      hasPlan,
      hasTasks,
      hasAar,
      loopToken: terminalToken(aar),
      doneBar: doneBar?.[1]?.trim() ?? null,
      planReviewCap: planCap?.[1]?.trim() ?? null,
      aarReviewCap: aarCap?.[1]?.trim() ?? null,
      planLines: hasPlan ? plan.split("\n").length : undefined,
      aarLines: hasAar ? aar.split("\n").length : undefined,
    });
  }
  return increments.sort((a, b) => a.name.localeCompare(b.name));
}

/** terminalToken — the last LOOP marker in the file; an earlier mention is prose. */
function terminalToken(aar: string): Increment["loopToken"] {
  const matches = [...aar.matchAll(LOOP_TOKEN)];
  const last = matches.at(-1);
  if (!last) return null;
  return last[1] === "PAUSED" ? "LOOP PAUSED" : "LOOP OPEN";
}

/** validateIncrements — the contract findings for every increment. */
export function validateIncrements(
  root: string,
  options: { requirePausedFor?: string } = {},
): Finding[] {
  const findings: Finding[] = [];
  for (const increment of listIncrements(root)) {
    const capped = capSubject(increment.name);
    if (!increment.hasPlan) {
      findings.push({ increment: increment.name, level: "error", message: "missing plan.md" });
    }
    if (!increment.hasTasks) {
      findings.push({ increment: increment.name, level: "error", message: "missing tasks.md" });
    }
    if (capped && increment.hasPlan) {
      if (increment.planReviewCap === null) {
        findings.push({
          increment: increment.name,
          level: "error",
          message: "plan.md has no **Review cap:** line",
        });
      } else if (!CAP_PLAN_VALUE.test(increment.planReviewCap)) {
        findings.push({
          increment: increment.name,
          level: "error",
          message: "plan.md **Review cap:** value does not open with a count",
        });
      }
    }
    if (!increment.hasAar) {
      findings.push({ increment: increment.name, level: "error", message: "missing aar.md" });
      continue;
    }
    if (capped) {
      if (increment.aarReviewCap === null) {
        findings.push({
          increment: increment.name,
          level: "error",
          message: "aar.md has no **Review cap:** line",
        });
      } else if (!CAP_AAR_VALUE.test(increment.aarReviewCap)) {
        findings.push({
          increment: increment.name,
          level: "error",
          message: "aar.md **Review cap:** line does not record `used <n> passes`",
        });
      }
    }
    if (!increment.loopToken) {
      findings.push({
        increment: increment.name,
        level: "error",
        message: "aar.md has no LOOP PAUSED / LOOP OPEN terminal token",
      });
    } else if (
      increment.loopToken === "LOOP OPEN" &&
      options.requirePausedFor === increment.name
    ) {
      findings.push({
        increment: increment.name,
        level: "error",
        message:
          "aar.md reports LOOP OPEN — give every finding a terminal disposition, then re-run after-action-report",
      });
    }
    if (increment.hasPlan && !increment.doneBar) {
      findings.push({
        increment: increment.name,
        level: "warning",
        message: "plan.md has no **Done bar:** line",
      });
    }
    if (increment.name.slice(0, 10) >= LENGTH_BUDGET_FROM) {
      if ((increment.planLines ?? 0) > PLAN_MAX_LINES) {
        findings.push({
          increment: increment.name,
          level: "warning",
          message: `plan.md is ${increment.planLines} lines (budget ${PLAN_MAX_LINES}); a plan is a decision record, not an essay`,
        });
      }
      if ((increment.aarLines ?? 0) > AAR_MAX_LINES) {
        findings.push({
          increment: increment.name,
          level: "warning",
          message: `aar.md is ${increment.aarLines} lines (budget ${AAR_MAX_LINES}); generate the evidence block instead of narrating it`,
        });
      }
    }
  }
  return findings;
}

/** capSubject — true when the increment is dated at or after the cap contract. */
function capSubject(name: string): boolean {
  if (nameProblem(name) !== null) return false;
  return name.slice(0, 10) >= CAP_CONTRACT_FROM;
}

/** nameProblem — the naming rule, or null when the directory name is valid. */
export function nameProblem(name: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}-[a-z0-9-]+$/.test(name)) {
    return "increment directory must be <YYYY-MM-DD>-<slug> (lowercase, hyphenated)";
  }
  return null;
}

/** newestIncrement — the most recently dated increment, or null. */
export function newestIncrement(root: string): Increment | null {
  const increments = listIncrements(root);
  return increments.length === 0 ? null : increments[increments.length - 1];
}
