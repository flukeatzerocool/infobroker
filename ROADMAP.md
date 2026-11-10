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

## R6 dedup false-positive bound

- Bound meaning-equivalence collapse on templated corpora: the R6 increment measured 36 of 200 template documents collapsing into each other at the 0.92 LSA threshold (accepted risk D4a, recorded in `docs/plans/2026-11-10-r6-config-dedup-report/aar.md`).
- Either add a distinguishing-token guard or raise the threshold, and re-measure with the same seeded corpus before changing the constant.

**Trigger:** start when a user reports a collapsed document, or when the seeded templated corpus collapses more than 10% of its documents.

## R2 findings remediation

- Fix the R2 P1 set: credential-pool coverage for CORE/generic providers, disabled-provider bypasses in `verify_claims`, the explicit-provider auth filter, timeout retry classification, throttle coverage on retries, quota flush on shutdown and reset timing, the exhausted-chain error shape, `fetch_page` `retry_after_ms`, a financial indicator source, the latency-window strategy, the `status:"active"` filter, the disabled-provider health probe, `total_requests_served`, `requires_account` derivation, and the REQ-013 partial-results leg.
- Close the P2 evidence gaps: REQ-010 inheritance and update preservation, REQ-011 leak clauses, REQ-024a non-active reasons, REQ-024b timestamps, the REQ-034 80/100 boundary, dispatch orchestration, disabled-provider skip, and key-pool restart persistence.
- Correct the §5.3 interface sketch and the §A.5 SearXNG privacy and POST claims; each ships with a CHANGELOG entry and a re-run of the gates it feeds.

**Trigger:** start after chunk R3 closes; close when every P1 row in the R2 finding register is `Resolved` and each P2 row is fixed or re-classified.

## R3 findings remediation

- Fix the R3 P1 set: explicit-provider precedence under priority routing, KB-first response metadata, all-fail batch per-input errors, collapse below the requested maximum, contributing-provider preservation, KB-recall source-quality ordering, multiple research variants, REQ-004 truncation of `search_web` responses, deep reading under compact verbosity, and analysis omission on empty results.
- Close the P2 set: `speed` tie order, no-embedding reconciliation ranking, chain-wide language reporting, deep-batch passage counts, and batch analysis over the merged result set.
- Each behavior change ships with a CHANGELOG entry and a re-run of the gates it feeds.

**Trigger:** start after chunk R4 closes; close when every R3 P1 row in the finding register is `Resolved` and each scheduled P2 is fixed or re-classified.

## R4 fetch-page extraction remediation

- Fix the R4 P1 set in `fetch_page` extraction: report `passages_returned` and `match_quality` on the no-match/full-content branch (F-R4-D-1), expose `extraction_mode` and passage count in the default raw `structuredContent` (F-R4-D-3), and stop emitting publication dates as `last_updated` with high confidence (F-R4-C-2).
- Route crawl and extract truncation through `maybeTruncate` so truncation metadata is reported (F-R4-C-9, REQ-004).
- Each behavior change ships with a CHANGELOG entry and a re-run of the gates it feeds.

**Trigger:** start after chunk R5 closes; close when F-R4-D-1, F-R4-D-3, F-R4-C-2, and F-R4-C-9 are `Resolved`.

## R4 fetch-page classification remediation

- Fix the R4 P1 set in classification: require a stronger anti-bot marker than a bare "captcha" title (F-R4-B-2), classify `area` and `elevation` as measurable attributes so a fact is emitted (F-R4-E-1), and add named clause tags per REQ-021a branch plus the detector support that observes them (F-R4-A-1).
- Each behavior change ships with a CHANGELOG entry and a re-run of the gates it feeds.

**Trigger:** start after chunk R5 closes; close when every R4 P1 row in the classification group is `Resolved`.

## R4 fetch-page contract remediation

- Declare the `renderer` schema default and align the §6.4 fallback prose with the race and anti-bot fall-through (F-R4-F-1, F-R4-F-4); also schedule the REQ-021 `raw` parameter omission (F-R4-F-3) with the same prose pass.
- Each change ships with a CHANGELOG entry and a re-run of the gates it feeds.

**Trigger:** start after chunk R5 closes; close when every R4 P1 row in the contract group is `Resolved`.

## R5 corroboration remediation

- Stop unrelated results from being attributed through stopword overlap (F-R5-A-1), make `confidence_threshold` gate the `confirmed` verdict instead of the fixed 0.5 cutoff (F-R5-A-2), and prevent a knowledge-base-only corroboration from reaching `confirmed` (F-R5-D-1).
- Each behavior change ships with a CHANGELOG entry and a re-run of the gates it feeds.

**Trigger:** start after chunk R6 closes; close when F-R5-A-1, F-R5-A-2, and F-R5-D-1 are `Resolved`.

## R5 snapshot and family remediation

- Gate archiving on `preservation.enabled` rather than `corroboration.archive_sources` (F-R5-C-1), report the deep-reading snapshot hash and freshness tier instead of discarding it (F-R5-C-3), and collapse short republished snippets into one source family (F-R5-B-1).
- Each behavior change ships with a CHANGELOG entry and a re-run of the gates it feeds.

**Trigger:** start after chunk R6 closes; close when F-R5-C-1, F-R5-C-3, and F-R5-B-1 are `Resolved`.

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

## Non-goals

Open-web scope boundary; the authoritative list lives in `DECISIONS.md`
under `## Scope Non-goals`.
