// @implements REQ-020
import type { SearchResult } from "../types.js";
import { normalize } from "../normalizer.js";
import { RetryableError } from "../retry.js";
import { getEnvVar } from "../config.js";

export async function searxngSearch(query: string): Promise<SearchResult[]> {
  const baseUrl = getEnvVar("searxng", "_URL");
  if (!baseUrl) throw new Error("INFOBROKER_SEARXNG_URL not set");

  const params = new URLSearchParams({ q: query, format: "json" });
  const resp = await fetch(`${baseUrl}/search?${params.toString()}`, {
    headers: { "User-Agent": "Infobroker/1.0" },
  });

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

export async function searxngHealth(): Promise<{
  status: "active" | "degraded" | "inactive";
  avgLatencyMs: number;
}> {
  const baseUrl = getEnvVar("searxng", "_URL");
  if (!baseUrl) return { status: "inactive", avgLatencyMs: 0 };

  const start = Date.now();
  try {
    const resp = await fetch(`${baseUrl}/search?q=test&format=json`, {
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
