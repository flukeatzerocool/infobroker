// @implements REQ-055 REQ-078
// user-surface.test.ts — every check fails for its own reason and the clean
// input passes. Each case changes one input so a hardcoded result cannot pass.

import { describe, expect, it } from "vitest";
import {
  checkUserSurface,
  configPath,
  registerPaths,
  registerableConfigPaths,
  specFunctions,
  type UserSurfaceInput,
} from "./user-surface.js";

const SPEC = `## §1 Mission and Capability Model

Mission.

| Function | Obligation | Evidence |
|---|---|---|
| **Direction** | Derive the requirement. | §7 |
| **Collection** | Reach the sources. | §A |
| **Processing and exploitation** | Normalize into evidence. | REQ-003 |
| **Analysis and production** | Corroborate and calibrate. | REQ-026 |
| **Dissemination** | Deliver the report. | REQ-114 |

## §D Appendix: Feature Taxonomy

| # | Feature area | Tools | Primary REQs | Gate |
|---|---|---|---|---|
| 1 | Core Retrieval | \`search_web\` | REQ-003 | G0 |
| 2 | Provider Intelligence | \`inspect_providers\` | REQ-013 | G0 |
| 3 | Corroboration | \`verify_claims\` | REQ-026 | G0 |
| 4 | Knowledge Base | \`manage_kb\` | REQ-060 | G0 |
| 5 | State & Operations | \`reload_config\` | REQ-040 | G0 |
| 6 | Tool Surface & Contracts | (all 7 tools) | REQ-001 | G0 |
| 7 | Client Artifacts | (no tools) | REQ-050 | G3 |
| 8 | Spec Governance | (no tools) | REQ-055 | G3 |
| 9 | Security & Content Safety | (all 7 tools) | REQ-096 | G0 |
`;

const CONFIG = {
  fetch: { crawl_max_pages: 10 },
  output: { verbose: true },
  kb: { auto_index: true },
};

const REGISTER = [
  "| `fetch.crawl_max_pages` | 10 |",
  "| `output.verbose` | true |",
  "| `kb.auto_index` | true |",
].join("\n");

const MATRIX = [
  "| Function | Group | Scenario |",
  "|---|---|---|",
  "| Direction | 1 | L1 |",
  "| Collection | 1 | L1 |",
  "| Processing and exploitation | 1 | L1 |",
  "| Analysis and production | 3 | L1 |",
  "| Dissemination | 7 | L9 |",
].join("\n");

function base(overrides: Partial<UserSurfaceInput> = {}): UserSurfaceInput {
  return {
    specText: SPEC,
    config: CONFIG,
    personas: [
      { id: "a", feature_groups: [1, 2, 3, 4, 5, 7] },
    ],
    labScenarios: [{ id: "L1", persona: "a" }],
    researchScenarios: [],
    defaultsRegister: REGISTER,
    goalMatrix: MATRIX,
    ...overrides,
  };
}

function codes(input: UserSurfaceInput): string[] {
  return checkUserSurface(input).map((finding) => finding.code);
}

describe("configPath / registerPaths", () => {
  it("resolves a nested path and refuses a missing one", () => {
    expect(configPath(CONFIG, "fetch.crawl_max_pages")).toBe(10);
    expect(configPath(CONFIG, "fetch.missing")).toBeUndefined();
  });

  it("extracts only backticked dotted tokens in a config section", () => {
    expect(registerPaths("`fetch.a` and `c` and `output.d.e` and `config.json`")).toEqual([
      "fetch.a",
      "output.d.e",
    ]);
  });

  it("lists each registerable section and its second-level keys", () => {
    expect(registerableConfigPaths(CONFIG)).toEqual([
      "fetch",
      "fetch.crawl_max_pages",
      "output",
      "output.verbose",
      "kb",
      "kb.auto_index",
    ]);
  });
});

describe("specFunctions", () => {
  it("returns the §1 table rows in order and detects the Evidence column", () => {
    const parsed = specFunctions(SPEC);
    expect(parsed.functions).toEqual([
      "Direction",
      "Collection",
      "Processing and exploitation",
      "Analysis and production",
      "Dissemination",
    ]);
    expect(parsed.hasEvidenceColumn).toBe(true);
  });

  it("reports an absent table rather than falling back to a list", () => {
    expect(specFunctions("# nothing")).toEqual({ functions: [], hasEvidenceColumn: false });
    expect(specFunctions("## §1 Mission and Capability Model\n\n1. **Direction.** No table."))
      .toEqual({ functions: [], hasEvidenceColumn: false });
  });

  it("detects a table without an Evidence column", () => {
    const noEvidence = SPEC.replace("| Function | Obligation | Evidence |", "| Function | Obligation | Gate |");
    expect(specFunctions(noEvidence).hasEvidenceColumn).toBe(false);
  });
});

describe("checkUserSurface", () => {
  it("passes the clean input", () => {
    expect(codes(base())).toEqual([]);
  });

  it("flags a persona group that is not in the taxonomy", () => {
    expect(codes(base({ personas: [{ id: "a", feature_groups: [1, 2, 3, 4, 5, 7, 99] }] })))
      .toContain("persona-group-unknown");
  });

  it("flags an audience-facing group with no persona", () => {
    expect(codes(base({ personas: [{ id: "a", feature_groups: [1] }] }))).toContain("group-uncovered");
  });

  it("flags a persona with no scenario", () => {
    expect(codes(base({ labScenarios: [] }))).toContain("persona-without-scenario");
  });

  it("flags a scenario naming an undeclared persona", () => {
    expect(codes(base({ labScenarios: [{ id: "L1", persona: "ghost" }] })))
      .toContain("scenario-persona-unknown");
  });

  it("flags a config path missing from the register", () => {
    expect(codes(base({ defaultsRegister: "`fetch.crawl_max_pages`" })))
      .toContain("register-missing-path");
  });

  it("flags a register path missing from the config", () => {
    expect(codes(base({ defaultsRegister: `${REGISTER}\n\`fetch.ghost\`` })))
      .toContain("register-unknown-path");
  });

  it("flags a function missing from the matrix", () => {
    expect(codes(base({ goalMatrix: "| Direction |" }))).toContain("function-missing");
  });

  it("flags a table with no Evidence column", () => {
    const noEvidence = SPEC.replace("| Function | Obligation | Evidence |", "| Function | Obligation | Gate |");
    expect(codes(base({ specText: noEvidence }))).toContain("functions-no-evidence");
  });

  it("flags an unparseable taxonomy and function set", () => {
    expect(codes(base({ specText: "# nothing" }))).toEqual(
      expect.arrayContaining(["taxonomy-missing", "functions-unparsed"]),
    );
  });
});
