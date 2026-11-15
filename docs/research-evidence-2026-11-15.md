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
| S2 | journalist | fact-check | pass | Three claims with verdicts, confidence and a source register; KB ingest returned a report id. 10 URLs. |
| S4 | market researcher | monitoring | pass | Emitted `monitor complete.`; delta against a baseline with new/changed/removed separated; 15 URLs. |
| S5 | CTI analyst | red-team | pass | Emitted `red-team complete. 9 assumptions | 15 weaknesses | 2 unbroken`. No URLs in the answer — the target was the user's own plan, so the shape had nothing external to cite; recorded, not treated as a failure. |
| S6 | business analyst | vetting | **fail** | Hard gate: the run escalated to the `analysis-loop` shape and ended `analysis-loop complete. …` instead of `vetting complete.`. Everything else passed (28 URLs, `verify_claims` called). Shape-selection ambiguity between vetting and gated analysis, not an execution defect. |
| S7 | engineer | research-write | pass | Ended `research complete. 15 sources | 6 findings | 4 gaps noted`; 15 URLs. Scored as no MCP engagement until the Code Mode fix (`6bf4aed`); re-evaluated transcript passes. |
| S8 | CISO | deep-dive | pass | 21 URLs, all four sampled citations reachable; themes and contradictions present. |
| S9 | decision-maker (CTO) | gated-analysis | pass | Escalated to `analysis-loop` as the shape intends; 15 URLs, five sampled citations reachable. |
| S10 | researcher | translation | pass | Delivered the translated output with canonical headings retained; 13 URLs, three sampled citations reachable. |
| M1 | decision-maker (CTO) | multiturn (gated-analysis) | pass | Two-turn run; the follow-up turn kept the session and closed the analysis with the acceptance token. No URLs in the final text. |
| M2 | decision-maker (CTO) | multiturn (gated-analysis) | pass | Two-turn run; 28 URLs, one sampled citation returned an error (site-side, advisory). |
| N2 | researcher | negative (research-write) | pass | Single-source premise handled as such; 24 URLs. |
| N3 | journalist | negative (fact-check) | pass | Contradiction surfaced with both sides and a verdict rather than a flat claim; no URLs in the final text. |
| N4 | researcher | negative (gated-analysis) | **fail** | Asked for gated research on an unannounced service; the run produced a careful fact-check that refused to fabricate (verdicts, 6 URLs, archived report) but took the fact-check route: it ended `fact-check complete. …` and carried no Uncertainty Register and no explicit "zero usable sources" statement. Content was sound; the shape and its required block were not the ones the manifest asserts. |

## Summary

13 scenarios run in repo mode across three batches: **11 pass, 2 hard-gate failures**, plus S1 passing on its second attempt.

Both failures are shape-selection divergences, not execution or evidence defects:

- **S6 (vetting)** escalated to `analysis-loop` and emitted that shape's token.
- **N4 (negative gated-analysis)** answered as a fact-check and emitted that shape's token, while refusing to fabricate — the safe answer, wrong routing.

Everything else passed: every scenario engaged the MCP, `verify_claims` ran on the contested cases, and sampled citations were reachable apart from site-side blocks and one transient error. Two harness defects were fixed before the batches could produce usable rows (`7de2192`, `6bf4aed`).

The shape divergence was filed on `ROADMAP.md` rather than treated as run noise: it repeated across two independent personas.

## Repo-mode skills target (2026-11-15)

`--mcp=repo` overrode the MCP server but not the client's `skills` list, so a
repo-mode run exercised whatever the ambient config named — on this machine the
deployed copy. The run project now declares `<repo>/skills` and refuses to start
when the captured `opencode debug config` does not report that entry.

Recorded run: `./scripts/test-research.sh --mcp=repo --only=S2`
(port 39423, run dir `$TMPDIR/infobroker/research-tests/run-20261115-123216`).

- Suite header: `project layer declares /home/fluke/Infobroker/skills`; S2
  passed 1/1.
- `mcp-target.txt`: `repo:<run>/mcp-project` and
  `skills:/home/fluke/Infobroker/skills`.
- Load proof: an untracked `skills/zz-repo-mode-probe/SKILL.md` (repo-only, so
  absent from the deployed copy) was loaded in the retained run project and the
  reply was `PROBE-7F3A`. Transcript: `run-20261115-123216/mcp-project` session
  log in the same run directory; the probe was removed afterwards.

The assertion proves configuration, not cross-layer precedence when two roots
define the same skill name (D-129).

## Shape-selection re-run (2026-11-15, repo mode)

The precedence rule from `77c3759` was re-run against S6 and N4 with the working
tree's own skills, one scenario per invocation so a timeout cannot abort the
next. Increment `2026-11-15-shape-selection-closeout`.

```
./scripts/test-research.sh --mcp=repo --only=S6   # run-20261115-135734
./scripts/test-research.sh --mcp=repo --only=N4   # run-20261115-141647
```

Both runs reported `project layer declares /home/fluke/Infobroker/skills` and
`skills:/home/fluke/Infobroker/skills` in `mcp-target.txt`.

| ID | Suite | Close criterion (shape token) | Attribution |
|---|---|---|---|
| S6 | fail — no `vetting complete.`, no `checklist` section | **not met** | content is vetting ("I ran this as a vetting/due-diligence job", red-flag register, per-source grades, `verify_claims`), so the route held and the **token carrier** failed; no `Methodology` section and no `## Checklist`, so the Vetting block in `report-template.md` was never applied |
| N4 | fail — `zero usable` section only | **met** | `## Uncertainty Register` present (`:9648`), zero-source conclusion stated as "nonexistent", three gaps named; only the manifest's literal `zero usable` phrasing is absent |

Tokens emitted, verbatim:

- S6 — `research complete. 25 sources | 14 findings | 5 gaps noted` (the default
  shape's literal, from `skills/infobroker/SKILL.md:145`, not the vetting token
  at `references/workflows.md:244`).
- N4 — `analysis-loop complete. 5 findings | Confidence: 1/4/0 | 10 sources | 3
  gaps accepted`, as the final content of the reply.

N4's outcome differs from the 2026-11-15 batch, where it answered as a
fact-check and emitted that shape's token: the gated route now holds. S6's
outcome also differs — earlier it escalated to `analysis-loop`, now it runs
vetting content but signs off with the default shape's token.

The roadmap section therefore stays open: its close condition is the token, and
S6 does not emit it. Two follow-on items are filed — the token literal sitting
inside the default pipeline, and N4's prose-literal needle.
