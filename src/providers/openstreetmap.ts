import type { SearchResult } from "../types.js";
import { normalize } from "../normalizer.js";

const OSM_API = "https://nominatim.openstreetmap.org/search";

export async function openstreetmapSearch(query: string): Promise<SearchResult[]> {
  const params = new URLSearchParams({
    q: query,
    format: "json",
    limit: "10",
  });

  const resp = await fetch(`${OSM_API}?${params.toString()}`, {
    headers: { "User-Agent": "Infobroker/1.0 (MCP search server)" },
  });

  if (!resp.ok) throw new Error(`OpenStreetMap returned HTTP ${resp.status}`);

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

export async function openstreetmapHealth(): Promise<{
  status: "active" | "degraded" | "inactive";
  avgLatencyMs: number;
}> {
  const start = Date.now();
  try {
    const resp = await fetch(`${OSM_API}?q=test&format=json&limit=1`, {
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
