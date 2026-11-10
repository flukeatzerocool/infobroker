# AAR — Full-repository review sweep (program close)

**Date:** 2026-11-10 · **Scope:** the whole program — Phase A scaffold, chunks R1–R9, and the M1 machine-evidence pass. **Roadmap item:** retired at this close.
**Increment records:** `docs/plans/2026-11-09-full-review-r{1..7}/`, `docs/plans/2026-11-10-full-review-r{8,9}/`, `docs/plans/2026-11-10-full-review-m1/`.
**Tracker:** `docs/plans/2026-11-09-full-review-sweep/worklist.md`.

## What happened

1. Phase A (2026-11-09) recorded the baseline, enumerated 142 §4 REQs and the 7-tool / 27-provider surface, calibrated the citation rules, and partitioned the repo across nine review chunks plus a machine-evidence pass.
2. Chunks R1–R9 closed between 2026-11-09 and 2026-11-10. Each carried a verdict table for its REQs, a finding register block, an increment record, and green gates.
3. M1 (2026-11-10) re-ran the full evidence battery, reconciled the program's coverage invariant, repaired two tracker defects, closed the last open prose unit, retired the roadmap item, and wrote this AAR.

## Phase A record (preserved)

The scaffold increment is superseded but not erased. Its outcome: 142 REQs partitioned 6 + 25 + 14 + 12 + 15 + 29 + 17 + 15 + 9 = 142; every §1–§10 and Appendix A–E section assigned exactly once; calibration rules established that shaped every chunk.

| ID | Scaffold finding | Disposition |
|---|---|---|
| F-A1 | No `spec/audit/req-coverage.md` family register exists; per-REQ citations are the only traceability surface | Recorded as calibration rule 3; not a defect |
| F-A2 | `check-gate-coverage` proves citation existence, not assertion coverage | Recorded as calibration rules 1, 4, 6; it became the sweep's primary target |
| F-A3 | 13 REQs have no test citation, all G3-only (REQ-091 also G1-exempt) | Recorded as calibration rule 1; not a finding |

## Chunk outcomes

| Chunk | Surface | REQs | Closed | Outcome |
|---|---|---|---|---|
| R1 | Contracts and envelope | 6 | 2026-11-09 | 1 P1 + 2 P1 fixed in-session (compact verbosity, KB cache-hit truncation, `max_results` headroom) |
| R2 | Config, providers, resilience | 25 | 2026-11-09 | 19 P1 findings scheduled; the P0 startup crash on a non-object `providers` layer fixed in-session |
| R3 | `search_web` | 14 | 2026-11-09 | 10 P1 findings scheduled; several live probes settled precedence and `ignored_params` |
| R4 | `fetch_page` | 12 | 2026-11-10 | 9 P1 findings scheduled; the crawl-never-recursed P0 fixed in-session with an Arena regression |
| R5 | Corroboration and citations | 15 | 2026-11-09 | 9 P1 findings scheduled; the snapshot-basis P0 fixed in-session |
| R6 | Knowledge base | 29 | 2026-11-09 | 13 P1 findings scheduled across seven remediation sections |
| R7 | Client artifacts and reporting | 17 | 2026-11-09 | 8 P1 findings scheduled; the watchlist `[ERROR]`-recorded-as-ok P0 fixed in-session |
| R8 | Deployment, state, security | 15 | 2026-11-10 | 1 P1 (update-preservation has no test) scheduled; deep depth, committed probe harness |
| R9 | Spec integrity and tool quality | 9 | 2026-11-10 | 7 P1 findings scheduled; gate-assertion strength was the theme |
| M1 | Machine evidence and program close | — | 2026-11-10 | battery green; 3 tracker findings resolved/recorded; roadmap item retired |

## Machine evidence (M1)

HEAD `deab019`, version 2026.11.7, tree clean apart from the increments' docs.

| Leg | Status | Result |
|---|---|---|
| `npm run check` (full, step 1) | exit 0, 51.2 s | 22 gates; `vitest` 106 files / 1101 tests; Arena 3 / 37; `check-pack` 358 files; `audit` 4 low advisories |
| `npm run check` (step 16, after tracker/roadmap edits) | exit 0, 53.7 s | same suite, green |
| `npm run check-pack` | exit 0 | 358 files, 392746 bytes, 7 tools |
| `npm run test-debate-club` | exit 0 | 3 files / 37 tests |
| `npm run audit` | exit 0 | 4 low-severity, no high/critical |
| `npm run check-tdqs -- --report` | informational | 7 tools; 0 shadow candidates, 0 contradiction candidates, 0 violations |
| `npm run check-gate-coverage -- --report` | informational | 118 G1 REQs: 117 cited, 1 exempt, 0 waived, 0 uncovered |
| `npm run check-fixtures -- --now=2026-11-10` | informational | 8 fixtures, 0 stale (max 78 d of a 90-day cadence) |
| Final-tree `npm run check` (step 18) | exit 0, 51.1 s | full suite green on the finished tree |

## Coverage reconciliation

| Check | Result |
|---|---|
| §4 REQ verdicts | **142/142 distinct IDs** carry a row (143 rows; REQ-106 has two by design). Zero missing, zero extra against the §9.5 manifest |
| Finding register | **275 rows**, 275 distinct IDs; all 119 `finding:` citations in verdict tables resolve |
| Severity | P0 4 (all resolved in-session), P1 81, P2 97, P3 93 |
| Dispositions | `Resolved` 12, `Scheduled-roadmap` 169, `Closed-P3` 94, `Deferred-by-user` 0. Open P0: **0** |
| Prose | 22/22 ownership units carry a row. §1 goal 3 was the one gap (F-M1-1) |
| Roadmap mapping | 169 scheduled rows: 75 name their ID in a `ROADMAP.md` section, 42 (R2 27 + R3 15) are covered by a chunk-register trigger, 52 (R4 18, R5 28, R6 6) have no roadmap home (F-M1-2) |
| Roadmap retirement | 29 `##` headings → 28: the sweep section removed, 27 remediation sections and `## Non-goals` intact, verified by heading-list diff |

## What went right

- The citation-kind calibration from Phase A held: no G3-only REQ was misreported as a missing test, and the real defect class — a test asserting less than its REQ — was found repeatedly.
- Fresh-context review per chunk caught authored-in blind spots; M1's cold pass caught a false coverage invariant in this very plan before it could close the program on a bad claim.
- The P0 policy worked: four P0s were fixed in-session with regression coverage, and none shipped into the close.
- Retirement was proven by heading-list diff rather than by count, so removing the wrong section could not pass.

## What went wrong

- **A claimed invariant that was false.** M1's draft asserted that every `Scheduled-roadmap` finding ID is named in `ROADMAP.md`. A pre-scan regex silently matched nothing (the dispositions are backticked), so the claim read as green. The cold pass caught it; the truth is three mapping forms, two of which do not name IDs.
- **A deferral to a closed chunk.** R4 dispositioned F-R4-C-9 `Deferred-R1` after R1 had closed, so the deferral never landed. Found and re-targeted at the close (F-M1-3).
- **An unrecorded prose unit.** §1 goal 3 was assigned to R3 by the ownership table while R3's own decision record claimed §7.4 only; no chunk wrote the row (F-M1-1).
- **52 unbacked `Scheduled-roadmap` dispositions.** P2 rows claim roadmap scheduling that no section carries. Recorded as a census (F-M1-2), not silently rewritten.

## Findings

| ID | Severity | Disposition |
|---|---|---|
| F-M1-1 | P3 | Resolved in-session — §1 goal 3 row recorded from R3's REQ verdicts |
| F-M1-2 | P3 | `Closed-P3` — unbacked-disposition census recorded; malformed row repaired |
| F-M1-3 | P3 | Resolved in-session — F-R4-C-9 re-targeted to the R4 extraction remediation section |

No P0 or P1 findings were opened at the close. The 81 P1 rows and the scheduled P2 surface live on `ROADMAP.md` as 27 remediation sections.

## Gate evidence

| Gate | Result |
|---|---|
| `npm run check` (step 1, baseline) | PASS (full, 51.2 s) |
| Individual non-fast gates | PASS (`check-pack`, `test-debate-club`, `audit`) |
| Informational reports | 0 TDQS violations; 0 uncovered G1 REQs; 0 stale fixtures |
| `npm run check` (step 16) | PASS (full, 53.7 s) |
| `npm run check` (step 18, final tree) | PASS (full, 51.1 s, exit 0) |
| Tracker/roadmap gates | `check-roadmap` (28 sections), `check-non-goals`, `check-loop-artifacts` (18 increments), `check-gate-table` (22 gates) PASS |

## Conditions carried

- **C-1 — unpushed backlog.** 28 commits (oldest ~19 h) predate the program close. Publication is user-authorized and was not part of the close. The evidence above is local and no CI run has observed these chunks.

## Next

The roadmap now holds the 27 remediation sections the sweep produced. Its first item is `R6 manage_kb action-contract remediation`; R6, R2, and R3 remediation triggers have all fired (they wait on chunks that are closed). No work starts without a user request.

LOOP PAUSED
