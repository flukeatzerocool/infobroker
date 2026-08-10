// @implements REQ-001 REQ-002 REQ-004 REQ-013 REQ-020 REQ-021 REQ-022 REQ-023 REQ-024 REQ-025 REQ-026 REQ-030 REQ-031 REQ-032 REQ-035 REQ-036 REQ-040 REQ-041 REQ-060 REQ-061 REQ-062 REQ-063 REQ-064 REQ-065 REQ-066 REQ-067 REQ-070 REQ-074 REQ-075 REQ-076
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadConfig, reloadConfig, getConfig, getEnvVar, getDispatchChain } from "./config.js";
import { configureAllProviders, throttle } from "./rate-limiter.js";
import { increment, checkQuota, loadQuotaState, getQuotaStatePath } from "./quota.js";
import { PROVIDERS } from "./providers/index.js";
import { retryWithBackoff } from "./retry.js";
import { converge } from "./converge.js";
import { initKb, isKbConfigured, kbSearch, kbIngest, kbStats, kbDelete, autoIndex } from "./kb.js";
import type { Config, ProviderConfig, HealthReport, SearchResult, ToolOkResponse, ToolErrorResponse, SearchOptions } from "./types.js";

const START_TIME = Date.now();
const MAX_FALLBACK_DEPTH = 3;
let totalRequests = 0;
const requestLatencies: Record<string, { latencies: number[]; timestamps: number[] }> = {};

loadConfig();
configureAllProviders(getConfig());
loadQuotaState();

startupHealthCheck();

const kbConfig = getConfig().kb;
if (kbConfig) {
  initKb(kbConfig);
  console.error("[infobroker] Knowledge base initialized");
} else {
  console.error("[infobroker] Knowledge base not configured — KB tools disabled");
}

function trackRequest(provider: string, latencyMs: number): void {
  totalRequests++;
  const config = getConfig();
  const windowSize = config.output.latency_window_size ?? 100;

  if (!requestLatencies[provider]) {
    requestLatencies[provider] = { latencies: [], timestamps: [] };
  }
  const entry = requestLatencies[provider];
  entry.latencies.push(latencyMs);
  entry.timestamps.push(Date.now());

  while (entry.latencies.length > windowSize) {
    entry.latencies.shift();
    entry.timestamps.shift();
  }
}

function avgLatency(provider: string): number {
  const entry = requestLatencies[provider];
  if (!entry || entry.latencies.length === 0) return 0;
  return entry.latencies.reduce((a, b) => a + b, 0) / entry.latencies.length;
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
    error: { code, message, remediation },
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
    const p = PROVIDERS[slug];
    if (!p) {
      console.error(`[infobroker] ${slug}: active (no health check available)`);
      continue;
    }
    try {
      const h = await p.health();
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
  timeRange?: string,
  page = 1
): Promise<string> {
  const config = getConfig();

  if (isKbConfigured()) {
    try {
      const kbResults = kbSearch(query, maxResults);
      if (kbResults.length > 0) {
        const relevanceThreshold = config.kb?.kb_first_relevance_threshold ?? 0.3;
        const confidenceThreshold = config.kb?.kb_first_confidence_threshold ?? 0.5;
        const sufficient = kbResults.some(
          (r) => r.freshness_score >= confidenceThreshold && (r.score ?? 0) >= relevanceThreshold
        );
        if (sufficient) {
          const kbProvider = "knowledge_base";
          return `[OK] ${json(ok(kbProvider, kbResults.map((r) => ({
            title: r.title,
            url: r.source_url,
            snippet: r.snippet,
            source_type: r.freshness_tier,
          })), {
            query_time_ms: 0,
            fallback_used: false,
            quota_remaining: undefined,
          }))}`;
        }
      }
    } catch {
      // KB search failed — proceed to external providers
    }
  }

  let chain: string[];

  if (preferredProvider && config.providers[preferredProvider]?.enabled) {
    chain = [preferredProvider, ...getDispatchChain("general_web").filter((p) => p !== preferredProvider)];
  } else {
    chain = getDispatchChain("general_web");
  }

  if (chain.length === 0) {
    return `[ERROR] ${json(err("none", "config_error", "No active search providers configured", "Check config.json"))}`;
  }

  const opts: SearchOptions = { max_results: maxResults, safe_search: safeSearch, time_range: timeRange as SearchOptions["time_range"], page };
  let lastError: ToolErrorResponse | null = null;
  let depth = 0;

  for (const slug of chain) {
    if (depth >= MAX_FALLBACK_DEPTH) break;
    try {
      const quota = checkQuota(slug, config.providers[slug]?.rate_limit);
      if (quota.exhausted) continue;

      await throttle(slug);
      const start = Date.now();

      const provider = PROVIDERS[slug];
      if (!provider?.search) {
        throw new Error(`Provider ${slug} has no search function`);
      }

      const doCall = async (): Promise<SearchResult[]> => provider.search(query, opts);

      const timeoutMs = config.providers[slug]?.timeout ?? 15000;
      const timedCall = async (): Promise<SearchResult[]> =>
        Promise.race([
          doCall(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`Provider ${slug} timed out after ${timeoutMs}ms`)), timeoutMs)
          ),
        ]);
      const results = await retryWithBackoff(timedCall);

      const elapsed = Date.now() - start;
      increment(slug, config.providers[slug]?.rate_limit);
      trackRequest(slug, elapsed);
      depth++;

      autoIndex(results, slug, undefined, undefined, query, timeRange);

      return `[OK] ${json(ok(slug, results, {
        query_time_ms: elapsed,
        fallback_used: lastError !== null,
        quota_remaining: checkQuota(slug, config.providers[slug]?.rate_limit).daily.remaining,
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
        if (slug === "native_fetch") {
          const resp = await fetch(url, {
            headers: { "User-Agent": "Infobroker/1.0" },
          });
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          return await resp.text();
        }

        const provider = PROVIDERS[slug];
        if (!provider?.fetchPage) {
          throw new Error(`Provider ${slug} has no fetchPage function`);
        }
        return await provider.fetchPage(url);
      };

      let content: string;
      try {
        const timeoutMs = config.providers[slug]?.timeout ?? 15000;
        const timedCall = async (): Promise<string> =>
          Promise.race([
            doCall(),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error(`Provider ${slug} timed out after ${timeoutMs}ms`)), timeoutMs)
            ),
          ]);
        content = await retryWithBackoff(timedCall);
      } catch {
        continue;
      }

      const elapsed = Date.now() - start;
      increment(slug, config.providers[slug]?.rate_limit);
      trackRequest(slug, elapsed);
      const truncated = maybeTruncate(content, config.output.max_chars);

      autoIndex([{ title: new URL(url).hostname, url, snippet: truncated.text }], slug, undefined, "fetch_page");

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
    const ddg = PROVIDERS["duckduckgo"];
    const suggestions = ddg?.suggest ? await ddg.suggest(query) : [];
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

  const kbAvailable = isKbConfigured();
  const kbHasContent = kbAvailable && (kbStats().chunk_count > 0);
  const firstResort = kbHasContent ? "knowledge_base" : (chain.length > 0 ? chain[0] : null);

  if (chain.length === 0 && !kbHasContent) {
    return `[ERROR] ${json(err("none", "config_error", `No active providers for task type: ${matchedType}`, "Check config.json"))}`;
  }

  const recommended = chain.length > 0 ? chain[0] : "";
  const recommendedPct = config.providers[recommended] ? checkQuota(recommended, config.providers[recommended].rate_limit) : null;
  let effectiveRecommended = recommended;
  if (recommendedPct?.exhausted) {
    effectiveRecommended = chain.length > 1 ? chain[1] : recommended;
  }

  const rationale = `Best match for "${matchedType}" task.${kbHasContent ? " Search the knowledge base first for cached results." : ""} ${chain.length > 1 ? `Fallback chain: ${chain.join(", ")}.` : "No fallback available."}`;

  return `[OK] ${json({
    status: "ok",
    provider: effectiveRecommended,
    results: [],
    meta: {
      recommended: effectiveRecommended,
      first_resort: firstResort,
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
      quota_used: quota.daily.used,
      quota_remaining: quota.daily.remaining,
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

function doProviderHealth(providerSlug: string): string {
  const config = getConfig();
  const p = config.providers[providerSlug];
  if (!p) {
    return `[ERROR] ${json(err(providerSlug, "invalid_input", `Provider "${providerSlug}" not found in config`, "Use list_providers to see available providers"))}`;
  }

  const quota = checkQuota(providerSlug, p.rate_limit);
  const keyEnv = p.auth_env;
  const authOk = keyEnv ? !!process.env[keyEnv] : true;
  const status = authOk ? "active" : "inactive";

  const report: HealthReport = {
    status,
    slug: providerSlug,
    tier: p.tier,
    capabilities: p.capabilities,
    quota_used: quota.daily.used,
    quota_remaining: quota.daily.remaining,
    quota_reset_at: quota.daily.resetAt,
    avg_latency_ms: avgLatency(providerSlug),
    auth_ok: authOk,
  };

  const registeredProvider = PROVIDERS[providerSlug];
  if (registeredProvider && authOk) {
    registeredProvider.health().then((h) => {
      report.status = h.status as HealthReport["status"];
      report.avg_latency_ms = h.avgLatencyMs;
    }).catch(() => {
      if (report.status === "active") {
        report.status = "degraded";
      }
    });
  }

  return `[OK] ${json({
    status: "ok",
    provider: providerSlug,
    results: [report],
  })}`;
}

function doSpecHealth(): string {
  const config = getConfig();
  const activeCount = Object.entries(config.providers).filter(([, p]) => p.enabled).length;
  const kbStatsData = isKbConfigured() ? kbStats() : null;

  return `[OK] ${json({
    status: "ok",
    provider: "system",
    results: [{
      build_version: "2026.08.10",
      provider_count: Object.keys(config.providers).length,
      active_provider_count: activeCount,
      kb: kbStatsData ? {
        chunk_count: kbStatsData.chunk_count,
        collections: kbStatsData.collections,
        freshness_tiers: kbStatsData.freshness_tiers,
        last_ingestion: kbStatsData.last_ingestion,
      } : undefined,
      uptime_seconds: Math.floor((Date.now() - START_TIME) / 1000),
      total_requests_served: totalRequests,
      quota_state_path: getQuotaStatePath(),
      config_path: process.env["INFOBROKER_CONFIG"] || "./config.json",
    }],
  })}`;
}

const server = new McpServer({
  name: "infobroker",
  version: "2026.08.10",
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
      params.time_range as string | undefined,
      Number(params.page ?? 1)
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
      renderer: z.enum(["jina", "native_fetch", "wikipedia", "internet_archive", "arxiv", "stack_exchange"]).optional(),
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
      autoIndex(
        result.findings.map((f) => ({ title: f.topic, url: f.sources[0]?.url || "", snippet: f.claim })),
        "converge",
        undefined,
        "converge"
      );
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

// --- kb_search ---
server.registerTool(
  "infobroker_kb_search",
  {
    title: "Knowledge Base Search",
    description: "Search the local knowledge base for previously indexed content before making external web requests. Contains cached results from web_search, fetch_page, and converge. Results include freshness-adjusted scores. Semantic and keyword hybrid search.",
    inputSchema: {
      query: z.string().describe("Search query"),
      max_results: z.number().min(1).max(50).optional().default(10),
      collection: z.string().optional().describe("Scope search to one collection"),
      source_type: z.string().optional().describe("Filter by source type"),
    },
  },
  async (params) => {
    if (!isKbConfigured()) {
      return { content: [{ type: "text" as const, text: `[ERROR] ${json(err("system", "config_error", "Knowledge base not configured", "Add a kb section to config.json"))}` }] };
    }
    try {
      const results = kbSearch(
        String(params.query),
        Number(params.max_results ?? 10),
        params.collection as string | undefined,
        params.source_type as string | undefined
      );
      return { content: [{ type: "text" as const, text: `[OK] ${json({ status: "ok", provider: "knowledge_base", results })}` }] };
    } catch (e) {
      return { content: [{ type: "text" as const, text: `[ERROR] ${json(err("knowledge_base", "internal_error", e instanceof Error ? e.message : String(e), "Check knowledge base configuration"))}` }] };
    }
  }
);

// --- kb_ingest ---
server.registerTool(
  "infobroker_kb_ingest",
  {
    title: "Knowledge Base Ingest",
    description: "Ingest text or URL content into the knowledge base.",
    inputSchema: {
      text: z.string().optional().describe("Raw text to chunk and index"),
      url: z.string().optional().describe("URL to fetch and index"),
      title: z.string().optional(),
      collection: z.string().optional(),
    },
  },
  async (params) => {
    if (!isKbConfigured()) {
      return { content: [{ type: "text" as const, text: `[ERROR] ${json(err("system", "config_error", "Knowledge base not configured", "Add a kb section to config.json"))}` }] };
    }
    const text = params.text as string | undefined;
    const url = params.url as string | undefined;
    if (!text && !url) {
      return { content: [{ type: "text" as const, text: `[ERROR] ${json(err("knowledge_base", "invalid_input", "At least one of text or url must be provided", "Provide text or url parameter"))}` }] };
    }
    try {
      let content = text || "";
      let sourceUrl = url || "";
      if (url && !text) {
        const fetched = await doFetchPage(url);
        if (fetched.startsWith("[ERROR]")) {
          return { content: [{ type: "text" as const, text: fetched }] };
        }
        const parsed = JSON.parse(fetched.slice(5));
        content = parsed.results?.[0]?.snippet || "";
        sourceUrl = url;
      }
      const count = kbIngest(
        content,
        (params.title as string) || url || "untitled",
        sourceUrl,
        "explicit",
        params.collection as string | undefined,
        "explicit"
      );
      const msg = json({ status: "ok", provider: "knowledge_base", results: [{ title: "ingested", url: sourceUrl, snippet: `${count} chunks ingested` }], meta: { chunks_ingested: count } });
      return { content: [{ type: "text" as const, text: `[OK] ${msg}` }] };
    } catch (e) {
      return { content: [{ type: "text" as const, text: `[ERROR] ${json(err("knowledge_base", "internal_error", e instanceof Error ? e.message : String(e), "Check knowledge base configuration"))}` }] };
    }
  }
);

// --- kb_stats ---
server.registerTool(
  "infobroker_kb_stats",
  {
    title: "Knowledge Base Stats",
    description: "Knowledge base operational metrics.",
    inputSchema: {},
  },
  async () => {
    const stats = kbStats();
    return { content: [{ type: "text" as const, text: `[OK] ${json({ status: "ok", provider: "knowledge_base", results: [stats] })}` }] };
  }
);

// --- kb_delete ---
server.registerTool(
  "infobroker_kb_delete",
  {
    title: "Knowledge Base Delete",
    description: "Remove content from the knowledge base.",
    inputSchema: {
      collection: z.string().optional().describe("Remove all chunks in this collection"),
      source_url: z.string().optional().describe("Remove all chunks from this source URL"),
    },
  },
  async (params) => {
    if (!isKbConfigured()) {
      return { content: [{ type: "text" as const, text: `[ERROR] ${json(err("system", "config_error", "Knowledge base not configured", "Add a kb section to config.json"))}` }] };
    }
    const collection = params.collection as string | undefined;
    const sourceUrl = params.source_url as string | undefined;
    if (!collection && !sourceUrl) {
      return { content: [{ type: "text" as const, text: `[ERROR] ${json(err("knowledge_base", "invalid_input", "At least one of collection or source_url must be provided", "Provide a filter parameter"))}` }] };
    }
    try {
      const count = kbDelete(collection, sourceUrl);
      const msg = json({ status: "ok", provider: "knowledge_base", results: [{ title: "deleted", url: "", snippet: `${count} chunks removed` }], meta: { chunks_removed: count } });
      return { content: [{ type: "text" as const, text: `[OK] ${msg}` }] };
    } catch (e) {
      return { content: [{ type: "text" as const, text: `[ERROR] ${json(err("knowledge_base", "internal_error", e instanceof Error ? e.message : String(e), "Check knowledge base configuration"))}` }] };
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
      if (newConfig.kb) {
        initKb(newConfig.kb);
        console.error("[infobroker] Knowledge base re-initialized");
      }
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
    if (newConfig.kb) initKb(newConfig.kb);
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
