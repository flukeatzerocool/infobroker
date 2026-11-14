# Tasks — Citation chain, dedupe merge, benchmark failure, and bounded preservation

Execution log. One entry per plan step. Evidence lines are copy-pasted command output
or a named test, not summaries.

## Plan-gate review record

- Standard depth (`ROADMAP.md:17-31`, four findings, one REQ amendment, six commits,
  all reversible).
- Cold pass: `plan.cold/report.md` — `independent-review passed.` 0 blockers, 8 majors,
  5 nits.
- Targeted diff re-review: `plan.cold/re-review.md` — 0 blockers, 8 majors resolved,
  5 nits resolved; U-7 ruled no new clause branch.
- Stamp: `verdict: passed`, `independence: fresh`, `depth: standard`,
  plan sha256 `2e0764ac69e4da8a1b8cd7ac0f63a1d581a672b5f30870885699c1575e7c512e`,
  re-review sha256 `1786377b410a9c6fe3c82d0b910ba5d31c1623d9652cb4440cffd8f43c6abecb`,
  conditions C-1 (stage isolation), C-2 (policy-timeout test seam), C-3 (series stops
  at commit 6).
- `build-review passed.` emitted before the first edit.
- Interim gate state (expected): `npm run check-loop-artifacts` reports
  `missing aar.md` until Step 6; the unrelated warning on
  `2026-11-10-r6-encryption-capacity-remediation` pre-exists this increment.

## Step 0 — Baseline (2026-11-14)

- `git status --porcelain` → `?? docs/plans/2026-11-14-corroboration-citation-benchmark-fidelity/`
  (the plan artifact only).
- `git log -1 --oneline` → `5be14d3 release: 2026.11.14`.
- `npm run check` → `gates: FAIL (full)` solely on `check-loop-artifacts`
  (`ERROR … missing aar.md`, the documented interim state) plus the pre-existing
  `2026-11-10-r6-encryption-capacity-remediation` warning; every other gate printed
  PASS. `npm audit` → 5 advisories (4 low, 1 moderate), gate passes.
- Probes: `grep -c "fallback_depth" src/cite.ts` → `1`; `grep -n
  "archiveBudgetMs\|ARCHIVE_TOTAL_BUDGET_MS" src/corroborate.ts src/corroborate.test.ts`
  → 5 lines (`:583`, `:876`, `:1019`, `:1042`, `test:1081`);
  `grep -c "^| F-R5-" …/worklist.md` → `53`.
- Register census before the change: `276 rows / 276 ids / Resolved 179 / Closed-P3 93 /
  Scheduled-roadmap 4` (F-R5-C-8, F-R5-E-1, F-R5-E-2, F-R5-F-1).

## Step 1 — REQ-026c amendment

- `infobroker.md:325` reworded; `:1129` scoped to `search_web` with a `get_citations`
  counter-sentence.
- `npm run validate-spec` → `All checks passed.` (143 REQs, 128 cited, 0 uncited files).
- Body count → `535 3 6` (characters excluding `_Check:_`, sentences, `SHALL`), as D5
  predicted; no new clause branch (detector matches `when … declares` only).

## Step 2 — Citation chain and dedupe

- `src/cite.ts`: slice removed at `:148`; `titleSlug` + year guard + DOI/title indexes;
  `mergeCitation` extracted.
- `npx vitest run src/cite.test.ts` → `19 passed`.

## Step 3 — Benchmark reconciler failure

- `src/retrieval-benchmark.ts`: `Reconciler` type, injectable `runBenchmark(cases, k,
  reconciler)`, `try`/`catch` removed.
- `npx vitest run src/retrieval-benchmark.test.ts` → `10 passed`
  (`propagates a reconciler error instead of scoring raw order`).
- `npm run benchmark-retrieval -- --json` → unchanged report shape.

## Step 4 — Bounded preservation

- `src/corroborate.ts`: `preserveCondensedSources` runs archive and snapshot waves
  concurrently under one abortable budget; `raceAbort` bounds network awaits; snippet
  stored before any network work; `preservationBudgetMs` replaces `archiveBudgetMs`.
- First attempt failed one new test (`bounds a stalled document fetch …`): the snippet
  store was reached only after a raced assessment, so the deadline left the source
  ungraded. Fixed by storing the snippet first and bounding only the document upgrade.
- `npx vitest run src/corroborate.test.ts` → `124 passed`.
- `npm run test` → `136 files passed`, `1638 tests passed`.

## Step 5 — Docs, register, roadmap

- `DECISIONS.md` → D-122 added (bounded/concurrent preservation, REQ-122 disposition,
  three rejected alternatives).
- `README.md §Knowledge Base` → bounded-archiving sentence; section trimmed to stay
  inside the 350-word design limit.
- `worklist.md` → four rows `Resolved`; census cells `:585` and `:588` rewritten.
- `npx tsx …/census.ts` → `Resolved: 183 / Closed-P3: 93 / scheduled-roadmap (0) /
  census self-check OK`.
- `ROADMAP.md` → § Corroboration section removed.
- `skills/infobroker/references/config-tune.md:62` → `fallback_depth` scoped to
  sequential chains.
- Gates: `check-roadmap` OK (2 sections), `check-non-goals` OK, `validate-readme`
  `0 error(s), 0 warning(s)`, `validate-spec` passed, `npm run status` → `open roadmap:
  1 item(s)`.

## Step 6 — Increment record and close

- `aar.md` written; `npm run check-loop-artifacts` green.
- Final `npm run check` → `gates: PASS (full)`.
- `npm run session:close` → recorded.
- CHANGELOG entry intentionally deferred to the release path (`npm run prep` seeds the
  entry with the new version), because a new dated heading would fail `version-sync`
  while `package.json` still reads `2026.11.14`. Recorded in the AAR.
