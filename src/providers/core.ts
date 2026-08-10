// @implements REQ-020
import type { SearchResult, Provider } from "../types.js";
import { normalize } from "../normalizer.js";
import { RetryableError } from "../retry.js";
import { getEnvVar } from "../config.js";
import { infobrokerFetch } from "../http.js";

const CORE_API = "https://api.core.ac.uk/v3/search/works";

let _coreApiKey: string | undefined;
function coreApiKey(): string | undefined {
  if (_coreApiKey === undefined) _coreApiKey = getEnvVar("core", "_API_KEY");
  return _coreApiKey;
}

async function search(query: string): Promise<SearchResult[]> {
  const apiKey = coreApiKey();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

  const resp = await infobrokerFetch(CORE_API, {
    method: "POST",
    headers,
    body: JSON.stringify({ q: query, limit: 10 }),
    providerSlug: "core",
  });

  if (!resp.ok) throw new RetryableError(`CORE returned HTTP ${resp.status}`, resp.status);

  const data = (await resp.json()) as {
    results?: Array<{
      title: string;
      downloadUrl?: string;
      links?: Array<{ url: string; type: string }>;
      abstract?: string;
      publishedDate?: string;
    }>;
  };

  const raw = (data.results || []).map((item) => ({
    title: item.title,
    url: item.downloadUrl || item.links?.[0]?.url || "",
    snippet: item.abstract || "",
    published_date: item.publishedDate,
    source_type: "academic",
  }));

  return normalize(raw, "core");
}

async function health(): Promise<{ status: string; avgLatencyMs: number }> {
  const start = Date.now();
  try {
    const resp = await infobrokerFetch(CORE_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ q: "test", limit: 1 }),
      providerSlug: "core",
    });
    const elapsed = Date.now() - start;
    if (resp.ok) return { status: "active", avgLatencyMs: elapsed };
    return { status: "degraded", avgLatencyMs: elapsed };
  } catch {
    return { status: "inactive", avgLatencyMs: Date.now() - start };
  }
}

export const provider: Provider = {
  slug: "core",
  tier: "free_http",
  capabilities: ["academic"],
  search,
  health,
};
