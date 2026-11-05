// @implements REQ-020a word-boundary REQ-020a scholarly-signals REQ-020a confidence-floor REQ-020a override REQ-020a reported-task-type
// Task-type classification for `search_web` selection (REQ-020a): maps a
// free-text query to one of the §7.1 task types by whole-word signal matching,
// falling back to semantic similarity against each type's prototype vocabulary
// only when no signal matches at all. Extracted from src/index.ts so the
// selection rule is unit-testable without an MCP round-trip; the ranker is
// injectable to keep the fallback deterministic.
//
// Signal weights: 2 = a distinctive token or phrase; 1 = a generic token that
// is only meaningful alongside another signal; 3 = a structured scholarly form
// (DOI, author–year, cited work). `MIN_SIGNAL_SCORE` is the confidence floor: a
// single generic token is not enough evidence to leave the general_web chain.
import { rankDocs, type RankedDoc } from "./embed.js";

// The searchable task types: every §7.1 type a `search_web` call can dispatch
// to. `content_fetch` is a renderer chain for `fetch_page`, not a search type,
// so it is deliberately absent (REQ-020a). Declared as a tuple so both the
// runtime validator and the tool's zod enum share one source.
export const SEARCHABLE_TASK_TYPES = [
  "general_web",
  "small_web",
  "encyclopedia",
  "definition",
  "structured_fact",
  "financial",
  "location",
  "academic",
  "code",
  "news",
  "archive",
  "semantic",
  "synthesis",
  "privacy_critical",
] as const;

export type SearchableTaskType = (typeof SEARCHABLE_TASK_TYPES)[number];

export interface Signal {
  keyword: string;
  weight: number;
}

// Signal table. Order is the §7.1 declaration order and doubles as the final
// tie-break, so selection is deterministic without depending on object order
// for scoring.
export const TASK_TYPE_SIGNALS: Record<SearchableTaskType, Signal[]> = {
  general_web: [
    { keyword: "search", weight: 1 },
    { keyword: "find", weight: 1 },
    { keyword: "look up", weight: 1 },
    { keyword: "research", weight: 1 },
    { keyword: "information about", weight: 1 },
  ],
  small_web: [
    { keyword: "blog", weight: 1 },
    { keyword: "personal site", weight: 2 },
    { keyword: "non-commercial", weight: 2 },
    { keyword: "indie", weight: 1 },
    { keyword: "small web", weight: 2 },
  ],
  encyclopedia: [
    { keyword: "encyclopedia", weight: 2 },
    { keyword: "wikipedia", weight: 2 },
    { keyword: "wiki", weight: 2 },
    { keyword: "biography", weight: 2 },
    { keyword: "biographical", weight: 2 },
    { keyword: "who was", weight: 2 },
  ],
  definition: [
    { keyword: "definition", weight: 2 },
    { keyword: "define", weight: 2 },
    { keyword: "meaning of", weight: 2 },
    { keyword: "etymology", weight: 2 },
    { keyword: "dictionary", weight: 2 },
    { keyword: "word", weight: 1 },
  ],
  structured_fact: [
    { keyword: "date", weight: 1 },
    { keyword: "statistic", weight: 2 },
    { keyword: "population", weight: 2 },
    { keyword: "birth", weight: 1 },
    { keyword: "death", weight: 1 },
    { keyword: "how many", weight: 1 },
    // REQ-021i: a measurable attribute names the fact the caller wants, so it
    // must outweigh the author-year academic signal on title-plus-year queries
    // ("Survivor Series 1997 attendance"). These are distinctive enough to be
    // decisive on their own.
    { keyword: "attendance", weight: 4 },
    { keyword: "percentage", weight: 4 },
    { keyword: "percent", weight: 4 },
    { keyword: "share of", weight: 3 },
    { keyword: "how much", weight: 2 },
    { keyword: "what date", weight: 2 },
    { keyword: "when did", weight: 2 },
  ],
  financial: [
    { keyword: "sec filing", weight: 2 },
    { keyword: "financial filing", weight: 2 },
    { keyword: "10-k", weight: 2 },
    { keyword: "10-q", weight: 2 },
    { keyword: "8-k", weight: 2 },
    { keyword: "edgar", weight: 2 },
    { keyword: "economic indicator", weight: 2 },
    { keyword: "gdp", weight: 2 },
    { keyword: "inflation", weight: 2 },
  ],
  location: [
    { keyword: "where is", weight: 2 },
    { keyword: "location of", weight: 2 },
    { keyword: "map of", weight: 2 },
    { keyword: "address of", weight: 2 },
    { keyword: "coordinates", weight: 2 },
    { keyword: "city", weight: 1 },
    { keyword: "place", weight: 1 },
    { keyword: "map", weight: 1 },
    { keyword: "geocode", weight: 2 },
  ],
  academic: [
    { keyword: "research paper", weight: 2 },
    { keyword: "journal of", weight: 2 },
    { keyword: "journal", weight: 2 },
    { keyword: "academic", weight: 2 },
    { keyword: "scholar", weight: 2 },
    { keyword: "thesis", weight: 2 },
    { keyword: "paper", weight: 1 },
    { keyword: "study", weight: 1 },
    { keyword: "preprint", weight: 2 },
    { keyword: "peer-reviewed", weight: 2 },
    { keyword: "et al", weight: 2 },
    { keyword: "citation", weight: 2 },
    { keyword: "literature review", weight: 2 },
    { keyword: "systematic review", weight: 2 },
    { keyword: "meta-analysis", weight: 2 },
    { keyword: "arxiv", weight: 2 },
    { keyword: "pubmed", weight: 2 },
    { keyword: "doi", weight: 2 },
  ],
  code: [
    { keyword: "code", weight: 1 },
    { keyword: "programming", weight: 2 },
    { keyword: "error", weight: 1 },
    { keyword: "debug", weight: 2 },
    { keyword: "function", weight: 1 },
    { keyword: "api", weight: 1 },
    { keyword: "docs", weight: 1 },
    { keyword: "stack overflow", weight: 2 },
  ],
  news: [
    { keyword: "news", weight: 2 },
    { keyword: "breaking", weight: 2 },
    { keyword: "latest", weight: 1 },
    { keyword: "today", weight: 1 },
    { keyword: "current", weight: 1 },
  ],
  archive: [
    { keyword: "archive", weight: 2 },
    { keyword: "wayback", weight: 2 },
    { keyword: "past version", weight: 2 },
    { keyword: "historical", weight: 1 },
    { keyword: "old", weight: 1 },
  ],
  semantic: [
    { keyword: "similar to", weight: 2 },
    { keyword: "semantic", weight: 2 },
    { keyword: "conceptual", weight: 2 },
    { keyword: "like", weight: 1 },
    { keyword: "neural", weight: 1 },
  ],
  synthesis: [
    { keyword: "synthesize", weight: 2 },
    { keyword: "summarize sources", weight: 2 },
    { keyword: "comprehensive", weight: 1 },
    { keyword: "rag", weight: 1 },
  ],
  privacy_critical: [
    { keyword: "anonymous", weight: 2 },
    { keyword: "no tracking", weight: 2 },
    { keyword: "self-host", weight: 2 },
    { keyword: "private", weight: 1 },
  ],
};

// Kept for prototype construction (semantic fallback) and for callers that
// reason about the keyword vocabulary.
export const TASK_TYPE_KEYWORDS: Record<string, string[]> = Object.fromEntries(
  Object.entries(TASK_TYPE_SIGNALS).map(([type, signals]) => [type, signals.map((s) => s.keyword)]),
);

// Confidence floor: below this, the evidence is one generic token and the
// query keeps the general_web chain.
export const MIN_SIGNAL_SCORE = 2;

// Semantic-only classification may not select a chain that targets one narrow
// subject area. Routing a person's name to a geocoder is the failure this
// prevents, and the LSA score gives no warning (it scored location 1.00 for a
// biography query). Narrow chains need a literal signal (REQ-020a).
const NARROW_CHAINS = new Set<string>(["location", "structured_fact", "financial", "definition", "code"]);

// A DOI (10.NNNN/suffix), an author–year citation ("Smith 2020",
// "Smith et al., 2020"), or a cited work title ("Mazer "Donald Trump Shoots
// the Match"" — a capitalized name followed by a >=3-word quoted title).
const DOI_RE = /\b10\.\d{4,9}\/\S+/;
const AUTHOR_YEAR_RE = /\b[a-z][a-z'’-]{1,}\s+(?:et\s+al\.?,?\s+)?(?:19|20)\d{2}\b/;
const CITED_WORK_RE = /\b[A-Z][a-z'’-]+\s+["“]([^"”]{12,})["”]/;
const SCHOLARLY_WEIGHT = 3;

const PHRASE_RE_CACHE = new Map<string, RegExp>();

function phraseRe(phrase: string): RegExp {
  let re = PHRASE_RE_CACHE.get(phrase);
  if (!re) {
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // Whole-word match: a signal may not match inside a longer word
    // ("city" must not fire inside "capacity", "date" not inside "update").
    re = new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, "iu");
    PHRASE_RE_CACHE.set(phrase, re);
  }
  return re;
}

function citedWorkMatches(query: string): boolean {
  const m = query.match(CITED_WORK_RE);
  if (!m) return false;
  // Require a real title (>=3 words) so a product name in quotes
  // ('Apple "iPhone 15"') does not read as a cited work.
  return m[1].trim().split(/\s+/).length >= 3;
}

interface TypeScore {
  type: SearchableTaskType;
  score: number;
  maxWeight: number;
  longest: number;
}

function scoreType(type: SearchableTaskType, lower: string, raw: string): TypeScore {
  const signals = TASK_TYPE_SIGNALS[type];
  const matched = new Set<string>();
  let score = 0;
  let maxWeight = 0;
  let longest = 0;

  for (const signal of signals) {
    if (!phraseRe(signal.keyword).test(lower)) continue;
    if (matched.has(signal.keyword)) continue;
    matched.add(signal.keyword);
    score += signal.weight;
    maxWeight = Math.max(maxWeight, signal.weight);
    longest = Math.max(longest, signal.keyword.length);
  }

  if (type === "academic") {
    const scholarly = DOI_RE.test(lower) || AUTHOR_YEAR_RE.test(lower) || citedWorkMatches(raw);
    if (scholarly && matched.size === 0) {
      score += SCHOLARLY_WEIGHT;
      maxWeight = Math.max(maxWeight, SCHOLARLY_WEIGHT);
    } else if (scholarly) {
      // Structured scholarly evidence strengthens an existing keyword hit.
      score += SCHOLARLY_WEIGHT;
      maxWeight = Math.max(maxWeight, SCHOLARLY_WEIGHT);
    }
  }

  return { type, score: Math.min(score, 5), maxWeight, longest };
}

function selectScored(query: string): TypeScore | null {
  const lower = query.toLowerCase();
  const scored = SEARCHABLE_TASK_TYPES
    .map((type) => scoreType(type, lower, query))
    .filter((s) => s.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.maxWeight - a.maxWeight ||
        b.longest - a.longest ||
        SEARCHABLE_TASK_TYPES.indexOf(a.type) - SEARCHABLE_TASK_TYPES.indexOf(b.type),
    );
  return scored[0] ?? null;
}

export type Ranker = (query: string, docs: string[], modelName?: string) => RankedDoc[];

export function classifyTaskType(task: string, ranker: Ranker = rankDocs): string {
  const best = selectScored(task);
  if (best) {
    // A matched signal below the floor is ambiguous evidence: stay on the
    // general_web chain rather than let the semantic ranker arbitrate.
    return best.score >= MIN_SIGNAL_SCORE ? best.type : "general_web";
  }

  // No literal signal: fall back to semantic similarity against each task
  // type's prototype vocabulary (REQ-020a). A high bar keeps ambiguous queries
  // on the general_web chain, and a narrow chain is never selected this way.
  try {
    const types = Object.keys(TASK_TYPE_KEYWORDS);
    const prototypes = types.map((t) => TASK_TYPE_KEYWORDS[t].join(" "));
    const ranked = ranker(task, prototypes, "lsa");
    if (ranked.length > 0 && ranked[0].score >= 0.5) {
      const candidate = types[ranked[0].index];
      if (candidate && !NARROW_CHAINS.has(candidate)) return candidate;
    }
  } catch {
    // Model unavailable — keep the general_web default.
  }
  return "general_web";
}

export interface TaskTypeResolution {
  taskType: string;
  source: "auto" | "override";
  error?: { message: string; remediation: string };
}

export function isSearchableTaskType(value: string): value is SearchableTaskType {
  return (SEARCHABLE_TASK_TYPES as readonly string[]).includes(value);
}

// REQ-020a: a caller-supplied task type bypasses classification; an unknown
// value is rejected rather than silently ignored.
export function resolveTaskType(query: string, override?: string, ranker: Ranker = rankDocs): TaskTypeResolution {
  if (override !== undefined) {
    if (!isSearchableTaskType(override)) {
      return {
        taskType: "general_web",
        source: "override",
        error: {
          message: `Unknown task_type "${override}"`,
          remediation: `Use one of: ${SEARCHABLE_TASK_TYPES.join(", ")}`,
        },
      };
    }
    return { taskType: override, source: "override" };
  }
  return { taskType: classifyTaskType(query, ranker), source: "auto" };
}
