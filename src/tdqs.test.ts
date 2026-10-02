// @implements REQ-106
// Unit tests for the deterministic TDQS layer: score arithmetic, tier mapping,
// invocation-cost traversal, hard gates, shadow prefilter, and server rollups.
// The examples are taken from the TDQS 1.2 spec (https://tdqs.dev/spec).

import { test, expect } from "vitest";
import {
  round1,
  computeTdqs,
  computeQualityTier,
  computeContextSignals,
  hasDescription,
  isTautological,
  isShadowCandidate,
  shadowCandidates,
  computeDescriptionQualityScore,
  computeCoherenceScore,
  computeOverallScore,
  structuralViolations,
  annotationContradictionCandidates,
  type ToolDefinition,
} from "./tdqs.js";

// @implements REQ-106 round1-half-up
test("round1 rounds half-up on the tenths in integer arithmetic", () => {
  expect(round1(285, 100)).toBe(2.9);
  expect(round1(345, 100)).toBe(3.5);
  expect(round1(475, 100)).toBe(4.8);
  expect(round1(100, 100)).toBe(1);
  expect(round1(494, 100)).toBe(4.9);
  expect(round1(115, 100)).toBe(1.2);
});

// @implements REQ-106 weighted-sum
test("computeTdqs matches the worked example", () => {
  const scores = {
    purpose_clarity: 4,
    usage_guidelines: 2,
    behavioral_transparency: 2,
    parameter_semantics: 3,
    conciseness_structure: 4,
    contextual_completeness: 2,
  };
  expect(computeTdqs(scores)).toBe(2.9);
});

// @implements REQ-106 tier-mapping
test("computeQualityTier maps the band boundaries", () => {
  expect(computeQualityTier(5.0)).toBe("A");
  expect(computeQualityTier(3.5)).toBe("A");
  expect(computeQualityTier(3.4)).toBe("B");
  expect(computeQualityTier(3.0)).toBe("B");
  expect(computeQualityTier(2.0)).toBe("C");
  expect(computeQualityTier(1.0)).toBe("D");
  expect(computeQualityTier(0.9)).toBe("F");
});

// @implements REQ-106 invocation-cost
test("computeInvocationCost follows the required-subtree rules", () => {
  const scalar = (): Record<string, unknown> => ({ type: "string" });
  const obj = (props: Record<string, unknown>, required: string[]): Record<string, unknown> => ({
    type: "object",
    properties: props,
    required,
  });

  // Eight flat required scalars: 8 + 0 + 0.
  const eight = obj(Object.fromEntries(Array.from({ length: 8 }, (_, i) => [`f${i}`, scalar()])), Array.from({ length: 8 }, (_, i) => `f${i}`));
  expect(computeContextSignals({ name: "t", inputSchema: eight }).invocationCost).toBe(8);

  // The same eight wrapped in one required object: 9 + 2 + 0.
  const wrapped = obj({ inner: eight }, ["inner"]);
  expect(computeContextSignals({ name: "t", inputSchema: wrapped }).invocationCost).toBe(11);

  // Four flat required scalars: 4 + 0 + 0.
  const four = obj(Object.fromEntries(Array.from({ length: 4 }, (_, i) => [`f${i}`, scalar()])), Array.from({ length: 4 }, (_, i) => `f${i}`));
  expect(computeContextSignals({ name: "t", inputSchema: four }).invocationCost).toBe(4);

  // Root requires an object of three fields, one a three-branch union whose
  // widest branch requires one field: 5 + 2x2 + 2x2 = 13.
  const union = {
    oneOf: [
      obj({ a: scalar() }, ["a"]),
      obj({ b: scalar() }, ["b"]),
      obj({ c: scalar() }, ["c"]),
    ],
  };
  const inner = obj({ a: scalar(), b: scalar(), c: union }, ["a", "b", "c"]);
  const root = obj({ obj: inner }, ["obj"]);
  const signals = computeContextSignals({ name: "t", inputSchema: root });
  expect(signals.requiredFieldCount).toBe(5);
  expect(signals.schemaDepth).toBe(3);
  expect(signals.unionChoiceCount).toBe(2);
  expect(signals.invocationCost).toBe(13);
});

// @implements REQ-106 nullable-union-exclusion
test("nullable unions are not priced as union choices", () => {
  const schema = {
    type: "object",
    properties: { q: { oneOf: [{ type: "string" }, { type: "null" }] } },
    required: ["q"],
  };
  const signals = computeContextSignals({ name: "t", inputSchema: schema });
  expect(signals.unionChoiceCount).toBe(0);
  expect(signals.invocationCost).toBe(1);
});

// @implements REQ-106 array-of-objects-depth
test("arrays of objects add a nesting level; scalar arrays do not", () => {
  const scalarArray = { type: "object", properties: { tags: { type: "array", items: { type: "string" } } }, required: ["tags"] };
  const objectArray = {
    type: "object",
    properties: { rows: { type: "array", items: { type: "object", properties: { x: { type: "string" } }, required: ["x"] } } },
    required: ["rows"],
  };
  expect(computeContextSignals({ name: "t", inputSchema: scalarArray }).schemaDepth).toBe(1);
  expect(computeContextSignals({ name: "t", inputSchema: objectArray }).schemaDepth).toBe(2);
});

// @implements REQ-106 ref-resolution
test("$ref resolves against $defs and recursive schemas terminate", () => {
  const schema: Record<string, unknown> = {
    type: "object",
    properties: { node: { $ref: "#/$defs/node" } },
    required: ["node"],
    $defs: {
      node: {
        type: "object",
        properties: { child: { $ref: "#/$defs/node" }, label: { type: "string" } },
        required: ["child"],
      },
    },
  };
  const signals = computeContextSignals({ name: "t", inputSchema: schema });
  // Terminates (does not hang or overflow) and counts at least the first level.
  expect(signals.requiredFieldCount).toBeGreaterThanOrEqual(2);
  expect(Number.isFinite(signals.schemaDepth)).toBe(true);
});

// @implements REQ-106 context-signals
test("context signals report coverage, title meaningfulness, and a stable hash", () => {
  const def: ToolDefinition = {
    name: "infobroker_example",
    title: "Example Tool With A Long Title",
    description: "Do the thing. Use when needed. Do NOT use otherwise (use infobroker_other). Returns an [OK] or [ERROR] envelope.",
    inputSchema: { type: "object", properties: { q: { type: "string", description: "Query" } }, required: ["q"] },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  };
  const signals = computeContextSignals(def);
  expect(signals.paramCount).toBe(1);
  expect(signals.schemaDescriptionCoverage).toBe(100);
  expect(signals.titleIsMeaningful).toBe(true);
  expect(signals.definitionBytes).toBeGreaterThan(0);
  expect(signals.inputHash).toMatch(/^[0-9a-f]{16}$/);
  expect(computeContextSignals(def).inputHash).toBe(signals.inputHash);

  const zeroParam = computeContextSignals({ name: "p", description: "x", inputSchema: { type: "object", properties: {} } });
  expect(zeroParam.schemaDescriptionCoverage).toBe(100);
  expect(zeroParam.invocationCost).toBe(0);
});

// @implements REQ-106 hard-gates
test("hard gates detect missing and tautological descriptions", () => {
  expect(hasDescription({ name: "t", description: "  " })).toBe(false);
  expect(isTautological({ name: "process", description: "Process" })).toBe(true);
  expect(isTautological({ name: "t", title: "Thing", description: "thing" })).toBe(true);
  expect(isTautological({ name: "t", description: "Process records." })).toBe(false);
});

// @implements REQ-106 shadow-prefilter
test("shadow prefilter uses the ratio and absolute gap, choosing the dearest sibling", () => {
  expect(isShadowCandidate(0, 4)).toBe(true);
  expect(isShadowCandidate(4, 8)).toBe(true);
  expect(isShadowCandidate(10, 19)).toBe(false);
  expect(isShadowCandidate(4, 7)).toBe(false);

  const field = { type: "string", description: "x" };
  const fourFlat = {
    type: "object",
    properties: { f0: field, f1: field, f2: field, f3: field },
    required: ["f0", "f1", "f2", "f3"],
  };
  const branchA = { type: "object", properties: { a: field }, required: ["a"] };
  const branchB = { type: "object", properties: { b: field }, required: ["b"] };
  const panelSchema = {
    type: "object",
    properties: { pop: field, win: field, op: { oneOf: [branchA, branchB] } },
    required: ["pop", "win", "op"],
  };
  const defs: ToolDefinition[] = [
    { name: "get_stat", description: "Return a single stat.", inputSchema: fourFlat },
    { name: "list_all", description: "List all.", inputSchema: { type: "object", properties: {} } },
    { name: "query_panel", description: "Run a qualified query.", inputSchema: { type: "object", properties: { panel: panelSchema }, required: ["panel"] } },
  ];
  const candidates = shadowCandidates(defs);
  const panel = candidates.find((c) => c.tool === "query_panel");
  expect(panel).toBeDefined();
  expect(panel!.cheaperSibling).toBe("get_stat");
});

// @implements REQ-106 server-rollups
test("server rollups use exact tenths and correct float drift", () => {
  expect(computeDescriptionQualityScore([50, 48, 48])).toBe(4.8);
  expect(computeDescriptionQualityScore([50, 50, 50])).toBe(5.0);
  expect(computeCoherenceScore({ disambiguation: 5, namingConsistency: 5, toolCountAppropriateness: 5, completeness: 4 })).toBe(4.8);
  // 0.7 x 3.0 + 0.3 x 4.5 lands just under 3.45 in doubles; integer tenths give 3.5.
  expect(computeOverallScore(3.0, 4.5)).toBe(3.5);
});

// @implements REQ-106 structural-checks
test("structural violations and contradiction candidates are reported", () => {
  const defs: ToolDefinition[] = [
    { name: "bad", description: null, inputSchema: { type: "object", properties: {} } },
    { name: "taut", title: "Taut", description: "taut", inputSchema: { type: "object", properties: {} } },
    {
      name: "undoc",
      description: "Does a thing. Use when. Do NOT use. [OK] [ERROR].",
      inputSchema: { type: "object", properties: { q: { type: "string" } }, required: ["q"] },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
  ];
  const rules = structuralViolations(defs).map((v) => `${v.tool}:${v.rule}`);
  expect(rules).toContain("bad:missing-description");
  expect(rules).toContain("taut:tautological-description");
  expect(rules).toContain("undoc:undocumented-parameter");
  expect(rules).toContain("undoc:missing-annotation");

  const contradiction = annotationContradictionCandidates([
    { name: "writer", description: "Creates a new record.", annotations: { readOnlyHint: true } },
    { name: "reader", description: "Returns metadata and never modifies it.", annotations: { readOnlyHint: true } },
  ]);
  expect(contradiction.map((v) => v.tool)).toEqual(["writer"]);
});
