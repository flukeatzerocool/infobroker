// @implements REQ-020
import type { SearchResult, Provider } from "../types.js";
import { normalize } from "../normalizer.js";
import { RetryableError } from "../retry.js";
import { infobrokerFetch } from "../http.js";

const WIKIDATA_API = "https://www.wikidata.org/w/api.php";

async function search(query: string): Promise<SearchResult[]> {
  const params = new URLSearchParams({
    action: "wbsearchentities",
    search: query,
    language: "en",
    limit: "10",
    format: "json",
    origin: "*",
  });

  const resp = await infobrokerFetch(`${WIKIDATA_API}?${params.toString()}`, { providerSlug: "wikidata" });

  if (!resp.ok) throw new RetryableError(`Wikidata returned HTTP ${resp.status}`, resp.status);

  const data = (await resp.json()) as {
    search?: Array<{ id: string; label: string; description?: string }>;
  };

  const raw = (data.search || []).map((item) => ({
    title: item.label,
    url: `https://www.wikidata.org/wiki/${item.id}`,
    snippet: item.description || "",
    source_type: "structured_fact",
  }));

  return normalize(raw, "wikidata");
}

async function health(): Promise<{ status: string; avgLatencyMs: number }> {
  const start = Date.now();
  try {
    const resp = await infobrokerFetch(
      `${WIKIDATA_API}?action=wbsearchentities&search=test&language=en&format=json&origin=*`,
      { providerSlug: "wikidata" }
    );
    const elapsed = Date.now() - start;
    if (resp.ok) return { status: "active", avgLatencyMs: elapsed };
    return { status: "degraded", avgLatencyMs: elapsed };
  } catch {
    return { status: "inactive", avgLatencyMs: Date.now() - start };
  }
}

export const provider: Provider = {
  slug: "wikidata",
  tier: "free_http",
  capabilities: ["encyclopedia"],
  search,
  health,
};
