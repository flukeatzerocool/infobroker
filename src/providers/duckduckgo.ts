import * as cheerio from "cheerio";
import type { SearchResult, SearchOptions } from "../types.js";
import { normalize } from "../normalizer.js";

const DDG_URL = "https://html.duckduckgo.com/html/";
const SUGGEST_URL = "https://duckduckgo.com/ac/";

export async function duckduckgoSearch(
  query: string,
  options?: SearchOptions
): Promise<SearchResult[]> {
  const maxResults = options?.max_results ?? 10;
  const safeSearch = options?.safe_search === "off" ? "0" : "1";
  const timeRange = options?.time_range ? `&df=${mapTimeRange(options.time_range)}` : "";

  const params = new URLSearchParams({
    q: query,
    kl: "us-en",
    kp: safeSearch,
  });

  const url = `${DDG_URL}?${params.toString()}${timeRange}`;

  const resp = await fetch(url, {
    headers: {
      "User-Agent": "Infobroker/1.0 (MCP search server; https://github.com/infobroker)",
    },
  });

  if (!resp.ok) {
    throw new Error(`DuckDuckGo returned HTTP ${resp.status}`);
  }

  const html = await resp.text();
  const $ = cheerio.load(html);

  const rawResults: Array<Record<string, unknown>> = [];

  $(".result").each((_i, el) => {
    if (rawResults.length >= maxResults) return false;

    const titleEl = $(el).find(".result__title a.result__a");
    const snippetEl = $(el).find(".result__snippet");
    const urlEl = $(el).find(".result__url");

    const title = titleEl.text().trim();
    const rawUrl = urlEl.text().trim() || titleEl.attr("href") || "";

    let url = rawUrl;
    if (url.startsWith("//")) url = "https:" + url;

    const snippet = snippetEl.text().trim();

    if (title && url) {
      rawResults.push({ title, url, snippet });
    }
  });

  return normalize(rawResults, "duckduckgo");
}

export async function duckduckgoSuggest(query: string): Promise<string[]> {
  const resp = await fetch(`${SUGGEST_URL}?q=${encodeURIComponent(query)}&type=list`, {
    headers: {
      "User-Agent": "Infobroker/1.0",
    },
  });

  if (!resp.ok) return [];

  const data = (await resp.json()) as [string, string[]];
  return Array.isArray(data) && Array.isArray(data[1]) ? data[1] : [];
}

export async function duckduckgoHealth(): Promise<{
  status: "active" | "degraded" | "inactive";
  avgLatencyMs: number;
}> {
  const start = Date.now();
  try {
    const resp = await fetch(`${DDG_URL}?q=test`, {
      headers: { "User-Agent": "Infobroker/1.0" },
      signal: AbortSignal.timeout(10000),
    });
    const elapsed = Date.now() - start;
    if (resp.ok) {
      return { status: "active", avgLatencyMs: elapsed };
    }
    return { status: "degraded", avgLatencyMs: elapsed };
  } catch {
    return { status: "inactive", avgLatencyMs: Date.now() - start };
  }
}

function mapTimeRange(range: string): string {
  const map: Record<string, string> = {
    day: "d",
    week: "w",
    month: "m",
    year: "y",
  };
  return map[range] || "";
}
