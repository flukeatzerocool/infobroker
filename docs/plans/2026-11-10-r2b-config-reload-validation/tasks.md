# Tasks — R2b-i provider auth-field validation

Plan: `plan.md` (revision 7, F-R2-3 only). Evidence recorded as each step landed.

## Phase 0 — Scaffold, baseline, discovery

- [x] 0.1 Increment directory carries `plan.md`, `tasks.md`, `aar.md`.
- [x] 0.2 Baseline: `git log -1` → `289c909`; `npm run status` → 23 items, 63 unpushed; `npm run check` → PASS (22 gates, 112.7 s).
- [x] 0.3 Fixture sweep: no shipped, fixture, or debate-club config declares a non-string/empty/null auth field. Evidence: `grep -n '"auth_env"' config.json` (all strings), `test-fixtures/` and `debate-club/` contain no `auth_env`/`auth_optional`/`url_env` overrides.
- [x] 0.4 Call sites confirmed: load `src/config.ts:976`, recovery `:985`, reload `:1003`, patch `:313`, migration `:198`; the patch call precedes `atomicWriteFile` at `:315`.
- [x] 0.5 REQ-037/REQ-040 read; D2 sentence is one sentence, 150 characters, 3 backticked tokens — inside Appendix B.
- [x] 0.6 Startup issue and warning derive from one string: `src/config.ts:989`, `:993-995`.
- [x] 0.7 Each case re-imports the module (`vi.resetModules()` + `import("./config.js")`), so `startupConfigIssue` is per-case.

## Phase 1 — Failing evidence (red recorded before the fix)

Pre-fix run: `npx vitest run src/config.test.ts src/config-patch.test.ts` → **19 failed, 86 passed**.

- [x] 1.1 Twelve rejection cases — all red pre-fix: `auth_env` number, empty, null, array, boolean; `url_env` array, empty, null, object; `auth_optional` string, null; disabled-provider case.
- [x] 1.2 `auth_optional: false` acceptance and absent-field acceptance — green pre-fix (regression evidence).
- [x] 1.3 REQ-113 recovery for `auth_env: 42` and `auth_env: null` — red (no startup issue raised).
- [x] 1.4 Reload rejection for `auth_env: 42` and `null` — red (no throw).
- [x] 1.5 `config-patch.test.ts` malformed-field patch — red (accepted and written).
- [x] 1.6 DB-7 sentinel cases (load and reload paths) — red (no issue, no throw).

## Phase 2 — Fix

- [x] 2.1 `src/config.ts` `validateConfig`: three rules in the per-provider loop; message names slug and field only.
- [x] 2.2 `infobroker.md`: REQ-037 amended with the D2 sentence verbatim.
- [x] 2.3 Three clause tags added to `src/config.test.ts`: `REQ-037 auth-env`, `url-env`, `auth-optional`.
- [x] 2.4 Re-run: `npx vitest run src/config.test.ts src/config-patch.test.ts` → **105 passed**.

## Phase 3 — Verification and documentation

- [x] 3.1 Diff audit before bookkeeping: production change is `validateConfig` only (`git diff --stat` → `src/config.ts | 15 +`).
- [x] 3.2 Targeted suites: 105 passed.
- [x] 3.3 `npm run typecheck` → 0; `npm run validate-spec` → all checks passed; `npm run check-gate-coverage` → 118 G1 REQs, 0 uncited.
- [x] 3.4 `CHANGELOG.md`: one entry under `## 2026.11.7`.
- [x] 3.5 `DECISIONS.md`: D-098 (declared auth field shape).
- [x] 3.6 `ROADMAP.md`: § R2b replaced by `## R2b-ii user-layer write ordering` and `## R2b-iii key-safety evidence`; `check-roadmap` OK (25 sections); `check-non-goals` OK.
- [x] 3.7 `worklist.md`: F-R2-3 `Resolved 2026-11-11`; F-R2-2 → § R2b-ii; F-R2-7 → § R2b-iii.
- [x] 3.8 `aar.md`: DB-clause table, dispositions, `LOOP PAUSED`.
- [x] 3.9 `npm run check` on the final tree.
