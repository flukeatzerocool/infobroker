# AAR — R2b-iii key-safety evidence

**Date:** 2026-11-11 · **Depth:** light · **Outcome:** closed
**Plan:** `plan.md` (revision 1b; self-reviewed at light depth)
**Tracker:** `docs/plans/2026-11-09-full-review-sweep/worklist.md`
**Next trigger:** `ROADMAP.md` § R2d

## What was done

1. **F-R2-7 resolved** with a spawned key-safety suite,
   `src/key-safety-action.test.ts` (4 tests), against loopback
   `generic_http` providers.
2. **Helper extended** (`src/lib/stub-provider.ts`): credential-environment
   scrubbing, required-key and optional-key loopback providers, an `echo401`
   stub mode, and file sinks for the call log and audit log.
3. **Evidence asserted:** a required credential absent yields `inactive` +
   `no_api_key` (list and health, `auth_ok: false`); an optional credential
   absent leaves the provider `active`; a rejected two-key pool yields
   `credentials_unavailable` with the F-R2-9 `key_pool` row; a sentinel
   credential appears in no response, audit entry, call-log record, config
   layer, or key-pool state, which stores a short hex id instead.
4. **Bookkeeping:** ROADMAP § R2b-iii retired; worklist row 147 now cites the
   spawned test and row 623 records the resolution.

## What went right

- The Phase 0 config probe caught nothing, but the first spawn exposed a
  real harness requirement: `configureProviderRateLimit` reads
  `rate_limit.per_second` unguarded (`src/rate-limiter.ts:21`), so a generic
  provider entry without `rate_limit` crashes startup. The helper now
  supplies it.
- Environment scrubbing made the missing-key case unambiguous even on a
  workstation with real keys exported.
- The no-leak sweep is non-vacuous: the audit log is created by
  `reload_config`, the call log by the tool calls, and the key-pool state by
  the rejected credential.

## What went wrong

- **Plan assumption invalidated at execution.** DB-1/DB-2 named `core` and
  `semantic_scholar`, but both are `free_http`, and `startupHealthCheck`
  probes them live even without a key (`src/index.ts:162-198`). Enabling them
  would have broken C-2/C-3. Amendment 1b substituted loopback providers with
  the same credential classifications; the delta was self-reviewed and
  re-stamped.
- **Two assertion corrections during the first run:** the pool-state id
  assertion belongs to the rejection phase (a successful resolve leaves
  `keys: {}`), and the id is 6 hex chars for this key, not 8. Both were
  corrected and the plan wording was aligned.

## Findings and dispositions

| ID | Severity | Disposition |
|---|---|---|
| F-R2-7 | P2 | **Resolved** — spawned evidence for the missing-key, optional-key, and no-leak clauses |
| Rate-limiter unguarded `rate_limit` | P3 | Informational — an enabled provider without `rate_limit` crashes startup, but `validateConfig` does not require the field; no demonstrated product defect because shipped and generic entries normally carry it. Not filed; recorded here as a harness observation. |

## Gate evidence

| Gate | Result |
|---|---|
| `npx vitest run src/key-safety-action.test.ts` | 4/4 PASS |
| `npx vitest run src/provider-health-action.test.ts` | 4/4 PASS (helper regression) |
| `npm run typecheck` | exit 0 |
| `npm run check-gate-coverage` | 118 G1 REQs: 117 cited, 1 exempt, 0 waived |
| `npm run validate-spec` | all checks passed |
| `npm run check` | PASS (full, 112.7 s) |
| `npm run check-roadmap`, `check-non-goals`, `check-loop-artifacts` | PASS (one pre-existing warning on `2026-11-10-r6-encryption-capacity-remediation`) |

## Recommendations

- None outside `ROADMAP.md`. § R2d is the next scheduled section.

LOOP PAUSED
