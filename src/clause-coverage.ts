// @implements REQ-055
// Clause-coverage detection for the G3 gate. Pure and unit-tested so that the
// gate itself is provably able to catch the "unimplemented branch" regression
// class (REQ-013's degraded "or" legs, REQ-003's "when ... declares" dead
// conditional). See scripts/validate-spec.ts for the calling gate.

export interface ClauseRequirements {
  // Number of "or"-joined parenthesized outcome branches the body defines.
  orBranches: number;
  // Number of "when ... declares" conditionals the body contains.
  conditionals: number;
}

// Detect "or"-joined parenthesized outcome enumerations, excluding groups that
// contain backticks (those enumerate a value/type union like `"ok"` or
// `"error"`, not independently implementable behavior).
const OR_ENUM_RE = /\(([^)\n]*)\)/g;

// Detect a "when ... declares" conditional that gates behavior on a provider
// or configuration declaration — the signature of never-triggered dead code.
const CONDITIONAL_RE = /\bwhen\b[^.\n]*?\bdeclares\b/gi;

export function detectClauseRequirements(prose: string): ClauseRequirements {
  let orBranches = 0;
  for (const grp of prose.matchAll(OR_ENUM_RE)) {
    const inner = grp[1];
    if (inner.includes("`")) continue;
    const parts = inner.split(/\s+or\s+/);
    if (parts.length >= 2) orBranches += parts.length;
  }

  const conditionals = prose.match(CONDITIONAL_RE)?.length ?? 0;

  return { orBranches, conditionals };
}

// Extract clause tags from an `@implements` payload line: pairs where a
// `REQ-NNN` token is immediately followed by a non-REQ word (the branch slug).
export function clauseTagsFromPayload(payload: string): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  const tokens = payload.split(/\s+/).filter(Boolean);
  for (let i = 0; i < tokens.length; i++) {
    const reqMatch = tokens[i].match(/^REQ-\d{3}[a-z]?$/);
    if (!reqMatch) continue;
    const next = tokens[i + 1];
    if (next && !/^REQ-\d{3}[a-z]?$/.test(next)) {
      if (!out.has(reqMatch[0])) out.set(reqMatch[0], new Set());
      out.get(reqMatch[0])!.add(next);
    }
  }
  return out;
}

export interface ClauseCoverageViolation {
  reqId: string;
  kind: "or-branches" | "conditional";
}

// Evaluate whether a REQ's clause requirements are satisfied by its tagged
// clause count. Returns null when covered; otherwise the violation.
export function evaluateClauseCoverage(
  reqId: string,
  req: ClauseRequirements,
  taggedCount: number
): ClauseCoverageViolation | null {
  if (req.orBranches >= 2 && taggedCount < 2) {
    return { reqId, kind: "or-branches" };
  }
  if (req.conditionals >= 1 && taggedCount < 1) {
    return { reqId, kind: "conditional" };
  }
  return null;
}
