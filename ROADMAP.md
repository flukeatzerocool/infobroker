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

## R5 citation and prose remediation

- Preserve the per-provider status and zero-result provider list under compact verbosity (F-R5-E-3), and align §8.2's independence definition with source-family counting (F-R5-G-1).
- Each change ships with a CHANGELOG entry and a re-run of the gates it feeds.

**Trigger:** start after chunk R6 closes; close when F-R5-E-3 and F-R5-G-1 are `Resolved`.

## R7 report-contract evidence remediation

- Add a defect fixture and asserting test for the `register-url` branch (F-R7-C-1), the `undeterminable` publication-date branch (F-R7-C-3), and the `manifest-likelihood`/`manifest-verdict` vocabularies (F-R7-C-5).
- Enforce the Fact-Check shape block so a report missing its verdict table is rejected (F-R7-C-2), and assert the register `interests`/`source`/`type` branches (F-R7-C-4).
- Each change ships with a CHANGELOG entry when behavior changes and a re-run of `check-report-fixtures`.

**Trigger:** start after chunk R8 closes; close when F-R7-C-1, F-R7-C-2, F-R7-C-3, F-R7-C-4, and F-R7-C-5 are `Resolved`.

## R7 monitoring and watchlist remediation

- Baseline a report with a verification receipt and revalidate it with `verify_report` before comparing (F-R7-E-1).
- Report same-id source drift and an unverifiable set instead of id-set membership only (F-R7-E-2).
- Carry revision/supersedes through the delta (F-R7-E-3), observe the dry-run and error-isolation paths (F-R7-E-5), stop overwriting prior claims (F-R7-E-6), and persist `last_run` so due selection advances (F-R7-E-7).

**Trigger:** start after chunk R8 closes; close when F-R7-E-1, F-R7-E-2, F-R7-E-3, F-R7-E-5, F-R7-E-6, and F-R7-E-7 are `Resolved`.

## R7 confidence and technique remediation

- Remove the fourth confidence label from the analysis skill and make it cite the canonical three-label scale (F-R7-B-1).
- Map each catalog technique to a family so the six-family claim is verifiable, or narrow the claim (F-R7-B-2).

**Trigger:** start after chunk R8 closes; close when F-R7-B-1 and F-R7-B-2 are `Resolved`.

## R7 routing-citation remediation

- Detect a renamed bare tool in the routing files without over-capturing prose (F-R7-G-2).
- Extend the routing surface to the remaining reference files (F-R7-G-1) and correct the README provider-enable instruction to name the user layer (F-R7-G-3).

**Trigger:** start after chunk R8 closes; close when F-R7-G-1, F-R7-G-2, and F-R7-G-3 are `Resolved`.

## R7 client-artifact gate remediation

- Make REQ-050's content check fail rather than warn and cover REQ-051's escalation, manifest, quality-gate, and revalidate clauses (F-R7-A-1, F-R7-A-2).
- Add TRANSLATE to the pipeline-map TAIL (F-R7-D-1), instruct the manifest language after translation (F-R7-D-3), and require removal or an unverified marking for an unsupported drafted claim (F-R7-D-4).

**Trigger:** start after chunk R8 closes; close when F-R7-A-1, F-R7-A-2, F-R7-D-1, F-R7-D-3, and F-R7-D-4 are `Resolved`.

## R7 export remediation

- Assert export determinism with a repeat-and-compare test (F-R7-F-1).
- Make the library exports enforce validation or expose an explicit skip (F-R7-F-2).

**Trigger:** start after chunk R8 closes; close when F-R7-F-1 and F-R7-F-2 are `Resolved`.

## R8 update-preservation evidence

- Add a test that simulates an update (copy or reinstall over the tree) and asserts the user configuration layer, KB content, and quota counters survive without reconfiguration (F-R8-A-1).
- Reconcile §2 F11's "G1 update-preservation tests guard the guarantee" with the test once it exists.

**Trigger:** start after the sweep reaches R9; close when F-R8-A-1 is `Resolved` and `validate-spec` still passes.

## R8 notice and gate-traceability evidence

- Drive a provider cooldown through a tool call and assert the bounded notice on the response (F-R8-C-1).
- Assert REQ-096's gate-traceability clause in `validate-spec`, or narrow the sentence to reference presence (F-R8-D-1).

**Trigger:** start after the sweep reaches R9; close when F-R8-C-1 and F-R8-D-1 are `Resolved`.

## R8 state-hardening evidence

- Assert REQ-100's ownership-refusal branch for key-pool/state directories (F-R8-F-1).
- Assert REQ-099's owner-only creation of an absent keys directory (F-R8-F-2).

**Trigger:** start after the sweep reaches R9; close when F-R8-F-1 and F-R8-F-2 are `Resolved`.

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

## Non-goals

Open-web scope boundary; the authoritative list lives in `DECISIONS.md`
under `## Scope Non-goals`.
