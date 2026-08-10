// @implements REQ-020 REQ-021
import type { SearchResult, Provider } from "../types.js";
import { normalize } from "../normalizer.js";
import { RetryableError } from "../retry.js";
import { infobrokerFetch } from "../http.js";

const ARXIV_API = "https://export.arxiv.org/api/query";

async function search(query: string): Promise<SearchResult[]> {
  const params = new URLSearchParams({
    search_query: query,
    max_results: "10",
  });

  const resp = await infobrokerFetch(`${ARXIV_API}?${params.toString()}`, { providerSlug: "arxiv" });

  if (!resp.ok) throw new RetryableError(`arXiv returned HTTP ${resp.status}`, resp.status);

  const xml = await resp.text();
  const raw: Array<Record<string, unknown>> = [];
  const entryRe = /<entry>([\s\S]*?)<\/entry>/g;
  let entryMatch: RegExpExecArray | null;
  while ((entryMatch = entryRe.exec(xml)) !== null) {
    const entryXml = entryMatch[1];
    const title = tagContent(entryXml, "title");
    const id = tagContent(entryXml, "id");
    const summary = tagContent(entryXml, "summary");
    const published = tagContent(entryXml, "published");
    if (title && id) {
      raw.push({
        title: title.replace(/\s+/g, " ").trim(),
        url: id,
        snippet: summary.replace(/\s+/g, " ").trim().slice(0, 500),
        published_date: published,
        source_type: "academic",
      });
    }
  }

  return normalize(raw, "arxiv");
}

async function fetchPage(url: string): Promise<string> {
  const id = extractId(url);
  if (!id) throw new Error("Could not extract arXiv ID from URL");

  const params = new URLSearchParams({ id_list: id });
  const resp = await infobrokerFetch(`${ARXIV_API}?${params.toString()}`, { providerSlug: "arxiv" });

  if (!resp.ok) throw new RetryableError(`arXiv returned HTTP ${resp.status}`, resp.status);

  const xml = await resp.text();
  const summary = tagContent(xml, "summary");
  const title = tagContent(xml, "title");
  return title ? `${title}\n\n${summary.replace(/\s+/g, " ").trim()}` : summary.replace(/\s+/g, " ").trim();
}

async function health(): Promise<{ status: string; avgLatencyMs: number }> {
  const start = Date.now();
  try {
    const resp = await infobrokerFetch(`${ARXIV_API}?search_query=test&max_results=1`, { providerSlug: "arxiv" });
    const elapsed = Date.now() - start;
    if (resp.ok) return { status: "active", avgLatencyMs: elapsed };
    return { status: "degraded", avgLatencyMs: elapsed };
  } catch {
    return { status: "inactive", avgLatencyMs: Date.now() - start };
  }
}

function tagContent(xml: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i");
  const m = xml.match(re);
  return m ? (m[1] || "").replace(/<[^>]*>/g, "").trim() : "";
}

function extractId(url: string): string | null {
  const match = url.match(/arxiv\.org\/(?:abs|pdf)\/([^?#]+)/);
  return match ? match[1] : null;
}

export const provider: Provider = {
  slug: "arxiv",
  tier: "free_http",
  capabilities: ["academic", "content_fetch"],
  search,
  fetchPage,
  health,
};
