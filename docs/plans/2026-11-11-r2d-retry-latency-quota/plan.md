# Plan — R2d retry, latency, quota and chain shape

**Status:** draft · **Date:** 2026-11-11 · **Depth:** standard
**Review independence:** fresh — self pass, then a cold pass in a fresh context (2 Blockers, 4 Majors, 3 Nits) and one targeted diff re-review that PASSED with 3 non-blocking Nits; those three clarifications were applied after the re-review and are condition-level only (no new file, gate, or destructive operation). Cold report `/tmp/opencode/r2d-cold.md` (`77d808cd…`); re-review `/tmp/opencode/r2d-cold-rereview.md`, 8/10 reads.
**Rollback cost:** 1 — additive config keys, behavior edits in five production modules (plus `src/types.ts` and `config.json`) and one test-support fixture, plus tests and bookkeeping. No state-format change, no schema or credential change, no dependency, no release-surface change.
**Roadmap item:** `ROADMAP.md` § R2d retry, latency, quota and chain shape (the section is retired to `CHANGELOG.md` when this increment closes)
**Predecessor:** `625e5ba` (R2c-ii close; its AAR names `§ R2d retry, latency, quota and chain shape` as the next item)

## Why this section

`§ R2d` is now the first section in `ROADMAP.md`, and the ordering rule is
top section first. Its trigger ("start after R2a ships") is met: R2a closed at
`289c909`, and R2b/R2c closed after it (`dc09b73`). R2d is also the increment
the R2a plan named as the direct consumer of the retry classification work
(`docs/plans/2026-11-10-r2a-credential-dispatch-remediation/plan.md:30`).

The section carries four P1 and four P2 register rows. They share one
concern — what the server does when a provider refuses, stalls, or is
already spent — so they ship together, in three verifiable slices: quota
durability and reset, latency-window strategy, and chain-shape reporting.

## Baseline (verified this session)

- `git log -1` → `625e5ba`; `git status --porcelain` empty.
- `npm run status` → version 2026.11.7, 22 open roadmap items, **73 unpushed commits, oldest 45.3 h** (fires the AAR trigger; D7 keeps publication with the user).
- `npm run check` → **PASS** (full, 22 gates, 119.1 s, run record for `625e5ba`).
- One pre-existing warning: `check-loop-artifacts` reports `2026-11-10-r6-encryption-capacity-remediation: plan.md has no **Done bar:** line`. Warning only; out of scope (C-6).
- Register rows re-read at `docs/plans/2026-11-09-full-review-sweep/worklist.md`: F-R2-15 (P2), F-R2-26 (P2), F-R2-27 (P1), F-R2-30 (P1), F-R2-32 (P1), F-R2-33 (P2), F-R2-34 (P1), F-R2-35 (P2), all `Scheduled-roadmap`.

## Predicates re-verified by reading the code this session

| Finding | Current code | What is wrong |
|---|---|---|
| F-R2-15 | `getDispatchChain` filters with `providerUsable` (`src/config.ts:1137-1153`), which returns false for `enabled: false`; `search_web` builds its chain from it (`src/index.ts:420-439`) | The exclusion holds only by construction. No test asserts that a `disabled` provider is absent from dispatch or that a `search_web` call never reaches it; the existing config test covers the *missing-credential* branch, not `enabled: false` (`src/config.test.ts:827-831`). |
| F-R2-26 | `buildReport` computes `warning` at ≥ 0.8 and `exhausted` at ≥ cap (`src/quota.ts:192-205`); the status leg maps them (`src/health-status.ts:23-27`) | The only end-to-end assertion seeds exactly 240/300 (`src/provider-list.test.ts:15,29-40`), so the 0.8 boundary is asserted at one point but the 100% **skip by a fallback chain** and the below-boundary case are not. The REQ-034 citation in `src/chain.test.ts:1` points at tests that stub the predicate (`:84-97`), so the citation proves the demotion helper, not the threshold. The worklist row's `quota_warning`-unasserted claim is stale and is corrected in its Resolved line. |
| F-R2-27 | `createLatencyTracker(getWindowSize)` keeps a count-only window (`src/latency.ts:15-40`); `latency_window_size` is the only config key (`config.json:356`, `src/config.ts:769`) | REQ-036 requires a bounded **time** window with a configurable strategy. Timestamps are recorded and shifted but never read, so an idle period leaves stale samples in the average that drives `speed` ordering and the degraded-latency leg. |
| F-R2-30 | The quota branch skips without setting `lastError` (`src/index.ts:490-501`); the shared tail only fails when `lastError !== null` (`:747-786`) | A chain whose every provider is quota-exhausted falls through to `no_results: true` success (`:787`). REQ-031 distinguishes "exhausted by errors" (error) from "returns empty" (success); a quota refusal is not an empty result. |
| F-R2-32 | Writes are debounced 30 s and flushed only on `beforeExit` (`src/quota.ts:32,84-99`); no signal handler exists anywhere in `src/` | A restart via SIGTERM/SIGINT loses up to 30 s of increments, so REQ-033's "survives server restarts" is not durable in the ordinary stop path. |
| F-R2-33 | `isExpired` subtracts an undocumented 30 s grace (`src/quota.ts:113-115`); `src/quota.test.ts` has no reset case | REQ-033 says counters reset "on schedule"; a 30 s grace is a silent deviation, and no test pins either side of the boundary. |
| F-R2-34 | `failureTaxonomy` maps a rate-limited renderer to `code: "rate_limited"` with no details (`src/fetch-fallback.ts:139-145`); both call sites pass only `failures` (`src/index.ts:1156,1324`) | REQ-038 requires a rate-limited response to report `retry_after_ms`. `search_web` gets it from `chainExhaustion` (`src/error-envelope.ts:71`); `fetch_page` does not, even though the failing renderer is already placed in cooldown (`src/index.ts:897-899`). |
| F-R2-35 | `hedge.test.ts` covers the pure helpers; `raceFirstSuccess` covers empty-vs-error at the helper level | No integration test asserts the orchestration: the hedge switch, cross-task fallback order, all-empty vs all-error on the real handler, and cooldown skip without a new outbound call. |

Two supporting seams, read this session:

- `src/lib/stub-provider.ts` already starts a loopback provider and writes an
  isolated config with `INFOBROKER_QUOTA_STATE`/`INFOBROKER_KEYPOOL_STATE`
  under a temp root (`:28-61,115-185`). It supports `ok`, `missing`, and
  `echo401` modes only; it cannot express an empty result, a 429, a slow
  primary, or a per-task chain.
- `chainExhaustion` already accepts a `remainingMs` resolver and emits
  `retry_after_ms`/`cooling_down` (`src/error-envelope.ts:39-77`). The pattern
  to copy for F-R2-34 is in the same module.

## Done bar

**Done bar:** F-R2-15, F-R2-26, F-R2-27, F-R2-30, F-R2-32, F-R2-33, F-R2-34, and F-R2-35 are fixed or evidenced and marked `Resolved` in the sweep worklist with a one-line summary; every behavior change ships a test that fails on the unmodified source and passes on the final tree (red result recorded in `tasks.md`), while the two evidence-only findings (F-R2-15, F-R2-26) ship a test that passes on the final tree plus a one-line summary of what the unmodified source lacked; a chain whose every provider is quota-exhausted returns an error carrying `quota_exhausted`, not an empty success, and a chain mixing one quota-exhausted provider with otherwise-empty providers does the same; a quota increment survives SIGTERM and SIGINT; a counter whose `resetAt` is one second in the past resets and one second in the future does not; `inspect_providers` latency honors a configured time window and strategy, including an idle read with no new sample, with a validation rejection for an invalid strategy or non-positive window; a rate-limited `fetch_page` reports `retry_after_ms`; a provider at 100% receives zero outbound calls while a healthy provider in the same chain serves; a disabled provider is neither dispatched nor called by `search_web`; one integration suite covers the hedge switch, cross-task order, all-empty vs all-error vs mixed, and cooldown skip; `ROADMAP.md` no longer carries the R2d section; `CHANGELOG.md` carries one entry; the increment record carries plan, tasks, and an AAR ending `LOOP PAUSED` or `LOOP OPEN`; `npm run typecheck`, `npm run check:fast`, `npm run check`, and `npm run validate-spec` exit 0 on the final tree.

**Non-closure rule:** a fix that needs a quota state-format change, a schema
migration, a new dependency, or more than two production modules beyond the
blast radius stops the increment. The AAR ends `LOOP OPEN`, the remaining rows
stay in a successor roadmap section, and the shipped slice is recorded in
`CHANGELOG.md`.

## Decisions

- **D1 — Quota exhaustion is a chain failure, not an empty result.** In the
  `search_web` attempt, the quota branch sets `lastError` to an
  `all_providers_exhausted` envelope carrying the provider slug, exactly as
  the cooldown branch already sets `rate_limited`. The shared tail then runs
  REQ-031a's cross-task fallback before returning `chainExhaustion`, which
  already renders `quota_exhausted` (`src/error-envelope.ts:62-66`).
  **Alternative rejected:** adding a fourth terminal branch — it duplicates
  the cross-task and exhaustion logic that the `lastError` path already
  carries and would let a general_web provider answer while a specialized
  chain is spent.
  - **Mixed-chain rule, stated explicitly.** The tree already treats a
    provider-attributable failure as chain-failing: an error sets
    `lastError`, an empty result does not (`src/index.ts:534-574`), so an
    error-plus-empty chain is an exhaustion error today while an all-empty
    chain is a success (`:747-786`). Quota exhaustion joins the failure
    class, because a refusal is not an empty result. The plan therefore pins
    both the all-exhausted and the exhausted-plus-empty cases as errors, and
    keeps the all-empty case as `no_results: true`.
  - **Attempt-time, not selection-time.** `getDispatchChain` filters on
    usability only (`src/config.ts:1148-1153`), so a provider at 100% stays
    in the selected chain and is skipped inside `attempt()` before any
    outbound call. The F-R2-26 test asserts that observable layer: zero
    outbound requests to the spent provider, a healthy chain-mate serves.
  - Consequence: a fully spent chain now returns `[ERROR]` where it returned
    `[OK] … no_results: true`. That is the finding, and it is recorded in
    `CHANGELOG.md`.
- **D2 — Latency window is strategy-driven; the default is `both`.** Add
  `output.latency_window_strategy` (`"count" | "time" | "both"`, default
  `"both"`) and `output.latency_window_ms` (positive integer, default
  `900000`, i.e. 15 minutes). `createLatencyTracker` takes a window resolver
  read per sample (so `reload_config` applies on the next sample, matching the
  existing `getWindowSize` contract) and evicts by count, by age, or both.
  **Age eviction runs on the read path as well as on `track()`**: `avg()`
  first drops samples older than the window (or filters them out of the
  mean), so an idle provider whose last sample aged out reports no history
  instead of a stale average. `avg` is computed over retained samples only;
  `total()` is unchanged.
  **Alternative rejected:** leaving `"count"` as the default — REQ-036 says
  the metric "SHALL be computed over a bounded time window", and a count-only
  default leaves the stale-sample defect in the shipped configuration. A
  15-minute horizon is longer than any plausible burst and shorter than a
  routing-relevant drift.
  - The two fields stay **optional in `Config.output`** with a runtime
    fallback (`"both"` / 900000), so the many test fixtures that build an
    `output` object without them keep type-checking; `config.json` ships both
    values, and a user layer that omits them inherits the shipped default.
  - Validation: `latency_window_ms` must be a finite integer ≥ 1 and no
    greater than `MAX_TIMER_MS`; the strategy must be one of the three
    literals. The numeric branch is added to `NUMERIC_BRANCHES`
    (`src/config.test.ts:667-726`); the strategy check needs its own
    string-literal test because that list holds numeric paths only.
- **D3 — Signal flush preserves conventional stop semantics.** `src/quota.ts`
  registers one-shot `SIGTERM` and `SIGINT` handlers that flush the pending
  write, remove only their own listener, and re-raise the same signal so the
  process still exits with the platform's default status. `beforeExit` stays.
  **Alternative rejected:** `process.exit(0)` — it would relabel a signal
  stop as success and skip any future shutdown handler.
- **D4 — Reset is exact.** `isExpired` becomes `Date.parse(resetAt) <=
  Date.now()`; the 30 s grace is removed. Tests pin one second either side.
  **Alternative rejected:** keeping the grace and documenting it — REQ-033
  already states the schedule, and the grace lets a spent provider stay
  skipped past the stated reset.
- **D5 — `retry_after_ms` comes from the live cooldown registry.**
  `failureTaxonomy` gains an optional `remainingMs` resolver defaulting to
  `cooldownRemainingMs`, mirroring `chainExhaustion`, and its return type
  gains an optional `retry_after_ms?: number`. The `rate_limited` branch sets
  it to the maximum remaining cooldown among the failed renderers when that
  value is > 0, and omits it when cooldown is disabled (duration 0). Because
  the taxonomy's return is a plain object and `err()` takes `details`
  separately, each of the two call sites (`src/index.ts:1156-1162,1324-1330`)
  merges the field into its `details` object; the plan names that merge as
  part of the fix rather than assuming it.
  - Consequence: the `extract` path reports it too, because it shares the
    taxonomy.
- **D6 — Orchestration evidence is end-to-end, not a new export.** F-R2-15
  and F-R2-35 are asserted through the spawned server against loopback stubs,
  extending `src/lib/stub-provider.ts` so the scenarios are expressible:
  `startStubProvider` accepts its current mode string unchanged or a
  `{ mode: "ok" | "empty" | "missing" | "rate_limited" | "error" | "echo401", delayMs?: number }`
  object (the existing twelve call sites stay valid);
  `HermeticProvider` gains `url` (each provider may point at its own stub
  server), `enabled` (so a dispatched-then-disabled case is expressible), and
  an optional `rateLimit`; `HermeticConfigOptions` gains `chains` (per-task
  dispatch chains) and `output` (e.g. hedge timings). The default single-URL
  and force-enable behavior stays for existing callers. A seeded quota file
  under the isolated root reaches the 100% case. No production export is
  added just to test the handler. **Alternative rejected:** exporting the
  orchestration closure — it is bound to module-level state (`latency`,
  cooldowns, session stats) and an export would test a copy that production
  does not use.
- **D7 — No push.** Publication stays user-authorized. The 45.3 h backlog
  fires the AAR trigger; the AAR records it and does not publish.
- **D8 — No REQ body edit is planned.** REQ-030 through REQ-038 already state
  the contracts being honored. If a body must change, its Appendix B counts
  are measured before commit (C-7).

## Findings in scope

| ID | Predicate (re-verified) | Fix | Size |
|---|---|---|---|
| F-R2-30 | Quota skip leaves `lastError` null (`src/index.ts:490-501`) | Set an exhaustion error in the branch (D1) | S |
| F-R2-32 | No signal flush (`src/quota.ts:84-99`) | One-shot SIGTERM/SIGINT flush, re-raise (D3) | S |
| F-R2-33 | 30 s reset grace, no reset test (`src/quota.ts:113-115`) | Exact reset + boundary test (D4) | S |
| F-R2-27 | Count-only latency window (`src/latency.ts:15-40`) | Strategy + time window + config/validation (D2) | M |
| F-R2-34 | `fetch_page` rate-limit envelope has no `retry_after_ms` (`src/fetch-fallback.ts:139-145`) | Cooldown-derived detail (D5) | S |
| F-R2-26 | 100% chain skip and sub-boundary warning unasserted; citation stubs the predicate | Tests in `quota.test.ts` and the orchestration suite; behavior is assumed already correct and step 4 is the audit that proves it | S |
| F-R2-15 | `enabled: false` exclusion untested for dispatch and `search_web` | Dispatch unit assertion + orchestration call-count assertion | S |
| F-R2-35 | Hedge switch, cross-task order, all-empty vs all-error, cooldown skip untested end-to-end | Orchestration suite over the extended stub (D6) | M |

## Blast radius

**Production files (7).** `src/quota.ts` (signal flush, exact reset),
`src/latency.ts` (strategy and time window), `src/index.ts` (latency tracker
construction, quota-exhaustion `lastError`), `src/fetch-fallback.ts`
(`retry_after_ms`), `src/config.ts` + `src/types.ts` + `config.json` (two
additive `output` keys and their validation).

**Test support (1).** `src/lib/stub-provider.ts` (per-provider `url`,
`enabled`, and `rateLimit`; `startStubProvider` `empty`/`rate_limited`/
`error` modes plus `delayMs`; per-task `chains` and `output` options).
Existing modes, defaults, and their suites must stay green unchanged.

**Tests.** `src/quota.test.ts` (reset boundaries, signal flush through a
spawned server, 0.8/1.0 boundaries), `src/latency.test.ts` (each strategy,
eviction, hot-reload), `src/config.test.ts` (validation branches, dispatch
`enabled: false`), `src/fetch-fallback.test.ts` (`retry_after_ms` present and
omitted), `src/index` orchestration suite (new `src/dispatch-orchestration.test.ts`),
and `src/chain.test.ts` (quota-demotion citation reads the real predicate
where practical).

**Documentation and bookkeeping.** `ROADMAP.md` (retire the section),
`CHANGELOG.md` (one entry naming the behavior changes), the sweep
`worklist.md` (eight dispositions plus any stale R2d pointer), and
`docs/plans/2026-11-11-r2d-retry-latency-quota/{plan,tasks,aar}.md`.

**Explicitly out of scope.** The R2e prose and financial-source rows; the
`service_tier` and retry-classification rows shipped in R2a; the R4 fetch-page
extraction rows; the R8 state-hardening rows; any change to the quota file's
shape or the credential pool; provider `retry_count` semantics; the
`check-loop-artifacts` warning for the R6 increment (C-6).

## Phases and steps

### Phase 0 — Scaffold and baseline

0. Keep this directory carrying `plan.md`, `tasks.md`, and an in-progress
   `aar.md` whose final line is `LOOP OPEN`.
1. Re-confirm the baseline recorded above if execution starts on a different
   HEAD: run `npm run check` un-piped and record exit status, gate count, and
   wall time. **Red-baseline branch:** a failure caused by this increment's own
   artifacts is fixed by step 0; a pre-existing failure is fixed as its own
   commit and Phase 0 restarts; a failure on the quota, latency, or config
   surface stops the increment with `LOOP OPEN`.
2. Seam audit (recorded in `tasks.md`): enumerate callers of
   `createLatencyTracker`, `isExpired`, `failureTaxonomy`, `getDispatchChain`,
   `providerUsable`, and `startStubProvider`/`writeHermeticConfig`; confirm the
   stub's existing callers so its extension is additive.
3. Confirm no existing test already covers the hedge switch, cross-task order,
   all-empty vs all-error, cooldown skip, quota reset, or a signal flush; if
   one exists, it is the landing site rather than a new suite.

### Phase 1 — Failing evidence first

4. Add one test per finding, each asserting the **correct** contract and each
   run **before** its fix; record the failure text in `tasks.md`, or for the
   two evidence-only findings (F-R2-15, F-R2-26) record the pass on the
   unmodified tree and the evidence it adds:
   - `src/quota.test.ts`: a counter one second past `resetAt` resets; one
     second before does not; monthly and daily legs both (F-R2-33). Daily
     count 79/100 is not warning, 80/100 is, 100/100 is exhausted (F-R2-26).
   - `src/latency.test.ts`: `"time"` evicts a sample older than the window;
     `"count"` ignores age; `"both"` applies the tighter bound; a shrunken
     window applied on the next sample; and an **idle read** — advance the
     clock past the window, call `avg()` with no intervening `track()`, and
     expect 0 (F-R2-27).
   - `src/config.test.ts`: an invalid strategy string and a zero/negative
     `latency_window_ms` are rejected (a dedicated string-literal test for
     the strategy, since `NUMERIC_BRANCHES` holds numeric paths only); a
     disabled provider is absent from `getDispatchChain` (F-R2-27, F-R2-15).
   - `src/fetch-fallback.test.ts`: a 429 renderer yields `retry_after_ms`
     when a cooldown is active and omits it when the duration is 0
     (F-R2-34).
   - `src/dispatch-orchestration.test.ts`: a fully quota-exhausted chain
     returns `[ERROR]` with `quota_exhausted` (F-R2-30); an exhausted plus
     empty chain returns the same error while an all-empty chain returns
     `no_results: true` (F-R2-30, F-R2-35); a provider at 100% receives zero
     outbound calls and a healthy chain-mate serves (F-R2-26); a disabled
     provider is never dispatched and never called (F-R2-15); hedge on vs off
     selects the fast secondary vs the slow primary (F-R2-35); cross-task
     fallback order (F-R2-35); all-error returns `all_providers_exhausted`
     (F-R2-35); a cooled provider is skipped with no new outbound request
     (F-R2-35).
   - Signal flush (F-R2-32): spawn the isolated server, perform a search that
     increments quota, send SIGTERM, await exit, and assert the persisted file
     carries the increment; repeat for SIGINT.
5. Extend `src/lib/stub-provider.ts` to the exact shape in D6 (per-provider
   `url`/`enabled`/`rateLimit`, `startStubProvider` modes plus `delayMs`,
   per-task `chains`, `output` overrides), then re-run its existing consumers
   to prove the extension is additive.

### Phase 2 — Fixes, in dependency order

6. `src/quota.ts`: exact reset (D4) and the one-shot signal flush (D3).
7. `src/latency.ts`, `src/types.ts`, `src/config.ts`, `config.json`: strategy
   and time window plus validation (D2); update the tracker construction at
   `src/index.ts:81`.
8. `src/index.ts`: set the quota-exhaustion `lastError` (D1). Confirm the
   cross-task path still runs and the envelope carries `quota_exhausted`.
9. `src/fetch-fallback.ts`: the `remainingMs` option and the `rate_limited`
   detail (D5).
10. Fill in any remaining orchestration behavior the Phase 1 tests expose
    (expected: none beyond D1; a failing expectation is a real defect and is
    fixed, not weakened).

### Phase 3 — Verification and documentation

11. Run the targeted suites (`quota`, `latency`, `config`, `fetch-fallback`,
    `dispatch-orchestration`, `chain`, `provider-list`, `provider-health`,
    `error-envelope`) and record counts.
12. Run `npm run typecheck`, then `npm run check:fast`, then `npm run check`
    (full). A gate failure is repaired inside this increment; a failure on an
    out-of-scope surface goes to the AAR as a cross-chunk note.
13. Run `npm run validate-spec` and confirm no REQ body changed (D8) and no
    clause tag is newly required (C-8).
14. `CHANGELOG.md`: one entry naming the quota-exhaustion error shape, the
    exact reset, the signal flush, the latency strategy default, and the
    `retry_after_ms` addition, with REQ IDs and the tests that pin them.
15. `ROADMAP.md`: remove the R2d section (it ships here). Run
    `npm run check-roadmap`.
16. `worklist.md`: mark the eight rows `Resolved` with a one-line summary,
    following the F-R2-1 row's form, and retarget any pointer that names the
    retired section. The F-R2-26 summary records that its
    "`quota_warning` unasserted" clause was stale
    (`src/provider-list.test.ts:122` already asserts it) so the row closes
    traceably.
17. Finish `aar.md` with dispositions, verification counts, the 45.3 h
    backlog note (D7), cross-chunk notes, and a terminal `LOOP PAUSED` or
    `LOOP OPEN`.

### Phase 4 — Commit series

18. Commit in convention order, each `typecheck`-verified: (a) quota durability
    and reset (`quota.ts`, `quota.test.ts`); (b) latency strategy and config
    (`latency.ts`, `types.ts`, `config.ts`, `config.json`, tests); (c) chain
    shape and fetch taxonomy (`index.ts`, `fetch-fallback.ts`, tests); (d)
    orchestration suite and the stub extension; (e) docs and bookkeeping
    (`CHANGELOG.md`, `ROADMAP.md`, `worklist.md`, plan directory). Stop and
    report rather than commit a failing tree (D-089: the split series owns
    commits).

## Conditions

- **C-1** — `total()` counts every request regardless of window strategy; no
  caller may change it into a windowed count.
- **C-2** — the time-window eviction is O(samples) per track and bounded by
  `latency_window_size`, so the default `"both"` cannot grow the map beyond
  the existing count bound.
- **C-3** — the signal test polls for process exit and the file write with a
  bounded wait and never asserts a fixed sleep; it also skips if the platform
  cannot deliver the signal (recorded, not silently passed).
- **C-4** — the stub extension must not alter the behavior of `ok`,
  `missing`, or `echo401`; the existing suites are the regression check.
- **C-5** — every quota/latency test sets `INFOBROKER_QUOTA_STATE` and
  `TMPDIR` under a temp root; no test reads or writes the operator's real
  quota file.
- **C-6** — the `check-loop-artifacts` warning for
  `2026-11-10-r6-encryption-capacity-remediation` is recorded, not fixed.
- **C-7** — if a REQ body must change, its Appendix B counts are measured
  before commit; no Appendix B violation ships.
- **C-8** — REQ-034 and REQ-036 define their outcomes as sequential
  thresholds, not "or"-joined branches, so no new named clause tag is
  expected. `validate-spec` is the check; if it demands one, the tag lands in
  the same commit.
- **C-9** — independence: the cold pass runs in a fresh context. If one cannot
  be created, the AAR records `NOT_RUN` and the plan does not claim
  `independence: fresh`.
- **C-10** — time-window tests use an injected clock; no test waits 15
  minutes or a real cooldown duration.
- **C-11** — F-R2-26's "behavior is already correct" is an assumption, not
  evidence. Step 4's tests run before any fix; if a boundary assertion fails,
  the defect is fixed in this increment and the finding summary names the
  production change instead of claiming test-only coverage. F-R2-15 is the
  same class: its test is expected to pass on the unmodified tree, and the
  finding's value is the missing evidence, recorded as such.

## Rollback

Every edit is a source-level behavior change. The two config keys are
additive and optional; an older build ignores them, and the shipped default
reads without them. The quota file shape is unchanged, so a downgrade reads
prior state safely. Reverting the five commits restores the prior tree; no
credential, KB, or schema migration is involved.

## Evidence

Preflight sidecar: `~/.local/state/opencode/plans/3b34aea2bce9fb4da60d99c296e2000157a146aca988b48969a73d1a3d3aec94/plan.evidence.json`
(generated 2026-11-11, `git HEAD` `625e5ba`). Two preflight notes are
expected and benign: the newly created `src/dispatch-orchestration.test.ts`
does not exist yet (the plan creates it), and two prose fragments were read
as absolute paths by the path scraper; both were rephrased and the sidecar
regenerated below.

## Verification summary

| Claim | How it is proven |
|---|---|
| A spent chain is an error, not an empty success | `dispatch-orchestration.test.ts` asserts `[ERROR]` with `quota_exhausted` for all-exhausted and exhausted-plus-empty, and success for all-empty |
| A quota increment survives SIGTERM/SIGINT | Spawned server, signal, persisted file assertion (both signals) |
| Reset is exact at `resetAt` | `quota.test.ts` boundary pair, daily and monthly |
| The 80% and 100% boundaries hold | `quota.test.ts` at 79/80/100 and the orchestration zero-call assertion for a provider at 100% |
| Latency honors a time window and strategy | `latency.test.ts` per strategy with an injected clock, including an idle `avg()` with no new sample; `config.test.ts` validation |
| A rate-limited `fetch_page` reports `retry_after_ms` | `fetch-fallback.test.ts` present/omitted pair |
| A disabled provider is never dispatched or called | `config.test.ts` chain assertion + orchestration call count |
| Hedge, cross-task order, all-empty vs all-error, cooldown skip | `dispatch-orchestration.test.ts` |
| Nothing else regressed | `npm run check` (22 gates) and `npm run validate-spec` on the final tree |
