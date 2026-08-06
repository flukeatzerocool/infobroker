// @implements REQ-020
import type { SearchResult } from "../types.js";
import { normalize } from "../normalizer.js";
import { RetryableError } from "../retry.js";
import { getEnvVar } from "../config.js";

const TAVILY_API = "https://api.tavily.com/search";

export async function tavilySearch(query: string): Promise<SearchResult[]> {
  const apiKey = getEnvVar("tavily", "_API_KEY");
  if (!apiKey) throw new Error("INFOBROKER_TAVILY_API_KEY not set");

  const resp = await fetch(TAVILY_API, {
    method: "POST",
    headers: {
      "User-Agent": "Infobroker/1.0",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ api_key: apiKey, query, max_results: 10, include_answer: false }),
  });

  if (!resp.ok) throw new RetryableError(`Tavily returned HTTP ${resp.status}`, resp.status);

  const data = (await resp.json()) as {
    results?: Array<{ title: string; url: string; content: string; published_date?: string }>;
  };

  const raw = (data.results || []).map((item) => ({
    title: item.title,
    url: item.url,
    snippet: item.content,
    published_date: item.published_date,
    source_type: "synthesis",
  }));

  return normalize(raw, "tavily");
}

export async function tavilyHealth(): Promise<{
  status: "active" | "degraded" | "inactive";
  avgLatencyMs: number;
}> {
  const apiKey = getEnvVar("tavily", "_API_KEY");
  if (!apiKey) return { status: "inactive", avgLatencyMs: 0 };

  const start = Date.now();
  try {
    const resp = await fetch(TAVILY_API, {
      method: "POST",
      headers: {
        "User-Agent": "Infobroker/1.0",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ api_key: apiKey, query: "test", max_results: 1 }),
      signal: AbortSignal.timeout(10000),
    });
    const elapsed = Date.now() - start;
    if (resp.ok) return { status: "active", avgLatencyMs: elapsed };
    return { status: "degraded", avgLatencyMs: elapsed };
  } catch {
    return { status: "inactive", avgLatencyMs: Date.now() - start };
  }
}
