# Targeted diff re-review — 2026-11-14-corroboration-citation-benchmark-fidelity

Reviewer: review (same independent cold reviewer; no authoring context)
Depth: standard · re-review 1 of 1 (review cap 2: initial cold pass + this re-review)
Reads used: 5/12
Prior artifact: `plan.cold/report.md` (cold pass over sha256 `43813a84…`)
Scope: the 13 findings from the initial pass and the amended sections only; no new-lens
sweep (no machine diff exists — the plan is untracked and was revised in-session).

## Probe results

- `rg -n "archiveBudgetMs|ARCHIVE_TOTAL_BUDGET_MS" src/corroborate.ts src/corroborate.test.ts`
  → **5** lines (`corroborate.ts:583, :876, :1019, :1042`; `test:1081`). The revised
  Step 0.3 originally listed 3, so the "stop on mismatch" rule would have halted on a
  correct tree (N4).
- `rg -c "fallback_depth" src/cite.ts` → **1** (`:148`) ✓.
- `rg -c '^\| F-R5-' worklist.md` → **53** ✓.
- Independent recount of the amended REQ-026c body: **535 body chars, 3 sentences,
  6 SHALL** — matches D5. The plan's pre-edit **449** includes ` _Check:_ G1.`; body-only
  is 436 (basis mismatch only; still far under 800).

## U-7 ruling (clause branch)

Applied the executable detector, not the AGENTS prose. `src/clause-coverage.ts:23`
matches only `/\bwhen\b[^.\n]*?\bdeclares\b/`; the amendment's "when the attempt
completes within the preservation budget" has no `declares`, so it does not fire. `:19`
needs a parenthesized `or` enumeration; the amendment has none. `WHEN_CLAUSE_RE`
prose-class detection (`:30-73`) needs an `a/an` introducer plus `or` inside a `WHEN`
clause; the amended first sentence has neither. **No new branch; REQ-026c's four
existing tags remain sufficient.**

## Process note

`plan.cold/report.md` records the pre-revision plan hash (`43813a84…`). The revision
that resolves its Majors is `da33dd894482d58f7dbc695174a72fefc3b5c260d3345864cd88f50b30ccc139`
(before the final N4/`:310` wording fixes). This re-review is the Stage-4 pass those
edits triggered; the stamp binds this file, not the initial report.

## Findings

| # | Finding | Status | Evidence |
|---|---|---|---|
| M1 | Register census contradictory; `:588` left false | **RESOLVED** | Baseline makes `census.ts` authoritative (276 / 179 / 93 / 4 / 0) and explains `:588`/`:894`; Step 5.3 rewrites `:585` and `:588` |
| M2 | "0 open roadmap items" unsatisfiable | **RESOLVED** | Baseline records 2 sections → 1; Step 5.4 expects **1** |
| M3 | "rejects" on a synchronous target | **RESOLVED** | Step 3 now `expect(() => runBenchmark(...)).toThrow("boom")`; async conversion rejected in D3 |
| M4 | `rankedUrls` parameter-name collision / signature | **RESOLVED** | D3 states `type Reconciler`, `rankedUrls(candidates, query, reconcile: boolean, reconciler: Reconciler)`, `runBenchmark(cases, k=5, reconciler=reconcileResults)`; raw path = boolean false branch |
| M5 | Deadline skipped snapshots vs unamended REQ-122 | **RESOLVED** | D4: storage never skipped; a timed-out assessor maps to REQ-122's storage-failure clause and is named in D-122; test at Step 4.3. No dedicated assessor-timeout test — disclosed as C-2 |
| M6 | Post-edit counts wrong (6 SHALL, 3 sentences) | **RESOLVED** | D5 states 535 / 3 / 6 with the body-only basis and the corrected pre-edit figures |
| M7 | Title-index shape / conflicting representative rules | **RESOLVED** | D2: `Map<string, CitationResult[]>`, single first-seen-in-chain rule, DOI-promotion rejected |
| M8 | Commit item 7 had no producing step | **RESOLVED** | Commit series stops at 6; `prep`/`release` separate and gated by a clean tree |
| N1 | Census cited at `:584` | **RESOLVED** | Step 5.3 cites `:585`; baseline no longer cites `:584` |
| N2 | One tag cited where four exist | **RESOLVED** | D5 lists `corroborate.test.ts:965, :991, :1013, :1049` — all four verified |
| N3 | "can never trip" overclaim | **RESOLVED** | Scope item 3 reworded to the degraded-comparison defect |
| N4 | Step 0.3 probes had no baseline value / wrong count | **RESOLVED** | Step 0.3 now lists all five matching lines, including the two constant references |
| N5 | Appendix B "one logical contract" omitted | **RESOLVED** | Step 1 verification adds it; D5 asserts compliance |

Counts: **0 Blockers · 8 Majors resolved · 5 Nits resolved.**

```text
independent-review passed.
```

## Final binding

Plan sha256: 2e0764ac69e4da8a1b8cd7ac0f63a1d581a672b5f30870885699c1575e7c512e

Verified against the frozen artifact: Step 0.3 now lists all five archive-budget match lines (`src/corroborate.ts:583, :876, :1019, :1042`; `src/corroborate.test.ts:1081`), Step 5.4 now reads "its four remaining rows are now resolved (the other three were retired on 2026-11-14)", and D5's pre-edit figure is stated on the body-only basis (436 characters; 449 including the `_Check:_ G1.` marker).

independent-review passed.
