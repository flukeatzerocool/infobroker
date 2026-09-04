// @implements REQ-020 REQ-070 REQ-071
import type { SearchResult, Provider } from "../types.js";
import { normalize } from "../normalizer.js";
import { RetryableError } from "../retry.js";
import { infobrokerFetch } from "../http.js";

const OPENALEX_API = "https://api.openalex.org/works";

async function search(query: string): Promise<SearchResult[]> {
  const params = new URLSearchParams({ search: query, "per-page": "10" });

  const resp = await infobrokerFetch(`${OPENALEX_API}?${params.toString()}`, {
    providerSlug: "openalex",
  });

  if (!resp.ok) throw new RetryableError(`OpenAlex returned HTTP ${resp.status}`, resp.status);

  const data = (await resp.json()) as {
    results?: Array<{
      display_name?: string;
      id?: string;
      publication_year?: number;
      doi?: string;
    }>;
  };

  const raw = (data.results || []).map((item) => ({
    title: item.display_name || "(untitled)",
    url: item.id || "",
    snippet: item.doi || (item.publication_year ? String(item.publication_year) : ""),
    published_date: item.publication_year ? String(item.publication_year) : undefined,
    source_type: "academic",
  }));

  return normalize(raw, "openalex");
}

async function health(): Promise<{ status: string; avgLatencyMs: number }> {
  const start = Date.now();
  try {
    const resp = await infobrokerFetch(`${OPENALEX_API}?search=test&per-page=1`, { providerSlug: "openalex" });
    const elapsed = Date.now() - start;
    if (resp.ok) return { status: "active", avgLatencyMs: elapsed };
    return { status: "degraded", avgLatencyMs: elapsed };
  } catch {
    return { status: "inactive", avgLatencyMs: Date.now() - start };
  }
}

export const provider: Provider = {
  slug: "openalex",
  tier: "free_http",
  capabilities: ["academic"],
  search,
  health,
};
