# AAR — Corroboration confidence contract

**Review cap:** 2 passes (1 self + 1 cold); used 2 passes

## What happened

Executed plan revision 7 (`3b15ce36…` → final `0e35f26e…` plus the edits below)
in five change entries on `src/calibration.ts`, `src/corroborate.ts`,
`src/source-family.ts`, `infobroker.md`, and `scripts/calibrate-confidence.ts`,
with tests. The increment closes `ROADMAP.md` § Corroboration confidence
contract and dispositions its five register rows.

## Gate evidence

| Check | Result |
|---|---|
| `npx vitest run src/corroborate.test.ts src/source-family.test.ts src/calibration.test.ts` | PASS — 130 tests |
| `npm run test` (full) | PASS — 128 files, 1545 tests, 25.3 s |
| `npm run typecheck` | PASS |
| `npm run validate-spec` | PASS — 142 REQs, 0 undocumented source files |
| `npm run validate-readme` | PASS — 0 errors, 0 warnings |
| `npm run check-roadmap` | OK — 6 sections |
| `npm run check-loop-artifacts` | 0 errors, 1 pre-existing warning (2026-11-10 increment) |
| `npx tsx scripts/calibrate-confidence.ts` (before C4) | `brier_score: 0.1892`; bands `0.3-0.5 n=3 0.30/0.33`, `0.7-0.9 n=4 0.70/0.75`, `0.9-1.0 n=5 0.92/0.80` |
| `npx tsx scripts/calibrate-confidence.ts` (after C4) | `brier_score: 0.1865`; bands `0.0-0.3 n=3 0.28/0.33`, `0.5-0.7 n=4 0.66/0.75`, `0.7-0.9 n=3 0.88/0.67`, `0.9-1.0 n=2 0.95/1.00` |
| `npm run check` (full) | PASS — all gates |

## Red-before evidence

Each new assertion failed before its change:

- C2: three `src/source-family.test.ts` assertions failed (containment scored
  `1.0`, symmetry absent, the excerpt merged into the article's family).
- C1: 11 assertions failed across `computeConfidence` and the reconciliation
  layer (multiplier values, empty-list `NaN`, mismatched-family order,
  one-source `0.3`, zero-source `0.3`).
- C4: no red state by construction — `buildCalibrationReport` did not exist, so
  the evidence is the recorded before/after runs above. The report test pins
  hand-computed literals instead.

## Findings and dispositions

| ID | Severity | Finding | Disposition |
|---|---|---|---|
| F-R5-B-8 | P2 | Asymmetric containment merged a contained snippet into the article's family | Resolved — `shared / max` |
| F-R5-B-9 | P2 | `web_search: 0.7` turned the 0.7 rung into 0.49 and no web-only set could clear the gate | Resolved — bounded adjustment; cap preserved |
| F-R5-G-2 | P2 | §8.2 omitted the secondary-only cap | Resolved — prose states the cap, its default, and its key |
| F-R5-G-3 | P2 | §8.1 gave contested findings `confidence: low` | Resolved — prose states the dominant-cluster rule |
| F-R5-G-4 | P2 | §8.1 described `red` as "the gaps" | Resolved — bands and the unsourced exclusion documented |
| A-7 | — | Zero-source findings reported `0.3` | Resolved — `0.0`; full suite confirmed no fixture encoded the old value |
| Gate | P1 | The plan gate had no cold-pass token for revision 7 | **Risk accepted** by the user (directive "execute plan") and recorded as the plan-gate condition; see below |

## Review record

The cold pass ran 9 dispatches: Stage 1 (FAILED), Stage 2 (passed with one
Major), Stage 3 critics (5 Blockers), Stage 1 re-audit, Stage 4 (FAILED),
Stage 5 (NO-GO), Stage 4 and Stage 5 re-audits (NO-GO), and an authorised final
Stage 5 (NO-GO, 2 Blockers). Preparation used more than the skill's
7-dispatch budget; the overage is recorded in `plan.cold/report.md`.

**Risk accepted:** no cold token for revision 7 — independence only, all
content findings fixed. Authorized by the user on 2026-11-14.

## What went right

- The cold pass caught two classes of defect that would have shipped broken
  behaviour: the secondary-only cap silently defeating the plan's own headline
  test, and `reconcileClaims`' `0.5` default flipping every verdict assertion.
- Writing the C2 and C1 tests before the code produced unambiguous red states;
  the reconciliation-layer fixtures needed two corrections (clustering, then
  family separation) before they tested what they claimed.
- The full suite confirmed A-7 with no fixture churn.

## What went wrong

- The plan's worked arithmetic for the calibration fixture was wrong
  (`0.4439`; the true value is `0.44408515625`). The test pins the computed
  value and this AAR records the correction.
- The plan claimed the pre-change calibration run was "the raw ladder"; the
  script already applied the cap, which happens to bind on no entry in this
  gold set. The before/after rows above are the accurate record.
- One roadmap edit inserted a duplicate section and was corrected before the
  gate run.

## Deviations from plan

1. The C2 family-count assertion lives in both `src/source-family.test.ts`
   (direct) and `src/corroborate.test.ts` (reconciliation level).
2. `src/calibration.test.ts` imports `computeConfidence` so the shipped-weight
   literals are asserted against the same function the runtime uses.
3. `AUTHORITY_DAMPING` is exported (the plan named `DAMPING`); the exported name
   states what it damps.
4. `buildCalibrationReport` defaults `options` to `{ enabled: true }` rather
   than an empty object, so a caller that omits options still gets the shipped
   correction.

## Follow-ups

- `ROADMAP.md` § Calibration gold-set refresh — re-derive the `correct` labels
  against the adjusted curve and measure the truncated-excerpt case.
- The 202-unpushed-commit backlog is unaffected; publishing remains a separate
  user-authorized step.

LOOP PAUSED
