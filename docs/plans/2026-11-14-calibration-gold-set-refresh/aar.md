# AAR — Calibration gold-set refresh

**Review cap:** 2 passes; used 2 passes (1 self + 1 cold), plus one Stage 5 re-audit authorized past the read cap.

**Date:** 2026-11-14 · **Plan:** revision 5 (`plan.md`)

## What was supposed to happen

Close `ROADMAP.md` § Calibration gold-set refresh: re-derive every `correct`
label against a documented claim, re-run the reliability curve, and record a
measurement of the truncated-excerpt family trade from §8.2.

## Baseline

- `HEAD edd0076`, clean tree, version `2026.11.14` (tag `v2026.11.07`), 259
  unpushed commits.
- `npm run check` → PASS, full, 22 gates, 163.0 s (run record `edd00765471c`).
- `npx tsx scripts/calibrate-confidence.ts` → `entries: 12`,
  `brier_score: 0.1865`, bands `3/0/4/3/2`.

## After

`npx tsx scripts/calibrate-confidence.ts` (before C1, after the fixture was
final and before commit 1):

```
entries: 18
brier_score: 0.2525
0.0-0.3 count=4 mean=0.28 observed=0.50
0.3-0.5 count=2 mean=0.30 observed=0.50
0.5-0.7 count=3 mean=0.66 observed=0.33
0.7-0.9 count=5 mean=0.81 observed=0.80
0.9-1.0 count=4 mean=0.92 observed=0.75
```

The top band holds four rows, three correct (`c04`, `c07`, `n0`) and one
incorrect (`n1`); all five bands hold at least two entries. The Brier score
rose from `0.1865` to `0.2525` because the new labels are settled by sources
rather than chosen to fit the curve — the rise is the point, not a regression.

## Invalid-input probes

| Probe | Exit | Message |
|---|---|---|
| `gold-missing-claim.json` | 1 | `invalid gold entry c01: missing non-empty 'claim'` |
| `gold-bad-basis.json` | 1 | `invalid gold entry c01: unknown label_basis` |
| `gold-duplicate-id.json` | 1 | `invalid gold entry c01: duplicate id` |

## Excerpt measurement

Fixed pair: 43-word article, 14-word excerpt, shared headline, cross-domain
URLs. Compared as `title + " " + snippet` (46/43 vs 19/16 tokens and four-gram
shingles) → `0.3721`; `assignSourceFamilies(pair, 0.9)` → 2 families. The
confidence consequence, pinned in `src/calibration.test.ts`, is `0.2775` (one
`web_search` family) versus `0.6475` (two). The same literals are stated in
`infobroker.md` §8.2.

## Deviations from plan

1. **§8.2 had no prior trade sentence.** The revised plan said to add the
   measured sentence "after the existing truncated-republication trade
   statement"; that statement exists in `src/source-family.ts`, not in the
   spec prose. The sentence was added after the family-count discussion, which
   is the same location in substance.
2. **`CalibrationEntry` narrowing.** `ValidatedGoldEntry` extends
   `CalibrationEntry`; the optional fields on the latter keep the pre-existing
   inline literals compiling, exactly as revision 5 specified.
3. **Gold-set content.** The 18 claims and their `truth_sources` are
   authoring-time content; every claim is a well-known proposition with a
   Wikipedia article that settles it. No URL was fetched by a test, keeping
   the run deterministic.

## Review record

- Self pass + one cold pass (5 stages): Stage 5 NO-GO on revision 3, 5
  Blockers; authorized Stage 5 re-audit on revision 4, 3 Blockers; revision 5
  resolves all of them and is not cold-certified. Record:
  `plan.cold/report.md`.
- Gate: `plan-review passed` with `risk accepted: no cold pass — authorized by
  the user on 2026-11-14` (D-117). build-review §0 verified the revision-5
  fixes before commit 1.

## Gates

| Commit | Gate | Result |
|---|---|---|
| C1 | `tsc --noEmit`, `vitest run src/calibration.test.ts`, `calibrate-confidence`, probes, `check:fast` | 0 / 23 passed / 18 entries, 0.2525 / 3× exit 1 / PASS |
| C2 | `vitest run src/source-family.test.ts src/calibration.test.ts` | 36 passed |
| C3 | `validate-spec`, `validate-readme` | 0 / 0 |
| C4 | `check:fast`, full `check` | PASS (19 gates, 32.6 s) / PASS (full, 22 gates, 171.9 s, run record `1f3263356b7d`) |

## Findings register

| Finding | Disposition |
|---|---|
| Cold Stage 1/3/5 findings (labels circular, band boundary wrong, script inputs unbound, shard counts, commit split, drift guard, top-band contingency) | Resolved in revision 5; verified by the C1/C2 tests and the commit series |
| `check-loop-artifacts` reads the working tree and fails before `aar.md` exists | Resolved: `aar.md` seeded `LOOP OPEN` before commit 1, finalized here |
| `test-fixtures/calibration/gold.json` has no other consumer | Checked: repo-wide grep finds only the tool, the two fixture READMEs, `CHANGELOG.md`, and `ROADMAP.md` |

No open findings.

LOOP PAUSED
