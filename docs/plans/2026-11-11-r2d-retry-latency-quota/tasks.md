# Tasks — R2d retry, latency, quota and chain shape

**Plan:** `plan.md` · **Status:** executed · **Date:** 2026-11-11

Red-first evidence: each row's test was written and run **before** its fix.
The red run recorded the observed failure; the green run recorded the pass.

## Phase 0 — Scaffold and baseline

- [x] 0. `plan.md`, `tasks.md`, in-progress `aar.md` (final line `LOOP OPEN`).
- [x] 1. Baseline re-confirmed on the execution HEAD: `npm run check` PASS,
      22 gates, 119.1 s, HEAD `625e5ba`.
- [x] 2. Seam audit: `createLatencyTracker` has one production caller
      (`src/index.ts:81`) and no non-test consumers of the old numeric form;
      `isExpired` is internal to `src/quota.ts`; `failureTaxonomy` has two
      production call sites (`src/index.ts:1156,1324`); `getDispatchChain`
      callers are `index.ts`, `chain.ts`, and tests; `startStubProvider` has
      12 call sites and `writeHermeticConfig` 13, all string-mode.
- [x] 3. Confirmed no existing test covers the hedge switch, cross-task order,
      all-empty vs all-error, cooldown skip, quota reset, or signal flush.

Baseline at plan time: HEAD `625e5ba`; `npm run check` PASS, 22 gates,
119.1 s; `npm run status` 73 unpushed, oldest 45.3 h; 22 open roadmap items.

## Phase 1 — Failing evidence first

| # | Finding | Test file | Assertion | Red result | Green |
|---|---|---|---|---|---|
| 4a | F-R2-33 | `src/quota.test.ts` | reset 1 s past `resetAt`; preserve 1 s before; daily and monthly | 2 failed (`expected 42 to be +0`) | pass |
| 4b | F-R2-26 | `src/quota.test.ts` | 79/100 no warning; 80/100 warning; 100/100 exhausted | pass on unmodified tree (evidence-only) | pass |
| 4c | F-R2-27 | `src/latency.test.ts` | `time`/`count`/`both` eviction with an injected clock; idle `avg()` after age-out returns 0 | 4 failed (`expected 100 to be +0`, strategy not applied) | pass |
| 4d | F-R2-27 | `src/config.test.ts` | invalid strategy and non-positive `latency_window_ms` rejected | 2 failed (`expected [Function] to throw`) | pass |
| 4e | F-R2-15 | `src/config.test.ts` | `enabled: false` absent from `getDispatchChain` | pass on unmodified tree (evidence-only) | pass |
| 4f | F-R2-34 | `src/fetch-fallback.test.ts` | `retry_after_ms` present with an active cooldown, omitted at duration 0 | 2 failed (field absent) | pass |
| 4g | F-R2-30 | `src/dispatch-orchestration.test.ts` | fully spent chain → `[ERROR]` + `quota_exhausted`; exhausted+empty → error; all-empty → `no_results: true` | 2 failed (`all_providers_exhausted` vs empty success) | pass |
| 4h | F-R2-26 | `src/dispatch-orchestration.test.ts` | provider at 100% gets zero outbound calls; healthy chain-mate serves | failed (empty success) | pass |
| 4i | F-R2-15 | `src/dispatch-orchestration.test.ts` | disabled provider never called | failed (`stub_a` served; force-enabled) | pass |
| 4j | F-R2-35 | `src/dispatch-orchestration.test.ts` | hedge on/off selects secondary/primary | failed (stub modes absent) | pass |
| 4k | F-R2-35 | `src/dispatch-orchestration.test.ts` | cross-task fallback order | failed (stub modes absent) | pass |
| 4l | F-R2-35 | `src/dispatch-orchestration.test.ts` | all-error returns `all_providers_exhausted` | failed (stub modes absent) | pass |
| 4m | F-R2-35 | `src/dispatch-orchestration.test.ts` | cooled provider skipped, zero new requests | failed (`all_providers_exhausted` vs `rate_limited`) | pass |
| 4n | F-R2-32 | `src/quota.test.ts` (spawned) | SIGTERM and SIGINT persist the increment | 2 failed (`ENOENT quota.json`) | pass |
| 5 | D6 | `src/lib/stub-provider.ts` | per-provider `url`/`enabled`/`rateLimit`, stub modes + `delayMs`, `chains`, `output`; existing suites unchanged | modes returned 404/force-enabled | pass; `key-safety-action` + `provider-health-action` still 8/8 |

Red totals: `latency/quota/fetch-fallback` 10 failed / 25 passed;
`config` 2 failed / 100 passed; `dispatch-orchestration` 8 failed / 2 passed.
Green totals after the fixes: 137 + 10 + 62 + 8 tests pass.

## Phase 2 — Fixes

- [x] 6. `src/quota.ts` — exact reset; one-shot signal flush with re-raise.
- [x] 7. `src/latency.ts`, `src/types.ts`, `src/config.ts`, `config.json` —
      strategy + `latency_window_ms` + validation; tracker at `src/index.ts:81`.
- [x] 8. `src/index.ts` — quota-exhaustion `lastError`; cross-task still runs;
      `quota_exhausted` rendered by `chainExhaustion`.
- [x] 9. `src/fetch-fallback.ts` — `remainingMs` option and `rate_limited`
      detail; both `src/index.ts` call sites merge it into `details`.
- [x] 10. No further orchestration defect surfaced; the two count assertions
      were adjusted for the startup health probe (delta, not absolute), not
      weakened.

## Phase 3 — Verification and documentation

- [x] 11. Targeted suites: `quota`, `latency`, `config`, `fetch-fallback`,
      `dispatch-orchestration`, `chain`, `provider-list`, `provider-health`,
      `error-envelope` — 8 files, 72 tests pass; stub consumers 8/8.
- [x] 12. `npm run typecheck` → exit 0; `npm run check:fast` → PASS (21 gates,
      21.8 s); `npm run check` → see AAR.
- [x] 13. `npm run validate-spec` → all checks passed; no REQ body change.
- [x] 14. `CHANGELOG.md` entry added.
- [x] 15. `ROADMAP.md` R2d section retired; `npm run check-roadmap` OK (22).
- [x] 16. `worklist.md` eight rows `Resolved`; the §1 goal 3 latency pointer
      retargeted; F-R2-26 stale `quota_warning` clause corrected.
- [x] 17. `aar.md` finalised with the terminal token.

## Phase 4 — Commit series

- [x] 18a. quota durability + reset (`quota.ts`, `quota.test.ts`) — `ea6126e`.
- [x] 18b. latency strategy + config (`latency.ts`, `types.ts`, `config.ts`,
      `config.json`, tests) — `645fecc`.
- [x] 18c. chain shape + fetch taxonomy (`index.ts`, `fetch-fallback.ts`, tests)
      — `ec95eef`.
- [x] 18d. orchestration suite + stub extension — `8e3e957`.
- [x] 18e. docs + bookkeeping — `34966c6`.
