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

## Fetch and extraction fidelity

- Make `detect_date` reach the crawl and extract paths, and consult document
  metadata when HEAD redirects (`F-R4-C-4`, `F-R4-C-6`).
- Serve the cached copy for a repeated `question` request and reject a
  JSON-string array before raw mode runs it as a batch (`F-R4-C-5`,
  `F-R4-D-4`).
- Keep nested microdata items distinct and name an infobox-derived fact
  differently from a table-derived one (`F-R4-C-11`, `F-R4-E-2`).

**Trigger:** start with the next change to the `fetch_page` response envelope
or `src/extract.ts`; close when each named row is fixed with a driving test or
re-dispositioned as a standing limitation.

## Corroboration, citation, and benchmark fidelity

- Make `priority:"privacy"` respect a caller's provider allowlist and give
  `priority:"quality"` a defined effect (`F-R5-A-3`).
- Grade a source that arrives with a hash, carry a finding index on
  `provenance.sources[]`, and stop awaiting archive and snapshot work inline
  (`F-R5-C-4`, `F-R5-C-6`, `F-R5-C-8`).
- Stop truncating the academic chain at `fallback_depth`, merge a DOI-bearing
  and a title-only reference to the same work, and let a reconciler failure
  fail the benchmark rather than score the raw order (`F-R5-E-1`, `F-R5-E-2`,
  `F-R5-F-1`).

**Trigger:** start with the next change to `src/corroborate.ts`, `src/cite.ts`,
or `src/retrieval-benchmark.ts`; close when each named row is fixed with a
driving test or re-dispositioned as a standing limitation.

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
