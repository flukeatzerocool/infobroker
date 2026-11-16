// @implements REQ-020
import * as cheerio from "cheerio";
import type { SearchResult, Provider, SearchOptions } from "../types.js";
import { normalize } from "../normalizer.js";
import { RetryableError, BotChallengeError } from "../retry.js";
import { infobrokerFetch } from "../http.js";

// The public search moved from search.marginalia.nu (which now redirects) to
// marginalia-search.com. The old host still resolves, but its markup and the
// redirect cost a hop per request.
const MARGINALIA_URL = "https://marginalia-search.com/search";

async function search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
  const params = new URLSearchParams({ query, profile: "default" });

  const resp = await infobrokerFetch(`${MARGINALIA_URL}?${params.toString()}`, { providerSlug: "marginalia", signal: options?.signal });

  if (!resp.ok) throw new RetryableError(`Marginalia returned HTTP ${resp.status}`, resp.status);

  const html = await resp.text();
  const $ = cheerio.load(html);

  // Current Tailwind layout: no `.result` container. The title is an
  // `h2 > a[rel="noopener noreferrer"]`; the snippet is the first
  // `div.overflow-auto p` inside the result's `div.flex.flex-col.grow` column.
  const raw: Array<Record<string, unknown>> = [];
  $("h2 a[rel='noopener noreferrer']").each((_i, el) => {
    if (raw.length >= 10) return false;
    const title = $(el).text().trim();
    const link = $(el).attr("href") || "";
    if (!title || !/^https?:\/\//i.test(link)) return;
    const column = $(el).closest("div.flex.flex-col.grow");
    const snippet = column.find("div.overflow-auto p").first().text().trim();
    raw.push({ title, url: link, snippet });
  });

  // A bot-activity interstitial is HTTP 200 with no results. Reporting it as
  // "zero results" hides the cause and skips the cooldown, so treat it as a
  // challenge (REQ-021f) instead.
  if (raw.length === 0 && /aggressive bot activity|Please wait for \d+ second/i.test(html)) {
    throw new BotChallengeError("Marginalia returned a bot-activity interstitial");
  }

  return normalize(raw, "marginalia");
}

async function health(): Promise<{ status: string; avgLatencyMs: number }> {
  const start = Date.now();
  try {
    const resp = await infobrokerFetch(`${MARGINALIA_URL}?query=test&profile=default`, { providerSlug: "marginalia" });
    const elapsed = Date.now() - start;
    if (resp.ok) return { status: "active", avgLatencyMs: elapsed };
    return { status: "degraded", avgLatencyMs: elapsed };
  } catch {
    return { status: "inactive", avgLatencyMs: Date.now() - start };
  }
}

export const provider: Provider = {
  slug: "marginalia",
  tier: "builtin",
  capabilities: ["web_search"],
  search,
  health,
};
