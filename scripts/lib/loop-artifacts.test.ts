// loop-artifacts.test — unit tests for the increment artifact contract. Role: test.
//
// Each case builds a throwaway record tree, so the contract is tested
// without depending on the repository's own increments.

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_INCREMENTS_DIR,
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
  const dir = join(root, DEFAULT_INCREMENTS_DIR, name);
  mkdirSync(dir, { recursive: true });
  for (const [key, content] of Object.entries(files)) {
    if (content === undefined) continue;
    writeFileSync(join(dir, `${key}.md`), content);
  }
}

const PLAN = "# Plan\n\n**Done bar:** the gate is green.\n";
const TASKS = "# Tasks\n\n1. [x] done\n";
const AAR = "# AAR\n\nLOOP PAUSED\n";

beforeEach(() => {
  delete process.env.INFOBROKER_PLANS_DIR;
});

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

  it("ignores an earlier prose mention of the other token", () => {
    const root = makeRoot();
    writeIncrement(root, "2026-11-14-mention", {
      plan: PLAN,
      tasks: TASKS,
      aar: [
        "# AAR",
        "",
        "| Finding | Disposition |",
        "|---|---|",
        "| The gate fails before `aar.md` exists | Seeded `LOOP OPEN` before commit 1 |",
        "",
        "LOOP PAUSED",
        "",
      ].join("\n"),
    });
    expect(listIncrements(root)[0]?.loopToken).toBe("LOOP PAUSED");
  });

  it("accepts a terminal token whose sentence wraps", () => {
    const root = makeRoot();
    writeIncrement(root, "2026-11-07-wrapped", {
      plan: PLAN,
      tasks: TASKS,
      aar: "# AAR\n\nLOOP PAUSED — gates green, the roadmap item is closed, and\nno new action item is open.\n",
    });
    expect(listIncrements(root)[0]?.loopToken).toBe("LOOP PAUSED");
  });

  it("accepts a backticked terminal token", () => {
    const root = makeRoot();
    writeIncrement(root, "2026-11-07-backtick", {
      plan: PLAN,
      tasks: TASKS,
      aar: "# AAR\n\n`LOOP PAUSED` — gates green.\n",
    });
    expect(listIncrements(root)[0]?.loopToken).toBe("LOOP PAUSED");
  });

  it("takes the last token when both appear", () => {
    const root = makeRoot();
    writeIncrement(root, "2026-11-07-both", {
      plan: PLAN,
      tasks: TASKS,
      aar: "# AAR\n\nHistorically this was LOOP OPEN.\n\nLOOP PAUSED\n",
    });
    expect(listIncrements(root)[0]?.loopToken).toBe("LOOP PAUSED");
  });

  it("errors on LOOP OPEN when that increment is being closed", () => {
    const root = makeRoot();
    writeIncrement(root, "2026-11-07-open", {
      plan: PLAN,
      tasks: TASKS,
      aar: "# AAR\n\nLOOP OPEN — one scheduled action.\n",
    });
    expect(validateIncrements(root, { requirePausedFor: "2026-11-07-open" })).toEqual([
      {
        increment: "2026-11-07-open",
        level: "error",
        message:
          "aar.md reports LOOP OPEN — give every finding a terminal disposition, then re-run after-action-report",
      },
    ]);
  });

  it("does not error on another increment's LOOP OPEN", () => {
    const root = makeRoot();
    writeIncrement(root, "2026-11-07-open", {
      plan: PLAN,
      tasks: TASKS,
      aar: "# AAR\n\nLOOP OPEN — one scheduled action.\n",
    });
    writeIncrement(root, "2026-11-08-paused", { plan: PLAN, tasks: TASKS, aar: AAR });
    expect(validateIncrements(root, { requirePausedFor: "2026-11-08-paused" })).toEqual([]);
  });

  it("still reports a missing token rather than LOOP OPEN when named", () => {
    const root = makeRoot();
    writeIncrement(root, "2026-11-07-partial", { plan: PLAN, tasks: TASKS, aar: "# AAR\n\nstill going\n" });
    expect(validateIncrements(root, { requirePausedFor: "2026-11-07-partial" })).toEqual([
      {
        increment: "2026-11-07-partial",
        level: "error",
        message: "aar.md has no LOOP PAUSED / LOOP OPEN terminal token",
      },
    ]);
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

  it("reads the Done bar from its declaration line, not a quotation in prose", () => {
    const root = makeRoot();
    writeIncrement(root, "2026-11-07-quoted", {
      plan: "# Plan\n\nThis plan mentions `**Done bar:**` in prose.\n\n**Done bar:** the gate is green.\n",
      tasks: TASKS,
      aar: AAR,
    });
    expect(newestIncrement(root)?.doneBar).toBe("the gate is green.");
    expect(validateIncrements(root)).toEqual([]);
  });

  it("reports no Done bar when the marker appears only inside prose", () => {
    const root = makeRoot();
    writeIncrement(root, "2026-11-07-inline", {
      plan: "# Plan\n\nThis plan only mentions `**Done bar:**` inline.\n",
      tasks: TASKS,
      aar: AAR,
    });
    expect(listIncrements(root)[0]?.doneBar).toBeNull();
    expect(validateIncrements(root)).toEqual([
      { increment: "2026-11-07-inline", level: "warning", message: "plan.md has no **Done bar:** line" },
    ]);
  });

  it("rejects a directory name that is not dated and hyphenated", () => {
    expect(nameProblem("loop-and-gates")).toContain("<YYYY-MM-DD>-<slug>");
    expect(nameProblem("2026-11-07-Loop")).toContain("<YYYY-MM-DD>-<slug>");
    expect(nameProblem("2026-11-07-loop-and-gates")).toBeNull();
  });
});

const CAP_VALUE = "1 cold pass; used 2 passes";
const CAPPED_PLAN = `# Plan\n\n**Done bar:** the gate is green.\n**Review cap:** ${CAP_VALUE}\n`;
const CAPPED_AAR = `# AAR\n\n**Review cap:** ${CAP_VALUE}\n\nLOOP PAUSED\n`;

describe("review cap contract", () => {
  it("accepts a capped increment dated at or after the contract", () => {
    const root = makeRoot();
    writeIncrement(root, "2026-11-20-capped", { plan: CAPPED_PLAN, tasks: TASKS, aar: CAPPED_AAR });
    expect(validateIncrements(root)).toEqual([]);
  });

  it("errors when a capped increment's plan omits the review cap", () => {
    const root = makeRoot();
    writeIncrement(root, "2026-11-20-uncapped", { plan: PLAN, tasks: TASKS, aar: CAPPED_AAR });
    expect(validateIncrements(root)).toEqual([
      { increment: "2026-11-20-uncapped", level: "error", message: "plan.md has no **Review cap:** line" },
    ]);
  });

  it("errors when the AAR does not record the review cap", () => {
    const root = makeRoot();
    writeIncrement(root, "2026-11-20-unrecorded", { plan: CAPPED_PLAN, tasks: TASKS, aar: AAR });
    expect(validateIncrements(root)).toEqual([
      { increment: "2026-11-20-unrecorded", level: "error", message: "aar.md has no **Review cap:** line" },
    ]);
  });

  it("errors when the plan cap value does not open with a count", () => {
    const root = makeRoot();
    writeIncrement(root, "2026-11-20-vague", {
      plan: "# Plan\n\n**Done bar:** the gate is green.\n**Review cap:** the usual one\n",
      tasks: TASKS,
      aar: CAPPED_AAR,
    });
    expect(validateIncrements(root)).toEqual([
      {
        increment: "2026-11-20-vague",
        level: "error",
        message: "plan.md **Review cap:** value does not open with a count",
      },
    ]);
  });

  it("errors when the AAR cap line does not record the passes used", () => {
    const root = makeRoot();
    writeIncrement(root, "2026-11-20-noused", {
      plan: CAPPED_PLAN,
      tasks: TASKS,
      aar: "# AAR\n\n**Review cap:** 1 cold pass\n\nLOOP PAUSED\n",
    });
    expect(validateIncrements(root)).toEqual([
      {
        increment: "2026-11-20-noused",
        level: "error",
        message: "aar.md **Review cap:** line does not record `used <n> passes`",
      },
    ]);
  });

  it("grandfathers an increment dated before the contract", () => {
    const root = makeRoot();
    writeIncrement(root, "2026-11-13-old", { plan: PLAN, tasks: TASKS, aar: AAR });
    expect(validateIncrements(root)).toEqual([]);
  });

  it("reports only the missing plan.md for a capped increment without a plan", () => {
    const root = makeRoot();
    writeIncrement(root, "2026-11-20-noplan", { tasks: TASKS, aar: CAPPED_AAR });
    expect(validateIncrements(root)).toEqual([
      { increment: "2026-11-20-noplan", level: "error", message: "missing plan.md" },
    ]);
  });

  it("ignores the cap rules for a directory that is not date-prefixed", () => {
    const root = makeRoot();
    writeIncrement(root, "templates", { plan: PLAN, tasks: TASKS, aar: AAR });
    expect(validateIncrements(root)).toEqual([]);
  });
});
