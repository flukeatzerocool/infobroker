# AAR — Review cap contract and the narrowing rule

**Date:** 2026-11-13 · **Roadmap item:** `ROADMAP.md` § Review-loop convergence — retired in this increment.
**Review cap:** 1 cold pass, at most 12 reviewer dispatches; used 8 passes.

## What happened

1. Drafted the plan against the demonstrated failure in `2026-11-10-r2b-config-reload-validation` (seven cold passes, the cap recorded as a recommendation) and the hand-written cap in `2026-11-11-r2b-ii-user-layer-write-ordering`.
2. Cold pass ran stages 1, 2, 3 (three lenses), and 5. Stage 1 failed twice, stage 5 failed twice, and 8 of the declared 12 dispatches were used; stage 4 was folded into stage 5 rather than spend a ninth dispatch.
3. The user accepted the residual (`C-indep`) after the stage-5 re-audit: the last Blocker was a fixture-content omission, fixed in revision 6 as a condition-only amendment, and no reviewer saw revision 6.
4. Five commits: the gate library and its tests plus the changelog line, the Done-bar parse fix, the three documents, the roadmap retirement, and this record.

## What went right

- The cold pass found four independent Blocker classes, none in the design premise: a self-refuting exemplar, a done-bar step that could not fail, a marker regex that would have parsed the plan's own quotation, and a fixture that could not produce the expected finding count. Each is now a stated rule in the code or the plan.
- The error-gate dry run did its job: the tightened gate reported `1 error(s), 1 warning(s)` before and after the change, so the only error was the in-progress increment and no closed plan was retro-failed.
- The cap held. Eight dispatches, two stage re-audits, no third pass on either stage; the one escalation went to the user as the contract says it should.

## What went wrong

- **The plan needed six revisions, and the first four defects were self-inflicted.** The exemplar's own cap line lacked a count, the done-bar check could not discriminate, the commit order omitted the DB-6 slot, and the cap arithmetic contradicted itself. A plan about bounded review loops was itself the least bounded artifact in the session.
- **Plan and task list drifted apart between revisions.** Readiness returned NO-GO on nine blockers, seven of them disagreements between `plan.md` and `tasks.md` (case count, field names, changelog commit, cap value, command form). Both files are authored in the same turn, so this was avoidable.
- **The `Increment` interface change broke a fixture outside the blast radius.** `scripts/lib/weekly.test.ts:29` constructs an `Increment` literal; `typecheck:scripts` caught it only at execution. Recorded as Amendment 1.

## Findings and dispositions

| Finding | Severity | Disposition |
|---|---|---|
| Exemplar cap line had no count while the rule required one | P0 | Resolved in-session (revision 4) |
| Done-bar step could not fail (presence-only check) | P0 | Resolved in-session (discriminating close-time check, DB-5) |
| Marker regex would parse a quotation in prose | P0 | Resolved in-session (line-initial parse, canonical value shape) |
| Plan/tasks divergence (nine readiness blockers) | P0 | Resolved in-session (revision 5) |
| Final readiness Blocker unresolved at the re-audit cap | P1 | Resolved by condition-only amendment; user accepted the residual and no reviewer saw it (`C-indep`) |
| `weekly.test.ts` fixture outside the blast radius | P2 | Resolved in-session (Amendment 1) |
| Done-bar parse matched a prose mention, printing a wrong value | P0 | Resolved in-session (Amendment 2) |
| Skill-side enforcement (plan-review, independent-review) lives in user config | P3 | Closed informational — D-117 records the repo-side surface as authoritative |
| A second declaration or an amended cap value is not detected | P3 | Closed informational — D-117 limit |

No P0 or P1 remains open. The `C-indep` risk is recorded, not retired: the next increment that touches the review loop inherits it as evidence that the cap needs a re-audit allowance for readiness.

## Gates

| Gate | Result |
|---|---|
| `npx vitest run scripts/lib/loop-artifacts.test.ts` | 19 passed (10 new cases; (b)–(e) red first) |
| `npx tsc -p tsconfig.scripts.json` | 0 |
| `npm run check-loop-artifacts` | 1 error before the AAR (in-progress), 0 errors after |
| `npm run check-script-discipline` | 78 TS + 9 shell conform |
| `npm run version-sync` | OK |
| `npm run check-roadmap` | 2 sections |
| `npm run check-non-goals` | OK |
| DB-5 temp-root dated 2026-11-20 | `[]`, exit 0 |
| DB-6 `session:close -- --dry-run` | exit 0, dry-run line |
| `npm run check` (full) | PASS |

## Loop status

Zero new action items. The roadmap item is retired; the hermetic-harness item stays open until a harness change triggers it. Next work comes from `ROADMAP.md` or a user request.

LOOP PAUSED
