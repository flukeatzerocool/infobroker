# AAR — Loop and gates (increment A)

**Date:** 2026-11-07
**Increment:** `docs/plans/2026-11-07-loop-and-gates`

## What happened

| Phase | Delivered | Evidence |
|---|---|---|
| A0 | Baseline: full suite green; state-dir and ignore probes; the retired chain enumerated | `npm run check` green; `.infobroker/` rejected by the shipped-KB gate |
| A2 | Gate manifest, tree-keyed run record, runner, table check, unit tests, shared flag helpers; `check`/`check:fast` rewired; pre-push and pipeline record | `check:fast` PASS 17 gates 7.0 s; `check` PASS 20 gates 31.9 s; seeded type error → FAIL `typecheck:scripts` |
| A2b | `tsconfig.scripts.json` + `typecheck:scripts`; seven pre-existing script type errors fixed | `typecheck:scripts` exit 0 |
| A3 | Increment artifacts lib + gate, `session-close`, D-091 | `session-close --dry-run` exit 0; `check-loop-artifacts` PASS |
| A4 | `loop-audit` + pure helpers + tests | audit reports 10 historical drifts |
| A1 | `docs/workflow-cadence.md`, `docs/plans/README.md`, this increment | `check-roadmap` PASS (4 sections) |
| A5 | CHANGELOG, this AAR, full suite, close | see below |

## What went right

- The gate layer replaced the `&&` chain without changing what `check` means:
  the manifest's first 18 gates reproduce the old order exactly, verified by a
  direct comparison, and the seed test proves a failure is attributed to its
  own gate rather than to whichever sibling printed last.
- The run record's key is the tree object plus a clean working tree, and the
  untracked-file probe confirms an edit invalidates a prior pass. A fast run
  cannot satisfy the push gate, which is what made a fast suite safe to add.
- `loop-audit` found real signal on its first run: ten commits where the
  CHANGELOG heading date and the commit date disagree. A measurement that
  immediately finds something is stronger evidence than a green check.
- `session:close` reports the push cadence without committing, so the
  split-commit invariant (D-089) survives the new command.

## Deviations

1. **Build order reversed.** The plan listed the cadence docs first (A1); they
   landed last, after the commands they name, so no commit asserted a command
   that did not yet exist. Recorded in `tasks.md`.
2. **A2 grew by `typecheck:scripts`.** `npm run typecheck` covered `src/**`
   only, so the new tooling was not typechecked and the plan's per-commit
   verification claim was empty for it. A probe found seven pre-existing
   errors; closing them was cheaper than shipping unverified gates. Plan
   re-stamped.
3. **D8 amended at build time.** `.infobroker/` is rejected by
   `check-shipped-kb-empty` as shipped KB data, so state moved to
   `$TMPDIR/infobroker/`, keyed by a hash of the repository root. Plan
   re-stamped.
4. **Four commits, not five.** The loop layer and the audit shipped together:
   `package.json` carries both script entries and cannot be split by file.
5. **Roadmap item added here, not in increment B.** The cadence doc must not
   point at a roadmap item that does not exist, so "Gate retirement and weekly
   cadence" landed with the doc.

## Findings and dispositions

| Finding | Severity | Disposition |
|---|---|---|
| Holonovel `check:fast` / `check` not yet verified (condition C-1) | P1 | Scheduled under ROADMAP item 1 (increment B) |
| Script tree was never typechecked | P2 | Resolved in-session (`typecheck:scripts`) |
| `.infobroker/` rejected by the shipped-KB gate | P3 | Resolved in-session (D8 amended) |
| Ten historical heading-vs-commit date drifts | P3 | Record-and-close: historical dates; the audit now surfaces new ones |
| Fast suite runs the unit suite concurrently with structural gates | P3 | Record-and-close: measured 7 s, no interference observed |

## Done bar

`npm run check` and `npm run check:fast` green; `check-gate-table` and
`check-loop-artifacts` green; this AAR carries a LOOP token; `npm run
session:close` passes for this increment; the four commits land.

LOOP PAUSED
