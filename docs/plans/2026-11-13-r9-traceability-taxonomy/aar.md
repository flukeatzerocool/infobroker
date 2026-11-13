# AAR — R9 traceability and taxonomy gate strength

**Date:** 2026-11-13 · **Roadmap item:** `ROADMAP.md` § R9 traceability and
taxonomy gate strength — retired in this increment.

## What happened

1. Plan drafted for the next roadmap item (F-R9-A-1 + F-R9-C-1), with a
   committed measurement probe (`evidence/measure-r9.{ts,out}`) establishing
   the live population: 142 §4 REQs, 4 multi-branch REQs all already above the
   per-branch quota, 7 tools each with one home, and exactly four drifted §D
   Gate rows with their supplier REQs.
2. Cold review ran one pass (five stages) plus the user-authorized extra
   stage-5 audit: three NOT READY verdicts, all on documentary gaps. The plan
   gate was stamped `self` at standard depth with the user's recorded risk
   acceptance (`C-indep`), because the cap was reached.
3. Commits 1–7 shipped: spec + README, clause guard, taxonomy gate, register
   rows, decision, changelog, roadmap retirement.
4. Commit 8 records this directory, the AAR, and the evidence probe.

## What went right

- The measurement probe turned every plan claim into a reproducible number and
  prevented a scope error: the tightening needed **no** spec or tag changes,
  so the effort went into the regression fixtures and the new taxonomy gate.
- The error-gate dry run was run against a saved pre-edit copy and returned
  exactly the four predicted rows — the gate was proven red before the spec
  edit and green after.
- `deriveFeatureAreas` was kept a projection of the new parser, so
  `validate-readme` needed no edit and stayed green.

## What went wrong

- **Review loop did not converge inside one pass.** Stage 5 failed three times.
  Every finding was documentary (fixture provenance, message substitution,
  counts, anchors), which suggests the plan tried to specify test internals to
  a level that invited new gaps. The 7-step cap escalation worked as designed;
  the cost was plan-gate independence (self + risk acceptance).
- Two register anchors in the plan (`src/clause-coverage.ts:133`,
  `scripts/validate-spec.ts:534-555`) were off by one or stale by execution
  time; they were corrected in the worklist rows before the docs commit.
- `check-loop-artifacts` emits a pre-existing warning for
  `2026-11-10-r6-encryption-capacity-remediation` (no `**Done bar:**`); it is
  not this increment's artifact and was left untouched.

## Findings and dispositions

| Finding | Severity | Disposition |
|---|---|---|
| Cold pass hit the cap with three NOT READY verdicts, all documentary | P3 | Closed informational — user authorized the extra audit and the risk acceptance; no new work item |
| Plan line anchors are stale by execution time | P3 | Resolved in-session — worklist rows use execution-time anchors |
| Old increment missing `**Done bar:**` (loop-artifacts warning) | P3 | Closed informational — historical artifact, not editable as part of this plan |
| Detector heuristic could over-count a non-branch "or" aside | P3 | Recorded as D-114 and C-7; current population has zero such cases |

No P0 or P1 findings. No new action items.

## Gates

| Gate | Result |
|---|---|
| `npm run validate-spec` | pass (after spec edit and after wiring) |
| `npm run validate-readme` | 0 errors |
| `npx vitest run src/clause-coverage.test.ts src/lib/feature-taxonomy.test.ts` | 34 passed |
| `npm run test` | 1486 passed |
| `npm run typecheck` / `typecheck:scripts` | 0 |
| `npm run check-script-discipline` | 0 |
| `npm run check-gate-coverage` | 0 |
| `npm run check-roadmap` | pass (after retirement) |
| `npm run check-loop-artifacts` | 0 errors, 1 pre-existing warning |
| `npm run version-sync` | pass |
| `npm run check` | exit 0, `gates: PASS (full, 163.9 s)` |
| `npm run check:fast` | exit 0 on the committed tree, `gates: PASS (fast)` |

## Loop status

Zero new action items; the roadmap item closed with both findings `Resolved`.
Next work comes from `ROADMAP.md` (or a user request), not from this AAR.

LOOP PAUSED
