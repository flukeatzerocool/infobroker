// non-goals.ts — scope non-goals parsing and integrity rules.
//
// Role: library (imported by the `check-non-goals` gate, `check-roadmap`, and
// `status`). Pure: no I/O and no process exit, so the rules are unit-testable.
//
// The open-web scope boundary is machine-read from the `## Scope Non-goals`
// block in `DECISIONS.md`; `ROADMAP.md` carries only a pointer to it. These
// rules check list integrity and pointer binding, not capability absence: a
// forbidden capability built inside an allowed provider still passes.

export const NON_GOALS_TITLE = "Non-goals";
export const SCOPE_BLOCK_TITLE = "Scope Non-goals";
export const MAX_POINTER_LINES = 2;

export interface Finding {
  line: number;
  rule: string;
}

export interface ScopeEntry {
  line: number;
  category: string;
  decision: string;
}

export interface SectionLine {
  line: number;
  text: string;
}

export interface Section {
  line: number;
  body: SectionLine[];
}

// `- <category> — D-NNN`, tolerating a hyphen or en dash as the separator. A
// non-greedy category with an anchored decision tail keeps an inner hyphen
// (e.g. "attack-surface") from being read as the separator.
const ENTRY_PATTERN = /^-\s+(.+?)\s+[—–-]{1,3}\s+(D-\d{3})\s*$/;
const DECISION_HEADING = /^###\s+(D-\d{3}):/;

// Locate a top-level `## <title>` section and capture its non-empty body
// lines. HTML comments and fenced code are skipped, so a documented example
// cannot satisfy or violate a rule. Capture ends at the next `## ` heading.
export function extractSection(text: string, title: string): Section | null {
  const lines = text.split(/\r?\n/);
  let inComment = false;
  let inFence = false;
  let capturing = false;
  let found: Section | null = null;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i] ?? "";

    if (inComment) {
      if (raw.includes("-->")) inComment = false;
      continue;
    }
    if (raw.trimStart().startsWith("<!--")) {
      if (!raw.includes("-->")) inComment = true;
      continue;
    }
    if (raw.trimStart().startsWith("```")) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    const heading = /^##\s+(.+?)\s*$/.exec(raw);
    if (heading) {
      if (capturing) break;
      if (heading[1] === title) {
        found = { line: i + 1, body: [] };
        capturing = true;
      }
      continue;
    }
    if (capturing && found !== null && raw.trim() !== "") {
      found.body.push({ line: i + 1, text: raw.trimEnd() });
    }
  }

  return found;
}

// Parse `- <category> — D-NNN` bullet lines out of a section body.
export function parseScopeEntries(body: SectionLine[]): ScopeEntry[] {
  const entries: ScopeEntry[] = [];
  for (const line of body) {
    const match = ENTRY_PATTERN.exec(line.text);
    if (match !== null) {
      entries.push({ line: line.line, category: (match[1] ?? "").trim(), decision: match[2] ?? "" });
    }
  }
  return entries;
}

// Decision IDs defined by `### D-NNN:` headings. A prose mention of an ID is
// not a definition and does not resolve.
export function decisionIds(text: string): Set<string> {
  const ids = new Set<string>();
  for (const line of text.split(/\r?\n/)) {
    const match = DECISION_HEADING.exec(line);
    if (match !== null) ids.add(match[1] ?? "");
  }
  return ids;
}

function normalizeCategory(category: string): string {
  return category.toLowerCase().replace(/\s+/g, " ").trim();
}

// Evaluate the scope non-goals block and the roadmap pointer. One finding per
// violated clause, each with a distinct rule string.
export function evaluateNonGoals(input: { decisions: string; roadmap: string }): Finding[] {
  const findings: Finding[] = [];
  const ids = decisionIds(input.decisions);

  const block = extractSection(input.decisions, SCOPE_BLOCK_TITLE);
  if (block === null) {
    findings.push({
      line: 1,
      rule: `DECISIONS.md has no \`## ${SCOPE_BLOCK_TITLE}\` block`,
    });
  } else {
    const entries = parseScopeEntries(block.body);
    if (entries.length === 0) {
      findings.push({
        line: block.line,
        rule: `\`## ${SCOPE_BLOCK_TITLE}\` has no entries — use one "- <category> — D-NNN" bullet per non-goal`,
      });
    }

    const seen = new Map<string, number>();
    for (const entry of entries) {
      if (!ids.has(entry.decision)) {
        findings.push({
          line: entry.line,
          rule: `cites ${entry.decision}, which is not a "### ${entry.decision}:" heading in DECISIONS.md`,
        });
      }
      const key = normalizeCategory(entry.category);
      const first = seen.get(key);
      if (first !== undefined) {
        findings.push({
          line: entry.line,
          rule: `duplicate category "${entry.category}" (first listed at line ${first})`,
        });
      } else {
        seen.set(key, entry.line);
      }
    }
  }

  const pointer = extractSection(input.roadmap, NON_GOALS_TITLE);
  if (pointer === null) {
    findings.push({
      line: 1,
      rule: `ROADMAP.md has no \`## ${NON_GOALS_TITLE}\` pointer section`,
    });
  } else {
    const firstBullet = pointer.body.find((line) => /^-\s+\S/.test(line.text));
    if (firstBullet !== undefined) {
      findings.push({
        line: firstBullet.line,
        rule: `\`## ${NON_GOALS_TITLE}\` must be a pointer, not a list — remove the bullet(s)`,
      });
    }

    const bodyText = pointer.body.map((line) => line.text).join(" ");
    if (!bodyText.includes("DECISIONS.md")) {
      findings.push({
        line: pointer.line,
        rule: `\`## ${NON_GOALS_TITLE}\` must name \`DECISIONS.md\``,
      });
    }
    if (!bodyText.includes(SCOPE_BLOCK_TITLE)) {
      findings.push({
        line: pointer.line,
        rule: `\`## ${NON_GOALS_TITLE}\` must name the \`## ${SCOPE_BLOCK_TITLE}\` block`,
      });
    }
    if (pointer.body.length > MAX_POINTER_LINES) {
      const over = pointer.body[MAX_POINTER_LINES];
      findings.push({
        line: over === undefined ? pointer.line : over.line,
        rule: `\`## ${NON_GOALS_TITLE}\` is ${pointer.body.length} lines; a pointer is at most ${MAX_POINTER_LINES}`,
      });
    }
  }

  return findings;
}
