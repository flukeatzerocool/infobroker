# Research-scenario suite

`npm run test-research` exercises every Infobroker workflow route through
the live orchestrator with realistic, non-leading user utterances, then
evaluates each run. Unlike `test-skills` (which checks that a skill emits
its token when invoked by name), this suite checks that a researcher-shaped
request actually routes to the right skill and produces the deliverable
contract end to end.

## Scenarios

`manifest.json` is a single array of scenario objects, one per run. Each
entry declares:

- `id`, `label`, `persona`, `shape` (the expected route, asserted post-hoc —
  it does not appear in the prompt), `mode` (`positive`, `negative`, or
  `multiturn`).
- `utterance`: the realistic, non-leading user request. The persona and the
  expectation of shape/token live only in the manifest, never in the prompt.
- `followups`: subsequent turns, continued in the same session. Interactive
  skills (`analysis-loop`) need a "Proceed with reasonable defaults." turn
  and a "Close it here and accept the remaining gaps." turn to reach their
  final completion token.
- `tokens` (order-sensitive), `absent` (must not appear), `sections`
  (case-insensitive substring needles, `|` = OR).

## Evaluation semantics

**Hard gates** (a failing one fails the scenario):

- `tokens` appear in order in the assistant's text.
- `absent` tokens do not appear.
- `sections` are present (case-insensitive OR-match).
- `tool_audit.kb_before_search`: a `manage_kb` tool call precedes the first
  `web_search`. (Only asserted when the scenario sets it `true`.)
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
  FAIL  S9   gated-analysis — missing token: analysis-loop complete.; audit fail: kb_before_search
```

The failure detail lists exactly which hard gate tripped. Full transcripts
(`combined.txt`), extracted final text (`final.txt`), and `results.json`
land under `$TMPDIR/infobroker/research-tests/run-<ts>/`.
