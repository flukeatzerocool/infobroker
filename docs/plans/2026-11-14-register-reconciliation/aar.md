# AAR — Full-review register reconciliation and clause-tag binding

AAR: SUCCESS — the register census now matches the tree, three rows closed with
proof, 13 re-homed under two roadmap sections, and the tag parser recovers 17
slugs; the binding rule is measured and reported, not gated.

## 1. What was supposed to happen

`ROADMAP.md` § Full-review register reconciliation, as planned in `plan.md`
(standard depth, cold pass, 13 steps, 12 done-bar items). Scope: re-derive the
register census, verify the 16 `Scheduled-roadmap` rows, fix `F-R5-C-5`, retire
`F-M1-3`'s stale bullet, and harden `clauseTagsFromPayload`. Explicit
assumptions: the roadmap's `F-R5-C-5` "already fixed" claim was an
assumption to check, and the tag-binding false-positive rate was unknown and
had to be measured before it could gate.

## 2. What happened

All 13 steps ran. Deviations:

1. **Step 2b's comparator changed shape mid-execution.** The pre-change column
   was first captured with run-consuming semantics, which would have made the
   "no count drops" check vacuous. It was re-captured with old-parser semantics
   (one token per REQ), which is what the change actually alters; the recorded
   delta is instances 232 → 249 and distinct pairs 194 → 204. This is a
   measurement correction inside the plan's own step, not a scope change.
2. **The binding resolver needed a stem rule.** The first implementation
   required exact title tokens and produced 3 failing unit tests because
   "republish" does not equal "republished". A ≥4-character prefix match was
   added; short words stay exact so a shared "not" cannot bind. The measured
   rate (70.7%) is unchanged in direction and is recorded as measured *before*
   the resolver's own tests entered the scan population.
3. **Step 12's register edit touched four cells, not one** — the plan required
   this after cold pass 2, and the execution confirmed the fourth (`F-M1-2`)
   was still stale.

Loop closure: plan reviewed (`plan-review passed.`, fresh) → executed
(`build-review passed.`) → outcome verified (`npm run check` full + targeted
tests) → findings routed (SK-1 to the skill register; no project action items).

Gate outcomes:

| Gate | Token | Verdict |
|------|-------|---------|
| plan-review | `plan-review passed.` | passed (3 cold passes; third user-authorized) |
| independent-review | `independent-review passed.` | passed (stages 5/5) |
| drift-report | — | not run (no doc-drift question in scope) |
| build-review | `build-review passed.` | passed |
| spec-review | — | not run (no spec-review request) |
| proofread | — | not run |

## 3. What went right

- The cold pass caught two real blockers that execution would have baked in: a
  wrong slug-ownership premise (would have re-bound REQ-021b's branches to
  REQ-021) and an under-scoped register rewrite.
- Every count in the plan was re-measured rather than trusted; two of the
  plan's own numbers were wrong on the first draft (tag distribution, then the
  "named" population) and were corrected before execution.
- The mutation checks were real: the `snapshot_tier` assertion fails when the
  field is removed, and the six-slug case fails against the old parser loop.
- The binding rule's 70.7% rate made the report-only outcome obvious and cheap;
  the gate stayed green without weakening the measurement.

## 4. What went wrong

- **The census script's first design could not pass its own done bar.** It
  baked a constant 16-ID set that step 6 changes; cold pass 2 caught it. The
  self-check now pins only disposition-invariant totals.
- **The binding resolver's first implementation was too strict.** Exact token
  matching produced 3 failing tests against correct test titles; the stem rule
  is the fix.
- **The measurement was briefly contaminated** by the resolver's own unit
  tests (249 → 285 pairs) because the probe walks all of `src/**/*.test.ts`.
  The recorded rate is the pre-test measurement; the probe is evidence, not a
  gate.
- **Two line-number citations had drifted** from the findings (`corroborate.ts`
  projection moved 909-919, `index.ts` crawl return moved ~70 lines). Each row
  was re-located by behavior, not by the stale number.

## 5. Session performance

- **Outcome vs done bar.** All 12 items hold: census self-check 276/276;
  four register cells agree; 16 rows dispositioned (3 resolved, 13 re-homed);
  `F-M1-3`'s bullet gone; `snapshot_tier` asserted; the six-slug case passes;
  binding measured and report-only; roadmap and DECISIONS updated;
  `validate-spec`, `check-roadmap`, `check-non-gates` green; artifacts carry
  plan/tasks/aar.
- **Scope adherence.** No file outside the blast-radius table was edited. The
  five tag lines the plan once intended to repair were correctly left alone
  once run-consumption was adopted.
- **Verification quality.** The two new behaviors are mutation-proved. The
  census is compared to an independent `python3` parse, not to itself.
- **Rework.** One plan revision cycle with two cold passes (expected at
  standard), one resolver test iteration, one measurement re-capture. No file
  was edited more than three times.
- **Cost and effort.** ~45 tool calls: 30 shell, 8 file writes, 7 edits, plus
  3 subagent cold reviews. The cold-review chain is the largest cost and it
  earned its keep twice.
- **User intervention.** One decision: authorizing the third cold pass at the
  review cap. No corrections to scope or direction.

## 6. Findings

| ID | Severity | Finding | Disposition |
|---|---|---|---|
| A-1 | P2 | The census script's self-check first pinned the `Scheduled-roadmap` set the work itself changes, making the post-disposition run fail by construction | Resolved in-session — pins only 276 rows / 276 IDs (cold pass 2) |
| A-2 | P2 | The binding resolver's exact-token rule failed correct prose titles ("republish" vs "republished") | Resolved in-session — ≥4-char stem match, short words exact |
| A-3 | P3 | Step 2b's first comparator used the new semantics, which cannot show a drop | Recorded and closed — re-captured with old semantics |
| A-4 | P3 | The binding probe counts the resolver's own fixture tags | Recorded and closed — the recorded rate is the pre-fixture measurement; the probe is evidence, not a gate |
| A-5 | P3 | Two finding citations had drifted by ~70 lines | Recorded and closed — each row re-located by behavior |

No project action item remains. The 13 open rows are tracked on `ROADMAP.md`,
not as AAR recommendations. `F-M1-3` needed no work: its disposition already
read `Resolved`, which the plan recorded as a stale roadmap bullet.

Skill findings: 1 SK record appended. Run skill-improvement-loop to triage.

**Follow-through register.** No prior open `SR-`/`PR-` finding IDs were carried
into this session; none were created.

## 7. Invocation audit

| Expected | Loaded | Verdict |
|---|---|---|
| `programming-orchestrator` | yes | routed |
| `plan-review` | yes | routed |
| `build-review` | yes | routed |
| `after-action-report` | yes | routed |
| `changelog-before-commit` | no | miss |

Invocation: 5 expected, 4 loaded, 1 miss.

The miss is recorded as SK-1: the Planned Change row in
`programming-orchestrator/references/workflows.md` does not name the changelog
step even when the plan edits `CHANGELOG.md`; the project's own commit routine
does. The entry written follows the repo's format, but the skill's reader
standard was not applied.

## Verification

**Review cap:** 2 passes declared (plan gate + post-build AAR review); used 3 passes — the third plan-gate dispatch was user-authorized at the cap (recorded in `tasks.md`) because the second dispatch's fixes were otherwise unverified.

- `npm run validate-spec` → all checks passed; the report-only binding line
  prints `196/285 pairs (68.8%)` after the resolver's fixtures joined the scan.
- `npm run check-roadmap` → OK (4 sections).
- `npx vitest run src/clause-coverage.test.ts src/corroborate.test.ts` → 24 and
  118 tests pass.
- `npm run check` (full) → **`gates: PASS (full, 168.2s)`** after this file
  existed; the earlier run failed only on the expected `missing aar.md`.
- `npm run check:fast` → **`gates: PASS (fast, 31.7s)`**.

LOOP PAUSED
