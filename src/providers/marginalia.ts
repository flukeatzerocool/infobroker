// @implements REQ-020
import * as cheerio from "cheerio";
import type { SearchResult, Provider } from "../types.js";
import { normalize } from "../normalizer.js";
import { RetryableError } from "../retry.js";
import { infobrokerFetch } from "../http.js";

const MARGINALIA_URL = "https://search.marginalia.nu/search";

async function search(query: string): Promise<SearchResult[]> {
  const params = new URLSearchParams({ query, profile: "default" });

  const resp = await infobrokerFetch(`${MARGINALIA_URL}?${params.toString()}`, { providerSlug: "marginalia" });

  if (!resp.ok) throw new RetryableError(`Marginalia returned HTTP ${resp.status}`, resp.status);

  const html = await resp.text();
  const $ = cheerio.load(html);

  const raw: Array<Record<string, unknown>> = [];
  $(".result").each((_i, el) => {
    if (raw.length >= 10) return false;
    const title = $(el).find("h2, .title, a").first().text().trim();
    const link = $(el).find("a").first().attr("href") || "";
    const snippet = $(el).find("p, .description, .snippet").first().text().trim();
    if (title) {
      raw.push({ title, url: link.startsWith("/") ? `https://search.marginalia.nu${link}` : link, snippet });
    }
  });

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
