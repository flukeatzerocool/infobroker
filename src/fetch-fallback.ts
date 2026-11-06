// @implements REQ-021h doi-metadata open-access wayback classified-failure paywall access-restricted not-found rate-limited
// Fetch fallback and failure classification. When the renderer chain cannot
// return a page, this module decides whether the failure is a payment wall, an
// access restriction, an anti-bot gate, a missing page, a rate limit, or a
// network problem, and tries the fallbacks the roadmap requires: Crossref
// metadata for a DOI, an open-access copy, then an Internet Archive snapshot.
import { HttpStatusError } from "./lib/url-guard.js";
import { BotChallengeError } from "./retry.js";
import { htmlToText } from "./lib/html.js";
import { throttle } from "./rate-limiter.js";
import { inCooldown } from "./cooldown.js";
import { providerRemediation } from "./error-envelope.js";
import { PROVIDERS } from "./providers/index.js";
import type { DoiRecord } from "./types.js";
import type { TruncatedText } from "./truncate.js";

export type FetchFailureKind =
  | "paywall"
  | "access_restricted"
  | "anti_bot"
  | "not_found"
  | "rate_limited"
  | "network"
  | "unknown";

export interface FetchFailure {
  renderer: string;
  kind: FetchFailureKind;
  status?: number;
  message?: string;
}

export interface FetchContent {
  slug: string;
  content: string;
  truncated: TruncatedText;
  elapsed: number;
}

export type FetchContentFn = (url: string, renderers: string[]) => Promise<FetchContent | null>;

export type FetchFallbackResult =
  | {
      kind: "content";
      fallback_kind: "open_access" | "wayback";
      original_url: string;
      fetched_url: string;
      fetched: FetchContent;
      doi?: string;
      record?: DoiRecord;
    }
  | {
      kind: "metadata";
      fallback_kind: "metadata";
      original_url: string;
      record: DoiRecord;
      doi: string;
    };

const NETWORK_CODES = /ENOTFOUND|ECONNREFUSED|ECONNRESET|ETIMEDOUT|EAI_AGAIN|TIMEDOUT|network|fetch failed/i;

export function classifyStatus(status: number): FetchFailureKind {
  // CR-11: 402 is the only status that means payment. 401/403/407/451 are
  // access restrictions (authentication, geographic, proxy, or legal block)
  // and must not be reported as a paywall.
  if (status === 402) return "paywall";
  if (status === 401 || status === 403 || status === 407 || status === 451) return "access_restricted";
  if (status === 404 || status === 410) return "not_found";
  if (status === 429) return "rate_limited";
  return "unknown";
}

export function classifyFailure(error: unknown, renderer: string): FetchFailure {
  if (error instanceof BotChallengeError) {
    return { renderer, kind: "anti_bot", message: error.message };
  }
  if (error instanceof HttpStatusError) {
    return { renderer, kind: classifyStatus(error.status), status: error.status, message: error.message };
  }
  // Providers such as Jina throw RetryableError with the HTTP status attached;
  // a 403 from that path is the same access-restriction signal as a native
  // fetch 403.
  if (error && typeof (error as { status?: unknown }).status === "number") {
    const status = (error as { status: number }).status;
    return { renderer, kind: classifyStatus(status), status, message: error instanceof Error ? error.message : String(error) };
  }
  if (error instanceof Error) {
    if (NETWORK_CODES.test(error.message)) {
      return { renderer, kind: "network", message: error.message };
    }
    return { renderer, kind: "unknown", message: error.message };
  }
  return { renderer, kind: "unknown", message: String(error) };
}

/**
 * Map the collected renderer failures to the REQ-002 taxonomy. The most
 * specific access blocker wins over a generic exhaustion: a payment wall
 * outranks an anti-bot challenge, which outranks a generic access restriction.
 * A rate-limited renderer yields the REQ-002 rate_limited code, a missing page
 * is reported with a not_found cause, and an all-network failure is a
 * connectivity error. REQ-038: every provider-attributable remediation names
 * the provider-status surface so the caller can diagnose without guessing.
 */
export function failureTaxonomy(failures: FetchFailure[]): {
  code: "access_blocked" | "network_error" | "rate_limited" | "all_providers_exhausted";
  cause?: "paywall" | "access_restricted" | "anti_bot" | "not_found";
  message: string;
  remediation: string;
} {
  const has = (kind: FetchFailureKind) => failures.some((f) => f.kind === kind);
  const only = (kind: FetchFailureKind) => failures.length > 0 && failures.every((f) => f.kind === kind);
  const accessRemediation = "Try an open-access copy or an Internet Archive snapshot, or use the DOI metadata returned when available; do not relax the private-network guard";

  if (has("paywall")) {
    return {
      code: "access_blocked",
      cause: "paywall",
      message: "The page requires payment to access",
      remediation: providerRemediation(accessRemediation),
    };
  }
  if (has("anti_bot")) {
    return {
      code: "access_blocked",
      cause: "anti_bot",
      message: "The page returned an anti-bot challenge instead of content",
      remediation: providerRemediation(accessRemediation),
    };
  }
  if (has("access_restricted")) {
    return {
      code: "access_blocked",
      cause: "access_restricted",
      message: "The page is access-restricted (authentication, geographic, or legal block)",
      remediation: providerRemediation(accessRemediation),
    };
  }
  if (has("rate_limited")) {
    return {
      code: "rate_limited",
      message: "The page's renderers were rate-limited",
      remediation: providerRemediation("Retry after the rate-limit window"),
    };
  }
  if (only("network")) {
    return {
      code: "network_error",
      message: "The page could not be reached over the network",
      remediation: providerRemediation("Check network connectivity and the host name, then retry"),
    };
  }
  if (only("not_found")) {
    return {
      code: "all_providers_exhausted",
      cause: "not_found",
      message: "The page was not found",
      remediation: providerRemediation("Check the URL for a typo or removed content, then retry"),
    };
  }
  return {
    code: "all_providers_exhausted",
    message: "All content renderers failed",
    remediation: providerRemediation("Retry later"),
  };
}

export function extractDoi(url: string): string | null {
  const match = /^https?:\/\/(?:dx\.)?doi\.org\/(10\.\d{4,9}\/[^\s?#]+)(?:[?#].*)?$/i.exec(url.trim());
  return match ? decodeURIComponent(match[1]) : null;
}

function renderersForOa(url: string): string[] {
  // A PDF needs the reader renderer; native_fetch would return raw bytes.
  return /\.pdf(?:$|[?#])/i.test(url) ? ["jina"] : ["jina", "native_fetch"];
}

function cleanFallbackContent(fetched: FetchContent): FetchContent {
  if (fetched.slug !== "internet_archive" && fetched.slug !== "native_fetch") return fetched;
  if (!/^\s*</.test(fetched.content)) return fetched;
  return { ...fetched, content: htmlToText(fetched.content) };
}

async function lookupCrossref(doi: string): Promise<DoiRecord | null> {
  const provider = PROVIDERS.crossref;
  if (!provider?.lookupDoi || inCooldown("crossref")) return null;
  try {
    await throttle("crossref");
    return await provider.lookupDoi(doi);
  } catch {
    // A metadata lookup is best-effort; the caller moves to the next fallback.
    return null;
  }
}

async function lookupOpenAlex(doi: string): Promise<DoiRecord | null> {
  const provider = PROVIDERS.openalex;
  if (!provider?.lookupDoi || inCooldown("openalex")) return null;
  try {
    await throttle("openalex");
    return await provider.lookupDoi(doi);
  } catch {
    // Best-effort, same as Crossref.
    return null;
  }
}

/**
 * Try the roadmap's fallbacks for a failed page fetch. `fetchContent` is the
 * caller's renderer-chain function, so every hop still passes through the
 * normal throttle, timeout, truncation, and SSRF guards.
 */
export async function resolveFetchFallback(
  url: string,
  fetchContent: FetchContentFn,
): Promise<FetchFallbackResult | null> {
  const doi = extractDoi(url);

  if (doi) {
    const record = await lookupCrossref(doi);
    if (record) {
      const oa = await lookupOpenAlex(doi);
      const oaUrl = oa?.oa_url;
      const merged: DoiRecord = {
        ...record,
        ...(oa?.oa_url ? { oa_url: oa.oa_url } : {}),
        ...(oa?.oa_status ? { oa_status: oa.oa_status } : {}),
        ...(record.abstract ? {} : oa?.abstract ? { abstract: oa.abstract } : {}),
      };
      if (oaUrl) {
        const fetched = await fetchContent(oaUrl, renderersForOa(oaUrl));
        if (fetched) {
          return {
            kind: "content",
            fallback_kind: "open_access",
            original_url: url,
            fetched_url: oaUrl,
            fetched: cleanFallbackContent(fetched),
            doi,
            record: merged,
          };
        }
      }
      return {
        kind: "metadata",
        fallback_kind: "metadata",
        original_url: url,
        record: merged,
        doi,
      };
    }
  }

  const archived = await fetchContent(url, ["internet_archive"]);
  if (archived) {
    return {
      kind: "content",
      fallback_kind: "wayback",
      original_url: url,
      fetched_url: url,
      fetched: cleanFallbackContent(archived),
    };
  }

  return null;
}
