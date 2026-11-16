// @implements REQ-131 task-type-supplied
// @implements REQ-131 task-type-inferred
// @implements REQ-131 offer-choice no-serving-provider
// @implements REQ-020a precedence
// @implements REQ-131a audience-accepted
// @implements REQ-131a audience-absent
// direction.test.ts — the direction block reports what the request executed and
// marks what the server chose, and the audience vocabulary has one source.

import { describe, expect, it } from "vitest";
import { ambiguousRequirements, buildDirection, isReportAudience, REPORT_AUDIENCES } from "./direction.js";

const BASE = {
  taskType: "general_web",
  maxResults: 8,
  deep: false,
  research: false,
  providers: ["duckduckgo", "wikipedia"],
};

describe("buildDirection", () => {
  it("marks an inferred task type and reports the provider pool", () => {
    const direction = buildDirection(BASE);
    expect(direction.task_type).toBe("general_web");
    expect(direction.task_type_source).toBe("inferred");
    expect(direction.inferred).toEqual(["task_type"]);
    expect(direction.providers_considered).toEqual(["duckduckgo", "wikipedia"]);
  });

  it("marks a supplied task type and infers nothing", () => {
    const direction = buildDirection({ ...BASE, taskTypeOverride: "academic" });
    expect(direction.task_type_source).toBe("supplied");
    expect(direction.inferred).toEqual([]);
  });

  it("derives depth from the reading flags", () => {
    expect(buildDirection(BASE).depth).toBe("results");
    expect(buildDirection({ ...BASE, deep: true }).depth).toBe("deep");
    expect(buildDirection({ ...BASE, research: true, deep: true }).depth).toBe("research");
  });

  it("echoes a supplied audience and language, and omits an absent audience", () => {
    const withBoth = buildDirection({ ...BASE, audience: "analyst", language: "de" });
    expect(withBoth.audience).toBe("analyst");
    expect(withBoth.language).toBe("de");
    expect("audience" in buildDirection(BASE)).toBe(false);
  });
});

describe("audience vocabulary", () => {  it("accepts exactly the report quality standard's values", () => {
    expect([...REPORT_AUDIENCES]).toEqual([
      "executive",
      "analyst",
      "engineer",
      "policy",
      "legal",
      "journalist",
      "investor",
    ]);
  });

  it("rejects an unknown audience", () => {
    expect(isReportAudience("analyst")).toBe(true);
    expect(isReportAudience("academic")).toBe(false);
  });
});

describe("deferred choice (REQ-131)", () => {
  // A chain resolver stands in for getDispatchChain so the rule is testable
  // without configuration or providers.
  const chains =
    (map: Record<string, string[]>) =>
    (taskType: string): string[] =>
      map[taskType] ?? [];

  it("offers the choice, names both candidates, and reports no serving provider on an equal-support tie", () => {
    const candidates = ambiguousRequirements(
      [
        { taskType: "news", score: 3 },
        { taskType: "academic", score: 3 },
      ],
      chains({ news: ["gdelt"], academic: ["arxiv", "crossref"] }),
      2,
    );
    expect(candidates).toEqual([
      { task_type: "news", providers: ["gdelt"] },
      { task_type: "academic", providers: ["arxiv", "crossref"] },
    ]);

    const direction = buildDirection({ ...BASE, ambiguousCandidates: candidates ?? [] });
    expect(direction.task_type).toBe("undetermined");
    expect(direction.ambiguous).toBe(true);
    expect(direction.candidates).toHaveLength(2);
    // No executed provider, so no serving provider can be reported.
    expect("serving_provider" in direction).toBe(false);
  });

  it("gives REQ-131 precedence only on an equal-support tie, so a clear winner still classifies", () => {
    const resolve = chains({ news: ["gdelt"], academic: ["arxiv"] });
    expect(ambiguousRequirements([{ taskType: "news", score: 3 }, { taskType: "academic", score: 2 }], resolve, 2)).toBeNull();
    expect(ambiguousRequirements([{ taskType: "news", score: 3 }], resolve, 2)).toBeNull();
    // A tie on one chain is one requirement, not a choice.
    expect(
      ambiguousRequirements(
        [
          { taskType: "news", score: 3 },
          { taskType: "academic", score: 3 },
        ],
        chains({ news: ["gdelt", "duckduckgo"], academic: ["gdelt", "duckduckgo"] }),
        2,
      ),
    ).toBeNull();
    // A type with no usable provider cannot be offered.
    expect(
      ambiguousRequirements(
        [
          { taskType: "news", score: 3 },
          { taskType: "academic", score: 3 },
        ],
        chains({ news: ["gdelt"] }),
        2,
      ),
    ).toBeNull();
    // Below the floor is not a candidate at all.
    expect(
      ambiguousRequirements(
        [
          { taskType: "news", score: 1 },
          { taskType: "academic", score: 1 },
        ],
        chains({ news: ["gdelt"], academic: ["arxiv"] }),
        2,
      ),
    ).toBeNull();
  });
});
