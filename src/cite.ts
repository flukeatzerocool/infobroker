// @implements REQ-027
import { infobrokerFetch } from "./http.js";
import { getEnvVar } from "./config.js";
import { citationFor } from "./bibtex.js";

export interface CitationResult {
  title: string;
  url: string;
  year?: string;
  authors: string[];
  venue?: string;
  bibtex: string;
}

const ARXIV_API = "https://export.arxiv.org/api/query";
const SS_API = "https://api.semanticscholar.org/graph/v1/paper/search";

function tagContent(xml: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i");
  const m = xml.match(re);
  return m ? (m[1] || "").replace(/<[^>]*>/g, "").trim() : "";
}

async function searchArxiv(query: string, limit: number): Promise<CitationResult[]> {
  const params = new URLSearchParams({ search_query: query, max_results: String(limit) });
  const resp = await infobrokerFetch(`${ARXIV_API}?${params.toString()}`, { providerSlug: "arxiv" });
  if (!resp.ok) return [];
  const xml = await resp.text();

  const out: CitationResult[] = [];
  const entryRe = /<entry>([\s\S]*?)<\/entry>/g;
  let m: RegExpExecArray | null;
  while ((m = entryRe.exec(xml)) !== null) {
    const entry = m[1];
    const title = tagContent(entry, "title");
    const id = tagContent(entry, "id");
    const published = tagContent(entry, "published");
    const year = published.slice(0, 4);
    const authors = [...entry.matchAll(/<name>([\s\S]*?)<\/name>/g)].map((a) => a[1].trim()).filter(Boolean);
    if (!title || !id) continue;
    out.push({
      title,
      url: id,
      year,
      authors,
      venue: "arXiv",
      bibtex: citationFor(title, authors, year, "arXiv", id),
    });
  }
  return out;
}

async function searchSemanticScholar(query: string, limit: number): Promise<CitationResult[]> {
  const fields = ["title", "authors", "year", "venue", "externalIds", "url"].join(",");
  const params = new URLSearchParams({ query, limit: String(limit), fields });
  const headers: Record<string, string> = {};
  const key = getEnvVar("semantic_scholar", "_API_KEY");
  if (key) headers["x-api-key"] = key;
  const resp = await infobrokerFetch(`${SS_API}?${params.toString()}`, { providerSlug: "semantic_scholar", headers });
  if (!resp.ok) return [];
  const data = (await resp.json()) as {
    data?: Array<{ title: string; year?: number; venue?: string; url?: string; authors?: Array<{ name: string }> }>;
  };

  return (data.data || []).map((item) => {
    const year = item.year ? String(item.year) : undefined;
    const authors = (item.authors || []).map((a) => a.name);
    return {
      title: item.title,
      url: item.url || `https://api.semanticscholar.org/paper/${item.title}`,
      year,
      authors,
      venue: item.venue,
      bibtex: citationFor(item.title, authors, year, item.venue, undefined),
    };
  });
}

export async function searchCitations(query: string, limit = 8, source?: string): Promise<CitationResult[]> {
  const results: CitationResult[] = [];
  const wanted = source ? [source] : ["arxiv", "semantic_scholar"];
  for (const s of wanted) {
    if (results.length >= limit) break;
    try {
      const batch = s === "arxiv" ? await searchArxiv(query, limit) : await searchSemanticScholar(query, limit);
      for (const r of batch) {
        if (results.length >= limit) break;
        results.push(r);
      }
    } catch {
      // source unavailable — continue to the next
    }
  }
  return results;
}
