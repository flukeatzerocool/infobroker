# Tasks — R6 `manage_kb` action-evidence remediation

- [x] Baseline: HEAD `a9c756c`, tree clean except the plan artifact,
      `npm run check` PASS (full, 22 gates, 54.3 s); `status` 26 roadmap items.
- [x] Step 0.1 `npm run validate-spec` → all checks passed (142 REQs, 0 uncited
      source files); `npm run check-intent-citations` → 141 citations, 0 findings.
      No spec or routing edit needed.
- [x] Step 0.2 Sibling REQs 060/060a–060i re-read; the asserted contracts match
      (060c stats fields, 060d filter, 060e order/chunk_count, 060f order/error,
      060h lock error, 060i stale/unverifiable).
- [x] Step 0.3 Mutation anchors confirmed: `src/kb.ts:748` sort, `:774` delete
      guard, `:1001` stale, `src/index.ts:2065-2070` lock guard, `:2357-2359`
      delete-filter guard, `src/kb-receipt.ts:371-373` absent-source branch.
- [x] Step 1 `src/kb-action-evidence.test.ts` (6 tests: stats, list order,
      list chunk_count, get order, get unknown, delete guard).
- [x] Step 1 `debate-club/src/kb-action-tools.test.ts` (4 tests: delete filter,
      get no-document, verify_report absent source, locked store + encryption).
- [x] Step 1 `src/kb-report-receipt.test.ts` +2 tests (stale=true, absent
      document-basis source); `kbDelete` imported.
- [x] Step 2 (unmodified tree, no mutation):
      - `npx vitest run src/kb-action-evidence.test.ts src/kb-report-receipt.test.ts`
        → 2 files / 37 tests passed.
      - `npm run test-debate-club` → 5 files / 48 tests passed.
      - `npm run typecheck` → exit 0; `npx tsc -p debate-club/tsconfig.json` → exit 0.
      No defect found; all legs are pinning tests (D1).
- [x] Step 3 mutation proof (each mutation reverted; `git diff --quiet` after each):
      | Finding | Mutation | Observed failure |
      |---|---|---|
      | F-R6-A-4 order | `kb.ts:748` sort ascending | `expected [ …(2) ] to deeply equal [ …(2) ]` |
      | F-R6-A-4 filter | delete `index.ts:2357-2359` guard | `expected error code invalid_input, got internal_error` |
      | F-R6-A-5 lock | delete `index.ts:2065-2070` guard | `expected 'Check the store lock and encryption s…' to match /key/i` |
      | F-R6-A-6 stale | `kb.ts:1001` force `stale = undefined` | `expected undefined to be true` |
      | F-R6-A-6 absent (unit) | `kb-receipt.ts:371-373` count drift | `expected +0 to be 1` |
      | F-R6-A-6 absent (Arena) | same | `expected 'drift' to be 'unverifiable'` |
- [x] Step 4.1 ROADMAP section retired (26 → 25 work items).
- [x] Step 4.2 F-R6-A-4/5/6 marked `Resolved` (disposition cell only, matching
      the F-R6-A-1/2/3 precedent).
- [x] Step 4.3 Increment record written (plan, tasks, AAR).
- [x] Final: `check:fast` and full `npm run check` exit 0 (see AAR gate table).
