// provider-map.ts — derive skills/infobroker/references/provider-map.md from
// config.json (dispatch chains and provider capabilities). Deterministic; no
// network; no wall-clock input. Reused by validate-spec's staleness gate and
// the generate-provider-map build tool.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";

const __dirname = import.meta.dirname;
const ROOT = join(__dirname, "..", "..");

// Provider slugs that are infrastructure/fallback renderers rather than
// user-facing providers documented in the references. Matches the README
// validator's PROVIDER_EXCLUSIONS (scripts/lib/parse-readme.ts).
export const PROVIDER_EXCLUSIONS = new Set(["native_fetch"]);

export interface ProviderEntry {
  tier: string;
  capabilities: string[];
  auth_env?: string;
  url_env?: string;
}

export interface Config {
  providers: Record<string, ProviderEntry>;
  dispatch?: Record<string, string[]>;
}

export function readConfig(): Config {
  const configPath = join(ROOT, "config.json");
  return JSON.parse(readFileSync(configPath, "utf-8")) as Config;
}

// Display names used by both the task table and the capabilities table.
// Unknown slugs fall back to the slug with underscores as spaces.
export const PROVIDER_DISPLAY_NAMES: Record<string, string> = {
  duckduckgo: "DuckDuckGo",
  jina: "Jina Reader",
  wikipedia: "Wikipedia",
  wiktionary: "Wiktionary",
  wikidata: "Wikidata",
  openstreetmap: "OpenStreetMap",
  internet_archive: "Internet Archive",
  arxiv: "arXiv",
  semantic_scholar: "Semantic Scholar",
  stack_exchange: "Stack Exchange",
  github: "GitHub",
  core: "CORE",
  marginalia: "Marginalia",
  mojeek: "Mojeek",
  wiby: "Wiby",
  openalex: "OpenAlex",
  europe_pmc: "Europe PMC",
  hacker_news: "Hacker News",
  gdelt: "GDELT",
  sec_edgar: "SEC EDGAR",
  world_bank: "World Bank",
  brave: "Brave",
  exa: "Exa",
  tavily: "Tavily",
  searxng: "SearXNG",
  yep: "Yep",
  native_fetch: "Native HTTP fetch",
};

// Ordered task-type → label map. One row per dispatch chain in config.json.
const TASK_ORDER: { task: string; label: string }[] = [
  { task: "general_web", label: "General web search" },
  { task: "small_web", label: "Small web / blogs / non-commercial" },
  { task: "encyclopedia", label: "Encyclopedia article" },
  { task: "definition", label: "Word definition / etymology" },
  { task: "structured_fact", label: "Structured fact (dates, stats)" },
  { task: "location", label: "Location / place lookup" },
  { task: "academic", label: "Academic paper search" },
  { task: "code", label: "Code / technical Q&A" },
  { task: "news", label: "Recent news" },
  { task: "financial", label: "Financial filings / economic data" },
  { task: "archive", label: "Historical web page" },
  { task: "semantic", label: 'Semantic / "find things like X"' },
  { task: "synthesis", label: "Synthesized answer with citations" },
  { task: "privacy_critical", label: "Privacy-critical search" },
  { task: "content_fetch", label: "URL content → Markdown" },
];

// Capability matrix columns. Each column maps one or more capability slugs to
// the in-cell label; specific labels (Defs/Facts/Geo) precede the generic
// "Yes" so they win when a provider declares several capabilities in a column.
const CAPABILITY_COLUMNS: { column: string; cells: Record<string, string> }[] = [
  { column: "Web", cells: { web_search: "Yes" } },
  { column: "Academic", cells: { academic: "Yes" } },
  { column: "Code", cells: { code: "Yes" } },
  { column: "Encyclopedia", cells: { definition: "Defs", structured_fact: "Facts", location: "Geo", encyclopedia: "Yes" } },
  { column: "News", cells: { news: "Yes" } },
  { column: "Archive", cells: { archive: "Yes" } },
  { column: "Fetch", cells: { content_fetch: "Yes" } },
];

function display(slug: string): string {
  return PROVIDER_DISPLAY_NAMES[slug] ?? slug.replace(/_/g, " ");
}

function chainSuffix(provider: ProviderEntry | undefined): string {
  if (!provider) return "";
  if (provider.tier === "keyed_http") return " (if keyed)";
  if (provider.tier === "self_hosted_http") return " (if configured)";
  return "";
}

function keyLabel(provider: ProviderEntry): string {
  if (provider.tier === "keyed_http") return "Yes";
  if (provider.auth_env || provider.url_env) return "No*";
  return "No";
}

// Generate the provider-map reference Markdown from config.json. Returns the
// absolute path written (skills/infobroker/references/provider-map.md).
export function writeProviderMap(config: Config): string {
  const outPath = join(ROOT, "skills", "infobroker", "references", "provider-map.md");
  const outDir = dirname(outPath);
  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true });
  }

  const lines: string[] = [];
  lines.push("# Provider Dispatch Map");
  lines.push("");
  lines.push("Quick reference for `web_search` auto-selection. The server classifies the");
  lines.push("query into a task type and routes to the primary provider of that type's");
  lines.push("dispatch chain, falling back in order.");
  lines.push("");
  lines.push("## Task → Provider Table");
  lines.push("");
  lines.push("| Task type | Primary | Fallback 1 | Fallback 2 |");
  lines.push("|-----------|---------|-----------|-----------|");

  for (const { task, label } of TASK_ORDER) {
    const chain = config.dispatch?.[task] ?? [];
    const cell = (i: number): string => {
      if (i === 0) {
        return chain[0] ? `${display(chain[0])}${chainSuffix(config.providers[chain[0]])}` : "—";
      }
      if (i === 1) {
        return chain[1] ? `${display(chain[1])}${chainSuffix(config.providers[chain[1]])}` : "—";
      }
      const rest = chain.slice(2);
      return rest.length
        ? rest.map((slug) => `${display(slug)}${chainSuffix(config.providers[slug])}`).join(", ")
        : "—";
    };
    lines.push(`| ${label} | ${cell(0)} | ${cell(1)} | ${cell(2)} |`);
  }

  lines.push("");
  lines.push("## Provider Capabilities");
  lines.push("");
  lines.push("| Provider | Web | Academic | Code | Encyclopedia | News | Archive | Fetch | Key required |");
  lines.push("|----------|-----|----------|------|-------------|------|---------|-------|-------------|");

  for (const [slug, provider] of Object.entries(config.providers)) {
    if (PROVIDER_EXCLUSIONS.has(slug)) continue;
    const capCells = CAPABILITY_COLUMNS.map((col) => {
      for (const [cap, label] of Object.entries(col.cells)) {
        if (provider.capabilities.includes(cap)) return label;
      }
      return "—";
    });
    lines.push(`| ${display(slug)} | ${capCells.join(" | ")} | ${keyLabel(provider)} |`);
  }

  lines.push("");
  lines.push("\\* No key required for baseline access (rate-limited); key increases quota.");

  writeFileSync(outPath, lines.join("\n") + "\n");
  return outPath;
}
