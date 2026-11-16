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

## Non-goals

Open-web scope boundary; the authoritative list lives in `DECISIONS.md`
under `## Scope Non-goals`.

## KB recall relevance floor

- Measure recall over a stored-chunk corpus; a low-relevance or binary hit must not satisfy KB-first sufficiency.
- Feed the measurement into the sufficiency threshold rather than a hand-set number.

**Trigger:** a benchmark shows a binary or unrelated chunk satisfying KB-first sufficiency.

## Untrusted-content provenance marker

- Mark returned external text in-band so a consuming agent can tell data from instructions.
- Keep the marker additive and out of the result payload.

**Trigger:** a client skill reports treating fetched page text as instructions.

## Reconciler origin grouping

- Inventory every producer of `original_source` (the generic normalizer mapping, `field_map`, provider fallbacks) and define a value that identifies a document rather than a publisher, section, or feed.
- Group results by that value before similarity, with a rule for section and feed URLs and for path case.

**Trigger:** the inventory shows `original_source` carries a document-identifying URL for at least one enabled provider.
