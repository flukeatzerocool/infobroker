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

## Review-loop convergence

- Cap the cold-review loop inside the plan itself (for example, one re-audit of a failed stage) and record the cap in the increment AAR, instead of letting the number of passes be an agent judgement.
- Narrow a multi-finding increment at the first blocker that belongs to one finding's evidence rather than revising the combined scope again.

**Trigger:** start with the next increment that plans a multi-finding remediation; close when an increment records a cap and stops at it.

## Hermetic test option forwarding

- Make the dispatch-orchestration `setup()` forward every config option a caller passes, or reject an unknown option rather than dropping it silently.
- Add a case that fails today, so a dropped `preservation` or `kb` option cannot quietly weaken a fixture.

**Trigger:** start with the next increment that touches the hermetic harness; close when an unknown option is forwarded or rejected with a test.

## Non-goals

Open-web scope boundary; the authoritative list lives in `DECISIONS.md`
under `## Scope Non-goals`.
