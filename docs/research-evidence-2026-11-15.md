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

## Token-carrier re-run (2026-11-15, repo mode)

The carrier fix from increment `2026-11-15-shape-token-authority` moved every
shape token into one Phase 0 list and deleted the two in-pipeline literals. The
same S6 scenario was re-run against the working tree's own skills.

```
./scripts/test-research.sh --mcp=repo --only=S6   # run-20261115-151159
```

The suite reported `project layer declares /home/fluke/Infobroker/skills`, and
`mcp-target.txt` carries `skills:/home/fluke/Infobroker/skills`.

| ID | Suite | Close criterion | Attribution |
|---|---|---|---|
| S6 | **pass** — `1/1 scenarios passed`, `missingSections: []` | **met** | `vetting complete.` as the reply's final line, with the Vetting block applied |

Token emitted, verbatim (final line of the reply):

- S6 — `vetting complete. 14 items | 10 verified | 11 red flags`

Sections carried: `## Methodology & Scope`, `## Checklist`, and
`## Red-Flag Register` are all present in the transcript
(`run-20261115-151159/S6/turn0.txt`), so the block that the previous run never
opened is now applied. The suite's section needles (`checklist`, `red flag`,
`verified`) all matched; 21 source URLs, `verify_claims` and Infobroker
engagement both recorded.

Both roadmap sections close on this result: the token the S6 route emits is its
own shape's, and N4 (above) already emits `analysis-loop complete.` with an
Uncertainty Register, which is the pair its trigger names. The remaining N4
`zero usable` needle is a separate, still-open item.

## Harness closeout (2026-11-15, later)

Two harness defects recorded at the top of this document are fixed: the suite
no longer aborts after a timed-out turn (`7813ef2`), and repo-mode Lab runs now
assert the working tree's skills (`b97b3b2`, D-130). The remaining N4
`zero usable` needle was widened to accept synonyms (`f11e22a`), but the
re-run failed for a different, newly recorded reason: repo mode does not
isolate `kb.storage_path`, so the run recalled this question's own earlier
reports as sources and never reached a zero-source conclusion. That item stays
open and is scheduled on `ROADMAP.md` as KB isolation; the token-scope contract
it shares with S9 is stated in `test-fixtures/research/README.md` and S9 passes
under it (`a92f13a`).

## KB isolation and the N4 routing residual (2026-11-15, later)

Repo mode now pins a run-scoped knowledge base. Both entry points build their
layer through `scripts/lib/repo-mode.ts`: `kb.storage_path` and
`kb.reports_dir` resolve under `$RUN_DIR/kb`, and `mcp-target.txt` records both
paths beside the MCP and skills targets (D-131). The `constrained` Lab profile
keeps its explicit `kb: null`.

Two repo-mode N4 runs, with the isolated store:

| Run | Result | Detail |
|---|---|---|
| `run-20261115-173144` | **fail** | no `analysis-loop complete.`; no Uncertainty Register; zero-source conclusion reached ("no such entity") |
| `run-20261115-173322` | **fail** | same; `mcp-target.txt` carries `kb:…/kb/knowledge-base` and `kb:…/kb/reports` |
| `run-20261115-174442` (S9) | **pass** | multi-turn gated run under `token_scope: session`, same isolated-layer build |

Isolation is proven: neither run recalled a prior `report://` artifact, both
recorded the isolated path, and the store was created empty under the run root.
The roadmap's KB-isolation close condition ("a repo-mode run records an
isolated KB path in its run artifacts") is met, so that section is removed.

The N4 failures are routing, not wording. Both runs classified the request as
fact-check / vetting and answered as Research & Write
(`turn0.txt`: "This is a fact-check / vetting question about a specific named
entity"), so the gated block that carries the Uncertainty Register never
opened. The needle and token-scope items therefore stay open with their
residual restated — the 2026-11-15 needle widening is not what fails; the
scenario's `gated-analysis` expectation is. S9 passes under the same
`token_scope: session` contract and the same isolated layer
(`run-20261115-174442`), so the multi-turn side is intact.

A side observation from `run-20261115-173322`: `verify_claims` returned the
run's own claim text as `report://` sources, which the agent correctly rejected
as self-referential. Not investigated here.

## Named gated marker (2026-11-15, later)

The skill's routing surfaces disagreed with their own references: Phase 0's
Gated Analysis row listed only conditional markers, while `workflows.md` and
the decision-tree tie-breaker already selected Gated Analysis for an explicit
gated request. Phase 0, "When to Escalate", the decision-tree's first question,
and the journeys row now carry the named marker (`gated research / gated
analysis / confidence-scored research`), and `validate-spec` asserts it under
REQ-052 (D-132).

The routing outcome did not change:

| Run | Result | Detail |
|---|---|---|
| `run-20261115-182713` | **fail** | never loaded the infobroker skill (tools: `websearch`, `execute`); answered Research & Write |
| `run-20261115-182956` | **fail** | loaded the skill (`skill:infobroker`); still answered Research & Write, no `analysis-loop` |

Both runs recorded `kb:` lines for the run-scoped store, so the isolated-layer
guarantee held. The negative result is the finding: prose on the Phase 0
surface is not the lever that moves the route.

Regression guards, recorded as-is:

- `run-20261115-183934` (N1) — fail: emitted `research-collection complete.`
  (the absent token) and no `clarif` section. N1's high-stakes input already
  routed gated before this change; the failure is the skipped scoping gate, so
  it is not attributed to the marker, but it is not evidence of no harm either.
- `run-20261115-185913` (S6) — timeout after 1800 s; recorded as that
  scenario's failure, no verdict.

Both roadmap items stay open. The next lever is outside this increment: either
the suite prompt/skill invocation makes the gated route explicit, or the
routing expectation is re-scoped.
