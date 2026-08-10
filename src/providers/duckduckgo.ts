// @implements REQ-020 REQ-022
import * as cheerio from "cheerio";
import type { SearchResult, SearchOptions, Provider } from "../types.js";
import { normalize } from "../normalizer.js";
import { RetryableError } from "../retry.js";
import { infobrokerFetch } from "../http.js";
import { stripHtml } from "../lib/html.js";

const DDG_URL = "https://html.duckduckgo.com/html/";
const SUGGEST_URL = "https://duckduckgo.com/ac/";

async function search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
  const maxResults = options?.max_results ?? 10;
  const safeSearch = options?.safe_search === "off" ? "0" : "1";
  const timeRange = options?.time_range ? `&df=${mapTimeRange(options.time_range)}` : "";

  const params = new URLSearchParams({
    q: query,
    kl: "us-en",
    kp: safeSearch,
  });

  const url = `${DDG_URL}?${params.toString()}${timeRange}`;

  const resp = await infobrokerFetch(url, { providerSlug: "duckduckgo" });

  if (!resp.ok) {
    throw new RetryableError(`DuckDuckGo returned HTTP ${resp.status}`, resp.status);
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

    let resultUrl = rawUrl;
    if (resultUrl.startsWith("//")) resultUrl = "https:" + resultUrl;

    const snippet = snippetEl.text().trim();

    if (title && resultUrl) {
      rawResults.push({ title, url: resultUrl, snippet });
    }
  });

  return normalize(rawResults, "duckduckgo");
}

async function suggest(query: string): Promise<string[]> {
  const resp = await fetch(`${SUGGEST_URL}?q=${encodeURIComponent(query)}&type=list`, {
    headers: { "User-Agent": "Infobroker/1.0" },
  });

  if (!resp.ok) return [];

  const data = (await resp.json()) as [string, string[]];
  return Array.isArray(data) && Array.isArray(data[1]) ? data[1] : [];
}

async function health(): Promise<{ status: string; avgLatencyMs: number }> {
  const start = Date.now();
  try {
    const resp = await infobrokerFetch(`${DDG_URL}?q=test`, { providerSlug: "duckduckgo" });
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

export const provider: Provider = {
  slug: "duckduckgo",
  tier: "builtin",
  capabilities: ["web_search"],
  search,
  suggest,
  health,
};
