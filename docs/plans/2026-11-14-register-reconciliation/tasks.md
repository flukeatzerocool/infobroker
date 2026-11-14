# Tasks — Full-review register reconciliation and clause-tag binding

Execution log. One entry per plan step. Evidence lines are copy-pasted command
output or a named test, not summaries. The two step-2 baselines are recorded
here because later done-bar items compare against them.

## Step 1 — Baseline (2026-11-14)

- `git log -1 --oneline` → `2a7c7a1 docs(loop): define the AAR tokens once and point AGENTS at them`
- `npm run status` → unpushed 236, oldest 4.9 d, version 2026.11.11, latest tag
  v2026.11.07, open roadmap 2, last pipeline run 2026-11-07.
- `npm run check` → `gates: PASS (full, 172.0s)`; recorded full run for `2a7c7a1af029`.

### Plan-gate review record

Three cold dispatches, all by an `independent-review` subagent in a fresh
context; full report at `plan.cold/report.md`.

1. Dispatch 1 — `independent-review FAILED.` (2 blockers, 6 majors, 4 nits).
2. Dispatch 2 — `independent-review FAILED.` (1 blocker, 3 majors); this was
   the standard depth's one permitted diff re-review.
3. Dispatch 3 — user-authorized beyond the cap (user selected "Third targeted
   re-review" in the session prompt on 2026-11-14, because the dispatch-2 fixes
   were otherwise unverified) — `independent-review passed.`, `stages 5/5 ·
   reads 2/6`.

Stamped: `kind planned`, `independence fresh`, `depth standard`, plan sha256
`411e9bf2848bedba4cf243cfc1875b5888750d04efd435afe023f441b12e3bae`.

## Step 2 — Two baselines

### 2a — Census script

`npx tsx docs/plans/2026-11-14-register-reconciliation/evidence/census.ts` → exit 0:
```
rows: 276
distinct ids: 276
  Resolved: 167
  Closed-P3: 93
  Scheduled-roadmap: 16
scheduled-roadmap (16): F-R4-A-2, F-R4-C-4, F-R4-C-5, F-R4-C-6, F-R4-C-11, F-R4-D-4, F-R4-E-2, F-R5-A-3, F-R5-B-6, F-R5-C-4, F-R5-C-5, F-R5-C-6, F-R5-C-8, F-R5-E-1, F-R5-E-2, F-R5-F-1
scheduled without a ROADMAP.md mention (15): F-R4-A-2, …
census self-check OK
```
The 16 IDs match the plan's evidence table exactly.

### 2b — Independent per-REQ slug counts (pre-change)

Old-parser semantics (one token after a REQ ID), from the `python3` parse over
`src/**/*.test.ts`:

```
slug instances: old=232 new=249 delta=17
reqs that drop: none
REQ-021h   1 -> 8
REQ-021i   6 -> 8
REQ-038    3 -> 4
```

(`new` is the run-consuming rule, measured on the same tree before the resolver
existed. Distinct `(REQ, slug)` pairs: 194 → 204; the 17 is instance count,
7+3+5+1+1.)

## Step 3 — Row verification, batch 1 (R4)

| Row | Verdict | Evidence |
|---|---|---|
| F-R4-A-2 | **Resolved** | `src/lib/fetch-target.ts:12-19` `withGuardedTarget`; called at `src/index.ts:922`; `src/fetch-target.test.ts` refuses private/rebinding/unresolvable before dispatch |
| F-R4-C-4 | Open | crawl returns at `src/index.ts:~1484`, extract at `:~1512`, `pageDate` computed at `:1548` |
| F-R4-C-5 | Open | KB-cache read guarded by `!crawl && !extract && !question` (`src/index.ts:~1203`) |
| F-R4-C-6 | Open | `detectPageDate` skips the metadata GET when `head.status` is 3xx (`src/index.ts:~890`) |
| F-R4-C-11 | Open | `$("[itemscope]").find("[itemprop]")` flattens nested items and keeps only the first value (`src/extract.ts:38-45`) |
| F-R4-D-4 | Open | `rawRequestError(params.url, …)` runs before `doFetchPage`'s array coercion (`src/index.ts:1993`), and `Array.isArray` is false for a JSON-array string (`src/structured-output.ts:157-161`) |
| F-R4-E-2 | Open | `factFromRows(kind, rows, "wikipedia", url)` names one source for infobox and table rows (`src/structured-fact.ts:368`) |

## Step 4 — Row verification, batch 2 (R5)

| Row | Verdict | Evidence |
|---|---|---|
| F-R5-A-3 | Open | `applyPriority` returns `privacy_critical` for `privacy` regardless of the caller's allowlist; `quality` has no branch (`src/corroborate.ts:499-519`) |
| F-R5-B-6 | **Resolved** | `scripts/calibrate-confidence.ts:44-53` reads `calibration.enabled` and `secondary_only_cap`; `:92-93` passes them to `buildCalibrationReport` |
| F-R5-C-4 | Open | `if (!source.content_sha256) tasks.push(...)` skips a pre-existing hash (`src/corroborate.ts:~937`) |
| F-R5-C-5 | **Fixed this increment** | see step 5 |
| F-R5-C-6 | Open | `source_types` accumulates across findings; `provenance.sources[]` has no finding index (`src/corroborate.ts:880-905`) |
| F-R5-C-8 | Open | `await archiveCondensedSources` then `await snapshotCondensedSources` before the response (`src/corroborate.ts:870-874`) |
| F-R5-E-1 | Open | `.slice(0, config.output.fallback_depth)` on the academic chain (`src/cite.ts:149`) |
| F-R5-E-2 | Open | dedupe key is `doi:` or `title:`, never cross-matched (`src/cite.ts:121-126`) |
| F-R5-F-1 | Open | `rankedUrls` catches every reconciler error and returns the raw order (`src/retrieval-benchmark.ts:99-106`) |

## Step 5 — Fix F-R5-C-5

- `src/corroborate.ts:913` adds `snapshot_tier: s.snapshot_tier` to the
  `provenance.sources[]` projection.
- `src/corroborate.test.ts` (`labels snippet snapshots and skips policy-flagged
  text (REQ-122)`) asserts `provenance.sources[0].snapshot_tier === "evergreen"`.
- Evidence: `npx vitest run src/corroborate.test.ts -t "labels snippet snapshots"` → 1 passed.
- Mutation: field removed from the projection → 1 failed; restored → 1 passed.

## Step 6 — Dispositions

16 rows written (2 fixed earlier, 1 fixed here, 13 re-homed):
`F-R4-A-2`, `F-R5-B-6`, `F-R5-C-5` → `Resolved`; the 13 survivors →
`Scheduled-roadmap — <section>`. Census after: 170 `Resolved` / 93 `Closed-P3`
/ 13 `Scheduled-roadmap`, self-check OK.

## Step 7 — Re-home survivors

`ROADMAP.md` § Full-review register reconciliation retired; two sections added,
each 3 bullets with a **Trigger:** line:

- § Fetch and extraction fidelity — F-R4-C-4, F-R4-C-6, F-R4-C-5, F-R4-D-4,
  F-R4-C-11, F-R4-E-2.
- § Corroboration, citation, and benchmark fidelity — F-R5-A-3, F-R5-C-4,
  F-R5-C-6, F-R5-C-8, F-R5-E-1, F-R5-E-2, F-R5-F-1.

Evidence: `npm run check-roadmap` → `OK … (4 section(s))`; census →
`scheduled without a ROADMAP.md mention (0): none`.

## Step 8 — Parser fix (slug run)

- `clauseTagsFromPayload` consumes the run after each REQ ID.
- New unit case: the `src/batch.test.ts:1` shape → `REQ-021b` gets all six
  slugs, `REQ-021k` none, `REQ-076a` = `blend`.
- Evidence: `npx vitest run src/clause-coverage.test.ts` → 24 passed.
- Mutation: the old one-token loop restored → the new case fails and the parse
  shows 17 fewer instances (232 vs 249).

## Step 9 — Independent post-change counts

See step 2b's table: no REQ drops; instances 232 → 249 (+17); distinct pairs
194 → 204. `validate-spec` prints tags only for a violating REQ, so the
comparator is the parse above.

## Step 10 — Binding dry run

`npx tsx docs/plans/2026-11-14-register-reconciliation/evidence/bind-rate.ts`
(before the resolver's own tests were added to the tree):
```
pairs: 249, bound: 73, unbound: 176
unbound rate: 70.7%
src/analysis.test.ts:1 REQ-127 topics [file] ""
src/batch.test.ts:1 REQ-021b content-mode [file] ""
src/batch.test.ts:330 REQ-020i aggregate-time [block] "names url, provider, status, passages, and truncation per in…"
…
```
Denominator: distinct `(REQ, slug)` pairs. Line- and file-level counts are in
the script output. All sampled unbound cases are benign: prose titles
("counts short republished snippets as one family") against kebab slugs
("short-republish-family").

## Step 11 — Binding decision

**Report-only** — 70.7% unbound exceeds the 10% bar by 7×, so per C-3 the
binding dimension does not gate. `scripts/validate-spec.ts` prints the rate and
the first five unbound sites to stderr and still exits 0. Recorded as D-120.
`infobroker.md:1202-1207` states the run-ownership rule and that the binding is
reported, not enforced. Resolver unit tests: file scope, above-block,
inside-block, unbound, and no single-word binding (5 cases).

## Step 12 — Re-derive and record

- Census script re-run after the dispositions: 276 / 276 / 170 / 93 / 13 / 0.
- `worklist.md:583`, `:585`, `:588`, `:894` rewritten to the re-derived numbers
  and the new roadmap mapping.
- `ROADMAP.md` section retired; `DECISIONS.md` D-120 added; `CHANGELOG.md` entry
  added.

## Step 13 — Close

- `npm run check` (full) → `gates: PASS (full, 168.2s)`; `npm run check:fast`
  → `gates: PASS (fast, 31.7s)`.
- `aar.md` written, ending `LOOP PAUSED`; `**Review cap:**` records 3 passes
  with the user authorization for the third.
- `check-loop-artifacts` → `0 error(s), 1 warning(s)` (the warning is the
  pre-existing 2026-11-10 plan).
