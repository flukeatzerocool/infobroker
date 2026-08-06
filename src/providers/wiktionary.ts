import type { SearchResult } from "../types.js";
import { normalize } from "../normalizer.js";

const WIKTIONARY_API = "https://en.wiktionary.org/w/api.php";

export async function wiktionarySearch(query: string): Promise<SearchResult[]> {
  const params = new URLSearchParams({
    action: "query",
    list: "search",
    srsearch: query,
    srlimit: "10",
    format: "json",
    origin: "*",
  });

  const resp = await fetch(`${WIKTIONARY_API}?${params.toString()}`, {
    headers: { "User-Agent": "Infobroker/1.0" },
  });

  if (!resp.ok) throw new Error(`Wiktionary returned HTTP ${resp.status}`);

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

export async function wiktionaryHealth(): Promise<{
  status: "active" | "degraded" | "inactive";
  avgLatencyMs: number;
}> {
  const start = Date.now();
  try {
    const resp = await fetch(
      `${WIKTIONARY_API}?action=query&list=search&srsearch=test&format=json&origin=*`,
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

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
}
