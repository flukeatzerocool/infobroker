// non-goals.test — unit tests for the scope non-goals integrity rules.
// Role: test. Vitest discovers scripts/**/*.test.ts via vitest.config.ts.

import { describe, expect, it } from "vitest";
import {
  decisionIds,
  evaluateNonGoals,
  extractSection,
  MAX_POINTER_LINES,
  NON_GOALS_TITLE,
  SCOPE_BLOCK_TITLE,
} from "./non-goals.js";

const DECISIONS_HEAD = `# DECISIONS.md

## Active Decisions

### D-089: Something Recent (2026.11.07)

Prose mentioning D-999, which is not a heading.

### D-061: Open-Web Scope Boundary (2026.10.26)

Prose.

## Spec Waivers

- (none)
`;

const BLOCK = `## ${SCOPE_BLOCK_TITLE}

Gate-checked.

- SOCMINT platform collection — D-061
- Corporate registries — D-061
`;

const POINTER = `## ${NON_GOALS_TITLE}

Open-web scope boundary; the authoritative list lives in \`DECISIONS.md\`
under \`## ${SCOPE_BLOCK_TITLE}\`.
`;

function decisions(block: string = BLOCK): string {
  return `${DECISIONS_HEAD}\n${block}`;
}

function roadmap(pointer: string = POINTER): string {
  return `# Roadmap

## Scheduled work

- one thing

**Trigger:** when it starts.

${pointer}`;
}

describe("evaluateNonGoals", () => {
  it("accepts an intact block and a short pointer", () => {
    expect(evaluateNonGoals({ decisions: decisions(), roadmap: roadmap() })).toEqual([]);
  });

  it("finds a missing block", () => {
    const findings = evaluateNonGoals({ decisions: DECISIONS_HEAD, roadmap: roadmap() });
    expect(findings).toHaveLength(1);
    expect(findings[0]?.rule).toContain(`no \`## ${SCOPE_BLOCK_TITLE}\` block`);
  });

  it("finds an empty block", () => {
    const findings = evaluateNonGoals({
      decisions: decisions(`## ${SCOPE_BLOCK_TITLE}\n\nGate-checked.\n`),
      roadmap: roadmap(),
    });
    expect(findings).toHaveLength(1);
    expect(findings[0]?.rule).toContain("has no entries");
  });

  it("finds an entry citing a decision that is not a heading", () => {
    const findings = evaluateNonGoals({
      decisions: decisions(`## ${SCOPE_BLOCK_TITLE}\n\n- Breach indexes — D-999\n`),
      roadmap: roadmap(),
    });
    expect(findings).toHaveLength(1);
    expect(findings[0]?.rule).toContain("D-999");
  });

  it("does not resolve an ID that appears only in prose", () => {
    const ids = decisionIds(DECISIONS_HEAD);
    expect(ids.has("D-999")).toBe(false);
    expect(ids.has("D-061")).toBe(true);
  });

  it("finds a duplicate category regardless of case and spacing", () => {
    const findings = evaluateNonGoals({
      decisions: decisions(
        `## ${SCOPE_BLOCK_TITLE}\n\n- Breach  Indexes — D-061\n- breach indexes — D-061\n`,
      ),
      roadmap: roadmap(),
    });
    expect(findings).toHaveLength(1);
    expect(findings[0]?.rule).toContain("duplicate category");
  });

  it("rejects a roadmap list instead of a pointer", () => {
    const findings = evaluateNonGoals({
      decisions: decisions(),
      roadmap: roadmap(`## ${NON_GOALS_TITLE}\n\n- no SOCMINT\n`),
    });
    expect(findings.some((f) => f.rule.includes("must be a pointer, not a list"))).toBe(true);
  });

  it("requires the pointer to name DECISIONS.md", () => {
    const findings = evaluateNonGoals({
      decisions: decisions(),
      roadmap: roadmap(`## ${NON_GOALS_TITLE}\n\nScope boundary; see \`${SCOPE_BLOCK_TITLE}\`.\n`),
    });
    expect(findings).toHaveLength(1);
    expect(findings[0]?.rule).toContain("must name `DECISIONS.md`");
  });

  it("requires the pointer to name the block", () => {
    const findings = evaluateNonGoals({
      decisions: decisions(),
      roadmap: roadmap(`## ${NON_GOALS_TITLE}\n\nScope boundary; see \`DECISIONS.md\`.\n`),
    });
    expect(findings).toHaveLength(1);
    expect(findings[0]?.rule).toContain(`must name the \`## ${SCOPE_BLOCK_TITLE}\` block`);
  });

  it("rejects a pointer longer than the line budget", () => {
    const findings = evaluateNonGoals({
      decisions: decisions(),
      roadmap: roadmap(
        `## ${NON_GOALS_TITLE}\n\nOne\nTwo \`DECISIONS.md\` \`${SCOPE_BLOCK_TITLE}\`\nThree\n`,
      ),
    });
    expect(findings).toHaveLength(1);
    expect(findings[0]?.rule).toContain(`at most ${MAX_POINTER_LINES}`);
  });

  it("finds a missing roadmap pointer section", () => {
    const findings = evaluateNonGoals({
      decisions: decisions(),
      roadmap: `# Roadmap\n\n## Scheduled work\n\n- one thing\n\n**Trigger:** when.\n`,
    });
    expect(findings).toHaveLength(1);
    expect(findings[0]?.rule).toContain(`no \`## ${NON_GOALS_TITLE}\` pointer section`);
  });

  it("ignores a block that only appears inside an HTML comment or fence", () => {
    const commented = decisions(`<!--\n${BLOCK}-->\n`);
    expect(extractSection(commented, SCOPE_BLOCK_TITLE)).toBeNull();

    const fenced = decisions("```\n" + BLOCK + "```\n");
    expect(extractSection(fenced, SCOPE_BLOCK_TITLE)).toBeNull();
  });
});
