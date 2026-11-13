// @implements REQ-055
// Clause-coverage detection for the G3 gate. It is pure and unit-tested so that the
// gate itself is provably able to catch the "unimplemented branch" regression
// class (REQ-013's degraded "or" legs, REQ-003's "when ... declares" dead
// conditional). See scripts/validate-spec.ts for the calling gate.

export interface ClauseRequirements {
  // Number of "or"-joined outcome branches the body defines: parenthesized
  // enumerations plus unparenthesized class lists introduced by a determiner
  // inside a WHEN clause.
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

// A prose class list is an unparenthesized alternative enumeration of target
// classes ("a loopback, private, link-local, or metadata address"). The shape
// is deliberately narrow so value unions and conjunctions do not match:
// a WHEN clause, a determiner-introduced list, single-word legs before the
// final "or", and a shared head noun on the last leg.
const WHEN_CLAUSE_RE = /\bWHEN\b[^.]*/gi;
const INTRODUCER_RE = /\b(?:a|an)\s+/gi;
const LIST_TERMINATOR_RE = /^(?:the|this|that|these|those|its|their|it|they|he|she|we|you)\b/i;
const OR_SEPARATOR_RE = /(?:^|\s)or\s+/i;
const FINAL_LEG_STOP_WORDS = new Set(["rather", "than", "that", "which", "whose", "when"]);
// A class list enumerates targets or conditions, introduced by a state
// predicate or an appositive dash/colon. An action verb ("select a place,
// fact, ...") enumerates selectable values, not classes, and is excluded.
const CLASS_INTRO_RE = /(?:^|[\s(])(?:is|are|was|were|resolves? to|indicates?|means)\s+$/i;
const APPOSITIVE_RE = /[—:]\s*$/;

function detectProseClassLists(prose: string): number {
  let total = 0;
  for (const clause of prose.match(WHEN_CLAUSE_RE) ?? []) {
    const starts: Array<{ prefixEnd: number; listStart: number }> = [];
    for (const intro of clause.matchAll(INTRODUCER_RE)) {
      starts.push({ prefixEnd: intro.index, listStart: intro.index + intro[0].length });
    }

    for (const { prefixEnd, listStart } of starts.reverse()) {
      const prefix = clause.slice(0, prefixEnd);
      if (!CLASS_INTRO_RE.test(prefix) && !APPOSITIVE_RE.test(prefix)) continue;
      const rest = clause.slice(listStart);
      if (!OR_SEPARATOR_RE.test(rest)) continue;

      const listSegments: string[] = [];
      for (const segment of rest.split(/\s*,\s*/)) {
        const trimmed = segment.trim();
        if (listSegments.length > 0 && LIST_TERMINATOR_RE.test(trimmed)) break;
        listSegments.push(trimmed);
        if (OR_SEPARATOR_RE.test(trimmed)) break;
      }

      const last = listSegments[listSegments.length - 1] ?? "";
      if (!OR_SEPARATOR_RE.test(last)) continue;

      const legs = listSegments
        .join(", ")
        .replace(/\s+or\s+/g, ", ")
        .split(/\s*,\s*/)
        .map((leg) => leg.trim())
        .filter(Boolean);
      if (legs.length < 3) continue;
      if (!legs.slice(0, -1).every((leg) => /^[\w-]+$/.test(leg))) continue;

      const trimmedTail: string[] = [];
      for (const word of legs[legs.length - 1].split(/\s+/).filter(Boolean)) {
        if (FINAL_LEG_STOP_WORDS.has(word.toLowerCase().replace(/[^\w-]/g, ""))) break;
        trimmedTail.push(word);
      }
      if (trimmedTail.length < 1 || trimmedTail.length > 3) continue;

      total += legs.length;
      break;
    }
  }
  return total;
}

export function detectClauseRequirements(prose: string): ClauseRequirements {
  let orBranches = 0;
  for (const grp of prose.matchAll(OR_ENUM_RE)) {
    const inner = grp[1];
    if (inner.includes("`")) continue;
    const parts = inner.split(/\s+or\s+/);
    if (parts.length >= 2) orBranches += parts.length;
  }
  orBranches += detectProseClassLists(prose);

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
// clause count. Returns null when covered; otherwise the violation. The or-branch
// rule is one named tag per detected branch (REQ-055 / §9.4), not "any two".
export function evaluateClauseCoverage(
  reqId: string,
  req: ClauseRequirements,
  taggedCount: number
): ClauseCoverageViolation | null {
  if (req.orBranches >= 2 && taggedCount < req.orBranches) {
    return { reqId, kind: "or-branches" };
  }
  if (req.conditionals >= 1 && taggedCount < 1) {
    return { reqId, kind: "conditional" };
  }
  return null;
}
