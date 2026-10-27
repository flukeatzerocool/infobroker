// @implements REQ-127
// Lightweight analysis aids derived from search results (REQ-127): topic terms,
// entity mentions, semantic clusters, and a dated timeline. Everything is
// computed in-process from the results already retrieved — no extra network
// request, no graph/link-analysis platform. Heuristics are intentionally
// bounded and deterministic so the output is unit-testable.
import type { SearchResult } from "./types.js";
import { tokenize, pairwiseSimilarity } from "./embed.js";

export interface AnalysisOptions {
  max_topics?: number;
  max_entities?: number;
  cluster_threshold?: number;
  min_cluster_size?: number;
  timeline?: boolean;
}

export interface AnalysisTopic {
  term: string;
  score: number;
  results: number[];
}

export type EntityKind = "proper_noun" | "domain" | "date";

export interface AnalysisEntity {
  text: string;
  kind: EntityKind;
  count: number;
  results: number[];
}

export interface AnalysisCluster {
  representative: number;
  members: number[];
  score: number;
}

export interface TimelineEntry {
  date: string;
  precision: "day" | "month" | "year";
  title: string;
  url: string;
  result: number;
}

export interface AnalysisResult {
  topics: AnalysisTopic[];
  entities: AnalysisEntity[];
  clusters: AnalysisCluster[];
  timeline: { dated: TimelineEntry[]; undated: number };
}

const STOPWORDS = new Set([
  "the", "and", "for", "with", "that", "this", "from", "have", "has", "had",
  "not", "but", "you", "your", "are", "was", "were", "will", "would", "can",
  "could", "should", "about", "into", "over", "than", "then", "they", "them",
  "their", "there", "here", "what", "when", "where", "which", "who", "how",
  "all", "any", "more", "most", "some", "such", "only", "also", "one", "two",
  "new", "use", "used", "using", "may", "might", "its", "it's", "out", "our",
]);

function resultText(r: SearchResult): string {
  return `${r.title ?? ""} ${r.snippet ?? ""}`.trim();
}

function topN<T>(items: T[], n: number): T[] {
  return n > 0 ? items.slice(0, n) : [];
}

export function extractTopics(results: SearchResult[], options: AnalysisOptions = {}): AnalysisTopic[] {
  const max = options.max_topics ?? 10;
  if (max <= 0 || results.length === 0) return [];
  const docs = results.map((r) => tokenize(resultText(r)));
  const df = new Map<string, number>();
  for (const tokens of docs) {
    for (const term of new Set(tokens)) df.set(term, (df.get(term) ?? 0) + 1);
  }
  const scores = new Map<string, number>();
  const indexes = new Map<string, Set<number>>();
  docs.forEach((tokens, docIndex) => {
    const tf = new Map<string, number>();
    for (const term of tokens) tf.set(term, (tf.get(term) ?? 0) + 1);
    for (const [term, count] of tf) {
      if (STOPWORDS.has(term) || term.length < 2) continue;
      const idf = Math.log((results.length + 1) / ((df.get(term) ?? 0) + 1)) + 1;
      scores.set(term, (scores.get(term) ?? 0) + count * idf);
      if (!indexes.has(term)) indexes.set(term, new Set());
      indexes.get(term)!.add(docIndex);
    }
  });
  const ordered = [...scores.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([term, score]) => ({ term, score: Math.round(score * 1000) / 1000, results: [...(indexes.get(term) ?? [])].sort((x, y) => x - y) }));
  return topN(ordered, max);
}

const PROPER_NOUN_RE = /\p{Lu}[\p{L}\p{N}'’.&-]*(?:\s+\p{Lu}[\p{L}\p{N}'’.&-]*){0,3}/gu;
const DATE_RE = /\b(?:19|20)\d{2}(?:-\d{2}(?:-\d{2})?)?\b/g;
const ENTITY_STOPWORDS = new Set(["the", "a", "an", "this", "that", "these", "those", "it"]);

export function extractEntities(results: SearchResult[], options: AnalysisOptions = {}): AnalysisEntity[] {
  const max = options.max_entities ?? 10;
  if (max <= 0 || results.length === 0) return [];
  const found = new Map<string, AnalysisEntity>();

  const add = (raw: string, kind: EntityKind, docIndex: number) => {
    const text = raw.trim().replace(/[.,;:]+$/, "");
    if (text.length < 2 || ENTITY_STOPWORDS.has(text.toLowerCase())) return;
    const key = `${kind}:${text.toLowerCase()}`;
    const existing = found.get(key);
    if (existing) {
      existing.count += 1;
      if (!existing.results.includes(docIndex)) existing.results.push(docIndex);
    } else {
      found.set(key, { text, kind, count: 1, results: [docIndex] });
    }
  };

  results.forEach((r, docIndex) => {
    const text = resultText(r);
    for (const match of text.matchAll(PROPER_NOUN_RE)) add(match[0], "proper_noun", docIndex);
    for (const match of text.matchAll(DATE_RE)) add(match[0], "date", docIndex);
    if (/^https?:\/\//i.test(r.url)) {
      try {
        const host = new URL(r.url).hostname.replace(/^www\./i, "");
        add(host, "domain", docIndex);
      } catch {
        // malformed URL — the result is still analyzed without a domain entity
      }
    }
  });

  const ordered = [...found.values()]
    .sort((a, b) => b.count - a.count || a.text.localeCompare(b.text))
    .map((e) => ({ ...e, results: [...e.results].sort((x, y) => x - y) }));
  return topN(ordered, max);
}

export function clusterResults(results: SearchResult[], options: AnalysisOptions = {}): AnalysisCluster[] {
  if (results.length < 2) return [];
  const threshold = options.cluster_threshold ?? 0.55;
  const minSize = options.min_cluster_size ?? 2;
  const texts = results.map(resultText);

  let sim: number[][];
  try {
    sim = pairwiseSimilarity(texts, "lsa");
  } catch {
    try {
      sim = pairwiseSimilarity(texts, "signed-hash-tfidf");
    } catch {
      return [];
    }
  }

  const clusters: Array<{ rep: number; members: number[]; score: number }> = [];
  for (let i = 0; i < texts.length; i++) {
    let target: (typeof clusters)[number] | undefined;
    let best = -1;
    for (const cluster of clusters) {
      const score = sim[i][cluster.rep] ?? 0;
      if (score >= threshold && score > best) {
        best = score;
        target = cluster;
      }
    }
    if (target) {
      target.members.push(i);
      target.score = Math.max(target.score, best);
    } else {
      clusters.push({ rep: i, members: [i], score: 1 });
    }
  }

  return clusters
    .filter((c) => c.members.length >= Math.max(2, minSize))
    .sort((a, b) => b.members.length - a.members.length || a.rep - b.rep)
    .map((c) => ({
      representative: c.rep,
      members: c.members,
      score: Math.round(c.score * 1000) / 1000,
    }));
}

function parseDate(value?: string): { iso: string; precision: TimelineEntry["precision"] } | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (/^\d{8}$/.test(trimmed)) {
    return { iso: `${trimmed.slice(0, 4)}-${trimmed.slice(4, 6)}-${trimmed.slice(6, 8)}`, precision: "day" };
  }
  const match = trimmed.match(/^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?/);
  if (match) {
    const [, year, month, day] = match;
    const iso = month ? (day ? `${year}-${month}-${day}` : `${year}-${month}`) : year;
    const parsed = Date.parse(iso.length === 4 ? `${iso}-01-01` : iso.length === 7 ? `${iso}-01` : iso);
    if (!Number.isNaN(parsed)) {
      return { iso, precision: day ? "day" : month ? "month" : "year" };
    }
  }
  const parsed = Date.parse(trimmed);
  if (!Number.isNaN(parsed)) return { iso: new Date(parsed).toISOString(), precision: "day" };
  return undefined;
}

export function buildTimeline(results: SearchResult[], options: AnalysisOptions = {}): AnalysisResult["timeline"] {
  if (options.timeline === false) return { dated: [], undated: 0 };
  const dated: Array<TimelineEntry & { sortKey: number }> = [];
  let undated = 0;
  results.forEach((r, index) => {
    const parsed = parseDate(r.published_date);
    if (!parsed) {
      undated += 1;
      return;
    }
    dated.push({
      date: parsed.iso,
      precision: parsed.precision,
      title: r.title ?? "",
      url: r.url ?? "",
      result: index,
      sortKey: Date.parse(parsed.iso.length === 4 ? `${parsed.iso}-01-01` : parsed.iso.length === 7 ? `${parsed.iso}-01` : parsed.iso),
    });
  });
  dated.sort((a, b) => a.sortKey - b.sortKey || a.result - b.result);
  return { dated: dated.map(({ sortKey: _sortKey, ...entry }) => entry), undated };
}

export function analyzeResults(results: SearchResult[], options: AnalysisOptions = {}): AnalysisResult {
  return {
    topics: extractTopics(results, options),
    entities: extractEntities(results, options),
    clusters: clusterResults(results, options),
    timeline: buildTimeline(results, options),
  };
}
