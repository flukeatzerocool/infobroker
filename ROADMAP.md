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

## Full-repository review sweep

- Run a whole-repository semantic review one chunk per session: R1 contracts, R2 config/providers/resilience, R3 `search_web`, R4 `fetch_page`, R5 corroboration, R6 knowledge base, R7 client artifacts/reporting, R8 deployment/state/security, R9 spec integrity, then the M1 machine-evidence pass. The tracker is `docs/plans/2026-11-09-full-review-sweep/worklist.md`.
- Each chunk produces a per-REQ verdict table, a fresh-context plan and code review, findings dispositioned P0–P3, green exit gates, and an increment record under `docs/plans/`.
- Coverage is §1–§10 and Appendices A–E, including all 142 §4 REQs, with every section assigned to exactly one chunk.

**Trigger:** start chunk M1 after chunk R9 closed; close this item when M1's machine-evidence pass is green.

## R6 `manage_kb` action-contract remediation

- Stop discarding a caller-supplied `source_url` for text-only ingest (F-R6-A-2), and add handler-level tests for the receipt-only-report/KB and at-least-one-input refusals (F-R6-A-3).
- Assert the advertised `max_results` contract and the unconfigured/invalid-KB error (F-R6-A-1).
- Each behavior change ships with a CHANGELOG entry and a re-run of the gates it feeds.

**Trigger:** start after chunk R7 closes; close when F-R6-A-1, F-R6-A-2, and F-R6-A-3 are `Resolved`.

## R6 `manage_kb` action-evidence remediation

- Assert REQ-060c per-collection counts and last ingestion, REQ-060d's filter requirement, REQ-060e newest-first order and chunk count, REQ-060f chunk order and no-document error (F-R6-A-4).
- Add tool-level assertions for the locked-store error (F-R6-A-5) and for REQ-060i `stale=true` plus the document-basis absent-source branch (F-R6-A-6).

**Trigger:** start after chunk R7 closes; close when F-R6-A-4, F-R6-A-5, and F-R6-A-6 are `Resolved`.

## R6 auto-index, scoping, and expiry remediation

- Add an observing test for auto-index non-blocking/failure suppression/toggle and the three hook sites (F-R6-B-1), make the collection config-default tier testable (F-R6-B-2), and assert startup/interval expiry, indefinite tiers, and the no-error-event clause (F-R6-B-3).

**Trigger:** start after chunk R7 closes; close when F-R6-B-1, F-R6-B-2, and F-R6-B-3 are `Resolved`.

## R6 config, dedup, and report remediation

- Reconcile REQ-067's absent/invalid→error clause with the shipped-defaults fallback and add a reload test (F-R6-B-4).
- Extend meaning-equivalence dedup beyond `report://` identities (F-R6-B-5), and make report retention `source_type`-guarded with a monotonic revision chain (F-R6-B-6).

**Trigger:** start after chunk R7 closes; close when F-R6-B-4, F-R6-B-5, and F-R6-B-6 are `Resolved`.

## R6 retrieval remediation

- Emit `kb_recall:"not_applicable"` for research requests (F-R6-C-5).
- Stop blend from applying the sufficiency filter to cached rows and let the all-external-fail path return the unfiltered cache (F-R6-C-6).
- Give REQ-103 degradation a remediation message and a test (F-R6-C-7).

**Trigger:** start after chunk R7 closes; close when F-R6-C-5, F-R6-C-6, and F-R6-C-7 are `Resolved`.

## R6 encryption and capacity remediation

- Re-seal the `events` table on enable/disable/rekey (F-R6-D-1) and add a persisted store-format marker that refuses a newer SQLite store without rewriting it (F-R6-D-2).
- Give a corrupt live SQLite store the REQ-108 recovery path: preserve a backup, continue empty, report the event (F-R6-E-1).
- Each change is a store-format/security change, not a bounded fix; ship with a CHANGELOG entry and a re-run of the gates it feeds.

**Trigger:** start after chunk R7 closes; close when F-R6-D-1, F-R6-D-2, and F-R6-E-1 are `Resolved`.

## R6 ledger and receipt remediation

- Persist unsourced findings (F-R6-F-1), seal `claim_sources.retrieved_at` (F-R6-F-2), and stamp or reject a receipt source with no retrieval time (F-R6-F-4).

**Trigger:** start after chunk R7 closes; close when F-R6-F-1, F-R6-F-2, and F-R6-F-4 are `Resolved`.


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
- Each behavior change ships with a CHANGELOG entry and a re-run of the gates it feeds.

**Trigger:** start after chunk R5 closes; close when every R4 P1 row in the extraction group is `Resolved`.

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
