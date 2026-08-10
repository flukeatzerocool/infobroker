// @implements REQ-020
import type { SearchResult, Provider } from "../types.js";
import { normalize } from "../normalizer.js";
import { RetryableError } from "../retry.js";
import { getEnvVar } from "../config.js";
import { infobrokerFetch } from "../http.js";

const TAVILY_API = "https://api.tavily.com/search";

let _tavilyApiKey: string | undefined;
function tavilyApiKey(): string | undefined {
  if (_tavilyApiKey === undefined) _tavilyApiKey = getEnvVar("tavily", "_API_KEY");
  return _tavilyApiKey;
}

async function search(query: string): Promise<SearchResult[]> {
  const apiKey = tavilyApiKey();
  if (!apiKey) throw new Error("INFOBROKER_TAVILY_API_KEY not set");

  const resp = await infobrokerFetch(TAVILY_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ api_key: apiKey, query, max_results: 10, include_answer: false }),
    providerSlug: "tavily",
  });

  if (!resp.ok) throw new RetryableError(`Tavily returned HTTP ${resp.status}`, resp.status);

  const data = (await resp.json()) as {
    results?: Array<{ title: string; url: string; content: string; published_date?: string }>;
  };

  const raw = (data.results || []).map((item) => ({
    title: item.title,
    url: item.url,
    snippet: item.content,
    published_date: item.published_date,
    source_type: "synthesis",
  }));

  return normalize(raw, "tavily");
}

async function health(): Promise<{ status: string; avgLatencyMs: number }> {
  const apiKey = tavilyApiKey();
  if (!apiKey) return { status: "inactive", avgLatencyMs: 0 };

  const start = Date.now();
  try {
    const resp = await infobrokerFetch(TAVILY_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ api_key: apiKey, query: "test", max_results: 1 }),
      providerSlug: "tavily",
    });
    const elapsed = Date.now() - start;
    if (resp.ok) return { status: "active", avgLatencyMs: elapsed };
    return { status: "degraded", avgLatencyMs: elapsed };
  } catch {
    return { status: "inactive", avgLatencyMs: Date.now() - start };
  }
}

export const provider: Provider = {
  slug: "tavily",
  tier: "keyed_http",
  capabilities: ["web_search"],
  search,
  health,
};
