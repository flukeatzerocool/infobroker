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

## Lab repo mode inherits the deployed skills too

- `debate-club/scripts/lab.sh:125–145` builds the same run project as the
  research suite but declares no `skills`, so a repo-mode Lab run can exercise
  an installed copy; the same inline layer parsing sits at `:150–164`.
- Reuse `scripts/test-research/assert-skills.ts` and the run-project `skills`
  key rather than adding a second parser; refuse to run on a mismatch.

**Trigger:** start with the next Lab change; close when a repo-mode Lab run
records the working tree's skills target, or refuses to run without it.

## Research-suite token set assumes a single-turn answer

- The gated-analysis scenario asserts four phase tokens, but a multi-turn run
  emits them across turns and the evaluator reads only the final message, so a
  correct run fails on `research-analysis complete.` (S9, 2026-11-15).
- Decide whether the phase tokens are a per-session contract (scan the whole
  transcript) or a final-message contract, and state it in the manifest.

**Trigger:** start with the next research-suite change; close when a passing
multi-turn gated run and a single-turn gated run both satisfy the same stated
contract.

## Research-suite per-turn timeout aborts remaining scenarios

- One gated scenario (A1a, 40 tool calls / 35 page fetches) exceeded the
  script's 1800 s `timeout`; `set -e` then ended the run and the remaining
  scenario never executed (2026-11-15).
- Record a timeout as that scenario's failure and continue, or raise the
  default with a documented ceiling.

**Trigger:** start with the next research-suite change; close when a run
containing one timeout still evaluates every selected scenario.

## Non-goals

Open-web scope boundary; the authoritative list lives in `DECISIONS.md`
under `## Scope Non-goals`.
