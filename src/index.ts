// @implements REQ-001 REQ-002 REQ-004 REQ-013 REQ-020 REQ-020a REQ-020b REQ-020c REQ-020d REQ-020e REQ-021 REQ-021b REQ-021c REQ-024 REQ-024a REQ-024b REQ-024c REQ-026 REQ-027 REQ-028 REQ-030 REQ-031 REQ-032 REQ-034 REQ-035 REQ-036 REQ-040 REQ-060 REQ-060a REQ-060b REQ-060c REQ-060d REQ-060e REQ-060f REQ-060g REQ-064 REQ-065 REQ-066 REQ-067 REQ-070 REQ-074 REQ-075 REQ-076 REQ-079 REQ-081 REQ-083 REQ-086
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { writeFileSync, mkdirSync, existsSync, readFileSync, chmodSync } from "node:fs";
import { join } from "node:path";
import { tmpdir, homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { loadConfig, reloadConfig, getConfig, getDispatchChain } from "./config.js";
import { configureAllProviders, throttle } from "./rate-limiter.js";
import { increment, checkQuota, loadQuotaState, getQuotaStatePath } from "./quota.js";
import { PROVIDERS, resolveProvider } from "./providers/index.js";
import { retryWithBackoff, ParseError } from "./retry.js";
import { corroborate } from "./corroborate.js";
import { ignoredParams, selectChain, demoteQuotaWarnings } from "./chain.js";
import { assertPublicUrl, fetchFollowRedirects, type FetchLike } from "./lib/url-guard.js";
import { initKb, isKbConfigured, kbSearch, kbIngest, kbStats, kbDelete, kbList, kbGet, resolveReportIdentity, resolveCollection, autoIndex, flushKbWrites, getKbLockError, getKbEncryptionState, sealReportBytes, generateKeyFile, verifyStoreKey, backupKeyFile, kbEncryptionStatus, rekeyStoreTo } from "./kb.js";
import { readKeyFile, type ResolvedKey } from "./kb-crypto.js";
import type { ProviderConfig, HealthReport, SearchResult, ToolOkResponse, ToolErrorResponse, SearchOptions } from "./types.js";
import { resolveHealthStatus, type HealthStatus } from "./health-status.js";
import { maybeTruncate } from "./truncate.js";
import { capInputs, mergeItems } from "./batch.js";
import { rankPassages } from "./rerank.js";
import { deepRead } from "./deep-search.js";
import { detectUpdatedAt } from "./datetime.js";
import { searchCitations } from "./cite.js";
import { deriveExpansions } from "./expand.js";
import { computeHedgeDelay, raceFirstSuccess } from "./hedge.js";
import { infobrokerFetch } from "./http.js";

const START_TIME = Date.now();
const SPEC_REVIEW_TIME = Date.now();
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
const responseBytes: number[] = [];
const RESPONSE_WINDOW = 100;

loadConfig();
configureAllProviders(getConfig());
loadQuotaState();

startupHealthCheck();

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

function err(provider: string, code: string, message: string, remediation: string, details?: Record<string, unknown>): ToolErrorResponse {
  return {
    status: "error",
    provider,
    error: { code, message, remediation, ...(details ? { details } : {}) },
  };
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "report";
}

function saveReportToDisk(title: string, text: string, format: string): string {
  const base = getConfig().kb?.reports_dir || join(homedir(), ".local", "share", "infobroker", "reports");
  const dir = base.startsWith("~/") ? join(homedir(), base.slice(2)) : base;
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o700 });
  const ext = format === "json" ? "json" : "md";
  const date = new Date().toISOString().slice(0, 10);
  const fpath = join(dir, `${date}-${slugify(title)}.${ext}`);
  // Reports are the sensitive class: encrypt them at rest when encryption is
  // enabled (REQ-084), and always restrict permissions to the owner.
  const bytes = sealReportBytes(Buffer.from(text, "utf-8"));
  writeFileSync(fpath, bytes);
  try {
    chmodSync(fpath, 0o600);
  } catch {
    // best effort
  }
  return fpath;
}

function json(data: unknown): string {
  const text = JSON.stringify(data, null, 2);
  responseBytes.push(text.length);
  if (responseBytes.length > RESPONSE_WINDOW) responseBytes.shift();
  return text;
}

function medianResponseBytes(): number {
  if (responseBytes.length === 0) return 0;
  const sorted = [...responseBytes].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
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
  query: string | string[],
  preferredProvider?: string,
  maxResults = 8,
  safeSearch: "on" | "off" | "strict" = "on",
  timeRange?: string,
  page = 1,
  priority?: string,
  suggest = false,
  contentType?: string,
  region?: string,
  expand = false,
  deep = false,
  deepBudget?: { remaining: number }
): Promise<string> {
  if (Array.isArray(query)) {
    const queries = capInputs(query);
    // A shared fetch budget bounds total page reads across the whole batch
    // (REQ-028): a 5-query deep search must not multiply the page budget.
    const deepBudget = deep ? { remaining: getConfig().deep?.max_total_pages ?? 8 } : undefined;
    const envelopes = await Promise.all(
      queries.map((q) =>
        doWebSearch(q, preferredProvider, maxResults, safeSearch, timeRange, page, priority, suggest, contentType, region, expand, deep, deepBudget)
      )
    );
    const merged = mergeItems(queries.map((q, i) => ({ query: q, envelope: envelopes[i] })));
    return merged.status === "ok" ? `[OK] ${json(merged)}` : `[ERROR] ${json(merged)}`;
  }

  const config = getConfig();

  if (suggest) {
    let lastErr: string | null = null;
    for (const [slug, provider] of Object.entries(PROVIDERS)) {
      if (!provider?.suggest) continue;
      if (config.providers[slug] && !config.providers[slug].enabled) continue;
      try {
        const suggestions = await provider.suggest(query);
        return `[OK] ${json({
          status: "ok",
          provider: slug,
          results: suggestions.map((s) => ({ title: s, url: "", snippet: s })),
          meta: { query_time_ms: 0, fallback_used: false },
        })}`;
      } catch (e) {
        lastErr = e instanceof Error ? e.message : String(e);
      }
    }
    return `[ERROR] ${json(err("duckduckgo", "provider_unavailable", lastErr ?? "No suggestion-capable provider available", "Retry later"))}`;
  }

  if (expand) {
    const suggestions: string[] = [];
    for (const [slug, provider] of Object.entries(PROVIDERS)) {
      if (!provider?.suggest) continue;
      if (config.providers[slug] && !config.providers[slug].enabled) continue;
      try {
        suggestions.push(...(await provider.suggest(query)));
        break;
      } catch {
        // suggestion provider unavailable — expand from the query keywords alone
      }
    }
    const maxExpansions = config.expand?.max_expansions;
    const expansions = deriveExpansions(query, suggestions, maxExpansions);
    return `[OK] ${json({
      status: "ok",
      provider: "duckduckgo",
      results: expansions.map((s) => ({ title: s, url: "", snippet: s })),
      meta: { query_time_ms: 0, fallback_used: false },
    })}`;
  }

  if (isKbConfigured()) {
    try {
      const kbResults = kbSearch(query, maxResults);
      if (kbResults.length > 0) {
        const relevanceThreshold = config.kb!.kb_first_relevance_threshold;
        const confidenceThreshold = config.kb!.kb_first_confidence_threshold;
        const sufficientResults = kbResults.filter(
          (r) => r.freshness_score >= confidenceThreshold && (r.score ?? 0) >= relevanceThreshold
        );
        if (sufficientResults.length > 0) {
          const kbProvider = "knowledge_base";
          return `[OK] ${json(ok(kbProvider, sufficientResults.map((r) => ({
            title: r.title,
            url: r.source_url,
            snippet: r.snippet,
            source_type: r.source_type,
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

  // REQ-020a: demote providers at quota warning below non-warning providers.
  chain = demoteQuotaWarnings(chain, (slug) =>
    checkQuota(slug, config.providers[slug]?.rate_limit).warning
  );

  if (chain.length === 0) {
    return `[ERROR] ${json(err("none", "config_error", "No active search providers configured", "Check config.json"))}`;
  }

  const opts: SearchOptions = { max_results: maxResults, safe_search: safeSearch, time_range: timeRange as SearchOptions["time_range"], page, region, content_type: contentType };
  let lastError: ToolErrorResponse | null = null;
  const quotaExhausted: Record<string, number> = {};

  const primarySlug = chain[0];
  const hedgeConf = config.output;
  const hedgeEnabled = hedgeConf.hedge_enabled !== false;
  const hedgeMinMs = hedgeConf.hedge_min_delay_ms ?? 200;
  const hedgeMaxMs = hedgeConf.hedge_max_delay_ms ?? 1500;

  // Attempt one provider: throttles, times, retries, applies the content-type
  // filter, and records quota/latency/error bookkeeping. Returns a non-empty
  // success payload, or null to advance the chain (empty results, filter
  // removal, or failure). Bookkeeping is done here so the shared
  // all_providers_exhausted path below stays identical to the sequential chain.
  const attempt = async (
    slug: string,
  ): Promise<{ slug: string; filtered: SearchResult[]; elapsed: number } | null> => {
    try {
      const quota = checkQuota(slug, config.providers[slug]?.rate_limit);
      if (quota.exhausted) {
        quotaExhausted[slug] = quota.daily.remaining;
        return null;
      }

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

      // REQ-031: an empty result set is a failure for chain advancement, not a
      // successful answer. Fall through to the next provider — but keep a
      // provider's empty as distinct from a total failure so the final
      // all-empty case is reported as a legitimate zero-result answer.
      if (results.length === 0) {
        providerLastError[slug] = { message: "empty result set", timestamp: Date.now() };
        return null;
      }

      const filtered = contentType ? filterByContentType(results, contentType) : results;
      if (filtered.length === 0) {
        providerLastError[slug] = { message: "content_type filter removed all results", timestamp: Date.now() };
        return null;
      }

      return { slug, filtered, elapsed };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      providerLastError[slug] = { message: msg, timestamp: Date.now() };
      if (e instanceof ParseError) {
        lastError = err(slug, "parse_error", msg, "Trying next provider in fallback chain");
      } else {
        lastError = err(slug, "provider_unavailable", msg, "Trying next provider in fallback chain");
      }
      return null;
    }
  };

  // Shape the winner's results into the response. `fallback_used` now means
  // "the serving provider was not the chain's first-choice provider" (the
  // hedge raced ahead of the primary), not merely "a provider errored".
  const buildSuccess = async (slug: string, filtered: SearchResult[], elapsed: number): Promise<string> => {
    autoIndex(filtered, slug, undefined, undefined, query, timeRange);

    if (deep && !compactMode()) {
      const deepConf = config.deep ?? { max_pages: 3, max_total_pages: 8, concurrency: 4, early_exit_score: 0.3, max_ms: 8000, detect_date: false };
      const maxPages = Math.min(deepConf.max_pages ?? 3, deepBudget ? deepBudget.remaining : (deepConf.max_pages ?? 3));
      const allowPrivateDeep = config.fetch?.allow_private_urls === true;
      const renderers = getDispatchChain("content_fetch");
      const deepMeta = await deepRead(
        query,
        filtered,
        deepConf,
        config.fetch?.passage_size ?? 100,
        config.fetch?.max_passages ?? 1,
        maxPages,
        async (url) => {
          const fetched = await fetchPageContent(url, renderers, config.output.max_chars, allowPrivateDeep);
          if (!fetched) return null;
          return { content: fetched.content, slug: fetched.slug };
        },
        {
          detectDate: deepConf.detect_date ? detectPageDate : undefined,
          rank: rankPassages,
          autoIndex: (r, content, provider) =>
            autoIndex([{ title: r.title, url: r.url, snippet: content, ...(r.last_updated ? { source_updated_at: r.last_updated } : {}) }], provider, undefined, "deep"),
        }
      );
      if (deepBudget) deepBudget.remaining -= deepMeta.pages_read;
      return `[OK] ${json(ok(slug, deepMeta.results, {
        query_time_ms: elapsed,
        fallback_used: slug !== primarySlug,
        quota_remaining: checkQuota(slug, config.providers[slug]?.rate_limit).daily.remaining,
        ignored_params: ignoredParams(slug, { safe_search: safeSearch, time_range: timeRange, page, content_type: contentType, region }),
        deep: true,
        pages_read: deepMeta.pages_read,
      }))}`;
    }

    return `[OK] ${json(ok(slug, filtered, {
      query_time_ms: elapsed,
      fallback_used: slug !== primarySlug,
      quota_remaining: checkQuota(slug, config.providers[slug]?.rate_limit).daily.remaining,
      ignored_params: ignoredParams(slug, { safe_search: safeSearch, time_range: timeRange, page, content_type: contentType, region }),
    }))}`;
  };

  if (hedgeEnabled && chain.length > 1) {
    // REQ-031 (hedged dispatch): run the primary alone for its hedge window;
    // if it has not answered by then (or fails), race the remaining providers
    // and take the first non-empty success, bounding worst-case latency.
    const hedgeDelay = computeHedgeDelay(avgLatency(primarySlug), { minMs: hedgeMinMs, maxMs: hedgeMaxMs });
    const primaryPromise = attempt(primarySlug);
    const deadline = new Promise<null>((resolve) => setTimeout(() => resolve(null), hedgeDelay));
    const primaryResult = await Promise.race([primaryPromise, deadline]);

    if (primaryResult !== null) {
      return buildSuccess(primaryResult.slug, primaryResult.filtered, primaryResult.elapsed);
    }

    try {
      const winner = await raceFirstSuccess<{ slug: string; filtered: SearchResult[]; elapsed: number }>([
        { slug: primarySlug, run: () => primaryPromise },
        ...chain.slice(1).map((slug) => ({ slug, run: () => attempt(slug) })),
      ]);
      return buildSuccess(winner.value.slug, winner.value.filtered, winner.value.elapsed);
    } catch {
      // every provider failed — fall through to the shared handling below
    }
  } else {
    for (const slug of chain) {
      const result = await attempt(slug);
      if (result !== null) {
        return buildSuccess(result.slug, result.filtered, result.elapsed);
      }
    }
  }

  // A chain that ended on provider errors is a failure; a chain whose
  // providers all returned empty is a legitimate zero-result answer.
  if (lastError !== null) {
    // REQ-031: report the remaining daily quota of each quota-exhausted
    // provider (distinct from provider failure), not merely its slug.
    const quotaExhaustedList = Object.entries(quotaExhausted).map(([slug, remaining]) => ({
      slug,
      remaining_daily: remaining,
    }));
    const details: Record<string, unknown> = {
      exhausted_chain: chain,
      quota_exhausted: quotaExhaustedList,
    };
    return `[ERROR] ${json(err("none", "all_providers_exhausted", `Fallback chain exhausted: ${chain.join(", ")}`, "Retry later or check provider configuration", details))}`;
  }
  return `[OK] ${json(ok("none", [], { query_time_ms: 0, fallback_used: true, ignored_params: [] }))}`;
}

// REQ-021c: best-effort last-updated detection. Reads the last-modified header
// via a manual-redirect HEAD, then falls back to parsing HTML metadata via a
// manual-redirect GET. Manual redirects avoid following a hop to a new host,
// so the SSRF guard (already asserted for the requested URL) is not bypassed.
async function detectPageDate(url: string): Promise<{ date: string; source: string; confidence: string } | undefined> {
  try {
    const head = await infobrokerFetch(url, { method: "HEAD", redirect: "manual", providerSlug: "native_fetch" });
    const headerData: Record<string, string | string[] | undefined> = {};
    head.headers.forEach((v, k) => (headerData[k] = v));
    let detected = detectUpdatedAt("", headerData);
    if (detected) return detected;

    if (head.status < 300 || head.status >= 400) {
      const get = await infobrokerFetch(url, { redirect: "manual", providerSlug: "native_fetch" });
      if (get.ok) {
        const html = (await get.text()).slice(0, 200000);
        detected = detectUpdatedAt(html);
        if (detected) return detected;
      }
    }
    return undefined;
  } catch {
    return undefined;
  }
}

// Shared fetch path for fetch_page and web_search deep reading. Walks the
// content_fetch renderer chain, applying throttle, timeout, retry, and
// truncation, and returns the first successful render. Returns null when every
// renderer is exhausted. Date detection, auto-indexing, and response shaping
// remain the caller's responsibility.
async function fetchPageContent(
  url: string,
  renderers: string[],
  maxChars: number,
  allowPrivate: boolean,
): Promise<{ slug: string; content: string; truncated: ReturnType<typeof maybeTruncate>; elapsed: number } | null> {
  const config = getConfig();
  const attempt = async (slug: string) => {
    try {
      await throttle(slug);
      const start = Date.now();

      const doCall = async (): Promise<string> => {
        if (slug === "native_fetch") {
          // REQ-021a: follow redirects hop-by-hop, re-applying the SSRF guard.
          return fetchFollowRedirects(url, allowPrivate, fetch as unknown as FetchLike, config.output.max_redirect_hops);
        }
        const provider = resolveProvider(slug);
        if (!provider?.fetchPage) {
          throw new Error(`Provider ${slug} has no fetchPage function`);
        }
        return await provider.fetchPage(url);
      };

      const timeoutMs = config.providers[slug]?.timeout;
      const timedCall = async (): Promise<string> =>
        Promise.race([
          doCall(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`Provider ${slug} timed out after ${timeoutMs}ms`)), timeoutMs)
          ),
        ]);
      const content = await retryWithBackoff(timedCall);

      const elapsed = Date.now() - start;
      increment(slug, config.providers[slug]?.rate_limit);
      trackRequest(slug, elapsed);
      providerLastSuccess[slug] = Date.now();
      return { slug, content, truncated: maybeTruncate(content, maxChars), elapsed };
    } catch (e) {
      providerLastError[slug] = { message: e instanceof Error ? e.message : String(e), timestamp: Date.now() };
      return null;
    }
  };

  const hedgeConf = config.output;
  const hedgeEnabled = hedgeConf.hedge_enabled !== false;

  if (hedgeEnabled && renderers.length > 1) {
    // REQ-021 (hedged renderer dispatch): prefer the primary renderer. Hedge a
    // fallback after the primary's latency window and race, giving the primary
    // a short grace window so a marginally-slow primary still serves rather
    // than a lower-quality fallback.
    const primarySlug = renderers[0];
    const hedgeMinMs = hedgeConf.hedge_min_delay_ms ?? 200;
    const hedgeMaxMs = hedgeConf.hedge_max_delay_ms ?? 1500;
    const hedgeGraceMs = hedgeConf.hedge_grace_ms ?? 300;
    const hedgeDelay = computeHedgeDelay(avgLatency(primarySlug), { minMs: hedgeMinMs, maxMs: hedgeMaxMs });

    const primaryPromise = attempt(primarySlug);
    const deadline = new Promise<null>((resolve) => setTimeout(() => resolve(null), hedgeDelay));
    const primaryResult = await Promise.race([primaryPromise, deadline]);

    if (primaryResult !== null) {
      return primaryResult;
    }

    try {
      const winner = await raceFirstSuccess([
        { slug: primarySlug, run: () => primaryPromise },
        ...renderers.slice(1).map((slug) => ({ slug, run: () => attempt(slug) })),
      ], { prefer: primarySlug, graceMs: hedgeGraceMs });
      return winner.value;
    } catch {
      return null;
    }
  }

  for (const slug of renderers) {
    const result = await attempt(slug);
    if (result !== null) return result;
  }
  return null;
}

async function doFetchPage(
  url: string | string[],
  renderer?: string,
  maxLength?: number,
  question?: string,
  passageSize?: number,
  maxPassages?: number,
  detectDate?: boolean
): Promise<string> {
  if (Array.isArray(url)) {
    const urls = capInputs(url);
    const envelopes = await Promise.all(
      urls.map((u) => doFetchPage(u, renderer, maxLength, question, passageSize, maxPassages, detectDate))
    );
    const merged = mergeItems(urls.map((u, i) => ({ query: u, envelope: envelopes[i] })));
    return merged.status === "ok" ? `[OK] ${json(merged)}` : `[ERROR] ${json(merged)}`;
  }

  const config = getConfig();
  const renderers = renderer ? [renderer] : getDispatchChain("content_fetch");
  const effectiveMax = maxLength ?? config.output.max_chars;
  const effectivePassageSize = passageSize ?? config.fetch?.passage_size;
  const effectiveMaxPassages = maxPassages ?? config.fetch?.max_passages;
  const effectiveDetectDate = detectDate ?? config.fetch?.detect_date ?? true;

  const allowPrivate = config.fetch?.allow_private_urls === true;
  try {
    assertPublicUrl(url, allowPrivate);
  } catch (e) {
    return `[ERROR] ${json(err("none", "invalid_input", e instanceof Error ? e.message : String(e), `Set fetch.allow_private_urls=true to permit private targets`))}`;
  }

  const fetched = await fetchPageContent(url, renderers, effectiveMax, allowPrivate);
  if (fetched === null) {
    return `[ERROR] ${json(err("none", "all_providers_exhausted", `All content renderers exhausted for: ${url}`, "Check network connectivity"))}`;
  }
  const { slug, content, truncated, elapsed } = fetched;

  const pageDate = effectiveDetectDate ? await detectPageDate(url) : undefined;
  const dateMeta = pageDate
    ? { last_updated: pageDate.date, date_source: pageDate.source, date_confidence: pageDate.confidence }
    : {};

  autoIndex([{ title: new URL(url).hostname, url, snippet: content, ...(pageDate ? { source_updated_at: pageDate.date } : {}) }], slug, undefined, "fetch_page");

  if (question) {
    const passages = rankPassages(content, question, effectivePassageSize ?? 100, effectiveMaxPassages ?? 1);
    if (passages.length > 0) {
      return `[OK] ${json({
        status: "ok",
        provider: slug,
        question,
        extraction_mode: "content",
        results: [{
          title: new URL(url).hostname,
          url,
          snippet: passages[0].text,
          ...dateMeta,
        }],
        snippets: passages.map((p) => ({ text: p.text, score: p.score, index: p.index })),
        top_score: passages[0].score,
        ...dateMeta,
        meta: {
          query_time_ms: elapsed,
          fallback_used: false,
        },
      })}`;
    }
    return `[OK] ${json({
      status: "ok",
      provider: slug,
      question,
      extraction_mode: "full_content",
      results: [{
        title: new URL(url).hostname,
        url,
        snippet: truncated.text,
        ...dateMeta,
      }],
      note: "No passage addressed the question; returning the full content instead.",
      ...dateMeta,
      meta: {
        query_time_ms: elapsed,
        fallback_used: false,
      },
      ...(truncated.truncated ? { truncated: true, output_path: truncated.outputPath } : {}),
    })}`;
  }

  return `[OK] ${json({
    status: "ok",
    provider: slug,
    results: [{
      title: new URL(url).hostname,
      url,
      snippet: truncated.text,
      ...dateMeta,
    }],
    ...dateMeta,
    meta: {
      query_time_ms: elapsed,
      fallback_used: false,
    },
    ...(truncated.truncated ? { truncated: true, output_path: truncated.outputPath } : {}),
  })}`;
}

function providerOperational(p: ProviderConfig): boolean {
  if (!p.enabled) return false;
  if (p.auth_env && !process.env[p.auth_env]) return false;
  if (p.url_env && !process.env[p.url_env]) return false;
  return true;
}

function providerInactiveReason(p: ProviderConfig): "disabled" | "no_api_key" | "no_url" | null {
  if (!p.enabled) return "disabled";
  if (p.auth_env && !process.env[p.auth_env]) return "no_api_key";
  if (p.url_env && !process.env[p.url_env]) return "no_url";
  return null;
}

function doListProviders(filter?: string): string {
  const config = getConfig();
  const entries = Object.entries(config.providers);

  const filtered = filter === "active"
    ? entries.filter(([, p]) => providerOperational(p))
    : entries;

  const list = filtered.map(([slug, p]) => {
    const quota = checkQuota(slug, p.rate_limit);
    const operational = providerOperational(p);
    const reason = quota.exhausted ? "exhausted" : (operational ? null : providerInactiveReason(p));
    return {
      slug,
      tier: p.tier,
      capabilities: p.capabilities,
      enabled: p.enabled,
      status: quota.exhausted ? "exhausted" : (operational ? "active" : "inactive"),
      ...(reason ? { inactive_reason: reason } : {}),
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
  let status: HealthStatus = authOk ? "active" : "inactive";

  let avgLatencyMs: number | undefined;
  const registeredProvider = resolveProvider(providerSlug);
  if (registeredProvider && authOk) {
    try {
      const h = await registeredProvider.health();
      const base = h.status as "active" | "degraded" | "inactive";
      status = base;
      // REQ-036: report the server's bounded time-window latency when a local
      // history exists, falling back to the provider's own live measurement
      // (e.g. first call, no recorded requests yet).
      avgLatencyMs = avgLatency(providerSlug) || h.avgLatencyMs;
      providerLastSuccess[providerSlug] = Date.now();
    } catch (e) {
      providerLastError[providerSlug] = { message: e instanceof Error ? e.message : String(e), timestamp: Date.now() };
      if (status === "active") {
        status = "degraded";
      }
    }
  } else {
    avgLatencyMs = avgLatency(providerSlug) || 0;
  }

  status = resolveHealthStatus({
    baseStatus: status,
    quotaExhausted: quota.exhausted,
    quotaWarning: quota.warning,
    avgLatencyMs,
    degradedLatencyMs: p.degraded_latency_ms ?? config.output.degraded_latency_ms,
  });

  const report: HealthReport = {
    status: status as HealthReport["status"],
    slug: providerSlug,
    tier: p.tier,
    capabilities: p.capabilities,
    quota_used: quota.daily.used,
    quota_remaining: quota.daily.remaining,
    quota_reset_at: quota.daily.resetAt,
    quota_warning: quota.warning,
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

  let toolSchemaBytes = 0;
  const registered = (server as any)._registeredTools as Record<string, { inputSchema?: { shape?: { [k: string]: unknown } } }> | undefined;
  if (registered) {
    for (const tool of Object.values(registered)) {
      const shape = tool?.inputSchema?.shape;
      toolSchemaBytes += shape ? JSON.stringify(shape).length : 0;
    }
  }

  return `[OK] ${json({
    status: "ok",
    provider: "system",
    results: [{
      build_version: BUILD_VERSION,
      provider_count: Object.keys(config.providers).filter(k => k !== "native_fetch").length,
      active_provider_count: activeCount,
      tool_count: toolCount,
      token_footprint: {
        tool_schema_bytes: toolSchemaBytes,
        median_response_bytes: medianResponseBytes(),
      },
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
      kb_storage_path: config.kb
        ? (config.kb.storage_path.startsWith("~/")
            ? join(homedir(), config.kb.storage_path.slice(2))
            : config.kb.storage_path)
        : undefined,
      truncation_dir: join(tmpdir(), "infobroker"),
    }],
  })}`;
}

const server = new McpServer({
  name: "infobroker",
  version: "2026.09.02",
});

// --- web_search ---
server.registerTool(
  "infobroker_web_search",
  {
    title: "Web Search",
    description: "Search the web, encyclopedia, academic, and code sources through one interface with automatic provider selection and a fallback chain. Use when you need broad or batched search, query autocomplete (suggest), query expansion (expand), or ranked passages from the top pages (deep). Do NOT use for a URL you already have (use fetch_page), for high-stakes claim verification (use verify_claims), for stored-report recall (use manage_kb search), or for academic citations (use get_citations). Caches results in the local knowledge base, enforces per-provider rate limits, and needs no API key for the free providers. Returns a JSON envelope prefixed `[OK]` or `[ERROR]` with status, provider, results, and meta.",
    inputSchema: {
      query: z.union([z.string().describe("Search query"), z.array(z.string()).max(5).describe("Multiple queries to search in parallel (max 5)")]).describe("Search query: a single string, or up to five strings searched in parallel"),
      provider: z.string().optional().describe("Provider slug (auto-select if omitted)"),
      max_results: z.number().min(1).max(30).optional().default(8).describe("Number of results to return (1-30, default 8)"),
      safe_search: z.enum(["on", "off", "strict"]).optional().default("on").describe("Safe-search filtering: on, off, or strict (default on)"),
      time_range: z.enum(["day", "week", "month", "year"]).optional().describe("Restrict results to day, week, month, or year"),
      page: z.number().min(1).optional().default(1).describe("Results page number (default 1)"),
      priority: z.enum(["speed", "quality", "privacy", "free_only"]).optional().describe("Route by intent: speed, quality, privacy, or free_only"),
      suggest: z.boolean().optional().default(false).describe("Return query-autocomplete strings instead of results (default false)"),
      expand: z.boolean().optional().default(false).describe("Return query-expansion strings instead of search results"),
      deep: z.boolean().optional().default(false).describe("Read the top results and return each page's ranked passages against the query"),
      content_type: z.enum(["docs", "issue", "changelog", "blog", "spec", "all"]).optional().default("all").describe("Source kind to search: docs, issue, changelog, blog, spec, or all (default all)"),
      region: z.string().optional().describe("ISO region/country code (e.g. 'us-en', 'DE')"),
    },
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  async (params) => {
    const content = await doWebSearch(
      params.query,
      params.provider as string | undefined,
      Number(params.max_results),
      (params.safe_search as "on" | "off" | "strict") ?? "on",
      params.time_range as string | undefined,
      Number(params.page),
      params.priority as string | undefined,
      Boolean(params.suggest),
      params.content_type as string | undefined,
      params.region as string | undefined,
      Boolean(params.expand),
      Boolean(params.deep)
    );
    return { content: [{ type: "text" as const, text: content }] };
  }
);

// --- fetch_page ---
server.registerTool(
  "infobroker_fetch_page",
  {
    title: "Fetch Page Content",
    description: "Fetch a URL and extract clean content via a renderer (Jina Reader by default, with native-HTTP, Wikipedia, Internet Archive, arXiv, and Stack Exchange renderers). Use when you have a URL and need readable text, want to ask the page a question (question mode returns ranked passages), or need the page's last-updated date (detect_date). Do NOT use for a general topic search (use web_search) or for claim verification across sources (use verify_claims). Makes external HTTP calls, falls back to native HTTP when Jina is throttled, truncates very long pages, and needs no API key. Returns a JSON envelope prefixed `[OK]` or `[ERROR]` with status, provider, results, and meta.",
    inputSchema: {
      url: z.union([z.string().describe("URL to fetch"), z.array(z.string()).max(5).describe("Multiple URLs to fetch in parallel (max 5)")]).describe("URL to fetch: a single URL, or up to five URLs fetched in parallel"),
      renderer: z.enum(["jina", "native_fetch", "wikipedia", "internet_archive", "arxiv", "stack_exchange"]).optional().describe("Renderer: jina (default), native_fetch, wikipedia, internet_archive, arxiv, or stack_exchange"),
      max_length: z.number().optional().default(50000).describe("Maximum characters to return (default 50000)"),
      question: z.string().optional().describe("Question to extract ranked passages for, instead of returning the whole page"),
      passage_size: z.number().optional().describe("Target words per passage (default from config)"),
      max_passages: z.number().optional().describe("Number of passages to return (default from config)"),
      detect_date: z.boolean().optional().describe("Detect and report the page's last-updated date (default from config)"),
    },
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  async (params) => {
    const content = await doFetchPage(
      params.url,
      params.renderer as string | undefined,
      params.max_length !== undefined ? Number(params.max_length) : undefined,
      params.question as string | undefined,
      params.passage_size !== undefined ? Number(params.passage_size) : undefined,
      params.max_passages !== undefined ? Number(params.max_passages) : undefined,
      params.detect_date as boolean | undefined
    );
    return { content: [{ type: "text" as const, text: content }] };
  }
);

// --- providers ---
server.registerTool(
  "infobroker_inspect_providers",
  {
    title: "Inspect Providers",
    description: "Inspect configured search providers: list their state, run a live health check, or report build and spec identity. Use when searches return empty or slow results and you want provider status, quota, or latency, or when choosing which backend to trust. Do NOT use to search (use web_search) or to read a page (use fetch_page). Read-only: it reports state and never modifies configuration, providers, or stored data. `provider` is required for the `health` action; `status` filters `list`. Returns a JSON envelope prefixed `[OK]` or `[ERROR]` with status, provider, and results.",
    inputSchema: {
      action: z.enum(["list", "health", "spec"]).describe("Operation to perform"),
      provider: z.string().optional().describe("Provider slug (required for health)"),
      status: z.enum(["active", "all"]).optional().describe("Filter for list action"),
    },
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
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

// --- verify_claims ---
server.registerTool(
  "infobroker_verify_claims",
  {
    title: "Verify Claims",
    description: "Run a multi-pass truth-finding loop that searches across providers, reconciles claims across independent sources, and returns confidence-scored findings with per-claim source attribution. Use when a claim is high-stakes or contested and you need agreement, contradiction, and gaps surfaced with confidence scores. Do NOT use for simple lookups or broad search (use web_search) or for citation formatting (use get_citations). Makes multiple searches bounded by max_iterations and per-provider rate limits, recalls prior findings from the knowledge base, and indexes its findings back into the knowledge base. `max_iterations` bounds the refinement passes; `confidence_threshold` is the bar for a finding to be reported confirmed. Returns a JSON envelope prefixed `[OK]` or `[ERROR]`.",
    inputSchema: {
      query: z.string().describe("Search query"),
      max_iterations: z.number().min(1).max(10).optional().default(5).describe("Maximum search-refinement passes (1-10, default 5)"),
      confidence_threshold: z.number().min(0).max(1).optional().default(0.8).describe("Minimum confidence to report a finding as confirmed (0-1, default 0.8)"),
      providers: z.array(z.string()).optional().describe("Optional array of provider slugs to limit the search to"),
      priority: z.enum(["speed", "quality", "privacy", "free_only"]).optional().describe("Route the corroboration pool by intent"),
    },
    annotations: {
      readOnlyHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
  async (params) => {
    try {
      const result = await corroborate(String(params.query), {
        max_iterations: Number(params.max_iterations),
        confidence_threshold: Number(params.confidence_threshold),
        providers: params.providers as string[] | undefined,
        priority: params.priority as "speed" | "quality" | "privacy" | "free_only" | undefined,
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
  "infobroker_manage_kb",
  {
    title: "Knowledge Base",
    description: "Manage the local knowledge base: search, ingest, list, get, stats, or delete stored content and reports, and manage at-rest encryption. Use when you need to archive a generated report (ingest with source_type 'report' and save_to 'kb'), revisit stored content (list/get), or manage encryption keys. Use the 'encryption' action to enable or disable at-rest encryption, generate or back up a key, verify a key, or re-key the store. Do NOT use for fresh external search (use web_search) or to fetch a new page (use fetch_page). The delete action is destructive and cannot be undone; a lost encryption key makes the store unrecoverable by design. Which parameter each action needs: `query` for search, `text` or `url` for ingest, `source_url` for get/delete. Returns a JSON envelope prefixed `[OK]` or `[ERROR]`.",
    inputSchema: {
      action: z.enum(["search", "ingest", "list", "get", "stats", "delete", "encryption"]).describe("Operation to perform"),
      operation: z.enum(["status", "generate_key", "verify", "backup", "rekey"]).optional().describe("Sub-operation for the 'encryption' action"),
      key_file: z.string().optional().describe("Path to a key file (generate_key writes here; rekey reads the target key from here). Never pass the secret itself — only a file path."),
      query: z.string().optional().describe("Search query (for search action)"),
      text: z.string().optional().describe("Raw text to index (for ingest action)"),
      url: z.string().optional().describe("URL to fetch and index (for ingest action)"),
      title: z.string().optional().describe("Document/report title"),
      collection: z.string().optional().describe("Collection name"),
      source_type: z.string().optional().describe("Source type (tag on ingest; filter on search/list)"),
      freshness_tier: z.string().optional().describe("Freshness tier tag on ingest (e.g. 'report', 'evergreen')"),
      last_updated: z.string().optional().describe("Source last-updated date to store (e.g. '2026-08-24'); auto-detected from fetched URLs when omitted"),
      save_to: z.enum(["kb", "disk", "both"]).optional().describe("Where to save (ingest action): kb, disk, or both. Default kb"),
      format: z.enum(["markdown", "text", "json"]).optional().default("markdown").describe("File format for disk save"),
      source_url: z.string().optional().describe("Source URL filter (get/delete action) or identity for ingest"),
      max_results: z.number().min(1).max(50).optional().default(8).describe("Maximum results to return (1-50, default 8)"),
    },
    annotations: {
      destructiveHint: true,
      readOnlyHint: false,
      idempotentHint: false,
    },
  },
  async (params) => {
    if (!isKbConfigured()) {
      return { content: [{ type: "text" as const, text: `[ERROR] ${json(err("system", "config_error", "Knowledge base not configured", "Add a kb section to config.json"))}` }] };
    }
    const action = params.action as "search" | "ingest" | "list" | "get" | "stats" | "delete" | "encryption";
    // The encryption action is the recovery surface: it must remain reachable
    // even when the store is locked so the user can verify a key, restore a
    // backup, or re-key. All other actions honor the lock.
    if (action !== "encryption") {
      const lock = getKbLockError();
      if (lock) {
        return { content: [{ type: "text" as const, text: `[ERROR] ${json(err("knowledge_base", lock.code, lock.message, lock.remediation))}` }] };
      }
    }
    try {
      if (action === "encryption") {
        const op = (params.operation as string) || "status";
        const keyFile = params.key_file as string | undefined;

        if (op === "status") {
          const status = kbEncryptionStatus();
          return { content: [{ type: "text" as const, text: `[OK] ${json({ status: "ok", provider: "knowledge_base", results: [status] })}` }] };
        }

        if (op === "generate_key") {
          if (!keyFile) {
            return { content: [{ type: "text" as const, text: `[ERROR] ${json(err("knowledge_base", "invalid_input", "key_file path is required for generate_key", "Provide a writeable key file path"))}` }] };
          }
          const path = generateKeyFile(keyFile);
          const msg = json({ status: "ok", provider: "knowledge_base", results: [{ title: "key generated", url: `file://${path}`, snippet: `Key written to ${path}. Back it up now — without it the store is unrecoverable.` }] });
          return { content: [{ type: "text" as const, text: `[OK] ${msg}` }] };
        }

        if (op === "verify") {
          const ok = verifyStoreKey();
          const msg = json({ status: "ok", provider: "knowledge_base", results: [{ title: ok ? "key verified" : "key mismatch", url: "", snippet: ok ? "The configured key opens the store." : "The configured key does not open the store (or no key is configured / store is not encrypted). The store has not been modified." }] });
          return { content: [{ type: "text" as const, text: `[OK] ${msg}` }] };
        }

        if (op === "backup") {
          if (!keyFile) {
            return { content: [{ type: "text" as const, text: `[ERROR] ${json(err("knowledge_base", "invalid_input", "key_file path is required for backup (destination)", "Provide a backup file path; the active key is copied there"))}` }] };
          }
          const path = backupKeyFile(keyFile);
          if (!path) {
            return { content: [{ type: "text" as const, text: `[ERROR] ${json(err("knowledge_base", "invalid_input", "No file-based key to back up", "The active key source is not kb.encryption.key_file, so nothing was copied. Back up INFOBROKER_KB_KEY / INFOBROKER_KB_PASSPHRASE manually."))}` }] };
          }
          const msg = json({ status: "ok", provider: "knowledge_base", results: [{ title: "key backed up", url: `file://${path}`, snippet: `Key copied to ${path}. Keep this file somewhere safe and separate from the store.` }] });
          return { content: [{ type: "text" as const, text: `[OK] ${msg}` }] };
        }

        if (op === "rekey") {
          if (!keyFile) {
            return { content: [{ type: "text" as const, text: `[ERROR] ${json(err("knowledge_base", "invalid_input", "key_file path is required for rekey (new target key file)", "Generate a new key file first (generate_key), then pass its path here"))}` }] };
          }
          let target: ResolvedKey | null = null;
          try {
            target = { kind: "raw", dek: readKeyFile(keyFile) };
          } catch {
            target = null;
          }
          if (!target) {
            return { content: [{ type: "text" as const, text: `[ERROR] ${json(err("knowledge_base", "invalid_input", "Could not read the target key file", "Ensure the key file exists and contains a valid key"))}` }] };
          }
          const result = rekeyStoreTo(null, target);
          if (!result) {
            return { content: [{ type: "text" as const, text: `[ERROR] ${json(err("knowledge_base", "invalid_input", "Store is not encrypted or no source key is loaded", "Re-key requires an encrypted store and an active key"))}` }] };
          }
          const msg = json({ status: "ok", provider: "knowledge_base", results: [{ title: "re-keyed", url: "", snippet: "Store re-keyed to the new key file. Update kb.encryption.key_file in config.local.json to point at the new key, then reload." }] });
          return { content: [{ type: "text" as const, text: `[OK] ${msg}` }] };
        }

        return { content: [{ type: "text" as const, text: `[ERROR] ${json(err("knowledge_base", "invalid_input", `Unknown encryption operation "${op}"`, "Use one of: status, generate_key, verify, backup, rekey"))}` }] };
      }

      if (action === "search") {
        const results = kbSearch(
          String(params.query ?? ""),
          Number(params.max_results),
          resolveCollection(params.collection as string | undefined),
          params.source_type as string | undefined
        );
        return { content: [{ type: "text" as const, text: `[OK] ${json({ status: "ok", provider: "knowledge_base", results })}` }] };
      }
      if (action === "list") {
        const entries = kbList(
          resolveCollection(params.collection as string | undefined),
          params.source_type as string | undefined
        );
        return { content: [{ type: "text" as const, text: `[OK] ${json({ status: "ok", provider: "knowledge_base", results: entries })}` }] };
      }
      if (action === "get") {
        const sourceUrl = params.source_url as string | undefined;
        if (!sourceUrl) {
          return { content: [{ type: "text" as const, text: `[ERROR] ${json(err("knowledge_base", "invalid_input", "source_url is required for get action", "Provide source_url (see list action for identities)"))}` }] };
        }
        const doc = kbGet(sourceUrl);
        if (!doc) {
          return { content: [{ type: "text" as const, text: `[ERROR] ${json(err("knowledge_base", "not_found", `No document with source_url "${sourceUrl}"`, "Use list action to enumerate stored documents"))}` }] };
        }
        return { content: [{ type: "text" as const, text: `[OK] ${json({ status: "ok", provider: "knowledge_base", results: [doc] })}` }] };
      }
      if (action === "ingest") {
        const text = params.text as string | undefined;
        const url = params.url as string | undefined;
        if (!text && !url) {
          return { content: [{ type: "text" as const, text: `[ERROR] ${json(err("knowledge_base", "invalid_input", "At least one of text or url must be provided", "Provide text or url parameter"))}` }] };
        }
        let content = text || "";
        let sourceUpdatedAt = (params.last_updated as string) || undefined;
        if (url && !text) {
          const fetched = await doFetchPage(url);
          if (fetched.startsWith("[ERROR]")) {
            return { content: [{ type: "text" as const, text: fetched }] };
          }
          const parsed = JSON.parse(fetched.slice(5));
          content = parsed.results?.[0]?.snippet || "";
          if (!sourceUpdatedAt && parsed.last_updated) {
            sourceUpdatedAt = parsed.last_updated;
          }
        }

        const title = (params.title as string) || url || "untitled";
        const sourceType = (params.source_type as string) || "explicit";
        const isReport = sourceType === "report";
        const collection = (params.collection as string) || (isReport ? "reports" : undefined);
        const freshnessTier = (params.freshness_tier as string) || (isReport ? "report" : undefined);
        const saveTo = (params.save_to as string) || getConfig().kb?.default_save_destination || "kb";

        let finalUrl = resolveReportIdentity(title, url || params.source_url as string | undefined);
        let diskPath: string | undefined;
        if (saveTo === "disk" || saveTo === "both") {
          diskPath = saveReportToDisk(title, content, String(params.format || "markdown"));
          finalUrl = `file://${diskPath}`;
        } else if (!url) {
          finalUrl = isReport ? resolveReportIdentity(title, undefined) : "";
        }

        const count = kbIngest(
          content,
          title,
          finalUrl,
          "explicit",
          collection,
          sourceType,
          freshnessTier,
          sourceUpdatedAt
        );
        const msg = json({
          status: "ok",
          provider: "knowledge_base",
          results: [{ title: "ingested", url: finalUrl, snippet: `${count} chunks ingested` }],
          meta: { chunks_ingested: count, source_type: sourceType, freshness_tier: freshnessTier, saved_to: saveTo, ...(collection ? { collection } : {}), ...(diskPath ? { disk_path: diskPath } : {}) },
        });
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
    description: "Re-read the configuration file and apply provider, rate-limit, and knowledge-base changes without restarting; active connections are preserved. Use when you have edited config.json or config.local.json and want the changes applied immediately. Do NOT use to inspect configuration or provider state (use inspect_providers). If the new configuration is invalid, the previous configuration stays active and an error is returned. Returns a JSON envelope prefixed `[OK]` or `[ERROR]`.",
    inputSchema: {},
    annotations: {
      readOnlyHint: false,
      idempotentHint: true,
    },
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
      const lock = getKbLockError();
      const state = getKbEncryptionState();
      const guidance =
        state === "enabled"
          ? " Enabling encryption makes the store unrecoverable without the key — back up your key now (kb 'encryption' action, 'backup')."
          : state === "disabled"
            ? " Encryption disabled. If the store was previously encrypted it is now decrypted on disk; remove the key material only after confirming (kb 'encryption' action, 'status')."
            : "";
      const message =
        `Configuration reloaded. Knowledge base encryption: ${state}.${guidance}` +
        (lock ? ` Knowledge base LOCKED: ${lock.message}` : "");
      return { content: [{ type: "text" as const, text: `[OK] ${json({ status: "ok", provider: "system", results: [{ message, provider_count: Object.keys(newConfig.providers).length }] })}` }] };
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

// --- cite ---
server.registerTool(
  "infobroker_get_citations",
  {
    title: "Get Citations",
    description: "Return academic references for a query as BibTeX citations with title, authors, year, venue, and URL. Use when scholarly writing needs a reference list. Do NOT use for general web search (use web_search) or for verifying a contested claim (use verify_claims). Operates without an API key when at least one scholarly source is reachable. Returns a JSON envelope prefixed `[OK]` or `[ERROR]`.",
    inputSchema: {
      query: z.string().describe("Search query"),
      max_results: z.number().min(1).max(30).optional().default(8).describe("Maximum references to return (1-30, default 8)"),
    },
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
  },
  async (params) => {
    try {
      const citations = await searchCitations(String(params.query), Number(params.max_results));
      return {
        content: [
          {
            type: "text" as const,
            text: `[OK] ${json({
              status: "ok",
              provider: "academic",
              results: citations.map((c) => ({
                title: c.title,
                url: c.url,
                year: c.year,
                authors: c.authors,
                venue: c.venue,
                bibtex: c.bibtex,
              })),
            })}`,
          },
        ],
      };
    } catch (e) {
      return {
        content: [
          {
            type: "text" as const,
            text: `[ERROR] ${json(err("academic", "provider_unavailable", e instanceof Error ? e.message : String(e), "Retry later"))}`,
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
  // Load the KB after the MCP handshake so a large vector store cannot block
  // the `initialize` request past a client's timeout window.
  const kbConfig = getConfig().kb;
  if (kbConfig) {
    initKb(kbConfig);
    console.error("[infobroker] Knowledge base initialized");
  } else {
    console.error("[infobroker] Knowledge base not configured — KB tools disabled");
  }
}

main().catch((e) => {
  console.error("Infobroker failed to start:", e);
  process.exit(1);
});
