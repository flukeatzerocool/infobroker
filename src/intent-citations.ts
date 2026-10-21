// @implements REQ-107
// Pure citation parser and validator for the client routing surface. The gate
// (scripts/check-intent-citations.ts) supplies the live tool schema; this
// module stays free of I/O so the rules are unit-testable.
//
// Canonical citation forms:
//   `tool`
//   `tool (operation)`                       boolean/string mode
//   `tool (action: value)`                   action enum
//   `tool (action: value, operation: value)` compound
//   `tool (operation, key: value)`           mode plus parameters
//
// Prefix policy is per file: the client-facing instruction file uses the
// server-registered single `infobroker_*` names; skill files use bare names.
// Clients may add their own server namespace (for example opencode exposes
// `infobroker_infobroker_search_web`); the parser normalizes every form to
// the registered slug for schema checks.

export type PrefixPolicy = "bare" | "single" | "client";
export type CitationPrefix = "bare" | "single" | "client";

export interface ToolProperty {
  enum?: string[];
  type?: string;
}

export interface ToolSchema {
  slug: string;
  properties: Record<string, ToolProperty>;
}

export interface Citation {
  file: string;
  line: number;
  raw: string;
  tool: string;
  prefix: CitationPrefix;
  operation?: string;
  action?: string;
  params: Record<string, string>;
  coverage: string[];
}

export interface Finding {
  code: string;
  message: string;
  file?: string;
  line?: number;
}

// The only hand-maintained operation list. A future string-triggered mode is
// added here (and its coverage test) rather than inferred from a prose scan.
export const STRING_OPERATIONS: Readonly<Record<string, readonly string[]>> = {
  fetch_page: ["question"],
};

export const FILE_PREFIX_POLICY: Readonly<Record<string, PrefixPolicy>> = {
  "instructions/search-preferences.md": "single",
  "skills/infobroker/SKILL.md": "bare",
  "skills/infobroker/references/journeys.md": "bare",
  "skills/infobroker/references/workflows.md": "bare",
  "skills/infobroker/references/decision-tree.md": "bare",
};

const ARG_RE = /^([a-z][a-z0-9_]*)\s*:\s*(.+)$/;
const BARE_OP_RE = /^[a-z][a-z0-9_]*$/;

function stripQuotes(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith("\"") && trimmed.endsWith("\"")) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export function splitToolName(name: string): { slug: string; prefix: CitationPrefix } {
  if (name.startsWith("infobroker_infobroker_")) {
    return { slug: name.slice("infobroker_infobroker_".length), prefix: "client" };
  }
  if (name.startsWith("infobroker_")) {
    return { slug: name.slice("infobroker_".length), prefix: "single" };
  }
  return { slug: name, prefix: "bare" };
}

function looksLikeTool(name: string, knownSlugs: ReadonlySet<string>): boolean {
  const { slug, prefix } = splitToolName(name);
  // A prefixed name is always treated as a tool citation, even when the slug
  // is unknown, so a renamed prefixed tool is caught. A bare token is only a
  // citation when it matches a registered slug; otherwise prose words such as
  // `question` or `suggest` would be over-captured.
  return prefix !== "bare" || knownSlugs.has(slug);
}

function coverageKey(
  tool: ToolSchema,
  token: string,
  kind: "action" | "operation" | "bare"
): { key?: string; code?: string; message?: string } {
  if (kind === "action" || kind === "operation") {
    const prop = tool.properties[kind];
    const values = prop?.enum ?? [];
    if (!values.includes(token)) {
      return {
        code: `unknown_${kind}`,
        message: `\`${tool.slug}\` has no ${kind} "${token}" (declared: ${values.join(", ") || "none"})`,
      };
    }
    return { key: `${kind}:${token}` };
  }

  const prop = tool.properties[token];
  if (prop?.type === "boolean") return { key: `flag:${token}` };
  if ((STRING_OPERATIONS[tool.slug] ?? []).includes(token)) return { key: `string:${token}` };

  // A bare enum value is a legacy citation: it is still covered, but the
  // canonical form requires the action/operation key.
  if ((tool.properties.action?.enum ?? []).includes(token)) return { key: `action:${token}` };
  if ((tool.properties.operation?.enum ?? []).includes(token)) return { key: `operation:${token}` };

  return {
    code: "unknown_operation",
    message: `\`${tool.slug}\` has no operation "${token}"`,
  };
}

function parseArgs(
  tool: ToolSchema,
  args: string,
  file: string,
  line: number,
  raw: string
): { citation: Citation; findings: Finding[] } {
  const citation: Citation = {
    file,
    line,
    raw,
    tool: tool.slug,
    prefix: "bare",
    params: {},
    coverage: [],
  };
  const findings: Finding[] = [];

  if (args.includes("/")) {
    findings.push({
      code: "legacy_slash",
      message: `\`${raw}\` uses the legacy slash form; use \`action: value\` citations or separate citations`,
      file,
      line,
    });
  }

  for (const part of args.split(",").map((p) => p.trim()).filter(Boolean)) {
    const argMatch = ARG_RE.exec(part);
    if (argMatch) {
      const [, key, rawValue] = argMatch;
      const value = stripQuotes(rawValue);

      if (key === "action" || key === "operation") {
        const result = coverageKey(tool, value, key);
        if (result.code) {
          findings.push({ code: result.code, message: result.message!, file, line });
        } else {
          citation[key] = value;
          citation.coverage.push(result.key!);
        }
        continue;
      }

      const prop = tool.properties[key];
      if (!prop) {
        findings.push({
          code: "unknown_parameter",
          message: `\`${tool.slug}\` has no parameter "${key}"`,
          file,
          line,
        });
        continue;
      }
      if (prop.enum && !prop.enum.includes(value)) {
        findings.push({
          code: "invalid_parameter_value",
          message: `\`${tool.slug}.${key}\` has no value "${value}" (declared: ${prop.enum.join(", ")})`,
          file,
          line,
        });
        continue;
      }
      citation.params[key] = value;
      continue;
    }

    if (part.includes("/")) {
      for (const token of part.split("/").map((t) => t.trim()).filter(Boolean)) {
        if (!BARE_OP_RE.test(token)) {
          findings.push({
            code: "malformed_citation",
            message: `\`${raw}\` contains an unparseable operation "${token}"`,
            file,
            line,
          });
          continue;
        }
        const result = coverageKey(tool, token, "bare");
        if (result.code) {
          findings.push({ code: result.code, message: result.message!, file, line });
        } else {
          citation.coverage.push(result.key!);
        }
      }
      continue;
    }

    if (!BARE_OP_RE.test(part)) {
      findings.push({
        code: "malformed_citation",
        message: `\`${raw}\` contains an unparseable argument "${part}"`,
        file,
        line,
      });
      continue;
    }

    const result = coverageKey(tool, part, "bare");
    if (result.code) {
      findings.push({ code: result.code, message: result.message!, file, line });
      continue;
    }
    if (result.key!.startsWith("action:")) {
      findings.push({
        code: "missing_action_key",
        message: `\`${raw}\` should cite the action as \`action: ${part}\``,
        file,
        line,
      });
    } else if (result.key!.startsWith("operation:")) {
      findings.push({
        code: "missing_operation_key",
        message: `\`${raw}\` should cite the operation as \`operation: ${part}\``,
        file,
        line,
      });
    }
    citation.coverage.push(result.key!);
  }

  return { citation, findings };
}

export function extractCitations(
  markdown: string,
  file: string,
  schemas: ReadonlyMap<string, ToolSchema>
): { citations: Citation[]; findings: Finding[] } {
  const citations: Citation[] = [];
  const findings: Finding[] = [];
  const knownSlugs = new Set(schemas.keys());

  for (const [index, lineText] of markdown.split("\n").entries()) {
    for (const match of lineText.matchAll(/`([^`]+)`/g)) {
      const raw = match[1];
      const callMatch = /^([a-zA-Z0-9_]+)(?:\s*\(([^)]*)\))?$/.exec(raw);
      if (!callMatch) continue;

      const [, name, args] = callMatch;
      if (!looksLikeTool(name, knownSlugs)) continue;

      const { slug, prefix } = splitToolName(name);
      const tool = schemas.get(slug);
      const line = index + 1;

      if (!tool) {
        findings.push({
          code: "unknown_tool",
          message: `\`${name}\` does not resolve to a registered tool`,
          file,
          line,
        });
        continue;
      }

      const expected = FILE_PREFIX_POLICY[file];
      if (expected && prefix !== expected) {
        findings.push({
          code: "wrong_prefix",
          message:
            expected === "client"
              ? `\`${name}\` must use the client-qualified \`infobroker_infobroker_\` prefix in this file`
              : expected === "single"
                ? `\`${name}\` must use the \`infobroker_\` prefix in this file`
                : `\`${name}\` must use the bare tool name in this file`,
          file,
          line,
        });
      }

      if (args === undefined) {
        citations.push({ file, line, raw, tool: slug, prefix, params: {}, coverage: [] });
        continue;
      }

      const parsed = parseArgs(tool, args, file, line, raw);
      parsed.citation.prefix = prefix;
      citations.push(parsed.citation);
      findings.push(...parsed.findings);
    }
  }

  return { citations, findings };
}

export function deriveOperations(schema: ToolSchema): { key: string; label: string }[] {
  const ops: { key: string; label: string }[] = [];
  for (const value of schema.properties.action?.enum ?? []) {
    ops.push({ key: `action:${value}`, label: `action: ${value}` });
  }
  for (const value of schema.properties.operation?.enum ?? []) {
    ops.push({ key: `operation:${value}`, label: `operation: ${value}` });
  }
  for (const [name, prop] of Object.entries(schema.properties)) {
    if (prop.type === "boolean") ops.push({ key: `flag:${name}`, label: name });
  }
  for (const name of STRING_OPERATIONS[schema.slug] ?? []) {
    ops.push({ key: `string:${name}`, label: name });
  }
  return ops;
}

export function checkCoverage(
  schemas: ReadonlyMap<string, ToolSchema>,
  citations: readonly Citation[]
): Finding[] {
  const covered = new Set<string>();
  const citedTools = new Set<string>();
  for (const citation of citations) {
    citedTools.add(citation.tool);
    for (const key of citation.coverage) covered.add(`${citation.tool}:${key}`);
  }

  const findings: Finding[] = [];
  for (const schema of schemas.values()) {
    if (!citedTools.has(schema.slug)) {
      findings.push({
        code: "uncovered_tool",
        message: `\`${schema.slug}\` is registered by the tool surface but never cited in the routing surface`,
      });
    }
    for (const op of deriveOperations(schema)) {
      if (!covered.has(`${schema.slug}:${op.key}`)) {
        findings.push({
          code: "uncovered_operation",
          message: `\`${schema.slug} (${op.label})\` is declared by the tool but never cited in the routing surface`,
        });
      }
    }
  }
  return findings;
}

export function validateRoutingFiles(
  files: Readonly<Record<string, string>>,
  schemas: ReadonlyMap<string, ToolSchema>
): { citations: Citation[]; findings: Finding[] } {
  const citations: Citation[] = [];
  const findings: Finding[] = [];
  for (const [file, content] of Object.entries(files)) {
    if (!(file in FILE_PREFIX_POLICY)) {
      findings.push({ code: "unregistered_file", message: `${file} has no prefix policy` });
      continue;
    }
    const extracted = extractCitations(content, file, schemas);
    citations.push(...extracted.citations);
    findings.push(...extracted.findings);
  }
  findings.push(...checkCoverage(schemas, citations));
  return { citations, findings };
}
