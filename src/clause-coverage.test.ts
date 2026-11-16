// @implements REQ-055
import { describe, it, expect } from "vitest";
import {
  detectClauseRequirements,
  clauseTagsFromPayload,
  evaluateClauseCoverage,
  findUnnamedImperatives,
  bindClauseTags,
} from "./clause-coverage.js";

describe("detectClauseRequirements", () => {
  it("detects the REQ-013 degraded 'or' branch definition", () => {
    const prose =
      "The server SHALL assess each configured provider's status: `active`, `inactive` (missing key or unreachable), `degraded` (latency above a configurable threshold or partial results), or `exhausted` (quota consumed, REQ-034).";
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

describe("clause-coverage detection of unparenthesized class lists", () => {
  const REQ_021A =
    "WHEN `fetch_page` receives a URL whose host resolves to a loopback, private, link-local, or metadata address, the tool SHALL refuse to fetch it and SHALL return an error per REQ-002 unless the configuration permits private-network targets. The guard SHALL be reapplied after each redirect hop.";
  const REQ_021F =
    "WHEN a `fetch_page` renderer returns content that indicates an anti-bot challenge — a verification, CAPTCHA, or challenge page rather than the target page — the tool SHALL treat that renderer as failed.";

  it("counts the four target classes in REQ-021a", () => {
    expect(detectClauseRequirements(REQ_021A).orBranches).toBe(4);
  });

  it("counts the three challenge kinds in REQ-021f", () => {
    expect(detectClauseRequirements(REQ_021F).orBranches).toBe(3);
  });

  it("does not count value unions, conjunctions, or 'such as' enumerations", () => {
    for (const prose of [
      "The response SHALL report a status of High, Medium, or Low.",
      "The assertion SHALL be asserted, reported, or speculative.",
      "WHEN a query names a measurable attribute such as attendance, population, area, elevation, percentage, or date, search SHALL classify it.",
      "The delta SHALL report new, changed, and removed claims.",
      "WHEN the tool receives a value (see REQ-034), it SHALL report it.",
    ]) {
      expect(detectClauseRequirements(prose).orBranches, prose).toBe(0);
    }
  });

  it("sums a parenthesized group and a prose list in one body", () => {
    const prose = `${REQ_021A} It SHALL be refused (unreachable or invalid).`;
    expect(detectClauseRequirements(prose).orBranches).toBe(6);
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

  it("registers the whole slug run after one REQ ID", () => {
    const tags = clauseTagsFromPayload(
      "REQ-020 REQ-021 REQ-021b content-mode full-content-mode match-strong match-moderate match-weak match-none REQ-021k REQ-076a blend"
    );
    expect(tags.get("REQ-021b")).toEqual(
      new Set(["content-mode", "full-content-mode", "match-strong", "match-moderate", "match-weak", "match-none"])
    );
    expect(tags.get("REQ-021k")).toBeUndefined();
    expect(tags.get("REQ-076a")).toEqual(new Set(["blend"]));
    expect(tags.get("REQ-020")).toBeUndefined();
  });
});

describe("bindClauseTags (D5 binding rule)", () => {
  const body = [
    "// @implements REQ-121 short-republish-family",
    'import { describe, it, expect } from "vitest";',
    "",
    "const SEVEN = 7;",
    "const EIGHT = 8;",
    "",
    'describe("family", () => {',
    '  it("counts short republished snippets as one family", () => {',
    "    expect(1).toBe(1);",
    "  });",
    "});",
  ].join("\n");

  it("binds a file-header tag to a test title in the file", () => {
    const [binding] = bindClauseTags(body);
    expect(binding).toMatchObject({ req: "REQ-121", scope: "file", bound: true });
  });

  it("binds a tag placed directly above a block to that block", () => {
    const text = ["describe('x', () => {", "  // @implements REQ-121 short-republish-family", '  it("counts short republished snippets as one family", () => {});', "});"].join("\n");
    const [binding] = bindClauseTags(text);
    expect(binding).toMatchObject({ scope: "block", title: "counts short republished snippets as one family", bound: true });
  });

  it("binds a tag inside a block to the enclosing block", () => {
    const text = ['describe("x", () => {', '  it("does something else entirely", () => {', "    // @implements REQ-121 short-republish-family", "    expect(1).toBe(1);", "  });", "});"].join("\n");
    const [binding] = bindClauseTags(text);
    expect(binding).toMatchObject({ scope: "block", bound: false });
  });

  it("reports an unbound slug whose title never names it", () => {
    const text = ["// @implements REQ-121 short-republish-family", "", "", "", "", 'it("checks an unrelated predicate", () => {});'].join("\n");
    const [binding] = bindClauseTags(text);
    expect(binding).toMatchObject({ scope: "file", bound: false });
  });

  it("does not bind a slug by a single shared word", () => {
    const text = ["// @implements REQ-121 short-republish-family", 'it("reports the family count", () => {});'].join("\n");
    expect(bindClauseTags(text)[0]!.bound).toBe(false);
  });
});

describe("evaluateClauseCoverage (regression guard)", () => {
  const orphanBranches = { orBranches: 2, conditionals: 0, imperativeVerbs: [] };
  const deadConditional = { orBranches: 0, conditionals: 1, imperativeVerbs: [] };

  it("fails an 'or' REQ with fewer than 2 tagged branches", () => {
    expect(evaluateClauseCoverage("REQ-013", orphanBranches, 1)).toEqual({
      reqId: "REQ-013",
      kind: "or-branches",
    });
  });

  it("passes an 'or' REQ with both branches tagged", () => {
    expect(evaluateClauseCoverage("REQ-013", orphanBranches, 2)).toBeNull();
  });

  const threeBranches = { orBranches: 3, conditionals: 0, imperativeVerbs: [] };
  const fourBranches = { orBranches: 4, conditionals: 0, imperativeVerbs: [] };

  it("fails a three-branch REQ with only two tagged branches", () => {
    expect(evaluateClauseCoverage("REQ-900", threeBranches, 2)).toEqual({
      reqId: "REQ-900",
      kind: "or-branches",
    });
  });

  it("passes a three-branch REQ with one tag per branch", () => {
    expect(evaluateClauseCoverage("REQ-900", threeBranches, 3)).toBeNull();
  });

  it("fails a four-branch REQ with three tagged branches", () => {
    expect(evaluateClauseCoverage("REQ-901", fourBranches, 3)).toEqual({
      reqId: "REQ-901",
      kind: "or-branches",
    });
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
    expect(evaluateClauseCoverage("REQ-004", { orBranches: 0, conditionals: 0, imperativeVerbs: [] }, 0)).toBeNull();
  });
});

describe("imperative branch detection (deferral branches)", () => {
  const REQ_131 =
    "WHEN two task types clear the floor with equal support and their chains differ, the tool SHALL offer the choice instead of searching, returning both candidate types.";

  it("detects the REQ-131 'offer the choice instead of searching' branch", () => {
    expect(detectClauseRequirements(REQ_131).imperativeVerbs).toEqual(["offer"]);
  });

  it("does not flag ordinary conditionals or refusal guards", () => {
    expect(
      detectClauseRequirements("WHEN action is list, the tool SHALL report every provider.").imperativeVerbs,
    ).toEqual([]);
    expect(
      detectClauseRequirements(
        "WHEN a URL resolves to a loopback address, the tool SHALL refuse to fetch it.",
      ).imperativeVerbs,
    ).toEqual([]);
  });

  it("requires a tag whose slug names the branch, not merely any tag", () => {
    const req = detectClauseRequirements(REQ_131);
    // Two tags about other aspects of the same REQ do not cover the branch.
    expect(findUnnamedImperatives(req, new Set(["task-type-supplied", "task-type-inferred"]))).toEqual([
      "offer",
    ]);
    expect(findUnnamedImperatives(req, new Set(["task-type-supplied", "offer-choice"]))).toEqual([]);
  });
});
