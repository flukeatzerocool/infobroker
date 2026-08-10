// @implements REQ-020
import type { SearchResult, Provider } from "../types.js";
import { normalize } from "../normalizer.js";
import { RetryableError } from "../retry.js";
import { getEnvVar } from "../config.js";
import { infobrokerFetch } from "../http.js";

let _searxngUrl: string | undefined;
function searxngUrl(): string | undefined {
  if (_searxngUrl === undefined) _searxngUrl = getEnvVar("searxng", "_URL");
  return _searxngUrl;
}

async function search(query: string): Promise<SearchResult[]> {
  const baseUrl = searxngUrl();
  if (!baseUrl) throw new Error("INFOBROKER_SEARXNG_URL not set");

  const params = new URLSearchParams({ q: query, format: "json" });
  const resp = await infobrokerFetch(`${baseUrl}/search?${params.toString()}`, { providerSlug: "searxng" });

  if (!resp.ok) throw new RetryableError(`SearXNG returned HTTP ${resp.status}`, resp.status);

  const data = (await resp.json()) as {
    results?: Array<{ title: string; url: string; content?: string; publishedDate?: string }>;
  };

  const raw = (data.results || []).slice(0, 10).map((item) => ({
    title: item.title,
    url: item.url,
    snippet: item.content || "",
    published_date: item.publishedDate,
    source_type: "web_search",
  }));

  return normalize(raw, "searxng");
}

async function health(): Promise<{ status: string; avgLatencyMs: number }> {
  const baseUrl = searxngUrl();
  if (!baseUrl) return { status: "inactive", avgLatencyMs: 0 };

  const start = Date.now();
  try {
    const resp = await infobrokerFetch(`${baseUrl}/search?q=test&format=json`, { providerSlug: "searxng" });
    const elapsed = Date.now() - start;
    if (resp.ok) return { status: "active", avgLatencyMs: elapsed };
    return { status: "degraded", avgLatencyMs: elapsed };
  } catch {
    return { status: "inactive", avgLatencyMs: Date.now() - start };
  }
}

export const provider: Provider = {
  slug: "searxng",
  tier: "self_hosted_http",
  capabilities: ["web_search"],
  search,
  health,
};
