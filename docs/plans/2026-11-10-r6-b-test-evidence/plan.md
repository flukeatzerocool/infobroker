# Plan — R6 auto-index, collection-scoping, and expiry test evidence

**Status:** approved by user ("execute plan") · **Date:** 2026-11-10 · **Depth:** standard
**Review independence:** fresh — cold pass 1 FAILED (1 Blocker, 4 Majors), diff re-review passed with 4 author amendments recorded as C-3. Cold report `/tmp/opencode/r6-b-cold.md` (`3e5d5154…ea5c`, stages 5/5); artifact sha `a735ee07…4e36bc`.
**Rollback cost:** 1 — new tests plus one rewritten test body; no production behavior, config, dependency, schema, or destructive change
**Roadmap item:** `ROADMAP.md` § R6 auto-index, scoping, and expiry remediation (retire on close)
**Predecessor:** `f4ce094` (R6 `manage_kb` action-contract remediation; `LOOP PAUSED`). The review-sweep chunk R7 closed 2026-11-09 (`docs/plans/2026-11-09-full-review-r7/aar.md`, `LOOP PAUSED`), so this item's trigger — "start after chunk R7 closes" — is satisfied. "Chunk" here is a sweep unit, not a roadmap section: the residual R2–R9 remediation sections are open roadmap items by design and do not gate this one.

## Baseline (verified this session)

- `npm run check:fast` → PASS (20.2 s, 19 gates) at HEAD `f4ce094`, tree clean (`git status --porcelain` empty).
- `npm run status` → version 2026.11.7, 25 open roadmap items, 35 unpushed commits, last pipeline run 2026-11-07.
- The first roadmap section is this item; every review-sweep chunk (R1–R9 and M1) is closed and the R6 `manage_kb` action-contract section was retired by the predecessor.

## Done bar

**Done bar:** F-R6-B-1, F-R6-B-2, and F-R6-B-3 are fixed and marked `Resolved` in the sweep worklist; each finding's core observation is shown to fail under at least one recorded source mutation of the code it observes and to pass on the shipped tree; the R6 auto-index section is retired from `ROADMAP.md` (25 work items → 24); `npm run check:fast` exits 0 on the final tree, and `npm run check` exits 0 when the registry probe (Step 0.5) confirms `audit` is reachable, otherwise the run is recorded under condition C-2; the increment record under `docs/plans/2026-11-10-r6-b-test-evidence/` carries plan, tasks, and an AAR ending `LOOP PAUSED`.

**Conditions:** **C-1** — if a new assertion fails on the unmodified tree, it is not weakened; the exposed defect is fixed within the same increment under D6 and the plan is amended. **C-2** — if Step 0.5's registry probe cannot reach the registry, the full `npm run check` is recorded as not-run for that reason and `check:fast` is the terminal gate; the AAR states this rather than claiming a green full run. **C-3** — the cold pass reviewed artifact sha `e5088fbb…adbe6b` (`/tmp/opencode/r6-b-plan.reviewed.md`); this revision applies only its Deferred interval-removal risk and three clarity nits (sub-minute expiry before the interval tick, `npm audit` as the probe, "sweep chunk" wording, and a third B-3 mutation), so build-review must confirm those four edits match this text before executing.

## Findings in scope

| ID | Predicate (verified by reading the branch and the cited test) | Fix |
|---|---|---|
| F-R6-B-1 | REQ-064 auto-index has no observing test. The only citation (`src/deep-search.test.ts:103-116`) injects a callback and asserts `deepRead` calls it; the real `autoIndex` (`src/kb.ts:1038-1074`) — its `setImmediate` deferral (`:1049`), the `auto_index` toggle (`:1046`), and the swallowed loop error (`:1070-1071`) — is unobserved, and no test drives the three REQ-064 hook sites (`src/index.ts:586,588` search, `:1333` fetch_page, `:1926` verify_claims) | Tests only |
| F-R6-B-2 | REQ-065 config-default precedence is indistinguishable from the literal fallback because the fixture default is `"default"`, the same string `resolveCollection` returns when no config is set (`src/kb.test.ts:237-250`; `src/kb.ts:513-521`) | Fixture change in the test: a distinct configured default and an empty-string default to reach the literal tier |
| F-R6-B-3 | REQ-066 startup/interval expiry, tier-driven removal, indefinite tiers, and the no-error-event clause have zero assertions; the only test covers a zero interval (`src/kb-hardening.test.ts:46-52`; `src/kb.ts:442,446,1103-1121`) | Tests only |

## Design decisions

**D1 — Test homes.** (a) A new unit file `src/kb-auto-index.test.ts` owns the `autoIndex` seam predicates: toggle, synchronous return, deferred ingestion, and swallowed failure. (b) `src/kb-hardening.test.ts`, which already declares REQ-066 and holds the zero-interval test, gains the expiry cases. (c) The REQ-065 precedence test stays in `src/kb.test.ts` where `resolveCollection` is already exercised. (d) A new Arena file `debate-club/src/kb-auto-index.test.ts` drives the three hook sites over real stdio. Rejected: cramming all of it into `src/kb.test.ts` — that file shares one mutable store across 30+ tests and ordering coupling would hide the failure; extending `debate-club/src/mcp-contract.test.ts` — it already carries 600+ lines and one shared server with `auto_index: false` (`debate-club/src/client.ts:74-82`).

**D2 — Non-blocking is observed at the seam, not by a latency threshold.** `autoIndex` must return before any chunk exists; the test asserts `kbList()` is empty synchronously after the call and becomes non-empty after the deferred work runs (`vi.waitFor`, bounded). Rejected: asserting a wall-clock latency on an Arena tool call — the CI variance makes a threshold either flaky or vacuous, and it would not prove the deferral.

**D3 — Failure suppression is injected through the result object.** A result whose `snippet` is a throwing getter drives the `try`/`catch` at `src/kb.ts:1070-1071`. The test asserts the call itself does not throw (the rejection happens inside the deferred callback, so the load-bearing assertions are the `Auto-index error` event and a still-queryable store — not `expect(...).not.toThrow()` on the rejection). Rejected: monkey-patching `kbIngest` through the ESM live binding — brittle and not type-checkable.

**D4 — Expiry is driven with fake timers, not backdated SQL.** `vi.useFakeTimers()` plus `vi.setSystemTime` before the ingest, then a clock advance. Startup removal is observed by a second `initKb` on the same path (`src/kb.ts:442`); interval removal by `advanceTimersByTime` past the scheduled `setInterval` (`src/kb.ts:446`) with no re-init. The timer must be installed while fake timers are active, so the test enables them before `initKb`, restores real timers in `finally`, and re-inits a clean store for the following tests. Rejected: a real `setTimeout`/sleep (slow, flaky); direct `UPDATE chunks SET ingested_at` via `node:sqlite` (proves the predicate, not the startup/interval scheduling the finding names).

**D5 — The config-default tier is made distinguishable, not the resolver.** `initKb` accepts a distinct `default_collection` (for example `"config-col"`), the test asserts `resolveCollection(undefined)` returns it with no env override, and an empty-string default reaches the literal `"default"` tier. The shared `beforeAll` default is restored in `finally`. No production change: `resolveCollection` already implements the order correctly; only the observation was missing.

**D6 — Tests-only unless a test exposes a defect.** All three findings are evidence gaps, not known behavior bugs. The fail-under-mutation step below is the proof that each assertion is coupled to the code it names. If an assertion fails on the unmodified tree, the plan does not weaken it: the failure becomes a scoped defect, fixed under condition C-1 and recorded as a plan amendment.

**D7 — No CHANGELOG entry and no spec edit.** REQ-064, REQ-065, and REQ-066 already state the contracts; this increment adds evidence, not behavior. The spec→README binding does not trigger, and a tests-only change is outside the CHANGELOG's semantic-impact rule. If C-1 fires, the fix gets a `2026.11.7` entry and a re-run of the gates it feeds.

## Blast radius

| File | Change | Size |
|---|---|---|
| `src/kb-auto-index.test.ts` (new) | Toggle-off, synchronous-return, deferred-ingest, and thrown-getter failure tests (REQ-064) | M |
| `src/kb-hardening.test.ts` | Extend the REQ-066 describe: startup removal, interval removal, tier-not-`source_type` removal, indefinite tier, no-error-event (REQ-066) | M |
| `src/kb.test.ts` | REQ-065 precedence test uses a distinct config default and an empty-string default; restores the shared config | S |
| `debate-club/src/kb-auto-index.test.ts` (new) | Arena hook tests for `search_web`, `fetch_page`, and `verify_claims` against the replay fixtures (REQ-064) | M |
| `ROADMAP.md` (`:17-21`) | Retire the section; leave the other R6 sections | S |
| `docs/plans/2026-11-09-full-review-sweep/worklist.md` (`:805-807`) | Mark F-R6-B-1/2/3 `Resolved` | S |
| `docs/plans/2026-11-10-r6-b-test-evidence/{plan,tasks,aar}.md` | Increment record | S |

No production source, schema, config, or routing file changes. `check-intent-citations` needs no edit; Step 0 confirms it.

## Implementation steps

**Step 0 — Surface probes (read-only).**

1. `npm run check-intent-citations` — record the citation count and confirm no tool, parameter, or action changes (expected: no edit).
2. Read the fixtures that serve the three hook queries and record the response URLs the Arena tests will poll: `debate-club/fixtures/index.json` for `retrieval+augmented+generation` (wikipedia), `https://example.com/doc` (jina), and the `verify` scenario used by `mcp-contract.test.ts:291-303`.
3. Confirm `vi.useFakeTimers()` + `setSystemTime` interoperates with `node:sqlite` in this suite by a throwaway probe under `/tmp/opencode/` (not committed). If it does not, fall back to a real `setInterval` with `maintenance_interval_minutes: 0.001` and a bounded poll, and record the fallback in `tasks.md`.
4. Confirm `debate-club/src/client.ts:59-86` `configLayer` shallow-merge is sufficient to start a server with `auto_index: true` and a temp `storage_path` (it replaces the whole `kb` object, so the layer carries `storage_path`, `keys_path`, `reports_path`, `auto_index`, and `maintenance_interval_minutes: 0`).
5. **Registry probe for the full gate.** Run `npm audit --json` once (the audit endpoint `npm audit` uses can be blocked independently of package metadata) and record whether the registry answers. If it does not, the full `npm run check` is deferred under condition C-2 and the terminal bar is `check:fast` plus the recorded probe; do not promise a green full run the environment cannot produce.
6. **Content-policy precondition.** The `fetch_page` hook fires only when `disposition()` returns `"store"` (`src/index.ts:1332`), which depends on the global `content_policy.mode` (`src/content-policy.ts:47-49,134-139`), not the `kb` block. The Arena layer pins `content_policy: { mode: "off" }` at the top level so an operator or CI layer cannot silently suppress the hook.

**Step 1 — Write the tests (no source change).**

1. `src/kb-auto-index.test.ts`, tagged `// @implements REQ-064`, with a file-local fixture mirroring `src/kb-hardening.test.ts:12-31`: a `mkdtempSync(join(tmpdir(), "infobroker-kb-auto-index-"))` root, a `makeConfig(overrides)` returning `storage_path` under that root, `embedding_model: "signed-hash-tfidf"`, `chunk_size: 512`, `chunk_overlap: 64`, `auto_index: true`, `default_collection: "auto-unit"`, `maintenance_interval_minutes: 0`, the shipped tier set plus `default_tier: "stable"`, and an `afterAll` that `rmSync(root, { recursive: true, force: true })`. Each test re-inits its own subdirectory so ordering cannot leak:
   - **toggle off:** `initKb` with `auto_index: false`; call `autoIndex`; after a flushed macrotask `kbList()` is empty.
   - **non-blocking:** `initKb` with `auto_index: true`; call `autoIndex(results, "wikipedia")`; assert `kbList()` is empty synchronously, then `vi.waitFor` the entry; assert its `source_url`, `source_type`, and chunk count.
   - **failure suppression:** a results array whose first element has a throwing `snippet` getter; `expect(() => autoIndex(...)).not.toThrow()`; `vi.waitFor` an event matching `/Auto-index error/`; assert `kbStats()` still answers and no other chunks were written.
   - **toggle is per-call, not per-store:** a second `initKb` with `auto_index: true` then a third with `false` proves the guard reads the current config, not a cached value.
2. `src/kb-hardening.test.ts`, extending `describe("KB maintenance interval (REQ-066)")`:
   - **startup removal:** config with `short: { expiry_hours: 1 }` and `keep: { expiry_hours: 0 }`, `maintenance_interval_minutes: 0`; ingest two documents with those explicit tiers; advance system time 2 h; `initKb` again; assert the short-tier document is gone, the keep-tier document remains, and the removal event is recorded.
   - **interval removal:** a fresh store with `maintenance_interval_minutes: 1` and a short tier whose `expiry_hours` is sub-minute (`0.001` ≈ 3.6 s, so the 60 s tick crosses it without a multi-hour clock jump); install fake timers before `initKb`; ingest a document in that tier; `advanceTimersByTime(60_000)`; assert removal without a re-init. Falling back to a multi-hour `expiry_hours` requires advancing the system clock past the expiry *before* the tick, otherwise the tick fires and removes nothing.
   - **tier, not `source_type`:** two documents with the same `source_type` and different tiers, plus two with different `source_type`s and the same tier; advance the clock; assert removal follows the tier in both directions.
   - **indefinite tier:** `expiry_hours: 0` survives the same clock advance and startup re-init.
   - **no error event:** after each removal, `kbStats().events` contains an event matching `/Maintenance at .*: removed \d+ expired chunks/` and no event matches `/error/i`. The timestamp is generated at `src/kb.ts:1118`, so the assertion matches the substring, not a literal.
   - `vi.useRealTimers()` and a clean re-init in `finally` so later suites in the file are unaffected.
3. `src/kb.test.ts`: replace the REQ-065 test body so it reaches all four tiers observably — `initKb` with `default_collection: "config-col"` proves the config tier, `""` proves the literal tier, env and explicit keep their existing assertions, and `finally` re-inits `makeConfig()`.
4. `debate-club/src/kb-auto-index.test.ts`, tagged `// @implements REQ-064`:
   - Start one server whose layer sets `content_policy: { mode: "off" }` and, under `kb`, `storage_path`, `keys_path`, `reports_path`, `auto_index: true`, and `maintenance_interval_minutes: 0`; wait for KB init (the existing 500 ms beat). Pinning the policy mode is required because `fetch_page`'s auto-index branch is gated on `disposition() === "store"` (`src/index.ts:1332`).
   - **search hook:** call `search_web` with `query: "retrieval augmented generation"`, `provider: "wikipedia"`, `max_results: 2`; read the first result URL from the `[OK]` body, poll `manage_kb { action: "get", source_url }` until it returns `[OK]` (bounded, ~3 s), and assert the stored document.
   - **fetch hook:** call `fetch_page` with `url: "https://example.com/doc"`, `renderer: "jina"`; poll `get` for that URL; assert it is stored.
   - **verify hook:** call `verify_claims` with `query: "Does retrieval augmented generation reduce hallucination?"`, `providers: ["wikipedia"]`, `max_iterations: 1`; select the first finding source that carries a `url` (the handler indexes only `sources[0]`, `src/index.ts:1924`, but reading the response defensively keeps the test about the hook, not array order), poll `get`, and assert the stored `source_type` is `corroborate`.
   - Each test asserts the originating tool response is `[OK]`, so an auto-index failure surfacing through the response fails the test.
   - The poll helper is local to the file and has a fixed attempt cap with a clear failure message; no arbitrary sleeps beyond the existing init beat.

**Step 2 — Fail-under-mutation evidence (source mutation, no commit).**

1. B-1: remove the `if (!kbConfig || !kbConfig.auto_index) return;` guard at `src/kb.ts:1046`, run `src/kb-auto-index.test.ts`, record the toggle failure, restore with `git checkout -- src/kb.ts` and confirm `git diff --stat` is empty.
2. B-2: demote the config tier at `src/kb.ts:520` (make `resolveCollection` return the literal `"default"` before consulting `kbConfig.default_collection`), run the REQ-065 test, record the `config-col` failure, then `git checkout -- src/kb.ts` and confirm the diff is empty. The test-fixture change (`default_collection: "config-col"`) is the observation, not the mutation.
3. B-3: comment out `runMaintenance();` at `src/kb.ts:442`, run the REQ-066 describe, record the startup failure, restore; comment out the `setInterval` scheduling at `src/kb.ts:445-447`, record the interval failure, restore; then make the predicate ignore `def.expiry_hours` at `src/kb.ts:1109-1113`, record the tier/indefinite failure, restore with `git checkout -- src/kb.ts`.
4. Record every command, failure line, and the post-restore clean `git status` in `tasks.md`. This is the coupling proof for a tests-only increment; each restore is verified by an empty `git diff --stat` before the next mutation.

**Step 3 — Docs and close.**

1. Mark F-R6-B-1/2/3 `Resolved` in `docs/plans/2026-11-09-full-review-sweep/worklist.md:805-807`, refreshing their stale `src/kb.ts` line citations (`1026-1061`, `1091-1109` → `1038-1074`, `1103-1121`) in the same edit.
2. Retire the roadmap section (25 work items → 24; `## Non-goals` is not a work item).
3. Write `docs/plans/2026-11-10-r6-b-test-evidence/{plan,tasks,aar}.md`; the AAR ends `LOOP PAUSED` and records the `search_web` `collection`-vs-auto-index ambiguity (D-note below) as informational.
4. Run `npm run session:close` (validates loop artifacts, runs `check:fast`, prints cadence; does not commit).

## Verification

| Check | Command | Expected |
|---|---|---|
| Auto-index unit | `npx vitest run src/kb-auto-index.test.ts` | PASS after steps 1.1 |
| Expiry unit | `npx vitest run src/kb-hardening.test.ts` | PASS |
| Collection unit | `npx vitest run src/kb.test.ts` | PASS |
| Arena hooks | `npm run test-debate-club` | PASS (existing 4 files + 1 new) |
| Mutation proof | steps 2.1–2.3 | each named assertion fails; tree restored clean |
| Fast gates | `npm run check:fast` | PASS |
| Full gates | `npm run check` | PASS (22 gates) when Step 0.5's registry probe answers; otherwise recorded under C-2 and `check:fast` is the terminal bar |
| Spec coverage | `npm run validate-spec`, `npm run check-gate-coverage` | PASS (REQ-064/065/066 citations present) |
| Roadmap/loop | `npm run check-roadmap`, `npm run check-loop-artifacts` | PASS (also inside fast) |

## Commit series

1. `test(kb): observe the auto-index toggle, deferral, and failure path` — `src/kb-auto-index.test.ts`. Gate: `npm run typecheck` + the new vitest file.
2. `test(kb): assert startup, interval, and tier-driven expiry` — `src/kb-hardening.test.ts`. Gate: `npm run typecheck` + that file.
3. `test(kb): distinguish the config-default collection tier` — `src/kb.test.ts`. Gate: `npm run typecheck` + that file.
4. `test(kb): drive the three auto-index hook sites over stdio` — `debate-club/src/kb-auto-index.test.ts`. Gate: `npx tsc -p debate-club/tsconfig.json` + `npm run test-debate-club`.
5. `docs(kb): resolve the F-R6-B evidence findings and record the increment` — `ROADMAP.md`, `worklist.md`, the increment record. Gate: `npm run check:fast`, then full `npm run check` on the final tree.

Five commits is the split cap; the grouping is printed here before execution.

## Edge cases and rollback

- The Arena `get` poll can race KB initialization on a slow host: the existing 500 ms init beat plus a capped retry loop (not a single sleep) covers it; the failure message names the missing URL.
- Fake timers can leak into the next test: every expiry test restores real timers and re-inits a clean store in `finally`; the file already shares `base` and runs sequentially.
- A `default_collection: ""` in `src/kb.test.ts` is legal for `KbConfig` but would be rejected by config validation in production; the test calls `initKb` directly, and the literal-tier assertion documents that the fallback exists. If a future validation change makes `""` illegal, the assertion moves to a typed cast with a comment.
- If a hook test shows `search_web` auto-indexing into the config default rather than the caller's `collection` (schema says `collection` scopes recall only), that is out of scope: the test passes no `collection` parameter and does not pin the scoped case. The observation is recorded in the AAR as informational; REQ-065's "most specific specifier" reading for auto-indexing is a separate question.
- If `vi.useFakeTimers` conflicts with `node:sqlite`, Step 0.3's fallback (0.001-minute interval plus a bounded poll) is used and recorded.
- Rollback: revert the five commits; no persisted state, config, or schema is touched.

## Out of scope

- Any production behavior change; the findings are evidence gaps (D6).
- The config-layer "invalid KB block" contradiction (F-R6-B-4), dedup/report remediation (F-R6-B-5/B-6), and the other R6 sections.
- Whether `search_web`'s `collection` parameter should scope its auto-index target (recorded as informational, not tested).
- Migration or reclassification of content already stored by the shipped `auto_index: true` default.

## Evidence

- `npm run check:fast` PASS at `f4ce094` (this session, 20.2 s, 19 gates); `git status --porcelain` empty.
- `npm run status` → 2026.11.7, 25 open roadmap items, 35 unpushed, last pipeline 2026-11-07.
- Lines cited above read this session: `src/kb.ts:442,446,513-521,1038-1074,1103-1121`; `src/index.ts:586,588,1333,1926`; `src/deep-search.test.ts:103-116`; `src/kb.test.ts:237-250`; `src/kb-hardening.test.ts:46-52`; `debate-club/src/client.ts:59-86`; `debate-club/src/mcp-contract.test.ts:117-127,219-227,291-303`; `infobroker.md` REQ-064/065/066 bodies; `config.json:398-416`.
- Worklist rows F-R6-B-1/2/3 read at `docs/plans/2026-11-09-full-review-sweep/worklist.md:805-807` and the register rows at `:372-374`.
- Preflight sidecar: generated after the plan is stamped.
