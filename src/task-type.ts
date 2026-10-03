// @implements REQ-020a
// Task-type classification for `search_web` auto-selection (REQ-020a): maps a
// free-text query to one of the §7.1 task types by literal keyword presence,
// falling back to semantic similarity against each type's prototype vocabulary.
// Extracted from src/index.ts so the selection rule is unit-testable without an
// MCP round-trip; the ranker is injectable to keep the fallback deterministic.
import { rankDocs, type RankedDoc } from "./embed.js";

export const TASK_TYPE_KEYWORDS: Record<string, string[]> = {
  "general_web": ["search", "find", "look up", "research", "information about"],
  "small_web": ["blog", "personal", "non-commercial", "indie", "small web"],
  "encyclopedia": ["encyclopedia", "wiki"],
  "definition": ["definition", "define", "meaning", "etymology", "dictionary", "word"],
  "structured_fact": ["date", "statistic", "identifier", "population", "birth", "death"],
  "financial": ["sec filing", "financial filing", "10-k", "10-q", "8-k", "edgar", "economic indicator", "gdp", "inflation"],
  "location": ["where is", "location", "map", "address", "city", "place", "geocode"],
  "academic": ["paper", "study", "research paper", "academic", "scholar", "journal", "thesis"],
  "code": ["code", "programming", "error", "debug", "function", "api", "docs", "stack overflow"],
  "news": ["news", "recent", "latest", "today", "current"],
  "archive": ["archive", "historical", "old", "past version"],
  "semantic": ["like", "similar to", "semantic", "neural", "conceptual"],
  "synthesis": ["synthesize", "comprehensive", "summarize sources", "rag"],
  "privacy_critical": ["private", "anonymous", "no tracking", "self-host"],
};

export type Ranker = (query: string, docs: string[], modelName?: string) => RankedDoc[];

export function classifyTaskType(task: string, ranker: Ranker = rankDocs): string {
  const lower = task.toLowerCase();
  for (const [type, keywords] of Object.entries(TASK_TYPE_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) return type;
  }
  // No keyword matched: fall back to semantic similarity against each task
  // type's prototype vocabulary (REQ-020a). A high bar keeps ambiguous queries
  // on the general_web chain.
  try {
    const types = Object.keys(TASK_TYPE_KEYWORDS);
    const prototypes = types.map((t) => TASK_TYPE_KEYWORDS[t].join(" "));
    const ranked = ranker(task, prototypes, "lsa");
    if (ranked.length > 0 && ranked[0].score >= 0.5) return types[ranked[0].index];
  } catch {
    // Model unavailable — keep the general_web default.
  }
  return "general_web";
}
