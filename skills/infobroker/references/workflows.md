# Workflow Shapes

Canonical definitions for every research workflow the orchestrator routes.
The orchestrator's Phase 0 Classify gate maps user intent to one of these
shapes, then executes the shape's tool sequence. Read only the shape you
route to — sections are independent. For the ordered classification
questions and the escalation rubric, see `decision-tree.md`; for each
shape's output structure, see `report-template.md`; for the single confidence,
likelihood, and source-grade scale, see `confidence.md`; for how
`verify_claims` reaches a verdict, see `corroboration.md`. Every report is
validated by `scripts/validate-report.ts` (REQ-116) before it is delivered.

## Shared Primitives

Every shape composes from these steps; a shape names the steps it uses
rather than restating them.

- **RECALL** — `search_web` performs KB-first recall automatically before
  external providers; use a direct `manage_kb (action: search)` only when stored
  content alone can answer the task or to inspect the store. When a prior
  `verify_claims` run already settled the question, read the persisted rows
  with `manage_kb (action: claims)` instead of searching again. When
  publishing or reusing an archived report, `manage_kb (action: verify_report)`
  rechecks its receipt against the cached sources offline.
- **SEARCH** — `search_web` (multi-provider, auto-selection, fallback
  chain). Use `verify_claims` when a claim is contested; use `search_web (deep)`
  when you want passages read from the top results, not just snippets.
  Add `search_web (analyze)` when you want topic terms, entity mentions,
  result clusters, and a dated timeline computed from the results already
  returned (no extra outbound request).
  Use `search_web (research)` (multi-variant fan-out with deep reads) only for the
  Deep-Dive, Competitive Evaluation, and Gated Analysis shapes — it is
  token-expensive, and simple lookups never escalate to it.
- **EXTRACT** — `fetch_page` on promising URLs for full content; use
  `fetch_page (question)` on a page you are reading to answer a specific question, so only
  the ranked passages that address it are returned. For a one-call
  search-and-read, `search_web (deep)` returns ranked passages per
  source.
- **VERIFY** — cross-reference across sources, score confidence on the
  `confidence.md` scale, flag contradictions explicitly. Use `verify_claims`
  for contested claims and read its result per `corroboration.md`.
- **WRITE** — `technical-writing`, filling the shared skeleton, the
  `report-manifest` block, and the routed shape's block in
  `report-template.md`; the orchestrator passes the shape, audience, and
  target length. Every shape uses the shared skeleton unless its block says
  "skeleton omitted".
- **REDRAFT-CHECK** — the FACT-CHECK DRAFT step: extract every claim from the
  draft and verify them in one `verify_claims (claims: [...])` batch call. Fix
  what the evidence does not support (attribute, soften to the source's
  `modality`, or delete), then re-run the batch once to confirm. Carry each
  claim's `modality` and `attribution` into the manifest; never upgrade a
  hedged source to a flat assertion.
- **VALIDATE** — run `scripts/validate-report.ts --report <file>`; fix every
  error before delivering (missing section or shape block, uncited or
  unlabeled finding, unresolved `[S#]`, register row missing a grade, date, or
  URL, invalid manifest value).
- **ARCHIVE** — ingest the finished report with `source_type: "report"` and a
  `receipt` carrying the manifest claims and sources; a later `RECALL` runs
  `verify_report` to surface source drift before reuse.
- **POLISH** — `proofreading` for language quality.
- **TRANSLATE** — `translation` when the target language is not English;
  keep the canonical section headings.
- **REVALIDATE** — run the report validator again on the final artifact after
  polish and translation.
- **ARCHIVE** — ingest the finished report with a receipt; on recall, verify
  the receipt before reuse.
- **CITE** — every factual claim carries an inline `[S#]` marker resolving to
  the Source Register, whose row carries the URL.

Each shape ends with a grepable one-line status token in the form
`<shape> complete. <key counts> | <remaining gaps>`.

## Research & Write (default)

**Trigger:** open-ended research that ends in a written artifact.

**Pipeline:** RECALL → SEARCH → EXTRACT → VERIFY → SUMMARIZE
(`summarization`) → WRITE → REDRAFT-CHECK → VALIDATE → POLISH → TRANSLATE
(if needed) → REVALIDATE → ARCHIVE → CITE.

**Technique:** Key Assumptions Check on the report's central thesis before
writing.

**Token:** `research complete. <N> sources | <K> findings | <gap> gaps noted`.

## Fact-Check

**Trigger:** verify specific claims from user input.

**Pipeline:** RECALL → extract claims → SEARCH per claim → `verify_claims`
cross-reference → verdict → `summarization` digest → WRITE (shared skeleton +
verdict table) → REDRAFT-CHECK → VALIDATE → POLISH → TRANSLATE (if needed) →
REVALIDATE → ARCHIVE → CITE.

**Verdict:** True, Mostly True, Half True, Mostly False, False, Misleading,
Mixture, or Unverifiable, each with a confidence label, a likelihood term
where probabilistic, and a justification. Split bundled claims; discard
opinions as "not checkable."

**Technique:** Quality-of-Information Check — grade each source used for a
verdict; hold every claim to primary sources where they exist.

**Token:** `fact-check complete. <N> claims | <T/M/H/MF/F/U> verdicts`.

## Deep-Dive

**Trigger:** systematic multi-subtopic investigation with citations.

**Pipeline:** scope & clarify → parallel SEARCH (2–3 query angles per
subtopic) → EXTRACT primary sources → VERIFY & triangulate → synthesize a
structured report (theme-grouped, high-confidence findings first).

**Technique:** Decomposition (topic tree) to split subtopics; Analysis of
Competing Hypotheses on any contested finding.

**Output:** the Deep-Dive block in `report-template.md` — a subtopic coverage
matrix, theme-grouped synthesis, cross-subtopic contradictions, and open
questions — plus the shared skeleton.

**Token:** `deep-dive complete. <N> subtopics | <K> themes | <C> contradictions`.

## Gated Analysis

**Trigger:** high-stakes, decision-driving questions needing rigor.

**Route:** escalate to the `analysis-loop` skill — graded sources,
structured analytic techniques, refinement rounds. Do not run this shape
inline.

**Technique:** selected inside the skill by its technique-selection gate
(`references/techniques.md`), not here.

**Token:** `analysis-loop complete.` (emitted by the skill itself).

## Competitive Evaluation

**Trigger:** compare options, tools, vendors, or approaches ("which X is
best", "X vs Y", "evaluate these options").

**Pipeline:** define explicit criteria → RECALL → SEARCH per option →
EXTRACT → VERIFY → score each option against criteria → weighted decision
matrix → recommendation with justification.

**Technique:** Decision Matrix — criteria defined and weighted before scoring.

**Output:** a criteria-by-option matrix, a recommendation, and the
rationale with confidence. Flag criteria lacking evidence as gaps.

**Token:** `evaluation complete. <N> options | <M> criteria | winner: <x>`.

## Literature Review

**Trigger:** review a body of scholarly work ("state of the art",
"related work", "systematic review").

**Pipeline:** define inclusion/exclusion criteria → SEARCH scholarly chains
(Semantic Scholar, arXiv, CORE) → deduplicate → screen by title/abstract →
EXTRACT full texts → theme synthesis → gap analysis → related-work section.
Record identified, deduplicated, screened, excluded (with reasons), and
included counts in the PRISMA-style flow block.

**Technique:** inclusion/exclusion screening (systematic-review method) with a
theme synthesis across included works.

**Output:** thematic synthesis, explicit inclusion criteria, a gap analysis
naming what is absent, and a source register.

**Token:** `lit-review complete. <N> works screened | <M> included | <G> gaps`.

## Monitoring / Delta

**Trigger:** track a topic across time ("what changed", "monitor X",
"watch this", "weekly briefing").

**Pipeline:** establish a baseline report with a receipt → on the next run,
`manage_kb (action: verify_report)` to surface source drift and unverifiable
sources → `manage_kb (action: stats)` freshness check → re-SEARCH → compare to
the baseline → report only the deltas → ingest a new report revision with
`supersedes` set to the baseline identity.

**Technique:** Indicators — define signposts for the topic before comparing,
so the delta is reported against what would confirm or weaken change.

**Output:** a change report listing what is new or removed since the
baseline, dated, with the delta flagged — not a full re-summary.

**Token:** `monitor complete. <N> new | <M> changed | <K> removed since <date>`.

## Adversarial / Red-Team

**Trigger:** stress-test a plan, product, or conclusion ("what could go
wrong", "argue against", "red-team this").

**Pipeline:** restate the claim → SEARCH for disconfirming evidence →
attack each assumption → list failure modes and weaknesses → grade each
by likelihood and impact.

**Technique:** Devil's Advocacy — build the strongest case against the plan,
then grade each weakness; no softening.

**Output:** a weakness register, an assumptions list with attack surface,
and an overall robustness verdict. No softening — the job is to find breaks.

**Token:** `red-team complete. <N> assumptions | <M> weaknesses | <K> unbroken`.

## Vetting / Due-Diligence

**Trigger:** verify a person, organization, or product ("vet X",
"background check", "is this legit", "due diligence").

**Pipeline:** define the checklist → RECALL → SEARCH per checklist item →
`verify_claims` on contested items → grade each source for reliability →
flag red flags.

**Technique:** Quality-of-Information Check — grade each source's
reliability and each claim's credibility separately.

**Output:** a checklist with verified/partial/unverified per item, source
grades, and a red-flag register. Unverifiable items are stated, not assumed.

**Token:** `vetting complete. <N> items | <V> verified | <R> red flags`.
