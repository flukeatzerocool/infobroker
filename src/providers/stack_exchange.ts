// @implements REQ-020
import type { SearchResult } from "../types.js";
import { normalize } from "../normalizer.js";
import { RetryableError } from "../retry.js";
import { getEnvVar } from "../config.js";

const SE_API = "https://api.stackexchange.com/2.3/search/advanced";

export async function stackExchangeSearch(query: string): Promise<SearchResult[]> {
  const apiKey = getEnvVar("stack_exchange", "_API_KEY");
  const params = new URLSearchParams({
    q: query,
    site: "stackoverflow",
    pagesize: "10",
    order: "desc",
    sort: "relevance",
    filter: "withbody",
  });
  if (apiKey) params.set("key", apiKey);

  const resp = await fetch(`${SE_API}?${params.toString()}`, {
    headers: { "User-Agent": "Infobroker/1.0" },
  });

  if (!resp.ok) throw new RetryableError(`Stack Exchange returned HTTP ${resp.status}`, resp.status);

  const data = (await resp.json()) as {
    items?: Array<{ title: string; link: string; body?: string; creation_date: number }>;
  };

  const raw = (data.items || []).map((item) => ({
    title: stripHtml(item.title),
    url: item.link,
    snippet: stripHtml(item.body || "").slice(0, 500),
    published_date: item.creation_date ? new Date(item.creation_date * 1000).toISOString() : undefined,
    source_type: "code",
  }));

  return normalize(raw, "stack_exchange");
}

export async function stackExchangeHealth(): Promise<{
  status: "active" | "degraded" | "inactive";
  avgLatencyMs: number;
}> {
  const start = Date.now();
  try {
    const resp = await fetch(`${SE_API}?q=test&site=stackoverflow&pagesize=1`, {
      headers: { "User-Agent": "Infobroker/1.0" },
      signal: AbortSignal.timeout(10000),
    });
    const elapsed = Date.now() - start;
    if (resp.ok) return { status: "active", avgLatencyMs: elapsed };
    return { status: "degraded", avgLatencyMs: elapsed };
  } catch {
    return { status: "inactive", avgLatencyMs: Date.now() - start };
  }
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
}
