// @implements REQ-020
import type { SearchResult, Provider } from "../types.js";
import { normalize } from "../normalizer.js";
import { RetryableError } from "../retry.js";
import { infobrokerFetch } from "../http.js";
import { stripHtml } from "../lib/html.js";

const WIKTIONARY_API = "https://en.wiktionary.org/w/api.php";

async function search(query: string): Promise<SearchResult[]> {
  const params = new URLSearchParams({
    action: "query",
    list: "search",
    srsearch: query,
    srlimit: "10",
    format: "json",
    origin: "*",
  });

  const resp = await infobrokerFetch(`${WIKTIONARY_API}?${params.toString()}`, { providerSlug: "wiktionary" });

  if (!resp.ok) throw new RetryableError(`Wiktionary returned HTTP ${resp.status}`, resp.status);

  const data = (await resp.json()) as {
    query?: { search?: Array<{ title: string; snippet: string; timestamp: string }> };
  };

  const raw = (data.query?.search || []).map((item) => ({
    title: item.title,
    url: `https://en.wiktionary.org/wiki/${encodeURIComponent(item.title.replace(/ /g, "_"))}`,
    snippet: stripHtml(item.snippet || ""),
    published_date: item.timestamp,
    source_type: "definition",
  }));

  return normalize(raw, "wiktionary");
}

async function health(): Promise<{ status: string; avgLatencyMs: number }> {
  const start = Date.now();
  try {
    const resp = await infobrokerFetch(
      `${WIKTIONARY_API}?action=query&list=search&srsearch=test&format=json&origin=*`,
      { providerSlug: "wiktionary" }
    );
    const elapsed = Date.now() - start;
    if (resp.ok) return { status: "active", avgLatencyMs: elapsed };
    return { status: "degraded", avgLatencyMs: elapsed };
  } catch {
    return { status: "inactive", avgLatencyMs: Date.now() - start };
  }
}

export const provider: Provider = {
  slug: "wiktionary",
  tier: "free_http",
  capabilities: ["encyclopedia"],
  search,
  health,
};
