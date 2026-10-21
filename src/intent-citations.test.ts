// @implements REQ-107
import { describe, it, expect } from "vitest";
import {
  splitToolName,
  extractCitations,
  validateRoutingFiles,
  deriveOperations,
  checkCoverage,
  FILE_PREFIX_POLICY,
  type ToolSchema,
} from "./intent-citations.js";

const schemas = new Map<string, ToolSchema>([
  [
    "search_web",
    {
      slug: "search_web",
      properties: {
        query: { type: "string" },
        provider: { type: "string" },
        suggest: { type: "boolean" },
        expand: { type: "boolean" },
        deep: { type: "boolean" },
        research: { type: "boolean" },
      },
    },
  ],
  [
    "fetch_page",
    {
      slug: "fetch_page",
      properties: {
        url: { type: "string" },
        question: { type: "string" },
        crawl: { type: "boolean" },
        extract: { type: "boolean" },
        detect_date: { type: "boolean" },
      },
    },
  ],
  [
    "inspect_providers",
    {
      slug: "inspect_providers",
      properties: {
        action: { enum: ["list", "health", "spec"] },
        provider: { type: "string" },
      },
    },
  ],
  [
    "manage_kb",
    {
      slug: "manage_kb",
      properties: {
        action: { enum: ["search", "ingest", "list", "get", "stats", "delete", "encryption"] },
        operation: { enum: ["status", "generate_key", "verify", "backup", "rekey"] },
        source_type: { type: "string" },
        max_results: { type: "number" },
      },
    },
  ],
  ["reload_config", { slug: "reload_config", properties: { migrate: { type: "boolean" } } }],
  ["verify_claims", { slug: "verify_claims", properties: { query: { type: "string" } } }],
  ["get_citations", { slug: "get_citations", properties: { query: { type: "string" } } }],
]);

const INSTRUCTION = "instructions/search-preferences.md";
const JOURNEYS = "skills/infobroker/references/journeys.md";

function extract(file: string, markdown: string) {
  return extractCitations(markdown, file, schemas);
}

describe("splitToolName", () => {
  it("recognizes bare, single, and client prefixes", () => {
    expect(splitToolName("search_web")).toEqual({ slug: "search_web", prefix: "bare" });
    expect(splitToolName("infobroker_search_web")).toEqual({ slug: "search_web", prefix: "single" });
    expect(splitToolName("infobroker_infobroker_search_web")).toEqual({
      slug: "search_web",
      prefix: "client",
    });
  });
});

describe("prefix policy", () => {
  it("flags a bare citation in the single-prefixed instruction file", () => {
    const { findings } = extract(INSTRUCTION, "Use `search_web`.");
    expect(findings.map((f) => f.code)).toContain("wrong_prefix");
  });

  it("flags a client-qualified citation in a bare skill file", () => {
    const { findings } = extract(
      JOURNEYS,
      "Use `infobroker_infobroker_search_web`."
    );
    expect(findings.map((f) => f.code)).toContain("wrong_prefix");
  });
});

describe("extractCitations — canonical forms", () => {
  it("accepts a tool-only citation", () => {
    const { citations, findings } = extract(INSTRUCTION, "Use `infobroker_search_web`.");
    expect(findings).toEqual([]);
    expect(citations).toHaveLength(1);
    expect(citations[0].tool).toBe("search_web");
    expect(citations[0].coverage).toEqual([]);
  });

  it("accepts a boolean mode", () => {
    const { citations, findings } = extract(JOURNEYS, "Use `search_web (suggest)`.");
    expect(findings).toEqual([]);
    expect(citations[0].coverage).toEqual(["flag:suggest"]);
  });

  it("accepts an action citation", () => {
    const { citations, findings } = extract(
      INSTRUCTION,
      "Use `infobroker_manage_kb (action: ingest, source_type: report)`."
    );
    expect(findings).toEqual([]);
    expect(citations[0].coverage).toEqual(["action:ingest"]);
    expect(citations[0].params.source_type).toBe("report");
  });

  it("accepts a compound action and operation", () => {
    const { citations, findings } = extract(
      JOURNEYS,
      "Use `manage_kb (action: encryption, operation: rekey)`."
    );
    expect(findings).toEqual([]);
    expect(citations[0].coverage).toEqual(["action:encryption", "operation:rekey"]);
  });
});

describe("extractCitations — prefix policy", () => {
  it("requires the single prefix in the instruction file", () => {
    expect(FILE_PREFIX_POLICY[INSTRUCTION]).toBe("single");
    const { findings } = extract(INSTRUCTION, "Use `search_web`.");
    expect(findings.map((f) => f.code)).toContain("wrong_prefix");
  });

  it("requires bare names in skill files", () => {
    expect(FILE_PREFIX_POLICY[JOURNEYS]).toBe("bare");
    const { findings } = extract(JOURNEYS, "Use `infobroker_search_web`.");
    expect(findings.map((f) => f.code)).toContain("wrong_prefix");
  });

  it("rejects the double prefix in the instruction file", () => {
    const { findings } = extract(INSTRUCTION, "Use `infobroker_infobroker_search_web`.");
    expect(findings.map((f) => f.code)).toContain("wrong_prefix");
  });
});

describe("extractCitations — findings", () => {
  it("flags an unknown prefixed tool in a skill file", () => {
    const { findings } = extract(JOURNEYS, "Use `infobroker_search_webz`.");
    expect(findings.map((f) => f.code)).toContain("unknown_tool");
  });

  it("flags an unknown prefixed tool in the instruction file", () => {
    const { findings } = extract(INSTRUCTION, "Use `infobroker_search_webz`.");
    expect(findings.map((f) => f.code)).toContain("unknown_tool");
  });

  it("does not treat an unknown bare word as a tool citation", () => {
    const { citations, findings } = extract(JOURNEYS, "Use `teleport`.");
    expect(citations).toEqual([]);
    expect(findings).toEqual([]);
  });

  it("flags an unknown operation", () => {
    const { findings } = extract(JOURNEYS, "Use `search_web (teleport)`.");
    expect(findings.map((f) => f.code)).toContain("unknown_operation");
  });

  it("flags an unknown parameter", () => {
    const { findings } = extract(JOURNEYS, "Use `search_web (page: 2)`.");
    expect(findings.map((f) => f.code)).toContain("unknown_parameter");
  });

  it("flags an unknown enum value", () => {
    const { findings } = extract(
      JOURNEYS,
      "Use `inspect_providers (action: teleport)`."
    );
    expect(findings.map((f) => f.code)).toContain("unknown_action");
  });

  it("flags the legacy slash form but still counts coverage", () => {
    const { citations, findings } = extract(
      JOURNEYS,
      "Use `inspect_providers (list / health)`."
    );
    expect(findings.map((f) => f.code)).toContain("legacy_slash");
    expect(citations[0].coverage).toEqual(["action:list", "action:health"]);
  });

  it("flags a bare action that needs the action key", () => {
    const { citations, findings } = extract(JOURNEYS, "Use `manage_kb (search)`.");
    expect(findings.map((f) => f.code)).toContain("missing_action_key");
    expect(citations[0].coverage).toEqual(["action:search"]);
  });
});

describe("coverage", () => {
  it("requires every derived operation", () => {
    const findings = checkCoverage(schemas, []);
    const messages = findings.map((f) => f.message).join("\n");
    expect(messages).toContain("search_web (suggest)");
    expect(messages).toContain("fetch_page (question)");
    expect(messages).toContain("manage_kb (operation: rekey)");
    expect(messages).toContain("reload_config (migrate)");
  });

  it("passes when every operation is cited once", () => {
    const markdown = `
\`search_web (suggest)\`
\`search_web (expand)\`
\`search_web (deep)\`
\`search_web (research)\`
\`fetch_page (question)\`
\`fetch_page (crawl)\`
\`fetch_page (extract)\`
\`fetch_page (detect_date)\`
\`inspect_providers (action: list)\`
\`inspect_providers (action: health)\`
\`inspect_providers (action: spec)\`
\`manage_kb (action: search)\`
\`manage_kb (action: ingest)\`
\`manage_kb (action: list)\`
\`manage_kb (action: get)\`
\`manage_kb (action: stats)\`
\`manage_kb (action: delete)\`
\`manage_kb (action: encryption)\`
\`manage_kb (operation: status)\`
\`manage_kb (operation: generate_key)\`
\`manage_kb (operation: verify)\`
\`manage_kb (operation: backup)\`
\`manage_kb (operation: rekey)\`
\`reload_config (migrate)\`
\`verify_claims\`
\`get_citations\`
\`search_web\`
\`fetch_page\`
\`inspect_providers\`
\`manage_kb\`
\`reload_config\`
`;
    const extracted = extract(JOURNEYS, markdown);
    expect(extracted.findings.filter((f) => f.code !== "missing_operation_key")).toEqual([]);
    expect(checkCoverage(schemas, extracted.citations)).toEqual([]);
  });

  it("requires every registered tool, including one with no derived operations", () => {
    const scalar = new Map<string, ToolSchema>([
      [
        "get_citations",
        {
          slug: "get_citations",
          properties: { query: { type: "string" }, max_results: { type: "number" } },
        },
      ],
    ]);
    const findings = checkCoverage(scalar, []);
    expect(findings.map((f) => f.code)).toEqual(["uncovered_tool"]);
    expect(findings[0].message).toContain("get_citations");
  });

  it("covers the string-mode allowlist without treating other strings as operations", () => {
    const found = deriveOperations(schemas.get("fetch_page")!);
    expect(found.map((o) => o.key)).toContain("string:question");
    expect(found.map((o) => o.key)).not.toContain("string:url");
  });
});

describe("seeded stale fixture", () => {
  it("fails a document with a stale operation", () => {
    const { findings } = extract(JOURNEYS, "Use `search_web (teleport)`.");
    expect(findings.some((f) => f.code === "unknown_operation")).toBe(true);
  });

  it("fails a document with a renamed prefixed tool", () => {
    const { findings } = extract(INSTRUCTION, "Use `infobroker_search_webz`.");
    expect(findings.some((f) => f.code === "unknown_tool")).toBe(true);
  });
});

describe("validateRoutingFiles", () => {
  it("rejects a file without a prefix policy", () => {
    const { findings } = validateRoutingFiles({ "README.md": "`search_web`" }, schemas);
    expect(findings.map((f) => f.code)).toContain("unregistered_file");
  });
});
