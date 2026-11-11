# AAR — R2d retry, latency, quota and chain shape

**Status:** complete · **Date:** 2026-11-11
**Plan:** `plan.md` (sha256 `6b5bfb2b…`, plan-review `passed`, independence `fresh`) · **Tasks:** `tasks.md`

## What shipped

Eight R2 register findings, in three slices:

1. **Quota durability and reset.** `search_web` now treats a quota refusal as a
   chain failure: a fully spent chain returns `all_providers_exhausted` with
   `quota_exhausted`, an exhausted-plus-empty chain does the same, and an
   all-empty chain keeps the successful zero-result answer. Quota writes flush
   on `SIGTERM`/`SIGINT` (flush, remove the handler, re-raise the signal), and
   the reset is exact at `resetAt` — the undocumented 30 s grace is gone.
2. **Latency window.** `output.latency_window_strategy` (`count`/`time`/`both`,
   default `both`) and `output.latency_window_ms` (default 900000) are
   validated and applied on both the write and read paths, so an idle provider
   stops reporting a stale average. Both fields are optional in `Config.output`
   with runtime defaults, so existing partial fixtures still type-check.
3. **Chain shape.** A rate-limited `fetch_page` reports `retry_after_ms` from
   the live cooldown registry on the standard and `extract` paths. The new
   spawned orchestration suite covers hedge on/off, cross-task fallback order,
   all-error vs all-empty, a cooldown skip with zero new outbound calls, a
   provider at 100% receiving zero calls, and a config-disabled provider never
   being dispatched or called.

## Finding dispositions

| Finding | Disposition |
|---|---|
| F-R2-15 | Resolved in-session — dispatch + spawned zero-call exclusion |
| F-R2-26 | Resolved in-session — 79/80/100 against the real predicate; 100% zero-call; stale `quota_warning` clause corrected |
| F-R2-27 | Resolved in-session — strategy + time window, read-path eviction |
| F-R2-30 | Resolved in-session — `lastError` on quota skip; mixed-chain rule pinned |
| F-R2-32 | Resolved in-session — signal flush, both signals tested |
| F-R2-33 | Resolved in-session — exact reset, four boundary tests |
| F-R2-34 | Resolved in-session — cooldown-derived detail at both call sites |
| F-R2-35 | Resolved in-session — orchestration suite |

No P0/P1 remains open from this increment. The cold-review findings (2
Blockers, 4 Majors, 3 Nits) were resolved in the plan before execution; the
three post-review Nits were applied as condition-level clarifications.

## Verification

| Check | Result |
|---|---|
| `npm run typecheck` | exit 0 |
| Targeted suites (quota, latency, config, fetch-fallback, dispatch-orchestration, chain, provider-list, provider-health, error-envelope) | 8 files, 72 tests pass |
| Stub consumers (`key-safety-action`, `provider-health-action`) | 8/8 pass (extension additive) |
| `npm run check:fast` | PASS, 21 gates, 21.8 s |
| `npm run check` | PASS, full 22 gates, 113.7 s (tree dirty, so not recorded) |
| `npm run validate-spec` | all checks passed; no REQ body changed |
| `npm run check-roadmap` | OK, 22 sections (R2d retired) |

## Cross-chunk notes

- **Review lineage.** A third targeted cold confirmation
  (`/tmp/opencode/r2d-cold-final.md`) bound the final plan bytes after three
  condition-level nit clarifications; it found no Blocker or Major and
  discharged the three post-re-review Nits.
- **Startup health probe.** The first orchestration red run counted the
  startup provider probe as a search request. The assertions were changed to
  measure the delta across the search rather than the absolute count; no
  production behavior was changed for the test.
- **Stub template `retry_count: 0`.** The hermetic generic-http stub pins
  `retry_count: 0` so the 500/429 modes fail immediately. Existing modes and
  their suites are unaffected.
- **Pre-existing warning.** `check-loop-artifacts` still warns about
  `2026-11-10-r6-encryption-capacity-remediation`; recorded, not fixed (C-6).
- **Unpushed backlog.** The AAR trigger fired (73+ unpushed commits, oldest
  45.3 h at plan time). Publication stays user-authorized; nothing was pushed.

## Recommendations

None. No new roadmap item, no skill or gate change is warranted: every
behavior change is pinned by a test and every finding is closed.

LOOP PAUSED
