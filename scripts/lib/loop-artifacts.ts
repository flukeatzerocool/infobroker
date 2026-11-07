// loop-artifacts.ts — increment artifact discovery and validation.
//
// Shared by scripts/check-loop-artifacts.ts (gate) and scripts/session-close.ts
// (entry point) so the increment contract is defined once. Pure filesystem
// reads; no git, no writes.

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

export const INCREMENTS_DIR = "docs/plans";

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
}

/** listIncrements — every directory under docs/plans, oldest first. */
export function listIncrements(root: string): Increment[] {
  const base = join(root, INCREMENTS_DIR);
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
    const token = aar.match(/LOOP PAUSED|LOOP OPEN/);
    const doneBar = plan.match(/\*\*Done bar:?\*\*\s*(.+)/i);
    increments.push({
      name: dir.name,
      dir: path,
      hasPlan,
      hasTasks,
      hasAar,
      loopToken: (token?.[0] as Increment["loopToken"]) ?? null,
      doneBar: doneBar?.[1]?.trim() ?? null,
    });
  }
  return increments.sort((a, b) => a.name.localeCompare(b.name));
}

/** validateIncrements — the contract findings for every increment. */
export function validateIncrements(root: string): Finding[] {
  const findings: Finding[] = [];
  for (const increment of listIncrements(root)) {
    if (!increment.hasPlan) {
      findings.push({ increment: increment.name, level: "error", message: "missing plan.md" });
    }
    if (!increment.hasTasks) {
      findings.push({ increment: increment.name, level: "error", message: "missing tasks.md" });
    }
    if (!increment.hasAar) {
      findings.push({ increment: increment.name, level: "error", message: "missing aar.md" });
      continue;
    }
    if (!increment.loopToken) {
      findings.push({
        increment: increment.name,
        level: "error",
        message: "aar.md has no LOOP PAUSED / LOOP OPEN terminal token",
      });
    }
    if (increment.hasPlan && !increment.doneBar) {
      findings.push({
        increment: increment.name,
        level: "warning",
        message: "plan.md has no **Done bar:** line",
      });
    }
  }
  return findings;
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
