// @implements REQ-123
// Conservative confidence calibration. The shipped ladder is a heuristic, not
// a calibrated probability; until a gold-set review supports renumbering it,
// apply one documented correction: findings supported only by secondary or
// aggregated sources cannot exceed the configured cap.

export const SECONDARY_SOURCE_TYPES = new Set([
  "web_search",
  "news",
  "semantic",
  "synthesis",
]);

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
