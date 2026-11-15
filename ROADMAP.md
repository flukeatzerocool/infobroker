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

## `search_web` hedge cancellation

- Give the search-side hedged dispatch the same per-provider `AbortController`
  the fetch renderers got for F-R4-B-1 (`src/index.ts:795-810` against
  `:1040-1075`), so a losing provider stops spending quota and recording stats.

**Trigger:** start after the process-efficiency increment closes; close when a
test proves the loser aborts on a win and on exhaustion.

## Shared spawned-server harness

- Extract the `withServer` helper duplicated in ten suites into
  `src/lib/mcp-stdio.ts`, and add a check that no suite redefines it.

**Trigger:** start with the next suite that needs a spawned server; close when
the ten copies are one module and the suites still pass.

## Research-suite matrix in repo mode

- Run the remaining research-suite scenarios with `--mcp=repo` and record
  per-persona results; current evidence is the A1a/A1b audience pair plus S3
  and N1.
- Extend the Arena config-behavior matrix to `preservation.archive` and
  `output.fallback_depth` once the fetch and verify fixtures cover both
  branches.

**Trigger:** start after the audience/defaults increment closes; close when
every §1 goal row names a recorded repo-mode run.

## Non-goals

Open-web scope boundary; the authoritative list lives in `DECISIONS.md`
under `## Scope Non-goals`.
