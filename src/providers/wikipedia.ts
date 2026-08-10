// @implements REQ-020 REQ-021
import type { SearchResult, SearchOptions, Provider } from "../types.js";
import { normalize } from "../normalizer.js";
import { RetryableError } from "../retry.js";
import { infobrokerFetch } from "../http.js";
import { stripHtml } from "../lib/html.js";

const WIKI_API = "https://en.wikipedia.org/w/api.php";

async function search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
  const maxResults = options?.max_results ?? 10;

  const params = new URLSearchParams({
    action: "query",
    list: "search",
    srsearch: query,
    srlimit: String(maxResults),
    format: "json",
    origin: "*",
  });

  const resp = await infobrokerFetch(`${WIKI_API}?${params.toString()}`, { providerSlug: "wikipedia" });

  if (!resp.ok) {
    throw new RetryableError(`Wikipedia returned HTTP ${resp.status}`, resp.status);
  }

  const data = (await resp.json()) as {
    query?: { search?: Array<{ title: string; snippet: string; timestamp: string }> };
  };

  const raw = (data.query?.search || []).map((item) => ({
    title: item.title,
    url: `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g, "_"))}`,
    snippet: stripHtml(item.snippet || ""),
    published_date: item.timestamp,
    source_type: "encyclopedia",
  }));

  return normalize(raw, "wikipedia");
}

async function fetchPage(url: string): Promise<string> {
  const title = extractTitle(url);
  const params = new URLSearchParams({
    action: "parse",
    page: title,
    prop: "text",
    format: "json",
    origin: "*",
  });

  const resp = await infobrokerFetch(`${WIKI_API}?${params.toString()}`, { providerSlug: "wikipedia" });

  if (!resp.ok) {
    throw new RetryableError(`Wikipedia returned HTTP ${resp.status}`, resp.status);
  }

  const data = (await resp.json()) as {
    parse?: { text?: { "*"?: string } };
  };

  return stripHtml(data.parse?.text?.["*"] || "(no content)");
}

async function health(): Promise<{ status: string; avgLatencyMs: number }> {
  const start = Date.now();
  try {
    const resp = await infobrokerFetch(
      `${WIKI_API}?action=query&list=search&srsearch=test&format=json&origin=*`,
      { providerSlug: "wikipedia" }
    );
    const elapsed = Date.now() - start;
    if (resp.ok) return { status: "active", avgLatencyMs: elapsed };
    return { status: "degraded", avgLatencyMs: elapsed };
  } catch {
    return { status: "inactive", avgLatencyMs: Date.now() - start };
  }
}

function extractTitle(url: string): string {
  const match = url.match(/wiki\/([^#?]+)/);
  return match ? decodeURIComponent(match[1]).replace(/_/g, " ") : url;
}

export const provider: Provider = {
  slug: "wikipedia",
  tier: "free_http",
  capabilities: ["encyclopedia", "content_fetch"],
  search,
  fetchPage,
  health,
};
