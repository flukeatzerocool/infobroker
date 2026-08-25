// @implements REQ-028
import type { SearchResult, DeepConfig } from "./types.js";
import type { RankedPassage } from "./rerank.js";

export interface DeepEnrichedResult {
  title: string;
  url: string;
  snippet: string;
  source_type?: string;
  original_source?: string;
  passages?: Array<{ text: string; score: number; index: number }>;
  top_score?: number;
  extraction_mode?: "passage" | "full_content";
  last_updated?: string;
  date_source?: string;
  date_confidence?: string;
  read_error?: string;
}

export interface DeepFetchResult {
  content: string;
  slug: string;
}

// Injected dependencies keep the orchestration (budget, concurrency, early-exit,
// timebox) testable apart from network I/O. index.ts supplies the real fetcher,
// date detector, ranker, and auto-index hook.
export interface DeepDeps {
  detectDate?: (url: string) => Promise<{ date: string; source: string; confidence: string } | undefined>;
  rank?: (text: string, query: string, passageSize: number, maxPassages: number) => RankedPassage[];
  autoIndex?: (result: DeepEnrichedResult, content: string, provider: string) => void;
}

export function deepRead(
  query: string,
  results: SearchResult[],
  deep: DeepConfig,
  passageSize: number,
  maxPassages: number,
  maxPages: number,
  fetchPage: (url: string) => Promise<DeepFetchResult | null>,
  deps: DeepDeps = {},
): Promise<{ results: DeepEnrichedResult[]; pages_read: number }> {
  const concurrency = deep.concurrency ?? 4;
  const earlyExitScore = deep.early_exit_score ?? 0.3;
  const maxMs = deep.max_ms ?? 8000;
  const detectDate = deep.detect_date ?? false;
  const rank = deps.rank ?? defaultRank;
  const detectDateFn = deps.detectDate;
  const autoIndex = deps.autoIndex;

  const targets = results.filter((r) => /^https?:\/\//i.test(r.url)).slice(0, maxPages);
  const out = new Map<string, DeepEnrichedResult>();
  for (const r of targets) out.set(r.url, { ...r });

  if (targets.length === 0) {
    return Promise.resolve({ results: results as DeepEnrichedResult[], pages_read: 0 });
  }

  const deadline = Date.now() + maxMs;
  let earlyExit = false;
  let idx = 0;
  let pagesRead = 0;

  async function readOne(url: string): Promise<void> {
    const base = out.get(url);
    if (!base) return;
    if (Date.now() > deadline) return;
    if (earlyExit) return;

    const dateP = detectDate && detectDateFn ? detectDateFn(url) : Promise.resolve(undefined);

    let fetched: DeepFetchResult | null;
    try {
      fetched = await fetchPage(url);
    } catch {
      base.read_error = "page fetch failed";
      return;
    }
    const pageDate = await dateP;

    if (!fetched) {
      base.read_error = "page fetch failed";
      return;
    }

    const passages = rank(fetched.content, query, passageSize, maxPassages);
    const top = passages[0];
    const dateMeta = pageDate
      ? { last_updated: pageDate.date, date_source: pageDate.source, date_confidence: pageDate.confidence }
      : {};

    const enriched: DeepEnrichedResult = {
      ...base,
      ...(passages.length > 0
        ? {
            passages: passages.map((p) => ({ text: p.text, score: p.score, index: p.index })),
            top_score: top.score,
            extraction_mode: "passage" as const,
          }
        : {
            extraction_mode: "full_content" as const,
          }),
      ...dateMeta,
    };
    out.set(url, enriched);
    pagesRead++;

    if (top && top.score >= earlyExitScore) {
      earlyExit = true;
    }

    if (autoIndex) autoIndex(enriched, fetched.content, fetched.slug);
  }

  async function worker(): Promise<void> {
    while (idx < targets.length) {
      if (earlyExit || Date.now() > deadline) return;
      const i = idx++;
      await readOne(targets[i].url);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, targets.length) }, worker);
  return Promise.allSettled(workers).then(() => {
    const ordered = results.map((r) => out.get(r.url) ?? (r as DeepEnrichedResult));
    return { results: ordered, pages_read: pagesRead };
  });
}

function defaultRank(_text: string, _query: string, _ps: number, _mp: number): RankedPassage[] {
  return [];
}
