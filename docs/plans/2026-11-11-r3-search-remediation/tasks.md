# Tasks — R3 `search_web` findings remediation

**Plan:** `docs/plans/2026-11-11-r3-search-remediation/plan.md`
**Status:** complete (executed 2026-11-11)

## Review record

- Plan gate: stamped `planned`, depth `standard`, independence `fresh`, verdict `passed`, plan sha `3cea135a…`.
- Cold pass: 4 Major + 8 Nit, all resolved.
- Diff re-review: 1 Major + 4 Nit, all resolved.
- Confirmation pass: `independent-review passed.`, 5 clarity Nits applied as C-11.
- Record: `/tmp/opencode/r3-cold-confirm.md` (sha `6b84aec9…`, stages 5/5).

## Phase 0 — Baseline

- [x] Baseline at `c8408d5`: `npm run check` PASS (22 gates, 119.2 s); tree clean except the plan directory.
- [x] Seam audit: callers of `reconcileResults`, `mergeItems`, `mergeKnowledgeBaseResults`, `finalizeToolResult`, `deriveExpansions`, `analyzeResults` read; no existing test asserted any of the corrected behaviors.
- [x] Namespace: no new REQ or test IDs; `response_max_chars` is a new optional config key.

## Phase 1 — Failing evidence

Red run against the unmodified source (production files stashed, new tests
kept): **22 failed / 207 passed across 9 files**. Every new test failed; no
unrelated test regressed.

| Finding | Test | Red |
|---|---|---|
| F-R3-1 | `chain`/handler precedence | failed |
| F-R3-2 | `chain.test.ts` tie + antisymmetry | (passes only after fix; listed with F-R3-1 red run) |
| F-R3-3 | seeded-KB handler | failed |
| F-R3-5 | `batch.test.ts` all-fail | failed |
| F-R3-15 | handler collapse/slice | failed |
| F-R3-16 | `dedup.test.ts` providers | failed |
| F-R3-17 | `dedup-fallback.test.ts` | failed (2) |
| F-R3-18 | seeded-KB ordering | failed (with F-R3-3) |
| F-R3-20 | `chain`/`verbosity`/handler | failed (3) |
| F-R3-22 | `research.test.ts` variants | failed (2) |
| F-R3-23 | `structured-output` + handler | failed (3) |
| F-R3-24 | handler deep/compact | failed |
| F-R3-26 | `batch.test.ts` passages | failed |
| F-R3-27 | `batch.test.ts` merged analysis | failed |
| F-R3-28 | handler all-blocklisted | failed |

## Phase 2 — Fixes

- [x] Slice A — `chain.ts` comparator and `languageUnsupportedProviders`; `index.ts` explicit-provider re-insertion, task-type/parse before KB recall, KB-first metadata; `verbosity.ts` required-meta retention.
- [x] Slice B — `types.ts` `providers`; `dedup.ts` provenance union, `orderByRelevance`, lexical fallback; `index.ts` headroom-before-collapse, blend ordering, all three KB paths, `kbMeta` after the slice.
- [x] Slice C — `batch.ts` `meta.per_query` on all-fail, result-level passage counting, analysis drop; `index.ts` merged analysis and omission predicate.
- [x] Slice D — `index.ts` `collectSuggestions`, deep gate; `research.ts` variant relaxation; `structured-output.ts` truncator; `response_max_chars` in `types.ts`, `config.ts`, `config.json`.
- [x] Test-support delta (`delta.md`): stub provider result/page options; Arena RPC timeout 30 s → 60 s for multi-variant research.

## Phase 3 — Verification

| Step | Command | Result |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | exit 0 |
| Targeted suites | `npx vitest run` (118 files) | 1342/1342 pass |
| Full gate suite | `npm run check` | PASS, 22 gates, 157.9 s |
| Spec traceability | inside `npm run check` (`validate-spec`) | pass |
| Routing citations | inside `npm run check` (`check-intent-citations`) | pass |
| README | `validate-readme` | pass (no edit expected) |
| Arena | `npm run test-debate-club` | 61/61 pass |
| Docs | `check-roadmap`, `check-loop-artifacts` | pass (one pre-existing warning, C-8) |

- [x] CHANGELOG entry.
- [x] `ROADMAP.md` R3 section retired.
- [x] `worklist.md` 15 rows resolved.
- [x] `aar.md` finished.

## Phase 4 — Commit series

See `aar.md` § Commit series.
