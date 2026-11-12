# Tasks — R4 `fetch_page` extraction and date remediation

**Plan:** `docs/plans/2026-11-11-r4-fetch-extraction-remediation/plan.md`
**Status:** complete (executed 2026-11-11)

## Review record

- Plan gate: stamped `planned`, depth `standard`, independence `fresh`, verdict `passed`.
- Cold pass: 1 Blocker + 6 Major + 5 Nit, all resolved.
- Targeted diff re-review: `independent-review passed.`, 3/5 stages, 3 clarity nits applied as C-15.
- Record: `/tmp/opencode/r4-plan-cold-review.md` (sha `828af00f…`, stages 5/5).

## Phase 0 — Baseline

- [x] Baseline at `eab0f23`: `npm run status` (92 unpushed, oldest 2.1 d, 19 open roadmap items); `npm run check` PASS (22 gates, 153.4 s); tree clean except the increment directory.
- [x] Baseline warning recorded: `check-loop-artifacts` reports the R6 encryption-capacity plan missing a **Done bar:** line (C-8).
- [x] Seam audit: `detectUpdatedAt` had one non-test caller (`src/index.ts`), `matchQuality`, `maybeTruncate`, and `mergeItems` read; no existing test asserted the corrected behaviours.
- [x] Authoring pre-check: REQ-021b already carried named clause tags (`content-mode`, `full-content-mode`, `match-*`); REQ-021c carried `date-determinable`/`date-absent`; no REQ body change required (C-4).

## Phase 1 — Failing evidence

Red run against the unmodified source (production edits made after the run):
**17 failed / 42 passed across 4 files**.

| Finding | Test | Red |
|---|---|---|
| F-R4-D-1 | `fetch-page-extraction.test.ts` no-match case | failed (undefined mode/meta) |
| F-R4-D-1 (batch) | `batch.test.ts` zero-passage item | failed |
| F-R4-D-3 | `fetch-page-extraction.test.ts` plain + raw cases | failed (2) |
| F-R4-C-2 | `datetime.test.ts` published/mixed/time-tag cases | failed (import + 5 assertions) |
| F-R4-C-2 (KB) | `fetch-page-extraction.test.ts` source-date case | failed (`source_updated_at: "2024-03-05"`) |
| F-R4-C-9 | `fetch-page-extraction.test.ts` crawl + extract cases | failed (2) |
| F-R4-D-2 | `rerank.test.ts` empty-content case | passes on unmodified source (test-quality fix, not a behaviour change; recorded) |

## Phase 2 — Fixes

- [x] Slice A — `src/datetime.ts` split into modified/published candidate lists, `detectDocumentDate`, `kind`; `src/index.ts` maps by kind and gates the KB source date (D2).
- [x] Slice B — `fullContentEnvelope` shared by both no-match returns; plain envelope carries `url`, `extraction_mode`, zero passage count; `mergeItems` believes reported counts (D1, D1a, D4).
- [x] Slice C — crawl and extract pass an uncapped render bound and truncate the derived text once (D3).

## Phase 3 — Verification and documentation

- [x] Targeted suites: 9 files, **101 passed** (`datetime`, `batch`, `rerank`, `fetch-page-extraction`, `structured-output`, `fetch-cache`, `fetch-fallback`, `truncate`, `tool-surface`).
- [x] `npm run typecheck` → exit 0.
- [x] `npm run check:fast` → PASS (19 gates, 23.5 s).
- [x] `npm run check` → **PASS** (22 gates, 156.1 s, exit 0; run record skipped because the tree was dirty, as expected before the commit series).
- [x] `npm run validate-spec`, `npm run check-intent-citations` → PASS (inside both gate runs).
- [x] CHANGELOG, ROADMAP, worklist updated; AAR written.
- [x] Commit series (D6), four commits.
