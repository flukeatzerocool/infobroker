// @implements REQ-020
import type { SearchResult } from "../types.js";
import { normalize } from "../normalizer.js";
import { RetryableError } from "../retry.js";
import { getEnvVar } from "../config.js";

const GH_API = "https://api.github.com/search/code";

export async function githubSearch(query: string): Promise<SearchResult[]> {
  const token = getEnvVar("github", "_API_KEY");
  const headers: Record<string, string> = {
    "User-Agent": "Infobroker/1.0",
    "Accept": "application/vnd.github.v3+json",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const params = new URLSearchParams({ q: query, per_page: "10" });
  const resp = await fetch(`${GH_API}?${params.toString()}`, { headers });

  if (!resp.ok) throw new RetryableError(`GitHub returned HTTP ${resp.status}`, resp.status);

  const data = (await resp.json()) as {
    items?: Array<{
      name: string;
      path: string;
      html_url: string;
      repository: { full_name: string; html_url: string };
    }>;
  };

  const raw = (data.items || []).map((item) => ({
    title: `${item.repository.full_name}: ${item.path}`,
    url: item.html_url,
    snippet: `File ${item.name} in ${item.repository.full_name}`,
    source_type: "code",
  }));

  return normalize(raw, "github");
}

export async function githubHealth(): Promise<{
  status: "active" | "degraded" | "inactive";
  avgLatencyMs: number;
}> {
  const start = Date.now();
  try {
    const resp = await fetch(`${GH_API}?q=test&per_page=1`, {
      headers: { "User-Agent": "Infobroker/1.0", "Accept": "application/vnd.github.v3+json" },
      signal: AbortSignal.timeout(10000),
    });
    const elapsed = Date.now() - start;
    if (resp.ok) return { status: "active", avgLatencyMs: elapsed };
    return { status: "degraded", avgLatencyMs: elapsed };
  } catch {
    return { status: "inactive", avgLatencyMs: Date.now() - start };
  }
}
