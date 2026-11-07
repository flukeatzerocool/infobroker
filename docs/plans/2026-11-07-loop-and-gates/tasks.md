# Tasks — Loop and gates (increment A)

1. [x] A0 — baseline: `npm run check` green; `check-ignore`/state-dir probe;
   the retired 18-step chain enumerated.
2. [x] A2 (built first) — `scripts/lib/gate-manifest.ts`,
   `gate-run-manifest.ts`, `run-gates.ts`, `check-gate-table.ts`, unit tests,
   shared `args.ts` helpers; `check` / `check:fast` rewired; AGENTS table
   regenerated; pre-push hook reads the run record; the pipeline writes it
   after the commit.
3. [x] A2b — `tsconfig.scripts.json` + `typecheck:scripts` gate; seven
   pre-existing script type errors fixed.
4. [x] A3 — `loop-artifacts` lib + gate, `session-close`, D-091, AGENTS
   governance bullet.
5. [x] A4 — `loop-audit` + pure helpers + tests.
6. [x] A1 (built last) — `docs/workflow-cadence.md`, `docs/plans/README.md`,
   this increment.
7. [x] A5 — CHANGELOG entry, AAR, `npm run check`, `npm run session:close`,
   commits.
