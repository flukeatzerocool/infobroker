// @implements REQ-020 REQ-070 REQ-071
import type { SearchResult, Provider } from "../types.js";
import { normalize } from "../normalizer.js";
import { RetryableError } from "../retry.js";
import { infobrokerFetch } from "../http.js";

const SEC_SEARCH_API = "https://efts.sec.gov/LATEST/search-index";

interface EdgarHit {
  _id?: string;
  _source?: {
    display_names?: string[];
    file_date?: string;
    ciks?: string[];
    forms?: string[];
  };
}

async function search(query: string): Promise<SearchResult[]> {
  const params = new URLSearchParams({ q: query, forms: "10-K,10-Q,8-K" });

  const resp = await infobrokerFetch(`${SEC_SEARCH_API}?${params.toString()}`, {
    providerSlug: "sec_edgar",
  });

  if (!resp.ok) throw new RetryableError(`SEC EDGAR returned HTTP ${resp.status}`, resp.status);

  const data = (await resp.json()) as { hits?: { hits?: EdgarHit[] } };

  const raw = (data.hits?.hits || []).map((item) => {
    const src = item._source ?? {};
    const company = src.display_names?.[0] ?? "(untitled)";
    const cik = src.ciks?.[0];
    const url = cik
      ? `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cik}&type=&dateb=&owner=include&count=10`
      : "";
    const form = src.forms?.[0];
    return {
      title: company,
      url,
      snippet: [form, src.file_date].filter(Boolean).join(" · "),
      published_date: src.file_date,
      source_type: "structured_fact",
    };
  });

  return normalize(raw, "sec_edgar");
}

async function health(): Promise<{ status: string; avgLatencyMs: number }> {
  const start = Date.now();
  try {
    const resp = await infobrokerFetch(`${SEC_SEARCH_API}?q=test&forms=10-K`, { providerSlug: "sec_edgar" });
    const elapsed = Date.now() - start;
    if (resp.ok) return { status: "active", avgLatencyMs: elapsed };
    return { status: "degraded", avgLatencyMs: elapsed };
  } catch {
    return { status: "inactive", avgLatencyMs: Date.now() - start };
  }
}

export const provider: Provider = {
  slug: "sec_edgar",
  tier: "free_http",
  capabilities: ["financial"],
  search,
  health,
};
