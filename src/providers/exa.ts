// @implements REQ-020
import type { SearchResult, Provider } from "../types.js";
import { normalize } from "../normalizer.js";
import { RetryableError } from "../retry.js";
import { getEnvVar } from "../config.js";
import { infobrokerFetch } from "../http.js";

const EXA_API = "https://api.exa.ai/search";

let _exaApiKey: string | undefined;
function exaApiKey(): string | undefined {
  if (_exaApiKey === undefined) _exaApiKey = getEnvVar("exa", "_API_KEY");
  return _exaApiKey;
}

async function search(query: string): Promise<SearchResult[]> {
  const apiKey = exaApiKey();
  if (!apiKey) throw new Error("INFOBROKER_EXA_API_KEY not set");

  const resp = await infobrokerFetch(EXA_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({ query, numResults: 10, useAutoprompt: true }),
    providerSlug: "exa",
  });

  if (!resp.ok) throw new RetryableError(`Exa returned HTTP ${resp.status}`, resp.status);

  const data = (await resp.json()) as {
    results?: Array<{ title: string; url: string; text?: string; publishedDate?: string }>;
  };

  const raw = (data.results || []).map((item) => ({
    title: item.title,
    url: item.url,
    snippet: item.text || "",
    published_date: item.publishedDate,
    source_type: "semantic",
  }));

  return normalize(raw, "exa");
}

async function health(): Promise<{ status: string; avgLatencyMs: number }> {
  const apiKey = exaApiKey();
  if (!apiKey) return { status: "inactive", avgLatencyMs: 0 };

  const start = Date.now();
  try {
    const resp = await infobrokerFetch(EXA_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({ query: "test", numResults: 1 }),
      providerSlug: "exa",
    });
    const elapsed = Date.now() - start;
    if (resp.ok) return { status: "active", avgLatencyMs: elapsed };
    return { status: "degraded", avgLatencyMs: elapsed };
  } catch {
    return { status: "inactive", avgLatencyMs: Date.now() - start };
  }
}

export const provider: Provider = {
  slug: "exa",
  tier: "keyed_http",
  capabilities: ["web_search"],
  search,
  health,
};
