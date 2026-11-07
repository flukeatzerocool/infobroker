// @implements REQ-001 REQ-002 REQ-004 REQ-013 REQ-015 REQ-020 REQ-020a REQ-020b REQ-020c REQ-020d REQ-020e REQ-020f REQ-020h REQ-020i REQ-076a REQ-120a REQ-021 REQ-021a REQ-021b REQ-021c REQ-021d REQ-021e REQ-021f REQ-024 REQ-024a REQ-024b REQ-024c REQ-026 REQ-027 REQ-028 REQ-030 REQ-031 REQ-032 REQ-034 REQ-035 REQ-036 REQ-040 REQ-060 REQ-060a REQ-060b REQ-060c REQ-060d REQ-060e REQ-060f REQ-060g REQ-064 REQ-065 REQ-066 REQ-067 REQ-070 REQ-074 REQ-075 REQ-076 REQ-079 REQ-081 REQ-083 REQ-086 REQ-097 REQ-098 REQ-099 REQ-102 REQ-105 REQ-060i REQ-110 REQ-111 REQ-111a REQ-112 REQ-113
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { writeFileSync, mkdirSync, existsSync, readFileSync, chmodSync } from "node:fs";
import { join } from "node:path";
import { tmpdir, homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { loadConfig, reloadConfig, getConfig, getDispatchChain, getUserConfigDrift, migrateUserConfigLayer, patchUserConfigLayer, getStartupConfigIssue, getStartupMigration } from "./config.js";
import { configureAllProviders, throttle } from "./rate-limiter.js";
import { increment, checkQuota, loadQuotaState, getQuotaStatePath } from "./quota.js";
import { PROVIDERS, resolveProvider, resetGenericProviderCache } from "./providers/index.js";
import { retryWithBackoff, ParseError, RetryableError } from "./retry.js";
import { corroborate } from "./corroborate.js";
import { snapshotSource } from "./preservation.js";
import { ignoredParams, selectChain, demoteQuotaWarnings, crossTaskFallbackChain, preferLanguageCapable } from "./chain.js";
import { ignoredOperators, parseQuery } from "./query.js";
import { shouldCooldown, markCooldown, inCooldown, cooldownRemainingMs, cooldownDurationMs, activeCooldowns } from "./cooldown.js";
import { recordAttempt, recordTool, callLogTarget } from "./call-log.js";
import { sessionStats } from "./session-stats.js";
import { filterBlocked, isBlocked, qualityScore } from "./source-quality.js";
import { assertPublicUrl, assertPublicUrlResolved, assertHttpUrlProtocol, fetchFollowRedirects, SsrRefusalError, UnsupportedProtocolError, type FetchLike } from "./lib/url-guard.js";
import { isBotChallenge } from "./lib/bot-challenge.js";
import { initKb, isKbConfigured, kbSearch, kbIngest, kbStats, kbDelete, kbList, kbGet, kbGetReportSources, resolveReportIdentity, resolveCollection, ingestDestinations, autoIndex, flushKbWrites, getKbLockError, getKbEncryptionState, sealReportBytes, generateKeyFile, verifyStoreKey, backupKeyFile, kbEncryptionStatus, rekeyStoreTo, resolveKeyFile, kbRecordClaims, kbClaims, kbPutReportReceipt, kbVerifyReport } from "./kb.js";
import { readKeyFile, type ResolvedKey } from "./kb-crypto.js";
import { normalizeReceiptInput, RECEIPT_LIMITS } from "./kb-receipt.js";
import { checkContent, disposition, policyMode, policyMeta } from "./content-policy.js";
import { audit } from "./audit-log.js";
import type { ProviderConfig, HealthReport, SearchResult, ToolOkResponse, ToolErrorResponse, SearchOptions } from "./types.js";
import { resolveHealthStatus, type HealthStatus } from "./health-status.js";
import { maybeTruncate } from "./truncate.js";
import { blendResponseMeta, capInputs, coerceStringArray, mergeItems, mergeKnowledgeBaseResults, parseEnvelope, type KbRecallState } from "./batch.js";
import { settleBatch } from "./batch-run.js";
import { err, chainExhaustion, providerRemediation } from "./error-envelope.js";
import { reconcileResults } from "./dedup.js";
import { rankDocs } from "./embed.js";
import { resolveTaskType, SEARCHABLE_TASK_TYPES } from "./task-type.js";
import { createLatencyTracker } from "./latency.js";
import { compactMode, compactResults } from "./verbosity.js";
import { deriveResearchVariants, compileResearchGroups } from "./research.js";
import { keyPoolStatus } from "./key-pool.js";
import { matchQuality, rankPassages } from "./rerank.js";
import { envelopeOutputSchema } from "./output-schema.js";
import { finalizeToolResult, parseEnvelopeObject, rawRequestError, rawTextFromEnvelope } from "./structured-output.js";
import { deepRead } from "./deep-search.js";
import { analyzeResults } from "./analysis.js";
import { derivePrivacy } from "./privacy.js";
import { detectUpdatedAt } from "./datetime.js";
import { searchCitations } from "./cite.js";
import { deriveExpansions } from "./expand.js";
import { computeHedgeDelay, raceFirstSuccess } from "./hedge.js";
import { infobrokerFetch } from "./http.js";
import { htmlToText, stripHtml } from "./lib/html.js";
import { shouldUseKbCache } from "./fetch-cache.js";
import { createToolMetrics } from "./tool-metrics.js";
import { sanitizeErrorMessage } from "./lib/sanitize-error.js";
import { withTimeout } from "./lib/timeout.js";
import { extractStructured, extractLinks, isSameOrigin } from "./extract.js";
import { applyFactsToEnvelope, enrichStructuredFacts } from "./structured-fact.js";
import { classifyFailure, failureTaxonomy, resolveFetchFallback, type FetchFailure } from "./fetch-fallback.js";
import { collectNotices, computeStateHealth, injectNotices } from "./state-health.js";
import { configureUpdateCheck } from "./update-check.js";

const START_TIME = Date.now();
const toolMetrics = createToolMetrics();
const SPEC_REVIEW_TIME = Date.now();
const BUILD_VERSION = readPackageVersion();

function readPackageVersion(): string {
  try {
    const pkgPath = join(fileURLToPath(import.meta.url), "..", "..", "package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    return pkg.version ?? "unknown";
  } catch {
    return "unknown";
  }
}
const latency = createLatencyTracker(() => getConfig().output.latency_window_size);
const providerLastSuccess: Record<string, number> = {};
const providerLastError: Record<string, { message: string; timestamp: number }> = {};
const responseBytes: number[] = [];
const RESPONSE_WINDOW = 100;

loadConfig();
configureAllProviders(getConfig());
loadQuotaState();

// REQ-113/REQ-105: record a degraded start or an automatic user-config
// migration before serving requests.
const startupIssue = getStartupConfigIssue();
if (startupIssue) audit("config_invalid_startup", startupIssue.code);
const startupMigration = getStartupMigration();
if (startupMigration) {
  audit("config_auto_migrate", `${startupMigration.changes.length} change(s); backup: ${startupMigration.backup ?? "none"}`);
}

// REQ-112: the check is opt-in and never blocks startup.
configureUpdateCheck(getConfig().state?.update_check === true, BUILD_VERSION);

startupHealthCheck();

function ok(provider: string, results: SearchResult[], meta: Record<string, unknown> = {}): ToolOkResponse {
  const compact = compactMode(getConfig());
  const base: ToolOkResponse = {
    status: "ok",
    provider,
    results: compact ? compactResults(results) : results,
  };
  if (!compact) {
    base.meta = {
      query_time_ms: 0,
      fallback_used: false,
      quota_remaining: undefined,
      ...meta,
    };
  }
  return base;
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
    if (keyEnv && !process.env[keyEnv] && provider.tier === "keyed_http" && !provider.auth_optional) {
      console.error(`[infobroker] ${slug}: inactive (no_api_key)`);
      continue;
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
  language?: string,
  expand = false,
  deep = false,
  research = false,
  fresh: boolean | "blend" = false,
  analyze = false,
  deepBudget?: { remaining: number },
  taskTypeOverride?: string,
  collection?: string
): Promise<string> {
  // REQ-020: a union-typed input can arrive as a JSON-encoded array string.
  // Coerce before dispatch so a stringified batch is searched as a batch
  // rather than as one literal query.
  const coercedQuery = coerceStringArray(query);
  if (coercedQuery.error) {
    return `[ERROR] ${json(err("system", "invalid_input", coercedQuery.error.message, coercedQuery.error.remediation))}`;
  }
  if (coercedQuery.values!.length > 1) {
    query = coercedQuery.values!;
  } else {
    query = coercedQuery.values![0];
  }
  if (Array.isArray(query)) {
    const queries = capInputs([...new Set(query)]);
    // A shared fetch budget bounds total page reads across the whole batch
    // (REQ-028): a 5-query deep search must not multiply the page budget.
    const deepBudget = deep ? { remaining: getConfig().deep?.max_total_pages ?? 8 } : undefined;
    // REQ-020i: a failed or thrown element is reported per query; it never
    // fails the batch when another element succeeded.
    const envelopes = await settleBatch(
      queries,
      (q) =>
        doWebSearch(q, preferredProvider, maxResults, safeSearch, timeRange, page, priority, suggest, contentType, region, language, expand, deep, research, fresh, analyze, deepBudget, taskTypeOverride, collection),
      (_q, e) =>
        `[ERROR] ${json(err("none", "internal_error", sanitizeErrorMessage(e instanceof Error ? e.message : String(e)), providerRemediation("Retry the query individually to isolate the failure")))}`,
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
        // REQ-020b: order suggestions by semantic relatedness to the query;
        // preserve provider order when no embedding capability is available.
        const ranked = suggestions.length > 1 ? rankDocs(query, suggestions) : [];
        const rankedIndexes = new Set(ranked.map((r) => r.index));
        const ordered = ranked.length > 0
          ? [...ranked.map((r) => suggestions[r.index]), ...suggestions.filter((_, i) => !rankedIndexes.has(i))]
          : suggestions;
        return `[OK] ${json({
          status: "ok",
          provider: slug,
          results: ordered.map((s) => ({ title: s, url: "", snippet: s })),
          meta: { query_time_ms: 0, fallback_used: false },
        })}`;
      } catch (e) {
        lastErr = e instanceof Error ? e.message : String(e);
      }
    }
    return `[ERROR] ${json(err("duckduckgo", "provider_unavailable", lastErr ?? "No suggestion-capable provider available", providerRemediation("Retry later")))}`;
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

  // REQ-020f: research compile — one call fans out to N derived variants,
  // deep-reads each variant's top pages (bounded per variant), and returns
  // the ranked passages grouped by variant with provenance. Opt-in and
  // token-bounded; report synthesis stays in the client skills.
  if (research) {
    const maxVariants = config.research?.max_variants ?? 3;
    const perVariantPages = config.research?.max_pages_per_variant ?? 2;
    const variants = deriveResearchVariants(query, maxVariants);
    const groups = await compileResearchGroups(variants, (variant) => {
      const budget = { remaining: perVariantPages };
      return doWebSearch(
        variant, preferredProvider, maxResults, safeSearch, timeRange, page,
        priority, false, contentType, region, language, false, true, false, false, false, budget,
        taskTypeOverride, collection
      );
    });
    return `[OK] ${json({
      status: "ok",
      provider: "research",
      query,
      groups,
      meta: {
        query_time_ms: 0,
        fallback_used: false,
        research: true,
        variants: groups.length,
        ...(analyze ? { analysis: analyzeResults(groups.flatMap((g) => g.results), config.analysis) } : {}),
      },
    })}`;
  }

  // REQ-076a: blend keeps the KB rows as a seed for the external response
  // instead of replacing it. `kbRecall` reports which path the request took.
  let kbCached: SearchResult[] = [];
  let kbRecall: KbRecallState = "unavailable";
  if (isKbConfigured()) {
    if (fresh === true) {
      kbRecall = "skipped";
    } else if (deep || research) {
      kbRecall = "not_applicable";
    } else {
      try {
        const kbResults = kbSearch(query, maxResults, collection);
        // REQ-076a: a blend reports "blended" even when the cache contributed no
        // row; the count is reported as zero rather than omitted.
        kbRecall = fresh === "blend" ? "blended" : "miss";
        if (kbResults.length > 0) {
          const relevanceThreshold = config.kb!.kb_first_relevance_threshold;
          const confidenceThreshold = config.kb!.kb_first_confidence_threshold;
          const sufficientResults = kbResults.filter(
            (r) => r.freshness_score >= confidenceThreshold && (r.score ?? 0) >= relevanceThreshold
          );
          // REQ-028: a deep or research request must still read pages. The KB
          // shortcut returns stored snippets and would otherwise silently skip
          // enrichment, so it applies only to plain searches.
          const kbMapped = sufficientResults.map((r) => ({
            title: r.title,
            url: r.source_url,
            snippet: r.snippet,
            source_type: r.source_type,
            provider: "knowledge_base",
          }));
          // REQ-020h: the blocklist applies to stored results too, so a cached
          // page from an excluded domain cannot bypass the policy.
          const kbKept = kbMapped.filter((r) => !isBlocked(r.url, config.source_quality));
          const kbBlocked = kbMapped.length - kbKept.length;
          if (kbKept.length > 0) {
            kbRecall = fresh === "blend" ? "blended" : "hit";
            if (fresh === false) {
              const kbProvider = "knowledge_base";
              return `[OK] ${json(ok(kbProvider, kbKept, {
                query_time_ms: 0,
                fallback_used: false,
                quota_remaining: undefined,
                kb_recall: kbRecall,
                kb_results: kbKept.length,
                ...(config.source_quality?.enabled !== false ? { blocked_count: kbBlocked } : {}),
                ...(analyze ? { analysis: analyzeResults(kbKept, config.analysis) } : {}),
              }))}`;
            }
            kbCached = kbKept;
          }
        }
      } catch {
        // KB search failed — proceed to external providers
        kbRecall = "unavailable";
      }
    }
  }

  const resolvedTaskType = resolveTaskType(query, taskTypeOverride);
  if (resolvedTaskType.error) {
    return `[ERROR] ${json(err("none", "invalid_input", resolvedTaskType.error.message, resolvedTaskType.error.remediation))}`;
  }
  const taskType = resolvedTaskType.taskType;
  let chain: string[];

  if (preferredProvider && config.providers[preferredProvider]?.enabled) {
    chain = [preferredProvider, ...getDispatchChain(taskType).filter((p) => p !== preferredProvider)];
  } else if (preferredProvider) {
    // REQ-015: a disabled or undeclared provider is removed from dispatch and
    // SHALL be skipped by all provider-selection logic, even when explicitly
    // requested — never call it.
    return `[ERROR] ${json(err(preferredProvider, "invalid_input", `Provider "${preferredProvider}" is disabled or not configured`, "Choose an enabled provider or omit the provider parameter"))}`;
  } else {
    chain = getDispatchChain(taskType);
  }
  if (chain.length === 0) {
    chain = getDispatchChain("general_web");
  }

  chain = selectChain(chain, priority, latency.avg);
  // REQ-128: prefer providers that honor a caller-supplied language.
  chain = preferLanguageCapable(chain, language);

  // REQ-020a: demote providers at quota warning below non-warning providers.
  chain = demoteQuotaWarnings(chain, (slug) =>
    checkQuota(slug, config.providers[slug]?.rate_limit).warning
  );

  if (chain.length === 0) {
    return `[ERROR] ${json(err("none", "config_error", "No active search providers configured", "Check config.json"))}`;
  }

  const opts: SearchOptions = { max_results: maxResults, safe_search: safeSearch, time_range: timeRange as SearchOptions["time_range"], page, region, content_type: contentType, language };
  const parsedQuery = parseQuery(Array.isArray(query) ? query[0] ?? "" : String(query));
  let lastError: ToolErrorResponse | null = null;
  // REQ-002: any rate-limit-attributable failure in the chain makes the final
  // error `rate_limited` in preference to a generic provider-unavailable code.
  let rateLimited = false;
  const quotaExhausted: Record<string, number> = {};
  // Audit quota exhaustion once per provider per session, not on every attempt.
  const quotaAudited = new Set<string>();

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
    // REQ-038: a provider in cooldown is skipped without a new outbound call,
    // even when it is the chain primary. The skip is recorded as a rate-limit
    // failure so a fully-cooled chain reports exhaustion rather than empty.
    if (inCooldown(slug)) {
      rateLimited = true;
      lastError = err(slug, "rate_limited", "Provider is cooling down", providerRemediation("Retry after the cooldown window"));
      sessionStats.recordAttempt(slug, "cooldown");
      recordAttempt(slug, "cooldown");
      return null;
    }
    let start = 0;
    try {
      const quota = checkQuota(slug, config.providers[slug]?.rate_limit);
      if (quota.exhausted) {
        quotaExhausted[slug] = quota.daily.remaining;
        sessionStats.recordAttempt(slug, "quota");
        recordAttempt(slug, "quota");
        // REQ-098: quota exhaustion is a security-relevant event for the audit
        // trail, recorded once per provider per session.
        if (!quotaAudited.has(slug)) {
          quotaAudited.add(slug);
          audit("quota_exhausted", slug);
        }
        return null;
      }

      await throttle(slug);
      start = Date.now();

      const provider = resolveProvider(slug);
      if (!provider?.search) {
        throw new Error(`Provider ${slug} has no search function`);
      }

      const doCall = async (): Promise<SearchResult[]> => provider.search(query, opts);

      const timeoutMs = config.providers[slug]?.timeout;
      const timedCall = async (): Promise<SearchResult[]> =>
        withTimeout(doCall(), timeoutMs, () => `Provider ${slug} timed out after ${timeoutMs}ms`);
      // REQ-032: retry backoff and count are configurable per provider.
      const results = (await retryWithBackoff(timedCall, config.providers[slug])).slice(0, maxResults);

      const elapsed = Date.now() - start;
      increment(slug, config.providers[slug]?.rate_limit);
      latency.track(slug, elapsed);
      providerLastSuccess[slug] = Date.now();
      sessionStats.recordAttempt(slug, "ok");
      recordAttempt(slug, "ok", elapsed);

      // REQ-031: an empty result set is a failure for chain advancement, not a
      // successful answer. Fall through to the next provider — but keep a
      // provider's empty as distinct from a total failure so the final
      // all-empty case is reported as a legitimate zero-result answer.
      if (results.length === 0) {
        providerLastError[slug] = { message: "empty result set", timestamp: Date.now() };
        sessionStats.recordAttempt(slug, "empty");
        recordAttempt(slug, "empty", elapsed);
        return null;
      }

      const filtered = contentType ? filterByContentType(results, contentType) : results;
      if (filtered.length === 0) {
        providerLastError[slug] = { message: "content_type filter removed all results", timestamp: Date.now() };
        sessionStats.recordAttempt(slug, "empty");
        recordAttempt(slug, "empty", elapsed);
        return null;
      }

      return { slug, filtered, elapsed };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      providerLastError[slug] = { message: msg, timestamp: Date.now() };
      // REQ-038: a rate-limit or bot-challenge failure puts the provider in
      // cooldown so a burst of requests stops re-hammering it.
      if (shouldCooldown(e)) {
        markCooldown(slug, cooldownDurationMs(config.output.rate_limit_cooldown_ms));
      }
      if (e instanceof RetryableError && e.status === 429) {
        rateLimited = true;
        lastError = err(slug, "rate_limited", msg, providerRemediation("Retry after the cooldown window"));
      } else if (e instanceof ParseError) {
        lastError = err(slug, "parse_error", msg, providerRemediation("Trying next provider in fallback chain"));
      } else {
        lastError = err(slug, "provider_unavailable", msg, providerRemediation("Trying next provider in fallback chain"));
      }
      const code =
        e instanceof RetryableError && e.status === 429
          ? "rate_limited"
          : e instanceof ParseError
            ? "parse_error"
            : "provider_unavailable";
      sessionStats.recordAttempt(slug, "error", code);
      recordAttempt(slug, "error", start > 0 ? Date.now() - start : 0, code);
      return null;
    }
  };

  // Shape the winner's results into the response. `fallback_used` now means
  // "the serving provider was not the chain's first-choice provider" (the
  // hedge raced ahead of the primary), not merely "a provider errored".
  const buildSuccess = async (slug: string, filtered: SearchResult[], elapsed: number): Promise<string> => {
    for (const result of filtered) {
      result.provider = result.provider ?? slug;
    }
    // REQ-097: search results are assessed before storage; in the strictest
    // mode flagged results are also withheld from the response.
    let policyFlags = 0;
    if (policyMode() !== "off") {
      const partitioned = await Promise.all(
        filtered.map(async (r) => ({ r, policy: await checkContent(`${r.title}\n${r.snippet}`, r.url) }))
      );
      policyFlags = partitioned.filter((p) => p.policy.flagged).length;
      const storable = partitioned.filter((p) => disposition(p.policy.flagged) !== "refuse");
      const blocked = partitioned.filter((p) => disposition(p.policy.flagged) === "refuse").map((p) => p.r);
      if (blocked.length > 0) {
        filtered = filtered.filter((r) => !blocked.includes(r));
      }
      autoIndex(storable.map((p) => p.r), slug, undefined, undefined, query, timeRange);
    } else {
      autoIndex(filtered, slug, undefined, undefined, query, timeRange);
    }
    const policyNote = policyMeta(policyFlags, policyMode());

    // REQ-020h: remove blocklisted hosts before ordering, and report the count.
    const sourceQuality = config.source_quality;
    const blocked = filterBlocked(filtered, sourceQuality);
    filtered = blocked.kept;
    const blockedCount = blocked.blocked;

    // REQ-020g/REQ-020h: collapse results expressing the same content across
    // providers and order survivors by semantic relevance adjusted by source
    // quality. With no quality configuration this is the previous behavior.
    filtered = reconcileResults(filtered, query, undefined, {
      qualityWeight: sourceQuality?.enabled === false ? 0 : (sourceQuality?.weight ?? 0.15),
      qualityScore: (result) => qualityScore(result.url, sourceQuality),
    });

    // REQ-076a: blend appends the cached KB rows the external tier did not
    // return. An external row wins a URL duplicate because it is fresher; the
    // displaced KB rows are counted, not silently dropped.
    const blended = mergeKnowledgeBaseResults(filtered, kbCached);
    const finalResults = blended.results;
    const kbMeta = blendResponseMeta({
      kbRecall,
      externalCount: filtered.length,
      finalCount: finalResults.length,
      duplicates: blended.duplicates,
    });

    if (deep && !compactMode(config)) {
      const deepConf = config.deep ?? { max_pages: 3, max_total_pages: 8, concurrency: 4, early_exit_score: 0.3, max_ms: 8000, detect_date: false };
      const maxPages = Math.min(deepConf.max_pages ?? 3, deepBudget ? deepBudget.remaining : (deepConf.max_pages ?? 3));
      const allowPrivateDeep = config.fetch?.allow_private_urls === true;
      const renderers = getDispatchChain("content_fetch");
      const deepMeta = await deepRead(
        query,
        filtered,
        deepConf,
        config.fetch?.passage_size ?? 250,
        config.fetch?.max_passages ?? 6,
        maxPages,
        async (url) => {
          let fetched;
          try {
            fetched = await fetchPageContent(url, renderersForUrl(url, renderers), config.output.max_chars, allowPrivateDeep, true);
          } catch (e) {
            // REQ-021a: a refused page falls back to its snippet (REQ-028);
            // REQ-098: the refusal is recorded in the audit trail.
            if (e instanceof SsrRefusalError) {
              audit("network_target_refused", url);
              return null;
            }
            throw e;
          }
          if (!fetched) return null;
          // REQ-097: the strictest mode refuses flagged pages to the caller.
          const policy = await checkContent(fetched.content, url);
          if (disposition(policy.flagged) === "refuse") return null;
          if (config.preservation?.enabled !== false) {
            snapshotSource({
              url,
              title: url,
              text: fetched.content,
              provider: fetched.slug,
              maxBytes: config.preservation?.max_bytes,
            });
          }
          return { content: fetched.content, slug: fetched.slug };
        },
        {
          detectDate: deepConf.detect_date ? (u: string) => detectPageDate(u, allowPrivateDeep) : undefined,
          rank: rankPassages,
          autoIndex: (r, content, provider) =>
            autoIndex([{ title: r.title, url: r.url, snippet: content, ...(r.last_updated ? { source_updated_at: r.last_updated } : {}) }], provider, undefined, "deep"),
        }
      );
      if (deepBudget) deepBudget.remaining -= deepMeta.pages_read;
      return `[OK] ${json(ok(slug, deepMeta.results, {
        query_time_ms: elapsed,
        fallback_used: slug !== primarySlug,
        task_type: taskType,
        quota_remaining: checkQuota(slug, config.providers[slug]?.rate_limit).daily.remaining,
        ignored_params: [
          ...ignoredParams(slug, { safe_search: safeSearch, time_range: timeRange, page, content_type: contentType, region, language }),
          ...(fresh === true && collection ? ["collection"] : []),
        ],
        ignored_operators: ignoredOperators(slug, parsedQuery),
        deep: true,
        pages_read: deepMeta.pages_read,
        ...kbMeta,
        ...(config.source_quality?.enabled !== false ? { blocked_count: blockedCount } : {}),
        ...(analyze ? { analysis: analyzeResults(deepMeta.results, config.analysis) } : {}),
        ...(policyNote ?? {}),
      }))}`;
    }

    return `[OK] ${json(ok(slug, finalResults, {
      query_time_ms: elapsed,
      fallback_used: slug !== primarySlug,
      task_type: taskType,
      quota_remaining: checkQuota(slug, config.providers[slug]?.rate_limit).daily.remaining,
      ignored_params: [
        ...ignoredParams(slug, { safe_search: safeSearch, time_range: timeRange, page, content_type: contentType, region, language }),
        ...(fresh === true && collection ? ["collection"] : []),
      ],
      ignored_operators: ignoredOperators(slug, parsedQuery),
      ...kbMeta,
      ...(config.source_quality?.enabled !== false ? { blocked_count: blockedCount } : {}),
      ...(analyze ? { analysis: analyzeResults(finalResults, config.analysis) } : {}),
      ...(policyNote ?? {}),
    }))}`;
  };

  if (hedgeEnabled && chain.length > 1) {
    // REQ-031 (hedged dispatch): run the primary alone for its hedge window;
    // if it has not answered by then (or fails), race the remaining providers
    // and take the first non-empty success, bounding worst-case latency.
    const hedgeDelay = computeHedgeDelay(latency.avg(primarySlug), { minMs: hedgeMinMs, maxMs: hedgeMaxMs });
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
    // REQ-031a: before failing a non-general_web task, retry the general_web
    // chain (minus providers already attempted) so a narrow specialized chain
    // does not fail while a broader web chain could still answer.
    const crossTaskChain = crossTaskFallbackChain(taskType, chain, selectChain(getDispatchChain("general_web"), undefined, latency.avg));
    let crossTaskAttempted: string[] = [];
    for (const slug of crossTaskChain) {
      crossTaskAttempted.push(slug);
      const result = await attempt(slug);
      if (result !== null) {
        return buildSuccess(result.slug, result.filtered, result.elapsed);
      }
    }

    // REQ-076a: a blend whose external tier failed still returns the cached
    // work instead of degrading a useful answer into an error.
    if (kbCached.length > 0) {
      return `[OK] ${json(ok("knowledge_base", kbCached, {
        query_time_ms: 0,
        fallback_used: true,
        task_type: taskType,
        kb_recall: "blended",
        kb_results: kbCached.length,
        kb_duplicates: 0,
      }))}`;
    }

    // REQ-031 / REQ-038: report the attempted chain, each quota-exhausted
    // provider's remaining daily quota, and the real cooldown-derived
    // retry_after_ms (also when the cooldown came from a bot challenge).
    return `[ERROR] ${json(
      chainExhaustion(chain, {
        rateLimited,
        quotaExhausted,
        attempted: [...chain, ...crossTaskAttempted],
      })
    )}`;
  }
  return `[OK] ${json(ok("none", [], { query_time_ms: 0, fallback_used: true, task_type: taskType, ignored_params: [], no_results: true }))}`;
}

// REQ-021c: best-effort last-updated detection. Reads the last-modified header
// via a manual-redirect HEAD, then falls back to parsing HTML metadata via a
// manual-redirect GET. Manual redirects avoid following a hop to a new host,
// so the SSRF guard (already asserted for the requested URL) is not bypassed.
async function detectPageDate(url: string, allowPrivate: boolean): Promise<{ date: string; source: string; confidence: string } | undefined> {
  try {
    // REQ-021a: the date-detection requests also resolve the target so a
    // rebinding hostname cannot reach a private address via this path.
    await assertPublicUrlResolved(url, allowPrivate);
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

// Shared fetch path for fetch_page and search_web deep reading. Walks the
// content_fetch renderer chain, applying throttle, timeout, retry, and
// truncation, and returns the first successful render. Returns null when every
// renderer is exhausted. Date detection, auto-indexing, and response shaping
// remain the caller's responsibility.
async function fetchPageContent(
  url: string,
  renderers: string[],
  maxChars: number,
  allowPrivate: boolean,
  cleanHtml = false,
  onFailure?: (failure: FetchFailure) => void,
): Promise<{ slug: string; content: string; truncated: ReturnType<typeof maybeTruncate>; elapsed: number } | null> {
  const config = getConfig();
  const attempt = async (slug: string) => {
    // REQ-038: a throttled renderer in cooldown is skipped without a new call.
    if (inCooldown(slug)) {
      sessionStats.recordAttempt(slug, "cooldown");
      recordAttempt(slug, "cooldown");
      return null;
    }
    let start = 0;
    try {
      await throttle(slug);
      start = Date.now();

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
        withTimeout(doCall(), timeoutMs, () => `Provider ${slug} timed out after ${timeoutMs}ms`);
      // REQ-032: retry backoff and count are configurable per provider.
      const raw = await retryWithBackoff(timedCall, config.providers[slug]);

      // REQ-021f: a renderer that returns an anti-bot challenge rather than the
      // target page is treated as failed, so the chain falls through to the
      // next renderer instead of serving the verification page as content.
      if (isBotChallenge(raw)) {
        // REQ-021h: keep the challenge distinct from a provider failure so the
        // caller can report access_blocked with cause anti_bot.
        onFailure?.({ renderer: slug, kind: "anti_bot", message: "anti-bot challenge" });
        sessionStats.recordAttempt(slug, "error", "anti_bot");
        recordAttempt(slug, "error", Date.now() - start, "anti_bot");
        return null;
      }

      // native_fetch returns the raw body. Convert HTML to text before it
      // reaches the caller, the passage ranker, or the truncation file.
      const content = cleanHtml && slug === "native_fetch" ? htmlToText(raw) : raw;

      const elapsed = Date.now() - start;
      increment(slug, config.providers[slug]?.rate_limit);
      latency.track(slug, elapsed);
      providerLastSuccess[slug] = Date.now();
      sessionStats.recordAttempt(slug, "ok");
      recordAttempt(slug, "ok", elapsed);
      return { slug, content, truncated: maybeTruncate(content, maxChars), elapsed };
    } catch (e) {
      // REQ-021a: a safety refusal must surface with its distinct code, not
      // as a generic provider failure.
      if (e instanceof SsrRefusalError) throw e;
      // REQ-021h: keep each renderer's failure reason so the caller can
      // distinguish a paywall from an anti-bot gate from a network failure.
      const failure = classifyFailure(e, slug);
      onFailure?.(failure);
      providerLastError[slug] = { message: e instanceof Error ? e.message : String(e), timestamp: Date.now() };
      if (shouldCooldown(e)) {
        markCooldown(slug, cooldownDurationMs(config.output.rate_limit_cooldown_ms));
      }
      sessionStats.recordAttempt(slug, "error", failure.kind);
      recordAttempt(slug, "error", start > 0 ? Date.now() - start : 0, failure.kind);
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
    const hedgeDelay = computeHedgeDelay(latency.avg(primarySlug), { minMs: hedgeMinMs, maxMs: hedgeMaxMs });

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

// REQ-021: route well-known hosts to their structured renderer before the
// generic Jina/native chain, so Wikipedia/arXiv/Archive/Stack Exchange pages
// do not depend on scraping the rendered HTML.
export function renderersForUrl(url: string, fallback: string[]): string[] {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return fallback;
  }
  const special =
    host === "wikipedia.org" || host.endsWith(".wikipedia.org")
      ? "wikipedia"
      : host === "arxiv.org" || host.endsWith(".arxiv.org")
        ? "arxiv"
        : host === "archive.org" || host.endsWith(".archive.org")
          ? "internet_archive"
          : host.endsWith("stackexchange.com") || host.endsWith("stackoverflow.com")
            ? "stack_exchange"
            : undefined;
  if (!special) return fallback;
  return [special, ...fallback.filter((r) => r !== special)];
}

async function doFetchPage(
  url: string | string[],
  renderer?: string,
  maxLength?: number,
  question?: string,
  passageSize?: number,
  maxPassages?: number,
  detectDate?: boolean,
  crawl = false,
  extract = false
): Promise<string> {
  // REQ-021: accept a JSON-encoded array string as well as a real array. A
  // malformed URL batch is an input error, not a network-target refusal.
  const coercedUrl = coerceStringArray(url, { strictArraySyntax: true });
  if (coercedUrl.error) {
    return `[ERROR] ${json(err("system", "invalid_input", coercedUrl.error.message, coercedUrl.error.remediation))}`;
  }
  if (coercedUrl.values!.length > 1) {
    url = coercedUrl.values!;
  } else {
    url = coercedUrl.values![0];
  }
  if (Array.isArray(url)) {
    const urls = capInputs(url);
    // REQ-021: one failed or thrown URL is reported per input; it never
    // discards the sibling results.
    const envelopes = await settleBatch(
      urls,
      (u) => doFetchPage(u, renderer, maxLength, question, passageSize, maxPassages, detectDate, crawl, extract),
      (_u, e) =>
        `[ERROR] ${json(err("none", "internal_error", sanitizeErrorMessage(e instanceof Error ? e.message : String(e)), providerRemediation("Retry the URL individually to isolate the failure")))}`,
    );
    const merged = mergeItems(urls.map((u, i) => ({ query: u, envelope: envelopes[i] })));
    return merged.status === "ok" ? `[OK] ${json(merged)}` : `[ERROR] ${json(merged)}`;
  }

  // REQ-021h: a non-http(s) scheme is caller input, not a network-target
  // refusal. Name the local-read alternative instead of suggesting that the
  // caller relax the private-network guard.
  try {
    assertHttpUrlProtocol(url);
  } catch (e) {
    if (e instanceof UnsupportedProtocolError) {
      return `[ERROR] ${json(err("none", "invalid_input", `fetch_page only fetches http(s) URLs (received "${e.protocol}")`, "For a local file, use the read tool; fetch_page is for web pages only."))}`;
    }
    throw e;
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
    // REQ-098: refused network targets are recorded in the audit trail.
    audit("network_target_refused", Array.isArray(url) ? url.join(", ") : url);
    // REQ-021a: a distinct code distinguishes the safety refusal from a
    // malformed-URL or general fetch failure.
    return `[ERROR] ${json(err("none", "network_target_refused", sanitizeErrorMessage(e instanceof Error ? e.message : String(e)), `Set fetch.allow_private_urls=true to permit private targets`))}`;
  }

  // REQ-021: read a fresh knowledge-base copy before making an outbound call.
  // This cuts duplicate fetches across a session; stale entries fall through.
  if (!crawl && !extract && !question && config.fetch?.cache?.kb_read !== false && isKbConfigured()) {
    const cached = kbGet(url);
    const maxAgeMs = (config.fetch?.cache?.kb_max_age_hours ?? 24) * 3_600_000;
    if (cached && shouldUseKbCache(cached, maxAgeMs)) {
      const text = cached.text.slice(0, effectiveMax);
      const dateMeta = cached.source_updated_at
        ? { last_updated: cached.source_updated_at, date_source: "knowledge_base", date_confidence: "medium" }
        : {};
      return `[OK] ${json({
        status: "ok",
        provider: "knowledge_base",
        results: [{ title: new URL(url).hostname, url, snippet: text, ...dateMeta }],
        ...dateMeta,
        meta: {
          query_time_ms: 0,
          fallback_used: false,
          cache: "hit",
          cache_age_ms: Date.now() - cached.ingested_at,
        },
        ...(cached.text.length > effectiveMax ? { truncated: true } : {}),
      })}`;
    }
  }

  // REQ-021d: bounded same-origin crawl. Fetches the start page raw, discovers
  // same-origin links, and recurses within page-count and depth caps, applying
  // the SSRF guard (REQ-021a) on every hop via the native_fetch path.
  if (crawl) {
    const maxPages = config.fetch?.crawl_max_pages ?? 10;
    const maxDepth = config.fetch?.crawl_max_depth ?? 2;
    const pages: Array<{ url: string; depth: number; title: string; snippet: string }> = [];
    const visited = new Set<string>();
    const queue: Array<{ url: string; depth: number }> = [{ url, depth: 0 }];
    let policyFlags = 0;
    while (queue.length > 0 && pages.length < maxPages) {
      const cur = queue.shift()!;
      if (visited.has(cur.url) || cur.depth > maxDepth) continue;
      visited.add(cur.url);
      let fetched;
      try {
        fetched = await fetchPageContent(cur.url, ["native_fetch"], effectiveMax, allowPrivate, true);
      } catch (e) {
        // REQ-021a/021d: a refused crawl hop is skipped, not listed;
        // REQ-098: the refusal is recorded in the audit trail.
        if (e instanceof SsrRefusalError) {
          audit("network_target_refused", cur.url);
          continue;
        }
        throw e;
      }
      if (fetched === null) continue;
      const text = stripHtml(fetched.content);
      // REQ-097: crawled pages pass the content policy per hop.
      const policy = await checkContent(text, cur.url);
      const disp = disposition(policy.flagged);
      if (disp === "refuse") continue;
      if (policy.flagged) policyFlags++;
      pages.push({
        url: cur.url,
        depth: cur.depth,
        title: new URL(cur.url).hostname,
        snippet: text.slice(0, effectiveMax),
      });
      if (disp === "store") {
        autoIndex([{ title: new URL(cur.url).hostname, url: cur.url, snippet: text.slice(0, 4000) }], "native_fetch", undefined, "crawl");
      }
      if (cur.depth < maxDepth) {
        for (const link of extractLinks(fetched.content, cur.url)) {
          if (!visited.has(link) && isSameOrigin(link, url)) {
            queue.push({ url: link, depth: cur.depth + 1 });
          }
        }
      }
    }
    return `[OK] ${json({
      status: "ok",
      provider: "native_fetch",
      results: pages,
      meta: {
        query_time_ms: 0,
        fallback_used: false,
        pages: pages.length,
        max_pages: maxPages,
        max_depth: maxDepth,
        ...(policyMeta(policyFlags, policyMode()) ?? {}),
      },
    })}`;
  }

  // REQ-021e: structured-metadata extraction — returns JSON-LD, OpenGraph, and
  // microdata alongside the page content. Uses the raw native_fetch render so
  // the embedded metadata is still present.
  if (extract) {
    let fetched;
    const extractFailures: FetchFailure[] = [];
    try {
      fetched = await fetchPageContent(url, ["native_fetch"], effectiveMax, allowPrivate, false, (f) =>
        extractFailures.push(f)
      );
    } catch (e) {
      if (e instanceof SsrRefusalError) {
        audit("network_target_refused", url);
        return `[ERROR] ${json(err("none", "network_target_refused", sanitizeErrorMessage(e.message), `Set fetch.allow_private_urls=true to permit private targets`))}`;
      }
      throw e;
    }
    if (fetched === null) {
      // REQ-002 / REQ-021h: distinguish a paywall/anti-bot block from a
      // connectivity failure instead of always blaming the network.
      const taxonomy = failureTaxonomy(extractFailures);
      return `[ERROR] ${json(
        err("none", taxonomy.code, `${taxonomy.message}: ${url}`, providerRemediation(taxonomy.remediation), {
          failures: extractFailures,
          ...(taxonomy.cause ? { cause: taxonomy.cause } : {}),
        })
      )}`;
    }
    // REQ-097: the strictest mode refuses flagged content to the caller.
    const policy = await checkContent(fetched.content, url);
    if (disposition(policy.flagged) === "refuse") {
      return `[ERROR] ${json(err("none", "content_policy_flagged", `Content at ${url} was refused by the content policy (${policy.reason})`, "Configure the content policy or retry with a different source"))}`;
    }
    const structured = extractStructured(fetched.content);
    const hasData = structured.jsonld.length > 0 || structured.microdata.length > 0 || Object.keys(structured.open_graph).length > 0;
    return `[OK] ${json({
      status: "ok",
      provider: fetched.slug,
      url,
      extraction_mode: "structured",
      results: [{
        title: new URL(url).hostname,
        url,
        snippet: stripHtml(fetched.content).slice(0, effectiveMax),
      }],
      extracted: structured,
      ...(hasData ? {} : { note: "No structured metadata found on this page." }),
      meta: {
        query_time_ms: fetched.elapsed,
        fallback_used: false,
        ...(policyMeta(policy.flagged ? 1 : 0, policyMode()) ?? {}),
      },
    })}`;
  }

  let fetched;
  const failures: FetchFailure[] = [];
  try {
    fetched = await fetchPageContent(url, renderersForUrl(url, renderers), effectiveMax, allowPrivate, true, (failure) =>
      failures.push(failure)
    );
  } catch (e) {
    if (e instanceof SsrRefusalError) {
      audit("network_target_refused", url);
      return `[ERROR] ${json(err("none", "network_target_refused", sanitizeErrorMessage(e.message), `Set fetch.allow_private_urls=true to permit private targets`))}`;
    }
    throw e;
  }
  if (fetched === null) {
    // REQ-021h: a DOI/snapshot fallback is only meaningful for the ordinary
    // page/question path; crawl and structured-extraction keep their contract.
    const fallback =
      crawl || extract
        ? null
        : await resolveFetchFallback(url, (target, targetRenderers) =>
            fetchPageContent(target, targetRenderers, effectiveMax, allowPrivate, true, (failure) =>
              failures.push(failure)
            )
          );

    if (fallback?.kind === "metadata") {
      const record = fallback.record;
      return `[OK] ${json({
        status: "ok",
        provider: "crossref",
        url,
        extraction_mode: "metadata",
        results: [
          {
            title: record.title,
            url,
            snippet:
              record.abstract ||
              [record.venue, record.year].filter(Boolean).join(" · ") ||
              record.doi,
            ...(record.authors ? { authors: record.authors } : {}),
            ...(record.venue ? { venue: record.venue } : {}),
            ...(record.year ? { published_date: record.year } : {}),
            doi: record.doi,
            ...(record.abstract ? { abstract: record.abstract } : {}),
          },
        ],
        note: "Full text unavailable (paywalled or access-restricted); returning bibliographic metadata.",
        meta: {
          fallback_used: true,
          fallback_kind: "metadata",
          doi: record.doi,
          ...(record.oa_url ? { oa_url: record.oa_url } : {}),
          ...(record.oa_status ? { oa_status: record.oa_status } : {}),
        },
      })}`;
    }

    if (fallback?.kind === "content") {
      const fallbackContent = fallback.fetched.content;
      // REQ-097: fallback content still passes the content policy.
      const fallbackPolicy = await checkContent(fallbackContent, url);
      const fallbackDisp = disposition(fallbackPolicy.flagged);
      if (fallbackDisp === "refuse") {
        return `[ERROR] ${json(err("none", "content_policy_flagged", `Content at ${url} was refused by the content policy (${fallbackPolicy.reason})`, "Configure the content policy or retry with a different source"))}`;
      }
      if (fallbackDisp === "store") {
        autoIndex(
          [{ title: new URL(url).hostname, url, snippet: fallbackContent }],
          fallback.fetched.slug,
          undefined,
          "fetch_page"
        );
      }
      if (question) {
        const passages = rankPassages(
          fallbackContent,
          question,
          effectivePassageSize ?? 250,
          effectiveMaxPassages ?? 6
        );
        if (passages.length > 0) {
          return `[OK] ${json({
            status: "ok",
            provider: fallback.fetched.slug,
            url,
            question,
            extraction_mode: "content",
            results: [
              {
                title: new URL(url).hostname,
                url,
                snippet: passages[0].text,
              },
            ],
            snippets: passages.map((p) => ({ text: p.text, score: p.score, index: p.index })),
            top_score: passages[0].score,
            meta: {
              query_time_ms: fallback.fetched.elapsed,
              fallback_used: true,
              fallback_kind: fallback.fallback_kind,
              fallback_url: fallback.fetched_url,
              passages_returned: passages.length,
              match_quality: matchQuality(passages[0].score, passages.length),
              ...(policyMeta(fallbackPolicy.flagged ? 1 : 0, policyMode()) ?? {}),
            },
          })}`;
        }
      }
      const truncatedFallback = maybeTruncate(fallbackContent, effectiveMax);
      return `[OK] ${json({
        status: "ok",
        provider: fallback.fetched.slug,
        url,
        results: [{ title: new URL(url).hostname, url, snippet: truncatedFallback.text }],
        meta: {
          query_time_ms: fallback.fetched.elapsed,
          fallback_used: true,
          fallback_kind: fallback.fallback_kind,
          fallback_url: fallback.fetched_url,
          ...(policyMeta(fallbackPolicy.flagged ? 1 : 0, policyMode()) ?? {}),
        },
        ...(truncatedFallback.truncated
          ? {
              truncated: true,
              output_path: truncatedFallback.outputPath,
              truncation_hint:
                "Call fetch_page again with `question` to get the relevant passages instead of reading output_path.",
            }
          : {}),
      })}`;
    }

    const taxonomy = failureTaxonomy(failures);
    return `[ERROR] ${json(
      err("none", taxonomy.code, `${taxonomy.message}: ${url}`, taxonomy.remediation, {
        failures,
        ...(taxonomy.cause ? { cause: taxonomy.cause } : {}),
      })
    )}`;
  }
  const { slug, content, truncated, elapsed } = fetched;

  // REQ-097: assess before storing; block mode refuses the caller, flag mode
  // returns the content but never stores it.
  const policy = await checkContent(content, url);
  const disp = disposition(policy.flagged);
  if (disp === "refuse") {
    return `[ERROR] ${json(err("none", "content_policy_flagged", `Content at ${url} was refused by the content policy (${policy.reason})`, "Configure the content policy or retry with a different source"))}`;
  }
  const policyNote = policyMeta(policy.flagged ? 1 : 0, policyMode());

  const pageDate = effectiveDetectDate ? await detectPageDate(url, allowPrivate) : undefined;
  const dateMeta = pageDate
    ? { last_updated: pageDate.date, date_source: pageDate.source, date_confidence: pageDate.confidence }
    : {};

  if (disp === "store") {
    autoIndex([{ title: new URL(url).hostname, url, snippet: content, ...(pageDate ? { source_updated_at: pageDate.date } : {}) }], slug, undefined, "fetch_page");
  }

  if (question) {
    const passages = rankPassages(content, question, effectivePassageSize ?? 250, effectiveMaxPassages ?? 6);
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
          passages_returned: passages.length,
          match_quality: matchQuality(passages[0].score, passages.length),
          ...(policyNote ?? {}),
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
        ...(policyNote ?? {}),
      },
      ...(truncated.truncated ? { truncated: true, output_path: truncated.outputPath, truncation_hint: "Call fetch_page again with `question` to get the relevant passages instead of reading output_path." } : {}),
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
      ...(policyNote ?? {}),
    },
    ...(truncated.truncated ? { truncated: true, output_path: truncated.outputPath, truncation_hint: "Call fetch_page again with `question` to get the relevant passages instead of reading output_path." } : {}),
  })}`;
}

function authPresent(authEnv?: string): boolean {
  if (!authEnv) return true;
  if (process.env[authEnv]) return true;
  const many = authEnv.replace(/_API_KEY$/, "_API_KEYS");
  return !!process.env[many];
}

function providerOperational(p: ProviderConfig): boolean {
  if (!p.enabled) return false;
  if (!p.auth_optional && !authPresent(p.auth_env)) return false;
  if (p.url_env && !process.env[p.url_env]) return false;
  return true;
}

function providerInactiveReason(p: ProviderConfig): "disabled" | "no_api_key" | "no_url" | null {
  if (!p.enabled) return "disabled";
  if (!p.auth_optional && !authPresent(p.auth_env)) return "no_api_key";
  if (p.url_env && !process.env[p.url_env]) return "no_url";
  return null;
}

// REQ-013/REQ-024a: one assessment shared by the list and spec actions, so a
// quota-warning or over-threshold-latency provider is reported degraded and
// "active" means the same thing everywhere.
function assessProviderStatus(slug: string, p: ProviderConfig): HealthStatus {
  const config = getConfig();
  const quota = checkQuota(slug, p.rate_limit);
  return resolveHealthStatus({
    baseStatus: providerOperational(p) ? "active" : "inactive",
    quotaExhausted: quota.exhausted,
    quotaWarning: quota.warning,
    avgLatencyMs: latency.avg(slug) || undefined,
    degradedLatencyMs: p.degraded_latency_ms ?? config.output.degraded_latency_ms,
  });
}

/** Non-secret host of a generic provider's endpoint, for diagnostics only. */
function endpointHost(endpoint?: string): string | undefined {
  if (!endpoint) return undefined;
  try {
    return new URL(endpoint).hostname;
  } catch {
    return undefined;
  }
}

function doListProviders(filter?: string): string {  const config = getConfig();
  const entries = Object.entries(config.providers);

  // REQ-024a: supported task types per provider, derived from the dispatch table.
  const taskTypesBySlug: Record<string, string[]> = {};
  for (const [taskType, chain] of Object.entries(config.dispatch)) {
    for (const slug of chain) (taskTypesBySlug[slug] ??= []).push(taskType);
  }

  const filtered = filter === "active"
    ? entries.filter(([slug, p]) => providerOperational(p) && !checkQuota(slug, p.rate_limit).exhausted)
    : entries;

  const list = filtered.map(([slug, p]) => {
    const quota = checkQuota(slug, p.rate_limit);
    const operational = providerOperational(p);
    const reason = quota.exhausted ? "exhausted" : (operational ? null : providerInactiveReason(p));
    const cooldownRemaining = inCooldown(slug) ? cooldownRemainingMs(slug) : undefined;
    // REQ-104: report pool health (index + availability), never key material.
    const pool = keyPoolStatus(slug);
    // REQ-013/REQ-024a: the list status uses the same assessment as health, so
    // a quota-warning or over-threshold-latency provider is reported degraded.
    const status = assessProviderStatus(slug, p);
    // REQ-024a: native_fetch is an inline tool-handler fallback, not a
    // standalone provider module — marked so it is excluded from provider counts.
    const inlineFallback = slug === "native_fetch";
    return {
      slug,
      tier: p.tier,
      capabilities: p.capabilities,
      task_types: taskTypesBySlug[slug] ?? [],
      ...(p.tier === "generic_http"
        ? {
            endpoint_host: endpointHost(p.endpoint),
            results_path: p.results_path ?? null,
          }
        : {}),
      rate_limit: p.rate_limit,
      enabled: p.enabled,
      status,
      ...(inlineFallback ? { inline_fallback: true } : {}),
      ...(reason ? { inactive_reason: reason } : {}),
      ...(cooldownRemaining !== undefined ? { cooldown_remaining_ms: cooldownRemaining } : {}),
      ...(pool.length > 1 ? { key_pool: pool } : {}),
      quota_used: quota.daily.used,
      quota_remaining: quota.daily.remaining,
      quota_warning: quota.warning,
      quota_exhausted: quota.exhausted,
      priority: p.priority,
      // REQ-129: report the derived privacy posture for every listed provider.
      privacy: derivePrivacy(p),
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
  // REQ-104/REQ-024b: auth presence is pool-aware (single key or key pool).
  const authOk = p.auth_optional ? true : authPresent(keyEnv);
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
      avgLatencyMs = latency.avg(providerSlug) || h.avgLatencyMs;
      // REQ-024b: the live probe must not overwrite the recorded last-success
      // timestamp — last_success reflects operational history, not this probe.
    } catch (e) {
      providerLastError[providerSlug] = { message: e instanceof Error ? e.message : String(e), timestamp: Date.now() };
      if (status === "active") {
        status = "degraded";
      }
    }
  } else {
    avgLatencyMs = latency.avg(providerSlug) || 0;
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
  if (inCooldown(providerSlug)) {
    report.cooldown_remaining_ms = cooldownRemainingMs(providerSlug);
  }

  return `[OK] ${json({
    status: "ok",
    provider: providerSlug,
    results: [report],
  })}`;
}

function doSpecHealth(): string {
  const config = getConfig();
  // REQ-024c: provider counts exclude inline renderer fallbacks (REQ-024a), and
  // distinguish enabled providers from those whose assessed status is active.
  const providers = Object.entries(config.providers).filter(([slug]) => slug !== "native_fetch");
  const enabledCount = providers.filter(([, p]) => p.enabled).length;
  const activeCount = providers.filter(([slug, p]) => assessProviderStatus(slug, p) === "active").length;
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
      provider_count: providers.length,
      enabled_provider_count: enabledCount,
      active_provider_count: activeCount,
      tool_count: toolCount,
      token_footprint: {
        tool_schema_bytes: toolSchemaBytes,
        tool_schema_tokens: Math.ceil(toolSchemaBytes / 4),
        median_response_bytes: medianResponseBytes(),
        median_response_tokens: Math.ceil(medianResponseBytes() / 4),
      },
      kb: kbStatsData ? {
        chunk_count: kbStatsData.chunk_count,
        collections: kbStatsData.collections,
        freshness_tiers: kbStatsData.freshness_tiers,
        last_ingestion: kbStatsData.last_ingestion,
      } : undefined,
      uptime_seconds: Math.floor((Date.now() - START_TIME) / 1000),
      total_requests_served: latency.total(),
      tool_metrics: toolMetrics.snapshot(),
      session: {
        ...sessionStats.snapshot(),
        cooldowns_active: activeCooldowns(),
        call_log: callLogTarget(),
      },
      last_spec_review: new Date(SPEC_REVIEW_TIME).toISOString(),
      quota_state_path: getQuotaStatePath(),
      config_path: process.env["INFOBROKER_CONFIG"] || "./config.json",
      kb_storage_path: config.kb
        ? (config.kb.storage_path.startsWith("~/")
            ? join(homedir(), config.kb.storage_path.slice(2))
            : config.kb.storage_path)
        : undefined,
      truncation_dir: join(tmpdir(), "infobroker"),
      state_health: computeStateHealth(),
    }],
  })}`;
}

const startupNoticeList = collectNotices();
if (startupNoticeList.length > 0) {
  console.error(`[infobroker] state notice: ${startupNoticeList.map((notice) => notice.message).join(" ")}`);
}
const server = new McpServer({
  name: "infobroker",
  version: "2026.11.07",
  ...(startupNoticeList.length > 0
    ? { instructions: `Infobroker state needs attention: ${startupNoticeList.map((notice) => notice.message).join(" ")}` }
    : {}),
});

// REQ-021i: enrich a structured-fact search response with a sourced fact.
// Only a single-query, successful, structured_fact envelope is eligible; a
// batch keeps its per-query shape, and any lookup failure degrades to prose
// with fact_status rather than failing the search.
async function withStructuredFacts(content: string, query: string | string[]): Promise<string> {
  if (Array.isArray(query)) return content;
  let payload: Record<string, unknown>;
  try {
    const envelope = parseEnvelope(content);
    if (envelope.status !== "ok") return content;
    payload = envelope as unknown as Record<string, unknown>;
  } catch {
    return content;
  }
  const meta = (payload.meta ?? {}) as Record<string, unknown>;
  if (meta.task_type !== "structured_fact") return content;

  const enrichment = await enrichStructuredFacts(query, {
    results: Array.isArray(payload.results) ? (payload.results as SearchResult[]) : [],
  });
  if (!enrichment) return content;

  return `[OK] ${json(applyFactsToEnvelope(payload, enrichment))}`;
}

// --- search_web ---
const instrumentTool = (name: string, config: any, handler: any) =>
  server.registerTool(name, config, async (...args: any[]) => {
    const start = Date.now();
    try {
      const result = await handler(...args);
      const elapsed = Date.now() - start;
      toolMetrics.record(name, elapsed, true);
      recordTool(name, true, elapsed);
      const notices = collectNotices();
      return finalizeToolResult(injectNotices(result, notices), notices);
    } catch (error) {
      const elapsed = Date.now() - start;
      toolMetrics.record(name, elapsed, false);
      recordTool(name, false, elapsed);
      throw error;
    }
  });

instrumentTool(
  "infobroker_search_web",
  {
    title: "Web Search",
    description: "Search the web, encyclopedia, academic, and code sources through one interface with automatic provider selection and a fallback chain. Use when you need broad or batched search, query autocomplete (suggest), query expansion (expand), ranked passages from the top pages (deep), or a multi-variant research compile that deep-reads each variant (research), and optional in-process analysis of the returned results (analyze: topics, entities, clusters, timeline). Do NOT use for a URL you already have (use infobroker_fetch_page), for high-stakes claim verification (use infobroker_verify_claims), for stored-report recall (use infobroker_manage_kb search), or for academic citations (use infobroker_get_citations). Caches results in the local knowledge base, enforces per-provider rate limits, and needs no API key for the free providers. `task_type` forces a dispatch chain (for example academic) when the automatic classification picks the wrong one. `fresh: false` keeps KB-first sufficiency, `fresh: true` skips KB recall and searches external providers, and `fresh: 'blend'` keeps cached KB results alongside fresh external results. `collection` scopes KB recall to a named collection. An array `query` is searched in parallel and merged, and a failed element is reported in `meta.per_query` without failing the batch. A measurable attribute (attendance, population, percentage, date) returns a sourced `facts` entry before prose, with `meta.fact_status`. Returns a JSON envelope prefixed `[OK]` or `[ERROR]` with status, provider, results, and meta.",
    inputSchema: {
      query: z.union([z.string().describe("Search query"), z.array(z.string()).max(5).describe("Multiple queries to search in parallel (max 5); a failed element is reported per input without failing the batch")]).describe("Search query: a single string, or up to five strings searched in parallel"),
      provider: z.string().optional().describe("Provider slug (auto-select if omitted)"),
      task_type: z.enum(SEARCHABLE_TASK_TYPES).optional().describe("Force a dispatch chain by task type (auto-classified when omitted)"),
      max_results: z.number().min(1).max(30).optional().default(8).describe("Number of results to return (1-30, default 8)"),
      safe_search: z.enum(["on", "off", "strict"]).optional().default("on").describe("Safe-search filtering: on, off, or strict (default on)"),
      time_range: z.enum(["day", "week", "month", "year"]).optional().describe("Restrict results to day, week, month, or year"),
      page: z.number().min(1).optional().default(1).describe("Results page number (default 1)"),
      priority: z.enum(["speed", "quality", "privacy", "free_only"]).optional().describe("Route by intent: speed, quality, privacy, or free_only"),
      suggest: z.boolean().optional().default(false).describe("Return query-autocomplete strings instead of results (default false)"),
      expand: z.boolean().optional().default(false).describe("Return query-expansion strings instead of search results"),
      deep: z.boolean().optional().default(false).describe("Read the top results and return each page's ranked passages against the query"),
      research: z.boolean().optional().default(false).describe("Research compile: fan out to derived query variants and deep-read each, returning passages grouped by variant (default off)"),
      analyze: z.boolean().optional().default(false).describe("Attach in-process analysis to the response: topic terms, entity mentions, semantic result clusters, and a dated timeline. Derived from the returned results only; adds no outbound request (default false)"),
      fresh: z.union([z.boolean(), z.literal("blend")]).optional().default(false).describe("Knowledge-base recall mode: false keeps KB-first sufficiency, true skips recall and searches external providers, blend keeps KB results alongside fresh external results (default false)"),
      collection: z.string().optional().describe("Knowledge-base collection to recall from (scopes KB recall only; ignored when fresh is true)"),
      content_type: z.enum(["docs", "issue", "changelog", "blog", "spec", "all"]).optional().default("all").describe("Source kind to search: docs, issue, changelog, blog, spec, or all (default all)"),
      region: z.string().optional().describe("ISO region/country code (e.g. 'us-en', 'DE')"),
      language: z.string().optional().describe("Preferred result language (ISO 639-1, e.g. 'de'). Providers that cannot honor it report it in meta.ignored_params"),
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
    outputSchema: envelopeOutputSchema,
  },
  async (params: any) => {
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
      params.language as string | undefined,
      Boolean(params.expand),
      Boolean(params.deep),
      Boolean(params.research),
      (params.fresh as boolean | "blend" | undefined) ?? false,
      Boolean(params.analyze),
      undefined,
      params.task_type as string | undefined,
      params.collection as string | undefined
    );
    // REQ-021i: a structured-fact query gets a sourced fact before prose.
    const text = await withStructuredFacts(content, params.query);
    return { content: [{ type: "text" as const, text }] };
  }
);

// --- fetch_page ---
instrumentTool(
  "infobroker_fetch_page",
  {
    title: "Fetch Page Content",
    description: "Fetch a URL and extract clean content via a renderer (Jina Reader by default; native-HTTP, Wikipedia, Internet Archive, arXiv, and Stack Exchange alternatives). Use when you have a URL and need readable text, passages ranked against a question, or the page's last-updated date. Do NOT use for topic search (use infobroker_search_web) or cross-source claim verification (use infobroker_verify_claims). `question` returns passages ranked against it, sized by `passage_size` and capped by `max_passages`; `crawl` bounds the same-origin crawl to config caps; `extract` adds JSON-LD, OpenGraph, and microdata; `renderer` selects the backend, and native_fetch is the keyless fallback when Jina is throttled or anti-bot challenged. `max_length` truncates the returned text only; a truncated page is written in full to a temp file. Makes external HTTP calls and needs no API key. A fresh knowledge-base copy is returned before an outbound fetch when available. Fetched pages auto-index into the knowledge base unless the content policy flags them (see infobroker_manage_kb): flag mode returns without storage, block mode refuses. Unreachable URLs return an [ERROR] envelope with remediation; when a DOI resolves, a blocked page falls back to Crossref metadata or an open-access copy, then to an Internet Archive snapshot, and reports `meta.fallback_kind`. Paywalls, access restrictions, and anti-bot blocks return `access_blocked`; connectivity failures return `network_error`; a non-http(s) URL returns `invalid_input` naming the read tool. Success returns an [OK] envelope with status, provider, results, and meta.",
    inputSchema: {
      url: z.union([z.string().describe("URL to fetch"), z.array(z.string()).max(5).describe("Multiple URLs to fetch in parallel (max 5)")]).describe("URL to fetch: a single URL, or up to five URLs fetched in parallel"),
      renderer: z.enum(["jina", "native_fetch", "wikipedia", "internet_archive", "arxiv", "stack_exchange"]).optional().describe("Renderer: jina (default), native_fetch, wikipedia, internet_archive, arxiv, or stack_exchange"),
      max_length: z.number().optional().default(50000).describe("Maximum characters to return (default 50000)"),
      question: z.string().optional().describe("Question to extract ranked passages for, instead of returning the whole page"),
      passage_size: z.number().optional().describe("Target words per passage (default from config)"),
      max_passages: z.number().optional().describe("Number of passages to return (default from config)"),
      detect_date: z.boolean().optional().describe("Detect and report the page's last-updated date (default from config)"),
      crawl: z.boolean().optional().default(false).describe("Bounded same-origin crawl: recursively fetch same-origin pages up to config caps (default off)"),
      extract: z.boolean().optional().default(false).describe("Return structured metadata (JSON-LD, OpenGraph, microdata) alongside the content (default off)"),
      raw: z.boolean().optional().default(false).describe("Return the extracted page text directly instead of a JSON envelope (single URL; not with crawl or extract)"),
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
    outputSchema: envelopeOutputSchema,
  },
  async (params: any) => {
    const raw = Boolean(params.raw);
    const rawError = raw ? rawRequestError(params.url, params.crawl, params.extract) : undefined;
    if (rawError) {
      const text = `[ERROR] ${json(err("system", "invalid_input", rawError, "Call fetch_page with one URL and raw true, or omit raw for the standard envelope"))}`;
      return { content: [{ type: "text" as const, text }] };
    }
    const content = await doFetchPage(
      params.url,
      params.renderer as string | undefined,
      params.max_length !== undefined ? Number(params.max_length) : undefined,
      params.question as string | undefined,
      params.passage_size !== undefined ? Number(params.passage_size) : undefined,
      params.max_passages !== undefined ? Number(params.max_passages) : undefined,
      params.detect_date as boolean | undefined,
      Boolean(params.crawl),
      Boolean(params.extract)
    );
    if (!raw) return { content: [{ type: "text" as const, text: content }] };
    const envelope = parseEnvelopeObject(content);
    if (!envelope) return { content: [{ type: "text" as const, text: content }] };
    // REQ-021j: raw text plus the envelope as structured metadata.
    return {
      content: [{ type: "text" as const, text: rawTextFromEnvelope(envelope) }],
      structuredContent: { ...envelope, raw: true },
    };
  }
);

// --- providers ---
instrumentTool(
  "infobroker_inspect_providers",
  {
    title: "Inspect Providers",
    description: "Inspect configured search providers: list their state, run a live health check, or report build and spec identity. Use when searches return empty or slow results and you want provider status, quota, or latency, or when choosing which backend to trust. Do NOT use to search (use infobroker_search_web) or to read a page (use infobroker_fetch_page). Read-only: it never modifies configuration, providers, or stored data. `list` snapshots provider state (including each provider's derived privacy posture) and `status` filters it; `health` runs a live outbound probe against `provider` (required for the `health` action; subject to that provider's rate limits, so it can be slow; for a `generic_http` provider with no `health_endpoint` the probe is a real search query and may consume provider quota or credits); `spec` reports build and spec identity plus local state health (config drift, backend capabilities, update status) and session counters. Returns an [OK] or [ERROR] JSON envelope with status, provider, and results.",
    inputSchema: {
      action: z.enum(["list", "health", "spec"]).describe("Operation to perform"),
      provider: z.string().optional().describe("Provider slug (required for health)"),
      status: z.enum(["active", "all"]).optional().describe("Filter for list action"),
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
    outputSchema: envelopeOutputSchema,
  },
  async (params: any) => {
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
instrumentTool(
  "infobroker_verify_claims",
  {
    title: "Verify Claims",
    description: "Verify one or more contested claims against independent sources and return confidence-scored findings. Use when a claim is high-stakes or contested and you need agreement, contradiction, and gaps surfaced with confidence scores, or when a finished draft needs a claim-by-claim fact-check in one call. Do NOT use for simple lookups or broad search (use infobroker_search_web) or citation formatting (use infobroker_get_citations). The loop recalls prior findings from the knowledge base, then searches providers and writes findings back; `max_iterations` bounds the refinement passes and per-provider rate limits apply, with one HTTP-call budget shared across a batch. Supply exactly one of `query` (one claim, or a string the server splits into up to five) or `claims` (a list of independent claims seeded verbatim); a batch returns one finding per distinct claim in caller order, identical claims are collapsed and report every input index they cover, and a claim with no attributed source is reported unverified rather than dropped. `priority` routes the pool by intent (speed, quality, privacy, free_only); `providers` restricts the pool and omitting it uses the full dispatch chain; `confidence_threshold` sets the bar for confirmation, and findings below it are reported unverified. Each source carries a `span` locating its supporting sentence and an advisory `modality` (asserted, reported, speculative) that never changes confidence. Returns an [OK] or [ERROR] envelope listing confirmed, contested, and unverified findings with per-source claims, spans, and confidence scores.",
    inputSchema: {
      query: z.string().optional().describe("One claim to verify; the server splits it into up to five sub-claims. Supply either query or claims, not both"),
      claims: z.array(z.string()).optional().describe("Independent claims to verify as a batch (bounded by corroboration.max_batch_claims, default 10); seeded verbatim and returned one finding per distinct claim in this order, with identical claims collapsed and every input index reported. Supply either query or claims, not both"),
      max_iterations: z.number().min(1).max(10).optional().default(5).describe("Maximum search-refinement passes (1-10, default 5)"),
      confidence_threshold: z.number().min(0).max(1).optional().default(0.8).describe("Minimum confidence to report a finding as confirmed (0-1, default 0.8)"),
      providers: z.array(z.string()).optional().describe("Optional array of provider slugs to limit the search to"),
      priority: z.enum(["speed", "quality", "privacy", "free_only"]).optional().describe("Route the corroboration pool by intent"),
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
    outputSchema: envelopeOutputSchema,
  },
  async (params: any) => {
    try {
      // REQ-026g: exactly one of `query` or `claims` is accepted. The batch
      // cap is configuration, and the tool rejects (not clamps) an over-cap
      // request so a truncated batch can never look complete.
      const queryText =
        typeof params.query === "string" && params.query.trim().length > 0 ? params.query : undefined;
      const claimList = Array.isArray(params.claims)
        ? (params.claims as unknown[]).map((claim) => String(claim).trim())
        : undefined;
      const rawMaxBatch = Number(getConfig().corroboration.max_batch_claims ?? 10);
      const maxBatch = Number.isFinite(rawMaxBatch)
        ? Math.min(25, Math.max(1, Math.trunc(rawMaxBatch)))
        : 10;
      const invalidInput = (message: string) => ({
        content: [
          {
            type: "text" as const,
            text: `[ERROR] ${json(err("none", "invalid_input", message, `Pass exactly one of query (string) or claims (array of up to ${maxBatch} strings) and retry`))}`,
          },
        ],
      });
      if (queryText !== undefined && claimList !== undefined) {
        return invalidInput("Provide either query or claims, not both");
      }
      if (queryText === undefined && claimList === undefined) {
        return invalidInput("Provide a query or a claims list");
      }
      if (claimList !== undefined) {
        if (claimList.length === 0) return invalidInput("claims must contain at least one claim");
        if (claimList.some((claim) => claim.length === 0)) {
          return invalidInput("claims must not contain empty entries");
        }
        if (claimList.length > maxBatch) {
          return invalidInput(`claims accepts at most ${maxBatch} entries`);
        }
      }
      const input = claimList ?? queryText!;
      const result = await corroborate(input, {
        max_iterations: Number(params.max_iterations),
        confidence_threshold: Number(params.confidence_threshold),
        providers: params.providers as string[] | undefined,
        priority: params.priority as "speed" | "quality" | "privacy" | "free_only" | undefined,
        latency: latency.avg,
      });
      const indexable = result.findings
        .filter((f) => Boolean(f.sources[0]?.url))
        .map((f) => ({ title: f.topic, url: f.sources[0]!.url, snippet: f.claim }));
      autoIndex(indexable, "corroborate", undefined, "corroborate");
      // REQ-109: persist the ledger best-effort. kbRecordClaims swallows every
      // error, so a ledger failure cannot fail or alter this response. An
      // unsourced batch claim has no source to link and is not persisted.
      kbRecordClaims(
        result.findings
          .filter((f) => f.sources.some((s) => Boolean(s.url)))
          .map((f) => ({
            claim: f.claim || f.topic,
            verdict: f.verdict,
            confidence: f.confidence,
            sources: f.sources
              .filter((s) => Boolean(s.url))
              .map((s) => ({
                url: s.url,
                title: s.title,
                retrieved_at: s.retrieved_at ?? new Date().toISOString(),
              })),
          }))
      );
      if (compactMode(getConfig())) {
        delete result.provenance;
      }
      // REQ-001: every tool body carries status/provider/results. The
      // corroboration fields (findings, agreement_map, synthesis, ...) are
      // preserved alongside the envelope for back-compatibility.
      return {
        content: [
          {
            type: "text" as const,
            text: `[OK] ${json({ status: "ok", provider: "corroborate", results: result.findings, ...result })}`,
          },
        ],
      };
    } catch (e) {
      return {
        content: [
          {
            type: "text" as const,
            text: `[ERROR] ${json(err("none", "corroboration_error", e instanceof Error ? e.message : String(e), providerRemediation("Retry with a different query")))}`,
          },
        ],
      };
    }
  }
);

// --- kb ---
instrumentTool(
  "infobroker_manage_kb",
  {
    title: "Knowledge Base",
    description: "Manage the local knowledge base: search cached content, ingest text or URLs, list/get/delete entries, view stats, read persisted claim records, and manage at-rest encryption. Use when you need to archive a generated report (ingest with source_type 'report' and save_to 'kb'), revisit stored content, or manage encryption keys. Do NOT use for fresh external search (use infobroker_search_web) or to fetch a new page (use infobroker_fetch_page). The delete action is destructive and cannot be undone; a lost encryption key makes the store unrecoverable by design. Parameter semantics: `action` selects the operation; `query` for search, `text`/`url` plus `title` and `collection` for ingest, `source_url` for get/delete, and `operation` with `key_file` for the encryption sub-actions; `source_type` and `freshness_tier` tag an ingest and filter search/list; `save_to` defaults to 'kb', `format` to 'markdown', `max_results` to 8; `last_updated` is auto-detected from fetched URLs when omitted; `receipt` attaches a claim-to-source manifest to a report ingest and `verify_report` rechecks it offline. Responses carry an [OK] or [ERROR] envelope: search/list/get return entries, stats returns counts, delete reports the chunks removed.",
    inputSchema: {
      action: z.enum(["search", "ingest", "list", "get", "stats", "delete", "encryption", "claims", "verify_report"]).describe("Operation to perform"),
      operation: z.enum(["status", "generate_key", "verify", "backup", "rekey"]).optional().describe("Sub-operation for the 'encryption' action"),
      key_file: z.string().optional().describe("Path to a key file (generate_key writes here and refuses an existing path; rekey reads the target key from here). Never pass the secret itself — only a file path."),
      query: z.string().optional().describe("Search query (search action) or claim-text filter (claims action)"),
      text: z.string().optional().describe("Raw text to index (for ingest action)"),
      url: z.string().optional().describe("URL to fetch and index (for ingest action)"),
      title: z.string().optional().describe("Document/report title"),
      collection: z.string().optional().describe("Collection name"),
      source_type: z.string().optional().describe("Source type (tag on ingest; filter on search/list)"),
      freshness_tier: z.string().optional().describe("Freshness tier tag on ingest (e.g. 'report', 'evergreen')"),
      last_updated: z.string().optional().describe("Source last-updated date to store (e.g. '2026-08-24'); auto-detected from fetched URLs when omitted"),
      save_to: z.enum(["kb", "disk", "both"]).optional().describe("Where to save (ingest action): kb, disk, or both. Default kb"),
      format: z.enum(["markdown", "text", "json"]).optional().default("markdown").describe("File format for disk save"),
      source_url: z.string().optional().describe("Source URL filter (get/delete/claims action), the report identity for verify_report, or identity for ingest"),
      max_results: z.number().min(1).max(50).optional().default(8).describe("Maximum results to return (search/claims action; 1-50, default 8)"),
      receipt: z
        .object({
          claims: z
            .array(
              z.object({
                claim: z.string(),
                grade: z.string().optional(),
                verdict: z.string().optional().describe("Fact-check verdict for this claim (for example True, Mostly True, Half True, Mostly False, False, Misleading, Unverifiable)"),
                confidence: z.enum(["High", "Medium", "Low"]).optional().describe("Report-level confidence for this claim"),
                likelihood: z.string().optional().describe("Calibrated likelihood term (for example almost certain, likely, even chance, unlikely)"),
                sources: z
                  .array(
                    z.object({
                      url: z.string(),
                      title: z.string().optional(),
                      retrieved_at: z.string().optional(),
                      snippet: z.string().max(RECEIPT_LIMITS.snippetChars).optional(),
                    })
                  )
                  .optional(),
              })
            )
            .optional(),
          sources: z
            .array(
              z.object({
                url: z.string(),
                title: z.string().optional(),
                retrieved_at: z.string().optional(),
                snippet: z.string().max(RECEIPT_LIMITS.snippetChars).optional(),
              })
            )
            .max(RECEIPT_LIMITS.reportSources)
            .optional()
            .describe("Report-level Source Register URLs, linked to the stored report (REQ-110)"),
          report: z
            .object({
              shape: z.string().optional().describe("Workflow shape that produced the report"),
              audience: z.string().optional().describe("Target audience profile"),
              methodology: z.string().optional().describe("Methodology and scope summary"),
              assumptions: z.array(z.string()).optional().describe("Key assumptions stated separately from evidence"),
              alternatives: z.array(z.string()).optional().describe("Alternative hypotheses or options considered"),
              gaps: z.array(z.string()).optional().describe("Questions left open"),
              supersedes: z.string().optional().describe("Report identity this revision supersedes"),
              revision: z.number().int().min(1).optional().describe("Report revision number"),
            })
            .optional()
            .describe("Optional report-level manifest metadata (REQ-114), stored with the receipt"),
        })
        .optional()
        .describe(
          "Optional verification receipt for a report ingest (REQ-110): claims with cited sources, report-level Source Register URLs, and optional report metadata (REQ-114). The server computes the report hash, per-source hashes, and the digest; any caller hashes or digest are ignored. Requires source_type 'report' and KB storage."
        ),
    },
    annotations: {
      destructiveHint: true,
      readOnlyHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
    outputSchema: envelopeOutputSchema,
  },
  async (params: any) => {
    if (!isKbConfigured()) {
      return { content: [{ type: "text" as const, text: `[ERROR] ${json(err("system", "config_error", "Knowledge base not configured", "Add a kb section to config.json"))}` }] };
    }
    const action = params.action as "search" | "ingest" | "list" | "get" | "stats" | "delete" | "encryption" | "claims" | "verify_report";
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
          let existing = false;
          try {
            existing = existsSync(resolveKeyFile(keyFile));
          } catch {
            // An out-of-directory path is reported by generateKeyFile itself.
            existing = false;
          }
          if (existing) {
            return { content: [{ type: "text" as const, text: `[ERROR] ${json(err("knowledge_base", "invalid_input", `A key file already exists at that path`, "Choose a new key path, or move the existing file after backing it up"))}` }] };
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
            // REQ-099: the rekey target key file is confined to the keys directory.
            target = { kind: "raw", dek: readKeyFile(resolveKeyFile(keyFile)) };
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
          return { content: [{ type: "text" as const, text: `[ERROR] ${json(err("knowledge_base", "internal_error", `No document with source_url "${sourceUrl}"`, "Use list action to enumerate stored documents"))}` }] };
        }
        // REQ-110: a stored report exposes its linked Source Register URLs.
        const linkedSources = doc.source_type === "report" ? kbGetReportSources(sourceUrl) : [];
        return {
          content: [{
            type: "text" as const,
            text: `[OK] ${json({
              status: "ok",
              provider: "knowledge_base",
              results: [doc],
              ...(linkedSources.length > 0 ? { sources: linkedSources } : {}),
            })}`,
          }],
        };
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
          // REQ-097: a fetched URL that the policy flagged in flag mode was
          // returned by the fetch but must not be persisted by the ingest. The
          // policy note lives under `meta.content_policy` in the fetch envelope.
          if (parsed.meta?.content_policy?.flagged) {
            return { content: [{ type: "text" as const, text: `[ERROR] ${json(err("knowledge_base", "content_policy_flagged", "Fetched content was flagged by the content policy and was not stored", "Configure the content policy or ingest different content"))}` }] };
          }
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

        // REQ-110: a receipt is report-only and needs the knowledge base. A
        // disk-only ingest cannot hold one, so it is refused before writing.
        const receipt = params.receipt;
        // Validate before the write: a rejected receipt must not leave a stored
        // report behind. The normalized value is what the store receives.
        let normalizedReceipt: Extract<ReturnType<typeof normalizeReceiptInput>, { ok: true }>["value"] | null = null;
        if (receipt !== undefined && receipt !== null) {
          if (!isReport) {
            return { content: [{ type: "text" as const, text: `[ERROR] ${json(err("knowledge_base", "invalid_input", "A verification receipt is only supported for source_type \"report\"", "Ingest the report with source_type: \"report\" or omit the receipt"))}` }] };
          }
          if (!ingestDestinations(saveTo).kb) {
            return { content: [{ type: "text" as const, text: `[ERROR] ${json(err("knowledge_base", "receipt_requires_kb", "A verification receipt requires knowledge-base storage", "Use save_to: \"kb\" (or \"both\"); a disk-only ingest has no stored report to verify"))}` }] };
          }
          const validated = normalizeReceiptInput(receipt);
          if (!validated.ok) {
            return { content: [{ type: "text" as const, text: `[ERROR] ${json(err("knowledge_base", validated.error.code, validated.error.message, `Check the receipt bounds (${RECEIPT_LIMITS.claims} claims, ${RECEIPT_LIMITS.sourcesPerClaim} sources per claim, ${RECEIPT_LIMITS.claimChars} characters per claim, ${RECEIPT_LIMITS.urlChars} per URL, ${RECEIPT_LIMITS.snippetChars} per snippet) and store with save_to: \"kb\"`))}` }] };
          }
          normalizedReceipt = validated.value;
        }

        const dest = ingestDestinations(saveTo);
        let finalUrl = resolveReportIdentity(title, url || params.source_url as string | undefined);
        let diskPath: string | undefined;
        if (dest.disk) {
          diskPath = saveReportToDisk(title, content, String(params.format || "markdown"));
          finalUrl = `file://${diskPath}`;
        } else if (!url) {
          finalUrl = isReport ? resolveReportIdentity(title, undefined) : "";
        }

        // REQ-083: a "disk" destination writes the report to a local file
        // *instead of* the knowledge base; "kb" and "both" index it.
        const existed = dest.kb && finalUrl ? kbGet(finalUrl) !== null : false;
        let count = 0;
        if (dest.kb) {
          count = kbIngest(
            content,
            title,
            finalUrl,
            "explicit",
            collection,
            sourceType,
            freshnessTier,
            sourceUpdatedAt
          );
        }
        const snippet = dest.disk && !dest.kb
          ? `saved to disk${diskPath ? `: ${diskPath}` : ""}`
          : `${count} chunks ingested`;
        // REQ-110: the receipt is stored after the content lands, so the
        // content hash covers the canonical stored document. It was validated
        // above, so this write cannot fail on receipt bounds.
        let receiptMeta: Record<string, unknown> = {};
        if (normalizedReceipt !== null) {
          const stored = kbPutReportReceipt(finalUrl, normalizedReceipt);
          if (!stored.ok) {
            return { content: [{ type: "text" as const, text: `[ERROR] ${json(err("knowledge_base", stored.error.code, stored.error.message, `Check the receipt bounds (${RECEIPT_LIMITS.claims} claims, ${RECEIPT_LIMITS.sourcesPerClaim} sources per claim, ${RECEIPT_LIMITS.claimChars} characters per claim, ${RECEIPT_LIMITS.urlChars} per URL, ${RECEIPT_LIMITS.snippetChars} per snippet) and store with save_to: \"kb\"`))}` }] };
          }
          receiptMeta = {
            receipt: {
              report_id: stored.record.report_id,
              digest_sha256: stored.record.manifest.digest_sha256,
              content_sha256: stored.record.manifest.content_sha256,
              claims: stored.record.manifest.claims.length,
            },
            // REQ-110: the linked-source count is the deduplicated union the
            // manifest stored, not the caller's raw input length.
            report_sources: stored.record.manifest.sources?.length ?? 0,
          };
        }
        const msg = json({
          status: "ok",
          provider: "knowledge_base",
          results: [{ title: dest.kb ? "ingested" : "saved", url: finalUrl, snippet }],
          meta: {
            chunks_ingested: count,
            ingest_result: existed ? "replaced" : "created",
            source_type: sourceType,
            freshness_tier: freshnessTier,
            saved_to: saveTo,
            ...(collection ? { collection } : {}),
            ...(diskPath ? { disk_path: diskPath } : {}),
            ...(isReport && dest.kb && finalUrl ? { report_id: finalUrl } : {}),
            ...receiptMeta,
          },
        });
        return { content: [{ type: "text" as const, text: `[OK] ${msg}` }] };
      }
      if (action === "claims") {
        // REQ-060h: the ledger is read-only, SQLite-only, and newest-first.
        const ledger = kbClaims({
          ...(params.query ? { query: String(params.query) } : {}),
          ...(params.source_url ? { source_url: String(params.source_url) } : {}),
          max_results: Number(params.max_results ?? 8),
        });
        if (!ledger) {
          return { content: [{ type: "text" as const, text: `[ERROR] ${json(err("knowledge_base", "config_error", "The knowledge base store is unavailable", "Check the store lock and encryption state, then reload"))}` }] };
        }
        return {
          content: [{
            type: "text" as const,
            text: `[OK] ${json({
              status: "ok",
              provider: "knowledge_base",
              results: ledger.claims,
              meta: { truncated: ledger.truncated, scanned: ledger.scanned },
            })}`,
          }],
        };
      }
      if (action === "verify_report") {
        // REQ-060i: read-only and offline. The receipt is compared against
        // the cached report and its cached sources; no provider is called.
        const sourceUrl = params.source_url as string | undefined;
        if (!sourceUrl) {
          return { content: [{ type: "text" as const, text: `[ERROR] ${json(err("knowledge_base", "invalid_input", "source_url is required for verify_report action", "Pass the stored report identity (for example report://<slug>) as source_url"))}` }] };
        }
        const verified = kbVerifyReport(sourceUrl);
        if (!verified.ok) {
          const remediation = verified.error.code === "receipt_not_found"
            ? "Ingest the report again with a receipt, or list reports to find one that carries a receipt"
            : "Report receipts require the SQLite knowledge base store";
          return { content: [{ type: "text" as const, text: `[ERROR] ${json(err("knowledge_base", verified.error.code, verified.error.message, remediation))}` }] };
        }
        return {
          content: [{
            type: "text" as const,
            text: `[OK] ${json({ status: "ok", provider: "knowledge_base", results: [verified.result], meta: { network: false } })}`,
          }],
        };
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
      return { content: [{ type: "text" as const, text: `[ERROR] ${json(err("knowledge_base", "internal_error", sanitizeErrorMessage(e instanceof Error ? e.message : String(e)), "Check knowledge base configuration"))}` }] };
    }
  }
);

// --- reload_config ---
instrumentTool(
  "infobroker_reload_config",
  {
    title: "Reload Configuration",
    description:
      "Re-read the configuration file and apply provider, rate-limit, and knowledge-base changes without restarting; active connections are preserved. Use when you have edited config.json or config.local.json, or when passing `patch` to change configuration programmatically. Do NOT use to inspect configuration or provider state (use infobroker_inspect_providers). `patch` deep-merges a partial config into the user layer (config.local.json), rejecting unknown top-level keys, backing up the previous layer, and validating the merged result before writing; `migrate` true backs up and applies registered user-layer migrations before reloading. The call re-reads the startup configuration source and reports any user-layer schema drift. If the new configuration is invalid, the previous configuration stays active and an error is returned. Returns an [OK] or [ERROR] JSON envelope.",
    inputSchema: {
      patch: z
        .record(z.string(), z.unknown())
        .optional()
        .describe("Partial configuration deep-merged into the user layer (config.local.json) before reloading; unknown top-level keys are rejected and the previous layer is backed up"),
      migrate: z
        .boolean()
        .optional()
        .default(false)
        .describe("Back up and apply registered user-configuration-layer migrations before reloading (default false)"),
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: true,
    },
    outputSchema: envelopeOutputSchema,
  },
  async (params: any) => {
    try {
      let patchResult: { path: string; backup: string | null; changed: string[] } | null = null;
      if (params.patch && Object.keys(params.patch as Record<string, unknown>).length > 0) {
        patchResult = patchUserConfigLayer(params.patch as Record<string, unknown>);
        // REQ-098: configuration writes are recorded in the audit trail.
        audit("config_patch", `success (${patchResult.changed.join(", ")})`);
      }
      let migration: { changes: string[]; backup: string | null } | null = null;
      if (params.migrate) {
        const result = migrateUserConfigLayer();
        if (result) migration = { changes: result.changes, backup: result.backup };
      }
      const newConfig = reloadConfig();
      configureAllProviders(newConfig);
      configureUpdateCheck(newConfig.state?.update_check === true, BUILD_VERSION);
      // REQ-040: rebuild generic providers so reload applies endpoint/mapping changes.
      resetGenericProviderCache();
      if (newConfig.kb) {
        flushKbWrites();
        initKb(newConfig.kb);
        console.error("[infobroker] Knowledge base re-initialized");
      }
      // REQ-098: config reloads are recorded in the audit trail.
      audit(
        "config_reload",
        migration
          ? `success with user-config migration (${migration.changes.length} change(s))`
          : `success (${Object.keys(newConfig.providers).length} providers)`
      );
      const lock = getKbLockError();
      const state = getKbEncryptionState();
      const guidance =
        state === "enabled"
          ? " Enabling encryption makes the store unrecoverable without the key — back up your key now (kb 'encryption' action, 'backup')."
          : state === "disabled"
            ? " Encryption disabled. If the store was previously encrypted it is now decrypted on disk; remove the key material only after confirming (kb 'encryption' action, 'status')."
            : "";
      const drift = getUserConfigDrift();
      const driftSummary = drift && drift.hasDrift
        ? ` User config drift: ${[
            drift.outdatedVersion ? `schema v${drift.declaredVersion} → v${drift.currentVersion}` : "",
            ...drift.renames.map((r) => `rename "${r.from}" → "${r.to}"`),
            ...drift.deprecated.map((d) => `deprecated "${d.path}"`),
            ...drift.unrecognized.map((u) => `unrecognized "${u}"`),
          ]
            .filter(Boolean)
            .join("; ")}.`
        : "";
      const migrationSummary = migration
        ? ` Migrated user config layer: ${migration.changes.join("; ")}${migration.backup ? ` (backup: ${migration.backup})` : ""}.`
        : "";
      const patchSummary = patchResult
        ? ` Patched user config layer: ${patchResult.changed.join("; ")}${patchResult.backup ? ` (backup: ${patchResult.backup})` : ""}.`
        : "";
      const message =
        `Configuration reloaded. Knowledge base encryption: ${state}.${guidance}${driftSummary}${patchSummary}${migrationSummary}` +
        (lock ? ` Knowledge base LOCKED: ${lock.message}` : "");
      return {
        content: [
          {
            type: "text" as const,
            text: `[OK] ${json({
              status: "ok",
              provider: "system",
              results: [
                {
                  message,
                  provider_count: Object.keys(newConfig.providers).length,
                  config_drift: drift && drift.hasDrift ? drift : null,
                  patch: patchResult,
                  migration,
                },
              ],
            })}`,
          },
        ],
      };
    } catch (e) {
      audit("config_reload", "failed — previous config remains active");
      return {
        content: [
          {
            type: "text" as const,
            text: `[ERROR] ${json(err("system", "config_error", sanitizeErrorMessage((e instanceof Error ? e.message : String(e)) + ". Previous config remains active."), "Fix config.json and retry"))}`,
          },
        ],
      };
    }
  }
);

// --- cite ---
instrumentTool(
  "infobroker_get_citations",
  {
    title: "Get Citations",
    description: "Return academic references for a query as BibTeX citations with title, authors, year, venue, DOI, and URL. Use when scholarly writing needs a reference list. Do NOT use for general web search (use infobroker_search_web) or contested-claim verification (use infobroker_verify_claims). `query` is a natural-language topic; `max_results` sets the reference count, and larger values take longer and span more sources. References are gathered from every enabled academic provider, deduplicated by DOI (title when absent), and each provider's status is reported in `meta.providers`; a zero-result answer names the providers tried. Needs no API key when at least one scholarly source is reachable; if every source fails it returns an [ERROR] envelope with remediation, and queries respect per-provider rate limits. Returns an [OK] or [ERROR] JSON envelope.",
    inputSchema: {
      query: z.string().describe("Search query"),
      max_results: z.number().min(1).max(30).optional().default(8).describe("Maximum references to return (1-30, default 8)"),
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
    outputSchema: envelopeOutputSchema,
  },
  async (params: any) => {
    try {
      const report = await searchCitations(String(params.query), Number(params.max_results));
      const results = report.citations.map((c) => ({
        title: c.title,
        url: c.url,
        ...(c.doi ? { doi: c.doi } : {}),
        year: c.year,
        authors: c.authors,
        venue: c.venue,
        bibtex: c.bibtex,
      }));
      // REQ-027a: an exhausted chain is an error, while providers that answered
      // empty are a legitimate zero-result answer carrying a diagnostic.
      if (report.citations.length === 0 && report.allFailed) {
        const attempted = report.providers.map((p) => p.slug);
        const summary = report.providers
          .map((p) => `${p.slug} (${p.reason ?? p.status})`)
          .join(", ");
        return {
          content: [
            {
              type: "text" as const,
              text: `[ERROR] ${json(
                err(
                  "academic",
                  "all_providers_exhausted",
                  `Citation chain exhausted: ${summary}`,
                  "Retry later or check provider configuration; inspect_providers reports per-provider state",
                  { providers: report.providers, exhausted_chain: attempted }
                )
              )}`,
            },
          ],
        };
      }
      const compact = compactMode(getConfig());
      const meta = compact
        ? undefined
        : {
            query_time_ms: report.elapsedMs,
            deduped: report.deduped,
            providers: report.providers,
            ...(report.citations.length === 0
              ? {
                  no_results: true,
                  diagnostic: `No references matched: ${report.providers
                    .map((p) => `${p.slug}=${p.status}`)
                    .join(", ")}`,
                }
              : {}),
          };
      return {
        content: [
          {
            type: "text" as const,
            text: `[OK] ${json({
              status: "ok",
              provider: "academic",
              results,
              ...(meta ? { meta } : {}),
            })}`,
          },
        ],
      };
    } catch (e) {
      return {
        content: [
          {
            type: "text" as const,
            text: `[ERROR] ${json(err("academic", "provider_unavailable", e instanceof Error ? e.message : String(e), "Retry later; inspect_providers reports per-provider state"))}`,
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
    configureUpdateCheck(newConfig.state?.update_check === true, BUILD_VERSION);
    if (newConfig.kb) {
      flushKbWrites();
      initKb(newConfig.kb);
    }
    console.error("[infobroker] Configuration reloaded via SIGHUP");
    audit("config_reload", "success via SIGHUP");
  } catch (e) {
    console.error("[infobroker] SIGHUP reload failed:", e instanceof Error ? e.message : String(e));
    audit("config_reload", "failed via SIGHUP — previous config remains active");
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
