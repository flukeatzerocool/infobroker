# Tasks — R6 ledger and receipt remediation

Plan: `plan.md` (stamped plan_sha256 `822ca895…`, independence fresh).

## Phase 0 — preflight

- [x] `git status --porcelain` shows only the increment plan file; HEAD `571c7d3`
- [x] `check-tdqs` → 0 violations; `check-intent-citations` → 141 citations, 0 findings
- [x] `validate-spec` → 142 REQs, 127 cited, 0 errors
- [x] Existing coverage grep → `sources: []` appears in `src/corroborate.test.ts` and `src/kb-claims.test.ts`; no assertion covers an unsourced finding reaching the ledger
- [x] Baselines: `npm run test` → 108 files / 1149 tests; `test-debate-club` → 7 files / 58 tests

## Phase 1 — behavior

- [x] `src/index.ts`: persist every finding, keep the URL filter on edges (mutation-verified)
- [x] `src/kb-sqlite.ts`: `retrieved_at` inside `encodeEdge`/`decodeEdge`; empty clear slot; read fallback; `resealAll` carries + blanks; section comment corrected
- [x] `src/kb-receipt.ts`: `buildReceiptManifest` takes `ingestAt` and stamps unlabelled sources
- [x] `src/kb.ts`: pass the ingest instant
- [x] `npm run typecheck` → exit 0

## Phase 2 — tests

- [x] `src/kb-claims.test.ts`: at-rest + round-trip + transition (encrypted) — passes
- [x] `src/kb-claims.test.ts`: legacy clear value read + scrubbed on transition — passes
- [x] `src/kb-report-receipt.test.ts`: snippet-basis source stamped — passes
- [x] `debate-club/src/kb-ledger.test.ts`: unsourced batch finding reaches `action: claims` — passes
- [x] `npm run test` → 108 files / 1152 tests; `test-debate-club` → 8 files / 59 tests

## Phase 3 — mutation evidence

- [x] Restore the URL-bearing filter → Arena test fails (`the ledger must persist the unsourced finding`); reverted
- [x] Write the timestamp back to the clear column → at-rest test fails (`[ '2026-10-01T10:00:00.000Z' ]` ≠ `[ '' ]`); reverted
- [x] Revert `resealAll` to `row.retrieved_at` → legacy-transition test fails (`[ '2026-09-30T08:00:00.000Z' ]` ≠ `[ '' ]`); reverted
- [x] Restore the `cached !== null` stamp condition → receipt test fails (`undefined` not `string`); reverted

## Phase 4 — bookkeeping

- [x] `worklist.md`: F-R6-F-1, F-R6-F-2, F-R6-F-4 → `Resolved`; REQ-109/110 evidence rows refreshed
- [x] `ROADMAP.md`: § R6 ledger and receipt remediation retired (22 → 21 items)
- [x] `DECISIONS.md`: D-096 records the legacy-store residual and its remediation
- [x] `CHANGELOG.md`: entry for the three behavior changes
- [x] `tasks.md` and `aar.md` written

## Phase 5 — verification and commits

- [x] `npm run check:fast` on the final tree → PASS (19 gates)
- [x] `npm run test-debate-club` on the final tree → PASS (8 files, 59 tests)
- [x] `npm run check` on the final tree → PASS (full, 22 gates, 72.5 s)
- [x] Four split commits, `npm run typecheck` after each
- [x] Report the commit list; stop before `npm run release`
