// @implements REQ-027 REQ-027a REQ-031 REQ-033 REQ-038
// Citation aggregation: walk the configured academic dispatch chain whole —
// `output.fallback_depth` bounds sequential dispatch, not this fan-out — call
// each eligible provider's own search implementation (single HTTP/parse path
// per provider), report per-provider status, and dedupe references across DOI
// and title identity. A chain where every provider failed (or was skipped) is
// reported so the tool can answer all_providers_exhausted instead of a silent
// empty [OK].
import type { SearchResult, SearchOptions } from "./types.js";
import { getConfig, getDispatchChain } from "./config.js";
import { citationFor } from "./bibtex.js";
import { resolveProvider } from "./providers/index.js";
import { retryWithBackoff } from "./retry.js";
import { checkQuota, increment } from "./quota.js";
import { inCooldown, markCooldown, shouldCooldown, cooldownDurationMs } from "./cooldown.js";
import { throttle } from "./rate-limiter.js";
import { providerOperational } from "./corroborate.js";
import { sanitizeErrorMessage } from "./lib/sanitize-error.js";
import { withTimeout } from "./lib/timeout.js";

export interface CitationResult {
  title: string;
  url: string;
  doi?: string;
  year?: string;
  authors: string[];
  venue?: string;
  bibtex: string;
}

export type CitationProviderState = "ok" | "empty" | "error" | "skipped";

export interface CitationProviderStatus {
  slug: string;
  status: CitationProviderState;
  references: number;
  reason?: string;
}

export interface CitationReport {
  citations: CitationResult[];
  providers: CitationProviderStatus[];
  deduped: number;
  /** True when no provider returned references and none answered empty. */
  allFailed: boolean;
  elapsedMs: number;
}

export type Searcher = (query: string, options?: SearchOptions) => Promise<SearchResult[]>;

export interface CitationOptions {
  /** Injectable provider searchers (tests, and parity with corroborate). */
  searchers?: Record<string, Searcher>;
  /** Override the academic dispatch chain. */
  chain?: string[];
  /** Override eligibility: return a skip reason, or null when eligible. */
  eligibility?: (slug: string) => string | null;
}

function defaultEligibility(slug: string): string | null {
  const config = getConfig();
  const provider = config.providers[slug];
  if (!provider) return "unconfigured";
  if (!provider.enabled) return "disabled";
  // REQ-011/REQ-015: a provider whose required credential is absent is removed.
  if (!providerOperational(slug, config)) return "no_auth";
  // REQ-038: a cooling-down provider is skipped without an outbound call.
  if (inCooldown(slug)) return "cooldown";
  // REQ-034: an exhausted quota is skipped until reset.
  if (checkQuota(slug, provider.rate_limit).exhausted) return "quota_exhausted";
  return null;
}

function timedSearch(
  searcher: Searcher,
  query: string,
  options: SearchOptions,
  timeoutMs: number | undefined,
): () => Promise<SearchResult[]> {
  // REQ-032/CR-13: the shared helper clears the timer when the call wins.
  return () =>
    withTimeout(searcher(query, options), timeoutMs, () => `Provider timed out after ${timeoutMs}ms`);
}

function toYear(published?: string): string | undefined {
  if (!published) return undefined;
  const match = published.match(/\d{4}/);
  return match ? match[0] : undefined;
}

function toCitation(result: SearchResult): CitationResult {
  const year = toYear(result.published_date);
  const authors = result.authors ?? [];
  return {
    title: result.title,
    url: result.url,
    ...(result.doi ? { doi: result.doi } : {}),
    ...(year ? { year } : {}),
    authors,
    ...(result.venue ? { venue: result.venue } : {}),
    bibtex: citationFor(result.title, authors, year, result.venue, result.url),
  };
}

// DOI identity: case-insensitive, tolerant of a resolver prefix.
function doiKey(doi: string | undefined): string | undefined {
  if (!doi) return undefined;
  const normalized = doi
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//, "")
    .replace(/^doi:\s*/, "");
  return normalized || undefined;
}

// Title identity ignores the year so a DOI-bearing and a title-only reference
// for the same work can meet across namespaces; the year is compared
// separately by `yearCompatible`.
function titleSlug(citation: CitationResult): string {
  return citation.title.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

// A missing year is not evidence of a different work, so it never blocks a
// merge; two known and differing years do.
function yearCompatible(a: CitationResult, b: CitationResult): boolean {
  if (!a.year || !b.year) return true;
  return a.year === b.year;
}

// Keep the first-seen representative and adopt the richer fields from a later
// duplicate (REQ-027a).
function mergeCitation(existing: CitationResult, incoming: CitationResult): void {
  if (!existing.doi && incoming.doi) existing.doi = incoming.doi;
  if (incoming.authors.length > existing.authors.length) existing.authors = incoming.authors;
  if (!existing.venue && incoming.venue) existing.venue = incoming.venue;
  if (!existing.year && incoming.year) existing.year = incoming.year;
  if (!existing.url && incoming.url) existing.url = incoming.url;
  existing.bibtex = citationFor(existing.title, existing.authors, existing.year, existing.venue, existing.url);
}

function dedupeCitations(citations: CitationResult[]): CitationResult[] {
  const byDoi = new Map<string, CitationResult>();
  // One bucket per normalized title: distinct works can share a title, so the
  // bucket holds every representative that title has produced.
  const byTitle = new Map<string, CitationResult[]>();
  const unique: CitationResult[] = [];

  for (const citation of citations) {
    const doi = doiKey(citation.doi);
    const title = titleSlug(citation);
    const bucket = byTitle.get(title) ?? [];

    let existing = doi ? byDoi.get(doi) : undefined;
    if (!existing) {
      // Cross-namespace match. Two different DOIs are two different works, so a
      // candidate that carries its own distinct DOI is never a title twin.
      existing = bucket.find((candidate) => {
        const candidateDoi = doiKey(candidate.doi);
        if (doi && candidateDoi && candidateDoi !== doi) return false;
        return yearCompatible(candidate, citation);
      });
    }

    if (existing) {
      mergeCitation(existing, citation);
      if (doi) byDoi.set(doi, existing);
      if (!bucket.includes(existing)) bucket.push(existing);
      byTitle.set(title, bucket);
      continue;
    }

    const representative = { ...citation };
    unique.push(representative);
    if (doi) byDoi.set(doi, representative);
    bucket.push(representative);
    byTitle.set(title, bucket);
  }

  return unique;
}

export async function searchCitations(
  query: string,
  limit = 8,
  options: CitationOptions = {},
): Promise<CitationReport> {
  const started = Date.now();
  const config = getConfig();
  const chain = options.chain ?? getDispatchChain("academic");
  const isEligible = options.eligibility ?? defaultEligibility;
  const providers: CitationProviderStatus[] = [];
  const collected: CitationResult[] = [];
  let rawCount = 0;

  for (const slug of chain) {
    const skipReason = isEligible(slug);
    if (skipReason) {
      providers.push({ slug, status: "skipped", references: 0, reason: skipReason });
      continue;
    }
    const searcher = options.searchers?.[slug] ?? (resolveProvider(slug)?.search as Searcher | undefined);
    if (!searcher) {
      providers.push({ slug, status: "skipped", references: 0, reason: "no_search" });
      continue;
    }
    try {
      const providerConfig = config.providers[slug];
      // REQ-030: each attempt is throttled, retries included.
      const attemptSearch = async () => {
        await throttle(slug);
        return timedSearch(searcher, query, { max_results: limit }, providerConfig?.timeout)();
      };
      const results = await retryWithBackoff(attemptSearch, providerConfig);
      increment(slug, providerConfig?.rate_limit);
      rawCount += results.length;
      for (const result of results) collected.push(toCitation(result));
      providers.push({
        slug,
        status: results.length > 0 ? "ok" : "empty",
        references: results.length,
      });
    } catch (e) {
      if (shouldCooldown(e)) {
        markCooldown(slug, cooldownDurationMs(config.output.rate_limit_cooldown_ms));
      }
      providers.push({
        slug,
        status: "error",
        references: 0,
        reason: sanitizeErrorMessage(e instanceof Error ? e.message : String(e)),
      });
    }
  }

  const unique = dedupeCitations(collected);
  const allFailed =
    providers.length > 0 && !providers.some((p) => p.status === "ok" || p.status === "empty");

  return {
    citations: unique.slice(0, limit),
    providers,
    deduped: rawCount - unique.length,
    allFailed,
    elapsedMs: Date.now() - started,
  };
}
