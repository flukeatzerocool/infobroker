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

## R9 traceability and taxonomy gate strength

- Make the clause guard require one named tag per "or"-joined branch rather than two tags for any branch count (F-R9-A-1), and extend the taxonomy check to assert "exactly one feature area" per REQ plus a gate column that matches the §9.5 manifest (F-R9-C-1).
- Each change ships with a regression test that fails before and passes after, plus a CHANGELOG entry and a re-run of `validate-spec`.

**Trigger:** start after chunk M1 closes; close when F-R9-A-1 and F-R9-C-1 are `Resolved`.

## R9 tool-quality reporting and evidence

- Add the server-side per-tool report REQ-106 requires — parameter counts, schema description coverage, invocation cost, and definition size — or narrow the REQ to the gate-side report (F-R9-B-1).
- Make the annotation-contradiction branch fail the conformance gate, or narrow REQ-106's deterministic layer to exclude it (F-R9-B-2), and add an assertion for REQ-089's behavioral-consequence clause (F-R9-B-3).

**Trigger:** start after chunk M1 closes; close when F-R9-B-1, F-R9-B-2, and F-R9-B-3 are `Resolved`.

## R9 default-consistency and provenance enforcement

- Reconcile every spec-declared tool default against its schema and every config-vs-tool limit pair (F-R9-C-2), assert the token footprint's derivation from measured responses (F-R9-C-3), and give Appendix C's provenance rule a carrier or narrow its "enforceable by G3" preamble (F-R9-D-1).
- Each change ships with a CHANGELOG entry and a re-run of the gates it feeds.

**Trigger:** start after chunk M1 closes; close when F-R9-C-2, F-R9-C-3, and F-R9-D-1 are `Resolved`.

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
