// @implements REQ-020
import type { SearchResult } from "../types.js";
import { normalize } from "../normalizer.js";
import { RetryableError } from "../retry.js";
import { getEnvVar } from "../config.js";

const EXA_API = "https://api.exa.ai/search";

export async function exaSearch(query: string): Promise<SearchResult[]> {
  const apiKey = getEnvVar("exa", "_API_KEY");
  if (!apiKey) throw new Error("INFOBROKER_EXA_API_KEY not set");

  const resp = await fetch(EXA_API, {
    method: "POST",
    headers: {
      "User-Agent": "Infobroker/1.0",
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({ query, numResults: 10, useAutoprompt: true }),
  });

  if (!resp.ok) throw new RetryableError(`Exa returned HTTP ${resp.status}`, resp.status);

  const data = (await resp.json()) as {
    results?: Array<{ title: string; url: string; text?: string; publishedDate?: string }>;
  };

  const raw = (data.results || []).map((item) => ({
    title: item.title,
    url: item.url,
    snippet: item.text || "",
    published_date: item.publishedDate,
    source_type: "semantic",
  }));

  return normalize(raw, "exa");
}

export async function exaHealth(): Promise<{
  status: "active" | "degraded" | "inactive";
  avgLatencyMs: number;
}> {
  const apiKey = getEnvVar("exa", "_API_KEY");
  if (!apiKey) return { status: "inactive", avgLatencyMs: 0 };

  const start = Date.now();
  try {
    const resp = await fetch(EXA_API, {
      method: "POST",
      headers: {
        "User-Agent": "Infobroker/1.0",
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({ query: "test", numResults: 1 }),
      signal: AbortSignal.timeout(10000),
    });
    const elapsed = Date.now() - start;
    if (resp.ok) return { status: "active", avgLatencyMs: elapsed };
    return { status: "degraded", avgLatencyMs: elapsed };
  } catch {
    return { status: "inactive", avgLatencyMs: Date.now() - start };
  }
}
