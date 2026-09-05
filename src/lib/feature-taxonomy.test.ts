// @implements REQ-078
import { describe, it, expect } from "vitest";
import {
  deriveFeatureAreas,
  reconcileReadmeFeatures,
  USER_FACING_GROUPS,
} from "./feature-taxonomy.js";

const SPEC_TAXONOMY = `## §D Appendix: Feature Taxonomy

| # | Feature area | Tools | Primary REQs | Gate |
|---|--------------|-------|--------------|------|
| 1 | Core Retrieval | \`web_search\`, \`fetch_page\`, \`get_citations\` | REQ-003 | G0, G1 |
| 2 | Provider Intelligence | \`inspect_providers\` | REQ-010 | G0, G1 |
| 3 | Corroboration | \`verify_claims\` | REQ-026 | G0, G1 |
| 4 | Knowledge Base | \`manage_kb\` | REQ-060 | G0, G1 |
| 5 | State & Operations | \`reload_config\` | REQ-033 | G0, G1 |
| 6 | Tool Surface & Contracts | (all 7 tools) | REQ-001 | G0 |
| 7 | Client Artifacts | (no tools) | REQ-050 | G3 |
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
        expect.stringContaining("7 'Client Artifacts'"),
      ]),
    );
  });

  it("does not require the maintainer-only groups 6 and 8", () => {
    expect(USER_FACING_GROUPS.has(6)).toBe(false);
    expect(USER_FACING_GROUPS.has(8)).toBe(false);
  });
});
