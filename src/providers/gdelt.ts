// @implements REQ-020 REQ-070 REQ-071
import type { SearchResult, Provider } from "../types.js";
import { normalize } from "../normalizer.js";
import { RetryableError } from "../retry.js";
import { infobrokerFetch } from "../http.js";

const GDELT_API = "https://api.gdeltproject.org/api/v2/doc/doc";

async function search(query: string): Promise<SearchResult[]> {
  const params = new URLSearchParams({
    query,
    mode: "artlist",
    format: "json",
    maxrecords: "10",
  });

  const resp = await infobrokerFetch(`${GDELT_API}?${params.toString()}`, {
    providerSlug: "gdelt",
  });

  if (!resp.ok) throw new RetryableError(`GDELT returned HTTP ${resp.status}`, resp.status);

  const data = (await resp.json()) as {
    articles?: Array<{ title?: string; url?: string; seendate?: string }>;
  };

  const raw = (data.articles || []).map((item) => ({
    title: item.title || "(untitled)",
    url: item.url || "",
    snippet: item.seendate ? `seen ${item.seendate}` : "",
    published_date: item.seendate ? item.seendate.slice(0, 8) : undefined,
    source_type: "news",
  }));

  return normalize(raw, "gdelt");
}

async function health(): Promise<{ status: string; avgLatencyMs: number }> {
  const start = Date.now();
  try {
    const resp = await infobrokerFetch(`${GDELT_API}?query=test&mode=artlist&format=json&maxrecords=1`, {
      providerSlug: "gdelt",
    });
    const elapsed = Date.now() - start;
    if (resp.ok) return { status: "active", avgLatencyMs: elapsed };
    return { status: "degraded", avgLatencyMs: elapsed };
  } catch {
    return { status: "inactive", avgLatencyMs: Date.now() - start };
  }
}

export const provider: Provider = {
  slug: "gdelt",
  tier: "free_http",
  capabilities: ["news"],
  search,
  health,
};
