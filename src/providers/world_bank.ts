// @implements REQ-020 REQ-070 REQ-071
import type { SearchResult, Provider } from "../types.js";
import { normalize } from "../normalizer.js";
import { RetryableError } from "../retry.js";
import { infobrokerFetch } from "../http.js";

const WORLD_BANK_SEARCH_API = "https://search.worldbank.org/api/v2/wds";

async function search(query: string): Promise<SearchResult[]> {
  const params = new URLSearchParams({ format: "json", qterm: query, rows: "10" });

  const resp = await infobrokerFetch(`${WORLD_BANK_SEARCH_API}?${params.toString()}`, {
    providerSlug: "world_bank",
  });

  if (!resp.ok) throw new RetryableError(`World Bank returned HTTP ${resp.status}`, resp.status);

  const data = (await resp.json()) as {
    documents?: {
      documents?: Array<{ title?: string; url?: string; docdt?: string }>;
    };
  };

  const raw = (data.documents?.documents || []).map((item) => ({
    title: item.title || "(untitled)",
    url: item.url || "",
    snippet: item.docdt ? `published ${item.docdt.slice(0, 10)}` : "",
    published_date: item.docdt ? item.docdt.slice(0, 10) : undefined,
    source_type: "structured_fact",
  }));

  return normalize(raw, "world_bank");
}

async function health(): Promise<{ status: string; avgLatencyMs: number }> {
  const start = Date.now();
  try {
    const resp = await infobrokerFetch(`${WORLD_BANK_SEARCH_API}?format=json&qterm=test&rows=1`, {
      providerSlug: "world_bank",
    });
    const elapsed = Date.now() - start;
    if (resp.ok) return { status: "active", avgLatencyMs: elapsed };
    return { status: "degraded", avgLatencyMs: elapsed };
  } catch {
    return { status: "inactive", avgLatencyMs: Date.now() - start };
  }
}

export const provider: Provider = {
  slug: "world_bank",
  tier: "free_http",
  capabilities: ["financial"],
  search,
  health,
};
