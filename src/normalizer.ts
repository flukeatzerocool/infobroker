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
  // REQ-003: scholarly metadata is additive — copy it only when the provider
  // supplied it so non-academic results keep their existing shape.
  const doi = pickString(raw, "doi", "DOI");
  const venue = pickString(raw, "venue", "journal", "container_title");
  const abstract = pickString(raw, "abstract", "abstract_text");
  const authors = Array.isArray(raw.authors)
    ? raw.authors.filter((a): a is string => typeof a === "string" && a.trim().length > 0)
    : undefined;
  const citationCount =
    typeof raw.citation_count === "number" && Number.isFinite(raw.citation_count)
      ? raw.citation_count
      : undefined;

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
  if (doi) result.doi = doi;
  if (authors && authors.length > 0) result.authors = authors;
  if (venue) result.venue = venue;
  if (abstract) result.abstract = abstract;
  if (citationCount !== undefined) result.citation_count = citationCount;

  // REQ-021i: pass a provider-attached structured fact through unchanged. The
  // fact is additive and never replaces the snippet.
  const fact = raw.fact;
  if (fact && typeof fact === "object" && !Array.isArray(fact)) {
    const candidate = fact as Record<string, unknown>;
    if (
      typeof candidate.kind === "string" &&
      (typeof candidate.value === "number" || typeof candidate.value === "string") &&
      typeof candidate.display === "string" &&
      typeof candidate.source === "string" &&
      typeof candidate.url === "string"
    ) {
      result.fact = candidate as unknown as SearchResult["fact"];
    }
  }

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
