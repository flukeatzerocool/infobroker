# AAR — Workflow convergence, increment B

**Date:** 2026-11-07
**Increment:** `docs/plans/2026-11-07-convergence-b`

**Done bar:** `npm run check` and `npm run check:fast` green in both
Infobroker and Holonovel; `npm run session:close` passes for this increment;
`npm run test-push-pipeline` passes every case; a published tag is refused and
a re-run after a failed push still succeeds; the shared vocabulary is identical
in both `package.json` files; `docs/workflow-cadence.md` states the
immutable-tag rule; the four split commits land.

## What happened

| Phase | Delivered | Evidence |
|---|---|---|
| B0 | Baseline (both repos green), increment record | `npm run check` 21 gates 32.6 s; Holonovel `check` PASS; `check-loop-artifacts` PASS (2 increments) |
| B1 | Immutable published tags: `remoteExists`, `--force-tag` retired, atomic push, C.9 | `typecheck`; `release-policy.test.ts` 24/24; `validate-spec` PASS; `--force-tag` → unknown flag, exit 1 |
| B2 | Double-keyed stub seam + 7-case harness + gate wiring | `test-push-pipeline` 23 checks PASS, 15.2 s; seeded refspec → exit 1, 3 FAILs; `check-gate-table` 22 gates; `typecheck:scripts`; `check-script-discipline` |
| B3 | `delivery.ts`, `hook-events.ts`, hooks, loop-audit sections | `npm test` 1034/1034; `loop-audit` prints delivery + hooks + gate rows; `--json` valid; append overhead 20 ms |
| B4 | Cadence, AGENTS, D-092/D-093, CHANGELOG | `validate-spec`, `validate-readme`, `check-non-goals`, `version-sync`, `check-roadmap` PASS |
| B5 | Cross-repo verification, roadmap close, this AAR | Infobroker `check` PASS 46.6 s, `check:fast` PASS 22.4 s; Holonovel `check` PASS, `check:fast` PASS (36 gates); `session:close` PASS |

## What went right

- The harness found a real defect on its first run: `--resume` after a failed
  push was impossible because `state.json` kept the pre-run HEAD and the
  pipeline's own commit made the guard refuse with "HEAD moved". This is the
  exact class the roadmap wanted a harness for — it was unreachable by any
  deterministic gate and would only have surfaced during a failed release.
- The published-tag refusal and the interrupted-publish retry are both asserted
  against a real bare remote: the remote tag never moves, and the local-only tag
  still follows HEAD. The seeded refspec failure proves a broken push path turns
  the gate red rather than printing PASS.
- The toolchain stub stayed narrow: state, staging, deny-list, secret scan,
  commit, tag decision, atomic push, and resume run for real; only the project
  toolchain is replaced. The two-key guard means a leaked flag cannot skip a
  real gate.
- The loop audit now reports on its own first run: 35 pushes over 74 days,
  0.47 pushes/day, 46/57 pipeline commits followed within 48 h, and a 20 ms
  hook-append cost.

## Deviations

1. **Harness inputs changed at build time.** A `--no-ai` release publishes an
   already-prepared tree, so the run itself creates no commit. The happy,
   `--no-push`, published-tag, retry, and resume cases now carry an untracked
   file that the pipeline stages and commits, which exercises the staging/commit
   path instead of asserting a no-op. Recorded here, not a scope change.
2. **`state_head` added to the resume journal.** Case 6 exposed the defect
   above, so `push-pipeline.sh` gained a post-commit head update. It is in the
   plan's blast radius (`push-pipeline.sh`) and required by the approved case.
3. **Three project-toolchain checks joined the stub seam** (`spec_req_change`,
   the `--no-ai` version precheck, the per-commit typecheck). Without them the
   harness could not reach the control flow it tests.
4. **ROADMAP removal happened after both repos were green** (C-3), so the
   section was temporarily restored between B4 and B5.

## Findings and dispositions

| Finding | Severity | Disposition |
|---|---|---|
| `--resume` after a failed push was impossible ("HEAD moved" by its own commit) | P0 | Resolved in-session: `state_head` writes the post-commit HEAD; harness case 6 passes |
| The harness cannot exercise the commit path with a clean prepared tree | P2 | Resolved in-session: cases supply an untracked change |
| AGENTS claimed `INFOBROKER_PIPELINE_VERIFIED_SHA` and `.infobroker/gate-run.json`; neither exists | P3 | Resolved in-session: both corrected |
| Holonovel `check:fast`/`check` not verified (increment A's C-1) | P1 | Resolved in-session: both green |
| Hook telemetry is best-effort and could be silently absent on a read-only state dir | P3 | Record-and-close: by design; the audit reports zero rather than failing |
| Second release on one calendar day reuses the CalVer and is refused | P3 | Recorded in D-092; ROADMAP item 2 changes the version scheme |

## Done bar verification

- Infobroker `npm run check` → PASS (22 gates, 46.6 s).
- Infobroker `npm run check:fast` → PASS (22.4 s).
- Holonovel `npm run check` → PASS; `npm run check:fast` → PASS (36 gates).
- `npm run test-push-pipeline` → PASS (7 cases, 23 checks).
- Published tag refused; interrupted-publish retry and resume after a failed
  push both succeed (harness cases 4–6).
- Shared vocabulary identical in both `package.json` files (`status`,
  `check:fast`, `session:close`, `prep`, `release`, `gates`).
- `docs/workflow-cadence.md` states the immutable-tag rule.
- `npm run session:close` → PASS for this increment (recorded by the run).
- Four split commits land: tag policy, harness, loop telemetry, docs.

LOOP PAUSED
