# Tasks — R2a credential-pool and dispatch-state remediation

Plan: `plan.md`. One line per plan step, with the evidence recorded inline.

## Step 0 — Scaffold

- [x] 0.1 This directory carries `plan.md`, `tasks.md`, and an `aar.md` whose final line is the LOOP token.

## Phase 0 — Baseline and audit

- [x] 0.2 `git log -1` → `1ff0f59`; tree clean except this directory; `npm run status` → 20 roadmap items, 60 unpushed (oldest 25.5 h).
- [x] 0.3 `npm run check` → PASS (full, 22 gates, 76.2 s, run record `1ff0f59274d8`); `npx vitest run src/corroborate.test.ts` → 75/75 PASS.
- [x] 0.4 Pre-existing warning recorded: `check-loop-artifacts` — `2026-11-10-r6-encryption-capacity-remediation: plan.md has no **Done bar:** line` (C-6).
- [x] 0.5 Seam audit: `providerOperational` ×3 (config inline, `index.ts:1417`, `corroborate.ts:422`) consumed by `cite.ts:65`; `getDispatchChain` callers in `index.ts`, `chain.ts`, tests; `poolKeys`/`resolveApiKey` consumers `exa`/`tavily`/`yep`/`index.ts`; `throttle` outside `retryWithBackoff` at `index.ts:499,835`, `corroborate.ts:679,729`, `cite.ts:166`; `withTimeout` at `index.ts:514,852`, `corroborate.ts:63`, `cite.ts:81`. No unit seam reaches the `search_web` handler branch.
- [x] 0.6 No existing test asserted the disabled-explicit-provider branch (`grep "disabled or not configured"` → only `src/index.ts:428`). Landing site: a new Arena case.

## Phase 1 — Failing evidence (red recorded before each fix)

- [x] 1.1 `retry.test.ts` — 2 failed (`TimeoutError` not exported), then green.
- [x] 1.2 `key-pool.test.ts` — 5 failed (missing `hasUsableKey`, `poolKeysForEnv`, `resolveApiKeyForEnv`), then green.
- [x] 1.3 `config.test.ts` — 3 failed (keyless CORE dispatched; rejected pool dispatched; optional-key provider excluded), then green.
- [x] 1.4 `core.test.ts` (new) + `generic-http.test.ts` — 5 failed (pool ignored), then green.
- [x] 1.5 `corroborate.test.ts` — explicit disabled provider searched; all-unusable list returned empty success; retries not throttled.
- [x] 1.6 `cite.test.ts` — retried attempt not throttled; no eligibility assertion.
- [x] 1.7 Arena — two cases added (disabled provider, unauthenticated provider).

## Phase 2 — Fixes

- [x] 2.1 `src/key-pool.ts`: `poolEnvName`, `poolKeysForEnv`, `resolveApiKeyForEnv`, `hasUsableKeyForEnv`/`hasUsableKey` (non-mutating); `poolKeys`/`resolveApiKey` delegate.
- [x] 2.2 `src/providers/core.ts`: pool per request, module cache deleted, `noteAuthStatus` on failure.
- [x] 2.3 `src/providers/generic-http.ts`: `credentialFor` resolves the declared variable's pool; the selected key is threaded to the call site so the response status is recorded against it.
- [x] 2.4 `src/config.ts`: `providerUsable` (enabled, URL, credential pool, optional-key); `getDispatchChain` filters with it; tier-scoped checks removed.
- [x] 2.5 `src/index.ts`: local predicate deleted in favour of `providerUsable`; `providerInactiveReason(slug, p)`; explicit-provider gate per D5; throttle + latency start inside the retried closure (search and fetch).
- [x] 2.6 `src/corroborate.ts`: predicate delegates; explicit list filtered, `UnusableProviderError` when empty; throttle inside the retried closure (both passes). `src/cite.ts`: same throttle move.
- [x] 2.7 `src/lib/timeout.ts`: `TimeoutError`; `src/retry.ts`: retryable leg.
- [x] 2.8 Handler mapping: `UnusableProviderError` → `invalid_input` in the `verify_claims` handler.

## Phase 3 — Verification and documentation

- [x] 3.1 Module-graph probe before the edit and after: `npx tsx -e "import('./src/config.ts')"` → OK; `import('./src/key-pool.ts')` → OK (D1 cycle safe).
- [x] 3.2 Targeted suites: retry/timeout 11, key-pool 15, config 79, core+generic 24, corroborate 78, cite 13.
- [x] 3.3 `npx vitest run` → 110 files / 1186 tests PASS.
- [x] 3.4 `npm run typecheck` → 0.
- [x] 3.5 `npm run test-debate-club` → 8 files / 61 tests PASS (includes the two new cases).
- [x] 3.6 `npm run validate-spec` → PASS (127 cited, 0 undocumented source files); `check-gate-coverage` → 117/118 cited.
- [x] 3.7 `CHANGELOG.md` entry added; `DECISIONS.md` D-097 added.
- [x] 3.8 `ROADMAP.md`: R2 replaced by R2b–R2e; `check-roadmap` → 24 sections; `check-non-goals` → OK.
- [x] 3.9 `worklist.md`: five rows `Resolved`, F-R2-9 partial note, `:230` retargeted to § R2d, no remaining `§ R2 findings remediation` pointer.
- [x] 3.10 `npm run check` on the final tree → PASS (see `aar.md`).
- [x] 3.11 `aar.md` finished with dispositions and the LOOP token.

## Phase 4 — Commits

- [x] 4.1 Build marker recorded before the first commit (`mark-build` with the three verification evidence lines).
- [x] 4.2 Commit (a): pool + predicate source and tests (`key-pool`, `config`, `core`, `generic-http`).
- [x] 4.3 Commit (b): dispatch precedence, retry classification, throttled retries, Arena cases.
- [x] 4.4 Commit (c): CHANGELOG, DECISIONS, ROADMAP, worklist, plan directory.
