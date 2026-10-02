// @implements REQ-106
// Deterministic layer of the Tool Definition Quality Score (TDQS 1.2):
// context signals, invocation cost, hard gates, shadow-candidate prefilter,
// score arithmetic, tiers, and server rollups. The LLM rubric (stage 3) is
// out of scope here; scripts/tdqs-rubric.ts runs it on demand.
//
// Reference: https://tdqs.dev/spec (v1.2). Traversal rules for the required
// subtree are normative in that document; this module implements them so two
// runs over the same definition produce the same numbers.

import { createHash } from "node:crypto";

export type JsonSchema = Record<string, unknown>;

export interface ToolAnnotations {
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
}

export interface ToolDefinition {
  name: string;
  title?: string | null;
  description?: string | null;
  inputSchema?: JsonSchema | null;
  outputSchema?: JsonSchema | null;
  annotations?: ToolAnnotations | null;
}

export interface AnnotationValues {
  readOnly: boolean | null;
  destructive: boolean | null;
  idempotent: boolean | null;
  openWorld: boolean | null;
}

export interface ContextSignals {
  paramCount: number;
  requiredParamCount: number;
  paramsWithDescriptions: number;
  paramsWithEnums: number;
  schemaDescriptionCoverage: number;
  hasNestedObjects: boolean;
  requiredFieldCount: number;
  schemaDepth: number;
  unionChoiceCount: number;
  invocationCost: number;
  hasOutputSchema: boolean;
  hasAnnotations: boolean;
  annotationValues: AnnotationValues;
  titleIsMeaningful: boolean;
  definitionBytes: number;
  inputHash: string;
}

export interface Violation {
  tool: string;
  rule: string;
  detail: string;
}

export interface ShadowCandidate {
  tool: string;
  invocationCost: number;
  cheaperSibling: string;
  cheaperSiblingInvocationCost: number;
}

export const DIMENSION_WEIGHTS: Record<string, number> = {
  purpose_clarity: 25,
  usage_guidelines: 20,
  behavioral_transparency: 20,
  parameter_semantics: 15,
  conciseness_structure: 10,
  contextual_completeness: 10,
};

const MAX_SCHEMA_DEPTH = 10;

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** p / q rounded half-up to one decimal, in integer arithmetic (TDQS `round1`). */
export function round1(p: number, q: number): number {
  return Math.floor((20 * p + q) / (2 * q)) / 10;
}

/** Weighted sum of the six dimension scores, rounded to one decimal. */
export function computeTdqs(scores: Record<string, number>): number {
  let hundredths = 0;
  for (const [dimension, weight] of Object.entries(DIMENSION_WEIGHTS)) {
    hundredths += (scores[dimension] ?? 0) * weight;
  }
  return round1(hundredths, 100);
}

export function computeQualityTier(score: number): string {
  if (score >= 3.5) return "A";
  if (score >= 3.0) return "B";
  if (score >= 2.0) return "C";
  if (score >= 1.0) return "D";
  return "F";
}

export function computeInvocationCost(signals: Pick<ContextSignals, "requiredFieldCount" | "schemaDepth" | "unionChoiceCount">): number {
  return (
    signals.requiredFieldCount +
    2 * Math.max(0, signals.schemaDepth - 1) +
    2 * signals.unionChoiceCount
  );
}

function resolveRef(node: Record<string, unknown>, root: JsonSchema): Record<string, unknown> {
  let cur = node;
  let guard = 0;
  while (typeof cur.$ref === "string" && guard++ < MAX_SCHEMA_DEPTH) {
    const ref = cur.$ref;
    if (!ref.startsWith("#/")) break;
    const parts = ref
      .slice(2)
      .split("/")
      .map((p) => p.replace(/~1/g, "/").replace(/~0/g, "~"));
    let target: unknown = root;
    for (const part of parts) {
      if (!isObj(target)) {
        target = undefined;
        break;
      }
      target = target[part];
    }
    if (!isObj(target)) break;
    cur = target;
  }
  return cur;
}

function isNullBranch(branch: unknown): boolean {
  return isObj(branch) && branch.type === "null";
}

interface SubtreeStats {
  depth: number;
  requiredCount: number;
  unionChoices: number;
}

const EMPTY_STATS: SubtreeStats = { depth: 0, requiredCount: 0, unionChoices: 0 };

/**
 * Required-subtree traversal (TDQS §Stage 1). Counts required fields anywhere
 * in the subtree, measures nesting depth, and prices union choices. Recursive
 * schemas terminate via a depth cap; `$ref` is resolved against `$defs`.
 */
function subtreeStats(schema: unknown, root: JsonSchema, depth: number, seen: Set<string>): SubtreeStats {
  if (!isObj(schema) || depth > MAX_SCHEMA_DEPTH) return EMPTY_STATS;
  // Track visited $ref pointers so a recursive schema terminates at the repeat.
  let visited = seen;
  if (typeof schema.$ref === "string") {
    if (seen.has(schema.$ref)) return EMPTY_STATS;
    visited = new Set(seen);
    visited.add(schema.$ref);
  }
  const node = resolveRef(schema, root);
  if (depth > MAX_SCHEMA_DEPTH) return EMPTY_STATS;

  // Union: price branches - 1, exclude the nullable idiom, take the deepest
  // branch for depth and the largest-required branch for field count.
  for (const unionKey of ["oneOf", "anyOf"] as const) {
    const branches = node[unionKey];
    if (Array.isArray(branches)) {
      const nonNull = branches.filter((b) => !isNullBranch(b));
      const nullableIdiom = nonNull.length === 1;
      let deepest = 0;
      let maxRequired = 0;
      let representativeChoices = 0;
      for (const branch of branches) {
        const stats = subtreeStats(branch, root, depth + 1, visited);
        if (stats.depth > deepest) deepest = stats.depth;
        if (stats.requiredCount > maxRequired) {
          maxRequired = stats.requiredCount;
          representativeChoices = stats.unionChoices;
        }
      }
      const branchesCount = nullableIdiom ? 0 : Math.max(nonNull.length || branches.length, 1) - 1;
      return { depth: deepest, requiredCount: maxRequired, unionChoices: branchesCount + representativeChoices };
    }
  }

  // allOf: every subschema applies, so required fields and union choices add up.
  if (Array.isArray(node.allOf)) {
    let depthMax = 0;
    let required = 0;
    let choices = 0;
    for (const sub of node.allOf) {
      const stats = subtreeStats(sub, root, depth + 1, visited);
      depthMax = Math.max(depthMax, stats.depth);
      required += stats.requiredCount;
      choices += stats.unionChoices;
    }
    return { depth: depthMax, requiredCount: required, unionChoices: choices };
  }

  // `not` contributes to depth only — it negates, so it adds no required fields.
  if (isObj(node.not)) {
    const stats = subtreeStats(node.not, root, depth + 1, visited);
    return { depth: stats.depth, requiredCount: 0, unionChoices: 0 };
  }

  // An array whose items is an object schema is the nesting level; an array of
  // scalars is flat.
  if (node.type === "array" || isObj(node.items)) {
    const items = node.items;
    if (isObj(items) && (items.type === "object" || isObj(items.properties))) {
      const stats = subtreeStats(items, root, depth + 1, visited);
      return { depth: stats.depth, requiredCount: stats.requiredCount, unionChoices: stats.unionChoices };
    }
    return EMPTY_STATS;
  }

  // Object: required properties (containers included) plus their nested counts.
  // A scalar/leaf node contributes nothing.
  if (node.type === "object" || isObj(node.properties) || Array.isArray(node.required)) {
    const props = isObj(node.properties) ? node.properties : {};
    const required = Array.isArray(node.required) ? node.required.filter((r): r is string => typeof r === "string") : [];
    let requiredCount = required.length;
    let childDepth = 0;
    let choices = 0;
    for (const key of required) {
      const child = props[key];
      const stats = subtreeStats(child, root, depth + 1, visited);
      requiredCount += stats.requiredCount;
      childDepth = Math.max(childDepth, stats.depth);
      choices += stats.unionChoices;
    }
    return { depth: 1 + childDepth, requiredCount, unionChoices: choices };
  }

  return EMPTY_STATS;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (isObj(value)) {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) out[key] = canonicalize(value[key]);
    return out;
  }
  return value;
}

function canonicalDefinition(def: ToolDefinition): string {
  return JSON.stringify(
    canonicalize({
      name: def.name,
      title: def.title ?? null,
      description: def.description ?? null,
      inputSchema: def.inputSchema ?? null,
      outputSchema: def.outputSchema ?? null,
      annotations: def.annotations ?? null,
    })
  );
}

export function computeContextSignals(def: ToolDefinition): ContextSignals {
  const schema = isObj(def.inputSchema) ? (def.inputSchema as JsonSchema) : null;
  const props = schema && isObj(schema.properties) ? (schema.properties as Record<string, unknown>) : {};
  const entries = Object.entries(props);
  const paramCount = entries.length;

  const required = schema && Array.isArray(schema.required) ? schema.required.filter((r): r is string => typeof r === "string") : [];
  const requiredParamCount = required.length;

  const paramsWithDescriptions = entries.filter(
    ([, v]) => isObj(v) && typeof v.description === "string" && v.description.trim().length > 0
  ).length;
  const paramsWithEnums = entries.filter(([, v]) => isObj(v) && Array.isArray(v.enum)).length;
  const schemaDescriptionCoverage = paramCount === 0 ? 100 : Math.round((paramsWithDescriptions / paramCount) * 100);
  const hasNestedObjects = entries.some(([, v]) => isObj(v) && v.type === "object");

  const stats = schema && paramCount > 0 ? subtreeStats(schema, schema, 0, new Set()) : EMPTY_STATS;
  const requiredFieldCount = stats.requiredCount;
  const schemaDepth = stats.depth;
  const unionChoiceCount = stats.unionChoices;

  const hasOutputSchema = isObj(def.outputSchema) && Object.keys(def.outputSchema).length > 0;
  const ann = def.annotations ?? null;
  const hasAnnotations = isObj(ann) && Object.keys(ann).length > 0;
  const annotationValues: AnnotationValues = {
    readOnly: ann && typeof ann.readOnlyHint === "boolean" ? ann.readOnlyHint : null,
    destructive: ann && typeof ann.destructiveHint === "boolean" ? ann.destructiveHint : null,
    idempotent: ann && typeof ann.idempotentHint === "boolean" ? ann.idempotentHint : null,
    openWorld: ann && typeof ann.openWorldHint === "boolean" ? ann.openWorldHint : null,
  };

  const title = typeof def.title === "string" ? def.title : null;
  const titleIsMeaningful = !!title && title !== def.name && title.length > def.name.length;

  const canonical = canonicalDefinition(def);
  const definitionBytes = Buffer.byteLength(canonical, "utf-8");
  const inputHash = createHash("sha256").update(canonical).digest("hex").slice(0, 16);

  return {
    paramCount,
    requiredParamCount,
    paramsWithDescriptions,
    paramsWithEnums,
    schemaDescriptionCoverage,
    hasNestedObjects,
    requiredFieldCount,
    schemaDepth,
    unionChoiceCount,
    invocationCost: computeInvocationCost({ requiredFieldCount, schemaDepth, unionChoiceCount }),
    hasOutputSchema,
    hasAnnotations,
    annotationValues,
    titleIsMeaningful,
    definitionBytes,
    inputHash,
  };
}

export function hasDescription(def: ToolDefinition): boolean {
  return typeof def.description === "string" && def.description.trim().length > 0;
}

/** A description that restates the name or title adds no information. */
export function isTautological(def: ToolDefinition): boolean {
  if (!hasDescription(def)) return false;
  const d = def.description!.trim().toLowerCase();
  const name = def.name.trim().toLowerCase();
  const title = typeof def.title === "string" ? def.title.trim().toLowerCase() : "";
  return d === name || (title !== "" && d === title);
}

export function isShadowCandidate(cheap: number, expensive: number): boolean {
  return expensive >= 2 * cheap && expensive - cheap >= 4;
}

/** At most one candidate per tool: the dearest qualifying sibling. */
export function shadowCandidates(defs: ToolDefinition[]): ShadowCandidate[] {
  const costs = defs.map((d) => ({ name: d.name, cost: computeContextSignals(d).invocationCost }));
  const out: ShadowCandidate[] = [];
  for (const target of costs) {
    let best: { name: string; cost: number } | null = null;
    for (const sibling of costs) {
      if (sibling.name === target.name) continue;
      if (isShadowCandidate(sibling.cost, target.cost) && (!best || sibling.cost > best.cost)) {
        best = sibling;
      }
    }
    if (best) {
      out.push({
        tool: target.name,
        invocationCost: target.cost,
        cheaperSibling: best.name,
        cheaperSiblingInvocationCost: best.cost,
      });
    }
  }
  return out;
}

export function computeDescriptionQualityScore(tdqsTenths: number[]): number {
  const n = tdqsTenths.length;
  if (n === 0) return 0;
  const sum = tdqsTenths.reduce((a, b) => a + b, 0);
  const min = Math.min(...tdqsTenths);
  return round1(6 * sum + 4 * n * min, 100 * n);
}

export interface CoherenceDimensions {
  disambiguation: number;
  namingConsistency: number;
  toolCountAppropriateness: number;
  completeness: number;
}

export function computeCoherenceScore(dims: CoherenceDimensions): number {
  return round1(dims.disambiguation + dims.namingConsistency + dims.toolCountAppropriateness + dims.completeness, 4);
}

/** Components are one-decimal scores; the arithmetic runs on exact tenths. */
export function computeOverallScore(descriptionQualityScore: number, coherenceScore: number): number {
  return round1(7 * Math.round(descriptionQualityScore * 10) + 3 * Math.round(coherenceScore * 10), 100);
}

const MUTATION_VERBS = /\b(creates?|created|updates?|updated|deletes?|deleted|removes?|removed|writes?|wrote|ingests?|stores?|saves?|archives?|modifies|mutates?|overwrites?)\b/i;
const NEGATIONS = /\b(never|not|no|without|cannot|does not|doesn't|isn't|aren't)\b/i;

/**
 * Deterministic hard-gate and structural checks. These are the objective
 * preconditions of the TDQS bar; the six dimension scores are LLM-judged.
 */
export function structuralViolations(defs: ToolDefinition[]): Violation[] {
  const out: Violation[] = [];
  for (const def of defs) {
    if (!hasDescription(def)) {
      out.push({ tool: def.name, rule: "missing-description", detail: "description is null or whitespace-only (TDQS hard gate)" });
      continue;
    }
    if (isTautological(def)) {
      out.push({ tool: def.name, rule: "tautological-description", detail: "description equals the tool name or title" });
    }
    const schema = isObj(def.inputSchema) ? def.inputSchema : null;
    const props = schema && isObj(schema.properties) ? schema.properties : {};
    for (const [param, raw] of Object.entries(props)) {
      const described = isObj(raw) && typeof raw.description === "string" && raw.description.trim().length > 0;
      if (!described) {
        out.push({ tool: def.name, rule: "undocumented-parameter", detail: `parameter "${param}" has no description` });
      }
    }
    const ann = def.annotations ?? null;
    for (const hint of ["readOnlyHint", "destructiveHint", "idempotentHint", "openWorldHint"] as const) {
      if (!isObj(ann) || typeof ann[hint] !== "boolean") {
        out.push({ tool: def.name, rule: "missing-annotation", detail: `annotation "${hint}" is not declared` });
      }
    }
  }
  return out;
}

/**
 * Report-only candidates for the `Annotation Contradiction` flag: a
 * read-only tool whose description names a mutation verb outside a negation.
 * The authoritative check is the LLM rubric; this only surfaces suspects.
 */
export function annotationContradictionCandidates(defs: ToolDefinition[]): Violation[] {
  const out: Violation[] = [];
  for (const def of defs) {
    if (def.annotations?.readOnlyHint !== true || !hasDescription(def)) continue;
    const desc = def.description!;
    if (MUTATION_VERBS.test(desc) && !NEGATIONS.test(desc)) {
      out.push({ tool: def.name, rule: "annotation-contradiction-candidate", detail: "readOnlyHint is true but the description names a mutation verb" });
    }
  }
  return out;
}
