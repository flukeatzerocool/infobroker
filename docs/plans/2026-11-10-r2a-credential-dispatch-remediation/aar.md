# AAR — R2a credential-pool and dispatch-state remediation

**Status:** complete · **Date:** 2026-11-10 · **Plan:** `plan.md` (stamped fresh, standard depth)
**Predecessor:** `1ff0f59` · **Roadmap item:** `§ R2 findings remediation`, split into R2b–R2e; the R2a set ships here

## What happened

1. Ran the plan's baseline: full `npm run check` PASS (22 gates, 76.2 s), `corroborate.test.ts` 75/75, tree clean except the increment directory.
2. Wrote one failing test per finding and recorded the red result before each fix (five modules, plus two Arena cases).
3. Fixed the five findings: pool-aware credentials for CORE and `generic_http`; one `providerUsable` predicate shared by dispatch, corroboration, citations, and inspection; explicit-provider selection gated on it; `TimeoutError` classified as transient; throttling moved inside every retried closure (five sites).
4. Rewrote `§ R2 findings remediation` as R2b–R2e, marked the five rows `Resolved`, noted F-R2-9's partial resolution, and retargeted the stale worklist pointer.
5. Verified: `npx vitest run` 110 files / 1186 tests PASS; `npm run test-debate-club` 8 files / 61 tests PASS; `npm run validate-spec` PASS; `npm run check` full PASS (115.5 s).

## Register

| ID | Disposition | Evidence |
|---|---|---|
| F-R2-8 | Fixed | `core.test.ts` (4), `generic-http.test.ts` (2), `config.test.ts` (4); pool rotates after a 401 and an exhausted pool leaves the chain |
| F-R2-14 | Fixed | `corroborate.test.ts` — a disabled named provider is never searched; an all-unusable list raises `invalid_input` |
| F-R2-28 | Fixed | `corroborate.test.ts` and `cite.test.ts` count two throttle calls for two attempts; `index.ts` sites share the pattern |
| F-R2-29 | Fixed | Arena `search-disabled-provider` (`invalid_input`) and `search-unauthenticated-provider` (chain serves, no request to the gated host) |
| F-R2-31 | Fixed | `retry.test.ts` (timeout retried `retry_count` times; final error keeps the message) |
| F-R2-9 | Partial (status half fixed; row stays `Scheduled`) | `providerUsable` now drives `assessProviderStatus`, so an exhausted pool is not `active`; the per-field `auth_ok`/`inactive_reason` reporting is R2c's |

## Verification

| Command | Result |
|---|---|
| `npx vitest run` | 110 files / 1186 tests PASS |
| `npm run typecheck` | 0 |
| `npm run test-debate-club` | 8 files / 61 tests PASS (two new cases) |
| `npm run validate-spec` | PASS — 127 cited, 0 undocumented source files |
| `npm run check-gate-coverage` | 118 G1: 117 cited, 1 exempt |
| `npm run check-roadmap` / `check-non-goals` | 24 sections OK / non-goals OK |
| `npm run check` (full) | PASS, 115.5 s |
| `npx tsx -e "import('./src/config.ts')"`, `import('./src/key-pool.ts')` | both OK (D1 cycle safe) |

## Deviations and decisions taken in execution

- **D5 landed as planned for `search_web` but not for the verify_claims handler shape.** The handler mapped the new `UnusableProviderError` into `invalid_input`; the `search_web` branch needed no new error type.
- **`providerInactiveReason` gained a slug parameter.** With one predicate, the reason cannot be derived from the provider object alone; a provider whose pool is exhausted reports `no_api_key`.
- **One pre-existing test changed.** `counts a failed dispatch against the batch HTTP-call budget` named five providers absent from its mock config; under REQ-015/REQ-104 those are no longer selectable, so the test now declares them — the behavior it measures (budget consumption) is unchanged.
- **`cite.test.ts` asserts the eligibility contract at its seam.** The file mocks `corroborate.js`, so the pool-exhausted→`no_auth` mapping is proven in `config.test.ts`/`key-pool.test.ts`, and `cite.test.ts` proves the citation chain skips whatever the predicate rejects and never calls it.
- **`hasUsableKeyForEnv` calls `loadState()` for initialization only** — it never advances the cursor or writes the state file, which `key-pool.test.ts` pins.

## Cross-chunk notes

- **C-6:** the `check-loop-artifacts` warning for `2026-11-10-r6-encryption-capacity-remediation` (no `**Done bar:**` line) is unchanged and out of this increment's scope.
- **C-7:** the unpushed backlog was 25.5 h at plan time and is larger now; nothing was published. Publishing is a separate, user-authorized step (`npm run prep` then `npm run release`).
- **F-R2-15** (disabled-provider exclusion has no dispatch test) remains scheduled in R2d even though R2a added keyless/auth coverage in `config.test.ts`; R2d owns the dispatch-orchestration assertion.

## Next

`ROADMAP.md` § R2b configuration reload and validation is the first successor section; its trigger ("start after R2a ships") is met by this increment. Chunks R3–R9 and M1 remain closed.

LOOP PAUSED
