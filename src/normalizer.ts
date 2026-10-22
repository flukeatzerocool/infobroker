// @implements REQ-003 REQ-073
import type { SearchResult } from "./types.js";

const FIELD_OVERRIDES: Record<string, Record<string, string[]>> = {
  wikipedia: { snippet: ["snippet", "extract", "description"] },
  wikidata: { snippet: ["snippet", "description", "extract"] },
  internet_archive: { snippet: ["snippet", "text", "body", "description"] },
};

// A search result's URL must be absolute: deep reading filters on http(s),
// citations need a scheme, and the KB keys results by source URL. DuckDuckGo
// in particular returns a scheme-less display URL.
export function normalizeUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed);
  const withScheme = trimmed.startsWith("//")
    ? `https:${trimmed}`
    : hasScheme
      ? trimmed
      : `https://${trimmed}`;
  try {
    const parsed = new URL(withScheme);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    // Return the validated input form rather than URL.toString(), which adds a
    // trailing slash to bare hosts and would churn existing citations.
    return hasScheme ? trimmed : withScheme;
  } catch {
    return null;
  }
}

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
  const rawUrl = pickString(raw, ...urlKeys);
  const snippet = pickString(raw, ...snippetKeys);
  const publishedDate = pickString(raw, "published_date", "date", "created", "publishedAt", "timestamp");
  const sourceType = pickString(raw, "source_type", "type", "category");
  const originalSource = pickString(raw, "original_source", "origin", "source");

  const url = rawUrl ? normalizeUrl(rawUrl) : null;
  if (!url) return null;

  const result: SearchResult = {
    title: title || "(untitled)",
    url,
    snippet: snippet || "",
  };

  if (publishedDate) result.published_date = publishedDate;
  if (sourceType) result.source_type = sourceType;
  if (originalSource) result.original_source = originalSource;

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
