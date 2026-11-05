// @implements REQ-020 REQ-070 REQ-071
import type { SearchResult, Provider, SearchOptions, DoiRecord } from "../types.js";
import { normalize } from "../normalizer.js";
import { RetryableError } from "../retry.js";
import { infobrokerFetch } from "../http.js";

const CROSSREF_API = "https://api.crossref.org/works";

// Bound the payload: only the fields the citation pipeline consumes.
const SELECT_FIELDS = [
  "DOI",
  "title",
  "author",
  "issued",
  "container-title",
  "abstract",
  "is-referenced-by-count",
  "URL",
].join(",");

interface CrossrefItem {
  DOI?: string;
  title?: string[];
  author?: Array<{ given?: string; family?: string; name?: string }>;
  issued?: { "date-parts"?: Array<Array<number | null>> };
  "container-title"?: string[];
  abstract?: string;
  "is-referenced-by-count"?: number;
  URL?: string;
}

// Crossref abstracts (and some titles) are JATS XML fragments with entities.
function decodeEntities(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_m, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_m, code: string) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&amp;/g, "&");
}

function plainText(text: string | undefined): string | undefined {
  if (!text) return undefined;
  const stripped = decodeEntities(text.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
  return stripped || undefined;
}

function authorName(author: { given?: string; family?: string; name?: string }): string {
  if (author.name) return author.name;
  return [author.given, author.family].filter(Boolean).join(" ").trim();
}

function toRecord(item: CrossrefItem): DoiRecord | null {
  const doi = item.DOI?.trim();
  if (!doi) return null;
  const year = item.issued?.["date-parts"]?.[0]?.[0];
  const venue = item["container-title"]?.[0];
  const abstract = plainText(item.abstract)?.slice(0, 2000);
  const authors = (item.author || []).map(authorName).filter(Boolean);
  return {
    doi,
    title: plainText(item.title?.[0]) || "(untitled)",
    url: item.URL || `https://doi.org/${doi}`,
    ...(authors.length > 0 ? { authors } : {}),
    ...(venue ? { venue } : {}),
    ...(year ? { year: String(year) } : {}),
    ...(abstract ? { abstract } : {}),
    ...(typeof item["is-referenced-by-count"] === "number"
      ? { citation_count: item["is-referenced-by-count"] }
      : {}),
  };
}

async function search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
  const rows = Math.min(Math.max(options?.max_results ?? 10, 1), 50);
  const params = new URLSearchParams({ query, rows: String(rows), select: SELECT_FIELDS });

  const resp = await infobrokerFetch(`${CROSSREF_API}?${params.toString()}`, {
    providerSlug: "crossref",
  });

  if (!resp.ok) throw new RetryableError(`Crossref returned HTTP ${resp.status}`, resp.status);

  const data = (await resp.json()) as { message?: { items?: CrossrefItem[] } };

  const raw = (data.message?.items || []).flatMap((item) => {
    const record = toRecord(item);
    if (!record) return [];
    return [
      {
        title: record.title,
        url: record.url,
        snippet:
          record.abstract?.slice(0, 500) ||
          [record.venue, record.year].filter(Boolean).join(" · ") ||
          record.doi,
        published_date: record.year,
        source_type: "academic",
        ...(record.authors ? { authors: record.authors } : {}),
        ...(record.venue ? { venue: record.venue } : {}),
        doi: record.doi,
        ...(record.abstract ? { abstract: record.abstract } : {}),
        ...(record.citation_count !== undefined ? { citation_count: record.citation_count } : {}),
      },
    ];
  });

  return normalize(raw, "crossref");
}

// REQ-021h: resolve a single DOI's bibliographic record. Returns null when
// Crossref does not know the DOI, so the caller can try an open-access copy.
async function lookupDoi(doi: string): Promise<DoiRecord | null> {
  const resp = await infobrokerFetch(`${CROSSREF_API}/${encodeURIComponent(doi)}`, {
    providerSlug: "crossref",
  });
  if (!resp.ok) return null;
  const data = (await resp.json()) as { message?: CrossrefItem };
  return data.message ? toRecord(data.message) : null;
}

async function health(): Promise<{ status: string; avgLatencyMs: number }> {
  const start = Date.now();
  try {
    const resp = await infobrokerFetch(`${CROSSREF_API}?query=test&rows=1`, { providerSlug: "crossref" });
    const elapsed = Date.now() - start;
    if (resp.ok) return { status: "active", avgLatencyMs: elapsed };
    return { status: "degraded", avgLatencyMs: elapsed };
  } catch {
    return { status: "inactive", avgLatencyMs: Date.now() - start };
  }
}

export const provider: Provider = {
  slug: "crossref",
  tier: "free_http",
  capabilities: ["academic"],
  search,
  lookupDoi,
  health,
};
