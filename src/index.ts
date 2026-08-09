// @implements REQ-001 REQ-002 REQ-004 REQ-013 REQ-020 REQ-021 REQ-022 REQ-023 REQ-024 REQ-025 REQ-026 REQ-030 REQ-031 REQ-032 REQ-040 REQ-041
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadConfig, reloadConfig, getConfig, getEnvVar, getDispatchChain } from "./config.js";
import { configureAllProviders, throttle } from "./rate-limiter.js";
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
  arxivSearch,
  arxivHealth,
  semanticScholarSearch,
  semanticScholarHealth,
  stackExchangeSearch,
  stackExchangeHealth,
  githubSearch,
  githubHealth,
  coreSearch,
  coreHealth,
  marginaliaSearch,
  marginaliaHealth,
  mojeekSearch,
  mojeekHealth,
  braveSearch,
  braveHealth,
  exaSearch,
  exaHealth,
  tavilySearch,
  tavilyHealth,
  searxngSearch,
  searxngHealth,
} from "./providers/index.js";
import { retryWithBackoff } from "./retry.js";
import { converge } from "./converge.js";
import type { Config, ProviderConfig, HealthReport, SearchResult, ToolOkResponse, ToolErrorResponse, SearchOptions } from "./types.js";

const START_TIME = Date.now();
const MAX_FALLBACK_DEPTH = 3;
let totalRequests = 0;
const requestLatencies: Record<string, number[]> = {};

loadConfig();
configureAllProviders(getConfig());
loadQuotaState();

startupHealthCheck();

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

async function startupHealthCheck(): Promise<void> {
  const config = getConfig();
  const healthFns: Record<string, () => Promise<{ status: string; avgLatencyMs: number }>> = {
    duckduckgo: duckduckgoHealth,
    jina: jinaHealth,
    wikipedia: wikipediaHealth,
    wiktionary: wiktionaryHealth,
    wikidata: wikidataHealth,
    openstreetmap: openstreetmapHealth,
    internet_archive: internetArchiveHealth,
    arxiv: arxivHealth,
    semantic_scholar: semanticScholarHealth,
    stack_exchange: stackExchangeHealth,
    github: githubHealth,
    core: coreHealth,
    marginalia: marginaliaHealth,
    mojeek: mojeekHealth,
    brave: braveHealth,
    exa: exaHealth,
    tavily: tavilyHealth,
    searxng: searxngHealth,
  };

  for (const [slug, provider] of Object.entries(config.providers)) {
    if (!provider.enabled) continue;
    const keyEnv = provider.auth_env;
    if (keyEnv && !process.env[keyEnv]) {
      if (provider.tier === "keyed_http") {
        console.error(`[infobroker] ${slug}: inactive (no_api_key)`);
        continue;
      }
    }
    const urlEnv = provider.url_env;
    if (urlEnv && !process.env[urlEnv]) {
      console.error(`[infobroker] ${slug}: inactive (no_url)`);
      continue;
    }
    const healthFn = healthFns[slug];
    if (!healthFn) {
      console.error(`[infobroker] ${slug}: active (no health check available)`);
      continue;
    }
    try {
      const h = await healthFn();
      console.error(`[infobroker] ${slug}: ${h.status} (${h.avgLatencyMs}ms)`);
    } catch {
      console.error(`[infobroker] ${slug}: inactive (health check failed)`);
    }
  }
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
    return `[ERROR] ${json(err("none", "config_error", "No active search providers configured", "Check config.json"))}`;
  }

  const opts: SearchOptions = { max_results: maxResults, safe_search: safeSearch, time_range: timeRange as SearchOptions["time_range"] };
  let lastError: ToolErrorResponse | null = null;
  let depth = 0;

  for (const slug of chain) {
    if (depth >= MAX_FALLBACK_DEPTH) break;
    try {
      const quota = checkQuota(slug, config.providers[slug]?.rate_limit);
      if (quota.exhausted) continue;

      await throttle(slug);
      const start = Date.now();
      let results: SearchResult[];

      const doCall = async (): Promise<SearchResult[]> => {
        switch (slug) {
          case "duckduckgo":
            return await duckduckgoSearch(query, opts);
          case "wikipedia":
            return await wikipediaSearch(query, opts);
          case "wikidata":
            return await wikidataSearch(query);
          case "wiktionary":
            return await wiktionarySearch(query);
          case "openstreetmap":
            return await openstreetmapSearch(query);
          case "internet_archive":
            return await internetArchiveSearch(query);
          case "arxiv":
            return await arxivSearch(query);
          case "semantic_scholar":
            return await semanticScholarSearch(query);
          case "stack_exchange":
            return await stackExchangeSearch(query);
          case "github":
            return await githubSearch(query);
          case "core":
            return await coreSearch(query);
          case "marginalia":
            return await marginaliaSearch(query);
          case "mojeek":
            return await mojeekSearch(query);
          case "brave":
            return await braveSearch(query);
          case "exa":
            return await exaSearch(query);
          case "tavily":
            return await tavilySearch(query);
          case "searxng":
            return await searxngSearch(query);
          default:
            return await duckduckgoSearch(query, opts);
        }
      };
      results = await retryWithBackoff(doCall, slug);

      const elapsed = Date.now() - start;
      increment(slug, config.providers[slug]?.rate_limit);
      trackRequest(slug);
      depth++;

      return `[OK] ${json(ok(slug, results, {
        query_time_ms: elapsed,
        fallback_used: lastError !== null,
        quota_remaining: checkQuota(slug, config.providers[slug]?.rate_limit).remaining,
      }))}`;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      lastError = err(slug, "provider_unavailable", msg, "Trying next provider in fallback chain");
    }
  }

  return `[ERROR] ${json(lastError || err("none", "provider_unavailable", "All providers failed", "Check network connectivity"))}`;
}

async function doFetchPage(url: string, renderer?: string): Promise<string> {
  const config = getConfig();
  const renderers = renderer ? [renderer] : getDispatchChain("content_fetch");

  for (const slug of renderers) {
    try {
      await throttle(slug);
      const start = Date.now();

      const doCall = async (): Promise<string> => {
        if (slug === "jina") {
          return await jinaFetchPage(url);
        } else if (slug === "wikipedia") {
          if (url.includes("wikipedia.org")) {
            return await wikipediaFetchPage(url);
          }
          throw new Error("URL not a wikipedia.org domain");
        } else if (slug === "internet_archive") {
          return await internetArchiveFetchPage(url);
        } else {
          const resp = await fetch(url, {
            headers: { "User-Agent": "Infobroker/1.0" },
          });
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          return await resp.text();
        }
      };
      let content: string;
      try {
        content = await retryWithBackoff(doCall, slug);
      } catch {
        continue;
      }

      const elapsed = Date.now() - start;
      increment(slug, config.providers[slug]?.rate_limit);
      trackRequest(slug);

      const truncated = maybeTruncate(content, config.output.max_chars);

      return `[OK] ${json({
        status: "ok",
        provider: slug,
        results: [{
          title: new URL(url).hostname,
          url,
          snippet: truncated.text,
        }],
        meta: {
          query_time_ms: elapsed,
          fallback_used: false,
        },
        ...(truncated.truncated ? { truncated: true, output_path: truncated.outputPath } : {}),
      })}`;
    } catch {
      // continue to next renderer
    }
  }

  return `[ERROR] ${json(err("none", "provider_unavailable", `All content renderers failed for: ${url}`, "Check network connectivity"))}`;
}

async function doSearchSuggestions(query: string): Promise<string> {
  try {
    const suggestions = await duckduckgoSuggest(query);
    return `[OK] ${json({
      status: "ok",
      provider: "duckduckgo",
      results: suggestions.map((s) => ({ title: s, url: "", snippet: s })),
    })}`;
  } catch (e) {
    return `[ERROR] ${json(err("duckduckgo", "provider_unavailable", e instanceof Error ? e.message : String(e), "Retry later"))}`;
  }
}

function doChooseProvider(task: string, priority?: string): string {
  const config = getConfig();

  const taskTypes: Record<string, string[]> = {
    "general_web": ["search", "find", "look up", "research", "information about"],
    "small_web": ["blog", "personal", "non-commercial", "indie", "small web"],
    "encyclopedia": ["encyclopedia", "wiki"],
    "definition": ["definition", "define", "meaning", "etymology", "dictionary", "word"],
    "structured_fact": ["date", "statistic", "identifier", "population", "birth", "death"],
    "location": ["where is", "location", "map", "address", "city", "place", "geocode"],
    "academic": ["paper", "study", "research paper", "academic", "scholar", "journal", "thesis"],
    "code": ["code", "programming", "error", "debug", "function", "api", "docs", "stack overflow"],
    "news": ["news", "recent", "latest", "today", "current"],
    "archive": ["archive", "historical", "old", "past version"],
    "semantic": ["like", "similar to", "semantic", "neural", "conceptual"],
    "synthesis": ["synthesize", "comprehensive", "summarize sources", "rag"],
    "privacy_critical": ["private", "anonymous", "no tracking", "self-host"],
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
    return `[ERROR] ${json(err("none", "config_error", `No active providers for task type: ${matchedType}`, "Check config.json"))}`;
  }

  const recommended = chain[0];
  const recommendedPct = config.providers[recommended] ? checkQuota(recommended, config.providers[recommended].rate_limit) : null;
  let effectiveRecommended = recommended;
  if (recommendedPct?.exhausted) {
    effectiveRecommended = chain.length > 1 ? chain[1] : recommended;
  }

  const rationale = `Best match for "${matchedType}" task. ${chain.length > 1 ? `Fallback chain: ${chain.join(", ")}.` : "No fallback available."}`;

  return `[OK] ${json({
    status: "ok",
    provider: effectiveRecommended,
    results: [],
    meta: {
      recommended: effectiveRecommended,
      matched_type: matchedType,
      rationale,
      fallback_chain: chain,
      priority: priority || "quality",
    },
  })}`;
}

function doListProviders(filter?: string): string {
  const config = getConfig();
  const entries = Object.entries(config.providers);

  const filtered = filter === "active"
    ? entries.filter(([, p]) => p.enabled)
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

  return `[OK] ${json({
    status: "ok",
    provider: "system",
    results: list,
  })}`;
}

function doProviderHealth(provider: string): string {
  const config = getConfig();
  const p = config.providers[provider];
  if (!p) {
    return `[ERROR] ${json(err(provider, "invalid_input", `Provider "${provider}" not found in config`, "Use list_providers to see available providers"))}`;
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

  return `[OK] ${json({
    status: "ok",
    provider,
    results: [report],
  })}`;
}

function doSpecHealth(): string {
  const config = getConfig();
  const activeCount = Object.entries(config.providers).filter(([, p]) => p.enabled).length;

  return `[OK] ${json({
    status: "ok",
    provider: "system",
    results: [{
      build_version: "2026.08.06",
      provider_count: Object.keys(config.providers).length,
      active_provider_count: activeCount,
      uptime_seconds: Math.floor((Date.now() - START_TIME) / 1000),
      total_requests_served: totalRequests,
      quota_state_path: getQuotaStatePath(),
      config_path: process.env["INFOBROKER_CONFIG"] || "./config.json",
    }],
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
            text: `[ERROR] ${json(err("none", "convergence_error", e instanceof Error ? e.message : String(e), "Retry with different query"))}`,
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
      const newConfig = reloadConfig();
      configureAllProviders(newConfig);
      return { content: [{ type: "text" as const, text: `[OK] ${json({ status: "ok", provider: "system", results: [{ message: "Configuration reloaded.", provider_count: Object.keys(newConfig.providers).length }] })}` }] };
    } catch (e) {
      return {
        content: [
          {
            type: "text" as const,
            text: `[ERROR] ${json(err("system", "config_error", (e instanceof Error ? e.message : String(e)) + ". Previous config remains active.", "Fix config.json and retry"))}`,
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

process.on("SIGHUP", () => {
  try {
    const newConfig = reloadConfig();
    configureAllProviders(newConfig);
    console.error("[infobroker] Configuration reloaded via SIGHUP");
  } catch (e) {
    console.error("[infobroker] SIGHUP reload failed:", e instanceof Error ? e.message : String(e));
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((e) => {
  console.error("Infobroker failed to start:", e);
  process.exit(1);
});
