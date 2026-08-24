// @implements REQ-020
import type { SearchResult, SearchOptions, Provider } from "../types.js";
import { normalize } from "../normalizer.js";
import { RetryableError } from "../retry.js";
import { getEnvVar } from "../config.js";
import { infobrokerFetch } from "../http.js";

const BRAVE_API = "https://api.search.brave.com/res/v1/web/search";

let _braveApiKey: string | undefined;
function braveApiKey(): string | undefined {
  if (_braveApiKey === undefined) _braveApiKey = getEnvVar("brave", "_API_KEY");
  return _braveApiKey;
}

async function search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
  const apiKey = braveApiKey();
  if (!apiKey) throw new Error("INFOBROKER_BRAVE_API_KEY not set");

  const params = new URLSearchParams({ q: query, count: "10" });

  if (options?.time_range) {
    params.set("freshness", mapTimeRange(options.time_range));
  }

  const resp = await infobrokerFetch(`${BRAVE_API}?${params.toString()}`, {
    providerSlug: "brave",
    headers: {
      "Accept": "application/json",
      "Accept-Encoding": "gzip",
      "X-Subscription-Token": apiKey,
    },
  });

  if (!resp.ok) throw new RetryableError(`Brave returned HTTP ${resp.status}`, resp.status);

  const data = (await resp.json()) as {
    web?: { results?: Array<{ title: string; url: string; description: string; page_age?: string; meta_url?: { hostname?: string }; profile?: { name?: string; long_name?: string } }> };
  };

  const raw = (data.web?.results || []).map((item) => ({
    title: item.title,
    url: item.url,
    snippet: item.description,
    published_date: item.page_age,
    source_type: "web_search",
    original_source: item.profile?.long_name || item.profile?.name || (item.meta_url?.hostname ? `https://${item.meta_url.hostname}` : undefined),
  }));

  return normalize(raw, "brave");
}

async function health(): Promise<{ status: string; avgLatencyMs: number }> {
  const apiKey = braveApiKey();
  if (!apiKey) return { status: "inactive", avgLatencyMs: 0 };

  const start = Date.now();
  try {
    const resp = await infobrokerFetch(`${BRAVE_API}?q=test&count=1`, {
      providerSlug: "brave",
      headers: {
        "Accept": "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": apiKey,
      },
    });
    const elapsed = Date.now() - start;
    if (resp.ok) return { status: "active", avgLatencyMs: elapsed };
    return { status: "degraded", avgLatencyMs: elapsed };
  } catch {
    return { status: "inactive", avgLatencyMs: Date.now() - start };
  }
}

function mapTimeRange(range: string): string {
  const map: Record<string, string> = {
    day: "pd",
    week: "pw",
    month: "pm",
    year: "py",
  };
  return map[range] || "";
}

export const provider: Provider = {
  slug: "brave",
  tier: "keyed_http",
  capabilities: ["web_search"],
  search,
  health,
};
