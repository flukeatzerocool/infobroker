#!/usr/bin/env npx tsx
import {
  readReadme, extractHeadings, extractLinks, extractBlockquotes,
  extractBulletLists, proseOnly, proseLines, slugify,
} from "./lib/parse-readme.js";

const toolNames = [
  "infobroker_web_search", "infobroker_fetch_page",
  "infobroker_search_suggestions", "infobroker_choose_provider",
  "infobroker_list_providers", "infobroker_provider_health",
  "infobroker_converge", "infobroker_reload_config",
  "infobroker_spec_health",
];

interface Issue {
  line?: number;
  error: boolean;
  msg: string;
}

function checkDesignComment(text: string): Issue[] {
  const issues: Issue[] = [];
  const lines = text.split("\n");
  let commentStart = -1;
  let commentEnd = -1;
  for (let i = 0; i < Math.min(lines.length, 60); i++) {
    if (lines[i].trim().startsWith("<!--")) commentStart = i;
    if (lines[i].trim().endsWith("-->") && commentStart !== -1) {
      commentEnd = i;
      break;
    }
  }
  if (commentStart === -1) {
    issues.push({ error: true, msg: "README DESIGN HTML comment missing — must appear within first 60 lines" });
    return issues;
  }
  if (commentEnd === -1 || commentEnd - commentStart < 3) {
    issues.push({ error: true, msg: "README DESIGN HTML comment is too short — missing expected design rules" });
    return issues;
  }
  const commentBody = lines.slice(commentStart, commentEnd + 1).join("\n");
  const requiredKeys = ["Voice:", "Demo:", "Structure:", "Audience split:"];
  for (const key of requiredKeys) {
    if (!commentBody.includes(key)) {
      issues.push({ error: true, msg: `README DESIGN comment missing '${key}' section` });
    }
  }
  if (!commentBody.includes("No repetition.")) {
    issues.push({ error: false, msg: "README DESIGN comment missing 'No repetition.' clause" });
  }
  return issues;
}

function checkHeadingOrder(text: string): Issue[] {
  const issues: Issue[] = [];
  const headings = extractHeadings(text);

  if (headings.length === 0) {
    issues.push({ error: true, msg: "No ATX headings found" });
    return issues;
  }

  const h1 = headings[0];
  if (h1.level !== 1 || !h1.title.startsWith("Infobroker")) {
    issues.push({ line: h1.line, error: true, msg: `First heading must be '# Infobroker', got '# ${h1.title}'` });
  }

  const expected: { level: number; title: string }[] = [
    { level: 1, title: "Infobroker" },
    { level: 2, title: "North Star" },
    { level: 2, title: "Quick Start" },
    { level: 2, title: "MCP Server" },
    { level: 2, title: "Providers" },
    { level: 2, title: "Configuration" },
    { level: 2, title: "How It Compares" },
    { level: 2, title: "Contribute" },
    { level: 2, title: "License" },
    { level: 2, title: "Spec" },
  ];

  let expIdx = 0;
  for (let i = 0; i < headings.length && expIdx < expected.length; i++) {
    if (headings[i].title === expected[expIdx].title) {
      if (headings[i].level !== expected[expIdx].level) {
        issues.push({
          line: headings[i].line,
          error: true,
          msg: `Heading '${headings[i].title}' is h${headings[i].level}, expected h${expected[expIdx].level}`,
        });
      }
      expIdx++;
    }
  }

  if (expIdx < expected.length) {
    const missing = expected.slice(expIdx).map((e) => `'${e.title}'`).join(", ");
    issues.push({ error: true, msg: `Missing expected section(s): ${missing}` });
  }

  const headingTitles = headings.map((h) => h.title);
  for (const h of headings) {
    if (h.level === 3) continue;
    if (!expected.some((e) => e.title === h.title) && !headingTitles.slice(0, headings.indexOf(h)).includes(h.title)) {
      issues.push({
        line: h.line,
        error: false,
        msg: `Unexpected h2 heading '${h.title}' — not in canonical section list`,
      });
    }
  }

  const licenseIdx = headings.findIndex((h) => h.title === "License");
  const specIdx = headings.findIndex((h) => h.title === "Spec");
  const contributeIdx = headings.findIndex((h) => h.title === "Contribute");
  if (licenseIdx !== -1 && contributeIdx !== -1 && licenseIdx < contributeIdx) {
    issues.push({ line: headings[licenseIdx].line, error: true, msg: "## License must appear after ## Contribute" });
  }
  if (specIdx !== -1 && licenseIdx !== -1 && specIdx < licenseIdx) {
    issues.push({ line: headings[specIdx].line, error: true, msg: "## Spec must appear after ## License" });
  }

  return issues;
}

function checkNoSetextHeadings(text: string): Issue[] {
  const issues: Issue[] = [];
  let previousLine = "";
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (/^=+$/.test(trimmed) && previousLine.trim().length > 0 && !previousLine.trim().startsWith("```")) {
      issues.push({ line: i, error: true, msg: `Setext h1 heading (===) at line ${i + 1} — use ATX instead` });
    }
    if (/^-{3,}$/.test(trimmed) && previousLine.trim().length > 0 && !previousLine.trim().startsWith("```")) {
      issues.push({ line: i, error: true, msg: `Possible setext h2 heading (---) at line ${i + 1} — use ATX instead` });
    }
    previousLine = lines[i];
  }
  return issues;
}

function checkToolNamesInProse(text: string): Issue[] {
  const issues: Issue[] = [];
  const plines = proseLines(text);

  for (const { line, content } of plines) {
    for (const tool of toolNames) {
      const re = new RegExp(`(?<!\`)\\b${tool.replace(/_/g, "_")}\\b(?![^<]*(?:</code>|</span>))`);
      if (re.test(content) && !content.includes(`\`${tool}\``)) {
        issues.push({
          line,
          error: true,
          msg: `Tool name '${tool}' in prose at line ${line} — use natural-language prompts instead`,
        });
      }
    }
  }

  return issues;
}

function checkFeatureLists(text: string): Issue[] {
  const issues: Issue[] = [];
  const lists = extractBulletLists(text);

  const contributeIdx = text.indexOf("## Contribute");
  const contributeEndIdx = text.indexOf("## License");
  const contributeRange = contributeIdx !== -1 && contributeEndIdx !== -1
    ? [contributeIdx, contributeEndIdx] : null;

  for (const list of lists) {
    if (list.items.length >= 3) {
      const listCharIndex = text.split("\n").slice(0, list.startLine - 1).join("\n").length;
      if (contributeRange && listCharIndex >= contributeRange[0] && listCharIndex <= contributeRange[1]) {
        continue;
      }
      issues.push({
        line: list.startLine,
        error: false,
        msg: `${list.items.length}-item bullet list at line ${list.startLine} — may be a feature list; 'No feature lists.' per design comment`,
      });
    }
  }

  return issues;
}

function checkInternalLinks(text: string): Issue[] {
  const issues: Issue[] = [];
  const links = extractLinks(text);
  const headings = extractHeadings(text);
  const headingSlugs = new Set(headings.map((h) => slugify(h.title)));

  for (const link of links) {
    if (link.url.startsWith("#") && link.url.length > 1) {
      const targetSlug = link.url.slice(1);
      if (!headingSlugs.has(targetSlug)) {
        issues.push({
          line: link.line,
          error: true,
          msg: `Internal link '#${targetSlug}' at line ${link.line} does not match any heading slug`,
        });
      }
    }
  }

  return issues;
}

function checkVoiceDrift(text: string): Issue[] {
  const issues: Issue[] = [];
  const plines = proseLines(text);
  const firstPersonRe = /\b(we|us|I)\b/g;

  for (const { line, content } of plines) {
    if (content.trim().startsWith(">")) continue;
    let match: RegExpExecArray | null;
    while ((match = firstPersonRe.exec(content)) !== null) {
      const ctx = content.slice(Math.max(0, match.index - 20), match.index + match[0].length + 20);
      issues.push({
        line,
        error: false,
        msg: `First-person '${match[1]}' at line ${line} — design comment specifies direct address ('you'): "...${ctx}..."`,
      });
    }
  }

  return issues;
}

function checkNearDuplicates(text: string): Issue[] {
  const issues: Issue[] = [];
  const prose = proseOnly(text);
  const sentences = prose.split(/(?<=[.!?])\s+/);

  for (let i = 0; i < sentences.length; i++) {
    const aWords = sentences[i].toLowerCase().split(/\s+/).filter((w) => w.length > 3);
    if (aWords.length < 3) continue;
    const aSet = new Set(aWords);
    for (let j = i + 1; j < sentences.length; j++) {
      const bWords = sentences[j].toLowerCase().split(/\s+/).filter((w) => w.length > 3);
      if (bWords.length < 3) continue;
      const bSet = new Set(bWords);
      if (aSet.size === 0 || bSet.size === 0) continue;
      const intersection = [...aSet].filter((w) => bSet.has(w)).length;
      const union = aSet.size + bSet.size - intersection;
      const jaccard = union > 0 ? intersection / union : 0;
      if (jaccard >= 0.7) {
        issues.push({
          error: false,
          msg: `Near-duplicate sentences (${(jaccard * 100).toFixed(0)}% word overlap): "${sentences[i].slice(0, 80)}" ≈ "${sentences[j].slice(0, 80)}"`,
        });
        break;
      }
    }
  }

  return issues;
}

function checkExternalLinks(text: string): Issue[] {
  const issues: Issue[] = [];
  const links = extractLinks(text);
  const externals = links.filter((l) => l.url.startsWith("http"));

  if (externals.length === 0) {
    issues.push({ error: false, msg: "No external links found — verify manually" });
    return issues;
  }

  const domains = new Map<string, number>();
  for (const link of externals) {
    try {
      const url = new URL(link.url);
      domains.set(url.hostname, (domains.get(url.hostname) || 0) + 1);
    } catch {
      issues.push({ line: link.line, error: false, msg: `Potentially malformed external URL '${link.url}' at line ${link.line}` });
    }
  }

  for (const [domain, count] of domains) {
    if (count > 1) {
      issues.push({ error: false, msg: `Domain '${domain}' linked ${count} times — verify deduplication` });
    }
  }

  if (domains.size < 2) {
    issues.push({ error: false, msg: `Only ${domains.size} external domain(s) referenced — verify scope` });
  }

  return issues;
}

function checkComparisonTable(text: string): Issue[] {
  const issues: Issue[] = [];
  const compareIdx = text.indexOf("## How It Compares");
  if (compareIdx === -1) {
    issues.push({ error: true, msg: "'## How It Compares' section not found" });
    return issues;
  }

  const nextHeadingRe = /^##\s/m;
  const nextMatch = text.slice(compareIdx + 1).match(nextHeadingRe);
  const section = nextMatch ? text.slice(compareIdx, compareIdx + nextMatch.index!) : text.slice(compareIdx);

  const lines = section.split("\n");
  let headerFound = false;
  let colCount = 0;
  let rowCount = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("| Tool") && trimmed.includes("Infobroker")) {
      headerFound = true;
      colCount = trimmed.split("|").filter((c) => c.trim().length > 0).length;
      continue;
    }
    if (trimmed.startsWith("| ---")) continue;
    if (trimmed.startsWith("|") && headerFound && trimmed.length > 2) {
      const cols = trimmed.split("|").filter((c) => c.trim().length > 0);
      if (cols.length !== colCount) {
        issues.push({ error: false, msg: `Comparison table row has ${cols.length} columns, expected ${colCount}` });
      }
      rowCount++;
    }
  }

  if (!headerFound) {
    issues.push({ error: true, msg: "Comparison table header not found — expected 'Tool | What you're used to | How Infobroker differs'" });
  }

  if (rowCount < 4) {
    issues.push({ error: false, msg: `Comparison table has ${rowCount} data rows — expected at least 4` });
  }

  return issues;
}

function checkSectionLengths(text: string): Issue[] {
  const issues: Issue[] = [];
  const headings = extractHeadings(text);
  const lines = text.split("\n");

  for (let i = 0; i < headings.length; i++) {
    const startLine = headings[i].line;
    const endLine = i + 1 < headings.length ? headings[i + 1].line - 1 : lines.length;

    let wordCount = 0;
    let inBlock = false;
    for (let j = startLine - 1; j < endLine; j++) {
      if (lines[j].trim().startsWith("```")) {
        inBlock = !inBlock;
        continue;
      }
      if (inBlock) continue;
      const trimmed = lines[j].trim();
      if (trimmed.startsWith(">")) continue;
      if (/^\s*\|/.test(lines[j])) continue;
      if (/^\s*<!--/.test(lines[j])) continue;
      wordCount += trimmed.split(/\s+/).filter((w) => w.length > 0).length;
    }

    if (headings[i].level === 3) continue;

    const hasH3Children = headings.some((h) =>
      h.level === 3 &&
      h.line > headings[i].line &&
      (i + 1 >= headings.length || h.line < (headings.slice(i + 1).find((nh) => nh.level <= headings[i].level)?.line ?? Infinity))
    );
    if (hasH3Children) continue;

    if (headings[i].title === "Infobroker") {
      if (wordCount > 200) {
        issues.push({ error: false, msg: `Hero section is ${wordCount} words — may be growing too long (suggest ≤200)` });
      }
      continue;
    }

    if (headings[i].title === "North Star") {
      if (wordCount > 100) {
        issues.push({ error: false, msg: `North Star section is ${wordCount} words — suggest ≤100 for a single short paragraph (README design comment)` });
      }
      continue;
    }

    const hasTable = lines.slice(startLine - 1, endLine).some((l) => /^\s*\|.*\|/.test(l));
    if (wordCount < 30 && !hasTable) {
      issues.push({ error: false, msg: `Section '${headings[i].title}' is ${wordCount} words — may be underdeveloped (suggest ≥30)` });
    }
    if (wordCount > 350) {
      issues.push({ error: false, msg: `Section '${headings[i].title}' is ${wordCount} words — may be growing too long (suggest ≤350)` });
    }
  }

  return issues;
}

function checkTaxonomyLink(text: string): Issue[] {
  const issues: Issue[] = [];
  if (!text.includes("feature-taxonomy")) {
    issues.push({ error: true, msg: "README missing link to the feature taxonomy (§D) — REQ-078 requires the README link to the taxonomy" });
  }
  if (!/#\s*Knowledge Base\b/m.test(text) && !text.includes("### Knowledge Base")) {
    issues.push({ error: true, msg: "README missing 'Knowledge Base' feature section in §3" });
  }
  return issues;
}

function main(): void {
  const text = readReadme();
  let errors = 0;
  let warnings = 0;

  const checks: { name: string; run: (t: string) => Issue[]; severity: string }[] = [
    { name: "Design comment", run: checkDesignComment, severity: "hard" },
    { name: "Section heading order", run: checkHeadingOrder, severity: "hard" },
    { name: "No setext headings", run: checkNoSetextHeadings, severity: "hard" },
    { name: "Tool names in prose", run: checkToolNamesInProse, severity: "hard" },
    { name: "Feature lists", run: checkFeatureLists, severity: "soft" },
    { name: "Internal links", run: checkInternalLinks, severity: "hard" },
    { name: "Voice drift", run: checkVoiceDrift, severity: "soft" },
    { name: "Near-duplicate sentences", run: checkNearDuplicates, severity: "soft" },
    { name: "External links", run: checkExternalLinks, severity: "soft" },
    { name: "Comparison table", run: checkComparisonTable, severity: "soft" },
    { name: "Section lengths", run: checkSectionLengths, severity: "soft" },
    { name: "Taxonomy link", run: checkTaxonomyLink, severity: "hard" },
  ];

  for (const { name, run, severity } of checks) {
    const issues = run(text);
    if (issues.length > 0) {
      console.log(`\n--- ${name} ---`);
      for (const issue of issues) {
        const prefix = severity === "hard" && issue.error ? "ERROR" : "WARNING";
        if (severity === "hard" && issue.error) errors++;
        else warnings++;
        console.log(`${prefix}: ${issue.msg}`);
      }
    } else {
      console.log(`PASS: ${name}`);
    }
  }

  console.log(`\n${errors} error(s), ${warnings} warning(s)`);
  if (errors > 0) {
    process.exit(1);
  }
}

main();
