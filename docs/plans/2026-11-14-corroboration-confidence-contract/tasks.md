# Tasks — Corroboration confidence contract

Plan: `plan.md` (revision 7; cold Stages 1–5 findings resolved).
Done bar: `plan.md` §Done bar.

## T0 — baseline

- [x] `npm run status` → 2026.11.11, tag `v2026.11.07`, 202 unpushed, 5 roadmap items
- [x] `npm run check` → PASS (full, 22 gates, 159.1 s, record `04d4e2e6ac5c`); one pre-existing loop-artifact warning
- [x] `npx tsx scripts/calibrate-confidence.ts` → 12 entries, Brier 0.1892, `0.9-1.0` mean 0.92 / observed 0.80
- [x] Re-read and re-verified F-R5-B-8, F-R5-B-9, F-R5-G-2, F-R5-G-3, F-R5-G-4 against the working tree
- [x] Confirmed the secondary-only cap (`src/calibration.ts:7-43`) is behavior, not scope: only C3's prose changes
- [x] Confirmed the one-source branch bypasses `computeConfidence` (`src/corroborate.ts:289-293`)

## T0b — red-before probes (after approval, before any edit)

- [x] Add the C2 tests; record their failures
- [x] Add the C1 tests against `computeConfidence`; record their failures
- [x] Record the pre-change `calibrate-confidence` output (the "before" row)

## T1 — C2 symmetric family similarity (F-R5-B-8)

- [x] `src/source-family.ts` `textSimilarity` divides by `Math.max`
- [x] `src/source-family.test.ts`: containment below 0.9; identical 1.0; superset 1.0 → 0.909; truncated excerpt records the D2 trade
- [x] `src/corroborate.test.ts`: snippet contained in a long article → `family_count: 2`, on distinct registrable domains
- [x] The existing short-republish test still passes unchanged

## T2 — C1 bounded authority adjustment (F-R5-B-9)

- [x] `src/calibration.ts`: header names REQ-026a and two corrections; export `applyAuthorityWeight(base, familyWeights)` with `DAMPING = 0.25`, weight clamp, empty-array return
- [x] `src/corroborate.ts` `computeConfidence` builds one maximum weight per family and delegates
- [x] `src/corroborate.ts` one-source branch routes `0.3` through the adjustment
- [x] `src/corroborate.test.ts`: `0.49` → `0.6475`; `academic: 2.0` clamp still 1.0; invariants; empty array; order swap; one source
- [x] Reconcile-level cases set `authority_weights`, `source_type`, and `confidence_threshold: 0.8`

## T3 — C4 calibration measures the adjusted value

- [x] `scripts/calibrate-confidence.ts` reads weights via `loadConfig()` + `isolatedConfigEnv()`, applies the helper, emits raw and adjusted
- [x] `src/calibration.test.ts`: hand-computed literals `0.8325` / `0.6475`; helper equality; weight 1.0
- [x] Record the "after" row in `aar.md`

## T4 — C3 spec prose alignment (F-R5-G-2, F-R5-G-3, F-R5-G-4)

- [x] §8.1 contested confidence = dominant cluster, floor 0.1
- [x] §8.1 agreement map = green ≥ threshold, yellow `[0.5, threshold)`, red < 0.5, unsourced omitted entirely
- [x] §8.1 pseudocode `compute_confidence` signature corrected
- [x] §8.2 ladder + bounded adjustment + secondary-only cap + contested rule, with the five worked values
- [x] `npm run validate-spec` and `npm run validate-readme` green
- [x] README decision recorded (edit or "no change")

## T5 — C5 bookkeeping

- [x] `CHANGELOG.md` entry (date = package version)
- [x] Remove the roadmap section; add "Calibration gold-set refresh" with two bullets and a trigger
- [x] Register rows re-dispositioned to `Resolved`
- [x] `aar.md` with terminal token, passes used, and both calibration rows

## T6 — final tree

- [x] `npm run typecheck`, `npm run typecheck:scripts`, `npm run test`
- [x] `npm run check` (full) once, PASS
- [x] `npm run status` reported
