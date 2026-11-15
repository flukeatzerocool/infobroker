// @implements REQ-131 task-type-supplied
// @implements REQ-131 task-type-inferred
// @implements REQ-131a audience-accepted
// @implements REQ-131a audience-absent
// direction.test.ts — the direction block reports what the request executed and
// marks what the server chose, and the audience vocabulary has one source.

import { describe, expect, it } from "vitest";
import { buildDirection, isReportAudience, REPORT_AUDIENCES } from "./direction.js";

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

describe("audience vocabulary", () => {
  it("accepts exactly the report quality standard's values", () => {
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
