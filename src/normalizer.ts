// @implements REQ-003
import type { SearchResult } from "./types.js";

export function normalize(
  results: Array<Record<string, unknown>>,
  provider: string
): SearchResult[] {
  return results.map((r) => normalizeOne(r, provider));
}

function normalizeOne(raw: Record<string, unknown>, _provider: string): SearchResult {
  const title = pickString(raw, "title", "name", "label", "display_name");
  const url = pickString(raw, "url", "link", "href", "source_url");
  const snippet = pickString(raw, "snippet", "description", "extract", "summary", "content");
  const publishedDate = pickString(raw, "published_date", "date", "created", "publishedAt", "timestamp");
  const sourceType = pickString(raw, "source_type", "type", "category");

  const result: SearchResult = {
    title: title || "(untitled)",
    url: url || "",
    snippet: snippet || "",
  };

  if (publishedDate) result.published_date = publishedDate;
  if (sourceType) result.source_type = sourceType;

  return result;
}

function pickString(obj: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const val = obj[key];
    if (typeof val === "string" && val.length > 0) return val;
  }
  return undefined;
}
