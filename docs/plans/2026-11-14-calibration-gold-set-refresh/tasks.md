# Tasks — Calibration gold-set refresh (2026-11-14)

Plan: `plan.md` (same directory), revision 5.

## Preconditions

- [ ] `npm run status` and `npm run check` match the plan's Baseline section.
- [ ] Working tree clean at `edd0076`.
- [ ] Capture the baseline calibration run: `npx tsx scripts/calibrate-confidence.ts`.
- [ ] Seed `aar.md` with `**Review cap:** 2 passes; used 2` and `LOOP OPEN`,
      so `check-loop-artifacts` (inside `check:fast`) passes while the
      increment is in progress. Do not seed `LOOP PAUSED`.

## C1 — Ground the labels and re-derive the curve

- [ ] Extend `CalibrationEntry` in `src/calibration.ts` with **optional**
      `claim?`, `label_basis?` (union), `truth_sources?`, `truth_note?` so the
      existing inline literals at `src/calibration.test.ts:60-73` still compile.
- [ ] Export `ValidatedGoldEntry` (required `claim`/`label_basis`) and
      `parseGoldSet(parsed, weights)` validating: `version === 2`, unique
      non-empty `id`, non-empty `claim`, rung vs `sources.length` (`1→0.3`,
      `2→0.7`, `3–4→0.9`, `5+→1.0`), source types present in `weights` and not
      repeated, `truth_sources` non-empty `http(s)` URLs on
      `documented`/`observed` and absent on `constructed`, `truth_note` on
      `constructed`; throw with the `id`.
- [ ] Move `loadShippedSettings()` ahead of the gold parse in
      `scripts/calibrate-confidence.ts`; replace `loadGold` with
      `const { weights } = loadShippedSettings(); const entries =
      parseGoldSet(JSON.parse(readFileSync(gold, "utf-8")), weights);`; keep the
      output lines unchanged.
- [ ] Re-derive all 12 existing rows from documented claims (one proposition
      and one settling source set each); correct `c09` and `c12` from rung
      `0.7` to `0.9`.
- [ ] Add six rows: `n0` 0.9-rung true and `n1` 0.9-rung false
      (`academic`/`encyclopedia`/`archive`), `n2` two-family false
      (`web_search`+`news`, 0.7), `n3` single-source damped true
      (`web_search`, 0.3), `n4`/`n5` 0.3-rung weight-1.0 (`academic`,
      `structured_fact`, one correct, one incorrect).
- [ ] Set `version: 2`, 18 entries, update the top-level `note`.
- [ ] Hoist `SHIPPED_WEIGHTS` in `src/calibration.test.ts`; add the fixture
      audit case (`parseGoldSet` → `buildCalibrationReport` with the shipped
      options, `entries === 18`, fields, five bands ≥2, mixed top band,
      `toBeCloseTo` Brier) and the projection drift guard over weights plus the
      `calibration` block; rewrite the needs-no-config comment at lines 40-42.
- [ ] Add `parseGoldSet` cases: valid fixture; missing claim; bogus basis;
      duplicate id; unknown source type; repeated source type within one row;
      rung/family mismatch; `constructed` without `truth_note`; `constructed`
      with `truth_sources`; `observed` without `truth_sources`; message names
      the id.
- [ ] Add the one-family `0.2775` literal to `src/calibration.test.ts`
      (`0.6475` is already pinned at line 96). This is C1, not C2.
- [ ] Update `test-fixtures/calibration/README.md` (fields, provenance gap,
      rung rule, `0.3-0.5` boundary).
- [ ] Run `npx tsx scripts/calibrate-confidence.ts` after the fixture is final;
      record the after-run and write the Brier literal into the test.
- [ ] Probe invalid input with three `$TMPDIR` copies and record exit codes
      and messages:
      `npx tsx scripts/calibrate-confidence.ts --gold "$TMPDIR/gold-missing-claim.json"`,
      the same with `gold-bad-basis.json`, and the same with
      `gold-duplicate-id.json`.
- [ ] Gate: `npm run check:fast`.
- [ ] Commit: `fix(calibration): ground gold-set labels and re-derive the curve`.

## C2 — Pin the excerpt measurement (revert pair with C3)

- [ ] Add the split case to `src/source-family.test.ts` with the fixed article,
      excerpt, title, and cross-domain URLs; call
      `textSimilarity(title + " " + article, title + " " + excerpt)` and
      `assignSourceFamilies(pair, 0.9)`; assert `0.3721` (46/43 vs 19/16 tokens
      and four-gram shingles, `16/43`) and family count 2.
- [ ] Gate: `npm run check:fast`.
- [ ] Commit: `test(source-family): pin the truncated-republication measurement`.

## C3 — State the measurement in the spec (revert pair with C2)

- [ ] Add one §8.2 sentence with the exact literals `0.3721`, `0.6475`,
      `0.2775`.
- [ ] Gate: `npm run check:fast`.
- [ ] Commit: `docs(spec): record the measured excerpt split in §8.2`.

## C4 — Bookkeeping

- [ ] `CHANGELOG.md` entry, including a sentence stating both roadmap limbs as
      met.
- [ ] Remove the roadmap section.
- [ ] Finalize `aar.md`: before/after runs, the three probe results, the
      excerpt measurement, the review-cap line, and the terminal token.
- [ ] Gate: `npm run check:fast`.
- [ ] Commit: `docs(plans): close the calibration gold-set refresh`.

## Close

- [ ] Full `npm run check` on the final tree.
- [ ] Confirm both roadmap limbs and the done bar.
