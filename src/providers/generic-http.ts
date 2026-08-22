// @implements REQ-014
import type { SearchResult, Provider, ProviderConfig } from "../types.js";
import { normalize } from "../normalizer.js";
import { RetryableError } from "../retry.js";
import { infobrokerFetch } from "../http.js";

type FieldMap = NonNullable<ProviderConfig["field_map"]>;

function getAtPath(obj: unknown, path: string): unknown {
  if (!path) return obj;
  let cursor: unknown = obj;
  for (const segment of path.split(".")) {
    if (cursor == null) return undefined;
    if (Array.isArray(cursor)) {
      const idx = Number(segment);
      if (!Number.isInteger(idx)) return undefined;
      cursor = cursor[idx];
    } else if (typeof cursor === "object") {
      cursor = (cursor as Record<string, unknown>)[segment];
    } else {
      return undefined;
    }
  }
  return cursor;
}

function pickField(raw: Record<string, unknown>, fieldMap: FieldMap, key: keyof FieldMap): string | undefined {
  const sourceField = fieldMap[key];
  if (!sourceField) return undefined;
  const val = getAtPath(raw, sourceField);
  if (typeof val === "string" && val.length > 0) return val;
  if (typeof val === "number") return String(val);
  return undefined;
}

export function createGenericProvider(slug: string, cfg: ProviderConfig): Provider {
  const fieldMap: FieldMap = cfg.field_map ?? {
    title: "title",
    url: "url",
    snippet: "snippet",
  };

  async function search(query: string, options?: { max_results?: number }): Promise<SearchResult[]> {
    const maxResults = options?.max_results ?? 10;
    const base = cfg.endpoint!.replace(/[?&]$/, "");
    const sep = base.includes("?") ? "&" : "?";
    const url = `${base}${sep}${encodeURIComponent(cfg.query_param!)}=${encodeURIComponent(query)}`;

    const resp = await infobrokerFetch(url, { providerSlug: slug });

    if (!resp.ok) throw new RetryableError(`${slug} returned HTTP ${resp.status}`, resp.status);

    const data = (await resp.json()) as unknown;
    const list = getAtPath(data, cfg.results_path ?? "");
    if (!Array.isArray(list)) {
      throw new RetryableError(`${slug} results_path "${cfg.results_path ?? ""}" did not resolve to an array`, 200);
    }

    const raw = list.slice(0, maxResults).map((item) => {
      if (typeof item !== "object" || item === null) return null;
      const obj = item as Record<string, unknown>;
      const originalSource = pickField(obj, fieldMap, "original_source");
      const mapped = {
        title: pickField(obj, fieldMap, "title"),
        url: pickField(obj, fieldMap, "url"),
        snippet: pickField(obj, fieldMap, "snippet"),
        published_date: pickField(obj, fieldMap, "published_date"),
        source_type: pickField(obj, fieldMap, "source_type") ?? "web_search",
      };
      return originalSource ? { ...mapped, original_source: originalSource } : mapped;
    });

    const cleaned = raw.filter((r): r is NonNullable<typeof r> => r !== null);
    return normalize(cleaned, slug);
  }

  async function health(): Promise<{ status: string; avgLatencyMs: number }> {
    const start = Date.now();
    try {
      const base = cfg.endpoint!.replace(/[?&]$/, "");
      const sep = base.includes("?") ? "&" : "?";
      const resp = await infobrokerFetch(`${base}${sep}${encodeURIComponent(cfg.query_param!)}=test`, { providerSlug: slug });
      const elapsed = Date.now() - start;
      if (resp.ok) return { status: "active", avgLatencyMs: elapsed };
      return { status: "degraded", avgLatencyMs: elapsed };
    } catch {
      return { status: "inactive", avgLatencyMs: Date.now() - start };
    }
  }

  return {
    slug,
    tier: "generic_http",
    capabilities: cfg.capabilities,
    search,
    health,
  };
}
