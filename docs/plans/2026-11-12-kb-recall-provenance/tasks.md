# Tasks — KB recalled-source provenance

Plan: `plan.md` · Order is execution order. Tick a step only when verified.

- [x] **T1 — red test.** Added `@implements REQ-026d recalled-source-provider`
      tests in `src/corroborate.test.ts` (mocked `kbSearch` hit with
      `provider: "wikipedia"`; assertion on the finding source and on
      `result.provenance.sources`). Red: `npx vitest run
      src/corroborate.test.ts` → 1 failed / 95 passed; failure was
      `expected undefined to be 'wikipedia'` at the finding-source assertion.
- [x] **T2 — fix.** Added the ingest provider to the recalled mapping in
      `src/corroborate.ts` (`:672-680`).
      Implementation note: the expression is `provider: r.provider ||
      undefined`, not the plan's literal `r.provider`, so an empty provider is
      omitted rather than reported as a placeholder (plan D3). Same surface,
      no scope change.
- [x] **T3 — green test.** `npx vitest run src/corroborate.test.ts` → 96
      passed (96) (94 baseline + 2 new).
- [x] **T4 — empty-provider case.** Pinned: a KB hit with `provider: ""`
      leaves the provenance entry's `provider` absent. Note: this case was
      green before the fix too (the field was absent either way); it is a
      regression pin, not red evidence.
- [x] **T5 — typecheck.** `npm run typecheck` → clean. First attempt failed
      with `TS18048: 'result.provenance.sources' is possibly 'undefined'` at
      two call sites; fixed with optional chaining, re-ran clean.
- [x] **T6 — changelog.** One entry added to the `2026.11.11` section naming
      REQ-026d and the recalled-source provider.
- [x] **T7 — roadmap.** `## KB recalled-source provenance` removed;
      `npm run check-roadmap` → OK (16 sections).
- [x] **T8 — spec gate.** `npm run validate-spec` → All checks passed;
      `npm run check-roadmap` → OK.
- [x] **T9 — full gate suite.** `npm run check` → all gates green through
      `check-gate-table`; stops at `check-loop-artifacts` with the expected
      `missing aar.md` (C-1). Final-tree run recorded in `aar.md` after the
      AAR was written.
- [x] **T10 — AAR.** `aar.md` written, ending `LOOP PAUSED`;
      `npm run check-loop-artifacts` re-run on the final tree.
