// tool-defaults.test.ts — fixture-driven tests for the REQ-080 reconciliation.
// Role: test.
//
// The shipped-tree case reads infobroker.md, src/index.ts, and config.json, so
// a default that drifts in any of the three layers fails here before it fails
// in a release. The fixture cases prove each failure class, one per seeded
// divergence.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DECLARED_DEFAULTS, reconcile, schemaParam, unreconciledSpecDefaults } from "./tool-defaults.js";

const ROOT = join(import.meta.dirname, "..", "..");

const SPEC = `## §4 Requirements

**REQ-020 — \`search_web\`**
Parameters: \`max_results\` (default 8, max 30), \`page\` (default 1), \`safe_search\` (default on), \`content_type\` (default all), and the flags \`suggest\`, \`expand\`, \`research\`, \`fresh\`, \`deep\`, and \`analyze\` (each default false).

**REQ-021 — \`fetch_page\`**
Parameters: \`max_length\` (default 50000).

**REQ-026 — \`verify_claims\`**
Parameters: \`max_iterations\` (default 5, max 10), \`confidence_threshold\` (default 0.8).

**REQ-027 — \`get_citations\`**
Parameters: \`max_results\` (default 8, max 30).

**REQ-060a — \`manage_kb\` search action**
The tool SHALL accept a maximum-results count (default 8, max 50).

## §5 Build Process
`;

const SCHEMA = `  server.registerTool("infobroker_search_web", {
    inputSchema: {
      max_results: z.number().min(1).max(30).optional().default(8),
      page: z.number().optional().default(1),
      safe_search: z.string().optional().default("on"),
      content_type: z.string().optional().default("all"),
      suggest: z.boolean().optional().default(false),
      expand: z.boolean().optional().default(false),
      research: z.boolean().optional().default(false),
      fresh: z.boolean().optional().default(false),
      deep: z.boolean().optional().default(false),
      analyze: z.boolean().optional().default(false),
    },
  });
  server.registerTool("infobroker_fetch_page", {
    inputSchema: {
      max_length: z.number().optional().default(50000),
    },
  });
  server.registerTool("infobroker_verify_claims", {
    inputSchema: {
      max_iterations: z.number().min(1).max(10).optional().default(5),
      confidence_threshold: z.number().min(0).max(1).optional().default(0.8),
    },
  });
  server.registerTool("infobroker_get_citations", {
    inputSchema: {
      max_results: z.number().min(1).max(30).optional().default(8),
    },
  });
  server.registerTool("infobroker_manage_kb", {
    inputSchema: {
      max_results: z.number().min(1).max(50).optional().default(8),
    },
  });
`;

const CONFIG = {
  output: { max_chars: 50000 },
  kb: { max_results: 50 },
  corroboration: { max_iterations: 5, confidence_threshold: 0.8 },
};

describe("REQ-080 tool defaults", () => {
  it("reads each parameter's default, minimum, and maximum", () => {
    expect(schemaParam(SCHEMA, "search_web", "max_results")).toEqual({ default: 8, minimum: 1, maximum: 30 });
    expect(schemaParam(SCHEMA, "search_web", "safe_search")).toEqual({ default: "on" });
    expect(schemaParam(SCHEMA, "fetch_page", "max_length")).toEqual({ default: 50000 });
  });

  it("reconciles a matching spec, schema, and config", () => {
    expect(reconcile({ spec: SPEC, schemaSource: SCHEMA, config: CONFIG })).toEqual([]);
    expect(unreconciledSpecDefaults(SPEC)).toEqual([]);
  });

  it("fails a numeric default that diverges from the schema", () => {
    const schema = SCHEMA.replace(
      "max_results: z.number().min(1).max(30).optional().default(8),",
      "max_results: z.number().min(1).max(30).optional().default(10),",
    );
    const problems = reconcile({ spec: SPEC, schemaSource: schema, config: CONFIG });
    expect(problems.join("\n")).toContain("search_web.max_results schema default 10 diverges");
  });

  it("fails a literal default that diverges from the schema", () => {
    const schema = SCHEMA.replace("suggest: z.boolean().optional().default(false),", "suggest: z.boolean().optional().default(true),");
    const problems = reconcile({ spec: SPEC, schemaSource: schema, config: CONFIG });
    expect(problems.join("\n")).toContain("search_web.suggest schema default true diverges");
  });

  it("fails a declaration that no entry claims", () => {
    const spec = SPEC.replace(
      "The tool SHALL accept a maximum-results count (default 8, max 50).",
      "The tool SHALL accept a maximum-results count (default 8, max 50) and a depth (default 3).",
    );
    expect(unreconciledSpecDefaults(spec).join("\n")).toContain("declares a default (default 3)");
  });

  it("fails a multi-parameter clause that no entry claims", () => {
    const spec = SPEC.replace(
      "**REQ-060a — `manage_kb` search action**",
      "**REQ-060a — `manage_kb` search action**\nThe tool SHALL expose the flags `a`, `b` (each default true).",
    );
    expect(unreconciledSpecDefaults(spec).join("\n")).toContain("declares a default (each default true)");
  });

  it("fails a config value that diverges from the tool limit", () => {
    const config = { ...CONFIG, kb: { max_results: 20 } };
    const problems = reconcile({ spec: SPEC, schemaSource: SCHEMA, config });
    expect(problems.join("\n")).toContain("config kb.max_results is 20 but manage_kb.max_results maximum is 50");
  });

  it("fails a parameter the declaration names but the schema does not default", () => {
    const schema = SCHEMA.replace("      page: z.number().optional().default(1),\n", "      page: z.number().optional(),\n");
    const problems = reconcile({ spec: SPEC, schemaSource: schema, config: CONFIG });
    expect(problems.join("\n")).toContain("search_web.page applies no schema default");
  });

  it("reconciles the shipped spec, registration source, and config", () => {
    const spec = readFileSync(join(ROOT, "infobroker.md"), "utf-8");
    const schemaSource = readFileSync(join(ROOT, "src", "index.ts"), "utf-8");
    const config = JSON.parse(readFileSync(join(ROOT, "config.json"), "utf-8")) as unknown;
    expect(reconcile({ spec, schemaSource, config })).toEqual([]);
    // One entry per declaration in the shipped spec: a new declaration without
    // an entry fails the suite above, and this keeps the count honest.
    expect(DECLARED_DEFAULTS).toHaveLength(10);
  });
});
