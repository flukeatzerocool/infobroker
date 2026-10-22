// @implements REQ-020
import type { SearchResult, Provider } from "../types.js";
import { normalize } from "../normalizer.js";
import { RetryableError } from "../retry.js";
import { getEnvVar } from "../config.js";
import { infobrokerFetch } from "../http.js";

const GH_CODE_API = "https://api.github.com/search/code";
const GH_REPO_API = "https://api.github.com/search/repositories";

let _ghToken: string | undefined;
function ghToken(): string | undefined {
  if (_ghToken === undefined) _ghToken = getEnvVar("github", "_API_KEY");
  return _ghToken;
}

async function search(query: string): Promise<SearchResult[]> {
  const token = ghToken();
  const headers: Record<string, string> = {
    "Accept": "application/vnd.github.v3+json",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  // Code search requires authentication. Without a token, fall back to the
  // keyless repository search instead of advertising a capability that 401s.
  const endpoint = token ? GH_CODE_API : GH_REPO_API;
  const params = new URLSearchParams({ q: query, per_page: "10" });
  const resp = await infobrokerFetch(`${endpoint}?${params.toString()}`, {
    providerSlug: "github",
    headers,
  });

  if (!resp.ok) throw new RetryableError(`GitHub returned HTTP ${resp.status}`, resp.status);

  if (!token) {
    const data = (await resp.json()) as {
      items?: Array<{ full_name: string; html_url: string; description?: string | null }>;
    };
    const raw = (data.items || []).map((item) => ({
      title: item.full_name,
      url: item.html_url,
      snippet: item.description || `Repository ${item.full_name}`,
      source_type: "code",
    }));
    return normalize(raw, "github");
  }

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

async function health(): Promise<{ status: string; avgLatencyMs: number }> {
  const start = Date.now();
  try {
    const token = ghToken();
    const endpoint = token ? GH_CODE_API : GH_REPO_API;
    const headers: Record<string, string> = { "Accept": "application/vnd.github.v3+json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const resp = await infobrokerFetch(`${endpoint}?q=test&per_page=1`, {
      providerSlug: "github",
      headers,
    });
    const elapsed = Date.now() - start;
    if (resp.ok) return { status: "active", avgLatencyMs: elapsed };
    return { status: "degraded", avgLatencyMs: elapsed };
  } catch {
    return { status: "inactive", avgLatencyMs: Date.now() - start };
  }
}

export const provider: Provider = {
  slug: "github",
  tier: "free_http",
  capabilities: ["code"],
  search,
  health,
};
