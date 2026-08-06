// @implements REQ-020
import type { SearchResult } from "../types.js";
import { normalize } from "../normalizer.js";
import { RetryableError } from "../retry.js";

const WIKIDATA_API = "https://www.wikidata.org/w/api.php";

export async function wikidataSearch(query: string): Promise<SearchResult[]> {
  const params = new URLSearchParams({
    action: "wbsearchentities",
    search: query,
    language: "en",
    limit: "10",
    format: "json",
    origin: "*",
  });

  const resp = await fetch(`${WIKIDATA_API}?${params.toString()}`, {
    headers: { "User-Agent": "Infobroker/1.0" },
  });

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

export async function wikidataHealth(): Promise<{
  status: "active" | "degraded" | "inactive";
  avgLatencyMs: number;
}> {
  const start = Date.now();
  try {
    const resp = await fetch(
      `${WIKIDATA_API}?action=wbsearchentities&search=test&language=en&format=json&origin=*`,
      {
        headers: { "User-Agent": "Infobroker/1.0" },
        signal: AbortSignal.timeout(10000),
      }
    );
    const elapsed = Date.now() - start;
    if (resp.ok) return { status: "active", avgLatencyMs: elapsed };
    return { status: "degraded", avgLatencyMs: elapsed };
  } catch {
    return { status: "inactive", avgLatencyMs: Date.now() - start };
  }
}
