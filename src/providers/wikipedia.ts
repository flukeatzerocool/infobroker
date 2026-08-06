// @implements REQ-020 REQ-021
import type { SearchResult, SearchOptions } from "../types.js";
import { normalize } from "../normalizer.js";
import { RetryableError } from "../retry.js";

const WIKI_API = "https://en.wikipedia.org/w/api.php";

export async function wikipediaSearch(
  query: string,
  options?: SearchOptions
): Promise<SearchResult[]> {
  const maxResults = options?.max_results ?? 10;

  const params = new URLSearchParams({
    action: "query",
    list: "search",
    srsearch: query,
    srlimit: String(maxResults),
    format: "json",
    origin: "*",
  });

  const resp = await fetch(`${WIKI_API}?${params.toString()}`, {
    headers: { "User-Agent": "Infobroker/1.0" },
  });

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

export async function wikipediaFetchPage(url: string): Promise<string> {
  const title = extractTitle(url);
  const params = new URLSearchParams({
    action: "parse",
    page: title,
    prop: "text",
    format: "json",
    origin: "*",
  });

  const resp = await fetch(`${WIKI_API}?${params.toString()}`, {
    headers: { "User-Agent": "Infobroker/1.0" },
  });

  if (!resp.ok) {
    throw new RetryableError(`Wikipedia returned HTTP ${resp.status}`, resp.status);
  }

  const data = (await resp.json()) as {
    parse?: { text?: { "*"?: string } };
  };

  return stripHtml(data.parse?.text?.["*"] || "(no content)");
}

export async function wikipediaHealth(): Promise<{
  status: "active" | "degraded" | "inactive";
  avgLatencyMs: number;
}> {
  const start = Date.now();
  try {
    const resp = await fetch(
      `${WIKI_API}?action=query&list=search&srsearch=test&format=json&origin=*`,
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

function extractTitle(url: string): string {
  const match = url.match(/wiki\/([^#?]+)/);
  return match ? decodeURIComponent(match[1]).replace(/_/g, " ") : url;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .trim();
}
