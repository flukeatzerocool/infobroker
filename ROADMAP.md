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

## Close the parity record

- Add a surface / evidence / measurement table per §1 function to
  `docs/goal-evidence-matrix.md`, and convert `REQ-123` labels to `observed`
  where a recorded verification run exists.
- Update the README tour, `CHANGELOG.md`, and `DECISIONS.md` for the direction
  precedence and the processing block.

**Trigger:** the next documentation pass; close when `npm run check` is green
with the table in place.

## Non-goals

Open-web scope boundary; the authoritative list lives in `DECISIONS.md`
under `## Scope Non-goals`.
