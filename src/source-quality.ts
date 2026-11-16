// @implements REQ-020h
// Source-quality ordering and blocklisting. Pure functions: the caller supplies
// the configured lists, so the policy is testable without configuration or
// network access. Domain matching is case-insensitive; a plain domain matches
// itself and its subdomains, and `*.domain` matches subdomains only.
import type { Config } from "./types.js";

export type SourceQualityConfig = NonNullable<Config["source_quality"]>;

function normalizePattern(pattern: string): string {
  return pattern
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/\.$/, "");
}

/** Hostname without a leading `www.`, or null for a non-http(s)/malformed URL. */
export function hostOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

export function matchesDomain(host: string, pattern: string): boolean {
  const normalized = normalizePattern(pattern);
  if (!normalized) return false;
  if (normalized.startsWith("*.")) {
    const suffix = normalized.slice(2);
    return suffix.length > 0 && host.endsWith(`.${suffix}`);
  }
  return host === normalized || host.endsWith(`.${normalized}`);
}

export function isBlocked(url: string | undefined, config?: SourceQualityConfig): boolean {
  if (!config || config.enabled === false) return false;
  const blocklist = config.blocklist ?? [];
  if (blocklist.length === 0) return false;
  const host = hostOf(url);
  if (!host) return false;
  return blocklist.some((pattern) => matchesDomain(host, pattern));
}

/** +1 primary source, +0.6 trusted, -1 low quality, 0 otherwise. */
export function qualityScore(url: string | undefined, config?: SourceQualityConfig): number {
  if (!config || config.enabled === false) return 0;
  const host = hostOf(url);
  if (!host) return 0;
  if ((config.trusted_domains ?? []).some((pattern) => matchesDomain(host, pattern))) return 0.6;
  if ((config.low_quality_domains ?? []).some((pattern) => matchesDomain(host, pattern))) return -1;
  if ((config.primary_source_suffixes ?? []).some((suffix) => host.endsWith(suffix.toLowerCase()))) return 1;
  return 0;
}

export function filterBlocked<T extends { url?: string }>(
  results: T[],
  config?: SourceQualityConfig,
): { kept: T[]; blocked: number } {
  if (!config || config.enabled === false || (config.blocklist ?? []).length === 0) {
    return { kept: results, blocked: 0 };
  }
  const kept: T[] = [];
  let blocked = 0;
  for (const result of results) {
    if (isBlocked(result.url, config)) blocked++;
    else kept.push(result);
  }
  return { kept, blocked };
}

/** A caller-supplied domain policy: restrict to, or prefer, listed domains. */
export interface DomainPolicy {
  include: string[];
  mode: "restrict" | "prefer";
}

export interface DomainPolicyResult<T> {
  kept: T[];
  /** Results removed by restrict mode. */
  excluded: number;
  /** Results matched by the policy (prefer mode ranks these ahead). */
  matched: number;
}

/**
 * REQ-020h: the caller's domain policy, applied on top of the configured
 * blocklist. `restrict` is a filter; `prefer` is a boost the caller composes
 * into quality scoring, leaving every result in place so a preference never
 * turns into an exclusion.
 */
export function applyDomainPolicy<T extends { url?: string }>(
  results: T[],
  policy?: DomainPolicy,
): DomainPolicyResult<T> {
  if (!policy || policy.include.length === 0) return { kept: results, excluded: 0, matched: 0 };
  const matches = (result: T): boolean => {
    const host = hostOf(result.url);
    return host !== null && policy.include.some((pattern) => matchesDomain(host, pattern));
  };
  if (policy.mode === "restrict") {
    const kept = results.filter(matches);
    return { kept, excluded: results.length - kept.length, matched: kept.length };
  }
  const matched = results.filter(matches).length;
  return { kept: results, excluded: 0, matched };
}

/** True when the result's host is inside the policy, for prefer-mode boosting. */
export function matchesPolicy(url: string | undefined, policy?: DomainPolicy): boolean {
  if (!policy || policy.include.length === 0) return false;
  const host = hostOf(url);
  return host !== null && policy.include.some((pattern) => matchesDomain(host, pattern));
}
