// @implements REQ-079
// Output-verbosity selection for all tool responses (REQ-079). In compact mode
// the server omits optional metadata and per-result fields beyond title, URL,
// and snippet, while retaining the REQ-001 envelope and its required fields.
// Extracted from src/index.ts so the compact-shaping rule is unit-testable.
import type { SearchResult, ToolNotice } from "./types.js";

export interface VerbosityConfig {
  output?: { verbose?: boolean };
}

export function compactMode(config: VerbosityConfig): boolean {
  return config.output?.verbose === false;
}

// Trim each result to the fields retained in compact verbosity. Non-compact
// responses pass through unchanged, preserving optional fields (published_date,
// source_type, original_source) required by REQ-001 non-compact output.
export function compactResults(results: SearchResult[]): SearchResult[] {
  return results.map(({ title, url, snippet }) => ({ title, url, snippet }));
}

/** Meta fields that another REQ makes required even under compact verbosity. */
const REQUIRED_META_KEYS = ["per_query", "fact_status"] as const;

function isSearchResult(value: unknown): value is SearchResult {
  if (!value || typeof value !== "object") return false;
  const r = value as Record<string, unknown>;
  return typeof r.title === "string" && typeof r.url === "string" && typeof r.snippet === "string";
}

/**
 * REQ-079: apply compact verbosity to any tool envelope, not only search_web.
 * Results are trimmed only when every item is search-shaped; finding-shaped
 * payloads (verify_claims) keep their fields. Action-required notices survive;
 * informational notices are optional metadata and are dropped.
 */
export function compactEnvelope<T extends Record<string, unknown>>(envelope: T): T {
  const out: Record<string, unknown> = { ...envelope };

  if (Array.isArray(out.results) && out.results.length > 0 && out.results.every(isSearchResult)) {
    out.results = compactResults(out.results);
  }

  const meta = out.meta;
  if (meta && typeof meta === "object" && !Array.isArray(meta)) {
    const source = meta as Record<string, unknown>;
    const kept: Record<string, unknown> = {};
    for (const key of REQUIRED_META_KEYS) {
      if (key in source) kept[key] = source[key];
    }
    if (Object.keys(kept).length > 0) out.meta = kept;
    else delete out.meta;
  }

  const notices = out.notices;
  if (Array.isArray(notices)) {
    const required = notices.filter(
      (notice): notice is ToolNotice =>
        !!notice && typeof notice === "object" && (notice as ToolNotice).severity === "action_required"
    );
    if (required.length > 0) out.notices = required;
    else delete out.notices;
  }

  return out as T;
}
