// @implements REQ-020 REQ-021 REQ-021k
import { matchQuality, type MatchQuality } from "./rerank.js";
export const MAX_BATCH_INPUTS = 5;

/** REQ-021k: a batch input that is an HTTP(S) URL is echoed as `url`. */
const HTTP_URL_RE = /^https?:\/\//i;

export function capInputs(items: string[]): string[] {
  return items.slice(0, MAX_BATCH_INPUTS);
}

export interface CoerceOptions {
  // When true, a string that looks like a JSON array but does not parse is an
  // error. URLs never start with "[" legitimately, so callers that take URLs
  // pass true; free-text queries may start with "[" and pass false.
  strictArraySyntax?: boolean;
}

export interface CoercedStringArray {
  values?: string[];
  error?: { message: string; remediation: string };
}

// Accepts a plain string, a real array, or the JSON-encoded array string that
// clients sometimes send for a union-typed input (observed in session logs).
export function coerceStringArray(value: unknown, options: CoerceOptions = {}): CoercedStringArray {
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return { error: { message: "empty array input", remediation: "Pass at least one string value" } };
    }
    if (value.some((v) => typeof v !== "string" || v.trim() === "")) {
      return { error: { message: "array input contains a non-string or empty value", remediation: "Pass an array of non-empty strings" } };
    }
    return { values: capInputs(value.map((v) => (v as string).trim())) };
  }

  if (typeof value !== "string") {
    return { error: { message: "input must be a string or an array of strings", remediation: "Pass a string or an array of up to five strings" } };
  }

  const trimmed = value.trim();
  const looksLikeArray = trimmed.startsWith("[") && trimmed.endsWith("]");
  if (looksLikeArray) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return coerceStringArray(parsed, options);
      }
    } catch {
      if (options.strictArraySyntax) {
        return { error: { message: "malformed JSON array input", remediation: "Pass a valid JSON array of strings, or a single string" } };
      }
    }
    if (options.strictArraySyntax) {
      return { error: { message: "input is not a JSON array of strings", remediation: "Pass a valid JSON array of strings, or a single string" } };
    }
  }

  if (trimmed === "") {
    return { error: { message: "empty input", remediation: "Pass a non-empty string" } };
  }
  return { values: [trimmed] };
}

interface EnvelopeOk {
  status: "ok";
  provider: string;
  results: Array<{ url?: string; provider?: string; [k: string]: unknown }>;
  meta?: Record<string, unknown>;
  /** REQ-021b: the question a question-mode item was ranked against. */
  question?: string;
  /** REQ-021b: passage content or full content for a question-mode item. */
  extraction_mode?: string;
  /** REQ-021b: ranked passages, each with a relevance score. */
  snippets?: Array<{ text: string; score: number; index: number; start?: number; end?: number }>;
  /** REQ-021b: best passage score for a question-mode item. */
  top_score?: number;
  /** REQ-021b: no-match note when no passage addressed the question. */
  note?: string;
  truncated?: boolean;
  output_path?: string;
}

interface EnvelopeError {
  status: "error";
  provider: string;
  error?: { code: string; message: string; remediation?: string };
}

type Envelope = EnvelopeOk | EnvelopeError;

export function parseEnvelope(text: string): Envelope {
  const t = text.trim();
  if (t.startsWith("[OK]")) {
    return JSON.parse(t.slice(4)) as EnvelopeOk;
  }
  if (t.startsWith("[ERROR]")) {
    return JSON.parse(t.slice(7)) as EnvelopeError;
  }
  throw new Error("unrecognized envelope prefix");
}

export interface PerInputMeta {
  query: string;
  /** REQ-021k: the input echoed when it is an HTTP(S) URL. */
  url?: string;
  provider: string;
  status: "ok" | "error";
  result_count: number;
  truncated?: boolean;
  output_path?: string;
  /** REQ-020h: results excluded by the source-quality blocklist for this query. */
  blocked_count?: number;
  /** REQ-021b: extraction mode for a question-mode item. */
  extraction_mode?: string;
  /** REQ-021b: number of ranked passages returned for this item. */
  passages_returned?: number;
  /** REQ-021k: retained ranked passages for this item. */
  passages?: Array<{ text: string; score: number; index: number; start?: number; end?: number }>;
  /** REQ-021b: best passage score for this item. */
  top_score?: number;
  /** REQ-021b: deterministic match-quality band for this item. */
  match_quality?: MatchQuality;
  /** REQ-021b: no-match note for this item. */
  note?: string;
  /** REQ-002: the error for a failed item in a partially successful batch. */
  error?: { code: string; message: string; remediation?: string };
}

export interface BatchItem {
  query: string;
  envelope: string;
}

function dedupeByUrl(results: Array<{ url?: string; [k: string]: unknown }>): Array<{ url?: string; [k: string]: unknown }> {
  const seen = new Set<string>();
  const out: Array<{ url?: string; [k: string]: unknown }> = [];
  for (const r of results) {
    const key = r.url || "";
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    out.push(r);
  }
  return out;
}

// Merge per-input envelopes into a single envelope. Results are flattened in
// input order and URL-deduplicated; per-input provenance is recorded in meta.
export function mergeItems(items: BatchItem[]): Envelope {
  const perQuery: PerInputMeta[] = [];
  const okItems: Array<{ query: string; env: EnvelopeOk }> = [];
  let firstError: EnvelopeError | undefined;

  for (const item of items) {
    let env: Envelope;
    try {
      env = parseEnvelope(item.envelope);
    } catch {
      env = { status: "error", provider: "system", error: { code: "internal_error", message: "batch item failed to parse", remediation: "retry the query individually to isolate the failing provider" } };
    }
    if (env.status === "ok") {
      okItems.push({ query: item.query, env });
      const blockedCount = env.meta?.["blocked_count"];
      const passages = env.snippets;
      perQuery.push({
        query: item.query,
        ...(HTTP_URL_RE.test(item.query) ? { url: item.query } : {}),
        provider: env.provider,
        status: "ok",
        result_count: env.results.length,
        ...(env.truncated ? { truncated: true, output_path: env.output_path } : {}),
        ...(typeof blockedCount === "number" ? { blocked_count: blockedCount } : {}),
        ...(env.extraction_mode ? { extraction_mode: env.extraction_mode } : {}),
        ...(typeof env.top_score === "number" ? { top_score: env.top_score } : {}),
        ...(passages ? { passages_returned: passages.length, passages } : {}),
        ...(env.note ? { note: env.note } : {}),
        ...(passages ? { match_quality: matchQuality(env.top_score, passages.length) } : {}),
      });
    } else {
      if (!firstError) firstError = env;
      perQuery.push({
        query: item.query,
        ...(HTTP_URL_RE.test(item.query) ? { url: item.query } : {}),
        provider: env.provider,
        status: "error",
        result_count: 0,
        ...(env.error
          ? {
              error: {
                code: env.error.code,
                message: env.error.message,
                ...(env.error.remediation ? { remediation: env.error.remediation } : {}),
              },
            }
          : {}),
      });
    }
  }

  if (okItems.length === 0) {
    return firstError ?? { status: "error", provider: "none", error: { code: "internal_error", message: "no results", remediation: "retry with a different query or provider" } };
  }

  const firstOk = okItems[0].env;
  // REQ-021: every merged result names the renderer that served it, and keeps
  // the item's own question-mode extraction fields. An existing per-result
  // provider (search_web) is preserved.
  const results = dedupeByUrl(
    okItems.flatMap((o) =>
      o.env.results.map((r) => ({
        ...r,
        provider: r.provider ?? o.env.provider,
        ...(o.env.snippets ? { snippets: o.env.snippets } : {}),
        ...(typeof o.env.top_score === "number" ? { top_score: o.env.top_score } : {}),
        ...(o.env.extraction_mode ? { extraction_mode: o.env.extraction_mode } : {}),
        ...(o.env.note ? { note: o.env.note } : {}),
      }))
    )
  );
  // REQ-021b: a question is a batch-level input; lift it only when every item
  // agrees on it. Extraction mode and note stay per result because they differ
  // per page.
  const questions = new Set(
    okItems.map((o) => o.env.question).filter((q): q is string => typeof q === "string" && q.length > 0)
  );
  const sharedQuestion = questions.size === 1 ? [...questions][0] : undefined;
  const hasBlockedCount = okItems.some((o) => typeof o.env.meta?.["blocked_count"] === "number");
  const blockedTotal = okItems.reduce((sum, o) => {
    const count = o.env.meta?.["blocked_count"];
    return sum + (typeof count === "number" ? count : 0);
  }, 0);
  const topScores = okItems
    .map((o) => o.env.top_score)
    .filter((score): score is number => typeof score === "number" && Number.isFinite(score));
  const bestScore = topScores.length > 0 ? Math.max(...topScores) : undefined;
  const totalPassages = okItems.reduce((sum, o) => sum + (o.env.snippets?.length ?? 0), 0);
  return {
    status: "ok",
    provider: firstOk.provider,
    ...(sharedQuestion ? { question: sharedQuestion } : {}),
    results,
    meta: {
      ...(firstOk.meta ?? {}),
      ...(hasBlockedCount ? { blocked_count: blockedTotal } : {}),
      ...(bestScore !== undefined ? { top_score: bestScore } : {}),
      match_quality: matchQuality(bestScore, totalPassages),
      per_query: perQuery,
    },
  };
}
