// loop-artifacts.test — unit tests for the increment artifact contract. Role: test.
//
// Each case builds a throwaway docs/plans tree, so the contract is tested
// without depending on the repository's own increments.

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  INCREMENTS_DIR,
  listIncrements,
  nameProblem,
  newestIncrement,
  validateIncrements,
} from "./loop-artifacts.js";

const roots: string[] = [];

function makeRoot(): string {
  const dir = mkdtempSync(join(tmpdir(), "infobroker-loop-"));
  roots.push(dir);
  return dir;
}

function writeIncrement(
  root: string,
  name: string,
  files: Partial<Record<"plan" | "tasks" | "aar", string>>,
): void {
  const dir = join(root, INCREMENTS_DIR, name);
  mkdirSync(dir, { recursive: true });
  for (const [key, content] of Object.entries(files)) {
    if (content === undefined) continue;
    writeFileSync(join(dir, `${key}.md`), content);
  }
}

const PLAN = "# Plan\n\n**Done bar:** the gate is green.\n";
const TASKS = "# Tasks\n\n1. [x] done\n";
const AAR = "# AAR\n\nLOOP PAUSED\n";

afterEach(() => {
  for (const dir of roots.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("increment artifacts", () => {
  it("accepts a complete increment", () => {
    const root = makeRoot();
    writeIncrement(root, "2026-11-07-loop-and-gates", { plan: PLAN, tasks: TASKS, aar: AAR });
    expect(validateIncrements(root)).toEqual([]);
    expect(newestIncrement(root)?.loopToken).toBe("LOOP PAUSED");
  });

  it("reports a missing tasks file", () => {
    const root = makeRoot();
    writeIncrement(root, "2026-11-07-partial", { plan: PLAN, aar: AAR });
    expect(validateIncrements(root)).toEqual([
      { increment: "2026-11-07-partial", level: "error", message: "missing tasks.md" },
    ]);
  });

  it("reports a missing AAR and does not also report its token", () => {
    const root = makeRoot();
    writeIncrement(root, "2026-11-07-partial", { plan: PLAN, tasks: TASKS });
    const findings = validateIncrements(root);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toBe("missing aar.md");
  });

  it("reports an AAR without a loop token", () => {
    const root = makeRoot();
    writeIncrement(root, "2026-11-07-partial", { plan: PLAN, tasks: TASKS, aar: "# AAR\n\nstill going\n" });
    expect(validateIncrements(root)).toEqual([
      {
        increment: "2026-11-07-partial",
        level: "error",
        message: "aar.md has no LOOP PAUSED / LOOP OPEN terminal token",
      },
    ]);
  });

  it("warns (not errors) when the plan has no Done bar", () => {
    const root = makeRoot();
    writeIncrement(root, "2026-11-07-nobar", { plan: "# Plan\n", tasks: TASKS, aar: AAR });
    const findings = validateIncrements(root);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.level).toBe("warning");
  });

  it("accepts LOOP OPEN as a terminal token", () => {
    const root = makeRoot();
    writeIncrement(root, "2026-11-07-open", {
      plan: PLAN,
      tasks: TASKS,
      aar: "# AAR\n\nLOOP OPEN — one scheduled action.\n",
    });
    expect(validateIncrements(root)).toEqual([]);
    expect(listIncrements(root)[0]?.loopToken).toBe("LOOP OPEN");
  });

  it("sorts increments by date and names the newest", () => {
    const root = makeRoot();
    writeIncrement(root, "2026-11-06-first", { plan: PLAN, tasks: TASKS, aar: AAR });
    writeIncrement(root, "2026-11-07-second", { plan: PLAN, tasks: TASKS, aar: AAR });
    expect(listIncrements(root).map((increment) => increment.name)).toEqual([
      "2026-11-06-first",
      "2026-11-07-second",
    ]);
    expect(newestIncrement(root)?.name).toBe("2026-11-07-second");
  });

  it("returns nothing when the directory is absent", () => {
    const root = makeRoot();
    expect(listIncrements(root)).toEqual([]);
    expect(validateIncrements(root)).toEqual([]);
    expect(newestIncrement(root)).toBeNull();
  });

  it("rejects a directory name that is not dated and hyphenated", () => {
    expect(nameProblem("loop-and-gates")).toContain("<YYYY-MM-DD>-<slug>");
    expect(nameProblem("2026-11-07-Loop")).toContain("<YYYY-MM-DD>-<slug>");
    expect(nameProblem("2026-11-07-loop-and-gates")).toBeNull();
  });
});
