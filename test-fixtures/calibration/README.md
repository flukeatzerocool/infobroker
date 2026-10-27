# Calibration gold set (REQ-123)

`gold.json` is a deterministic, offline calibration set. Each entry records a
raw confidence, whether the finding was correct, and the source types used.
`scripts/calibrate-confidence.ts` applies the secondary-only cap and reports a
Brier score and a reliability curve.

Run:

```sh
npx tsx scripts/calibrate-confidence.ts
```

Retrieval quality is measured separately by `test-fixtures/retrieval/`
(REQ-130); this file covers confidence calibration only.

The set is intentionally small and hand-authored. It verifies the correction's
mechanics and gives a baseline for future expansion; it is not a claim that the
confidence ladder is calibrated for production. Expand it with real verified
claims before treating the Brier score as a quality metric.
