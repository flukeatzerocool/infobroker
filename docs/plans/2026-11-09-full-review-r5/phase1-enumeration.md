# Phase 1 — R5 enumeration

Date: 2026-11-09 · HEAD `c95020a` · reviewer: parent session

## Baseline

- `npm run check` → PASS (full, 51.0 s, 22 gates; run not recorded because the tree carries this untracked increment directory)
- Carrying tests → 12 files / 165 tests PASS
- `npm run test-debate-club` → 3 files / 37 tests PASS
- `git status --porcelain` → only `?? docs/plans/2026-11-09-full-review-r5/`; 11 unpushed commits

## Anchor count (D42 unit: unique `file:line`, ranges count once)

| Cluster | Unique anchors | Probe-dependent? |
|---|---|---|
| A pipeline core/batch/budget | 26 | yes — batch order/collapse and shared budget are runtime shapes |
| B authority/families/calibration | 17 | no — covered by module tests |
| C provenance/preservation/span/modality | 16 | yes — verbose-only provenance presence |
| D KB recall | 5 | yes — fail-open needs a configured-off run |
| E `get_citations` | 14 | no — covered by `cite.test.ts`; zero-result leg is probe-only if reachable on loopback |
| F retrieval benchmark | 10 | no — deterministic tests |
| G prose | 6 | no |
| **Total (de-duplicated)** | **94** | **3 probe-dependent clusters** |

Exact anchor lists are the file:line cells in `plan.md` § Review surface plus the function list from `grep -n '^export function|^function'` over the nine source files.

**Split decision (D42): `split: not triggered`** — 94 ≤ 120 and 3 < 4 probe-dependent clusters.

## REQ rows (15) and `_Check:_` kinds

| REQ | Check | Cited test | Named clause tags |
|---|---|---|---|
| REQ-026 | G0, G1 | `corroborate.test.ts:1`, `tool-surface.test.ts` | n/a |
| REQ-026a | G1 | joint header only | none |
| REQ-026b | G1 | `corroborate.test.ts` positive-overlap | 1 |
| REQ-026c | G1 | `preservation.test.ts` (cites REQ-122 only) | none for 026c |
| REQ-026d | G1 | joint header only | none |
| REQ-026e | G1 | joint header only | none |
| REQ-026f | G1 | joint header only | none |
| REQ-026g | G1 | 8 batch tags | 8 |
| REQ-026h | G1 | `corroborate.test.ts` + `modality.test.ts` (7) + `span.test.ts` (3) | 10 |
| REQ-121 | G1 | `source-family.test.ts` (5) | none |
| REQ-122 | G1 | `preservation.test.ts` (5) | none |
| REQ-123 | G1 | `calibration.test.ts` (4) | none |
| REQ-130 | G1 | `retrieval-benchmark.test.ts` (6) | none |
| REQ-027 | G0, G1 | `cite.test.ts`, `bibtex.test.ts` | n/a |
| REQ-027a | G1 | `cite.test.ts` | none |

Clause-bearing REQs needing named branch tags per AGENTS.md: 026c, 026e, 026f, 026g, 026h, 122, 123, 130, 027a.

## Tracker drift

- R5 `Code:` line omits `preservation.ts`, `modality.ts`, `span.ts`, `retrieval-benchmark.ts`, `scripts/calibrate-confidence.ts`, both fixture dirs; includes R4-owned `structured-fact.ts`.
- R5 `Spec:` line/coverage row omits §1 goal 4 and §3 SR-008, both assigned to R5 by the prose-ownership table (`worklist.md:87,98`).
- `worklist.md:282` (R6) still lists `src/retrieval-benchmark.ts`, which is R5's (REQ-130).
- `src/corroborate.ts:1` header omits `REQ-026f` even though the file implements reconciliation; `src/corroborate.test.ts:1` lists it. Candidate citation finding.

## Schema confirmation (G0 halves)

- `verify_claims`: six parameters, `query`/`claims` optional with "supply either", `max_iterations` default 5 max 10, `confidence_threshold` default 0.8, `providers` array, `priority` enum — matches REQ-026 (`src/index.ts:1861-1868`).
- `get_citations`: `query` required, `max_results` default 8 max 30 — matches REQ-027 (`src/index.ts:2488-2491`).
