# Research-suite evidence — repo mode, 2026-11-15

Live runs of `test-fixtures/research/manifest.json` against this working tree
(`npm run test-research -- --mcp=repo`). Each scenario is a realistic,
non-leading user request; the persona and the expected route live in the
manifest, never in the prompt. Hard gates are the completion token, required
sections, forbidden tokens, and MCP engagement; citation sampling is advisory.

These runs are advisory evidence, not a gate. A hard-gate failure is recorded
and triaged — resolved in-session or scheduled on `ROADMAP.md` — rather than
chased to green by re-prompting.

## Method

- Mode: `--mcp=repo` — a run-local `opencode` project points the `infobroker`
  MCP at this working tree with an empty `config.local.json`, so the operator's
  own layer cannot change a result.
- Model: whatever the deployment runs; runs are model-mediated and not
  bit-reproducible. The transcript and the evaluated row are both kept under
  `$TMPDIR/infobroker/research-tests/<run>/` for the life of the temp root.
- Evaluation: `scripts/test-research/evaluate-research.mjs`. Two harness defects
  found during these runs were fixed first (`7de2192`, `bacf3e6`): the suite
  aborted silently after one scenario, and the MCP-engagement audit missed
  Code Mode calls (`tools.infobroker.<tool>` inside `execute`).
- Already recorded before this run: A1a, A1b, S3, N1 (audience pair, negative
  cases). This record covers the rest.

## Results

| Scenario | Persona | Shape | Verdict | Notes |
|---|---|---|---|---|
| S1 | backend engineer | competitive-evaluation | pass | 16 URLs; consistency, cost and ecosystem compared; matrix and recommendation present. The first attempt of this scenario emitted the generic `research complete.` token instead of the shape token — recorded as a run result, not re-prompted. |

_(remaining rows added as batches complete)_
