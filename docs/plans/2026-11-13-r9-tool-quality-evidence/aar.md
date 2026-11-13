# AAR — R9 tool-quality reporting and evidence

**Date:** 2026-11-13 · **Depth:** standard · **Status:** closed
**Plan:** `plan.md` (revision 3, sha `b5bc9fde…`; cold pass 1 and diff
re-review both `independent-review FAILED.`, reports in `plan.cold/`; revision 3
carries `risk accepted: no cold pass — authorized by fluke`)
**Roadmap item:** `ROADMAP.md` § R9 tool-quality reporting and evidence — retired
**Closes:** F-R9-B-1, F-R9-B-2, F-R9-B-3
**Commits:** `374f16e`, `ab26caa`, `0c9552c`, plus this increment's commit

## What happened

1. **Baseline.** `npm run status` → 2026.11.11 (tag `v2026.11.07`), 182
   unpushed, 4 roadmap items. `npm run check:fast` PASS (19/19, 28.2 s);
   `typecheck` 0; `vitest src/tdqs.test.ts` 12 passed; `check-tdqs --report`
   0 violations.
2. **Plan gate.** Two cold passes failed before execution: pass 1 found the
   promoted contradiction branch **vacuous** (the mandatory "Do NOT use" phrase
   matched `NEGATIONS`) and a done bar citing a fixture suite that does not
   exist; the diff re-review cleared those and all eight majors, failing on one
   DECISIONS sentence. Revision 3 fixed it at the standard re-review cap; the
   user recorded the risk acceptance.
3. **C1 (`374f16e`).** REQ-106's report sentence now names the conformance gate;
   `buildQualityReport` emits `paramCount`/`requiredParamCount` beside coverage,
   invocation cost, and definition size; the contradiction check is
   sentence-scoped and fails the gate; CHANGELOG and the D-106-era DECISIONS
   sentence move with it. Red-before: 2 failed; green: 14 passed.
4. **C2 (`ab26caa`).** A live 5-class disclosure matrix over all seven tools,
   with a fail on an undeclared tool and per-cell `n/a` justifications;
   `verify_claims` and `manage_kb` gained the sentences that close the three
   measured gaps; README and CHANGELOG record it. Red-before: 1 failed
   (`verify_claims` auth); green: 5 passed; probe `gaps: 0`.
5. **C3 (`0c9552c`).** Roadmap section removed; sweep-register rows 532, 534,
   535, 536, 883-885 resolved; D-115 records the carrier narrowing, the
   detector defect, and the proxy limits.

## What went right

- The cold pass earned its cost twice: it found that the *existing* detector
  could never fire, which would have shipped a gate that passes for the wrong
  reason, and it caught a DECISIONS sentence that would have deleted a
  REQ-106-mandated behavior from the record.
- Red-before/green-after was captured with a real `git stash` round trip
  (2 failed → 14 passed; 1 failed → 5 passed), not asserted.
- The measured probe found three gaps where the plan predicted two, and the
  description edits closed all three.

## What went wrong

- **Revision 1 trusted the detector's mechanism without testing it.** The plan
  claimed promotion was safe because the live tree had zero candidates, but
  zero was guaranteed by construction: every description must contain "Do NOT
  use", and `not` satisfied the negation guard. A one-line probe of the regex
  against a live description would have caught it at plan time.
- **The done bar referenced artifacts the repo does not have** (a
  contradiction fixture suite for `check-tdqs`, whose tool list is not
  injectable). The bar was restated as "unit test proves the list; the script's
  only failure condition is a non-empty list".
- **The DECISIONS edit was specified as a fragment swap**, which left a broken
  sentence and dropped shadow-candidate reporting. Fixed by quoting the whole
  replacement.
- Two cold passes reached the standard cap; the last clarity fix is verified by
  build-review rather than a third cold read.

## Findings

| ID | Severity | Predicate | Disposition |
|---|---|---|---|
| F-R9-B-1 | P1 | REQ-106's report omitted parameter counts and named a carrier the tree does not have | Resolved in-session — `buildQualityReport` + gate-side carrier |
| F-R9-B-2 | P1 | The contradiction branch was report-only **and unfireable** (mandatory "Do NOT use" satisfied `NEGATIONS`) | Resolved in-session — sentence-scoped check, fails the gate |
| F-R9-B-3 | P1 | REQ-089's behavioral-consequence clause had no assertion | Resolved in-session — declared 5-class matrix, three gaps closed |
| F-AAR-1 | P3 | `worklist.md` line anchors for the REQ-089/092/106 verdicts had drifted from the live files | Resolved in-session — rows rewritten with verified anchors |
| F-AAR-2 | P3 | `plan.md` lacked the literal `**Done bar:**` line the loop-artifact gate looks for | Resolved in-session |
| F-AAR-3 | P3 | `2026-11-10-r6-encryption-capacity-remediation/plan.md` also lacks the Done-bar line (pre-existing) | Closed-P3 — informational; that increment is closed |

## Gate evidence

| Gate | Result |
|---|---|
| `npm run check:fast` (baseline + T10) | PASS (19/19, 28.2 s / 27.8 s) |
| `npm run check` (full, final tree) | PASS (`gates: PASS (full, 166.1s)`) |
| `vitest src/tdqs.test.ts` | 14 passed (red-before 2 failed) |
| `vitest src/tool-surface.test.ts` | 5 passed (red-before 1 failed) |
| `check-tdqs` | exit 0; 7 tools, 0 shadow, 0 contradiction, 0 violation |
| `validate-spec` / `validate-readme` | All checks passed / 0 errors, 0 warnings |
| `check-intent-citations` | 172 citations, 0 findings |
| `check-gate-coverage` | 118 G1 REQs, 117 cited, 1 exempt, 0 waived |
| `check-roadmap` / `check-non-goals` / `check-loop-artifacts` | OK (4 sections) / OK / 0 errors |
| Evidence probe | `gaps: 0` after the description edits (3 before) |

## Recommendations

None outside `ROADMAP.md`. The next open section is R9 default-consistency and
provenance enforcement (F-R9-C-2, F-R9-C-3, F-R9-D-1). The 182-commit backlog
is still unpublished; publication is a separate, user-authorized step.

LOOP PAUSED
