# Tasks — R6 `manage_kb` action-contract remediation

- [x] Baseline: HEAD `ad56707`, tree clean, `npm run check` PASS (full, 22 gates, 52.1 s).
- [x] Step 0.1 `npm run check-intent-citations` → 141 citations, 0 findings (no routing edit needed).
- [x] Step 0.2 Sibling REQs (060b/060e/060f/060i/072) read; no conflict with the identity rule.
- [x] Step 0.3 Schema probe → `manage_kb.max_results` serializes
      `{default: 8, minimum: 1, maximum: 50}` (probe at `/tmp/opencode/probe-schema.ts`).
- [x] Step 1.0 `startServer` gains `configLayer` (shallow merge over the default layer);
      `npx tsc -p debate-club/tsconfig.json` → exit 0.
- [x] Step 1.2 `src/tool-surface.test.ts` manage_kb max-results schema test.
- [x] Step 1.3 `src/kb.test.ts` `resolveTextIdentity` unit tests.
- [x] Step 1.4 `debate-club/src/kb-contract.test.ts` (7 tests: identity ×3, cap, 2 KB errors, refusals).
- [x] Step 1.5 Fail-first run (source unchanged, harness in place):
      - Arena new file → 3 failed | 4 passed. Failed: the three A-2 identity legs.
        A-1 (cap, unconfigured, unopenable) and A-3 passed → pinning tests.
        Log: `/tmp/opencode/failfirst-arena.log`.
      - `src/kb.test.ts` → 2 failed | 26 passed, `TypeError: resolveTextIdentity is not a function`.
        (ESM live binding: the import resolves, the call fails — not a module-load failure
        as the plan predicted; recorded, no plan impact.) Log: `/tmp/opencode/failfirst-kb.log`.
- [x] Step 2.1 `src/kb.ts`: `slugify(title, fallback = "report")`; exported
      `resolveTextIdentity(title, providedUrl?)` → `text://<slug>` with `note` fallback.
- [x] Step 2.2 `src/index.ts`: single ingest identity resolution (`url` → `source_url` →
      report/text synthesis); the `disk` override is unchanged.
- [x] Step 3.1 CHANGELOG entry.
- [x] Step 3.2 ROADMAP section retired (27 → 26 work items); F-R6-A-1/2/3 marked `Resolved`.
- [x] Step 3.3 Increment record written.
- [x] Post-fix: `npm run typecheck` → 0; `kb.test.ts` + `tool-surface.test.ts` → 31 passed;
      new Arena file → 7 passed; full Arena → 4 files / 44 tests passed.
- [x] Final: `check:fast` PASS (23.2 s), full `check` PASS (22 gates, 58.8 s),
      split commits.
