#!/usr/bin/env npx tsx
// check-roadmap.ts — gate: `ROADMAP.md` holds scheduled work only.
//
// Role: gate (wired into `npm run check`). Each `## <title>` section is a
// scheduled work item: it carries 1–3 bullet lines and a `**Trigger:**` line
// naming what starts or closes the work. A section titled exactly `Non-goals`
// is exempt — it is a pointer to the scope decision, not work. Standing facts
// (accepted advisories, by-design limitations) belong in `DECISIONS.md`, so
// this gate is what stops them accumulating on the roadmap again.
//
// Exit codes: 0 = every item satisfies the admission rule; 1 = a finding;
// 2 = fatal (unreadable file, unknown flag).

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { handleHelp } from "./lib/args.js";

const ROOT = join(import.meta.dirname, "..");
const ROADMAP = join(ROOT, "ROADMAP.md");
const EXEMPT = "Non-goals";
const MAX_BULLETS = 3;

const USAGE = `check-roadmap — roadmap admission-rule gate

Usage:
  check-roadmap [--json] [--help]

Every \`## <title>\` section in ROADMAP.md must hold 1–${MAX_BULLETS} bullet lines
and a \`**Trigger:**\` line naming what starts or closes the work. A section
titled \`${EXEMPT}\` is exempt. Standing facts belong in DECISIONS.md.

Exit codes: 0 = pass; 1 = finding; 2 = fatal.
`;

interface Finding {
  line: number;
  rule: string;
}

interface Section {
  title: string;
  line: number;
  bullets: number[];
  triggers: number[];
}

// Parse sections while ignoring HTML comments and fenced code blocks, so a
// documented example cannot satisfy or violate the rule.
function parseSections(text: string): Section[] {
  const lines = text.split(/\r?\n/);
  const sections: Section[] = [];
  let inComment = false;
  let inFence = false;
  let current: Section | null = null;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw ?? "";

    if (inComment) {
      if (line.includes("-->")) inComment = false;
      continue;
    }
    if (line.trimStart().startsWith("<!--")) {
      if (!line.includes("-->")) inComment = true;
      continue;
    }
    if (line.trimStart().startsWith("```")) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    const heading = /^##\s+(.+?)\s*$/.exec(line);
    if (heading) {
      current = { title: heading[1] ?? "", line: i + 1, bullets: [], triggers: [] };
      sections.push(current);
      continue;
    }
    if (!current) continue;

    if (/^-\s+\S/.test(line)) current.bullets.push(i + 1);
    if (/^\*\*Trigger:\*\*\s+\S/.test(line)) current.triggers.push(i + 1);
  }

  return sections;
}

function evaluate(sections: Section[]): Finding[] {
  const findings: Finding[] = [];

  for (const section of sections) {
    if (section.title === EXEMPT) continue;

    if (section.bullets.length === 0) {
      findings.push({
        line: section.line,
        rule: `"${section.title}" has no bullet lines — a roadmap item needs 1–${MAX_BULLETS} bullets`,
      });
    } else if (section.bullets.length > MAX_BULLETS) {
      findings.push({
        line: section.bullets[MAX_BULLETS] ?? section.line,
        rule: `"${section.title}" has ${section.bullets.length} bullets — the limit is ${MAX_BULLETS}`,
      });
    }

    if (section.triggers.length === 0) {
      findings.push({
        line: section.line,
        rule: `"${section.title}" has no \`**Trigger:**\` line — name what starts or closes the work`,
      });
    }
  }

  return findings;
}

const argv = process.argv.slice(2);
handleHelp(argv, USAGE);
for (const arg of argv) {
  if (arg !== "--json") {
    process.stderr.write(`check-roadmap: unknown flag ${arg}\n\n${USAGE}`);
    process.exit(2);
  }
}
const json = argv.includes("--json");

let text: string;
try {
  text = readFileSync(ROADMAP, "utf8");
} catch (err) {
  process.stderr.write(`check-roadmap: cannot read ${ROADMAP}: ${(err as Error).message}\n`);
  process.exit(2);
}

const sections = parseSections(text);
const findings = evaluate(sections);

if (json) {
  process.stdout.write(`${JSON.stringify({ file: "ROADMAP.md", sections: sections.length, findings }, null, 2)}\n`);
} else if (findings.length > 0) {
  process.stdout.write(`ROADMAP.md — ${findings.length} finding(s):\n`);
  for (const finding of findings) {
    process.stdout.write(`  ROADMAP.md:${finding.line}: ${finding.rule}\n`);
  }
} else {
  process.stdout.write(`  OK  ROADMAP.md satisfies the admission rule (${sections.length} section(s))\n`);
}

process.exit(findings.length > 0 ? 1 : 0);
