// @implements REQ-020
import * as cheerio from "cheerio";
import type { SearchResult, Provider } from "../types.js";
import { normalize } from "../normalizer.js";
import { RetryableError } from "../retry.js";
import { infobrokerFetch } from "../http.js";

const WIBY_URL = "https://wiby.me/";

async function search(query: string): Promise<SearchResult[]> {
  const resp = await infobrokerFetch(`${WIBY_URL}?q=${encodeURIComponent(query)}`, { providerSlug: "wiby" });

  if (!resp.ok) throw new RetryableError(`Wiby returned HTTP ${resp.status}`, resp.status);

  const html = await resp.text();
  const $ = cheerio.load(html);

  const raw: Array<Record<string, unknown>> = [];
  $("a[rel='noopener']").each((_i, el) => {
    if (raw.length >= 10) return false;
    const link = $(el).attr("href") || "";
    const title = $(el).text().trim();
    const snippet = "";
    if (title && link) {
      raw.push({ title, url: link, snippet });
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
