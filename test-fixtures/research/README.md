# Research-scenario suite

`npm run test-research` exercises every Infobroker workflow route through
the live orchestrator with realistic, non-leading user utterances, then
evaluates each run. Unlike `test-skills` (which checks that a skill emits
its token when invoked by name), this suite checks that a researcher-shaped
request actually routes to the right skill and produces the deliverable
contract end to end.

By default it runs against the configured deployment (`--mcp=ambient`). Pass
`--mcp=repo` to point the MCP at this working tree with a run-local config
layer, which is the mode to use when the question is "did the current tree
change this?" rather than "is the installed server healthy?".

The run-local layer also pins a run-scoped `kb.storage_path` and
`kb.reports_dir` (`$RUN_DIR/kb`), recorded in `mcp-target.txt` beside the
skills target. A run therefore cannot be corroborated by the operator's
populated store or by an earlier run's `report://` artifacts (D-131).

Repo mode also declares this working tree's `skills/` in the run project and
refuses to start when `opencode debug config` does not report that entry. That
matters because skills are a client artifact: without the declaration the run
would silently exercise whatever skills the ambient client config names, which
on a machine that also has an installed copy is not this tree. The suite prints
the target and records it as `skills:<path>` in the run's `mcp-target.txt`.

## Scenarios

`manifest.json` is a single array of scenario objects, one per run. Each
entry declares:

- `id`, `label`, `persona`, `shape` (the expected route, asserted post-hoc —
  it does not appear in the prompt), `mode` (`positive`, `negative`, or
  `multiturn`).
- `utterance`: the realistic, non-leading user request. The persona and the
  expectation of shape/token live only in the manifest; an `invoke` scenario
  adds a harness-owned load line *after* the request (see below).
- `invoke` (optional): skill ids the harness asks the run to load, in order. An
  invoked scenario is a contract test — it verifies the skill's deliverable, not
  route selection. `results.json` records `invoked` and the observed
  `skills_loaded` (advisory; the contract gates still decide pass/fail).
- `followups`: subsequent turns, continued in the same session. Interactive
  skills (`analysis-loop`) may need a "Proceed with reasonable defaults." turn
  and a "Close it here and accept the remaining gaps." turn to reach their final
  completion token; an invoked single-turn scenario (N4) instead relies on the
  skill's own contract in one turn.
- `tokens` (order-sensitive), `absent` (must not appear), `sections`
  (case-insensitive substring needles, `|` = OR). A `sections` needle must
  list the acceptable synonyms for one finding, not one literal: when a
  correct run fails on a single wording, widen the needle set rather than pin
  the wording in skill prose (a shape's block cannot bind a model's phrasing).
- `token_scope` (`session` default, `final`): the text the `tokens`, `absent`,
  and `sections` gates read. See "Token scope" below.

## Evaluation semantics

**Token scope** is the scenario's stated contract:

- `session` (default) — every assistant text block in the run, in order. This
  is the contract for gated analysis, whose phase tokens are emitted across
  turns (`S9`, `A1a`, `A1b`, `M1`, `M2`, `N4` state it explicitly).
- `final` — only the last assistant message, the sign-off contract for a
  single-shot shape.

Neither scope can be satisfied by user, system, or tool text: both helpers
return assistant blocks only, so a completion token the user typed — or one
echoed from loaded skill content — cannot pass a gate. `S9` therefore needs
two passing runs to prove the contract: a multi-turn run (`S9`) and an invoked
single-turn gated run (`N4`). An invoked scenario is a contract test, not a
routing test (D-134).

**Hard gates** (a failing one fails the scenario):

- `tokens` appear in order in the scoped assistant text.
- `absent` tokens do not appear.
- `sections` are present (case-insensitive OR-match).
- `tool_audit.uses_infobroker`: at least one `infobroker_infobroker_*` tool
  is called. Built-in `websearch`/`webfetch` do **not** fail this — they are
  legitimate fallback when an Infobroker tool errors.

**Advisory** (reported, not gating):

- `tool_audit.verify_claims`: `verify_claims` was called. This is "use on
  contested claims" guidance, topic-dependent, not a shape requirement.
- `citation_sample`: the first N cited URLs are fetched; each is classified
  `reachable` / `blocked` / `invalid` / `error`. A bad URL flags for review
  but does not fail the run (real sites intermittently block).

## Cost

Each scenario runs the full live pipeline (RECALL → SEARCH → EXTRACT →
VERIFY → … → CITE), so a single scenario takes roughly 10–25 minutes of
wall-clock, plus ~15s per sampled citation. The full 18-entry matrix is
~2 hours. Restrict with `--only=S2,S7` or start partway with `--from=<id>`
(`--from` skips entries that sort before it in manifest order).

## Reading a result line

```
  PASS  S2   fact-check
  FAIL  S9   gated-analysis — missing token: analysis-loop complete.; audit fail: uses_infobroker
```

The failure detail lists exactly which hard gate tripped. Full transcripts
(`combined.txt`), extracted final text (`final.txt`), and `results.json`
land under `$TMPDIR/infobroker/research-tests/run-<ts>/`.

A turn that does not complete is that scenario's failure, not the suite's:
`timeout` (exit 124) is recorded as `timeout after <OPC_TIMEOUT>s`, any other
non-zero exit as `turn failed (exit <rc>)`, and the next scenario runs. A
timed-out scenario is never evaluated on a partial transcript.

```
  FAIL  A1a  audience-ciso — timeout after 1800s; audit fail: timeout
```

## Timings

Each scenario prints a `PASS`/`FAIL` line the moment its evaluator returns, so a
slow run is visibly progressing instead of silent until the table. Every run also
writes `timings.json` beside `results.json`:

- `server_start_ms` — the `opencode serve` bring-up for the run.
- per scenario — `turn_ms[]` (one entry per turn), `evaluate_ms`,
  `citation_ms`, and `total_ms`.

The values are wall-clock diagnostics for deciding whether a run is slow, hung,
or provider-bound; nothing gates on them.
