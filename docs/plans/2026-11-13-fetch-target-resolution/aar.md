# AAR — Fetch-target resolution before renderer dispatch

**Status:** executed 2026-11-13 · **Date opened:** 2026-11-13
**Plan:** `plan.md` (revision 3, standard depth) · **Tasks:** `tasks.md`
**Review cap:** 1 self pass + 1 cold pass; at most 1 diff re-review, then escalate.
**Passes used:** 1 self + 1 cold + 1 targeted re-review (cap reached).

## What happened

1. `ROADMAP.md` was empty (0 open items) after the 2026-11-13 retirements, so the
   next unit of work was mined from the full-review register
   (`docs/plans/2026-11-09-full-review-sweep/worklist.md`): 50 rows still carrying
   `Scheduled-roadmap`, 48 P2 and 2 P3, no P0/P1.
2. A sample of eight rows was verified against live code; seven were still open and
   one (`F-R5-C-5`) was already fixed, which is itself a register-drift finding.
3. `F-R4-A-2` — the resolved-address guard runs only on the native path — was
   selected and planned.
4. The remaining five clusters were admitted to `ROADMAP.md` as sections B–F.
5. Two review passes returned FAILED (nine findings, then two more); revision 3
   resolves both remaining findings. The cap was reached, so the user authorized
   execution without a third pass and the plan gate was bypassed, not passed.
6. All eight tasks executed. No change entry needed an amendment.

### What the reviews changed about the fix

| Round | Finding | Effect on the plan |
|---|---|---|
| Cold | B1 — the test asserted an error class the guard never throws | The contract case now asserts `SsrRefusalError`, the class `assertPublicUrl` actually raises |
| Cold | M1 — "all five call sites map a refusal" was false | Scheduled a new carve-out at the `resolveFetchFallback` call site, which the wrap makes reachable |
| Re-review | B2 — dropping the `resolver` made the cases unrunnable | `resolver` restored as a test seam |
| Re-review | M4 — a hard `network_target_refused` would discard the Crossref record | The catch now degrades to the metadata branch (REQ-021h) |

The second round matters most: the first fallback fix was itself a regression.

## Verification

| Check | Result |
|---|---|
| `npm run check:fast` at `fe740d3` (baseline, before edits) | PASS 19/19, 28.4 s |
| `npm run check-roadmap` after admitting B–F | OK (6 sections) |
| `npm run check-non-goals` | OK |
| **DB-1** — `npx vitest run src/fetch-target.test.ts` on the pre-change tree | 1 failed (assertion: `withGuardedTarget(` absent) — recorded red, not a resolution error |
| **DB-2** — `npx vitest run src/fetch-target.test.ts src/lib/url-guard.test.ts` | 32 passed, 2 files |
| **DB-3** — `grep -c "withGuardedTarget(url" src/index.ts` | 1; `npm run typecheck` exit 0 |
| **DB-4** — `npm run validate-spec` / `check-gate-coverage` | 127 REQs cited, 0 files without `@implements`; 117 cited, 1 exempt, 0 waived |
| — `npm run version-sync` / `check-script-discipline` | OK / 78 TS + 9 shell conform |
| **DB-5** — `npm run check:fast` on the final tree | PASS 19/19, 26.8 s |
| **DB-5** — `npm run check` (full) | PASS (full, 160.2 s), 21 gates |

## Findings

| ID | Severity | Finding | Disposition |
|---|---|---|---|
| F-AAR-1 | P3 | The register drifts: 1 of 8 sampled rows (`F-R5-C-5`) is fixed in code while its disposition still reads `Scheduled-roadmap` | Scheduled on `ROADMAP.md` § Full-review register reconciliation |
| F-AAR-2 | P3 | 50 register rows lost their roadmap home when the 2026-11-13 increments retired the last sections | Scheduled on `ROADMAP.md` § Full-review register reconciliation; the five clusters admitted as B–F |
| F-AAR-3 | P3 | The fallback degradation (C-3) is unverified by a test: `src/index.ts` cannot be imported (its `main()` connects a stdio transport at import) and the hermetic harness serves everything from loopback with `allow_private_urls` enabled, so it cannot produce a private resolution | Closed as informational — recorded limit, not a defect; `resolveFetchFallback`'s metadata branch keeps its own unit coverage |

## Review record

| Pass | Depth | Result |
|---|---|---|
| Self | standard | pass, revision 1 |
| Cold (1) | standard | `independent-review FAILED.` — 1 Blocker, 3 Majors, 5 Minors (4 of 5 lenses, one reviewer context) |
| Revision 2 | — | Blocker and all Majors resolved; each re-verified against the tree before editing |
| Targeted re-review | standard | `independent-review FAILED.` — 1 new Blocker, 1 new Major; the other eight confirmed closed |
| Revision 3 | — | Both resolved and re-verified; cap reached |

Risk accepted: revision 3 executed without a third review pass; two cold passes and one
targeted re-review were spent, the last returned FAILED with two findings that revision 3
resolves but no reviewer re-examined. Authorized by fluke, 2026-11-13 ("execute plan").
Plan gate bypass recorded at `~/.local/state/opencode/plan-gate/<repo-key>.json`.

## Commits

1. `docs(roadmap): schedule the mined full-review backlog` — the earlier instruction's
   concern, committed separately from this increment.
2. `fix(fetch): resolve the target before any renderer receives it`
3. `docs(changelog): record renderer-path target resolution`
4. `docs(plans): record the fetch-target resolution increment`

LOOP PAUSED
