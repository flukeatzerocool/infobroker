// @implements REQ-020a REQ-020c REQ-020d REQ-031a REQ-128
import { getDispatchChain, getConfig } from "./config.js";

// Which of the filter-style options a provider actually honors. Used by
// REQ-020d to report parameters silently dropped by the serving provider.
// `max_results` is deliberately absent: it is enforced server-side.
// `content_type` is a server-side post-filter (never honored by a provider).
export const SUPPORTED_OPTIONS: Record<
  string,
  { time_range?: boolean; page?: boolean; safe_search?: boolean; region?: boolean; language?: boolean }
> = {
  duckduckgo: { time_range: true, safe_search: true, region: true },
  wikipedia: { language: true },
  wiktionary: { language: true },
  wikidata: { language: true },
  gdelt: { language: true },
  searxng: { language: true },
  // Brave maps `time_range` to `freshness` and `language` to `search_lang`; it
  // does not read `region`, so a caller-supplied region is reported as ignored.
  brave: { time_range: true, language: true },
  // Yep reads `region` (location), `time_range`, and `language`; it applies
  // `safe_search` only for the `strict` value, so `off` stays ignored.
  yep: { time_range: true, region: true, language: true },
};

export function ignoredParams(
  provider: string,
  opts: { safe_search?: string; time_range?: string; page?: number; content_type?: string; region?: string; language?: string },
): string[] {
  const supported = SUPPORTED_OPTIONS[provider] ?? {};
  const ignored: string[] = [];
  if (opts.time_range && !supported.time_range) ignored.push("time_range");
  if (opts.page !== undefined && opts.page > 1 && !supported.page) ignored.push("page");
  if (opts.safe_search === "off" && !supported.safe_search) ignored.push("safe_search");
  if (opts.region && !supported.region) ignored.push("region");
  if (opts.content_type && opts.content_type !== "all") ignored.push("content_type");
  if (opts.language && !supported.language) ignored.push("language");
  return ignored;
}

export function selectChain(
  chain: string[],
  priority: string | undefined,
  getLatency: (slug: string) => number,
): string[] {
  const config = getConfig();
  let selected = chain;
  if (priority === "privacy") {
    const privacyChain = getDispatchChain("privacy_critical");
    if (privacyChain.length > 0) {
      selected = privacyChain;
    }
  } else if (priority === "free_only") {
    const filtered = chain.filter((slug) => {
      const p = config.providers[slug];
      return p && p.tier !== "keyed_http" && p.tier !== "self_hosted_http";
    });
    if (filtered.length > 0) {
      selected = filtered;
    } else {
      selected = getDispatchChain("general_web").filter((slug) => {
        const p = config.providers[slug];
        return p && p.tier !== "keyed_http" && p.tier !== "self_hosted_http";
      });
    }
  } else if (priority === "speed") {
    selected = [...chain].sort((a, b) => {
      const la = getLatency(a);
      const lb = getLatency(b);
      if (la === 0) return 1;
      if (lb === 0) return -1;
      return la - lb;
    });
  }
  return selected.slice(0, config.output.fallback_depth);
}

// REQ-020a / §7.3: demote providers at quota warning (≥80% usage) to the tail
// of the chain so they are tried only after non-warning providers, without
// dropping them entirely (only exhausted providers are dropped).
export function demoteQuotaWarnings(
  chain: string[],
  isQuotaWarned: (slug: string) => boolean,
): string[] {
  const warned: string[] = [];
  const clean: string[] = [];
  for (const slug of chain) {
    if (isQuotaWarned(slug)) warned.push(slug);
    else clean.push(slug);
  }
  return [...clean, ...warned];
}

// REQ-031a: when a non-general_web task chain exhausts, the server retries the
// general_web chain before failing. Providers already attempted in the serving
// chain are excluded so they are not re-tried. The general_web task itself has
// no cross-task fallback (it is already the general chain).
export function crossTaskFallbackChain(
  taskType: string,
  attempted: string[],
  generalChain: string[],
): string[] {
  if (taskType === "general_web") return [];
  const attemptedSet = new Set(attempted);
  return generalChain.filter((slug) => !attemptedSet.has(slug));
}

// REQ-128: when a caller restricts the result language, put providers that
// honor it ahead of those that would report it as ignored, preserving the
// relative order within each group.
export function preferLanguageCapable(chain: string[], language?: string): string[] {
  if (!language) return chain;
  const capable: string[] = [];
  const rest: string[] = [];
  for (const slug of chain) {
    if (SUPPORTED_OPTIONS[slug]?.language) capable.push(slug);
    else rest.push(slug);
  }
  return capable.length > 0 ? [...capable, ...rest] : chain;
}
