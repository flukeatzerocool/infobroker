// @implements REQ-020
import type { SearchResult } from "../types.js";
import { normalize } from "../normalizer.js";
import { RetryableError } from "../retry.js";

const ARXIV_API = "https://export.arxiv.org/api/query";

export async function arxivSearch(query: string): Promise<SearchResult[]> {
  const params = new URLSearchParams({
    search_query: query,
    max_results: "10",
  });

  const resp = await fetch(`${ARXIV_API}?${params.toString()}`, {
    headers: { "User-Agent": "Infobroker/1.0" },
  });

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

export async function arxivHealth(): Promise<{
  status: "active" | "degraded" | "inactive";
  avgLatencyMs: number;
}> {
  const start = Date.now();
  try {
    const resp = await fetch(`${ARXIV_API}?search_query=test&max_results=1`, {
      headers: { "User-Agent": "Infobroker/1.0" },
      signal: AbortSignal.timeout(10000),
    });
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
