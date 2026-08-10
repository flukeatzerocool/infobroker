// @implements REQ-020 REQ-021
import type { SearchResult, Provider } from "../types.js";
import { normalize } from "../normalizer.js";
import { RetryableError } from "../retry.js";
import { getEnvVar } from "../config.js";
import { infobrokerFetch } from "../http.js";
import { stripHtml } from "../lib/html.js";

const SE_API = "https://api.stackexchange.com/2.3/search/advanced";

let _seApiKey: string | undefined;
function seApiKey(): string | undefined {
  if (_seApiKey === undefined) _seApiKey = getEnvVar("stack_exchange", "_API_KEY");
  return _seApiKey;
}

async function search(query: string): Promise<SearchResult[]> {
  const params = new URLSearchParams({
    q: query,
    site: "stackoverflow",
    pagesize: "10",
    order: "desc",
    sort: "relevance",
    filter: "withbody",
  });
  const key = seApiKey();
  if (key) params.set("key", key);

  const resp = await infobrokerFetch(`${SE_API}?${params.toString()}`, { providerSlug: "stack_exchange" });

  if (!resp.ok) throw new RetryableError(`Stack Exchange returned HTTP ${resp.status}`, resp.status);

  const data = (await resp.json()) as {
    items?: Array<{ title: string; link: string; body?: string; creation_date: number }>;
  };

  const raw = (data.items || []).map((item) => ({
    title: stripHtml(item.title),
    url: item.link,
    snippet: stripHtml(item.body || "").slice(0, 500),
    published_date: item.creation_date ? new Date(item.creation_date * 1000).toISOString() : undefined,
    source_type: "code",
  }));

  return normalize(raw, "stack_exchange");
}

async function fetchPage(url: string): Promise<string> {
  const id = extractQuestionId(url);
  if (!id) throw new Error("Could not extract Stack Exchange question ID from URL");

  const params = new URLSearchParams({
    site: "stackoverflow",
    filter: "withbody",
  });
  const key = seApiKey();
  if (key) params.set("key", key);

  const answersUrl = `https://api.stackexchange.com/2.3/questions/${id}/answers?${params.toString()}`;
  const resp = await infobrokerFetch(answersUrl, { providerSlug: "stack_exchange" });

  if (!resp.ok) throw new RetryableError(`Stack Exchange returned HTTP ${resp.status}`, resp.status);

  const data = (await resp.json()) as {
    items?: Array<{ body?: string; score: number }>;
  };

  const sorted = (data.items || []).sort((a, b) => b.score - a.score);
  const topAnswers = sorted.slice(0, 3);
  return topAnswers.map((a) => stripHtml(a.body || "").slice(0, 2000)).join("\n\n---\n\n");
}

async function health(): Promise<{ status: string; avgLatencyMs: number }> {
  const start = Date.now();
  try {
    const resp = await infobrokerFetch(`${SE_API}?q=test&site=stackoverflow&pagesize=1`, { providerSlug: "stack_exchange" });
    const elapsed = Date.now() - start;
    if (resp.ok) return { status: "active", avgLatencyMs: elapsed };
    return { status: "degraded", avgLatencyMs: elapsed };
  } catch {
    return { status: "inactive", avgLatencyMs: Date.now() - start };
  }
}

function extractQuestionId(url: string): string | null {
  const match = url.match(/\/(?:questions|q)\/(\d+)/);
  return match ? match[1] : null;
}

export const provider: Provider = {
  slug: "stack_exchange",
  tier: "free_http",
  capabilities: ["code", "content_fetch"],
  search,
  fetchPage,
  health,
};
