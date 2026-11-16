// @implements REQ-078
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import {
  checkFeatureTaxonomyCoverage,
  deriveFeatureAreas,
  parseFeatureTaxonomy,
  parseManifestGates,
  reconcileReadmeFeatures,
  USER_FACING_GROUPS,
} from "./feature-taxonomy.js";

const SPEC_TAXONOMY = `## §D Appendix: Feature Taxonomy

| # | Feature area | Tools | Primary REQs | Gate |
|---|--------------|-------|--------------|------|
| 1 | Direction & Retrieval | \`search_web\`, \`fetch_page\`, \`get_citations\` | REQ-003 | G0, G1 |
| 2 | Provider Intelligence | \`inspect_providers\` | REQ-010 | G0, G1 |
| 3 | Corroboration | \`verify_claims\` | REQ-026 | G0, G1 |
| 4 | Knowledge Base | \`manage_kb\` | REQ-060 | G0, G1 |
| 5 | State & Operations | \`reload_config\` | REQ-033 | G0, G1 |
| 6 | Tool Surface & Contracts | (all 7 tools) | REQ-001 | G0 |
| 7 | Dissemination & Report Contract | (no tools) | REQ-050 | G3 |
| 8 | Spec Governance | (no tools) | REQ-055 | G3 |
`;

function readme(featureSections: string[]): string {
  return `# Infobroker

## MCP Server

${featureSections.map((t) => `### ${t}\n\nBody for ${t}.\n`).join("")}
## Skills

Skill stuff.
`;
}

describe("deriveFeatureAreas", () => {
  it("parses all eight §D groups with names", () => {
    const areas = deriveFeatureAreas(SPEC_TAXONOMY);
    expect(areas.map((a) => a.group)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(areas.find((a) => a.group === 4)?.name).toBe("Knowledge Base");
  });

  it("returns an empty list when §D is absent", () => {
    expect(deriveFeatureAreas("no taxonomy here")).toEqual([]);
  });
});

describe("reconcileReadmeFeatures", () => {
  const areas = deriveFeatureAreas(SPEC_TAXONOMY);

  it("passes when every user-facing group is covered by a mapped section", () => {
    const text = readme([
      "Unified Search",
      "Content Extraction",
      "Citations",
      "Provider Intelligence",
      "Multi-Source Verification",
      "Knowledge Base",
      "Research Pipeline",
      "Operational Visibility",
    ]);
    expect(reconcileReadmeFeatures(text, areas)).toEqual([]);
  });

  it("flags a feature section with no §D group (invented feature)", () => {
    const text = readme([
      "Unified Search",
      "Content Extraction",
      "Citations",
      "Provider Intelligence",
      "Multi-Source Verification",
      "Knowledge Base",
      "Research Pipeline",
      "Operational Visibility",
      "Teleportation",
    ]);
    const issues = reconcileReadmeFeatures(text, areas);
    expect(issues.some((i) => /Teleportation/.test(i.msg) && i.error)).toBe(true);
  });

  it("flags a user-facing §D group that the README does not cover", () => {
    const text = readme(["Unified Search", "Content Extraction", "Citations", "Provider Intelligence"]);
    const issues = reconcileReadmeFeatures(text, areas);
    const missing = issues.filter((i) => /not covered by the README feature tour/.test(i.msg));
    expect(missing.map((i) => i.msg)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("3 'Corroboration'"),
        expect.stringContaining("4 'Knowledge Base'"),
        expect.stringContaining("5 'State & Operations'"),
        expect.stringContaining("7 'Dissemination & Report Contract'"),
      ]),
    );
  });

  it("does not require the maintainer-only groups 6 and 8", () => {
    expect(USER_FACING_GROUPS.has(6)).toBe(false);
    expect(USER_FACING_GROUPS.has(8)).toBe(false);
  });
});

describe("checkFeatureTaxonomyCoverage (REQ-078)", () => {
  const LIVE = readFileSync(join(import.meta.dirname, "../../infobroker.md"), "utf-8");
  const LIVE_GATES = parseManifestGates(LIVE);
  const LIVE_ROWS = parseFeatureTaxonomy(LIVE);
  // Derived once from the unmutated text: a fixture may delete a §9.5 row, and
  // re-deriving from the mutated text would shrink the scope it is testing.
  const TOOLS = LIVE_ROWS.flatMap((row) => row.tools);
  const REQS = [...LIVE_GATES.keys()];

  const run = (spec: string): string[] => checkFeatureTaxonomyCoverage(spec, TOOLS, REQS);

  function mutate(anchor: string, replacement: string): string {
    if (!LIVE.includes(anchor)) {
      throw new Error(`fixture premise missing: ${anchor}`);
    }
    return LIVE.replace(anchor, replacement);
  }

  const rowFor = (spec: string, group: number): string => {
    const row = spec.split("\n").find((line) => line.startsWith(`| ${group} |`));
    if (!row) throw new Error(`fixture premise missing: group ${group} row`);
    return row;
  };

  const group = (n: number) => LIVE_ROWS.find((row) => row.group === n)!;

  it("passes the live spec", () => {
    expect(run(LIVE)).toEqual([]);
  });

  it("reports a REQ listed in two groups", () => {
    // REQ-073 is G1 (group 1), which group 2 also carries, so only the home is wrong.
    const gates = LIVE_GATES.get("REQ-073")!;
    expect(gates.every((g) => group(2).gates.includes(g))).toBe(true);
    const spec = mutate("| REQ-010, REQ-011, REQ-013,", "| REQ-073, REQ-010, REQ-011, REQ-013,");
    expect(run(spec)).toEqual([
      "Feature taxonomy (§D) group 1 'Direction & Retrieval': REQ-073 also appears in group 2 — exactly one home required",
    ]);
  });

  it("reports a tool listed in two groups", () => {
    const spec = mutate(
      "`search_web`, `fetch_page`, `get_citations`",
      "`search_web`, `fetch_page`, `get_citations`, `inspect_providers`",
    );
    expect(run(spec)).toEqual([
      "Feature taxonomy (§D) group 1 'Direction & Retrieval': tool `inspect_providers` also appears in group 2 — exactly one home required",
    ]);
  });

  it("reports a Gate cell that drops a member's gate", () => {
    const spec = mutate(
      "REQ-090, REQ-092, REQ-106 | G0, G1, G3 |",
      "REQ-090, REQ-092, REQ-106 | G0 |",
    );
    expect(run(spec)).toEqual([
      "Feature taxonomy (§D) group 6 'Tool Surface & Contracts': Gate [G0] does not match its REQs' manifest gates [G0, G1, G3]",
    ]);
  });

  it("reports a REQ added to a second, gate-consistent group", () => {
    expect(group(8).gates).toEqual(["G3"]);
    expect(LIVE_GATES.get("REQ-125")).toEqual(["G1", "G3"]);
    const spec = mutate(
      "REQ-055, REQ-077, REQ-078, REQ-080 | G3 |",
      "REQ-055, REQ-077, REQ-078, REQ-080, REQ-125 | G1, G3 |",
    );
    expect(run(spec)).toEqual([
      "Feature taxonomy (§D) group 7 'Dissemination & Report Contract': REQ-125 also appears in group 8 — exactly one home required",
    ]);
  });

  it("reports a REQ whose §9.5 row is absent", () => {
    const others = group(7).reqs.filter((req) => req !== "REQ-125" && req !== "REQ-134");
    expect(others.every((req) => (LIVE_GATES.get(req) ?? []).join(",") === "G3")).toBe(true);
    let spec = mutate("| REQ-125 | Watchlist Monitoring Runner | 4.7 | G1, G3 |\n", "");
    spec = spec.replace(
      "REQ-120a, REQ-125, REQ-126 | G1, G3 |",
      "REQ-120a, REQ-125, REQ-126 | G3 |",
    );
    expect(run(spec)).toEqual([
      "Feature taxonomy (§D) group 7 'Dissemination & Report Contract': REQ-125 declares no gate in §9.5",
    ]);
  });

  it("accepts a Gate cell in any order", () => {
    const spec = mutate("REQ-102, REQ-138 | G0, G1, G3 |", "REQ-102, REQ-138 | G3, G1, G0 |");
    expect(run(spec)).toEqual([]);
  });

  it("reports a duplicated group number once", () => {
    const row = rowFor(LIVE, 3);
    const spec = LIVE.replace(row, `${row}\n${row}`);
    expect(run(spec)).toEqual(["Feature taxonomy (§D): group 3 appears more than once"]);
  });

  it("reports a REQ whose §9.5 gate cell is empty", () => {
    let spec = mutate(
      "| REQ-125 | Watchlist Monitoring Runner | 4.7 | G1, G3 |",
      "| REQ-125 | Watchlist Monitoring Runner | 4.7 | |",
    );
    spec = spec.replace(
      "REQ-120a, REQ-125, REQ-126 | G1, G3 |",
      "REQ-120a, REQ-125, REQ-126 | G3 |",
    );
    expect(run(spec)).toEqual([
      "Feature taxonomy (§D) group 7 'Dissemination & Report Contract': REQ-125 declares no gate in §9.5",
    ]);
  });

  it("reports a row with no REQs that declares a gate", () => {
    const row = rowFor(LIVE, 9);
    const spec = LIVE.replace(row, `${row}\n| 12 | Empty | (no tools) | | G1 |`);
    expect(run(spec)).toEqual([
      "Feature taxonomy (§D) group 12 'Empty': Gate [G1] does not match its REQs' manifest gates []",
    ]);
  });
});
