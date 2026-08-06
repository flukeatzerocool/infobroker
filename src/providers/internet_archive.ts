// @implements REQ-020 REQ-021
import type { SearchResult } from "../types.js";
import { normalize } from "../normalizer.js";

const IA_API = "https://archive.org/wayback/available";

export async function internetArchiveFetchPage(url: string): Promise<string> {
  const checkResp = await fetch(`${IA_API}?url=${encodeURIComponent(url)}`, {
    headers: { "User-Agent": "Infobroker/1.0" },
  });

  if (!checkResp.ok) {
    throw new Error(`Internet Archive returned HTTP ${checkResp.status}`);
  }

  const checkData = (await checkResp.json()) as {
    archived_snapshots?: { closest?: { timestamp: string; url: string } };
  };

  const snapshot = checkData.archived_snapshots?.closest;
  if (!snapshot) {
    throw new Error("No archived snapshot available");
  }

  const pageResp = await fetch(snapshot.url, {
    headers: { "User-Agent": "Infobroker/1.0" },
  });

  if (!pageResp.ok) {
    throw new Error(`Internet Archive page fetch returned HTTP ${pageResp.status}`);
  }

  return pageResp.text();
}

export async function internetArchiveSearch(query: string): Promise<SearchResult[]> {
  const checkResp = await fetch(`${IA_API}?url=${encodeURIComponent(query)}`, {
    headers: { "User-Agent": "Infobroker/1.0" },
  });

  if (!checkResp.ok) throw new Error(`Internet Archive returned HTTP ${checkResp.status}`);

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

export async function internetArchiveHealth(): Promise<{
  status: "active" | "degraded" | "inactive";
  avgLatencyMs: number;
}> {
  const start = Date.now();
  try {
    const resp = await fetch(`${IA_API}?url=https://example.com`, {
      headers: { "User-Agent": "Infobroker/1.0" },
      signal: AbortSignal.timeout(10000),
    });
    const elapsed = Date.now() - start;
    if (resp.ok) return { status: "active", avgLatencyMs: elapsed };
    return { status: "degraded", avgLatencyMs: elapsed };
  } catch {
    return { status: "inactive", avgLatencyMs: Date.now() - start };
  }
}
