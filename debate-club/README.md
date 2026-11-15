# debate-club

Persona-driven evaluation environment for the Infobroker MCP server. Two
planes, never mixed:

- **Arena (mechanical):** spawns the real server under a `fetch`- and
  DNS-intercepting preload, serves every request from committed fixtures, and
  asserts the tool response contracts. The DNS stub keeps the SSRF guard's
  hostname resolution offline for fixture hosts. Deterministic, no model.
- **Lab (agentic):** personas exercise the live MCP through headless
  `opencode`; evaluated mechanically, with an evidence-aware critic pass
  (`critic.md`) run over each final answer plus the scenario rubric and a
  bounded tool-call digest, recorded as advisory only. By default the Lab
  starts a repo-scoped `opencode serve` whose project config points the
  `infobroker` MCP at this working tree (`DEBATE_MCP_MODE=ambient` reverts to
  the configured deployment), and records the target in the run's
  `mcp-target.txt` and `run-meta.json`.

## Layout

```
run.sh              entry point (arena | record | normalize | report | recommend | lab)
src/                Arena client, contract assertions, telemetry, and the test
scripts/            preload (replay/record), record-driver, normalize, report,
                    recommend, evaluate-lab, lab.sh, critic prompt
fixtures/index.json synthetic replay fixtures (deterministic, no network)
personas.json       target audiences mapped to spec §D feature groups
lab-scenarios.json  agentic scenarios (tokens/sections/tool_audit/rubric)
```

## Run

```bash
./run.sh arena          # deterministic contract suite (offline)
./run.sh lab --only=L1  # agentic persona run (live opencode)
./run.sh report         # roll up .runs/latest/telemetry.ndjson
./run.sh recommend      # rule-based recommendations from the report
```

Lab environment knobs:

| Variable | Default | Purpose |
|----------|---------|---------|
| `DEBATE_MCP_MODE` | `repo` | `repo` exercises this working tree; `ambient` uses the configured deployment |
| `DEBATE_RUNS_DIR` | `~/.local/share/infobroker/debate-club-runs` | durable retention root (outside the repo) |
| `DEBATE_KEEP_RUNS` | `20` | retained run count |
| `DEBATE_REQUIRE_REPO_MCP` | `0` | `1` fails the run when the MCP target is not this repo |
| `DEBATE_ALLOW_INCOMPLETE` | `0` | `1` accepts a run with missing critic/coverage |

## Config profiles

Each scenario declares a `profile`; `lab.sh` groups the selected scenarios by
profile and starts one repo-scoped serve per group with that profile's
generated `config.local.json`. A result is attributable to the configuration
it exercised: `run-meta.json` records the profile name, its layer hash, and the
scenarios in the group.

In repo mode the run project also declares this working tree's `skills/`, and
`lab.sh` refuses to start a profile whose `opencode debug config` does not list
that directory (the assertion is `scripts/test-research/assert-skills.ts`,
shared with the research suite). Without it, the MCP would be repo-scoped while
the skill layer stayed ambient — on a machine with an installed copy, a skill
change could pass or fail without ever being loaded. `mcp-target.txt` records
both the MCP command and `skills:<repo>/skills` (D-130).

Every profile that keeps a knowledge base also pins a run-scoped
`kb.storage_path` and `kb.reports_dir` (`$RUN_DIR/kb`), and `mcp-target.txt`
records both paths. A run therefore cannot be corroborated by the operator's
populated store or by an earlier run's `report://` artifacts; the profile layer
hash covers the isolated bytes. The `constrained` profile keeps its explicit
`kb: null` — it reads no store at all (D-131).

| Profile | Layer | Purpose |
|---|---|---|
| `fresh` | `{}` | Shipped defaults, no user layer — the new-user path |
| `solo-override` | `output.fallback_depth: 2` | The smallest realistic one-knob override |
| `constrained` | `kb: null`, `kb_recall: false`, `fallback_depth: 1` | Degraded but usable |
| `power` | archive + KB auto-index on | Every optional local capability |

## Config behavior matrix

`src/user-defaults.test.ts` proves that declared configuration actually changes
what a caller observes, on the shipped default path and under a named profile.
Each row is a case that fails when the setting stops being honored.

| Case | Config path | Asserted observable |
|---|---|---|
| Crawl bound | `fetch.crawl_max_pages: 2` | `fetch_page` with `crawl` returns exactly two results |
| Compact results | `output.verbose: false` | each search result carries only `title`/`url`/`snippet`; meta is minimal |
| Cooldown notice | default | a 429 fixture produces `rate_limited` and an active cooldown row in `inspect_providers` |
| Chain depth | `output.fallback_depth: 1` vs `2` (with `hedge_enabled: false`) | depth 1 stops at the first provider's empty answer (`no_results`); depth 2 advances to the second and serves from it |
| Archive copies | `preservation.archive: true` vs `false` | `verify_claims` sources carry `archived_url` only when archiving is on |

`report.mjs` rolls results up by persona and profile and emits `profile_delta`
for a shape that ran under more than one profile; `recommend.mjs` raises a P1
when the shape passes under one profile and fails under another.


`arena` and the report/recommend steps use the repo's `node_modules`.
From the repo root: `npm run test-debate-club` runs the typecheck + Arena and
is part of `npm run check`.

## Run artifacts

Every Arena run writes `.runs/latest/telemetry.ndjson` (one record per tool
call, with a reproducibility fingerprint), `report.json`, and
`recommendations.json`. A Lab run writes, per scenario, `turn0.txt` (raw
transcript), `final.txt` (final answer), `critic-input.md`, `critic.txt`
(advisory), and `critic.err` (failure reason, when the critic command failed);
plus `results.json`, the same `report.json`/`recommendations.json` rollups
(built from `results.json`), `mcp-target.txt`, and `run-meta.json` (repo
version/HEAD and the MCP target path the run exercised). `.runs/` is
git-ignored; every Lab run is also copied to `DEBATE_RUNS_DIR` so a
`git clean -fdx` cannot lose it.

Each scenario result carries `critic_status` (`ok`/`empty`/`malformed`/
`not-run`), the parsed `critic_verdict`, and the normalized Infobroker `tools`
it called, which `report.mjs` rolls into `coverage`. A Lab run whose scenarios
lack a parsed verdict or tool coverage exits non-zero as incomplete.

## Status

- Arena: green (all seven tools, negative paths, deterministic across runs).
- Report/recommend: exercised on Arena and Lab telemetry.
- A Lab run's `critic_status`/`critic_verdict` and tool coverage are complete
  by construction; see `evaluate-lab.test.ts` for the offline contract.
- Contract assertions are derived from reading each handler; a new scenario
  should probe the handler's actual body before asserting its shape.
- The `record` lane and the Lab require live network / `opencode` and are not
  part of CI; their harnesses are exercised with synthetic data and the Arena
  test suite.
