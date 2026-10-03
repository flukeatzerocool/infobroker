# debate-club

Persona-driven evaluation environment for the Infobroker MCP server. Two
planes, never mixed:

- **Arena (mechanical):** spawns the real server under a `fetch`-intercepting
  preload, serves every request from committed fixtures, and asserts the tool
  response contracts. Offline, deterministic, no model.
- **Lab (agentic):** personas exercise the live MCP through headless
  `opencode`; evaluated mechanically, with a critic pass (`critic.md`) run
  over each final answer and recorded as advisory only. The Lab exercises
  whichever MCP the ambient `opencode` config exposes, and records that
  target in the run's `mcp-target.txt`.

## Layout

```
run.sh              entry point (arena | record | normalize | report | recommend | lab)
src/                Arena client, contract assertions, telemetry, and the test
scripts/            preload (replay/record), record-driver, normalize, report,
                    recommend, evaluate-lab, lab.sh, critic prompt
fixtures/index.json synthetic replay fixtures (deterministic, no network)
personas.json       target audiences mapped to spec §D feature groups
lab-scenarios.json  agentic scenarios
```

## Run

```bash
./run.sh arena          # deterministic contract suite (offline)
./run.sh lab --only=L1  # agentic persona run (live opencode)
./run.sh report         # roll up .runs/latest/telemetry.ndjson
./run.sh recommend      # rule-based recommendations from the report
```

`arena` and the report/recommend steps use the repo's `node_modules`.
From the repo root: `npm run test-debate-club` runs the typecheck + Arena and
is part of `npm run check`.

## Run artifacts

Every Arena run writes `.runs/latest/telemetry.ndjson` (one record per tool
call, with a reproducibility fingerprint), `report.json`, and
`recommendations.json`. A Lab run writes `.runs/lab-<ts>/results.json`, the
same `report.json`/`recommendations.json` rollups (built from `results.json`),
and `mcp-target.txt` recording the MCP command the run exercised. `.runs/` is
git-ignored.

## Status

- Arena: green (all seven tools, negative paths, deterministic across runs).
- Report/recommend: exercised on Arena telemetry.
- Contract assertions are derived from reading each handler; a new scenario
  should probe the handler's actual body before asserting its shape.
- The `record` lane and the Lab require live network / `opencode` and are not
  part of CI; their harnesses are exercised with synthetic data.
