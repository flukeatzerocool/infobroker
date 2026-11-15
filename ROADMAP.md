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

## Shape selection under conflicting signals

- Two repo-mode scenarios routed to a neighbouring shape: a vetting request
  escalated to `analysis-loop` (S6), and a gated request over a false premise
  answered as a fact-check (N4). Both answers were safe; both emitted the
  wrong shape's completion token and block (`docs/research-evidence-2026-11-15.md`).
- Start with Phase 0 classification in `skills/infobroker/SKILL.md`: name the
  deciding signal when a request's phrasing ("rigorous gated research") and
  its content (verify a claim that may be false) point at different shapes.

**Trigger:** start with the next skill change; close when a repo-mode run of
S6 and N4 emits the manifest's shape token, or when a deliberate divergence is
recorded in `DECISIONS.md`.

## Non-goals

Open-web scope boundary; the authoritative list lives in `DECISIONS.md`
under `## Scope Non-goals`.
