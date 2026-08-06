// @implements REQ-020
import type { SearchResult } from "../types.js";
import { normalize } from "../normalizer.js";
import { RetryableError } from "../retry.js";
import { getEnvVar } from "../config.js";

const CORE_API = "https://api.core.ac.uk/v3/search/works";

export async function coreSearch(query: string): Promise<SearchResult[]> {
  const apiKey = getEnvVar("core", "_API_KEY");
  const headers: Record<string, string> = {
    "User-Agent": "Infobroker/1.0",
    "Content-Type": "application/json",
  };
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

  const resp = await fetch(CORE_API, {
    method: "POST",
    headers,
    body: JSON.stringify({ q: query, limit: 10 }),
  });

  if (!resp.ok) throw new RetryableError(`CORE returned HTTP ${resp.status}`, resp.status);

  const data = (await resp.json()) as {
    results?: Array<{
      title: string;
      downloadUrl?: string;
      links?: Array<{ url: string; type: string }>;
      abstract?: string;
      publishedDate?: string;
    }>;
  };

  const raw = (data.results || []).map((item) => ({
    title: item.title,
    url: item.downloadUrl || item.links?.[0]?.url || "",
    snippet: item.abstract || "",
    published_date: item.publishedDate,
    source_type: "academic",
  }));

  return normalize(raw, "core");
}

export async function coreHealth(): Promise<{
  status: "active" | "degraded" | "inactive";
  avgLatencyMs: number;
}> {
  const start = Date.now();
  try {
    const resp = await fetch(CORE_API, {
      method: "POST",
      headers: { "User-Agent": "Infobroker/1.0", "Content-Type": "application/json" },
      body: JSON.stringify({ q: "test", limit: 1 }),
      signal: AbortSignal.timeout(10000),
    });
    const elapsed = Date.now() - start;
    if (resp.ok) return { status: "active", avgLatencyMs: elapsed };
    return { status: "degraded", avgLatencyMs: elapsed };
  } catch {
    return { status: "inactive", avgLatencyMs: Date.now() - start };
  }
}
