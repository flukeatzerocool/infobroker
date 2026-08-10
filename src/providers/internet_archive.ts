// @implements REQ-020 REQ-021
import type { SearchResult, Provider } from "../types.js";
import { normalize } from "../normalizer.js";
import { RetryableError } from "../retry.js";
import { infobrokerFetch } from "../http.js";

const IA_API = "https://archive.org/wayback/available";

async function fetchPage(url: string): Promise<string> {
  const checkResp = await infobrokerFetch(`${IA_API}?url=${encodeURIComponent(url)}`, { providerSlug: "internet_archive" });

  if (!checkResp.ok) {
    throw new RetryableError(`Internet Archive returned HTTP ${checkResp.status}`, checkResp.status);
  }

  const checkData = (await checkResp.json()) as {
    archived_snapshots?: { closest?: { timestamp: string; url: string } };
  };

  const snapshot = checkData.archived_snapshots?.closest;
  if (!snapshot) {
    throw new Error("No archived snapshot available");
  }

  const pageResp = await infobrokerFetch(snapshot.url, { providerSlug: "internet_archive" });

  if (!pageResp.ok) {
    throw new RetryableError(`Internet Archive page fetch returned HTTP ${pageResp.status}`, pageResp.status);
  }

  return pageResp.text();
}

async function search(query: string): Promise<SearchResult[]> {
  const checkResp = await infobrokerFetch(`${IA_API}?url=${encodeURIComponent(query)}`, { providerSlug: "internet_archive" });

  if (!checkResp.ok) throw new RetryableError(`Internet Archive returned HTTP ${checkResp.status}`, checkResp.status);

  const checkData = (await checkResp.json()) as {
    archived_snapshots?: { closest?: { timestamp: string; url: string } };
  };

  const snapshot = checkData.archived_snapshots?.closest;
  if (!snapshot) return [];

  return normalize(
    [
      {
        title: `Archived: ${query}`,
        url: snapshot.url,
        snippet: `Snapshot from ${snapshot.timestamp}`,
        source_type: "archive",
      },
    ],
    "internet_archive"
  );
}

async function health(): Promise<{ status: string; avgLatencyMs: number }> {
  const start = Date.now();
  try {
    const resp = await infobrokerFetch(`${IA_API}?url=https://example.com`, { providerSlug: "internet_archive" });
    const elapsed = Date.now() - start;
    if (resp.ok) return { status: "active", avgLatencyMs: elapsed };
    return { status: "degraded", avgLatencyMs: elapsed };
  } catch {
    return { status: "inactive", avgLatencyMs: Date.now() - start };
  }
}

export const provider: Provider = {
  slug: "internet_archive",
  tier: "free_http",
  capabilities: ["archive", "content_fetch"],
  search,
  fetchPage,
  health,
};
