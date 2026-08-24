import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

type Outline = { sections: { id: string; enabled: boolean }[] };
type SectionRenderer = (ctx: Ctx) => string;

interface Ctx {
  root: string;
  since: string | null; // YYYY.MM.DD of the previous issue, or null
  today: string; // YYYY.MM.DD
}

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

function readIf(filePath: string): string | null {
  return existsSync(filePath) ? readFileSync(filePath, "utf-8") : null;
}

// ── shared helpers ─────────────────────────────────────────────────────────

function changelogEntries(ctx: Ctx): { date: string; heading: string; body: string[] }[] {
  const raw = readIf(join(ctx.root, "CHANGELOG.md"));
  if (!raw) return [];
  const entries: { date: string; heading: string; body: string[] }[] = [];
  const lines = raw.split("\n");
  let current: { date: string; heading: string; body: string[] } | null = null;
  for (const line of lines) {
    const m = line.match(/^##\s+(\d{4})[.-](\d{2})[.-](\d{2})\b\s*(?:—|-)?\s*(.*)$/);
    if (m) {
      if (current) entries.push(current);
      current = {
        date: `${m[1]}.${m[2]}.${m[3]}`,
        heading: m[4]?.trim() ?? "",
        body: [],
      };
    } else if (current) {
      if (line.match(/^- /)) {
        current.body.push(line);
      } else if (line.match(/^\s{2,}\S/) && current.body.length > 0) {
        // Continuation of the previous wrapped bullet.
        current.body[current.body.length - 1] += "\n" + line.trimEnd();
      }
    }
  }
  if (current) entries.push(current);
  return entries;
}

// ── section renderers ──────────────────────────────────────────────────────

const renderShipped: SectionRenderer = (ctx) => {
  const entries = changelogEntries(ctx);
  const since = ctx.since;
  const selected = since
    ? entries.filter((e) => e.date >= since)
    : entries.slice(0, 5);
  if (selected.length === 0) {
    return "## What shipped\n\n_No releases since the previous issue._\n";
  }
  const lines = ["## What shipped", ""];
  for (const e of selected) {
    lines.push(`### ${e.date} — ${e.heading}`, "");
    for (const body of e.body) lines.push(body);
    lines.push("");
  }
  return lines.join("\n");
};

const renderUpcoming: SectionRenderer = (ctx) => {
  const raw = readIf(join(ctx.root, "ROADMAP.md"));
  if (!raw) return "## Upcoming\n\n_No roadmap file found._\n";
  // Strip the guidance HTML comment and leading "# Roadmap" heading.
  const body = raw
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/^#\s*Roadmap\s*\n+/i, "")
    .trim();
  return `## Upcoming\n\n${body}\n`;
};

const renderSpotlight: SectionRenderer = (_ctx) => {
  return [
    "## Spotlight",
    "",
    "_Placeholder — fill with this issue's research or feature spotlight.",
    "Drafted via the Infobroker research pipeline; approve before sending._",
    "",
  ].join("\n");
};

const renderMetrics: SectionRenderer = (ctx) => {
  // Infobroker has no spec-health-trends script; derive a minimal line from
  // the spec's REQ count via a lightweight parse of infobroker.md.
  const spec = readIf(join(ctx.root, "infobroker.md"));
  const reqCount = spec ? (spec.match(/\bREQ-\d{3}\b/g) ?? []).length : 0;
  const pkg = JSON.parse(readFileSync(join(ctx.root, "package.json"), "utf-8"));
  return (
    "## By the numbers\n\n" +
    `- Version: ${pkg.version}\n` +
    `- Requirements (unique REQ ids): ${reqCount}\n`
  );
};

const renderPlaceholder = (title: string): SectionRenderer => () => {
  return `## ${title}\n\n_Reserved — enable content for this section._\n`;
};

const renderers: Record<string, SectionRenderer> = {
  shipped: renderShipped,
  upcoming: renderUpcoming,
  spotlight: renderSpotlight,
  metrics: renderMetrics,
  qa: renderPlaceholder("Q&A"),
  community: renderPlaceholder("Community"),
  contributors: renderPlaceholder("Contributors"),
  links: renderPlaceholder("In case you missed it"),
};

// ── last-issue detection ───────────────────────────────────────────────────

function lastIssueDate(rootPath: string): string | null {
  const draftsDir = join(rootPath, "newsletter", "drafts");
  if (!existsSync(draftsDir)) return null;
  const files = readdirSync(draftsDir).filter((f) => /^\d{4}\.\d{2}\.\d{2}\.md$/.test(f));
  if (files.length === 0) return null;
  files.sort();
  return files[files.length - 1].slice(0, 10);
}

// ── main ───────────────────────────────────────────────────────────────────

function main(): void {
  const outlinePath = join(root, "newsletter", "outline.json");
  const outline = JSON.parse(readFileSync(outlinePath, "utf-8")) as Outline;
  const draftsDir = join(root, "newsletter", "drafts");
  mkdirSync(draftsDir, { recursive: true });

  const ctx: Ctx = { root, since: lastIssueDate(root), today: today() };

  const parts: string[] = [
    `# Newsletter — ${ctx.today}`,
    "",
  ];
  for (const section of outline.sections) {
    if (!section.enabled) continue;
    const render = renderers[section.id];
    if (!render) continue;
    const body = render(ctx).trim();
    if (body) parts.push(body, "", "---", "");
  }
  // Drop the trailing "---".
  while (parts.length && (parts[parts.length - 1] === "" || parts[parts.length - 1] === "---")) {
    parts.pop();
  }

  const outPath = join(draftsDir, `${ctx.today}.md`);
  writeFileSync(outPath, parts.join("\n").replace(/\n+$/, "\n"));
  console.log(`Newsletter draft written: ${outPath}`);
  for (const section of outline.sections) {
    console.log(`  ${section.enabled ? "on " : "off"}  ${section.id}`);
  }
}

main();
