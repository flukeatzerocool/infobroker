// @implements REQ-123 REQ-026a
// Confidence calibration and authority adjustment. The shipped ladder is a
// heuristic, not a calibrated probability. Two documented corrections apply:
// (1) REQ-026a scales a finding's rung by the authority of its corroborating
// source families, bounded so the scaling cannot drop a rung below the
// confirmation threshold; (2) REQ-123 caps findings supported only by
// secondary or aggregated sources.

export const SECONDARY_SOURCE_TYPES = new Set([
  "web_search",
  "news",
  "semantic",
  "synthesis",
]);

/**
 * Authority damping. A finding reports `base × (1 − DAMPING × (1 − mean))`,
 * where `mean` is the mean of one weight per source family. Chosen as the
 * largest round value that keeps the 0.9 rung at least 0.03 above the shipped
 * 0.8 threshold at the lowest shipped weight (0.9 × 0.925 = 0.8325); the
 * mathematical ceiling is ≈0.370, which sits exactly on the threshold. It is a
 * code constant, not a configuration key: a knob would need a REQ, a spec
 * declaration, and a reconciliation pair for no operator demand.
 */
export const AUTHORITY_DAMPING = 0.25;

function clampWeight(weight: number): number {
  // A configured weight is only meaningful on [0, 1]; above 1 it would amplify
  // a rung instead of damping it, and NaN passes the config validator's type
  // check, so it folds to the neutral weight.
  if (!Number.isFinite(weight)) return 1.0;
  return Math.min(1, Math.max(0, weight));
}

/**
 * REQ-026a: apply the bounded authority adjustment to an independence rung.
 * `familyWeights` carries one weight per source family (the caller resolves a
 * mismatched-type family to its maximum). An empty list returns the rung
 * unchanged, which keeps the no-source case at the ladder's row 0.
 */
export function applyAuthorityWeight(base: number, familyWeights: number[]): number {
  if (familyWeights.length === 0) return base;
  const mean = familyWeights.reduce((sum, w) => sum + clampWeight(w), 0) / familyWeights.length;
  return base * (1 - AUTHORITY_DAMPING * (1 - mean));
}

export interface CalibrationSource {
  source_type?: string;
  original_source?: string;
}

export interface CalibrationOptions {
  enabled?: boolean;
  secondaryOnlyCap?: number;
}

export function isSecondaryOnly(sources: CalibrationSource[]): boolean {
  if (sources.length === 0) return false;
  return sources.every(
    (s) =>
      s.source_type !== undefined &&
      SECONDARY_SOURCE_TYPES.has(s.source_type) &&
      !s.original_source,
  );
}

export function capConfidence(
  base: number,
  sources: CalibrationSource[],
  options: CalibrationOptions = {},
): number {
  if (options.enabled === false) return base;
  if (!isSecondaryOnly(sources)) return base;
  const cap = options.secondaryOnlyCap ?? 0.7;
  return Math.min(base, cap);
}

export function brierScore(predictions: Array<{ confidence: number; correct: boolean }>): number {
  if (predictions.length === 0) return 0;
  const total = predictions.reduce((sum, p) => {
    const outcome = p.correct ? 1 : 0;
    return sum + (p.confidence - outcome) ** 2;
  }, 0);
  return total / predictions.length;
}

export interface ReliabilityBucket {
  band: string;
  count: number;
  meanConfidence: number;
  observedRate: number;
}

export function reliabilityCurve(
  predictions: Array<{ confidence: number; correct: boolean }>,
): ReliabilityBucket[] {
  const buckets = [
    { band: "0.0-0.3", lo: 0, hi: 0.3 },
    { band: "0.3-0.5", lo: 0.3, hi: 0.5 },
    { band: "0.5-0.7", lo: 0.5, hi: 0.7 },
    { band: "0.7-0.9", lo: 0.7, hi: 0.9 },
    { band: "0.9-1.0", lo: 0.9, hi: 1.01 },
  ];
  return buckets.map(({ band, lo, hi }) => {
    const rows = predictions.filter((p) => p.confidence >= lo && p.confidence < hi);
    const count = rows.length;
    return {
      band,
      count,
      meanConfidence: count === 0 ? 0 : rows.reduce((s, p) => s + p.confidence, 0) / count,
      observedRate: count === 0 ? 0 : rows.filter((p) => p.correct).length / count,
    };
  });
}

export type GoldLabelBasis = "documented" | "constructed" | "observed";

export interface CalibrationEntry {
  id: string;
  confidence: number;
  correct: boolean;
  sources: string[];
  claim?: string;
  label_basis?: GoldLabelBasis;
  truth_sources?: string[];
  truth_note?: string;
}

/**
 * A gold-set entry after `parseGoldSet` has validated it. `claim` and
 * `label_basis` are present on every committed row; `truth_sources` is present
 * on `documented`/`observed` rows and `truth_note` on `constructed` rows.
 */
export interface ValidatedGoldEntry extends CalibrationEntry {
  claim: string;
  label_basis: GoldLabelBasis;
}

const LADDER_RUNG_FOR_FAMILIES = (count: number): number => {
  if (count >= 5) return 1.0;
  if (count >= 3) return 0.9;
  if (count === 2) return 0.7;
  if (count === 1) return 0.3;
  return 0.0;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * REQ-123: validate a committed gold set and return its entries.
 *
 * The label is the truth of the stated `claim`, settled by `truth_sources`;
 * `confidence` must be the ladder rung implied by the family count, and every
 * source type must be a configured authority key. `weights` is the shipped
 * `corroboration.authority_weights` map, so an unknown (typically misspelled)
 * type fails here instead of silently taking the `?? 1.0` fallback and moving
 * the row's reliability band.
 */
export function parseGoldSet(
  raw: unknown,
  weights: Record<string, number>,
): ValidatedGoldEntry[] {
  if (!isRecord(raw)) throw new Error("gold set must be a JSON object");
  if (raw["version"] !== 2) throw new Error("gold set version must be 2");
  const entries = raw["entries"];
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error("gold set must contain a non-empty 'entries' array");
  }
  const seen = new Set<string>();
  const weightKeys = new Set(Object.keys(weights));
  return entries.map((entry: unknown): ValidatedGoldEntry => {
    if (!isRecord(entry)) throw new Error("invalid gold entry: not an object");
    const id = entry["id"];
    if (typeof id !== "string" || id.length === 0) {
      throw new Error("invalid gold entry: missing non-empty 'id'");
    }
    if (seen.has(id)) throw new Error(`invalid gold entry ${id}: duplicate id`);
    seen.add(id);
    const claim = entry["claim"];
    if (typeof claim !== "string" || claim.length === 0) {
      throw new Error(`invalid gold entry ${id}: missing non-empty 'claim'`);
    }
    const basis = entry["label_basis"];
    if (basis !== "documented" && basis !== "constructed" && basis !== "observed") {
      throw new Error(`invalid gold entry ${id}: unknown label_basis`);
    }
    const confidence = entry["confidence"];
    const correct = entry["correct"];
    const sources = entry["sources"];
    if (typeof correct !== "boolean") {
      throw new Error(`invalid gold entry ${id}: 'correct' must be a boolean`);
    }
    if (!Array.isArray(sources) || sources.length === 0) {
      throw new Error(`invalid gold entry ${id}: 'sources' must be a non-empty array`);
    }
    for (const source of sources) {
      if (typeof source !== "string") {
        throw new Error(`invalid gold entry ${id}: source type must be a string`);
      }
      if (!weightKeys.has(source)) {
        throw new Error(`invalid gold entry ${id}: unknown source type '${source}'`);
      }
    }
    if (new Set(sources).size !== sources.length) {
      throw new Error(
        `invalid gold entry ${id}: repeated source type breaks the one-label-per-family premise`,
      );
    }
    const rung = LADDER_RUNG_FOR_FAMILIES(sources.length);
    if (typeof confidence !== "number" || confidence !== rung) {
      throw new Error(
        `invalid gold entry ${id}: confidence ${String(confidence)} is not the rung ${rung} for ${sources.length} source families`,
      );
    }
    const truthSources = entry["truth_sources"];
    const truthNote = entry["truth_note"];
    if (basis === "constructed") {
      if (truthSources !== undefined) {
        throw new Error(`invalid gold entry ${id}: constructed rows carry no truth_sources`);
      }
      if (typeof truthNote !== "string" || truthNote.length === 0) {
        throw new Error(`invalid gold entry ${id}: constructed rows require a truth_note`);
      }
    } else {
      if (!Array.isArray(truthSources) || truthSources.length === 0) {
        throw new Error(`invalid gold entry ${id}: ${basis} rows require truth_sources`);
      }
      for (const url of truthSources) {
        if (typeof url !== "string" || !/^https?:\/\//.test(url)) {
          throw new Error(`invalid gold entry ${id}: truth_sources must be http(s) URLs`);
        }
      }
    }
    if (truthNote !== undefined && typeof truthNote !== "string") {
      throw new Error(`invalid gold entry ${id}: 'truth_note' must be a string`);
    }
    return {
      id,
      claim,
      confidence,
      correct,
      sources,
      label_basis: basis,
      ...(truthSources === undefined ? {} : { truth_sources: truthSources as string[] }),
      ...(truthNote === undefined ? {} : { truth_note: truthNote }),
    };
  });
}

export interface CalibrationRow {
  id: string;
  raw: number;
  adjusted: number;
  correct: boolean;
}

export interface CalibrationReport {
  entries: number;
  brier_score: number;
  reliability: ReliabilityBucket[];
  rows: CalibrationRow[];
}

/**
 * REQ-123 / REQ-026a: build the calibration report over a gold set. Each entry
 * records a finding's confidence and the source types behind it; the reported
 * value applies the authority adjustment and the secondary-only cap, and the
 * raw rung is kept beside it so a pre-change run stays comparable.
 *
 * The gold set's premise is one label per source family (no entry repeats a
 * type), which is what makes the per-label mean equal the per-family mean that
 * `computeConfidence` uses.
 */
export function buildCalibrationReport(
  entries: CalibrationEntry[],
  weights: Record<string, number>,
  options: CalibrationOptions = { enabled: true },
): CalibrationReport {
  const rows: CalibrationRow[] = entries.map((entry) => {
    const sources: CalibrationSource[] = entry.sources.map((type) => ({ source_type: type }));
    const familyWeights = entry.sources.map((type) => weights[type] ?? 1.0);
    const adjusted = capConfidence(
      applyAuthorityWeight(entry.confidence, familyWeights),
      sources,
      options,
    );
    return { id: entry.id, raw: entry.confidence, adjusted, correct: entry.correct };
  });
  const predictions = rows.map((row) => ({ confidence: row.adjusted, correct: row.correct }));
  return {
    entries: rows.length,
    brier_score: brierScore(predictions),
    reliability: reliabilityCurve(predictions),
    rows,
  };
}
