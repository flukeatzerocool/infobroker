// @implements REQ-055
import { describe, it, expect } from "vitest";
import {
  detectClauseRequirements,
  clauseTagsFromPayload,
  evaluateClauseCoverage,
} from "./clause-coverage.js";

describe("detectClauseRequirements", () => {
  it("detects the REQ-013 degraded 'or' branch definition", () => {
    const prose =
      "The server SHALL assess each configured provider's status: `active`, `inactive` (missing key or unreachable), or `degraded` (latency above a configurable threshold or partial results).";
    const req = detectClauseRequirements(prose);
    // "missing key or unreachable" + "latency ... or partial results" = 4 legs
    expect(req.orBranches).toBe(4);
    expect(req.conditionals).toBe(0);
  });

  it("does not treat backticked value unions as behavior branches", () => {
    const prose =
      'Every tool response SHALL be a JSON object with `status` (`"ok"` or `"error"`).';
    const req = detectClauseRequirements(prose);
    expect(req.orBranches).toBe(0);
  });

  it("detects the REQ-003 'when ... declares' dead conditional", () => {
    const prose =
      "All providers SHALL return results with the original source when the serving provider or its configuration declares the result is aggregated or resold.";
    const req = detectClauseRequirements(prose);
    expect(req.conditionals).toBeGreaterThanOrEqual(1);
  });

  it("does not flag 'when action is list' routings as declarations", () => {
    const prose = "WHEN action is list, the tool SHALL report every provider.";
    expect(detectClauseRequirements(prose).conditionals).toBe(0);
  });
});

describe("clauseTagsFromPayload", () => {
  it("extracts branch slugs following a REQ ID", () => {
    const tags = clauseTagsFromPayload("REQ-013 REQ-013 latency-threshold REQ-013 partial-results");
    expect(tags.get("REQ-013")).toEqual(new Set(["latency-threshold", "partial-results"]));
  });

  it("ignores a bare REQ ID with no following slug", () => {
    const tags = clauseTagsFromPayload("REQ-014 REQ-003 original-source");
    expect(tags.get("REQ-014")).toBeUndefined();
    expect(tags.get("REQ-003")).toEqual(new Set(["original-source"]));
  });
});

describe("evaluateClauseCoverage (regression guard)", () => {
  const orphanBranches = { orBranches: 2, conditionals: 0 };
  const deadConditional = { orBranches: 0, conditionals: 1 };

  it("fails an 'or' REQ with fewer than 2 tagged branches", () => {
    expect(evaluateClauseCoverage("REQ-013", orphanBranches, 1)).toEqual({
      reqId: "REQ-013",
      kind: "or-branches",
    });
  });

  it("passes an 'or' REQ with both branches tagged", () => {
    expect(evaluateClauseCoverage("REQ-013", orphanBranches, 2)).toBeNull();
  });

  it("fails a conditional REQ with no tagged clause", () => {
    expect(evaluateClauseCoverage("REQ-003", deadConditional, 0)).toEqual({
      reqId: "REQ-003",
      kind: "conditional",
    });
  });

  it("passes a conditional REQ with a tagged clause", () => {
    expect(evaluateClauseCoverage("REQ-003", deadConditional, 1)).toBeNull();
  });

  it("leaves single-lineage REQs (no branches, no conditional) untouched", () => {
    expect(evaluateClauseCoverage("REQ-004", { orBranches: 0, conditionals: 0 }, 0)).toBeNull();
  });
});
