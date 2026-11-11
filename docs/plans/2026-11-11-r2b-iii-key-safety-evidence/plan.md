# Plan — R2b-iii key-safety evidence

**Status:** draft 2026-11-11 (revision 1b) · **Depth:** light (self pass; cold pass out of depth)
**Roadmap item:** `ROADMAP.md` § R2b-iii key-safety evidence (`:17-21`)
**Predecessor:** `dc09b73` (`docs(roadmap): record the R2c-ii close`)
**Change sizing:** S (one new spawned test, one helper extension) · **Rollback cost:** 0 (test- and docs-only)
**Review independence:** self. Depth is light: one surface (key-safety evidence), rollback 0, no external state.

## Why this item

§ R2b-iii is the first unscheduled roadmap section, and its trigger is
satisfied. The R2c status surface shipped (R2c-i `fca73ea`/`48ae564`;
R2c-ii `c27a681`/`dc09b73`), and the key-pool row shape it coordinates is
settled by F-R2-9's resolution and `keyPoolRow` (`src/provider-status.ts:83-90`).
§ R2b-iii is the last R2b carry-over: R2b-i resolved F-R2-3, and R2c-ii's AAR
left F-R2-7 here. It is a P2 evidence item, so the repository's fix policy
(worklist D1: P2 fixed only on a demonstrated failure) makes this a test-only
increment unless a case is red.

## Findings in scope

| Finding | Severity | Disposition target |
|---|---|---|
| F-R2-7 | P2 | `Resolved` — the missing-key, optional-key, and no-leak clauses are asserted through a spawned server, not only at the manifest/unit level |

## Predicates re-verified this session (`dc09b73`)

- **P1 (what exists today).** Unit-level coverage exists: optional-key
  compatibility (`src/config.test.ts:899`), credential classification
  (`src/provider-status.test.ts:109-130`), pool identity and no-material state
  (`src/key-pool.test.ts`, `src/key-pool.ts:130-140`), and error redaction
  (`src/lib/sanitize-error.test.ts:18-21`). The only REQ-011-cited test is
  `src/server-manifest.test.ts:51-62`, which asserts `server.json` env-var
  *names*. No spawned test asserts the missing-key, optional-key, or no-leak
  clauses end-to-end.
- **P2 (missing-key row).** The classification path is
  `classifyCredential` returning `absent` for a required `auth_env` with no
  key (`src/config.ts:1121-1124`), `assessProvider` returning `inactive` +
  `no_api_key` (`src/provider-status.ts:64-69`), and `doListProviders`
  emitting `inactive_reason` (`src/index.ts:1467-1492`). The health action
  uses the same assessment and skips the probe when `isOperational` is false
  (`src/index.ts:1517-1527`). The shipped `core` entry exercises this path,
  but it cannot be *enabled* in a hermetic config: `core` is `free_http`, so
  `startupHealthCheck` (`src/index.ts:162-198`) skips it only for the
  `keyed_http` tier and would call `core.health()`, which fetches the live
  CORE API (`src/providers/core.ts:52-66`). The spawned test therefore uses a
  loopback `generic_http` provider with a required `auth_env` and no key —
  the same classification path, with no external request (Amendment 1b).
- **P3 (optional-key row).** The same reasoning applies to
  `semantic_scholar` (optional key, `free_http`,
  `src/providers/semantic_scholar.ts:64-74`): enabling it would make a live
  startup probe. A loopback `generic_http` provider with `auth_optional: true`
  and no key exercises the identical classification (`optional-absent` →
  `isOperational` true → `active`).
- **P4 (key material surfaces).** Keys come from the environment only
  (`getEnvVar`, `src/config.ts:1093`; `poolKeysForEnv`,
  `src/key-pool.ts:167-171`). Persisted pool state stores FNV ids, not key
  material (`src/key-pool.ts:130-140`). Error messages pass through
  `sanitizeErrorMessage` (`src/error-envelope.ts:7-25`), but `err()`
  sanitizes only `message` — `remediation` and `details` are not scrubbed — so
  the test scans the whole response text. The audit log records event + detail
  with no credential field (`src/audit-log.ts:34-53`); the call log records a
  sanitized name, outcome, and elapsed time (`src/call-log.ts:1-8`, `:46-49`).
- **P5 (harness).** `src/provider-health-action.test.ts` spawns
  `src/index.ts` through `tsx` over stdio with a hermetic config;
  `src/lib/stub-provider.ts` starts a loopback HTTP stub and
  `writeHermeticConfig` enables only `searxng`/`native_fetch` and pins every
  dispatch chain to searxng. A keyed loopback provider is feasible: config
  validation accepts a `generic_http` entry with `endpoint`, `query_param`,
  and search capabilities (`src/config.ts:456-476`, `:569-576`), and
  `src/providers/index.ts:74-78` builds it from config. A 401 is
  non-retryable, and with every chain pinned to the stub no external request is
  possible. `createGenericProvider`'s `health()` probes the endpoint (or
  `health_endpoint`) with the same credential, so the stub serves the startup
  health check too.
- **P6 (registers).** `ROADMAP.md` § R2b-iii (`:17-21`); worklist verdict
  row 147 (REQ-011 predicate) and register row 623 (F-R2-7 disposition). No
  `DECISIONS.md`, `README.md`, or `CHANGELOG.md` text depends on F-R2-7
  (grep this session).
- **P7 (spec).** REQ-011 already states all three clauses
  (`infobroker.md:217-221`); no REQ body change is planned. Appendix B limits
  therefore do not apply.

## Done bar

**Done bar:** every clause holds on the final tree, with the evidence named below.

- **DB-1 (missing key, F-R2-7).** In a spawned server with every
  `INFOBROKER_*_API_KEY`/`_API_KEYS` variable absent from the child
  environment, `inspect_providers action=list` reports a loopback generic
  provider with a required `auth_env` as `inactive` with
  `inactive_reason: "no_api_key"`, and `action=health` for the same provider
  reports the same status and reason with `auth_ok: false`. Evidence:
  `src/key-safety-action.test.ts`. Red before: no spawned test asserts this
  row (P1) — the assertion is new evidence, not a demonstrated failure.
- **DB-2 (optional key).** Under the same environment, a loopback generic
  provider with `auth_optional: true` is reported by `action=list` as
  `active` with no `inactive_reason`, proving a missing optional key does
  not disable the provider. Evidence: same test file.
- **DB-3 (exhausted pool row, coordinated shape).** With a two-key pool whose
  keys both receive 401 from the loopback stub, two `search_web` calls pinned
  to that provider (one per key, each yielding `[ERROR]`) leave both keys
  rejected; a following `action=list` reports the provider `inactive` +
  `credentials_unavailable` with a `key_pool` row of
  `{index, available: false, reason: "rejected"}` entries — the F-R2-9 row
  shape — and no key material. Evidence: same test file.
- **DB-4 (no-leak sweep).** A distinctive sentinel credential is set in the
  child environment, with `output.call_log = "file"`,
  `call_log_path`, and `audit_log_path` under the temp root. The spawned
  server is driven through a successful keyed search, a failing (401) keyed
  search, `list`, `spec`, and `health`. The sentinel appears in none of:
  (a) any tool response text, including error `remediation`/`details`;
  (b) the audit log file; (c) the call-log file; (d) the isolated shipped
  config, the local layer, or the key-pool state file. The key-pool state file
  contains a short non-reversible hex id instead. Evidence: same test file.
- **DB-5 (bookkeeping).** Worklist row 147 cites the new test as the REQ-011
  evidence and row 623 records F-R2-7 `**Resolved 2026-11-11**`; `ROADMAP.md`
  § R2b-iii is removed. `check-roadmap`, `check-non-goals`, and
  `check-loop-artifacts` pass.
- **DB-6 (gates).** `npm run typecheck`, the targeted vitest file,
  `npm run check-gate-coverage`, `npm run validate-spec`, and `npm run check`
  exit 0 on the tree that ships.

## Non-closure rule

The increment stops and the AAR ends `LOOP OPEN` when a clause is red for a
reason other than the single named fallback: a leak demonstrated inside
`sanitizeErrorMessage` may be repaired in that module (plus its test) as its
own commit with a CHANGELOG entry; a demonstrated leak or a missing-key/
optional-key defect anywhere else returns to § R2b-iii as a new finding with
the evidence. No other production file, `config.json`, fixture, or spec edit
is permitted.

## Blast radius

**Tests (2 files, 1 new).**
- `src/key-safety-action.test.ts` — **new**, M: the spawned key-safety suite,
  header citing `REQ-011` clause tags and `REQ-104`.
- `src/lib/stub-provider.ts` — S: optional loopback `generic_http` provider
  entries (required-key and optional-key) in `writeHermeticConfig`, credential
  environment scrubbing, a stub mode that echoes the presented credential in a
  401 body, and `output.call_log = "file"` with `call_log_path`/
  `audit_log_path` under the temp root.

**Bookkeeping (3 paths).** `ROADMAP.md`, `docs/plans/2026-11-09-full-review-sweep/worklist.md`,
and this increment directory.

**Checked, not edited.** `src/server-manifest.test.ts`, `src/config.test.ts`,
`src/provider-status.test.ts`, `src/key-pool.test.ts`,
`src/lib/sanitize-error.test.ts`, `src/provider-health-action.test.ts`,
`config.json`, `infobroker.md`, `README.md`, `CHANGELOG.md`, `DECISIONS.md`.

## Phases and steps

### Phase 0 — Discovery and frozen observations (no edits)

1. Re-confirm P1-P7; a mismatch stops the increment.
2. Delete every `INFOBROKER_*_API_KEY`/`_API_KEYS` variable from the spawned
   child environment and assert the sentinel is not inherited.
3. Record the pre-change matrix in `tasks.md`: `core` list/health rows,
   `semantic_scholar` list row, and the sentinel sweep, each marked red or
   regression-evidence with the reason (C-1).
4. Confirm the keyed `generic_http` entry passes `validateConfig` and that
   the spawned server reaches only the loopback stub (startup health included).
5. Register probe: worklist rows 147 and 623; `ROADMAP.md:17-21`.
6. Confirm `docs/plans/<dir>` is trackable (`git check-ignore` exits 1).

### Phase 1 — Evidence

1. Extend `src/lib/stub-provider.ts` with the keyed generic provider, the
   401-echo mode, and the file log paths; keep the existing searxng path
   unchanged.
2. Write `src/key-safety-action.test.ts` covering DB-1 through DB-4, with
   `// @implements REQ-011 missing-key REQ-011 optional-key REQ-011 no-leak`
   and a `REQ-104 pool-state` tag on the state-file assertion.
3. Record every result in `tasks.md` with its red/green classification.

### Phase 2 — Fix (only on a red case)

No production edit is expected. If a red case appears, apply the non-closure
rule and record the outcome.

### Phase 3 — Verification and documentation

1. Targeted test, then `npm run typecheck`, `npm run check-gate-coverage`,
   `npm run validate-spec`.
2. `docs/plans/2026-11-09-full-review-sweep/worklist.md`: row 147 names the
   new test; row 623 `**Resolved 2026-11-11**` with a one-line summary.
3. `ROADMAP.md`: retire § R2b-iii; `npm run check-roadmap` and
   `npm run check-non-goals`.
4. `aar.md` with the DB-to-evidence table and the LOOP token; `tasks.md`
   fully ticked.
5. Final `npm run check` and `npm run check-loop-artifacts`.

### Phase 4 — Commit series

1. **Tests.** `src/key-safety-action.test.ts`, `src/lib/stub-provider.ts`.
   Gate: `npm run typecheck`, targeted vitest,
   `npm run check-gate-coverage`.
2. **Bookkeeping.** `ROADMAP.md`, the worklist, this increment directory.
   Gate: `npm run check` on the tree to ship.

## Conditions

- **C-1** Pre-fix results are recorded as observed; a green case is kept as
  regression evidence with its reason.
- **C-2** The spawned tests are hermetic: every dispatch chain is pinned to the
  keyed loopback stub or searxng, every provider without a loopback target is
  disabled, and no external request is possible (startup health included).
- **C-3** The sentinel credential is test-local, is supplied only to the child,
  and is asserted absent from outputs, logs, and state (DB-4).
- **C-4** No production behavior change unless the non-closure fallback fires.
- **C-5** Clause tags are part of the deliverable (DB-1/DB-4), alongside the
  existing `@implements REQ-011` in `src/server-manifest.test.ts`.
- **C-6** No `config.json` value, fixture, spec body, or other tool changes.
- **C-7** Trust boundary: every premise is `repo`-sourced; stub responses are
  test-authored.

## Decisions

- **D-1 — evidence-only.** No proactive redaction layer is added; no leak is
  demonstrated and `sanitizeErrorMessage` already covers echoes. *Rejected:*
  broad refactoring of the error path.
- **D-2 — spawned end-to-end, not only unit.** F-R2-7 is precisely that the
  citation is manifest/unit-only; only a spawned server exercises the response
  and state surfaces. *Rejected:* another unit test.
- **D-3 — a loopback `generic_http` stub, not a shipped keyed provider.**
  `exa`/`tavily`/`yep` hardcode live endpoints and have no URL override, so
  enabling one would make a real request. *Rejected:* live-provider probing.
- **D-4 — `list` for the missing/optional rows, `health` for the keyed stub.**
  `list` is probe-free and deterministic; `health` deliberately exercises the
  probe path. *Rejected:* `health` for every row (adds network-shaped latency).
- **D-5 — no CHANGELOG entry.** No behavior changes; the repository's rule ties
  CHANGELOG entries to behavior. *Rejected:* a process-only entry.
- **D-6 — the § R2b-iii trigger is read as the key-pool row shape.** That shape
  is settled by F-R2-9 and `keyPoolRow`; the open R8 items (F-R8-F-1/F-2)
  assert directory ownership and creation, a different surface, so they are not
  a dependency. *Rejected:* waiting for the R8 state-hardening item.

## Amendment 1b (execution-time delta)

Phase 0 invalidated one assumption in revision 1a: DB-1/DB-2 named the shipped
`core` and `semantic_scholar` providers, but both are `free_http` and
`startupHealthCheck` probes them even when a key is absent
(`src/index.ts:162-198`; `src/providers/core.ts:52-66`,
`src/providers/semantic_scholar.ts:64-74`), which would make a live request and
violate C-2/C-3. Revision 1b substitutes two loopback `generic_http` providers
with the identical credential classifications (required-absent and
optional-absent). No other clause changes. Self-reviewed as a delta: the
substitution keeps the same assertions, surfaces, and blast radius, and closes
the determinism gap rather than widening scope.

## Verification summary

| Clause | Evidence |
|---|---|
| DB-1 | `src/key-safety-action.test.ts` missing-key list/health case |
| DB-2 | `src/key-safety-action.test.ts` optional-key case |
| DB-3 | `src/key-safety-action.test.ts` exhausted-pool case (two 401 keys) |
| DB-4 | `src/key-safety-action.test.ts` sentinel sweep over responses, logs, config, and state |
| DB-5 | `ROADMAP.md` and worklist diffs; `check-roadmap`, `check-non-goals`, `check-loop-artifacts` |
| DB-6 | `npm run check` output recorded in the AAR |

## Self-review dispositions

| Check | Result |
|---|---|
| §1 full plan / success criteria | Pass — every phase names files, and DB-1–DB-6 are the done bar |
| §2 scope / blast-radius completeness | Pass — every file named in a step appears in § Blast radius |
| §2 assumption ("no behavior change") | Flagged as assumption, confirmed in Phase 0 |
| §2 sibling-contract check | Pass — REQ-104 shares the no-surface clauses; the test tags the pool-state assertion and changes no contract |
| §2 register coupling | Pass — both cross-referencing worklist rows and the roadmap section are named |
| §3 asset audit | Pass — new test path free; helper and predecessor commit exist |
| §4 dependency order | Pass — helper before test; evidence before bookkeeping |
| §5 edge cases / rollback | Pass — test/docs only, rollback 0; non-closure rule bounds a red case |
| §6 verification | Pass — DB-3's two-call sequence is explicit; call-log mode is pinned |
| §7 user impact | Pass — no runtime, config, or client-visible change |
| §8 adversarial | Self pass only (light depth) |