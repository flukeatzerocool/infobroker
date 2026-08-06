// @implements REQ-020
import type { SearchResult } from "../types.js";
import { normalize } from "../normalizer.js";
import { RetryableError } from "../retry.js";
import { getEnvVar } from "../config.js";

const BRAVE_API = "https://api.search.brave.com/res/v1/web/search";

export async function braveSearch(query: string): Promise<SearchResult[]> {
  const apiKey = getEnvVar("brave", "_API_KEY");
  if (!apiKey) throw new Error("INFOBROKER_BRAVE_API_KEY not set");

  const params = new URLSearchParams({ q: query, count: "10" });
  const resp = await fetch(`${BRAVE_API}?${params.toString()}`, {
    headers: {
      "User-Agent": "Infobroker/1.0",
      "Accept": "application/json",
      "Accept-Encoding": "gzip",
      "X-Subscription-Token": apiKey,
    },
  });

  if (!resp.ok) throw new RetryableError(`Brave returned HTTP ${resp.status}`, resp.status);

  const data = (await resp.json()) as {
    web?: { results?: Array<{ title: string; url: string; description: string; page_age?: string }> };
  };

  const raw = (data.web?.results || []).map((item) => ({
    title: item.title,
    url: item.url,
    snippet: item.description,
    published_date: item.page_age,
    source_type: "web_search",
  }));

  return normalize(raw, "brave");
}

export async function braveHealth(): Promise<{
  status: "active" | "degraded" | "inactive";
  avgLatencyMs: number;
}> {
  const apiKey = getEnvVar("brave", "_API_KEY");
  if (!apiKey) return { status: "inactive", avgLatencyMs: 0 };

  const start = Date.now();
  try {
    const resp = await fetch(`${BRAVE_API}?q=test&count=1`, {
      headers: {
        "User-Agent": "Infobroker/1.0",
        "Accept": "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": apiKey,
      },
      signal: AbortSignal.timeout(10000),
    });
    const elapsed = Date.now() - start;
    if (resp.ok) return { status: "active", avgLatencyMs: elapsed };
    return { status: "degraded", avgLatencyMs: elapsed };
  } catch {
    return { status: "inactive", avgLatencyMs: Date.now() - start };
  }
}
