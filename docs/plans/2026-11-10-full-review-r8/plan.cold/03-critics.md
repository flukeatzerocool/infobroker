# Stage 3 — Critics (design, structural, style)

Artifact under review: sha256 `e39a7a6b18346a42180c1a571a3ffa400581be82f8d58b002798e7bfc4025627`
Date: 2026-11-10 · three parallel fresh-context reviewers · read budget ≤10 each.

## Design critic — Blockers

1. **[design] Probe leg (c) unsatisfiable.** `RENAME_MIGRATIONS` is empty (`src/config-migrations.ts:31`); the transform path is test-injected only. Leg (c) must assert the reachable effects (`config_version` stamp, `kb.store_backend` removal, unknown-key retention, backup, atomicity) and pin the rename path to `src/config-migrations.test.ts`.
2. **[design] Step 2's acceptance cannot distinguish repaired from unrepaired.** EV1 records that the failing file already passes in isolation pre-fix; the full-suite run is the only discriminator, and one run is a coin flip on an 11% margin.

## Design critic — Majors

3. Probe leg (e) names `strictest`/`disabled`; the shipped modes are `off | flag | block` (`src/content-policy.ts:36`), disposal at `:134-139`, metadata `policyMeta` at `:142-145`.
4. Probe leg (d) assumes an injectable registry response; `REGISTRY_URL` is a constant and the fetcher defaults to global `fetch` (`src/update-check.ts:10,96,133`), and the cache is read only at configuration time (`:139-148`), so "second call" proves nothing. Pre-seed `$TMPDIR/infobroker/update-check.json` and cold-start per status, or drop the leg.
5. D72 leaves `XDG_DATA_HOME`/`XDG_STATE_HOME` unset and sibling `config.local.json` discovery open; a probe can reach the developer's real state while path assertions pass.
6. Step 3's green baseline runs the full suite, whose `audit`/`check-pack`/`test-debate-club` gates are environmental; there is no `NOT_RUN` provision before Phase 3.
7. No committed probe harness: six high-risk legs are live shell runs, so `probe:` predicates are unrepeatable.
8. Step 13 asserts auto-migrate startup that no step observes (it runs at module load, `src/index.ts:90-95`).
9. A split close would write the successor's tracker line before the successor reviews those scripts.

## Design critic — Nits

10. Verification rehearses leg (f) unconditionally though it is deferred on a split.
11. Leg (f) does not name the state file it corrupts or the expected modes.
12. Rollback-cost line omits step 2's fallback file.

## Structural critic

13. **[design] P0 pool contradicts its own derivation** (`:83` vs clusters C/G/D): omits `truncate.ts` and `cooldown.ts`, includes R1-owned `error-envelope.ts`, and omits the gate scripts D76 makes R8-fixable.
14. **[design] Split partitions evidence from the verdict**: Appendix E pairs with `REQ-096` (R8a) but sits in R8b; §10.1 names the call-log path (R8b) but sits in R8a; §2 F1–F12 is one block split across closings with no reconciliation.
15. **[design] Deferred REQs have no verdict-row representation** on a split; the tracker requires a row per in-scope unit.
16. **[design] Split predicate not computable**: anchor unit undefined for prose; pre-scan's probe-dependent list (B,C,D,F) contradicts the legs (A,B,E,F).
17. **[design] Step 24 repairs backwards into non-idempotent step 23**, and a late P1 has no route back to the roadmap.
18. **[design] The full suite never runs on the final tree** (step 27 is `check:fast` only).
19. **[design] Backout re-reddens the baseline** by reverting the timeout commit, while claiming rollback cost 1.
20. **[design] Six downstream roadmap triggers read "start after chunk R8 closes"** and are never reconciled with a split.
21. Nits: prose-unit granularity is plan-local; EV10 cites `:439` for the coverage row that lives at `:471`; step 22's trigger content under-specified; step 0 collides with existing state and does not say whether the stub is staged into step 2; step 23(iii) undefined.

## Style critic

22. **[clarity Blocker] Provenance contradiction**: header says "self pass pending; no cold pass yet" while the closing section says the self pass is complete and EV10 asserts a "correction (cold pass)".
23. **[clarity] `C-1` used twice and defined nowhere.**
24. **[clarity] P0 pool described as "every source file" while naming a subset.**
25. **[clarity] "eight R8 modules" contradicts the nine modules EV4 lists.**
26. **[clarity] Verification says "two accept criteria only" then lists three.**
27. **[clarity] Step 24 sends a repair back to a completed step.**
28. **[clarity] Pre-scan's own number meets the split threshold while the text denies it can pre-empt a split.**
29. **[clarity] "chunk" vs "increment" undefined.**
30. **[clarity] Step 4's "EV5's files plus" re-lists EV5's own files.**
31. **[clarity] Retracted-claim residue about `src/kb-hardening.ts` appears three times.**
32. **[clarity] Depth justification implies a migration the plan says does not happen.**
33. **[clarity] `manage_kb` key-material surface named three ways.**
34. **[clarity] Step 21's split partition undefined.**
35. Nits: unqualified "§2" in scope; duplicate "Done bar" label; D75/D78 overlap; foreign ID namespaces; uneven line citations; Phase 2 preamble omits step 21; rehearsal root unnamed; calibration rules 4–5 uncited.

**Every item above was addressed in the amendment that produced the next artifact revision.** Stage 4 checks the amendment for new contradictions.
