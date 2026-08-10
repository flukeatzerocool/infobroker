// @implements REQ-020
import type { SearchResult, Provider } from "../types.js";
import { normalize } from "../normalizer.js";
import { RetryableError } from "../retry.js";
import { getEnvVar } from "../config.js";
import { infobrokerFetch } from "../http.js";

const SS_API = "https://api.semanticscholar.org/graph/v1/paper/search";

let _ssApiKey: string | undefined;
function ssApiKey(): string | undefined {
  if (_ssApiKey === undefined) _ssApiKey = getEnvVar("semantic_scholar", "_API_KEY");
  return _ssApiKey;
}

async function search(query: string): Promise<SearchResult[]> {
  const params = new URLSearchParams({ query, limit: "10" });

  const headers: Record<string, string> = {};
  const key = ssApiKey();
  if (key) headers["x-api-key"] = key;

  const resp = await infobrokerFetch(`${SS_API}?${params.toString()}`, {
    providerSlug: "semantic_scholar",
    headers,
  });

  if (!resp.ok) throw new RetryableError(`Semantic Scholar returned HTTP ${resp.status}`, resp.status);

  const data = (await resp.json()) as {
    data?: Array<{ title: string; paperId: string; abstract?: string; year?: number }>;
  };

  const raw = (data.data || []).map((item) => ({
    title: item.title,
    url: `https://api.semanticscholar.org/${item.paperId}`,
    snippet: item.abstract || "",
    published_date: item.year ? String(item.year) : undefined,
    source_type: "academic",
  }));

  return normalize(raw, "semantic_scholar");
}

async function health(): Promise<{ status: string; avgLatencyMs: number }> {
  const start = Date.now();
  try {
    const resp = await infobrokerFetch(`${SS_API}?query=test&limit=1`, { providerSlug: "semantic_scholar" });
    const elapsed = Date.now() - start;
    if (resp.ok) return { status: "active", avgLatencyMs: elapsed };
    return { status: "degraded", avgLatencyMs: elapsed };
  } catch {
    return { status: "inactive", avgLatencyMs: Date.now() - start };
  }
}

export const provider: Provider = {
  slug: "semantic_scholar",
  tier: "free_http",
  capabilities: ["academic"],
  search,
  health,
};
