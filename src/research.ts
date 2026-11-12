// @implements REQ-020f
// Research-compile assembly for `search_web` (REQ-020f): one call derives
// multiple search variants, searches each, and groups the ranked results by
// originating variant with provenance. The per-variant search is injected so
// the variant derivation, envelope parsing, and grouping are unit-testable
// without network access. Bounded variant/page counts come from config.
import { deriveExpansions } from "./expand.js";
import type { SearchResult } from "./types.js";

export interface ParsedSearchEnvelope {
  status?: string;
  provider?: string;
  results?: SearchResult[];
  meta?: { pages_read?: number };
}

// Parse a `[OK]`/`[ERROR]`-prefixed JSON envelope, falling back to an error
// envelope when the text is not a parseable result body (REQ-002).
export function parseEnvelope(text: string): ParsedSearchEnvelope {
  try {
    const body = text.startsWith("[OK] ") ? text.slice(5) : text.startsWith("[ERROR] ") ? text.slice(8) : text;
    return JSON.parse(body);
  } catch {
    return { status: "error", provider: "", results: [] };
  }
}

export function deriveResearchVariants(query: string, maxVariants: number, suggestions: string[] = []): string[] {
  const base = deriveExpansions(query, suggestions, maxVariants);
  if (base.length >= 2 || maxVariants <= 1) return base;
  // REQ-020f: a keyphrase query whose stopword-stripped form equals the query
  // still needs multiple variants, so relax it to its content keywords.
  const keywords = query
    .toLowerCase()
    .split(/[^\p{L}\p{N}'-]+/u)
    .filter((word) => word.length >= 3);
  if (new Set(keywords).size < 2) return base;
  const variants = [...base];
  for (const keyword of keywords) {
    if (variants.length >= maxVariants) break;
    if (!variants.some((variant) => variant.toLowerCase() === keyword)) variants.push(keyword);
  }
  return variants;
}

export interface ResearchGroup {
  variant: string;
  status: string;
  provider?: string;
  results: SearchResult[];
  pages_read?: number;
}

// Group each variant's search outcome. A variant that yields no fetchable page
// is reported with its search results and status rather than failing the whole
// compile (REQ-020f).
export async function compileResearchGroups(
  variants: string[],
  fetchVariant: (variant: string) => Promise<string>,
): Promise<ResearchGroup[]> {
  const groups: ResearchGroup[] = [];
  for (const variant of variants) {
    const parsed = parseEnvelope(await fetchVariant(variant));
    groups.push({
      variant,
      status: parsed.status ?? "error",
      provider: parsed.provider,
      results: parsed.results ?? [],
      ...(parsed.meta?.pages_read !== undefined ? { pages_read: parsed.meta.pages_read } : {}),
    });
  }
  return groups;
}
