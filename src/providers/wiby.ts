// @implements REQ-020
import * as cheerio from "cheerio";
import type { SearchResult, Provider, SearchOptions } from "../types.js";
import { normalize } from "../normalizer.js";
import { RetryableError } from "../retry.js";
import { infobrokerFetch } from "../http.js";

const WIBY_URL = "https://wiby.me/";

async function search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
  const resp = await infobrokerFetch(`${WIBY_URL}?q=${encodeURIComponent(query)}`, { providerSlug: "wiby", signal: options?.signal });

  if (!resp.ok) throw new RetryableError(`Wiby returned HTTP ${resp.status}`, resp.status);

  const html = await resp.text();
  const $ = cheerio.load(html);

  // Current markup: each result is a <blockquote> holding `a.tlink` (the
  // title and href), `p.url` (the display URL), and one plain <p> snippet.
  // Older markup used `a[rel='noopener']`, which now matches nothing.
  const raw: Array<Record<string, unknown>> = [];
  $("blockquote a.tlink").each((_i, el) => {
    if (raw.length >= 10) return false;
    const link = $(el).attr("href") || "";
    const title = $(el).text().trim();
    const block = $(el).closest("blockquote");
    const displayUrl = block.find("p.url").first().text().trim();
    const snippet = block.find("p").not(".url").first().text().trim();
    if (title && link) {
      raw.push({ title, url: displayUrl || link, snippet });
    }
  });

  return normalize(raw, "wiby");
}

async function health(): Promise<{ status: string; avgLatencyMs: number }> {
  const start = Date.now();
  try {
    const resp = await infobrokerFetch(`${WIBY_URL}?q=test`, { providerSlug: "wiby" });
    const elapsed = Date.now() - start;
    if (resp.ok) return { status: "active", avgLatencyMs: elapsed };
    return { status: "degraded", avgLatencyMs: elapsed };
  } catch {
    return { status: "inactive", avgLatencyMs: Date.now() - start };
  }
}

export const provider: Provider = {
  slug: "wiby",
  tier: "builtin",
  capabilities: ["web_search"],
  search,
  health,
};
