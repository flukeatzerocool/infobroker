// @implements REQ-020
import * as cheerio from "cheerio";
import type { SearchResult } from "../types.js";
import { normalize } from "../normalizer.js";
import { RetryableError } from "../retry.js";

const MARGINALIA_URL = "https://search.marginalia.nu/search";

export async function marginaliaSearch(query: string): Promise<SearchResult[]> {
  const params = new URLSearchParams({ query, profile: "default" });

  const resp = await fetch(`${MARGINALIA_URL}?${params.toString()}`, {
    headers: { "User-Agent": "Infobroker/1.0" },
  });

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

export async function marginaliaHealth(): Promise<{
  status: "active" | "degraded" | "inactive";
  avgLatencyMs: number;
}> {
  const start = Date.now();
  try {
    const resp = await fetch(`${MARGINALIA_URL}?query=test&profile=default`, {
      headers: { "User-Agent": "Infobroker/1.0" },
      signal: AbortSignal.timeout(15000),
    });
    const elapsed = Date.now() - start;
    if (resp.ok) return { status: "active", avgLatencyMs: elapsed };
    return { status: "degraded", avgLatencyMs: elapsed };
  } catch {
    return { status: "inactive", avgLatencyMs: Date.now() - start };
  }
}
