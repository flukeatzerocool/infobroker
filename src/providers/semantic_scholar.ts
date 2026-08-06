// @implements REQ-020
import type { SearchResult } from "../types.js";
import { normalize } from "../normalizer.js";
import { RetryableError } from "../retry.js";
import { getEnvVar } from "../config.js";

const SS_API = "https://api.semanticscholar.org/graph/v1/paper/search";

export async function semanticScholarSearch(query: string): Promise<SearchResult[]> {
  const apiKey = getEnvVar("semantic_scholar", "_API_KEY");
  const params = new URLSearchParams({ query, limit: "10" });

  const headers: Record<string, string> = {
    "User-Agent": "Infobroker/1.0",
  };
  if (apiKey) headers["x-api-key"] = apiKey;

  const resp = await fetch(`${SS_API}?${params.toString()}`, { headers });

  if (!resp.ok) throw new RetryableError(`Semantic Scholar returned HTTP ${resp.status}`, resp.status);

  const data = (await resp.json()) as {
    data?: Array<{ title: string; paperId: string; abstract?: string; year?: number }>;
  };

  const raw = (data.data || []).map((item) => ({
    title: item.title,
    url: `https://api.semanticscholar.org/${item.paperId}`,
    snippet: item.abstract || "",
    published_date: item.year ? String(item.year) : undefined,
    source_type: "academic",
  }));

  return normalize(raw, "semantic_scholar");
}

export async function semanticScholarHealth(): Promise<{
  status: "active" | "degraded" | "inactive";
  avgLatencyMs: number;
}> {
  const start = Date.now();
  try {
    const resp = await fetch(`${SS_API}?query=test&limit=1`, {
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
