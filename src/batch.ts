// @implements REQ-020 REQ-021
export const MAX_BATCH_INPUTS = 5;

export function capInputs(items: string[]): string[] {
  return items.slice(0, MAX_BATCH_INPUTS);
}

interface EnvelopeOk {
  status: "ok";
  provider: string;
  results: Array<{ url?: string; [k: string]: unknown }>;
  meta?: Record<string, unknown>;
  truncated?: boolean;
  output_path?: string;
}

interface EnvelopeError {
  status: "error";
  provider: string;
  error?: unknown;
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
  provider: string;
  status: "ok" | "error";
  result_count: number;
  truncated?: boolean;
  output_path?: string;
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
      env = { status: "error", provider: "system", error: { code: "internal_error", message: "batch item failed to parse" } };
    }
    if (env.status === "ok") {
      okItems.push({ query: item.query, env });
      perQuery.push({
        query: item.query,
        provider: env.provider,
        status: "ok",
        result_count: env.results.length,
        ...(env.truncated ? { truncated: true, output_path: env.output_path } : {}),
      });
    } else {
      if (!firstError) firstError = env;
      perQuery.push({ query: item.query, provider: env.provider, status: "error", result_count: 0 });
    }
  }

  if (okItems.length === 0) {
    return firstError ?? { status: "error", provider: "none", error: { code: "internal_error", message: "no results" } };
  }

  const firstOk = okItems[0].env;
  const results = dedupeByUrl(okItems.flatMap((o) => o.env.results));
  return {
    status: "ok",
    provider: firstOk.provider,
    results,
    meta: {
      ...(firstOk.meta ?? {}),
      per_query: perQuery,
    },
  };
}
