// @implements REQ-020
import type { SearchResult, Provider } from "../types.js";
import { normalize } from "../normalizer.js";
import { RetryableError } from "../retry.js";
import { infobrokerFetch } from "../http.js";

const OSM_API = "https://nominatim.openstreetmap.org/search";

async function search(query: string): Promise<SearchResult[]> {
  const params = new URLSearchParams({
    q: query,
    format: "json",
    limit: "10",
  });

  const resp = await infobrokerFetch(`${OSM_API}?${params.toString()}`, { providerSlug: "openstreetmap" });

  if (!resp.ok) throw new RetryableError(`OpenStreetMap returned HTTP ${resp.status}`, resp.status);

  const data = (await resp.json()) as Array<{
    display_name: string;
    lat: string;
    lon: string;
    type: string;
  }>;

  const raw = data.map((item) => ({
    title: item.display_name,
    url: `https://www.openstreetmap.org/?mlat=${item.lat}&mlon=${item.lon}`,
    snippet: `${item.type} at ${item.lat}, ${item.lon}`,
    source_type: "location",
  }));

  return normalize(raw, "openstreetmap");
}

async function health(): Promise<{ status: string; avgLatencyMs: number }> {
  const start = Date.now();
  try {
    const resp = await infobrokerFetch(`${OSM_API}?q=test&format=json&limit=1`, { providerSlug: "openstreetmap" });
    const elapsed = Date.now() - start;
    if (resp.ok) return { status: "active", avgLatencyMs: elapsed };
    return { status: "degraded", avgLatencyMs: elapsed };
  } catch {
    return { status: "inactive", avgLatencyMs: Date.now() - start };
  }
}

export const provider: Provider = {
  slug: "openstreetmap",
  tier: "free_http",
  capabilities: ["web_search"],
  search,
  health,
};
