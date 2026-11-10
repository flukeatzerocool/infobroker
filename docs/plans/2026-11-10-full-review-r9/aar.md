# AAR — Full-review sweep, chunk R9 (spec integrity and tool quality)

**Date:** 2026-11-10 · **Depth:** standard · **Outcome:** closed
**Plan:** `plan.md` (self pass + independent cold pass, 5/5 stages, report `plan.cold/report.md`, sha256 `8dde8409…`, verdict `independent-review passed.`)
**Tracker:** `docs/plans/2026-11-09-full-review-sweep/worklist.md`
**Next trigger:** M1

## What was done

1. **Baseline recorded.** `npm run check` PASS (full, 51.7 s), `npm run check:fast` PASS (19.7 s), carrying tests 5 files / 56 tests PASS, Arena 3 files / 37 tests PASS, at HEAD `e6cf179`, version 2026.11.7.
2. **Phase 1 enumeration.** 34 distinct code anchors across clusters A–C, **no probe-dependent cluster** (every REQ resolves to a gate, a test, or a file-presence artifact), so split **not triggered**.
3. **Nine REQ verdicts, 11 prose rows.** 2 REQs hold; 7 carry findings (3 with two findings). Register rows appended; tracker corrected: the `Code:` line no longer names the nonexistent `src/tool-surface.ts`, the `Spec:` line and status-board cell now carry §1 and SR-011/SR-012, and the status board reads closed.
4. **Dispositions.** 7 P1s and 1 P2 scheduled on `ROADMAP.md` as three remediation sections; 2 P3s closed (one informational, one tracker drift resolved in-session). Zero P0.
5. **Roadmap.** The sweep trigger advanced to M1; three new R9 remediation sections were admitted under the roadmap admission rule.

## What went right

- The cold pass earned its cost again: it caught a P0-pool contradiction that would have forbidden the only bounded fix for REQ-089/090, an undefined `D77` used eight times, an unsatisfiable split branch, and a false tracker-drift item before any verdict row was written.
- The gate-assertion rule (D83) produced the chunk's main yield: the taxonomy gate checks presence but not "exactly one area" and never reads its gate column; the clause guard passes a three-branch REQ on two tags; the default-consistency gate reconciles two of five declared defaults.
- Boundary discipline held: `REQ-107` routing and the R7 report/skill gates were read as evidence only, so R9 did not re-litigate closed chunks.

## What went wrong

- **The plan over-predicted one finding direction.** It expected the REQ-092 conformance gate to be missing; `validate-spec.ts:803-840` already enforces a static bar. The verdict had to be re-framed from "no gate" to "gate enforces the structural subset", which is a narrower but still real finding (F-R9-B-3).
- **Line-anchor drift cost two review passes.** SR-011/SR-012 ranges and `worklist.md:99` were wrong in the drafted plan; the cold pass caught them. Anchors copied from the ownership table should be re-derived from the spec at plan time.
- **`check-tdqs`'s report shape was mis-stated at plan time** (the plan said it might omit the metrics; it omits `paramCount`, which is what produced F-R9-B-1).

## Findings and dispositions

| ID | Severity | Disposition |
|---|---|---|
| F-R9-A-1 | P1 | `Scheduled-roadmap` — R9 traceability and taxonomy gate strength |
| F-R9-C-1 | P1 | `Scheduled-roadmap` — same item |
| F-R9-B-1 | P1 | `Scheduled-roadmap` — R9 tool-quality reporting and evidence |
| F-R9-B-2 | P1 | `Scheduled-roadmap` — same item |
| F-R9-B-3 | P1 | `Scheduled-roadmap` — same item |
| F-R9-C-2 | P1 | `Scheduled-roadmap` — R9 default-consistency and provenance enforcement |
| F-R9-C-3 | P2 | `Scheduled-roadmap` — same item |
| F-R9-D-1 | P1 | `Scheduled-roadmap` — same item |
| F-R9-D-2 | P3 | `Closed-P3` — G2 is advertised as optional and has no shipped runner |
| F-R9-Z-1 | P3 | Resolved in-session (tracker corrections) |

D80 cross-chunk notes: the §9.2 update-preservation bullet has no carrier, but that is F-R8-A-1's open row and was not re-filed. `REQ-107` routing-citation defects remain F-R7-G-*'s.

## Gate evidence

| Gate | Result |
|---|---|
| `npm run check` (step 1, un-piped) | PASS (full, 51.7 s) |
| `npm run check:fast` (step 2) | PASS (19.7 s) |
| Carrying tests | 5 files / 56 tests PASS |
| `npm run test-debate-club` | 3 files / 37 tests PASS |
| `npm run check:fast` (step 19, after tracker/roadmap edits) | PASS (19.2 s) |
| `npm run check` (step 19, un-piped) | PASS (full, 49.4 s) |
| `npm run check` (step 22, final tree) | PASS (full, see session log) |
| Tracker/roadmap gates | `check-roadmap`, `check-loop-artifacts`, `validate-spec`, `check-gate-table` PASS |

## Recommendations

- None outside `ROADMAP.md`; the three scheduled sections are the remediation surface.
- M1 is the last program unit: it runs the machine-evidence pass over all chunks and closes the roadmap item.

LOOP PAUSED
