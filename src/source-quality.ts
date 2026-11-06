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
