# Calibration gold set (REQ-123)

`gold.json` is a deterministic, offline calibration set. Each entry records a
claim, its truth, the raw confidence rung, and the source types used.
`scripts/calibrate-confidence.ts` validates the file through `parseGoldSet`,
applies the authority adjustment and the secondary-only cap, and reports a
Brier score and a reliability curve.

Run:

```sh
npx tsx scripts/calibrate-confidence.ts
```

Retrieval quality is measured separately by `test-fixtures/retrieval/`
(REQ-130); this file covers confidence calibration only.

## v2 fields

- `claim` — the proposition the finding asserted.
- `correct` — the truth of that claim. It is **not** derived from the reported
  confidence; `truth_sources` settles it.
- `confidence` — the raw ladder rung, which must be the rung implied by the
  number of source families: 1 → `0.3`, 2 → `0.7`, 3–4 → `0.9`, 5+ → `1.0`.
- `sources` — one source type per family, each a configured
  `corroboration.authority_weights` key, with no repeated type.
- `label_basis` — `documented` (truth settled by `truth_sources`),
  `constructed` (a mechanics-only row with a stipulated outcome and a
  `truth_note`), or `observed` (a recorded verification run).

## Reading the curve

A `documented` row still stipulates its `confidence` and `sources`; only the
outcome is documented. Until `observed` rows exist, the Brier score is a
mechanics value and a regression lock, not a claim that the confidence ladder
is calibrated for production. Add real verified runs as `observed` rows before
treating it as a quality metric.

The reliability bands are half-open. A `0.3`-rung row backed by a weight-`1.0`
source type reports exactly `0.3000` and therefore lands in `0.3-0.5`; a
`0.3`-rung row backed by a damped type (`news`, `web_search`, `semantic`)
reports `0.2775`–`0.2925` and lands in `0.0-0.3`.
