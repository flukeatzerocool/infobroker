# Tasks — Workflow convergence, increment B

Execution order. A step is ticked only when its verification command passes;
evidence is recorded in `aar.md`.

## B0 — Baseline and increment record

- [x] Record the baseline: `npm run status`, Infobroker `npm run check`,
      Holonovel `npm run check` (SHAs + gate counts).
- [x] Create this increment (`plan.md`, `tasks.md`, `aar.md`).
- [x] Probe harness preconditions: `git`, `mktemp`, `/tmp/opencode`,
      `node_modules/.bin/tsx`.

## B1 — Tag policy: published tags are immutable

- [x] `release-policy.ts`: add `remoteExists`, remove `force`, rewrite the
      decision order.
- [x] `release-policy.test.ts`: five decision rows + CLI flag.
- [x] `pipeline/lib.sh` `tag_release`: remote probe (fail-closed), drop force.
- [x] `push-pipeline.sh`: drop `--force-tag`, plain refspec, `--atomic`.
- [x] `infobroker.md` C.9: published tags are never moved.
- [x] Verify: `typecheck`, the two vitest files, `validate-spec`.

## B2 — Hermetic pipeline harness

- [x] Stub guard in `lib.sh` + `push-pipeline.sh` (double-keyed).
- [x] `scripts/test-push-pipeline.ts` with seven cases.
- [x] Wire: `package.json`, `gate-manifest.ts` (+test), AGENTS table.
- [x] Verify: harness 7/7, `check-gate-table`, `check-script-discipline`,
      `typecheck:scripts`, seeded failure.

## B3 — Loop telemetry

- [x] Extract `scripts/lib/delivery.ts`; `metrics.ts` delegates.
- [x] `scripts/lib/hook-events.ts` + reader test.
- [x] `.githooks/pre-commit`, `.githooks/pre-push`: append events.
- [x] `loop-audit.ts`: delivery, hooks, gate rows.
- [x] Verify: `npm test`, `npm run loop-audit`, `--json` valid, hook latency.

## B4 — Docs, spec, release record

- [x] `docs/workflow-cadence.md`: tag rule, audit sections.
- [x] `AGENTS.md`: drop stale `VERIFIED_SHA` + `--force-tag` phrase; harness.
- [x] `DECISIONS.md`: D-092, D-093.
- [x] `CHANGELOG.md`: dated entry (2026.11.07).
- [x] `ROADMAP.md`: remove the shipped section.
- [x] Update this file and `aar.md`.
- [x] Verify: `validate-readme`, `check-roadmap`, `check-non-goals`,
      `validate-spec`, `version-sync`.

## B5 — Cross-repo verification and close

- [x] Infobroker `check:fast`, then `check`.
- [x] Holonovel `check:fast`, then `check`.
- [x] `npm run session:close`.
- [x] Emit roadmap closure evidence.
