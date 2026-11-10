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

**Trigger:** start chunk R4 after chunk R3 closed; close this item when every chunk is closed and the final machine-evidence pass is green.

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

## Non-goals

Open-web scope boundary; the authoritative list lives in `DECISIONS.md`
under `## Scope Non-goals`.
