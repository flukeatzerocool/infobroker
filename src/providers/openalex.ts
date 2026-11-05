// @implements REQ-020 REQ-070 REQ-071
import type { SearchResult, Provider, SearchOptions, DoiRecord } from "../types.js";
import { normalize } from "../normalizer.js";
import { RetryableError } from "../retry.js";
import { infobrokerFetch } from "../http.js";

const OPENALEX_API = "https://api.openalex.org/works";

// OpenAlex stores abstracts as an inverted index (word -> positions). Rebuild
// readable text so a search result can answer without a second provider call.
function reconstructAbstract(index: Record<string, number[]> | undefined | null): string | undefined {
  if (!index) return undefined;
  const words: Array<[number, string]> = [];
  for (const [word, positions] of Object.entries(index)) {
    if (!Array.isArray(positions)) continue;
    for (const position of positions) {
      if (typeof position === "number") words.push([position, word]);
    }
  }
  if (words.length === 0) return undefined;
  words.sort((a, b) => a[0] - b[0]);
  return words.map(([, word]) => word).join(" ");
}

async function search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
  const perPage = Math.min(Math.max(options?.max_results ?? 10, 1), 50);
  const params = new URLSearchParams({ search: query, "per-page": String(perPage) });

  const resp = await infobrokerFetch(`${OPENALEX_API}?${params.toString()}`, {
    providerSlug: "openalex",
  });

  if (!resp.ok) throw new RetryableError(`OpenAlex returned HTTP ${resp.status}`, resp.status);

  const data = (await resp.json()) as {
    results?: Array<{
      display_name?: string;
      id?: string;
      publication_year?: number;
      doi?: string;
      cited_by_count?: number;
      authorships?: Array<{ author?: { display_name?: string } }>;
      primary_location?: { source?: { display_name?: string } };
      abstract_inverted_index?: Record<string, number[]>;
    }>;
  };

  const raw = (data.results || []).map((item) => {
    const abstract = reconstructAbstract(item.abstract_inverted_index)?.slice(0, 500);
    const venue = item.primary_location?.source?.display_name;
    const year = item.publication_year ? String(item.publication_year) : undefined;
    const authors = (item.authorships || [])
      .map((a) => a.author?.display_name || "")
      .filter(Boolean);
    return {
      title: item.display_name || "(untitled)",
      url: item.id || (item.doi ? item.doi : ""),
      snippet: abstract || [venue, year].filter(Boolean).join(" · ") || item.doi || "",
      published_date: year,
      source_type: "academic",
      ...(authors.length > 0 ? { authors } : {}),
      ...(venue ? { venue } : {}),
      ...(item.doi ? { doi: item.doi } : {}),
      ...(abstract ? { abstract } : {}),
      ...(typeof item.cited_by_count === "number" ? { citation_count: item.cited_by_count } : {}),
    };
  });

  return normalize(raw, "openalex");
}

interface OpenAlexWork {
  display_name?: string;
  id?: string;
  publication_year?: number;
  doi?: string;
  cited_by_count?: number;
  authorships?: Array<{ author?: { display_name?: string } }>;
  primary_location?: { source?: { display_name?: string }; landing_page_url?: string; pdf_url?: string };
  best_oa_location?: { landing_page_url?: string; pdf_url?: string };
  open_access?: { is_oa?: boolean; oa_status?: string; oa_url?: string };
  abstract_inverted_index?: Record<string, number[]>;
}

// REQ-021h: resolve a DOI to its bibliographic record and open-access copy.
// The open-access URL is what lets a paywalled publisher page fall through to
// a repository copy instead of an error.
async function lookupDoi(doi: string): Promise<DoiRecord | null> {
  const resp = await infobrokerFetch(`${OPENALEX_API}/https://doi.org/${doi}`, {
    providerSlug: "openalex",
  });
  if (!resp.ok) return null;
  const item = (await resp.json()) as OpenAlexWork;
  if (!item || (!item.display_name && !item.id)) return null;
  const abstract = reconstructAbstract(item.abstract_inverted_index)?.slice(0, 2000);
  const venue = item.primary_location?.source?.display_name;
  const authors = (item.authorships || []).map((a) => a.author?.display_name || "").filter(Boolean);
  const oaUrl =
    item.open_access?.oa_url ||
    item.best_oa_location?.pdf_url ||
    item.best_oa_location?.landing_page_url ||
    item.primary_location?.pdf_url;
  return {
    doi,
    title: item.display_name || "(untitled)",
    url: item.id || `https://doi.org/${doi}`,
    ...(authors.length > 0 ? { authors } : {}),
    ...(venue ? { venue } : {}),
    ...(item.publication_year ? { year: String(item.publication_year) } : {}),
    ...(abstract ? { abstract } : {}),
    ...(typeof item.cited_by_count === "number" ? { citation_count: item.cited_by_count } : {}),
    ...(oaUrl ? { oa_url: oaUrl } : {}),
    ...(item.open_access?.oa_status ? { oa_status: item.open_access.oa_status } : {}),
  };
}

async function health(): Promise<{ status: string; avgLatencyMs: number }> {
  const start = Date.now();
  try {
    const resp = await infobrokerFetch(`${OPENALEX_API}?search=test&per-page=1`, { providerSlug: "openalex" });
    const elapsed = Date.now() - start;
    if (resp.ok) return { status: "active", avgLatencyMs: elapsed };
    return { status: "degraded", avgLatencyMs: elapsed };
  } catch {
    return { status: "inactive", avgLatencyMs: Date.now() - start };
  }
}

export const provider: Provider = {
  slug: "openalex",
  tier: "free_http",
  capabilities: ["academic"],
  search,
  lookupDoi,
  health,
};
