import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadConfig, reloadConfig, getConfig, getEnvVar, getDispatchChain } from "./config.js";
import { configureProviderRateLimit, throttle } from "./rate-limiter.js";
import { increment, checkQuota, loadQuotaState, getQuotaStatePath } from "./quota.js";
import {
  duckduckgoSearch,
  duckduckgoSuggest,
  duckduckgoHealth,
  jinaFetchPage,
  jinaHealth,
  wikipediaSearch,
  wikipediaFetchPage,
  wikipediaHealth,
  wiktionarySearch,
  wiktionaryHealth,
  wikidataSearch,
  wikidataHealth,
  openstreetmapSearch,
  openstreetmapHealth,
  internetArchiveSearch,
  internetArchiveFetchPage,
  internetArchiveHealth,
} from "./providers/index.js";
import { converge } from "./converge.js";
import type { Config, ProviderConfig, HealthReport, SearchResult, ToolOkResponse, ToolErrorResponse, SearchOptions } from "./types.js";

const START_TIME = Date.now();
let totalRequests = 0;
const requestLatencies: Record<string, number[]> = {};

loadConfig();
loadQuotaState();

function trackRequest(provider: string): void {
  totalRequests++;
  if (!requestLatencies[provider]) {
    requestLatencies[provider] = [];
  }
}

function avgLatency(provider: string): number {
  const lats = requestLatencies[provider];
  if (!lats || lats.length === 0) return 0;
  return lats.reduce((a, b) => a + b, 0) / lats.length;
}

function ok(provider: string, results: SearchResult[], meta: Record<string, unknown> = {}): ToolOkResponse {
  return {
    status: "ok",
    provider,
    results,
    meta: {
      query_time_ms: 0,
      fallback_used: false,
      quota_remaining: undefined,
      ...meta,
    },
  };
}

function err(provider: string, code: string, message: string, remediation: string): ToolErrorResponse {
  return {
    status: "error",
    provider,
    error: { code, message, provider, remediation },
  };
}

function maybeTruncate(text: string, maxChars: number): { text: string; truncated: boolean; outputPath?: string } {
  if (text.length <= maxChars) return { text, truncated: false };

  const tmpDir = join(tmpdir(), "infobroker");
  if (!existsSync(tmpDir)) {
    mkdirSync(tmpDir, { recursive: true });
  }
  const fname = `trunc-${Date.now()}.txt`;
  const fpath = join(tmpDir, fname);
  writeFileSync(fpath, text);
  return { text: text.slice(0, maxChars) + "...", truncated: true, outputPath: fpath };
}

function json(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

async function doWebSearch(
  query: string,
  preferredProvider?: string,
  maxResults = 10,
  safeSearch: "on" | "off" = "on",
  timeRange?: string
): Promise<string> {
  const config = getConfig();
  let chain: string[];

  if (preferredProvider && config.providers[preferredProvider]?.enabled) {
    chain = [preferredProvider, ...getDispatchChain("general_web").filter((p) => p !== preferredProvider)];
  } else {
    chain = getDispatchChain("general_web");
  }

  if (chain.length === 0) {
    return json(err("none", "config_error", "No active search providers configured", "Check config.json"));
  }

  const opts: SearchOptions = { max_results: maxResults, safe_search: safeSearch, time_range: timeRange as SearchOptions["time_range"] };
  let lastError: ToolErrorResponse | null = null;

  for (const slug of chain) {
    try {
      const quota = checkQuota(slug, config.providers[slug]?.rate_limit);
      if (quota.exhausted) continue;

      await throttle(slug);
      const start = Date.now();
      let results: SearchResult[];

      switch (slug) {
        case "duckduckgo":
        case "marginalia":
        case "mojeek":
          results = await duckduckgoSearch(query, opts);
          break;
        case "wikipedia":
          results = await wikipediaSearch(query, opts);
          break;
        case "wikidata":
          results = await wikidataSearch(query);
          break;
        case "wiktionary":
          results = await wiktionarySearch(query);
          break;
        case "openstreetmap":
          results = await openstreetmapSearch(query);
          break;
        case "internet_archive":
          results = await internetArchiveSearch(query);
          break;
        default:
          results = await duckduckgoSearch(query, opts);
      }

      const elapsed = Date.now() - start;
      increment(slug, config.providers[slug]?.rate_limit);
      trackRequest(slug);

      return json(ok(slug, results, {
        query_time_ms: elapsed,
        fallback_used: lastError !== null,
        quota_remaining: checkQuota(slug, config.providers[slug]?.rate_limit).remaining,
      }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      lastError = err(slug, "provider_unavailable", msg, "Trying next provider in fallback chain");
    }
  }

  return json(lastError || err("none", "provider_unavailable", "All providers failed", "Check network connectivity"));
}

async function doFetchPage(url: string, renderer?: string): Promise<string> {
  const config = getConfig();
  const renderers = renderer ? [renderer] : getDispatchChain("content_fetch");

  for (const slug of renderers) {
    try {
      await throttle(slug);
      const start = Date.now();

      let content: string;
      if (slug === "jina") {
        content = await jinaFetchPage(url);
      } else if (slug === "wikipedia") {
        if (url.includes("wikipedia.org")) {
          content = await wikipediaFetchPage(url);
        } else {
          continue;
        }
      } else if (slug === "internet_archive") {
        content = await internetArchiveFetchPage(url);
      } else {
        const resp = await fetch(url, {
          headers: { "User-Agent": "Infobroker/1.0" },
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        content = await resp.text();
      }

      const elapsed = Date.now() - start;
      increment(slug, config.providers[slug]?.rate_limit);
      trackRequest(slug);

      const truncated = maybeTruncate(content, config.output.max_chars);
      return `[OK] Fetched by ${slug}\n\n${truncated.text}${
        truncated.truncated ? `\n\n[TRUNCATED] Full content at: ${truncated.outputPath}` : ""
      }`;
    } catch (e) {
      // continue to next renderer
    }
  }

  return `[ERROR] [provider_unavailable] All content renderers failed for: ${url}`;
}

async function doSearchSuggestions(query: string): Promise<string> {
  try {
    const suggestions = await duckduckgoSuggest(query);
    return `[OK] Suggestions for "${query}":\n${suggestions.map((s) => `- ${s}`).join("\n")}`;
  } catch (e) {
    return `[ERROR] [provider_unavailable] ${e instanceof Error ? e.message : String(e)}`;
  }
}

function doChooseProvider(task: string, priority?: string): string {
  const config = getConfig();

  const taskTypes: Record<string, string[]> = {
    "general_web": ["search", "find", "look up", "research", "information about"],
    "encyclopedia": ["definition", "what is", "who is", "encyclopedia", "wiki"],
    "academic": ["paper", "study", "research paper", "academic", "scholar", "journal", "thesis"],
    "code": ["code", "programming", "error", "debug", "function", "api", "docs"],
    "location": ["where is", "location", "map", "address", "city", "place"],
    "news": ["news", "recent", "latest", "today", "current"],
    "archive": ["archive", "historical", "old", "past version"],
  };

  let matchedType = "general_web";
  const lower = task.toLowerCase();
  for (const [type, keywords] of Object.entries(taskTypes)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      matchedType = type;
      break;
    }
  }

  const chain = getDispatchChain(matchedType);
  if (chain.length === 0) {
    return `[ERROR] [config_error] No active providers for task type: ${matchedType}. Check config.json.`;
  }

  const recommended = chain[0];
  const rationale = `Best match for "${matchedType}" task. ${chain.length > 1 ? `Fallback chain: ${chain.slice(1).join(", ")}.` : "No fallback available."}`;

  return `[OK] ${json({
    recommended,
    matched_type: matchedType,
    rationale,
    fallback_chain: chain,
    priority: priority || "quality",
  })}`;
}

function doListProviders(filter?: string): string {
  const config = getConfig();
  const entries = Object.entries(config.providers);

  const filtered = filter
    ? entries.filter(([, p]) => {
        if (!p.enabled) return false;
        try {
          const keyEnv = p.auth_env ? process.env[p.auth_env] : undefined;
          return filter === "active" ? true : false;
        } catch {
          return filter === "all";
        }
      })
    : entries;

  const list = filtered.map(([slug, p]) => {
    const quota = checkQuota(slug, p.rate_limit);
    return {
      slug,
      tier: p.tier,
      capabilities: p.capabilities,
      enabled: p.enabled,
      quota_used: quota.used,
      quota_remaining: quota.remaining,
      quota_warning: quota.warning,
      quota_exhausted: quota.exhausted,
      priority: p.priority,
    };
  });

  return `[OK] ${json(list)}`;
}

function doProviderHealth(provider: string): string {
  const config = getConfig();
  const p = config.providers[provider];
  if (!p) {
    return `[ERROR] [invalid_input] Provider "${provider}" not found in config. Use list_providers to see available providers.`;
  }

  const quota = checkQuota(provider, p.rate_limit);
  const keyEnv = p.auth_env;
  const authOk = keyEnv ? !!process.env[keyEnv] : true;
  const status = authOk ? "active" : "inactive";

  const report: HealthReport = {
    status,
    slug: provider,
    tier: p.tier,
    capabilities: p.capabilities,
    quota_used: quota.used,
    quota_remaining: quota.remaining,
    quota_reset_at: quota.resetAt,
    avg_latency_ms: avgLatency(provider),
    auth_ok: authOk,
  };

  return `[OK] ${json(report)}`;
}

function doSpecHealth(): string {
  const config = getConfig();
  const activeCount = Object.entries(config.providers).filter(([, p]) => p.enabled).length;

  return `[OK] ${json({
    build_version: "2026.08.06",
    provider_count: Object.keys(config.providers).length,
    active_provider_count: activeCount,
    uptime_seconds: Math.floor((Date.now() - START_TIME) / 1000),
    total_requests_served: totalRequests,
    quota_state_path: getQuotaStatePath(),
    config_path: process.env["INFOBROKER_CONFIG"] || "./config.json",
  })}`;
}

const server = new McpServer({
  name: "infobroker",
  version: "2026.08.06",
});

// --- web_search ---
server.registerTool(
  "infobroker_web_search",
  {
    title: "Web Search",
    description: "Unified search across configured providers. Falls back through chain on failure.",
    inputSchema: {
      query: z.string().describe("Search query"),
      provider: z.string().optional().describe("Specific provider slug (auto-select if omitted)"),
      max_results: z.number().min(1).max(50).optional().default(10),
      safe_search: z.enum(["on", "off"]).optional().default("on"),
      time_range: z.enum(["day", "week", "month", "year"]).optional(),
      page: z.number().min(1).optional().default(1),
    },
  },
  async (params) => {
    const content = await doWebSearch(
      String(params.query),
      params.provider as string | undefined,
      Number(params.max_results ?? 10),
      (params.safe_search as "on" | "off") ?? "on",
      params.time_range as string | undefined
    );
    return { content: [{ type: "text" as const, text: content }] };
  }
);

// --- fetch_page ---
server.registerTool(
  "infobroker_fetch_page",
  {
    title: "Fetch Page Content",
    description: "Fetch and extract the content of a URL. Uses Jina Reader by default, falls back to native HTTP.",
    inputSchema: {
      url: z.string().describe("URL to fetch"),
      renderer: z.enum(["jina", "native_fetch", "wikipedia", "internet_archive"]).optional(),
      max_length: z.number().optional().default(50000),
    },
  },
  async (params) => {
    const content = await doFetchPage(String(params.url), params.renderer as string | undefined);
    return { content: [{ type: "text" as const, text: content }] };
  }
);

// --- search_suggestions ---
server.registerTool(
  "infobroker_search_suggestions",
  {
    title: "Search Suggestions",
    description: "Query autocomplete using DuckDuckGo autocomplete endpoint.",
    inputSchema: {
      query: z.string().describe("Partial query to get suggestions for"),
    },
  },
  async (params) => {
    const content = await doSearchSuggestions(String(params.query));
    return { content: [{ type: "text" as const, text: content }] };
  }
);

// --- choose_provider ---
server.registerTool(
  "infobroker_choose_provider",
  {
    title: "Choose Provider",
    description: "Recommend the best provider for a given task type with rationale and fallback chain.",
    inputSchema: {
      task: z.string().describe("Natural-language description of the task"),
      priority: z.enum(["speed", "quality", "privacy", "free_only"]).optional(),
    },
  },
  async (params) => {
    const content = doChooseProvider(String(params.task), params.priority as string | undefined);
    return { content: [{ type: "text" as const, text: content }] };
  }
);

// --- list_providers ---
server.registerTool(
  "infobroker_list_providers",
  {
    title: "List Providers",
    description: "List all configured providers with status, capabilities, and quota usage.",
    inputSchema: {
      status: z.enum(["active", "all"]).optional(),
    },
  },
  async (params) => {
    const content = doListProviders(params.status as string | undefined);
    return { content: [{ type: "text" as const, text: content }] };
  }
);

// --- provider_health ---
server.registerTool(
  "infobroker_provider_health",
  {
    title: "Provider Health",
    description: "Detailed health report for a specific provider.",
    inputSchema: {
      provider: z.string().describe("Provider slug (e.g., duckduckgo, wikipedia)"),
    },
  },
  async (params) => {
    const content = doProviderHealth(String(params.provider));
    return { content: [{ type: "text" as const, text: content }] };
  }
);

// --- converge ---
server.registerTool(
  "infobroker_converge",
  {
    title: "Converge (Multi-Source Truth-Finding)",
    description: "Multi-pass truth-finding search with cross-source verification.",
    inputSchema: {
      query: z.string().describe("Search query"),
      max_iterations: z.number().min(1).max(10).optional().default(5),
      confidence_threshold: z.number().min(0).max(1).optional().default(0.8),
    },
  },
  async (params) => {
    try {
      const result = await converge(String(params.query), {
        max_iterations: Number(params.max_iterations ?? 5),
        confidence_threshold: Number(params.confidence_threshold ?? 0.8),
      });
      return { content: [{ type: "text" as const, text: `[OK] ${json(result)}` }] };
    } catch (e) {
      return {
        content: [
          {
            type: "text" as const,
            text: `[ERROR] [convergence_error] ${e instanceof Error ? e.message : String(e)}`,
          },
        ],
      };
    }
  }
);

// --- reload_config ---
server.registerTool(
  "infobroker_reload_config",
  {
    title: "Reload Configuration",
    description: "Re-read config.json without restarting. Active connections are preserved.",
    inputSchema: {},
  },
  async () => {
    try {
      reloadConfig();
      return { content: [{ type: "text" as const, text: "[OK] Configuration reloaded." }] };
    } catch (e) {
      return {
        content: [
          {
            type: "text" as const,
            text: `[ERROR] [config_error] ${e instanceof Error ? e.message : String(e)}. Previous config remains active.`,
          },
        ],
      };
    }
  }
);

// --- spec_health ---
server.registerTool(
  "infobroker_spec_health",
  {
    title: "Spec Health",
    description: "Build health report: provider counts, uptime, request stats.",
    inputSchema: {},
  },
  async () => {
    const content = doSpecHealth();
    return { content: [{ type: "text" as const, text: content }] };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((e) => {
  console.error("Infobroker failed to start:", e);
  process.exit(1);
});
