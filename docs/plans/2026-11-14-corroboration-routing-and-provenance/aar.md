# AAR — Corroboration pool routing and provenance fidelity

**Date:** 2026-11-14 · **Plan:** `plan.md` (sha256 `724be19c…5067`, condition C-2 applied)
**Done bar:** met — see "Outcome against the bar" below.
**Review cap:** 2 cold passes declared in `plan.md`; used 4 passes, two beyond the cap with recorded user authorization.

## What was supposed to happen

Close three register rows in `ROADMAP.md` § Corroboration, citation, and
benchmark fidelity — `F-R5-A-3`, `F-R5-C-4`, `F-R5-C-6` — with driving tests,
one new REQ (REQ-026i) plus a REQ-026d amendment, a re-derived register
census, and four commits.

## What happened

1. **Spec.** REQ-026i added (532 chars, 7 SHALL, 5 backtick tokens); REQ-026d
   gained the finding-attribution sentence; §7.4 scoped to `search_web` plus a
   corroboration paragraph; §3 glossary extended; §9.5 manifest, §D taxonomy,
   §9.2 checklist, and §1.6 reservation all updated.
2. **Source.** `applyPriority` now intersects the privacy chain with the
   caller's pool and orders by provider priority for `quality`;
   `snapshotCondensedSources` schedules a source that has a hash but no tier;
   `provenance` carries `findings[]` and per-source `finding_index`;
   `CorroborationProvenance` and the `verify_claims` parameter description move
   with the behavior.
3. **Tests.** Two routing describe blocks replaced/extended and two
   integration tests added; 122 tests pass in `src/corroborate.test.ts`.
4. **Register and roadmap.** Three rows `Resolved 2026-11-14` with the driving
   test named; the REQ-026d verdict row updated; census re-derived by
   `evidence/census.ts` (276 rows, `Resolved` 179, `Scheduled-roadmap` 4);
   roadmap bullet retires the three fixed rows and keeps `C-8` with its
   decision stated.
5. **Docs.** README priority paragraph rewritten; CHANGELOG `2026.11.14`
   entry; version stamped across all seven sites.

## Outcome against the bar

| Bar item | Result |
|---|---|
| Three rows `Resolved`, census re-derived | met — `census.ts` self-check OK, 179/4/93 |
| REQ-026i registered and cited | met — manifest, taxonomy, checklist, §7.4, §3, test header |
| Clause tags pass, no uncited G1 REQ | met — `check-gate-coverage` 118 cited / 1 exempt / 0 waived |
| Full `check` green on the close-time tree | recorded in `tasks.md` step 8 |
| Roadmap/README/CHANGELOG/version agree | met — `check-roadmap`, `validate-readme`, `version-sync` all pass |

## What went right

- The cold passes earned their cost twice: pass 2 caught that a spec-only
  first commit cannot pass `validate-spec`, and pass 3 caught that the header
  and rollback prose had gone stale. Both were real defects in an artifact
  that read as finished.
- The C-4 re-base (pass 1, Major 1) changed the fix's justification but not its
  code, and the test seam was already documented — no rework in the source.
- Every gate that failed during execution failed loudly and early
  (`validate-spec` on the uncited REQ and the reservation paragraph).

## What went wrong

- **The plan under-enumerated the spec registration surfaces.** It named the
  manifest, taxonomy, checklist, §7.4, and glossary but not the §1.6 block
  reservation, which `validate-spec` requires for a new sub-REQ. One gate
  cycle lost.
- **The artifact was edited after dispatch 1**, invalidating the reviewer's
  hash and forcing a re-dispatch. Cost: one wasted cold pass.
- **`validate-spec` reads only the first `@implements` line in a file**
  (`scripts/validate-spec.ts:91`). Inline clause tags do not register a REQ
  for traceability even though the clause-coverage scanner sees them; the
  header line must carry the REQ. Not a defect — the header is the documented
  convention — but the plan's test step did not say so.
- **Two post-cap dispatches** were needed; both were authorized before they
  ran, and both found defects, which is the argument for the cap being a
  budget rather than a truth claim.

## Findings

| ID | Severity | Finding | Disposition |
|---|---|---|---|
| F-AAR-1 | P3 | A new sub-REQ must also be added to the §1.6 block-reservation list; the plan named five registration surfaces and missed it | Closed as informational — added to the plan's own record; no standing action |
| F-AAR-2 | P3 | `validate-spec`'s traceability scan is first-match-per-file, so inline clause tags alone do not satisfy G1 coverage | Closed as informational — header-tag convention is intentional |
| F-AAR-3 | P3 | Post-cap review dispatches need their authorization in the AAR (plan nit F4) | Resolved here — dispatches 3 and 4 were user-authorized in-session |

No P0, P1, or P2 findings. `ROADMAP.md` gains nothing from this increment; the
four remaining scheduled rows stay in the § Corroboration section.

## Symmetry with the plan

The increment closed exactly the three rows it scoped. The scope call —
leaving `C-8`, `E-1`, `E-2`, and `F-1` out — held: no out-of-plan file was
touched, and no finding had to be re-homed.

## Skills loaded

`programming-orchestrator`, `plan-review`, `build-review`. The
`after-action-report` skill's contract is applied here directly (review cap,
terminal token, finding dispositions).

LOOP PAUSED
