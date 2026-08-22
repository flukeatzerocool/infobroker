// @implements REQ-020
import type { SearchResult, SearchOptions, Provider } from "../types.js";
import { normalize } from "../normalizer.js";
import { RetryableError } from "../retry.js";
import { getEnvVar } from "../config.js";
import { infobrokerFetch } from "../http.js";

const YEP_API = "https://platform.yep.com/api/search";

let _yepApiKey: string | undefined;
function yepApiKey(): string | undefined {
  if (_yepApiKey === undefined) _yepApiKey = getEnvVar("yep", "_API_KEY");
  return _yepApiKey;
}

async function search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
  const apiKey = yepApiKey();
  if (!apiKey) throw new Error("INFOBROKER_YEP_API_KEY not set");

  const body: Record<string, unknown> = {
    query,
    type: "highlights",
    limit: options?.max_results ?? 10,
  };
  if (options?.region) body.location = options.region;
  if (options?.safe_search === "strict") body.safe_search = true;
  if (options?.content_type && options.content_type !== "all") {
    body.content_type = mapContentType(options.content_type);
  }
  if (options?.time_range) {
    body.start_published_date = mapTimeRange(options.time_range);
  }

  const resp = await infobrokerFetch(YEP_API, {
    providerSlug: "yep",
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (resp.status === 402) throw new RetryableError("Yep returned HTTP 402 (insufficient balance)", 402);
  if (!resp.ok) throw new RetryableError(`Yep returned HTTP ${resp.status}`, resp.status);

  const data = (await resp.json()) as {
    results?: Array<{ title?: string; url?: string; description?: string; highlights?: string[]; published_date?: string }>;
  };

  const raw = (data.results || []).map((item) => ({
    title: item.title,
    url: item.url,
    snippet: item.description || item.highlights?.join(" ") || "",
    published_date: item.published_date,
    source_type: "web_search",
  }));

  return normalize(raw, "yep");
}

async function health(): Promise<{ status: string; avgLatencyMs: number }> {
  const apiKey = yepApiKey();
  if (!apiKey) return { status: "inactive", avgLatencyMs: 0 };

  const start = Date.now();
  try {
    const resp = await infobrokerFetch(YEP_API, {
      providerSlug: "yep",
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: "test", type: "basic", limit: 1 }),
    });
    const elapsed = Date.now() - start;
    if (resp.ok) return { status: "active", avgLatencyMs: elapsed };
    return { status: "degraded", avgLatencyMs: elapsed };
  } catch {
    return { status: "inactive", avgLatencyMs: Date.now() - start };
  }
}

const YEP_CONTENT_TYPES: Record<string, string> = {
  docs: "Document",
  blog: "Article",
  issue: "User_Generated_Content",
  spec: "Document",
  changelog: "Article",
};

function mapContentType(ct: string): string {
  return YEP_CONTENT_TYPES[ct] ?? "Article";
}

function mapTimeRange(range: string): string {
  const map: Record<string, string> = {
    day: new Date(Date.now() - 86400000).toISOString().slice(0, 10),
    week: new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10),
    month: new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),
    year: new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10),
  };
  return map[range] || "";
}

export const provider: Provider = {
  slug: "yep",
  tier: "keyed_http",
  capabilities: ["web_search", "semantic", "synthesis"],
  search,
  health,
};
