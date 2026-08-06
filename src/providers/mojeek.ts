// @implements REQ-020
import * as cheerio from "cheerio";
import type { SearchResult } from "../types.js";
import { normalize } from "../normalizer.js";
import { RetryableError } from "../retry.js";

const MOJEEK_URL = "https://www.mojeek.com/search";

export async function mojeekSearch(query: string): Promise<SearchResult[]> {
  const params = new URLSearchParams({ q: query });

  const resp = await fetch(`${MOJEEK_URL}?${params.toString()}`, {
    headers: { "User-Agent": "Infobroker/1.0" },
  });

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

export async function mojeekHealth(): Promise<{
  status: "active" | "degraded" | "inactive";
  avgLatencyMs: number;
}> {
  const start = Date.now();
  try {
    const resp = await fetch(`${MOJEEK_URL}?q=test`, {
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
