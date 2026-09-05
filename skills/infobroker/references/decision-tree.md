# Decision Tree — Shape, Tool, and Escalation Selection

Companion to the `infobroker` `SKILL.md` Phase 0 classify gate and the tool
selection guide. Answer the questions in order; the first affirmative answer
points to the choice. When nothing matches, use the default at the end of each
section. Cross-reference `workflows.md` for each shape's pipeline and
`journeys.md` for the per-intent routing.

## 1. Choose the workflow shape

Ask, in order:

1. Is this high-stakes or decision-driving, and does it need source-reliability
   grading plus a structured analytic technique? → **Gated Analysis**
   (escalate to `analysis-loop`). See §3 for the escalation rubric.
2. Is the user asking you to verify specific claims they supplied ("is it
   true", "fact-check", "verify")? → **Fact-Check**.
3. Is the user asking you to compare or choose among options ("which X is
   best", "X vs Y", "evaluate these")? → **Competitive Evaluation**.
4. Is the user asking for a scholarly synthesis ("state of the art",
   "related work", "literature review")? → **Literature Review**.
5. Is the user asking what changed since a prior point ("monitor", "track",
   "brief me since")? → **Monitoring / Delta**.
6. Is the user asking you to attack a plan or conclusion ("what could go
   wrong", "argue against", "red-team")? → **Adversarial / Red-Team**.
7. Is the user asking you to check a person, organization, or product
   ("vet", "background check", "is it legit")? → **Vetting / Due-Diligence**.
8. Is the request a systematic multi-subtopic investigation (several distinct
   sub-questions, each needing its own sources)? → **Deep-Dive**.
9. Otherwise → **Research & Write** (the default).

**Tie-breakers.** When two shapes plausibly fit:

- Fact-Check vs Research & Write — if the user supplied concrete claims with a
  truth question, fact-check; if they asked for a topic report, research & write.
- Vetting vs Research & Write — if the object is a person/organization/product
  to be cleared or flagged, vetting; if it is a topic to be described, research.
- Deep-Dive vs Research & Write — if the request has named sub-questions or
  "comprehensive" and needs per-subtopic sourcing, deep-dive; if it is a single
  through-line, research & write.
- Competitive Evaluation vs Deep-Dive — if the deliverable is a recommendation
  among named options, evaluation; if it is a survey without a decision, deep-dive.

## 2. Choose the tool

Given a single step in the pipeline, pick by condition:

| Condition | Tool |
|-----------|------|
| Broad search; KB may already hold the answer | `web_search` (KB-first is automatic) |
| Answer entirely from stored content, or inspect/maintain the KB | `manage_kb` (action search / list / stats / get) |
| A claim's truth is contested and needs multi-source cross-reference | `verify_claims` |
| You have a URL and need readable content | `fetch_page` |
| You have a URL and a specific question about it | `fetch_page` with `question` |
| You need BibTeX references for scholarly writing | `get_citations` |
| You need query autocomplete | `web_search` with `suggest: true` |
| You need ranked passages from the top results, not links | `web_search` with `deep: true` |
| You need query variants before a deep search | `web_search` with `expand: true` |
| Unsure which backend to trust | `inspect_providers` (action list / health) |
| Config changed and must take effect now | `reload_config` |
| Archive a finished report | `manage_kb` (action ingest, `source_type: "report"`) |

Rule of thumb: `web_search` for lookups and uncontested breadth;
`verify_claims` when agreement across independent sources decides the answer.

## 3. Escalate to `analysis-loop`?

Score one point for each that holds. Escalate at **3 or more**.

- **Stakes.** A wrong answer has real cost (budget, safety, policy, reputation).
- **Decision.** The answer directly drives a decision the user must make.
- **Contest.** The claim is contested or likely to have partisan sources.
- **Breadth.** The question decomposes into multiple EEIs needing graded sources.
- **Reproducibility.** The user needs a confidence-scored, source-graded audit trail.

Below 3, run the `infobroker` pipeline. At 3+, escalate to `analysis-loop`.

## 4. Edge-case recovery

| Symptom | Action |
|---------|--------|
| `web_search` returns empty or slow | `inspect_providers` (health) → a provider may be exhausted or in cooldown; rephrase the query |
| A provider is exhausted (quota 100%) | Let the fallback chain skip it; retry after reset, or `reload_config` to adjust limits |
| A provider returns 429/anti-bot | The server holds it in cooldown (`output.rate_limit_cooldown_ms`); retry later or switch task type |
| Infobroker tool errors | Fall back to built-in `websearch`/`webfetch`, then report the degraded confidence |
| KB is locked (encryption) | `manage_kb` action encryption → `status` → `verify` candidate key → `rekey`; see `journeys.md` |
| No sources found for a finding | Report it as a gap; broaden query angles (see `workflows.md` Monitoring/Delta for baseline reuse) |
| Sources disagree | Report both sides with reliability grades; do not pick the loudest (see `corroboration.md`) |
