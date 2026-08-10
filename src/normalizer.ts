// @implements REQ-003 REQ-073
import type { SearchResult } from "./types.js";

const FIELD_OVERRIDES: Record<string, Record<string, string[]>> = {
  wikipedia: { snippet: ["extract", "description"] },
  wikidata: { snippet: ["description", "extract"] },
  internet_archive: { snippet: ["text", "body", "description"] },
};

export function normalize(
  results: Array<Record<string, unknown>>,
  provider: string
): SearchResult[] {
  const overrides = FIELD_OVERRIDES[provider] ?? {};

  return results
    .map((r) => normalizeOne(r, overrides))
    .filter((r): r is SearchResult => r !== null);
}

function normalizeOne(
  raw: Record<string, unknown>,
  overrides: Record<string, string[]>
): SearchResult | null {
  const titleKeys = overrides.title ?? ["title", "name", "label", "display_name"];
  const urlKeys = overrides.url ?? ["url", "link", "href", "source_url"];
  const snippetKeys = overrides.snippet ?? ["snippet", "description", "extract", "summary", "content"];

  const title = pickString(raw, ...titleKeys);
  const url = pickString(raw, ...urlKeys);
  const snippet = pickString(raw, ...snippetKeys);
  const publishedDate = pickString(raw, "published_date", "date", "created", "publishedAt", "timestamp");
  const sourceType = pickString(raw, "source_type", "type", "category");

  if (!url) return null;

  const result: SearchResult = {
    title: title || "(untitled)",
    url,
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
    if (val && typeof val === "object" && !Array.isArray(val)) {
      const nested = (val as Record<string, unknown>);
      for (const subKey of ["rendered", "text", "value", "content", "title"]) {
        const subVal = nested[subKey];
        if (typeof subVal === "string" && subVal.length > 0) return subVal;
      }
    }
  }
  return undefined;
}
