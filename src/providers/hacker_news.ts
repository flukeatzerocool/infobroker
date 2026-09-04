// @implements REQ-020 REQ-070 REQ-071
import type { SearchResult, Provider } from "../types.js";
import { normalize } from "../normalizer.js";
import { RetryableError } from "../retry.js";
import { infobrokerFetch } from "../http.js";

const HN_API = "https://hn.algolia.com/api/v1/search";

async function search(query: string): Promise<SearchResult[]> {
  const params = new URLSearchParams({ query, tags: "story", hitsPerPage: "10" });

  const resp = await infobrokerFetch(`${HN_API}?${params.toString()}`, {
    providerSlug: "hacker_news",
  });

  if (!resp.ok) throw new RetryableError(`Hacker News returned HTTP ${resp.status}`, resp.status);

  const data = (await resp.json()) as {
    hits?: Array<{ title?: string; url?: string; objectID?: string; points?: number; author?: string }>;
  };

  const raw = (data.hits || []).map((item) => ({
    title: item.title || "(untitled)",
    url: item.url || (item.objectID ? `https://news.ycombinator.com/item?id=${item.objectID}` : ""),
    snippet: item.author ? `${item.points ?? 0} points by ${item.author}` : "",
    source_type: "news",
  }));

  return normalize(raw, "hacker_news");
}

async function health(): Promise<{ status: string; avgLatencyMs: number }> {
  const start = Date.now();
  try {
    const resp = await infobrokerFetch(`${HN_API}?query=test&tags=story&hitsPerPage=1`, {
      providerSlug: "hacker_news",
    });
    const elapsed = Date.now() - start;
    if (resp.ok) return { status: "active", avgLatencyMs: elapsed };
    return { status: "degraded", avgLatencyMs: elapsed };
  } catch {
    return { status: "inactive", avgLatencyMs: Date.now() - start };
  }
}

export const provider: Provider = {
  slug: "hacker_news",
  tier: "free_http",
  capabilities: ["news"],
  search,
  health,
};
