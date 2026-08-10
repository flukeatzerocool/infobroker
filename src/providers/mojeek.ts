// @implements REQ-020
import * as cheerio from "cheerio";
import type { SearchResult, Provider } from "../types.js";
import { normalize } from "../normalizer.js";
import { RetryableError } from "../retry.js";
import { infobrokerFetch } from "../http.js";

const MOJEEK_URL = "https://www.mojeek.com/search";

async function search(query: string): Promise<SearchResult[]> {
  const params = new URLSearchParams({ q: query });

  const resp = await infobrokerFetch(`${MOJEEK_URL}?${params.toString()}`, { providerSlug: "mojeek" });

  if (!resp.ok) throw new RetryableError(`Mojeek returned HTTP ${resp.status}`, resp.status);

  const html = await resp.text();
  const $ = cheerio.load(html);

  const raw: Array<Record<string, unknown>> = [];
  $(".results .result").each((_i, el) => {
    if (raw.length >= 10) return false;
    const title = $(el).find("h2 a, .title a").first().text().trim();
    const link = $(el).find("h2 a, .title a").first().attr("href") || "";
    const snippet = $(el).find(".snippet, .description, p").first().text().trim();
    if (title) {
      raw.push({ title, url: link, snippet });
    }
  });

  return normalize(raw, "mojeek");
}

async function health(): Promise<{ status: string; avgLatencyMs: number }> {
  const start = Date.now();
  try {
    const resp = await infobrokerFetch(`${MOJEEK_URL}?q=test`, { providerSlug: "mojeek" });
    const elapsed = Date.now() - start;
    if (resp.ok) return { status: "active", avgLatencyMs: elapsed };
    return { status: "degraded", avgLatencyMs: elapsed };
  } catch {
    return { status: "inactive", avgLatencyMs: Date.now() - start };
  }
}

export const provider: Provider = {
  slug: "mojeek",
  tier: "builtin",
  capabilities: ["web_search"],
  search,
  health,
};
