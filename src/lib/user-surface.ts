// @implements REQ-055 REQ-078
// user-surface.ts — pure checks that bind the shipped user surface to the
// evidence that is supposed to cover it: personas to §D feature groups,
// personas to harness scenarios, the defaults register to the live config, and
// the §1 intelligence-process functions to the goal-evidence matrix.
//
// The functions take parsed inputs so the gate and its unit tests share one
// implementation and no check depends on the repository being present.

import { parseFeatureTaxonomy } from "./feature-taxonomy.js";
import { REPORT_AUDIENCES } from "./direction.js";

/** The five §1 intelligence-process functions, as spec slugs. */
export const DIRECTION_STAGES = [
  "direction",
  "collection",
  "processing",
  "analysis",
  "dissemination",
] as const;

/**
 * The workflow shapes declared in `skills/infobroker/references/workflows.md`,
 * slugified. A shape declared there and covered by no scenario is a declared
 * intent with no evidence (REQ-131a).
 */
export const DECLARED_SHAPES = [
  "research-write",
  "fact-check",
  "deep-dive",
  "gated-analysis",
  "competitive-evaluation",
  "literature-review",
  "monitoring-delta",
  "adversarial-red-team",
  "vetting-due-diligence",
] as const;

/** Fixture shape names that name the same declared shape. */
export const SHAPE_ALIASES: Readonly<Record<string, string>> = {
  monitoring: "monitoring-delta",
  "red-team": "adversarial-red-team",
  vetting: "vetting-due-diligence",
};

export interface Persona {
  id: string;
  label?: string;
  audience?: string;
  intent?: string;
  stage_span?: string[];
  feature_groups?: number[];
}

export interface Scenario {
  id: string;
  persona?: string;
  shape?: string;
}

export interface UserSurfaceInput {
  specText: string;
  config: Record<string, unknown>;
  personas: Persona[];
  labScenarios: Scenario[];
  researchScenarios: Scenario[];
  defaultsRegister: string;
  goalMatrix: string;
}

export interface Finding {
  code: string;
  message: string;
}

/** Feature groups an audience persona is expected to cover. */
export const AUDIENCE_GROUPS = [1, 2, 3, 4, 5, 7] as const;

/** Groups that are cross-cutting rather than a single audience. */
export const CROSS_CUTTING_GROUPS = [6, 8, 9] as const;

/** Config sections whose second-level keys the defaults register must cover. */
export const REGISTER_SECTIONS = [
  "fetch",
  "expand",
  "research",
  "deep",
  "analysis",
  "corroboration",
  "output",
  "source_quality",
  "content_policy",
  "state",
  "kb",
  "preservation",
] as const;

const DOTTED_TOKEN = /`([a-z_]+(?:\.[a-z0-9_]+)+)`/g;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Resolve a dotted path in the config object; undefined when absent. */
export function configPath(config: Record<string, unknown>, path: string): unknown {
  let node: unknown = config;
  for (const part of path.split(".")) {
    if (!isPlainObject(node) || !(part in node)) return undefined;
    node = node[part];
  }
  return node;
}

/** Dotted config paths named in the register (config sections only). */
export function registerPaths(text: string): string[] {
  const sections = new Set<string>(REGISTER_SECTIONS);
  return [...text.matchAll(DOTTED_TOKEN)]
    .map((m) => m[1]!)
    .filter((token) => sections.has(token.split(".")[0]!))
    .sort();
}

export interface SpecFunctions {
  /** §1 function names, in table order, without markdown emphasis. */
  functions: string[];
  /** Whether the §1 table declares an Evidence column. */
  hasEvidenceColumn: boolean;
}

/**
 * Parse the §1 intelligence-process table: the first cell of every body row,
 * plus whether the header declares an Evidence column. A table parser replaces
 * the former numbered-list parser so §1 can be a decision table; the structural
 * checks in `checkUserSurface` replace the row-count guard the list parser had.
 */
export function specFunctions(specText: string): SpecFunctions {
  const start = specText.indexOf("## §1 Mission and Capability Model");
  if (start === -1) return { functions: [], hasEvidenceColumn: false };
  const rest = specText.slice(start);
  const next = /^## /m.exec(rest.slice(4));
  const section = next ? rest.slice(0, 4 + next.index) : rest;
  const lines = section.split("\n");
  const headerIndex = lines.findIndex((line) => /^\|\s*Function\s*\|/i.test(line));
  if (headerIndex === -1) return { functions: [], hasEvidenceColumn: false };
  const header = lines[headerIndex]!.split("|").map((cell) => cell.trim());
  const hasEvidenceColumn = header.some((cell) => /^evidence$/i.test(cell));
  const functions: string[] = [];
  for (const line of lines.slice(headerIndex + 2)) {
    if (!line.trim().startsWith("|")) break;
    const name = (line.split("|")[1] ?? "").replace(/\*\*/g, "").trim();
    if (name) functions.push(name);
  }
  return { functions, hasEvidenceColumn };
}

/** Every second-level key under the declared register sections. */
export function registerableConfigPaths(config: Record<string, unknown>): string[] {
  const paths: string[] = [];
  for (const section of REGISTER_SECTIONS) {
    const value = config[section];
    if (!isPlainObject(value)) continue;
    paths.push(section);
    for (const key of Object.keys(value)) paths.push(`${section}.${key}`);
  }
  return paths;
}

/**
 * A register token covers a path when it names the path, one of its
 * ancestors, or one of its descendants. `kb.freshness` covers
 * `kb.freshness.tiers.ephemeral.decay_hours`, and a row for a section's child
 * (for example `fetch.crawl_max_pages`) covers the section row itself.
 */
function covers(tokens: string[], path: string): boolean {
  return tokens.some(
    (token) => path === token || path.startsWith(`${token}.`) || token.startsWith(`${path}.`),
  );
}

export function checkUserSurface(input: UserSurfaceInput): Finding[] {
  const findings: Finding[] = [];
  const taxonomy = parseFeatureTaxonomy(input.specText);
  const groupNumbers = new Set(taxonomy.map((row) => row.group));
  const spec = specFunctions(input.specText);
  const tokens = registerPaths(input.defaultsRegister);

  if (taxonomy.length === 0) {
    findings.push({ code: "taxonomy-missing", message: "§D feature taxonomy could not be parsed" });
  }
  if (spec.functions.length < 5) {
    findings.push({
      code: "functions-unparsed",
      message: `§1 yielded ${spec.functions.length} functions; expected at least 5`,
    });
  }
  if (spec.functions.length > 0 && !spec.hasEvidenceColumn) {
    findings.push({
      code: "functions-no-evidence",
      message: "§1 function table has no Evidence column",
    });
  }

  const personaIds = new Set<string>();
  for (const persona of input.personas) {
    if (!persona.id) {
      findings.push({ code: "persona-id-missing", message: "a persona has no id" });
      continue;
    }
    if (personaIds.has(persona.id)) {
      findings.push({ code: "persona-duplicate", message: `persona \`${persona.id}\` is declared twice` });
    }
    personaIds.add(persona.id);
    // REQ-131a: a persona's audience comes from the report quality standard's
    // list, and its intent from the declared workflow shapes. One vocabulary,
    // not a third free-text field.
    if (persona.audience !== undefined && !(REPORT_AUDIENCES as readonly string[]).includes(persona.audience)) {
      findings.push({
        code: "persona-audience-unknown",
        message: `persona \`${persona.id}\` names audience \`${persona.audience}\`, which is not in the report quality standard`,
      });
    }
    if (persona.intent !== undefined && !(DECLARED_SHAPES as readonly string[]).includes(persona.intent)) {
      findings.push({
        code: "persona-intent-unknown",
        message: `persona \`${persona.id}\` names intent \`${persona.intent}\`, which is not a declared workflow shape`,
      });
    }
    for (const stage of persona.stage_span ?? []) {
      if (!(DIRECTION_STAGES as readonly string[]).includes(stage)) {
        findings.push({
          code: "persona-stage-unknown",
          message: `persona \`${persona.id}\` names stage \`${stage}\`, which is not a §1 function`,
        });
      }
    }
    for (const group of persona.feature_groups ?? []) {
      if (!groupNumbers.has(group)) {
        findings.push({
          code: "persona-group-unknown",
          message: `persona \`${persona.id}\` names §D group ${group}, which does not exist`,
        });
      }
    }
  }

  // REQ-055: every §1 function must be exercised by some persona's stage_span.
  // Validating the stage names alone lets a function drop out of the harness
  // silently when a persona is edited.
  for (const stage of DIRECTION_STAGES) {
    if (!input.personas.some((persona) => (persona.stage_span ?? []).includes(stage))) {
      findings.push({
        code: "stage-uncovered",
        message: `§1 function \`${stage}\` is named by no persona's stage_span`,
      });
    }
  }

  for (const group of AUDIENCE_GROUPS) {
    if (!input.personas.some((persona) => (persona.feature_groups ?? []).includes(group))) {
      findings.push({
        code: "group-uncovered",
        message: `audience-facing §D group ${group} has no persona`,
      });
    }
  }

  const scenarioPersonas = new Set(
    [...input.labScenarios, ...input.researchScenarios]
      .map((scenario) => scenario.persona)
      .filter((persona): persona is string => typeof persona === "string"),
  );
  for (const persona of input.personas) {
    if (!scenarioPersonas.has(persona.id)) {
      findings.push({
        code: "persona-without-scenario",
        message: `persona \`${persona.id}\` has no scenario in either harness`,
      });
    }
  }
  for (const scenario of input.labScenarios) {
    if (scenario.persona && !personaIds.has(scenario.persona)) {
      findings.push({
        code: "scenario-persona-unknown",
        message: `scenario \`${scenario.id}\` names persona \`${scenario.persona}\`, which is not declared`,
      });
    }
  }

  // REQ-131a: every declared workflow shape is exercised by at least one
  // scenario in either harness. Fixture shape names are normalized through the
  // alias table so the two vocabularies cannot drift apart silently.
  const coveredShapes = new Set(
    [...input.labScenarios, ...input.researchScenarios]
      .map((scenario) => scenario.shape)
      .filter((shape): shape is string => typeof shape === "string")
      .map((shape) => SHAPE_ALIASES[shape] ?? shape)
  );
  for (const shape of DECLARED_SHAPES) {
    if (!coveredShapes.has(shape)) {
      findings.push({
        code: "intent-uncovered",
        message: `declared workflow shape \`${shape}\` has no scenario in either harness`,
      });
    }
  }

  for (const path of registerableConfigPaths(input.config)) {
    if (!covers(tokens, path)) {
      findings.push({
        code: "register-missing-path",
        message: `config path \`${path}\` is not described in the defaults register`,
      });
    }
  }
  for (const token of tokens) {
    if (configPath(input.config, token) === undefined) {
      findings.push({
        code: "register-unknown-path",
        message: `defaults register names \`${token}\`, which is not in config.json`,
      });
    }
  }

  for (const fn of spec.functions) {
    if (!input.goalMatrix.includes(fn)) {
      findings.push({
        code: "function-missing",
        message: `§1 function "${fn}" has no row in the goal-evidence matrix`,
      });
    }
  }

  return findings;
}
