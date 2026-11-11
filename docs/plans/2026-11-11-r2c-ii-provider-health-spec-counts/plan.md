# Plan — R2c-ii provider health and spec counts

**Status:** draft 2026-11-11 (revision 2a) · **Depth:** standard
**Roadmap item:** `ROADMAP.md` § R2c-ii provider health and spec counts
(`:23-28`)
**Predecessor:** `48ae564` (`docs(roadmap): record the R2c status-surface close
and split R2c-ii`)
**Change sizing:** S (two new small modules) + M (`src/index.ts` health and spec
actions) · **Rollback cost:** 1 (reversible edit; one additive response field)
**Review independence:** cold pass **complete and FAILED** on revision 1 —
2 blockers, 2 majors, 5 minors, 3 nits, report at `review/cold-820c843.md`; the diff re-review is
`review/rereview-2da8c30.md` (one new clarity blocker) and the clarity-stage
re-audit that cleared it is `review/clarify-2a.md`. Revision 2a fixes every
blocker and major, all minors, and all nits; see § Review dispositions.

## Review dispositions

| Finding | Disposition |
|---|---|
| B1 stub provider disabled in shipped config | Fixed — P5, Phase 0 step 3, and the new C-7 require an isolated config copy with `searxng.enabled = true`; the URL variable alone is explicitly documented as insufficient (`config.json:221`) |
| B2 a failing stub search falls through to live providers | Fixed — C-7 pins every dispatch chain to `["searxng"]` and disables every other provider in the isolated copy, so the hedge has no second candidate; the failure leg uses HTTP 404 (non-retryable, `src/retry.ts:66-68`) |
| M1 `native_fetch` flip | **Refuted with evidence** — a spawned probe this session shows `native_fetch` health already reports `active`, `auth_ok: true` (no probe target, no credential); the plan now pins that row in DB-1 so the behavior is asserted rather than assumed |
| M2 `exhausted` precedence and reason field | Fixed — DB-1 states the quota-first precedence; DB-8/C-6 scope `inactive_reason` to reports with a stated cause (`disabled`, `exhausted`) |
| N1 (re-review) `inactive_reason` presence contradiction | Fixed — DB-8 now scopes the field to a *stated cause*: present for `disabled` and `exhausted`, absent when the cause is the probe result or a probe-driven `degraded` |
| N2/N3/N4 (re-review) | Fixed — header says revision 2; Phase 4 says seven production files; DB-1 defines eligibility as `isOperational` **and** a registered probe target |
| m1 test-file count | Fixed — six test files, four new |
| m2 unpinned N in DB-3 | Fixed — phase A is two `list` calls then `spec` → 2; phase B adds one stub-backed `search_web` then `spec` → 3 |
| m3 wrong throw anchor, retry behavior | Fixed — seam moved to `src/providers/searxng.ts:24`, and the 404 leg is chosen because 5xx/429/timeouts are the retried class |
| m4 `ProviderAssessment.operational` | Fixed — the field is dropped; `isOperational` is the only representation |
| m5 duplicated truth table | Fixed — `isOperational` moves into `src/config.ts`, and `providerUsable` delegates to it, so there is one truth table |
| Nit worklist path | Fixed — full path named |
| Nit CHANGELOG placeholder | Fixed — the exact current heading is named |
| Nit debate-club anchor | Fixed — `:422-429` |


## Why this item

§ R2b-iii sorts first but is a P2 evidence item; § R2c-ii is the immediate
successor of R2c-i (`fca73ea` source, `48ae564` close) and holds two P1s
(F-R2-22, F-R2-24) and
one P2 (F-R2-23). Its trigger ("start after R2c-i ships") was satisfied by the
predecessor's closing commit, and the R2c-i AAR hands three things to this
increment: the deferred findings, the health-action probe wiring (R2c-i's
DB-3 deliberately stopped at the assessment boundary), and the reasoning that
`assessProvider` would receive a `probeStatus` from this action.

## Findings in scope

| Finding | Severity | Disposition target |
|---|---|---|
| F-R2-22 | P1 | `Resolved` — the probe gate gets an explicit reason and a test; the "can report active" half was already closed by R2c-i's `authOk` gate |
| F-R2-23 | P2 | `Resolved` — history extracted, unit-asserted, and driven end-to-end through a deterministic stub provider |
| F-R2-24 | P1 | `Resolved` — `total_requests_served` counts server tool requests |
| R2c-i DB-3 deferral | — | `Resolved` — REQ-013's assessment legs are observed through the health action, not only at the assessment boundary |

## Predicates re-verified this session (`48ae564`)

- **P1 (F-R2-22).** `doProviderHealth` (`src/index.ts:1507-1579`) computes
  `authOk = providerUsable(...)` (`:1517`), sets `status = authOk ? "active" :
  "inactive"` (`:1518`), and gates the probe on `registeredProvider && authOk`
  (`:1522`). A provider with `enabled: false` is therefore **not probed** today,
  so the finding's original "can report active" symptom is already gone (R2c-i
  P6 said the same). What remains unresolvable from the response is *why*: the
  health report has no reason field (`HealthReport`, `src/types.ts:202-216`), so
  a disabled provider and an unreachable one return the same `inactive` row.
  No test names a disabled provider at the health action.
- **P2 (F-R2-23).** Operational history is two module-level maps
  (`src/index.ts:81-82`): written on search success (`:529`), search failure
  paths (`:538`, `:546`, `:555`), fetch success (`:885`), fetch failure
  (`:897`), and the probe catch (`:1534`); read only in `doProviderHealth`
  (`:1564-1569`). There is no reset seam, so no unit test can drive it, and no
  spawned test exists. Every shipped `health()` swallows its own error and
  returns `active`/`degraded`/`inactive` (`src/providers/searxng.ts:41-55`,
  `arxiv.ts:65-77`, `duckduckgo.ts:92-104`, `generic-http.ts:153-170`), so the
  `:1534` probe catch is effectively unreachable; history is populated by
  search/fetch traffic, not by the probe.
- **P3 (F-R2-24).** `total_requests_served: latency.total()` (`src/index.ts:1623`)
  reads `createLatencyTracker`'s `totalRequests`, which increments per provider
  *sample* (`src/latency.ts:23-25`, `:42-44`). Tool invocations are counted
  separately and cumulatively per tool in `toolMetrics.record`
  (`src/tool-metrics.ts:31-37`), and the snapshot is reported alongside
  (`:1624`), but the two are never reconciled into the served-request count.
  `instrumentTool` (`src/index.ts:1682-1698`) wraps all seven tools and records
  **after** the handler returns, so a response never counts itself.
- **P4 (R2c-i deferral).** The health action has a second, hand-rolled status
  derivation (`:1517-1549`) that never calls `assessProvider`, although
  `assessProvider` already accepts an optional `probeStatus`
  (`src/provider-status.ts:20-46`) and R2c-i's D2 states the health action is
  the intended supplier. `providerStatusInput` (`src/index.ts:1423-1436`) builds
  the shared input for the list and spec actions only.
- **P5 (determinism of the end-to-end evidence).** SearXNG is
  `self_hosted_http` with `url_env: INFOBROKER_SEARXNG_URL` (`config.json:220`)
  but ships `enabled: false` (`config.json:221`), so the URL variable alone
  proves nothing. A hermetic test therefore writes an isolated config copy
  (`src/lib/test-isolation.ts:28-37` already writes a mutable copy) that
  (a) sets `searxng.enabled = true`, (b) sets every `dispatch` chain to
  `["searxng"]`, and (c) disables every other provider, so the fallback chain
  (`src/index.ts:432-434`) and the hedge (`:466-469`) have no live candidate.
  The stub then yields deterministic traffic with no external request: HTTP 200
  with one result → `search()` succeeds and `health()` reports `active`; HTTP
  404 → `search()` throws a non-retryable `RetryableError`
  (`src/providers/searxng.ts:24`, `src/retry.ts:66-68`) and `health()` reports
  `degraded`; a closed loopback port → `health()` reports `inactive`.
  `searxng.search()` parses `{results: []}`; the stub returns one result so the
  "empty result set" branch (`src/index.ts:538`) does not fire. A 5xx or 429
  leg is deliberately not used: those are the retried class (`src/retry.ts:62-71`).
- **P6 (surface pins).** No fixture or test pins `total_requests_served`,
  `last_success`, or `last_error` (`grep -rn` across `src/`, `test-fixtures/`,
  `debate-club/` is empty apart from the producer and the type).
  `debate-club/src/mcp-contract.test.ts:422-429` accepts any of the three health
  statuses and `:389-421` checks spec counts and token footprint only.
  `envelopeOutputSchema` is `z.looseObject` (`src/output-schema.ts:10`), so an
  added health field needs no schema change.
- **P7 (spec limits).** REQ-024b is 254 characters, one sentence, one SHALL;
  REQ-024c is 473 characters, two sentences, three SHALLs (measured this
  session). `detectClauseRequirements` (`src/clause-coverage.ts:23-35`) counts
  parenthesized "or" enumerations and "when … declares" conditionals; the
  amendments add neither, so this plan's named tags are voluntary but required
  by C-5 because R9 (`F-R9-A-1`) is moving the guard toward per-branch tags.
- **P8 (decisions).** `DECISIONS.md` highest ID is `D-102`; this increment
  allocates `D-103`–`D-105`.

## Done bar

**Done bar:** every clause below holds on the final tree, each with the evidence named in § Verification summary.

- **DB-1 (F-R2-22)** `inspect_providers action=health` never probes a provider
  whose `enabled` is false, and reports it `inactive` with
  `inactive_reason: "disabled"` instead of an unlabelled inactive row. Quota
  precedence is unchanged and named: an exhausted quota still reports
  `exhausted` (with `inactive_reason: "exhausted"`) even for a disabled
  provider, and the disabled case is asserted with quota remaining. Probe
  eligibility is `isOperational` (exported from `src/config.ts` beside the
  truth table, used by `providerUsable`, `assessProvider`, and the health
  action) **and** a registered probe target — one decision, two named terms,
  with no second truth table. `native_fetch` keeps its current health row — `active` with
  `auth_ok: true`, no probe target, no reason — pinned by an assertion so the
  rewire cannot change it silently (a spawned probe this session confirmed the
  current row). Evidence: a spawned test against an isolated config with
  `wikipedia.enabled = false` (returns `inactive` + `disabled`), the
  `native_fetch` row assertion, a unit case proving
  `assessProvider({enabled: false, probeStatus: "active"})` stays `inactive`
  and `isOperational` is false, and a case proving an enabled but unreachable
  provider stays `inactive` **without** a reason (a probe result is its own
  explanation). Red before: the health report carries no reason field at all,
  so the spawned assertion is an observed failure; the `native_fetch` and
  unreachable cases are green-before regression evidence (C-1).
- **DB-2 (F-R2-23)** REQ-024b's "timestamps of the most recent error and
  success" are asserted at two levels. Unit: `src/provider-history.ts` records
  and reads success/error per slug, exposes a reset seam, and the report builder
  emits `last_error`/`last_success` as ISO timestamps and omits them when
  absent. End-to-end: a spawned server on the hermetic config of C-7 records
  `last_success` after a successful stub-backed `search_web` and `last_error`
  after a 404 stub-backed one, and both appear on a subsequent health call. The
  probe does not overwrite `last_success` (the existing comment at `:1531`
  becomes an assertion). REQ-024b is amended to say "since server start", which
  is what the implementation does (D-3). Red before: the end-to-end assertions
  are new evidence, not observed failures — the producers already work; the
  defect is that nothing observed them (C-1).
- **DB-3 (F-R2-24)** `total_requests_served` is the cumulative count of tool
  requests the server has handled, including failed ones. Evidence: a spawned
  test on the hermetic config runs **phase A** — two
  `inspect_providers action=list` calls, then one `spec` call — and asserts the
  spec response reports exactly `2`. **Phase B** adds one stub-backed
  `search_web` (which records exactly one provider sample) and then another
  `spec` call, and asserts `3`: provider traffic moved the sample count without
  moving the served-request count beyond the tool calls made. The spec call
  excludes itself because instrumentation records after the handler returns.
  Unit: `toolMetrics.totalCalls()` counts every recorded call across tools and
  is unaffected by provider latency samples. Red before: phase A reports `0`
  (provider samples), not `2` — observed this session.
- **DB-4 (R2c-i deferral)** On the hermetic config of C-7 the health action
  drives a real probe into the assessment for all three observable legs: stub
  HTTP 200 → `active`, stub HTTP 404 → `degraded`, closed loopback port →
  `inactive`. The report is produced by
  `assessProvider`, the same derivation as the list and spec actions, so the
  health action can no longer disagree with them. Two existing behaviors are
  preserved verbatim and asserted: the REQ-036 latency precedence (`latency.avg`
  history wins over the probe's own measurement, falling back to the probe) and
  `auth_ok`, which stays `providerUsable` (credential usability, not
  operational-ness). Clause tags `REQ-013 provider-probe-active`,
  `REQ-013 provider-probe-degraded`, and `REQ-013 provider-probe-inactive` sit
  on the spawned test. Recorded honestly: the `degraded` leg comes from a
  non-2xx probe, which is a provider-reported status, not a latency sample; the
  latency-threshold leg stays unit-level as R2c-i left it.
- **DB-5 (spec)** REQ-024b gains the disabled-provider clause and the
  "since server start" scoping; REQ-024c says "the cumulative count of tool
  requests the server has handled since server start". Both bodies are measured
  against Appendix B before and after (≤800 characters, ≤8 sentences, ≤8 SHALL
  clauses, ≤5 backtick tokens outside the signature exception).
  `npm run validate-spec` and `npm run check-gate-coverage` pass with the tags
  in the same commit.
- **DB-6 (bookkeeping)** `ROADMAP.md` § R2c-ii is removed (all three findings
  resolved); `docs/plans/2026-11-09-full-review-sweep/worklist.md` rows 638,
  639, and 640 move to `**Resolved 2026-11-11**` with refreshed anchors and
  summary rows 169/170 are corrected; `CHANGELOG.md` gains one entry under the
  current `## 2026.11.7 — R2a review: credential pools and dispatch-state
  filtering` section (the release step retitles it); `DECISIONS.md` gains
  D-103, D-104, D-105; `README.md` changes only if a claim contradicts the new
  behavior (P6 says it does not; the audit is recorded either way).
  `check-roadmap`, `check-non-goals`, `validate-readme`, and
  `check-loop-artifacts` pass.
- **DB-7 (gates)** `npm run typecheck`, `npm run validate-spec`,
  `npm run check-intent-citations`, `npm run check-gate-coverage`, and
  `npm run check` exit 0 on the tree that ships.
- **DB-8 (blast radius)** No other tool changes, no `config.json` value, no
  fixture, no key-pool or quota state format, and no new tool parameter. The
  list action is untouched. The health report changes exactly as DB-1, DB-2,
  and DB-4 specify — one additive field, `inactive_reason`, present only where
  the assessment states a cause (`disabled`, `exhausted`) and absent when the
  cause is the probe result itself (`inactive` after a failed probe, or
  `degraded`) — and the spec action changes exactly `total_requests_served`. Audited by `git diff --stat` plus
  `git status --porcelain` against § Blast radius before any bookkeeping edit.

## Non-closure rule

The increment stops, the AAR ends `LOOP OPEN`, and the surviving item returns
to § R2c-ii if it needs: a change to `providerUsable` or `classifyCredential`,
a `config.json` or fixture edit, a new tool parameter, an edit to the list
action, a persisted history format, or any production edit outside the files
named in § Blast radius.

## Blast radius

**Production (7 files, 2 of them new).**
- `src/config.ts` — S: `isOperational(enabled, urlPresent, credential)` exported
  beside the truth table; `providerUsable` delegates to it (one truth table).
- `src/provider-status.ts` — S: import `isOperational` for `assessProvider`'s
  `operational` leg; no new exported field.
- `src/provider-health.ts` — **new**, S: `assembleHealthReport` — the pure
  report builder over `{assessment, quota, avgLatencyMs, history, cooldown}`;
  header carries `// @implements REQ-024b`.
- `src/provider-history.ts` — **new**, S: process-scoped success/error record,
  reads, and `resetProviderHistoryForTests`; header carries
  `// @implements REQ-024b`.
- `src/index.ts` — M: history maps removed in favour of the module, writes at
  `:529`, `:538`, `:546`, `:555`, `:885`, `:897` routed through it;
  `doProviderHealth` rewired (no-probe branch, `assessProvider` with
  `probeStatus`, report via `assembleHealthReport`); `providerStatusInput` gains
  an optional `probeStatus`; `doSpecHealth` reports
  `toolMetrics.totalCalls()`.
- `src/tool-metrics.ts` — S: `totalCalls()` added.
- `src/types.ts` — S: `HealthReport.inactive_reason?`.

**Spec (1 file, two REQs).** `infobroker.md` — REQ-024b and REQ-024c.

**Tests (6 files, 4 of them new).** `src/provider-health.test.ts` (new; DB-2
unit, DB-4 builder), `src/provider-history.test.ts` (new; DB-2 unit),
`src/provider-health-action.test.ts` (new, spawned; DB-1, DB-3, DB-4),
`src/lib/stub-provider.ts` (new local HTTP stub helper and hermetic-config
helper), `src/tool-metrics.test.ts` (DB-3 unit), `src/provider-status.test.ts`
(DB-1 operational cases).

**Documentation and bookkeeping (6 paths).** `ROADMAP.md`, `DECISIONS.md`,
`CHANGELOG.md`, `README.md` (only if needed),
`docs/plans/2026-11-09-full-review-sweep/worklist.md`, and this increment
directory.

**Checked, not edited.** `debate-club/src/mcp-contract.test.ts:389-429`
(health status set and spec field presence must stay true), `src/tool-surface.test.ts`,
`src/intent-citations.test.ts`, `src/structured-output.test.ts`,
`src/provider-list.test.ts`, `src/health-status.test.ts`.

**Out of scope.** `last_spec_review` stays boot time (REQ-024c does not require
it; the worklist cell notes it as observation only, no register finding);
provider-history persistence; `spec` action's other fields; every other tool.

## Phases and steps

### Phase 0 — Discovery and frozen observations (no edits)

1. Re-confirm P1-P8; a mismatch stops the increment rather than moving the
   plan.
2. Record the pre-change matrix in `tasks.md`: disabled-provider health row,
   `total_requests_served` after two known tool calls, and the REQ-013 legs
   through the stub. Mark each case red or regression-evidence, with the
   reason (C-1).
3. Confirm the hermetic config is feasible (C-7): `node:http` server on
   `127.0.0.1:0`; an isolated config copy with `searxng.enabled = true`, every
   `dispatch` chain pinned to `["searxng"]`, and every other provider disabled;
   `INFOBROKER_SEARXNG_URL` pointed at the stub and deleted from the test's own
   env; a bind-then-close socket for the provably closed port. A denied
   loopback listen stops the increment rather than downgrading DB-4.
4. Surface probe (names every file): the new test files carry their
   `// @implements` citations for `check-gate-coverage` and
   `check-intent-citations`; confirm `src/tool-surface.test.ts`,
   `src/structured-output.test.ts`, and `debate-club/src/mcp-contract.test.ts`
   do not pin the health report's field set (P6 says they do not; re-confirm).
   Record the current `native_fetch` health row from a spawned call as the DB-1
   pin.
5. Sibling-REQ sweep: every REQ citing REQ-024b/REQ-024c, the README passages at
   `:287-292` and `:389-393`, and `skills/infobroker/**` — a contradicting claim
   stops the increment.
6. Measure REQ-024b and REQ-024c bodies before the amend; count the amended
   wording against Appendix B.
7. Confirm `DECISIONS.md` highest ID is `D-102`.
8. Confirm `docs/plans/<dir>` is trackable (`git check-ignore` exits 1).

### Phase 1 — Additive modules and failing evidence

1. `src/provider-history.ts` created with the record/read/reset API;
   `src/index.ts` writes routed through it. Behavior unchanged; suite green.
2. `src/provider-health.ts` created with `assembleHealthReport`; `doProviderHealth`
   calls it. Behavior unchanged; suite green.
3. `src/config.ts`: `isOperational` added and `providerUsable` delegating to it
   (D-5); `src/provider-status.ts` imports it; `src/tool-metrics.ts`:
   `totalCalls()`.
4. Write the unit tests (`provider-history`, `provider-health`,
   `tool-metrics`, `provider-status` operational cases) and the spawned
   `provider-health-action.test.ts` with `src/lib/stub-provider.ts`. Every new
   test file starts with its `// @implements` citation for the REQ and named
   clause tags it asserts (C-5).
5. Record every pre-fix result in `tasks.md`: disabled reason red (no field),
   served-request count red (provider samples), REQ-013 legs green before the
   fix as regression evidence, with that reason recorded.

### Phase 2 — Fix

1. `src/index.ts`: `doProviderHealth` computes probe eligibility from
   `isOperational` **and** a registered probe target, skips the probe for a non-operational provider, passes
   `probeStatus` and the probe latency into `providerStatusInput` /
   `assembleHealthReport` while keeping the REQ-036 precedence (`latency.avg`
   history first, probe measurement as fallback), leaves `auth_ok` on
   `providerUsable`, and builds the report through `assembleHealthReport`
   (D-2, D-5).
2. `src/index.ts`: `doSpecHealth` reports `toolMetrics.totalCalls()` (D-4).
3. `src/types.ts`: `HealthReport.inactive_reason?`.
4. Re-run every touched suite; every red case passes and the regression
   evidence stays green.

### Phase 3 — Spec, verification, documentation

1. `infobroker.md`: DB-5 amendments and the clause tags (C-5).
2. Audit `git diff --stat` and `git status --porcelain` against § Blast radius
   before any bookkeeping edit (DB-8).
3. Targeted suites, then `npm run typecheck`, `npm run validate-spec`,
   `npm run check-gate-coverage`, `npm run check-intent-citations`.
4. `README.md`: change only on a demonstrated contradiction; `npm run
   validate-readme`.
5. `DECISIONS.md`: D-103 (disabled-provider health semantics), D-104
   (process-scoped history), D-105 (served-request accounting).
6. `CHANGELOG.md`: one entry under the current section.
7. `ROADMAP.md`: retire § R2c-ii; `npm run check-roadmap` and
   `npm run check-non-goals`.
8. `docs/plans/2026-11-09-full-review-sweep/worklist.md`: rows 638/639/640
   resolved, anchors refreshed, rows 169/170
   corrected.
9. `aar.md`: the DB-clause-to-evidence table and the LOOP token; `tasks.md`
   fully ticked.
10. Final `npm run check` and `npm run check-loop-artifacts`.

### Phase 4 — Commit series

Two commits, following the R2c-i precedent: the spec amendment, its clause
tags, and the source they assert are one atomic unit because `AGENTS.md`
requires the tags in the same commit as the REQ change and `validate-spec` to
pass with them.

1. **Spec, source, tests.** `infobroker.md`, the seven production files, the six
   test files. Gate: `npm run typecheck`, `npm run validate-spec`, the targeted
   suites.
2. **Documentation and record.** `README.md` (if changed), `DECISIONS.md`,
   `CHANGELOG.md`, `ROADMAP.md`,
   `docs/plans/2026-11-09-full-review-sweep/worklist.md`, this plan directory.
   Gate:
   `npm run check` on the tree to ship.

## Conditions

- **C-1** Pre-fix results are recorded as observed. A case already green is kept
  as regression evidence with its reason in `tasks.md`.
- **C-2** No `config.json` value, fixture, spec validator, or other tool is
  edited. A hit stops the increment.
- **C-3** The non-closure rule is audited by Phase 3 step 2 before bookkeeping.
- **C-4** The stub provider is a test-local loopback server; it makes no
  external request and writes no file outside the isolated root.
- **C-5** The clause tags are part of the deliverable: `REQ-024b disabled-refusal`,
  `REQ-024b last-history`, `REQ-024c request-count` on the tests that assert
  them, and `REQ-013 provider-probe-active|degraded|inactive` on the spawned
  health test. New test files carry the same header citation form as their
  siblings.
- **C-6** The health report's existing fields keep their meaning:
  `avg_latency_ms` follows REQ-036 precedence, `auth_ok` stays
  `providerUsable`, and `quota_*`, `cooldown_remaining_ms`, `last_error`, and
  `last_success` keep their current producers. The only addition is
  `inactive_reason`, and it appears only where the assessment states a cause
  (`disabled`, `exhausted`) — never on `active`, `degraded`, or a
  probe-explained `inactive`.
- **C-7** The spawned end-to-end tests are hermetic: the isolated config copy
  enables `searxng`, pins every dispatch chain to `["searxng"]`, and disables
  every other provider, so no other provider — and therefore no external
  request — can be attempted by the search, the hedge, or the probe. The
  failure leg uses HTTP 404, which `src/retry.ts:66-68` classifies as
  non-retryable, so no backoff loop runs.

## Decisions

- **D-1 — scope includes the R2c-i deferral.** F-R2-22/23/24 plus the
  end-to-end REQ-013 probe evidence. *Rejected:* leaving the probe wiring to a
  later item — R2c-i's DB-3 assigns it here, and DB-4 is what makes the health
  action use the same derivation as the list and spec actions.
- **D-2 — a disabled provider is reported, not refused with an error.** The
  action skips the probe and returns `[OK]` with `inactive` +
  `inactive_reason: "disabled"`. *Rejected:* a REQ-002 error envelope —
  REQ-002 errors mean failure to serve, while health is a diagnostic surface
  and the list action already reports reasons rather than errors; `search_web`'s
  `invalid_input` refusal (`src/index.ts:427`) exists because it cannot serve a
  query at all. *Consequence:* one additive field on the health report.
- **D-3 — operational history is process-scoped and extracted.** The module
  keeps the existing in-memory semantics and gains a reset seam; REQ-024b says
  "since server start" so the spec matches the implementation. *Rejected:*
  persisting history to disk — it is a state-format change needing migration,
  and REQ-024b does not require durability.
- **D-4 — `total_requests_served` counts tool requests.** It is
  `toolMetrics.totalCalls()`: cumulative, across all tools, including failed
  calls, excluding the in-flight spec call because instrumentation records after
  the handler returns. *Alternative rejected:* a second counter in `src/index.ts`
  (two sources drift) and counting only successful calls ("served" covers every
  request the server handled). *Consequence:* `tool-metrics.ts` joins the blast
  radius and REQ-024c's wording is narrowed to what is counted.
- **D-5 — one probe-eligibility decision, in `src/config.ts`.** `isOperational`
  moves next to `providerUsable`'s truth table and `providerUsable` delegates to
  it; `assessProvider` and the health action both use it, so eligibility cannot
  drift from the reported status. *Rejected:* a parallel truth table in
  `src/provider-status.ts`, and a second `operational` field on the assessment
  (one representation, one consumer).
- **D-6 — a loopback stub plus a hermetic config supplies the end-to-end
  traffic.** `node:http` on `127.0.0.1:0` serving SearXNG-shaped JSON (200 with
  one result, or 404) and a closed port exercise the real provider module and
  the real spawned server, while C-7's chain pinning guarantees no other
  provider can be attempted. *Rejected:* committing fixtures for an action
  whose status depends on live probe output; mocking across a process boundary,
  which is not possible; and relying on the shipped config, whose `searxng`
  entry is disabled, which would silently route the search to live providers.

## Verification summary

| Clause | Evidence |
|---|---|
| DB-1 | `src/provider-health-action.test.ts` disabled-provider case; `src/provider-status.test.ts` operational cases; `src/provider-health.test.ts` probe-status case |
| DB-2 | `src/provider-history.test.ts`; `src/provider-health.test.ts` timestamp mapping; `src/provider-health-action.test.ts` stub success/failure round-trip |
| DB-3 | `src/provider-health-action.test.ts` call-count phases; `src/tool-metrics.test.ts` `totalCalls` |
| DB-4 | `src/provider-health-action.test.ts` three statuses through the stub; existing `src/health-status.test.ts` latency and quota legs retained |
| DB-5 | `infobroker.md` diff; `npm run validate-spec`, `npm run check-gate-coverage` |
| DB-6 | `ROADMAP.md`, `docs/plans/2026-11-09-full-review-sweep/worklist.md`, `CHANGELOG.md`, `DECISIONS.md` diffs; the four bookkeeping gates |
| DB-7 | `npm run check` output recorded in the AAR |
| DB-8 | `git diff --stat` / `git status --porcelain` audit before bookkeeping |
