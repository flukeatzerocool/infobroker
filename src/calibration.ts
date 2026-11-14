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

export interface CalibrationEntry {
  id: string;
  confidence: number;
  correct: boolean;
  sources: string[];
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
