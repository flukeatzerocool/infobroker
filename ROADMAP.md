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

## Corroboration confidence contract

- Reconcile the shipped confidence weights with the spec ladder: `web_search: 0.7` turns a two-family base 0.7 into 0.49, below the confirm threshold (`F-R5-B-9`).
- Fix `textSimilarity`'s asymmetric containment, so a snippet contained in a long article stops merging into that article's family (`F-R5-B-8`).
- Align §8.1/§8.2 prose with the code on contested confidence, the agreement-map `red` definition, and the omitted secondary-only calibration cap (`F-R5-G-2`, `F-R5-G-3`, `F-R5-G-4`).

**Trigger:** start when a calibration run reports a Brier score or curve that diverges from the server's configured correction, or when a confidence tier is disputed; close when the shipped defaults and the prose agree and each branch is asserted.

## Fetch and KB resource bounds

- Bound `sqliteSearch` so a broad query over an oversize store stops accumulating matches before it slices (`F-R6-E-4`), and make the crawl page cap count outbound fetches rather than returned pages (`F-R4-C-8`).
- Cancel hedge losers once the deadline fires, so they stop spending quota and recording stats (`F-R4-B-1`).
- Validate `freshness.default_tier` against the known tier names instead of accepting any string (`F-R6-C-1`).

**Trigger:** start with a broad-query memory or latency report, or the next increment that touches the KB store; close when a bounded-store test passes.

## KB migration preservation decision

- Decide whether REQ-084's no-plaintext rule or the migration's clause-(b) artifact preservation wins when encryption is enabled at upgrade time, then implement the winner (`F-R6-E-2`).

**Trigger:** start with the next change to `src/kb-migrate.ts`; close when the spec and the unlink step agree.

## Missing test evidence across R4–R6

- Close the pure evidence rows left in the full-review register — six in R4, twelve in R5, two in R6 — each a missing driving test or clause tag rather than a behavior change.
- Batch by module, so each commit is one test file and its tags.

**Trigger:** start with a regression that a missing test would have caught, or the next increment in the same module; close when the register holds no open evidence-only row.

## Full-review register reconciliation

- Retire the register rows already fixed in code — `F-R5-C-5` still reads `Scheduled-roadmap` although `src/corroborate.ts:958` writes the tier — and re-home every surviving row.
- Resolve `F-M1-3`, whose description records `Resolved 2026-11-10` while its disposition column still says `Scheduled-roadmap`.

**Trigger:** start when a register row is cited as open and the tree disagrees; close when the disposition census and the live tree agree.

## Non-goals

Open-web scope boundary; the authoritative list lives in `DECISIONS.md`
under `## Scope Non-goals`.
