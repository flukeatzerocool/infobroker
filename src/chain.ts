// @implements REQ-020c REQ-020d
import { getDispatchChain, getConfig } from "./config.js";

// Which of the filter-style options a provider actually honors. Used by
// REQ-020d to report parameters silently dropped by the serving provider.
// `max_results` is deliberately absent: it is enforced server-side.
export const SUPPORTED_OPTIONS: Record<
  string,
  { time_range?: boolean; page?: boolean; safe_search?: boolean }
> = {
  duckduckgo: { time_range: true, safe_search: true },
  brave: { time_range: true },
};

export function ignoredParams(
  provider: string,
  opts: { safe_search?: string; time_range?: string; page?: number },
): string[] {
  const supported = SUPPORTED_OPTIONS[provider] ?? {};
  const ignored: string[] = [];
  if (opts.time_range && !supported.time_range) ignored.push("time_range");
  if (opts.page !== undefined && opts.page > 1 && !supported.page) ignored.push("page");
  if (opts.safe_search === "off" && !supported.safe_search) ignored.push("safe_search");
  return ignored;
}

export function selectChain(
  chain: string[],
  priority: string | undefined,
  getLatency: (slug: string) => number,
): string[] {
  const config = getConfig();
  if (priority === "privacy") {
    const privacyChain = getDispatchChain("privacy_critical");
    if (privacyChain.length > 0) return privacyChain;
    return chain;
  }
  if (priority === "free_only") {
    const filtered = chain.filter((slug) => {
      const p = config.providers[slug];
      return p && p.tier !== "keyed_http" && p.tier !== "self_hosted_http";
    });
    if (filtered.length > 0) return filtered;
    return getDispatchChain("general_web").filter((slug) => {
      const p = config.providers[slug];
      return p && p.tier !== "keyed_http" && p.tier !== "self_hosted_http";
    });
  }
  if (priority === "speed") {
    return [...chain].sort((a, b) => {
      const la = getLatency(a);
      const lb = getLatency(b);
      if (la === 0) return 1;
      if (lb === 0) return -1;
      return la - lb;
    });
  }
  return chain;
}
