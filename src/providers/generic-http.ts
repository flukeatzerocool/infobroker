// @implements REQ-014
import type { SearchResult, Provider, ProviderConfig } from "../types.js";
import { normalize } from "../normalizer.js";
import { ParseError, RetryableError } from "../retry.js";
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
  if (typeof val === "number" || typeof val === "boolean") return String(val);
  return undefined;
}

function pickNumber(raw: Record<string, unknown>, fieldMap: FieldMap, key: keyof FieldMap): number | undefined {
  const sourceField = fieldMap[key];
  if (!sourceField) return undefined;
  const val = getAtPath(raw, sourceField);
  return typeof val === "number" && Number.isFinite(val) ? val : undefined;
}

function pickStringArray(raw: Record<string, unknown>, fieldMap: FieldMap, key: keyof FieldMap): string[] | undefined {
  const sourceField = fieldMap[key];
  if (!sourceField) return undefined;
  const val = getAtPath(raw, sourceField);
  if (typeof val === "string" && val.trim().length > 0) return [val];
  if (Array.isArray(val)) {
    const values = val.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);
    return values.length > 0 ? values : undefined;
  }
  return undefined;
}

/** Resolve a possibly root-relative result URL against the provider endpoint. */
function resolveUrl(rawUrl: string, endpoint: string): string {
  // Absolute and scheme-relative URLs are already resolvable; return them
  // verbatim so the normalizer preserves the provider's input form.
  if (/^[a-z][a-z0-9+.-]*:/i.test(rawUrl) || rawUrl.startsWith("//")) return rawUrl;
  try {
    return new URL(rawUrl, endpoint).toString();
  } catch {
    return rawUrl;
  }
}

function authHeaders(cfg: ProviderConfig, slug: string): Record<string, string> {
  if (!cfg.auth_env) return {};
  const key = process.env[cfg.auth_env];
  if (!key) {
    if (cfg.auth_optional) return {};
    throw new Error(`Provider "${slug}" requires ${cfg.auth_env}, which is not set`);
  }
  const scheme = (cfg.auth_scheme ?? "Bearer").trim();
  return { [cfg.auth_header ?? "Authorization"]: scheme ? `${scheme} ${key}` : key };
}

async function readJson(resp: Response, slug: string): Promise<unknown> {
  try {
    return await resp.json();
  } catch {
    const contentType = resp.headers.get("content-type") ?? "unknown content-type";
    throw new ParseError(`${slug} returned a non-JSON response (${contentType})`);
  }
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

    const resp = await infobrokerFetch(url, { providerSlug: slug, headers: authHeaders(cfg, slug) });

    if (!resp.ok) throw new RetryableError(`${slug} returned HTTP ${resp.status}`, resp.status);

    const data = await readJson(resp, slug);
    const list = getAtPath(data, cfg.results_path ?? "");
    if (!Array.isArray(list)) {
      throw new RetryableError(`${slug} results_path "${cfg.results_path ?? ""}" did not resolve to an array`, 200);
    }

    const raw = list.map((item) => {
      if (typeof item !== "object" || item === null) return null;
      const obj = item as Record<string, unknown>;
      const originalSource = pickField(obj, fieldMap, "original_source");
      const mappedUrl = pickField(obj, fieldMap, "url");
      if (!mappedUrl) return null;
      const mapped: Record<string, unknown> = {
        title: pickField(obj, fieldMap, "title"),
        url: resolveUrl(mappedUrl, cfg.endpoint!),
        snippet: pickField(obj, fieldMap, "snippet"),
        published_date: pickField(obj, fieldMap, "published_date"),
        source_type: pickField(obj, fieldMap, "source_type") ?? "web_search",
      };
      const authors = pickStringArray(obj, fieldMap, "authors");
      const doi = pickField(obj, fieldMap, "doi");
      const venue = pickField(obj, fieldMap, "venue");
      const abstract = pickField(obj, fieldMap, "abstract");
      const citationCount = pickNumber(obj, fieldMap, "citation_count");
      if (authors) mapped.authors = authors;
      if (doi) mapped.doi = doi;
      if (venue) mapped.venue = venue;
      if (abstract) mapped.abstract = abstract;
      if (citationCount !== undefined) mapped.citation_count = citationCount;
      if (originalSource) mapped.original_source = originalSource;
      return mapped;
    });

    const cleaned = raw.filter((r): r is NonNullable<typeof r> => r !== null);
    return normalize(cleaned.slice(0, maxResults), slug);
  }

  async function health(): Promise<{ status: string; avgLatencyMs: number }> {
    const start = Date.now();
    try {
      let url: string;
      if (cfg.health_endpoint) {
        url = cfg.health_endpoint;
      } else {
        const base = cfg.endpoint!.replace(/[?&]$/, "");
        const sep = base.includes("?") ? "&" : "?";
        url = `${base}${sep}${encodeURIComponent(cfg.query_param!)}=test`;
      }
      const resp = await infobrokerFetch(url, { providerSlug: slug, headers: authHeaders(cfg, slug) });
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
