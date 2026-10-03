// @implements REQ-079
// Output-verbosity selection for all tool responses (REQ-079). In compact mode
// the server omits optional metadata and per-result fields beyond title, URL,
// and snippet, while retaining the REQ-001 envelope and its required fields.
// Extracted from src/index.ts so the compact-shaping rule is unit-testable.
import type { SearchResult } from "./types.js";

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
