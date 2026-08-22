// @implements REQ-001 REQ-002 REQ-004 REQ-013 REQ-020 REQ-020a REQ-020b REQ-020c REQ-020d REQ-021 REQ-024 REQ-024a REQ-024b REQ-024c REQ-026 REQ-030 REQ-031 REQ-032 REQ-034 REQ-035 REQ-036 REQ-040 REQ-060 REQ-060a REQ-060b REQ-060c REQ-060d REQ-064 REQ-065 REQ-066 REQ-067 REQ-070 REQ-074 REQ-075 REQ-076 REQ-079
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { loadConfig, reloadConfig, getConfig, getEnvVar, getDispatchChain } from "./config.js";
import { configureAllProviders, throttle } from "./rate-limiter.js";
import { increment, checkQuota, loadQuotaState, getQuotaStatePath } from "./quota.js";
import { PROVIDERS, resolveProvider } from "./providers/index.js";
import { retryWithBackoff, ParseError } from "./retry.js";
import { corroborate } from "./corroborate.js";
import { ignoredParams, selectChain } from "./chain.js";
import { assertPublicUrl, fetchFollowRedirects, type FetchLike } from "./lib/url-guard.js";
import { initKb, isKbConfigured, kbSearch, kbIngest, kbStats, kbDelete, autoIndex, flushKbWrites } from "./kb.js";
import type { Config, ProviderConfig, HealthReport, SearchResult, ToolOkResponse, ToolErrorResponse, SearchOptions } from "./types.js";

const START_TIME = Date.now();
const SPEC_REVIEW_TIME = Date.now();
const MAX_FALLBACK_DEPTH = 3;
const MAX_REDIRECT_HOPS = 5;
const BUILD_VERSION = readPackageVersion();
let totalRequests = 0;

function readPackageVersion(): string {
  try {
    const pkgPath = join(fileURLToPath(import.meta.url), "..", "..", "package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    return pkg.version ?? "unknown";
  } catch {
    return "unknown";
  }
}
const requestLatencies: Record<string, { latencies: number[]; timestamps: number[] }> = {};
const providerLastSuccess: Record<string, number> = {};
const providerLastError: Record<string, { message: string; timestamp: number }> = {};

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
  const windowSize = config.output.latency_window_size;

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

function compactMode(): boolean {
  return getConfig().output.verbose === false;
}

function ok(provider: string, results: SearchResult[], meta: Record<string, unknown> = {}): ToolOkResponse {
  const base: ToolOkResponse = {
    status: "ok",
    provider,
    results,
  };
  if (!compactMode()) {
    base.meta = {
      query_time_ms: 0,
      fallback_used: false,
      quota_remaining: undefined,
      ...meta,
    };
  }
  return base;
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
  const checks: Promise<void>[] = [];

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
    const p = resolveProvider(slug);
    if (!p) {
      console.error(`[infobroker] ${slug}: active (no health check available)`);
      continue;
    }
    checks.push(
      (async () => {
        try {
          const h = await p.health();
          console.error(`[infobroker] ${slug}: ${h.status} (${h.avgLatencyMs}ms)`);
        } catch {
          console.error(`[infobroker] ${slug}: inactive (health check failed)`);
        }
      })()
    );
  }

  await Promise.allSettled(checks);
}

const TASK_TYPE_KEYWORDS: Record<string, string[]> = {
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

function classifyTaskType(task: string): string {
  const lower = task.toLowerCase();
  for (const [type, keywords] of Object.entries(TASK_TYPE_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) return type;
  }
  return "general_web";
}

// Server-side content-type classification by URL pattern. Providers cannot all
// honor a content_type filter natively, so Infobroker applies it as a
// post-filter over normalized URLs.
function classifyContentType(url: string): string {
  const u = url.toLowerCase();
  if (/(^|\/)(docs?\.|docs\/(.+))|developer|documentation/.test(u)) return "docs";
  if (/\/issues?\/|github\.com\/[^/]+\/[^/]+\/issues|\/pull\/\d+/.test(u)) return "issue";
  if (/changelog|release-notes|releases|what-?s-new/.test(u)) return "changelog";
  if (/(^|\.)blog\.|(^|\/)(blog|posts|articles)(\/|$)/.test(u)) return "blog";
  if (/\brfc\d+|\bspec\b|standard\b|w3\.org|ietf\.org/.test(u)) return "spec";
  return "all";
}

function filterByContentType(results: SearchResult[], contentType: string): SearchResult[] {
  if (!contentType || contentType === "all") return results;
  return results.filter((r) => classifyContentType(r.url) === contentType);
}

async function doWebSearch(
  query: string,
  preferredProvider?: string,
  maxResults = 8,
  safeSearch: "on" | "off" | "strict" = "on",
  timeRange?: string,
  page = 1,
  priority?: string,
  suggest = false,
  contentType?: string,
  region?: string
): Promise<string> {
  const config = getConfig();

  if (suggest) {
    try {
      const ddg = PROVIDERS["duckduckgo"];
      const suggestions = ddg?.suggest ? await ddg.suggest(query) : [];
      return `[OK] ${json({
        status: "ok",
        provider: "duckduckgo",
        results: suggestions.map((s) => ({ title: s, url: "", snippet: s })),
        meta: { query_time_ms: 0, fallback_used: false },
      })}`;
    } catch (e) {
      return `[ERROR] ${json(err("duckduckgo", "provider_unavailable", e instanceof Error ? e.message : String(e), "Retry later"))}`;
    }
  }

  if (isKbConfigured()) {
    try {
      const kbResults = kbSearch(query, maxResults);
      if (kbResults.length > 0) {
        const relevanceThreshold = config.kb!.kb_first_relevance_threshold;
        const confidenceThreshold = config.kb!.kb_first_confidence_threshold;
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

  const taskType = classifyTaskType(query);
  let chain: string[];

  if (preferredProvider && config.providers[preferredProvider]?.enabled) {
    chain = [preferredProvider, ...getDispatchChain(taskType).filter((p) => p !== preferredProvider)];
  } else if (preferredProvider) {
    chain = [preferredProvider, ...getDispatchChain(taskType)];
  } else {
    chain = getDispatchChain(taskType);
  }
  if (chain.length === 0) {
    chain = getDispatchChain("general_web");
  }

  chain = selectChain(chain, priority, avgLatency);

  if (chain.length === 0) {
    return `[ERROR] ${json(err("none", "config_error", "No active search providers configured", "Check config.json"))}`;
  }

  const opts: SearchOptions = { max_results: maxResults, safe_search: safeSearch, time_range: timeRange as SearchOptions["time_range"], page, region, content_type: contentType };
  let lastError: ToolErrorResponse | null = null;
  let depth = 0;

  for (const slug of chain) {
    if (depth >= MAX_FALLBACK_DEPTH) break;
    try {
      const quota = checkQuota(slug, config.providers[slug]?.rate_limit);
      if (quota.exhausted) continue;

      await throttle(slug);
      const start = Date.now();

      const provider = resolveProvider(slug);
      if (!provider?.search) {
        throw new Error(`Provider ${slug} has no search function`);
      }

      const doCall = async (): Promise<SearchResult[]> => provider.search(query, opts);

      const timeoutMs = config.providers[slug]?.timeout;
      const timedCall = async (): Promise<SearchResult[]> =>
        Promise.race([
          doCall(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`Provider ${slug} timed out after ${timeoutMs}ms`)), timeoutMs)
          ),
        ]);
      const results = (await retryWithBackoff(timedCall)).slice(0, maxResults);

      const elapsed = Date.now() - start;
      increment(slug, config.providers[slug]?.rate_limit);
      trackRequest(slug, elapsed);
      providerLastSuccess[slug] = Date.now();
      depth++;

      // REQ-031: an empty result set is a failure for chain advancement, not a
      // successful answer. Fall through to the next provider — but keep a
      // provider's empty as distinct from a total failure so the final
      // all-empty case is reported as a legitimate zero-result answer.
      if (results.length === 0) {
        providerLastError[slug] = { message: "empty result set", timestamp: Date.now() };
        continue;
      }

      const filtered = contentType ? filterByContentType(results, contentType) : results;
      if (filtered.length === 0) {
        providerLastError[slug] = { message: "content_type filter removed all results", timestamp: Date.now() };
        continue;
      }

      autoIndex(filtered, slug, undefined, undefined, query, timeRange);

      return `[OK] ${json(ok(slug, filtered, {
        query_time_ms: elapsed,
        fallback_used: lastError !== null,
        quota_remaining: checkQuota(slug, config.providers[slug]?.rate_limit).daily.remaining,
        ignored_params: ignoredParams(slug, { safe_search: safeSearch, time_range: timeRange, page, content_type: contentType, region }),
      }))}`;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      providerLastError[slug] = { message: msg, timestamp: Date.now() };
      if (e instanceof ParseError) {
        lastError = err(slug, "parse_error", msg, "Trying next provider in fallback chain");
      } else {
        lastError = err(slug, "provider_unavailable", msg, "Trying next provider in fallback chain");
      }
    }
  }

  // A chain that ended on provider errors is a failure; a chain whose
  // providers all returned empty is a legitimate zero-result answer.
  if (lastError !== null) {
    return `[ERROR] ${json(err("none", "all_providers_exhausted", `Fallback chain exhausted: ${chain.join(", ")}`, "Retry later or check provider configuration"))}`;
  }
  return `[OK] ${json(ok("none", [], { query_time_ms: 0, fallback_used: true, ignored_params: [] }))}`;
}

async function doFetchPage(url: string, renderer?: string, maxLength?: number): Promise<string> {
  const config = getConfig();
  const renderers = renderer ? [renderer] : getDispatchChain("content_fetch");
  const effectiveMax = maxLength ?? config.output.max_chars;

  const allowPrivate = config.fetch?.allow_private_urls === true;
  try {
    assertPublicUrl(url, allowPrivate);
  } catch (e) {
    return `[ERROR] ${json(err("none", "invalid_input", e instanceof Error ? e.message : String(e), `Set fetch.allow_private_urls=true to permit private targets`))}`;
  }

  for (const slug of renderers) {
    try {
      await throttle(slug);
      const start = Date.now();

      const doCall = async (): Promise<string> => {
        if (slug === "native_fetch") {
          // REQ-021a: follow redirects hop-by-hop, re-applying the SSRF guard
          // to each resolved location, so a public URL that redirects to a
          // private/internal target is refused rather than fetched.
          return fetchFollowRedirects(url, allowPrivate, fetch as unknown as FetchLike, MAX_REDIRECT_HOPS);
        }

        const provider = resolveProvider(slug);
        if (!provider?.fetchPage) {
          throw new Error(`Provider ${slug} has no fetchPage function`);
        }
        return await provider.fetchPage(url);
      };

      let content: string;
      try {
        const timeoutMs = config.providers[slug]?.timeout;
        const timedCall = async (): Promise<string> =>
          Promise.race([
            doCall(),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error(`Provider ${slug} timed out after ${timeoutMs}ms`)), timeoutMs)
            ),
          ]);
        content = await retryWithBackoff(timedCall);
      } catch (e) {
        providerLastError[slug] = { message: e instanceof Error ? e.message : String(e), timestamp: Date.now() };
        continue;
      }

      const elapsed = Date.now() - start;
      increment(slug, config.providers[slug]?.rate_limit);
      trackRequest(slug, elapsed);
      providerLastSuccess[slug] = Date.now();
      const truncated = maybeTruncate(content, effectiveMax);

      autoIndex([{ title: new URL(url).hostname, url, snippet: content }], slug, undefined, "fetch_page");

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

  return `[ERROR] ${json(err("none", "all_providers_exhausted", `All content renderers exhausted for: ${url}`, "Check network connectivity"))}`;
}

function providerOperational(p: ProviderConfig): boolean {
  if (!p.enabled) return false;
  if (p.auth_env && !process.env[p.auth_env]) return false;
  if (p.url_env && !process.env[p.url_env]) return false;
  return true;
}

function doListProviders(filter?: string): string {
  const config = getConfig();
  const entries = Object.entries(config.providers);

  const filtered = filter === "active"
    ? entries.filter(([, p]) => providerOperational(p))
    : entries;

  const list = filtered.map(([slug, p]) => {
    const quota = checkQuota(slug, p.rate_limit);
    return {
      slug,
      tier: p.tier,
      capabilities: p.capabilities,
      enabled: p.enabled,
      status: quota.exhausted ? "exhausted" : (providerOperational(p) ? "active" : "inactive"),
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

async function doProviderHealth(providerSlug: string): Promise<string> {
  const config = getConfig();
  const p = config.providers[providerSlug];
  if (!p) {
    return `[ERROR] ${json(err(providerSlug, "invalid_input", `Provider "${providerSlug}" not found in config`, "Use the providers tool (action list) to see available providers"))}`;
  }

  const quota = checkQuota(providerSlug, p.rate_limit);
  const keyEnv = p.auth_env;
  const authOk = keyEnv ? !!process.env[keyEnv] : true;
  let status = authOk ? "active" : "inactive";

  let avgLatencyMs: number | undefined;
  const registeredProvider = resolveProvider(providerSlug);
  if (registeredProvider && authOk) {
    try {
      const h = await registeredProvider.health();
      status = h.status;
      avgLatencyMs = h.avgLatencyMs;
      providerLastSuccess[providerSlug] = Date.now();
    } catch (e) {
      providerLastError[providerSlug] = { message: e instanceof Error ? e.message : String(e), timestamp: Date.now() };
      if (status === "active") {
        status = "degraded";
      }
    }
  } else {
    avgLatencyMs = avgLatency(providerSlug);
  }

  if (quota.exhausted) {
    status = "exhausted";
  } else if (quota.warning && status === "active") {
    status = "degraded";
  }

  const report: HealthReport = {
    status: status as HealthReport["status"],
    slug: providerSlug,
    tier: p.tier,
    capabilities: p.capabilities,
    quota_used: quota.daily.used,
    quota_remaining: quota.daily.remaining,
    quota_reset_at: quota.daily.resetAt,
    avg_latency_ms: avgLatencyMs,
    auth_ok: authOk,
  };

  if (providerLastError[providerSlug]) {
    report.last_error = new Date(providerLastError[providerSlug].timestamp).toISOString();
  }
  if (providerLastSuccess[providerSlug]) {
    report.last_success = new Date(providerLastSuccess[providerSlug]).toISOString();
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

  const toolCount = Object.keys((server as any)._registeredTools).length;

  return `[OK] ${json({
    status: "ok",
    provider: "system",
    results: [{
      build_version: BUILD_VERSION,
      provider_count: Object.keys(config.providers).filter(k => k !== "native_fetch").length,
      active_provider_count: activeCount,
      tool_count: toolCount,
      kb: kbStatsData ? {
        chunk_count: kbStatsData.chunk_count,
        collections: kbStatsData.collections,
        freshness_tiers: kbStatsData.freshness_tiers,
        last_ingestion: kbStatsData.last_ingestion,
      } : undefined,
      uptime_seconds: Math.floor((Date.now() - START_TIME) / 1000),
      total_requests_served: totalRequests,
      last_spec_review: new Date(SPEC_REVIEW_TIME).toISOString(),
      quota_state_path: getQuotaStatePath(),
      config_path: process.env["INFOBROKER_CONFIG"] || "./config.json",
    }],
  })}`;
}

const server = new McpServer({
  name: "infobroker",
  version: "2026.08.22",
});

// --- web_search ---
server.registerTool(
  "infobroker_web_search",
  {
    title: "Web Search",
    description: "Unified provider search with task-type routing, fallback chain, and optional suggestions.",
    inputSchema: {
      query: z.string().describe("Search query"),
      provider: z.string().optional().describe("Provider slug (auto-select if omitted)"),
      max_results: z.number().min(1).max(30).optional().default(8),
      safe_search: z.enum(["on", "off", "strict"]).optional().default("on"),
      time_range: z.enum(["day", "week", "month", "year"]).optional(),
      page: z.number().min(1).optional().default(1),
      priority: z.enum(["speed", "quality", "privacy", "free_only"]).optional(),
      suggest: z.boolean().optional().default(false),
      content_type: z.enum(["docs", "issue", "changelog", "blog", "spec", "all"]).optional().default("all"),
      region: z.string().optional().describe("ISO region/country code (e.g. 'us-en', 'DE')"),
    },
  },
  async (params) => {
    const content = await doWebSearch(
      String(params.query),
      params.provider as string | undefined,
      Number(params.max_results),
      (params.safe_search as "on" | "off" | "strict") ?? "on",
      params.time_range as string | undefined,
      Number(params.page),
      params.priority as string | undefined,
      Boolean(params.suggest),
      params.content_type as string | undefined,
      params.region as string | undefined
    );
    return { content: [{ type: "text" as const, text: content }] };
  }
);

// --- fetch_page ---
server.registerTool(
  "infobroker_fetch_page",
  {
    title: "Fetch Page Content",
    description: "Fetch and extract URL content. Jina Reader by default, native HTTP fallback.",
    inputSchema: {
      url: z.string().describe("URL to fetch"),
      renderer: z.enum(["jina", "native_fetch", "wikipedia", "internet_archive", "arxiv", "stack_exchange"]).optional(),
      max_length: z.number().optional().default(50000),
    },
  },
  async (params) => {
    const content = await doFetchPage(String(params.url), params.renderer as string | undefined, params.max_length !== undefined ? Number(params.max_length) : undefined);
    return { content: [{ type: "text" as const, text: content }] };
  }
);

// --- providers ---
server.registerTool(
  "infobroker_providers",
  {
    title: "Providers",
    description: "Operational state over configured providers: list, health, or spec actions.",
    inputSchema: {
      action: z.enum(["list", "health", "spec"]).describe("Operation to perform"),
      provider: z.string().optional().describe("Provider slug (required for health)"),
      status: z.enum(["active", "all"]).optional().describe("Filter for list action"),
    },
  },
  async (params) => {
    const action = params.action as "list" | "health" | "spec";
    let content: string;
    if (action === "list") {
      content = doListProviders(params.status as string | undefined);
    } else if (action === "health") {
      if (!params.provider) {
        content = `[ERROR] ${json(err("system", "invalid_input", "provider is required for health action", "Provide a provider slug"))}`;
      } else {
        content = await doProviderHealth(String(params.provider));
      }
    } else {
      content = doSpecHealth();
    }
    return { content: [{ type: "text" as const, text: content }] };
  }
);

// --- corroborate ---
server.registerTool(
  "infobroker_corroborate",
  {
    title: "Corroborate (Multi-Source Truth-Finding)",
    description: "Multi-pass truth-finding search with cross-source verification.",
    inputSchema: {
      query: z.string().describe("Search query"),
      max_iterations: z.number().min(1).max(10).optional().default(5),
      confidence_threshold: z.number().min(0).max(1).optional().default(0.8),
      providers: z.array(z.string()).optional().describe("Optional array of provider slugs to limit the search to"),
    },
  },
  async (params) => {
    try {
      const result = await corroborate(String(params.query), {
        max_iterations: Number(params.max_iterations),
        confidence_threshold: Number(params.confidence_threshold),
        providers: params.providers as string[] | undefined,
      });
      autoIndex(
        result.findings.map((f) => ({ title: f.topic, url: f.sources[0]?.url || "", snippet: f.claim })),
        "corroborate",
        undefined,
        "corroborate"
      );
      if (compactMode()) {
        delete result.provenance;
      }
      return { content: [{ type: "text" as const, text: `[OK] ${json(result)}` }] };
    } catch (e) {
      return {
        content: [
          {
            type: "text" as const,
            text: `[ERROR] ${json(err("none", "corroboration_error", e instanceof Error ? e.message : String(e), "Retry with different query"))}`,
          },
        ],
      };
    }
  }
);

// --- kb ---
server.registerTool(
  "infobroker_kb",
  {
    title: "Knowledge Base",
    description: "Manage the local knowledge base: search, ingest, stats, or delete.",
    inputSchema: {
      action: z.enum(["search", "ingest", "stats", "delete"]).describe("Operation to perform"),
      query: z.string().optional().describe("Search query (for search action)"),
      text: z.string().optional().describe("Raw text to index (for ingest action)"),
      url: z.string().optional().describe("URL to fetch and index (for ingest action)"),
      title: z.string().optional(),
      collection: z.string().optional().describe("Collection name"),
      source_type: z.string().optional().describe("Source type filter (for search action)"),
      source_url: z.string().optional().describe("Source URL filter (for delete action)"),
      max_results: z.number().min(1).max(50).optional().default(8),
    },
  },
  async (params) => {
    if (!isKbConfigured()) {
      return { content: [{ type: "text" as const, text: `[ERROR] ${json(err("system", "config_error", "Knowledge base not configured", "Add a kb section to config.json"))}` }] };
    }
    const action = params.action as "search" | "ingest" | "stats" | "delete";
    try {
      if (action === "search") {
        const results = kbSearch(
          String(params.query ?? ""),
      Number(params.max_results),
          params.collection as string | undefined,
          params.source_type as string | undefined
        );
        return { content: [{ type: "text" as const, text: `[OK] ${json({ status: "ok", provider: "knowledge_base", results })}` }] };
      }
      if (action === "ingest") {
        const text = params.text as string | undefined;
        const url = params.url as string | undefined;
        if (!text && !url) {
          return { content: [{ type: "text" as const, text: `[ERROR] ${json(err("knowledge_base", "invalid_input", "At least one of text or url must be provided", "Provide text or url parameter"))}` }] };
        }
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
      }
      if (action === "stats") {
        const stats = kbStats();
        return { content: [{ type: "text" as const, text: `[OK] ${json({ status: "ok", provider: "knowledge_base", results: [stats] })}` }] };
      }
      const collection = params.collection as string | undefined;
      const sourceUrl = params.source_url as string | undefined;
      if (!collection && !sourceUrl) {
        return { content: [{ type: "text" as const, text: `[ERROR] ${json(err("knowledge_base", "invalid_input", "At least one of collection or source_url must be provided", "Provide a filter parameter"))}` }] };
      }
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
    description: "Re-read config without restarting. Active connections are preserved.",
    inputSchema: {},
  },
  async () => {
    try {
      const newConfig = reloadConfig();
      configureAllProviders(newConfig);
      if (newConfig.kb) {
        flushKbWrites();
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

process.on("SIGHUP", () => {
  try {
    const newConfig = reloadConfig();
    configureAllProviders(newConfig);
    if (newConfig.kb) {
      flushKbWrites();
      initKb(newConfig.kb);
    }
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
