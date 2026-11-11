# Tasks — R2b-iii key-safety evidence

**Plan:** `plan.md` (revision 1b)
**Findings:** F-R2-7 → `Resolved`
**Depth:** light · **Rollback cost:** 0

## Baseline (recorded 2026-11-11, before the first edit)

| Command | Result |
|---|---|
| `npm run typecheck` | exit 0 |
| `npx vitest run src/provider-health-action.test.ts` | 1 file / 4 tests PASS |
| Phase 0 probe: `validateConfig` with a keyed `generic_http` entry | PASS (`/tmp/opencode/r2biii-phase0.ts`) |
| `git check-ignore docs/plans/2026-11-11-r2b-iii-key-safety-evidence/plan.md` | exit 1 (trackable) |
| `git status --porcelain` | clean at `dc09b73` |

## Phase 0 — Discovery and frozen observations

- [x] Re-confirm P1-P7 (done at plan time; unchanged at `dc09b73`).
- [x] Confirm the keyed `generic_http` entry validates (probe above).
- [x] Confirm the increment directory is trackable.
- [x] **Amendment 1b:** the shipped `core` and `semantic_scholar` providers are
  `free_http`, so `startupHealthCheck` probes them live even without a key.
  The test substitutes two loopback `generic_http` providers with the identical
  credential classifications. Recorded in `plan.md` § Amendment 1b.
- [x] Pre-change matrix: no spawned test exists, so every DB-1…DB-4 assertion
  is **new evidence** (not a demonstrated failure). The classification
  predicates are green at unit level (`provider-status.test.ts:109-130`).

## Phase 1 — Evidence

- [x] Extend `src/lib/stub-provider.ts`:
  - credential-environment scrubbing for every spawned child;
  - loopback `generic_http` providers (required-key and optional-key);
  - `echo401` stub mode that echoes the presented credential in the body;
  - optional file sinks for the call log and audit log.
- [x] Add `src/key-safety-action.test.ts` with `REQ-011 missing-key`,
  `REQ-011 optional-key`, `REQ-011 no-leak`, `REQ-104 pool-state` tags.
- [x] Record the first run: the suite reached the server only after the helper
  supplied `rate_limit` (the rate limiter reads it unguarded); the state-file
  id assertion moved to the rejection phase where an id exists. Both are
  recorded in the AAR.

## Phase 2 — Fix

- [x] None required. No production file changed; every clause was green once
  the harness was correct.

## Phase 3 — Verification and documentation

- [x] Targeted test, `npm run typecheck`, `npm run check-gate-coverage`,
  `npm run validate-spec`.
- [x] `worklist.md`: row 147 cites the new test; row 623 resolved.
- [x] `ROADMAP.md`: retire § R2b-iii; `check-roadmap`, `check-non-goals`.
- [x] `aar.md` with the evidence table and the LOOP token.
- [x] Final `npm run check` and `npm run check-loop-artifacts`.

## Phase 4 — Commit series

- [x] Commit 1 — tests and helper (`251467f`).
- [x] Commit 2 — roadmap, worklist, increment directory (this commit).

## Step-to-evidence

| Step | Files | Command | Result |
|---|---|---|---|
| baseline | — | `npm run typecheck` | exit 0 |
| baseline | — | `vitest run src/provider-health-action.test.ts` | 4/4 PASS |
| Phase 0 | — | `tsx /tmp/opencode/r2biii-phase0.ts` | `validateConfig: PASS` |
| Phase 1 | `src/lib/stub-provider.ts`, `src/key-safety-action.test.ts` | `vitest run src/key-safety-action.test.ts` | 4/4 PASS |
| Phase 1 regression | `src/lib/stub-provider.ts` | `vitest run src/provider-health-action.test.ts` | 4/4 PASS |
| Phase 3 | source | `npm run typecheck` | exit 0 |
| Phase 3 | source | `npm run check-gate-coverage` | 118 G1 REQs: 117 cited, 1 exempt, 0 waived |
| Phase 3 | source | `npm run validate-spec` | all checks passed |
| Phase 3 | docs | `npm run check-roadmap` / `check-non-goals` | OK both |
| Phase 3 | docs | `npm run check` | gates: PASS (full, 112.7 s) |
