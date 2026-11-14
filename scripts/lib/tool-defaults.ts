// tool-defaults.ts — pure reconciliation of the defaults the specification
// declares, the defaults the tool schemas apply, and the config values that
// describe the same limits (REQ-080). Role: build tool (module).
//
// No I/O here: `validate-spec` supplies the spec text, the registration source,
// and the shipped config. Every declared default is discovered in §4 and must
// be claimed by exactly one entry, so a new declaration cannot ship
// unreconciled. A declaration entry may claim several parameters — the house
// style states the six flag defaults once, as "(each default false)".

export interface DeclaredDefault {
  /** REQ whose body carries the declaration. */
  req: string;
  tool: string;
  /** Parameters the declaration covers; more than one for an "(each …)" clause. */
  params: string[];
  /** Captures the declared value, and the declared maximum when present. */
  declaration: RegExp;
}

export interface ConfigLimitPair {
  /** Dotted path into the shipped config. */
  configPath: string;
  tool: string;
  param: string;
  /** Which schema field the config value must equal. */
  field: "default" | "maximum";
}

export interface SchemaParam {
  default?: unknown;
  minimum?: number;
  maximum?: number;
}

const SEARCH_FLAGS = ["suggest", "expand", "research", "fresh", "deep", "analyze"];

export const DECLARED_DEFAULTS: DeclaredDefault[] = [
  {
    req: "REQ-020",
    tool: "search_web",
    params: ["max_results"],
    declaration: /`max_results`\s*\(default (\d+), max (\d+)\)/g,
  },
  {
    req: "REQ-020",
    tool: "search_web",
    params: ["page"],
    declaration: /`page`\s*\(default (\d+)\)/g,
  },
  {
    req: "REQ-020",
    tool: "search_web",
    params: ["safe_search"],
    declaration: /`safe_search`\s*\(default ([a-z]+)\)/g,
  },
  {
    req: "REQ-020",
    tool: "search_web",
    params: ["content_type"],
    declaration: /`content_type`\s*\(default ([a-z]+)\)/g,
  },
  {
    req: "REQ-020",
    tool: "search_web",
    params: SEARCH_FLAGS,
    declaration: /\(each default ([a-z]+)\)/g,
  },
  {
    req: "REQ-021",
    tool: "fetch_page",
    params: ["max_length"],
    declaration: /`max_length`\s*\(default (\d+)\)/g,
  },
  {
    req: "REQ-026",
    tool: "verify_claims",
    params: ["max_iterations"],
    declaration: /`max_iterations`\s*\(default (\d+), max (\d+)\)/g,
  },
  {
    req: "REQ-026",
    tool: "verify_claims",
    params: ["confidence_threshold"],
    declaration: /`confidence_threshold`\s*\(default ([\d.]+)\)/g,
  },
  {
    req: "REQ-027",
    tool: "get_citations",
    params: ["max_results"],
    declaration: /`max_results`\s*\(default (\d+), max (\d+)\)/g,
  },
  {
    req: "REQ-060a",
    tool: "manage_kb",
    params: ["max_results"],
    declaration: /\(default (\d+), max (\d+)\)/g,
  },
];

/**
 * A tool default and a config value that describe the same limit. Enumerated,
 * never inferred: `corroboration.max_iterations` is a loop bound, and matching
 * it to an unrelated `max_*` key by name would pair the wrong limits.
 */
export const CONFIG_LIMIT_PAIRS: ConfigLimitPair[] = [
  { configPath: "output.max_chars", tool: "fetch_page", param: "max_length", field: "default" },
  { configPath: "kb.max_results", tool: "manage_kb", param: "max_results", field: "maximum" },
  { configPath: "corroboration.max_iterations", tool: "verify_claims", param: "max_iterations", field: "default" },
  {
    configPath: "corroboration.confidence_threshold",
    tool: "verify_claims",
    param: "confidence_threshold",
    field: "default",
  },
];

const REQ_HEADER = /^\*\*REQ-([0-9]{3}[a-z]?) — /;
const BODY_END = /^(?:\*\*REQ-|#{2,3} )/;
const DECLARATION = /\((?:each )?default ([A-Za-z0-9.]+)(?:, max (\d+))?/g;

interface ReqBody {
  req: string;
  text: string;
}

/** §4 only: the rest of the spec describes algorithms, not tool parameters. */
function section4(spec: string): string {
  const start = spec.search(/^## §4 /m);
  if (start === -1) return "";
  const end = spec.slice(start).search(/^## §5 /m);
  return end === -1 ? spec.slice(start) : spec.slice(start, start + end);
}

function reqBodies(spec: string): ReqBody[] {
  const bodies: ReqBody[] = [];
  let current: ReqBody | undefined;
  for (const line of section4(spec).split("\n")) {
    const header = REQ_HEADER.exec(line);
    if (header) {
      current = { req: `REQ-${header[1]!}`, text: "" };
      bodies.push(current);
      continue;
    }
    if (BODY_END.test(line)) {
      current = undefined;
      continue;
    }
    if (current) current.text += `${line}\n`;
  }
  return bodies;
}

function coerce(token: string): unknown {
  if (token === "true") return true;
  if (token === "false") return false;
  if (/^-?\d+(?:\.\d+)?$/.test(token)) return Number(token);
  return token;
}

/** Readings of one parameter's zod chain in the registration source. */
export function schemaParam(schemaSource: string, tool: string, param: string): SchemaParam | undefined {
  const blocks = schemaSource.split(/(?:server\.registerTool|instrumentTool)\(\s*"infobroker_/).slice(1);
  const block = blocks.find((b) => b.startsWith(`${tool}"`));
  if (block === undefined) return undefined;
  const at = block.indexOf(`\n      ${param}:`);
  if (at === -1) return undefined;
  const rest = block.slice(at + 1);
  const next = rest.search(/\n {6}[A-Za-z_][A-Za-z0-9_]*:/);
  const chain = next === -1 ? rest : rest.slice(0, next);
  const read = (re: RegExp): number | undefined => {
    const m = re.exec(chain);
    return m ? Number(m[1]) : undefined;
  };
  const dflt = /\.default\((true|false|-?\d+(?:\.\d+)?|"[^"]*"|'[^']*')\)/.exec(chain);
  const out: SchemaParam = {};
  if (dflt) {
    const raw = dflt[1]!;
    out.default = raw.startsWith('"') || raw.startsWith("'") ? raw.slice(1, -1) : coerce(raw);
  }
  const min = read(/\.min\((-?\d+(?:\.\d+)?)\)/);
  const max = read(/\.max\((-?\d+(?:\.\d+)?)\)/);
  if (min !== undefined) out.minimum = min;
  if (max !== undefined) out.maximum = max;
  return out;
}

/**
 * Every `(default …)` / `(each default …)` in §4 that no declaration entry
 * claims. Returns one message per unclaimed declaration, naming its REQ.
 */
export function unreconciledSpecDefaults(spec: string): string[] {
  const bodies = reqBodies(spec);
  const claimed = new Set<string>();
  const problems: string[] = [];

  for (const entry of DECLARED_DEFAULTS) {
    const body = bodies.find((b) => b.req === entry.req);
    if (body === undefined) {
      problems.push(`REQ-080: declaration entry for ${entry.req} names a REQ body that does not exist`);
      continue;
    }
    const re = new RegExp(entry.declaration.source, entry.declaration.flags);
    let matches = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(body.text)) !== null) {
      matches += 1;
      // The entry's regex may start at the parameter name; the claim key is the
      // declaration's own "(" so it lines up with the discovery scan below.
      const at = body.text.indexOf("(", m.index);
      claimed.add(`${entry.req}:${at}`);
    }
    if (matches === 0) {
      problems.push(`REQ-080: ${entry.req} no longer declares the default for ${entry.tool}.${entry.params.join(",")}`);
    } else if (matches > 1) {
      problems.push(`REQ-080: ${entry.req} declares the default for ${entry.tool}.${entry.params.join(",")} ${matches} times`);
    }
  }

  for (const body of bodies) {
    const re = new RegExp(DECLARATION.source, DECLARATION.flags);
    let m: RegExpExecArray | null;
    while ((m = re.exec(body.text)) !== null) {
      if (!claimed.has(`${body.req}:${m.index}`)) {
        problems.push(
          `REQ-080: ${body.req} declares a default ${m[0].trim()}) that no declaration entry reconciles`,
        );
      }
    }
  }
  return problems;
}

function dotted(config: unknown, path: string): unknown {
  let cursor: unknown = config;
  for (const key of path.split(".")) {
    if (typeof cursor !== "object" || cursor === null) return undefined;
    cursor = (cursor as Record<string, unknown>)[key];
  }
  return cursor;
}

export interface ReconcileInput {
  spec: string;
  schemaSource: string;
  config: unknown;
}

/** Schema-vs-spec, max-vs-spec, and config-pair divergences (REQ-080). */
export function reconcile({ spec, schemaSource, config }: ReconcileInput): string[] {
  const problems: string[] = [...unreconciledSpecDefaults(spec)];
  const bodies = reqBodies(spec);

  for (const entry of DECLARED_DEFAULTS) {
    const body = bodies.find((b) => b.req === entry.req);
    if (body === undefined) continue;
    const re = new RegExp(entry.declaration.source, entry.declaration.flags);
    const m = re.exec(body.text);
    if (m === null) continue;
    const declared = coerce(m[1]!);
    const declaredMax = m[2] === undefined ? undefined : Number(m[2]);
    for (const param of entry.params) {
      const schema = schemaParam(schemaSource, entry.tool, param);
      if (schema === undefined || schema.default === undefined) {
        problems.push(
          `REQ-080: ${entry.tool}.${param} applies no schema default; ${entry.req} declares ${String(declared)}`,
        );
        continue;
      }
      if (schema.default !== declared) {
        problems.push(
          `REQ-080: ${entry.tool}.${param} schema default ${String(schema.default)} diverges from ${entry.req}'s declared ${String(declared)}`,
        );
      }
      if (declaredMax !== undefined && schema.maximum !== declaredMax) {
        problems.push(
          `REQ-080: ${entry.tool}.${param} schema maximum ${String(schema.maximum)} diverges from ${entry.req}'s declared max ${declaredMax}`,
        );
      }
    }
  }

  for (const pair of CONFIG_LIMIT_PAIRS) {
    const configured = dotted(config, pair.configPath);
    const schema = schemaParam(schemaSource, pair.tool, pair.param);
    const applied = pair.field === "default" ? schema?.default : schema?.maximum;
    if (typeof configured !== "number" || typeof applied !== "number") {
      problems.push(
        `REQ-080: config ${pair.configPath} (${String(configured)}) or ${pair.tool}.${pair.param} ${pair.field} (${String(applied)}) is not a number`,
      );
      continue;
    }
    if (configured !== applied) {
      problems.push(
        `REQ-080: config ${pair.configPath} is ${configured} but ${pair.tool}.${pair.param} ${pair.field} is ${applied}`,
      );
    }
  }

  return problems;
}
