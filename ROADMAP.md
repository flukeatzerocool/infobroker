# Roadmap

<!--
  Admission rule: a `## <title>` section is a scheduled work item. It needs an
  action a maintainer can take, 1–3 bullet lines, and a `**Trigger:**` line
  naming what starts the work or what closes it. Priority order, P0 first;
  remove a section when the work ships (it moves to CHANGELOG.md).

  Standing facts are not roadmap items: accepted dependency advisories and
  by-design limitations are recorded in DECISIONS.md, and a review cites the
  decision rather than filing a roadmap entry. `npm run check-roadmap`
  enforces this rule; `## Repo mode does not isolate the knowledge base

- A `--mcp=repo` N4 run on 2026-11-15 read the operator's populated KB and
  recalled earlier `report://nebulagrid-*` artifacts as evidence, reporting 16
  "sources" for an unannounced service; the empty run-local layer changes the
  MCP and skills but not `kb.storage_path`.
- Point the run-local layer at a run-scan `storage_path` (or an empty temp
  store) so a repo-mode result is reproducible and cannot be corroborated by a
  prior run of the same question.

**Trigger:** start with the next research-suite change; close when a repo-mode
run records an isolated KB path in its run artifacts.

## Non-goals` is exempt from it because
  `npm run check-non-goals` verifies that section as a pointer to the
  `## Scope Non-goals` block in DECISIONS.md.
-->

## Manifest needles test literal prose, not the finding

- N4's `sections` needle `zero usable` failed a run that reported the zero-source
  conclusion as "nonexistent", named three gaps, and carried an Uncertainty
  Register (2026-11-15) — the wording differed, the finding did not.
- Either widen the needle set or have the shape's block state the phrase the
  manifest asserts.
- The set now reads `zero usable|no usable|nonexistent`; the 2026-11-15 repo-mode
  re-runs failed earlier than the needle — N4 routed to Research & Write, so no
  Uncertainty Register or shape token was written. The residual is routing, not
  wording (`docs/research-evidence-2026-11-15.md`).

**Trigger:** start with the next research-suite change; close when a repo-mode N4
run that reports a zero-source conclusion passes its section gate.

## Research-suite token set assumes a single-turn answer

- The gated-analysis scenario asserts four phase tokens, but a multi-turn run
  emits them across turns and the evaluator reads only the final message, so a
  correct run fails on `research-analysis complete.` (S9, 2026-11-15).
- Decide whether the phase tokens are a per-session contract (scan the whole
  transcript) or a final-message contract, and state it in the manifest.
- Decided and stated: `token_scope: session` in the manifest, documented in
  `test-fixtures/research/README.md`; S9 passes under it. The single-turn gated
  side is unproven because N4 does not route to gated analysis.

**Trigger:** start with the next research-suite change; close when a passing
multi-turn gated run and a single-turn gated run both satisfy the same stated
contract.

## Non-goals

Open-web scope boundary; the authoritative list lives in `DECISIONS.md`
under `## Scope Non-goals`.
