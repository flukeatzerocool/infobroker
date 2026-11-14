# Roadmap

<!--
  Admission rule: a `## <title>` section is a scheduled work item. It needs an
  action a maintainer can take, 1–3 bullet lines, and a `**Trigger:**` line
  naming what starts the work or what closes it. Priority order, P0 first;
  remove a section when the work ships (it moves to CHANGELOG.md).

  Standing facts are not roadmap items: accepted dependency advisories and
  by-design limitations are recorded in DECISIONS.md, and a review cites the
  decision rather than filing a roadmap entry. `npm run check-roadmap`
  enforces this rule; `## Non-goals` is exempt from it because
  `npm run check-non-goals` verifies that section as a pointer to the
  `## Scope Non-goals` block in DECISIONS.md.
-->

## Full-review register reconciliation

- Retire the register rows already fixed in code — `F-R5-C-5` still reads `Scheduled-roadmap` although `src/corroborate.ts:958` writes the tier — and re-home every surviving row.
- Resolve `F-M1-3`, whose description records `Resolved 2026-11-10` while its disposition column still says `Scheduled-roadmap`.
- Strengthen `clauseTagsFromPayload`: it registers only the token after the REQ ID and cannot bind a tag to a test that drives the branch, so a tag on an unrelated test satisfies the G3 count (recorded from `F-R4-E-3`).

**Trigger:** start when a register row is cited as open and the tree disagrees; close when the disposition census and the live tree agree.

## Calibration gold-set refresh

- Re-derive the gold set's `correct` labels against the post-adjustment curve:
  the entries were judged against the pre-damping ladder, and the `0.9-1.0`
  band now holds two entries instead of five.
- Measure the truncated-excerpt family case (§8.2, D2 trade): a genuinely
  republished article seen through a short snippet may no longer collapse into
  one family, which raises confidence.

**Trigger:** start with the next change to `test-fixtures/calibration/gold.json`
or `src/source-family.ts`; close when the labels and the curve are re-derived
and the excerpt case has a recorded measurement.

## Non-goals

Open-web scope boundary; the authoritative list lives in `DECISIONS.md`
under `## Scope Non-goals`.
