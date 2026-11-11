# Plan — R2a credential-pool and dispatch-state remediation

**Status:** draft · **Date:** 2026-11-10 · **Depth:** standard
**Review independence:** fresh — cold pass 1 FAILED (2 Blockers, 5 Majors, 4 Minors, 2 Nits), all resolved; one targeted diff re-review PASSED with 2 non-blocking minors, both fixed in this revision. Cold report `/tmp/opencode/r2a-cold.md` (`ea61e187…`), diff re-review `/tmp/opencode/r2a-rereview.md` (`f6afba8e…`), stages 1–5, reads 38/40.
**Rollback cost:** 1 — five behavior edits across `src/config.ts`, `src/index.ts`, `src/corroborate.ts`, `src/retry.ts`/`src/lib/timeout.ts`, `src/key-pool.ts`, and two provider modules, plus tests and bookkeeping. No schema column, dependency, config key, credential format, or release-surface change.
**Roadmap item:** `ROADMAP.md` § R2 findings remediation (the section is split by this plan; the R2a set ships here and is retired to `CHANGELOG.md`)
**Predecessor:** `1ff0f59` (R6 dedup false-positive bound; `LOOP PAUSED`, whose AAR names `§ R2 findings remediation` as the next item)

## Why this section, and why a split

`§ R2 findings remediation` is the first section in `ROADMAP.md` and the
ordering rule is top section first. Its trigger ("start after chunk R3
closes") is met — R3 closed 2026-11-09 — and the predecessor AAR names it as
next. The section is not one concern: it carries **19 P1** and **8 P2**
register rows across config loading, dispatch, credential pools, retry,
throttling, quota, privacy derivation, `inspect_providers` reporting, one
provider source, and three spec prose units. One plan cannot execute that
within a reviewable diff, and its knock-on rollback cost would exceed 1.

The section is therefore split by concern, following the R5/R6 precedent
(`docs/plans/2026-11-09-full-review-r5/plan.md` D42; the R6 sections in
`ROADMAP.md` history). This plan executes the first increment and rewrites
the remainder as four ordered successor sections:

| Increment | Findings | Concern |
|---|---|---|
| **R2a (this plan)** | F-R2-8, F-R2-14, F-R2-28, F-R2-29, F-R2-31 | Credential-pool coverage and dispatch-state filtering |
| R2b | F-R2-2, F-R2-3, F-R2-7 | Config reload and validation |
| R2c | F-R2-9, F-R2-12, F-R2-19, F-R2-20, F-R2-21, F-R2-22, F-R2-23, F-R2-24 | Provider status and `inspect_providers` |
| R2d | F-R2-15, F-R2-26, F-R2-27, F-R2-30, F-R2-32, F-R2-33, F-R2-34, F-R2-35 | Retry classification, latency window, quota, chain shape |
| R2e | F-R2-36, F-R2-38, F-R2-41 (+ F-R2-42) | Financial source, §5.3 sketch, §A.5 SearXNG prose |

Counts reconcile against the register: 5 + 3 + 8 + 8 + 4 rows = 28, of which
19 are P1 (R2a 5, R2b 2, R2c 5, R2d 4, R2e 3) and 8 are P2 (R2b 1, R2c 3,
R2d 4, R2a/R2e 0), with F-R2-42 carried as an already-`Closed-P3` prose line
the roadmap bullet still names.

**Why these five first.** All five sit on the path a caller's provider choice
takes — pool lookup, chain construction, explicit-provider precedence,
per-attempt throttling, and retry classification. A defect here decides which
credential is spent and which provider is called, so it is the highest-value
slice and the one the later increments can rely on (`R2c` reports the pool
health this slice makes meaningful; `R2d` builds on the retry classification).

## Baseline (verified this session)

- `git log -1` → `1ff0f59`; tree clean except this plan directory.
- `npm run status` → version 2026.11.7, 20 open roadmap items, 60 unpushed commits (oldest 25.5 h).
- `npm run check` → **PASS** (full, 22 gates, 76.2 s, run record `1ff0f59274d8`). The `npm audit` leg answered with 4 low-severity findings, so the registry is reachable and the full gate suite is the terminal check.
- `npx vitest run src/corroborate.test.ts` → 75/75 PASS.
- One pre-existing warning: `check-loop-artifacts` reports `2026-11-10-r6-encryption-capacity-remediation: plan.md has no **Done bar:** line`. It is a warning, does not fail the gate, and is out of this increment's scope (C-6).
- Register rows re-read at `docs/plans/2026-11-09-full-review-sweep/worklist.md`: F-R2-8 (P1), F-R2-14 (P1), F-R2-28 (P1), F-R2-29 (P1), F-R2-31 (P1), all `Scheduled-roadmap`.

## Predicates re-verified by reading the code this session

| Finding | Current code | What is wrong |
|---|---|---|
| F-R2-8 | `src/providers/core.ts:9-14` reads `INFOBROKER_CORE_API_KEY` once through `getEnvVar` and caches it in `_coreApiKey`; `src/providers/generic-http.ts:67-75` reads `process.env[cfg.auth_env]` directly | REQ-104 says credential-requiring providers accept a pool. CORE (`config.json:101-108`, `tier: free_http`, `auth_env` set, no `auth_optional`) and every `generic_http` provider read one variable, so `INFOBROKER_*_API_KEYS` is ignored. CORE's module-level cache would also pin the first key if the pool were wired in. |
| F-R2-29 | `src/index.ts:422-423` prepends `preferredProvider` when `config.providers[preferredProvider]?.enabled`, before any auth check; the chain tail is filtered by `getDispatchChain` (`src/config.ts:1023-1039`) | An explicit provider with no credential is dispatched and fails at the provider, instead of being excluded per REQ-020a. `getDispatchChain`'s own filter is tier-scoped: it skips the check for `free_http` (`core`) and for `generic_http` with `auth_optional`. |
| F-R2-14 | `src/corroborate.ts:566-569`: `options.providers` short-circuits the `getActiveProviders()` + `providerOperational()` filter | A caller-supplied list bypasses REQ-015 (disabled providers are skipped by all selection logic) and the auth check. |
| F-R2-31 | `src/retry.ts:60-66`: `isRetryable` accepts `RetryableError` with 429/5xx or a message regex; `src/lib/timeout.ts:29` rejects with a plain `new Error(message())` | A timeout is never retried, so REQ-035's "transient failure" leg does not reach REQ-032's retry path. |
| F-R2-28 | `throttle(slug)` is awaited once outside the retried closure at **five** sites: `src/index.ts:499` (search), `:835` (fetch), `src/corroborate.ts:679` (first pass), `:729` (gap pass), and `src/cite.ts:166` (citation chain) | Retries are extra outbound requests that skip REQ-030's per-provider minimum interval. |

Two supporting seams, read this session:

- `src/key-pool.ts:152-166` — `poolKeys(slug)` derives `INFOBROKER_<SLUG>_API_KEYS` / `_API_KEY` from the slug; `resolveApiKey(slug)` advances the persisted cursor as a side effect. A predicate cannot call it.
- Provider-usability logic exists **three times**: `src/config.ts:1023-1039` (tier-scoped, inside `getDispatchChain`), `src/corroborate.ts:422-435` (`providerOperational(slug, config)`, tier-agnostic), and `src/index.ts:1417-1422` (`providerOperational(p)`). `src/cite.ts:65` consumes the corroborate copy. The copies already disagree about CORE: the index/corroborate copies treat a keyless CORE as inactive, the dispatch copy dispatches it.

## Done bar

**Done bar:** F-R2-8, F-R2-14, F-R2-28, F-R2-29, and F-R2-31 are fixed and marked `Resolved` in the sweep worklist with a one-line fix summary; each fix is demonstrated by a test that fails on the unmodified source and passes on the restored tree (the red result recorded in `tasks.md`); a keyless `core` never enters a dispatch chain and a pooled CORE credential rotates after a 401; a `generic_http` provider with a custom `auth_env` rotates its pool the same way; a fully rejected pool makes the provider unavailable without blocking fallback; an explicit `provider` or `verify_claims.providers` entry that is disabled or unauthenticated never reaches the provider; a timed-out provider call is retried up to the configured count and the final error keeps the timeout message; every retry attempt passes the per-provider throttle; `ROADMAP.md` carries the four successor sections R2b–R2e and no R2 section; `CHANGELOG.md` gains one entry naming the five behavior changes; the increment record carries plan, tasks, and an AAR ending `LOOP PAUSED` or `LOOP OPEN`; `npm run typecheck`, `npm run check:fast`, `npm run check`, `npm run test-debate-club`, and `npm run validate-spec` exit 0 on the final tree.

**Non-closure rule:** a fix that needs a `config.json` value change, a credential-format change, or more than two production modules beyond the files named in the blast radius stops the increment. The AAR ends `LOOP OPEN`, the roadmap split still lands (the remaining sections are independently valid), and the offending fix moves to the section that owns it.

## Decisions

- **D1 — One usability predicate.** `src/config.ts` exports `providerUsable(slug, config)`: the provider exists, is enabled, its `auth_env` is satisfied unless `auth_optional` (tier-agnostic), its `url_env` is satisfied, and any declared credential pool has at least one available credential. `getDispatchChain` filters with it; `src/index.ts:1417` and `src/corroborate.ts:422` become delegations; `src/cite.ts:65` keeps its call site unchanged. **Alternative rejected:** keeping three predicates and patching each — the copies already disagree about CORE, and the next tier added re-opens the drift.
  - Pool availability uses a new non-mutating `hasUsableKey(slugOrEnv, now)` in `src/key-pool.ts`. `resolveApiKey` cannot serve as a predicate because it advances the cursor and writes state.
  - **Import cycle, named and accepted.** `config.ts` importing `key-pool.ts` closes the graph `config → key-pool → audit-log → config` (`src/audit-log.ts:9`). It is safe because both intermediate modules only *call* their config import inside functions (`audit-log.ts:10-16` uses `getConfig()` in `auditPath`; `key-pool.ts` calls `audit()` inside writers), and `config.ts` never calls `hasUsableKey` at module scope — only inside `getDispatchChain`. Step 7a proves this by importing `src/config.ts` standalone and asserting no throw. **Alternative placement rejected:** moving `getDispatchChain` into `src/chain.ts` — it has callers in `index.ts`, `chain.ts`, and tests, and moving it widens the diff beyond a predicate fix.
  - Consequence: a keyless CORE (and a generic provider whose pool is entirely rejected) is no longer dispatched. That is what `inspect_providers` already reports, so the two surfaces agree. This also resolves the status half of F-R2-9; its `auth_ok`/`inactive_reason` reporting stays in R2c, and the AAR records the partial so the R2c row is not mistaken for fully open.
- **D2 — Pool lookup for non-conventional env names.** `generic_http` declares an arbitrary `auth_env`, so `poolKeys(slug)` (slug-derived) cannot find it. Add `poolKeysForEnv(envName)` / `resolveApiKeyForEnv(envName, slug)`; `poolKeys(slug)`/`resolveApiKey(slug)` delegate with the conventional name. **The pool variable for a declared `auth_env` is `auth_env` + `S` when it ends in `_API_KEY` (preserving REQ-104's documented `_API_KEYS`), otherwise `auth_env + "_POOL"`.** CORE keeps the conventional slug path. **Alternative rejected:** requiring generic providers to rename their variables — breaks REQ-014's "no source changes" promise for existing user config. The rule is recorded as a decision, not edited into the generated auth reference (`skills/infobroker/references/provider-auth.md` is derived from `config.json`; a pool-name convention is not per-provider config).
- **D3 — Timeouts are transient.** `src/lib/timeout.ts` rejects with a new exported `TimeoutError`; `src/retry.ts` `isRetryable` returns true for it. The timeout error remains an `Error` so existing envelope and classification code is unchanged. **Alternative rejected:** extending the message regex — it would also retry unrelated strings containing "timed out".
- **D4 — Throttle per attempt, outside the timeout race.** At each of the five sites the retried closure becomes: `await throttle(slug)` → `start = Date.now()` (where a latency sample exists) → `withTimeout(call(), timeoutMs, …)`. Throttling must **not** sit inside `withTimeout`, or a legitimate minimum interval could consume a provider's timeout budget and manufacture a spurious timeout on the retry. Only the two `src/index.ts` sites record a sample; the `corroborate` and `cite` sites have no latency measurement, so the "excludes the wait" clause applies there only to the next attempt's spacing. **Alternative rejected:** throttling once per provider call — retries are requests, and REQ-030 is written per request.
- **D5 — What an unusable explicit provider does.** Three cases, each following the REQ that governs it:
  - **Disabled, `search_web`:** unchanged `invalid_input` (REQ-015; already implemented at `src/index.ts:424-428`, now asserted).
  - **Unauthenticated, `search_web`:** the provider is excluded from the prepended position and the selected type's chain serves, exactly as REQ-020a's "falling back through the selected type's chain" and "selection SHALL exclude … unauthenticated providers" require. `fallback_used` is already computed as `slug !== primarySlug` (`src/index.ts:675,694`), so the substitution is reported rather than silent.
  - **Unusable, `verify_claims`:** the explicit list is filtered by `providerUsable`; if nothing survives, the tool returns `invalid_input` naming the rejected slugs — with no eligible provider there is nothing to verify, and REQ-026g's no-batch-failure clause governs claims, not providers.
  **Alternative rejected:** erroring on the unauthenticated `search_web` case — it contradicts REQ-020a's explicit fall-through clause.
- **D6 — No push.** Publication stays user-authorized. The 25.5 h unpushed backlog fires the AAR trigger; the AAR records it and does not publish (C-7).

## Findings in scope

| ID | Predicate (re-verified) | Fix | Size |
|---|---|---|---|
| F-R2-8 | CORE and `generic_http` read one credential variable; CORE caches it for the process (`src/providers/core.ts:9-14`; `src/providers/generic-http.ts:67-75`) | Pool-aware credential lookup in both modules, drop CORE's module cache, note 401/403/429 against the pool | M |
| F-R2-29 | An explicit `provider` is prepended before any auth check (`src/index.ts:422-423`) | Gate the prepend on `providerUsable`; error per D5 | S |
| F-R2-14 | `verify_claims.providers` bypasses enable/auth filtering (`src/corroborate.ts:566-569`) | Filter with `providerUsable`; error when the filtered pool is empty | S |
| F-R2-31 | A timeout is not retryable (`src/retry.ts:60-66`; `src/lib/timeout.ts:29`) | `TimeoutError` + `isRetryable` | S |
| F-R2-28 | `throttle` sits outside `retryWithBackoff` at five sites (`index.ts:499,835`; `corroborate.ts:679,729`; `cite.ts:166`) | Move it inside the retried closure, before the timeout race (D4) | S |

## Blast radius

**Production files (9).** `src/config.ts` (new `providerUsable`, `getDispatchChain` filter), `src/key-pool.ts` (`hasUsableKey`, env-name-aware pool lookup), `src/index.ts` (explicit-provider gate; throttled retry in the search and fetch paths; delete the local `providerOperational`), `src/corroborate.ts` (explicit-provider filter; throttled retry in both passes; `providerOperational` delegates), `src/cite.ts` (throttled retry), `src/retry.ts` (`isRetryable` timeout leg), `src/lib/timeout.ts` (`TimeoutError`), `src/providers/core.ts` and `src/providers/generic-http.ts` (pool-aware auth).

**A named behavior consequence in `src/cite.ts`.** Its eligibility call (`cite.ts:65`) keeps its call site but delegates to the pool-aware predicate, so a keyed provider whose credential pool is exhausted or fully rejected is reported `skipped`/`no_auth` instead of being queried. That is a behavior change and is recorded in `CHANGELOG.md` and asserted in `src/cite.test.ts`.

**Tests.** `src/config.test.ts`, `src/key-pool.test.ts`, `src/retry.test.ts`, `src/lib/timeout.test.ts`, `src/providers/generic-http.test.ts`, `src/corroborate.test.ts`, `src/cite.test.ts`, and one Arena case in `debate-club/src/mcp-contract.test.ts` for the disabled-explicit-provider branch (C-1).

**Documentation and bookkeeping.** `ROADMAP.md` (split), `CHANGELOG.md`, `DECISIONS.md` (D2's naming rule), `docs/plans/2026-11-09-full-review-sweep/worklist.md` (five dispositions, the F-R2-9 partial note, and the `:230` pointer retarget), and `docs/plans/2026-11-10-r2a-credential-dispatch-remediation/{plan,tasks,aar}.md`.

**Explicitly out of scope.** Every other R2 row; `config.json` values (D1's consequence is a behavior change, not a config edit); the credential env-var *names* (F-R2-18, `Closed-P3`); the key-pool state collision fix and the state-file threat model (R8); `skills/infobroker/references/provider-auth.md` (generated; D2 records the naming rule in `DECISIONS.md` instead).

## Phases and steps

### Phase 0 — Scaffold, baseline, and audit

0. Keep this directory carrying `plan.md`, `tasks.md`, and an in-progress `aar.md` whose final line is `LOOP OPEN` (C-6 keeps the pre-existing warning as a warning, not a failure).
1. Run `npm run check` un-piped and record exit status, gate count, wall time. **Red-baseline branch:** a failure caused by this increment's own artifacts is fixed by step 0; a pre-existing failure is fixed as its own commit and Phase 0 restarts; a failure on the config, credential, or release surface stops the increment with `LOOP OPEN`.
2. Stage 1 seam audit (C-1): enumerate every caller of `providerOperational`, `getDispatchChain`, `poolKeys`, `resolveApiKey`, `withTimeout`, `throttle`, and `retryWithBackoff` (`grep -rn`), and locate the test seam that reaches the `search_web` explicit-provider branch. Record the list in `tasks.md`.
3. Confirm no existing test asserts the disabled-explicit-provider branch (grep `disabled or not configured`); if one exists, it is the landing site instead of a new Arena case.
4. Record `git status --porcelain`, HEAD, and the unpushed list; confirm none changes a finding's predicate.

### Phase 1 — Failing evidence first

5. Add one test per finding, each asserting the *correct* contract and each run **before** its fix; record the failure text in `tasks.md` (the fix must not be written first):
   - `src/config.test.ts`: a keyless `core` is absent from a chain that lists it; a pool whose every key is rejected makes the provider absent; an `auth_optional` provider stays present without a key.
   - `src/key-pool.test.ts`: `hasUsableKey` is false for an exhausted pool and does not advance the cursor across two calls.
   - `src/providers/generic-http.test.ts`: with `auth_env: "ACME_TOKEN"`, both `ACME_TOKEN` and its derived pool variable set, the second credential is used after the first returns 401, and the derived name matches C-2.
   - `src/corroborate.test.ts`: a disabled slug in `providers` is not searched; a list of only unusable slugs yields `invalid_input`.
   - `src/retry.test.ts`: a `TimeoutError` is retried `retry_count` times, and the rejection is the timeout error.
   - `src/cite.test.ts`: a pool-exhausted provider is skipped as `no_auth`, and a retried attempt is throttled.
   - `debate-club/src/mcp-contract.test.ts`: an explicit disabled provider returns `invalid_input` (landing site confirmed in step 3).
6. Add the throttle assertion: a provider whose first attempt fails retryably and whose second succeeds must show two throttled attempts (spy on `throttle`, or count calls with fake timers), for `search_web`, one `corroborate` pass, and the citation chain.
7. **Pre-fix sanity on the module graph (D1):** run `npx tsx -e "import('./src/config.ts')"` and `npx tsx -e "import('./src/key-pool.ts')"` on the unmodified tree to record the baseline, then repeat after step 10; a circular-import failure in either entry is a hard stop.

### Phase 2 — Fixes, in dependency order

8. `src/key-pool.ts`: `poolKeysForEnv`, `resolveApiKeyForEnv`, `hasUsableKey`; keep `poolKeys`/`resolveApiKey` as delegations so existing callers and tests are unchanged.
9. `src/providers/core.ts`: use the pool, delete `_coreApiKey`, call `noteAuthStatus("core", key, resp.status)`. `src/providers/generic-http.ts`: `authHeaders` resolves through the pool for `cfg.auth_env`; because that function never sees a response, thread the selected key to the call site (`:100`, `:152`) so the status is recorded against the right credential; keep the existing "required and absent" error for a provider with no pool at all.
10. `src/config.ts`: `providerUsable`; `getDispatchChain` filters with it (dropping the tier-scoped checks); export it for the other call sites. Re-run step 7's import probe.
11. `src/index.ts`: delete the local `providerOperational`, delegate to the shared predicate; gate the explicit-provider prepend per D5; at both sites put `throttle` and `start` before the `withTimeout` race inside the retried closure (D4).
12. `src/corroborate.ts`: `providerOperational` delegates; explicit `providers` filtered through `providerUsable`, `invalid_input` when empty; move `throttle` before the timeout race inside the retried closure in the first-pass and gap-pass sites. `src/cite.ts:166`: the same move.
13. `src/lib/timeout.ts` + `src/retry.ts`: `TimeoutError` and the retryable leg. Confirm the same classification reaches `src/index.ts:852` (fetch), `src/corroborate.ts:63`, and `src/cite.ts:81` without further edits.

### Phase 3 — Verification and documentation

14. Run the eight targeted suites plus `src/chain.test.ts`, `src/http.test.ts`, `src/rate-limiter.test.ts`, the tool-surface suite, and `npx vitest run src/index*`; record counts.
15. Run `npm run typecheck`, then `npm run check:fast`, then `npm run check` (full). A gate failure is repaired inside this increment; a failure on an out-of-scope surface goes to the AAR as a cross-chunk note.
16. Run `npm run test-debate-club` (C-3) and `npm run validate-spec`.
17. `CHANGELOG.md`: one entry under the current version naming the five behavior changes, the keyless-CORE consequence, the `cite` eligibility consequence, and the retry/throttle consequence, with the REQ IDs and the test files that pin them. `DECISIONS.md`: one entry recording the `auth_env` pool-name rule (D2).
18. `ROADMAP.md`: replace `§ R2 findings remediation` with exactly these four `## ` headings, in this order — `## R2b configuration reload and validation`, `## R2c provider status and inspection`, `## R2d retry, latency, quota and chain shape`, `## R2e financial source and prose reconciliation` — each with its bullets and a `**Trigger:**` line, and remove the R2a work (it ships here). The step-19 pointer targets the R2d heading verbatim. Run `npm run check-roadmap`.
19. `worklist.md`: mark F-R2-8, F-R2-14, F-R2-28, F-R2-29, F-R2-31 `Resolved` with the fix summary, following the F-R2-1 row's form; retarget the latency-leg pointer at `worklist.md:230` from the removed `§ R2 findings remediation` to `§ R2d retry, latency, quota and chain shape`; and add a partial note to the F-R2-9 row (status half resolved here, `auth_ok`/`inactive_reason` remains). Grep the worklist for any other `§ R2 findings remediation` reference and retarget each.
20. Finish `aar.md` with the register dispositions, the verification counts, the cross-chunk notes (including C-6 and C-8), and a terminal `LOOP PAUSED` or `LOOP OPEN`.

### Phase 4 — Commit series

21. Commit in convention order, each `typecheck`-verified: (a) source + tests for the pool and predicate (`config.ts`, `key-pool.ts`, the two provider modules, their tests); (b) source + tests for dispatch precedence, retry classification, and throttled retries (`index.ts`, `corroborate.ts`, `cite.ts`, `retry.ts`, `lib/timeout.ts`, their tests, Arena case); (c) docs and bookkeeping (`CHANGELOG.md`, `DECISIONS.md`, `ROADMAP.md`, `worklist.md`, plan directory). Stop and report rather than commit a failing tree (D-089: the split series owns commits).

## Conditions

- **C-1** — the explicit-provider branch may have no unit seam. If step 3 finds none, the Arena case is the assertion of record and the AAR says the handler branch is covered end-to-end only; no new export is added just to test it.
- **C-2** — the `generic_http` pool name is derived from the declared `auth_env` per D2: `auth_env: "ACME_TOKEN"` implies `ACME_TOKEN_POOL`, while a name ending in `_API_KEY` implies its `_API_KEYS` form. Step 5 pins both shapes; if a derived name collides with a real variable, the test uses a distinct name. The rule lands in `DECISIONS.md` and `CHANGELOG.md`, not in the generated auth reference (D2).
- **C-3** — `npm run test-debate-club` needs the Arena build; it is excluded from `check:fast`, so it is run explicitly and its result is a terminal requirement, not an assumption.
- **C-4** — retrying a timeout multiplies wall time by up to `retry_count + 1`. The tests use a short configured timeout and assert the attempt count, never a real 10 s wait. If `fetch_page`'s retry budget proves user-visible, the consequence is recorded in `CHANGELOG.md` and scheduled on `ROADMAP.md` rather than changed here.
- **C-5** — every key-pool test sets a temp `INFOBROKER_KEYPOOL_STATE` under `/tmp/opencode/` and a temp `TMPDIR`; no test reads or writes the operator's real pool state, quota file, or config layer.
- **C-6** — the `check-loop-artifacts` warning for `2026-11-10-r6-encryption-capacity-remediation` is recorded, not fixed. Fixing another increment's plan artifact would mix two increments in one diff.
- **C-7** — the unpushed backlog exceeds 24 h at plan time. The AAR notes the trigger, and the increment still does not publish (D6).
- **C-8** — `providerUsable` now excludes a keyless CORE from dispatch. If a shipped test, Arena fixture, or README claim depends on keyless CORE being reachable, the change is recorded as a documented behavior change with its fixture updated in the same commit — never a weakened predicate.
- **C-9** — no REQ body edit is planned: REQ-030, REQ-031, REQ-032, REQ-035, and REQ-104 already state the contracts being honored, and REQ-011 already covers optional keys. If a body must change, its Appendix B counts are measured before commit.
- **C-10** — independence: the cold pass runs in a fresh context. If one cannot be created, the AAR records `NOT_RUN` and the plan does not claim `independence: fresh`.

## Rollback

Every edit is a source-level behavior change with no state or data migration. Reverting the three commits restores the prior tree; the only carried state is key-pool cursor/cooldown data written under `INFOBROKER_KEYPOOL_STATE`, which the prior build reads and ignores safely (it already writes the same format). A downgrade after new writes loses nothing: the pool state is a selection hint, not a credential store, and no credential material is ever written.

## Verification summary

| Claim | How it is proven |
|---|---|
| Pool rotation for CORE and `generic_http` | Module tests: 401 on key 1 → key 2 on the next call; `hasUsableKey` false on an exhausted pool |
| Keyless CORE is not dispatched | `config.test.ts` chain assertion; `inspect_providers` status already agrees |
| Explicit provider precedence honors enable/auth | Arena case + `corroborate.test.ts` |
| An unauthenticated explicit provider falls through, `fallback_used: true` | handler assertion in the Arena case |
| A pool-exhausted provider is skipped in the citation chain | `cite.test.ts` eligibility assertion |
| Timeout is transient | `retry.test.ts` attempt count and final error identity |
| Retries are throttled | throttle spy / fake-timer attempt spacing at a `search_web`, a `corroborate`, and a `cite` site |
| Nothing else regressed | `npm run check` (22 gates) and `npm run test-debate-club` on the final tree |
