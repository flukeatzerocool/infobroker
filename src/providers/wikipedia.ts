// @implements REQ-020 REQ-021 REQ-021i wikipedia-infobox
import * as cheerio from "cheerio";
import type { SearchResult, SearchOptions, Provider } from "../types.js";
import { normalize } from "../normalizer.js";
import { RetryableError } from "../retry.js";
import { infobrokerFetch } from "../http.js";
import { stripHtml } from "../lib/html.js";
import { collectInfoboxRows, MAX_INFOBOX_ROWS } from "../lib/infobox.js";

const DEFAULT_LANG = "en";
const WIKI_API = "https://en.wikipedia.org/w/api.php";

async function search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
  const maxResults = options?.max_results ?? 10;
  const lang = options?.language || DEFAULT_LANG;
  const wikiApi = `https://${lang}.wikipedia.org/w/api.php`;

  const params = new URLSearchParams({
    action: "query",
    list: "search",
    srsearch: query,
    srlimit: String(maxResults),
    format: "json",
    origin: "*",
  });

  const resp = await infobrokerFetch(`${wikiApi}?${params.toString()}`, { providerSlug: "wikipedia" });

  if (!resp.ok) {
    throw new RetryableError(`Wikipedia returned HTTP ${resp.status}`, resp.status);
  }

  const data = (await resp.json()) as {
    query?: { search?: Array<{ title: string; snippet: string; timestamp: string }> };
  };

  const raw = (data.query?.search || []).map((item) => ({
    title: item.title,
    url: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g, "_"))}`,
    snippet: stripHtml(item.snippet || ""),
    published_date: item.timestamp,
    source_type: "encyclopedia",
  }));

  return normalize(raw, "wikipedia");
}

// The raw parse HTML is shared by the renderer and the structured-fact
// extractor, so the infobox is available before the page is flattened to prose.
export async function fetchParseHtml(url: string): Promise<string> {
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

  return data.parse?.text?.["*"] ?? "";
}

async function fetchPage(url: string): Promise<string> {
  const html = await fetchParseHtml(url);
  if (!html) return "(no content)";

  // REQ-021i: keep the infobox as key/value lines ahead of the article text so
  // question ranking can select a fact ("attendance: 20,593") that stripHtml
  // would otherwise bury in prose. The table is removed from the body to avoid
  // returning every value twice.
  const $ = cheerio.load(html);
  const rows = collectInfoboxRows($);
  $("table.infobox").remove();
  const body = stripHtml($.html() || html);
  if (rows.length === 0) return body;
  const block = ["Infobox:", ...rows.slice(0, MAX_INFOBOX_ROWS).map((row) => `${row.key}: ${row.value}`)].join("\n");
  return `${block}\n\n${body}`;
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
