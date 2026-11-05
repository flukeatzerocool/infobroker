// @implements REQ-026h
// modality.ts — pure reading of a source claim's modality (REQ-026h). A source
// that hedges ("reportedly", "allegedly") or speculates ("may", "appears to")
// must not be rendered as a flat assertion, so corroboration reports the
// modality alongside the source and the report gate enforces any declared
// attribution. Advisory by design: modality never changes confidence, verdict,
// or source-family counts. No network, no clock.

export type SourceModality = "asserted" | "reported" | "speculative";

export interface ModalityMarkers {
  reported?: string[];
  speculative?: string[];
}

export interface ModalityReading {
  modality: SourceModality;
  /** The matched marker, when one fired. */
  marker?: string;
}

/**
 * Default marker lexicon. Attribution wins over possibility: a sentence that
 * both attributes and hedges ("reportedly may") is classified `reported`,
 * because the attribution is the stronger, checkable signal.
 */
export const DEFAULT_MODALITY_MARKERS: Required<ModalityMarkers> = {
  reported: [
    "reportedly",
    "allegedly",
    "according to",
    "says",
    "said",
    "claims",
    "claimed",
    "is said to",
    "are said to",
    "has reported",
    "reported that",
    "sources say",
  ],
  speculative: [
    "may",
    "might",
    "could",
    "appears to",
    "appear to",
    "seems to",
    "seem to",
    "possibly",
    "probably",
    "is believed to",
    "are believed to",
    "unconfirmed",
    "expected to",
  ],
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function firstMatch(text: string, markers: string[]): string | undefined {
  for (const marker of markers) {
    const trimmed = marker.trim();
    if (trimmed.length === 0) continue;
    // Word boundaries around the whole marker: "may" must not fire inside
    // "maybe", and a phrase must match as a phrase.
    const pattern = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(trimmed)}(?![\\p{L}\\p{N}])`, "iu");
    if (pattern.test(text)) return trimmed;
  }
  return undefined;
}

/** Merge a caller-supplied marker override over the default lexicon. */
export function resolveMarkers(overrides?: ModalityMarkers): Required<ModalityMarkers> {
  return {
    reported: overrides?.reported ?? DEFAULT_MODALITY_MARKERS.reported,
    speculative: overrides?.speculative ?? DEFAULT_MODALITY_MARKERS.speculative,
  };
}

/**
 * Classify one source claim. Empty text is `asserted` only when there is no
 * text to hedge; callers should omit modality entirely for empty text.
 */
export function readModality(
  text: string | undefined,
  overrides?: ModalityMarkers
): ModalityReading {
  const markers = resolveMarkers(overrides);
  const haystack = (text ?? "").trim();
  if (haystack.length === 0) return { modality: "asserted" };
  const reported = firstMatch(haystack, markers.reported);
  if (reported !== undefined) return { modality: "reported", marker: reported };
  const speculative = firstMatch(haystack, markers.speculative);
  if (speculative !== undefined) return { modality: "speculative", marker: speculative };
  return { modality: "asserted" };
}
