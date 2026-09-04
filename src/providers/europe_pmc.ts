// @implements REQ-020 REQ-070 REQ-071
import type { SearchResult, Provider } from "../types.js";
import { normalize } from "../normalizer.js";
import { RetryableError } from "../retry.js";
import { infobrokerFetch } from "../http.js";

const EPMC_API = "https://www.ebi.ac.uk/europepmc/webservices/rest/search";

async function search(query: string): Promise<SearchResult[]> {
  const params = new URLSearchParams({
    query,
    format: "json",
    resultType: "lite",
    pageSize: "10",
  });

  const resp = await infobrokerFetch(`${EPMC_API}?${params.toString()}`, {
    providerSlug: "europe_pmc",
  });

  if (!resp.ok) throw new RetryableError(`Europe PMC returned HTTP ${resp.status}`, resp.status);

  const data = (await resp.json()) as {
    resultList?: {
      result?: Array<{
        title?: string;
        pmid?: string;
        source?: string;
        id?: string;
        authorString?: string;
        pubYear?: string;
      }>;
    };
  };

  const raw = (data.resultList?.result || []).map((item) => {
    const articleId = item.source && item.id ? `https://europepmc.org/article/${item.source}/${item.id}` : "";
    return {
      title: item.title || "(untitled)",
      url: item.pmid ? `https://europepmc.org/article/MED/${item.pmid}` : articleId,
      snippet: [item.authorString, item.pubYear].filter(Boolean).join(", "),
      published_date: item.pubYear,
      source_type: "academic",
    };
  });

  return normalize(raw, "europe_pmc");
}

async function health(): Promise<{ status: string; avgLatencyMs: number }> {
  const start = Date.now();
  try {
    const resp = await infobrokerFetch(`${EPMC_API}?query=test&format=json&resultType=lite&pageSize=1`, {
      providerSlug: "europe_pmc",
    });
    const elapsed = Date.now() - start;
    if (resp.ok) return { status: "active", avgLatencyMs: elapsed };
    return { status: "degraded", avgLatencyMs: elapsed };
  } catch {
    return { status: "inactive", avgLatencyMs: Date.now() - start };
  }
}

export const provider: Provider = {
  slug: "europe_pmc",
  tier: "free_http",
  capabilities: ["academic"],
  search,
  health,
};
