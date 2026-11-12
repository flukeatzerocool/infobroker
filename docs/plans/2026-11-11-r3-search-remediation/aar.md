# AAR — R3 `search_web` findings remediation

**Status:** complete · **Date:** 2026-11-11 · **Loop:** `LOOP PAUSED`
**Plan:** `docs/plans/2026-11-11-r3-search-remediation/plan.md` (standard; independence fresh — cold pass + diff re-review + confirmation pass, 5/5 stages).
**Predecessor:** `c8408d5` (R2e close).

## What happened

1. Baseline at `c8408d5`: `npm run check` PASS (22 gates, 119.2 s), tree clean except the plan directory.
2. Fifteen register rows (10 P1, 5 P2) were re-verified against the tree; several register anchors had drifted (e.g. the analysis attachment sites moved from `:680/:697` to `:349/:406/:708/:725`).
3. Failing tests were written first for every behavior. A red run with the production files stashed and the new tests kept produced **22 failures across 9 files** — every new behavior test failed on the unmodified source.
4. Fixes landed in four slices: selection and reporting, result set and provenance, batch and analysis, modes and truncation.
5. Two test-support deltas were required and are recorded in `delta.md`: four additive stub-provider options (`results`, `urls`, `servePages`, `contents`, plus a `/page/N` HTML route) so the collapse and deep-under-compact cases are expressible on loopback, and the Arena RPC timeout raised from 30 s to 60 s because a research compile now fans out to multiple variants.

## What went right

- The red-first pass caught two real design gaps the plan text did not: `ok()` strips *all* meta in compact mode, so retaining `language_unsupported` in `compactEnvelope` was not enough (a `pickRequiredMeta` helper was added); and the stub's results collapse into one row when the snippet is empty, which would have made the F-R3-15 assertion vacuous.
- The KB-first handler test seeds the real SQLite store from the parent process against the hermetic storage path, so metadata and ordering are asserted through the spawned server rather than a copy of the handler.
- The lines-verified predicate table made the slice order obvious; each commit is independently `typecheck`-clean.

## What went wrong

- The F-R3-2 comparator fix is not observable through `selectChain` on V8: exhaustive permutation checks showed the old and new comparators produce identical sorts. The contract is now pinned by exporting `compareByLatency` and testing antisymmetry directly, which is a genuine red on the old tree (the function did not exist) but weaker than a behavioral before/after.
- The first pass at moving task-type resolution above KB recall duplicated the block three times through careless edits; it was repaired by a scripted dedupe, but the near-miss is a reminder to read the region before each structural move.
- `npm run check` failed once on the Arena research case (30 s RPC timeout) and once on a missing snippet in the stub payload; both were corrected inside the increment.

## Findings

Register rows resolved (all with a test that failed pre-fix): F-R3-1, -2, -3, -5, -15, -16, -17, -18, -20, -22, -23, -24, -26, -27, -28. `worklist.md:665-694` carries the resolution summaries.

| Disposition | Count |
|---|---|
| Resolved in-session | 15 |
| Scheduled on the roadmap | 0 |
| Closed informational | 0 (none newly filed) |

**Residual recorded, not fixed:** F-R3-24's user-visible half. Deep reading now runs under compact verbosity, but `compactEnvelope` still strips `passages`, `pages_read`, and `top_score` per REQ-079. The same shaping also strips `task_type`, `ignored_params`, and `ignored_operators` on *every* compact response — a pre-existing REQ-079 question, not an R3 defect. It needs its own REQ-079 remediation (does a required report survive compact?) rather than a patch here.

## Verification

- `npx tsc --noEmit` → exit 0.
- `npx vitest run` → 118 files, 1342/1342 pass.
- `npm run check` → **PASS** (22 gates, 157.9 s), including `validate-spec`, `check-intent-citations`, `validate-readme`, `check-gate-coverage`, `check-tdqs`.
- `npm run test-debate-club` → 8 files, 61/61 pass (111 s).
- Red evidence (production stashed, new tests kept): 22 failed / 207 passed across 9 files.
- Pre-existing warning unchanged: `check-loop-artifacts` reports `2026-11-10-r6-encryption-capacity-remediation: plan.md has no **Done bar:** line`.

## Backlog

82 unpushed commits before this increment, oldest 2.0 d; publication stays with the user (D13). The commit series below is local only.

## Commit series

Ten local commits, each `typecheck`-verified against its own staged snapshot
(`git stash --keep-index`), no push:

1. `fix(chain): keep an explicit provider ahead of the priority chain`
2. `fix(dedup): preserve contributing providers and rank without embeddings`
3. `fix(verbosity): retain the language report in compact responses`
4. `feat(output): bound tool responses at the shared finalizer`
5. `fix(config): validate the response truncation bound`
6. `fix(batch): report every failed input and analyse the merged set`
7. `fix(research): derive variants from suggestions and keywords`
8. `test(harness): express multi-result and page-serving stubs`
9. `fix(search): complete response metadata and KB ordering`
10. `docs(roadmap): resolve the R3 findings and retire the section`

## Next

`ROADMAP.md` § R3 findings remediation is retired; the next scheduled section is `## R4 fetch-page extraction remediation`, whose trigger ("start after chunk R5 closes") is met.

LOOP PAUSED
