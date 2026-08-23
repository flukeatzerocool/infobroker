# Workflow Shapes

Canonical definitions for every research workflow the orchestrator routes.
The orchestrator's Phase 0 Classify gate maps user intent to one of these
shapes, then executes the shape's tool sequence. Read only the shape you
route to — sections are independent.

## Shared Primitives

Every shape composes from these steps; a shape names the steps it uses
rather than restating them.

- **RECALL** — `kb` (action search) before any external request. Fresh
  hits may satisfy the task without leaving the local store.
- **SEARCH** — `web_search` (multi-provider, auto-selection, fallback
  chain). Use `corroborate` when a claim is contested.
- **EXTRACT** — `fetch_page` on promising URLs for full content.
- **VERIFY** — cross-reference across sources, score confidence, flag
  contradictions explicitly.
- **WRITE** — `technical-writing` for the deliverable.
- **POLISH** — `proofreading` for language quality.
- **TRANSLATE** — `translation` when the target language is not English.
- **CITE** — source URLs with every factual claim.

Each shape ends with a grepable one-line status token in the form
`<shape> complete. <key counts> | <remaining gaps>`.

## Research & Write (default)

**Trigger:** open-ended research that ends in a written artifact.

**Pipeline:** RECALL → SEARCH → EXTRACT → VERIFY → SUMMARIZE
(`summarization`) → WRITE → POLISH → TRANSLATE (if needed) → CITE.

**Token:** `research complete. <N> sources | <K> findings | <gap> gaps noted`.

## Fact-Check

**Trigger:** verify specific claims from user input.

**Pipeline:** RECALL → extract claims → SEARCH per claim → `corroborate`
cross-reference → verdict → `summarization` digest → CITE.

**Verdict:** True, Mostly True, Half True, Mostly False, False, or
Unverifiable, each with a 0.0–1.0 confidence and a justification. Split
bundled claims; discard opinions as "not checkable."

**Token:** `fact-check complete. <N> claims | <T/M/H/MF/F/U> verdicts`.

## Deep-Dive

**Trigger:** systematic multi-subtopic investigation with citations.

**Pipeline:** scope & clarify → parallel SEARCH (2–3 query angles per
subtopic) → EXTRACT primary sources → VERIFY & triangulate → synthesize a
structured report (theme-grouped, high-confidence findings first).

**Token:** `deep-dive complete. <N> subtopics | <K> themes | <C> contradictions`.

## Gated Analysis

**Trigger:** high-stakes, decision-driving questions needing rigor.

**Route:** escalate to the `analysis-loop` skill — graded sources,
structured analytic techniques, refinement rounds. Do not run this shape
inline.

**Token:** `analysis-loop complete.` (emitted by the skill itself).

## Competitive Evaluation

**Trigger:** compare options, tools, vendors, or approaches ("which X is
best", "X vs Y", "evaluate these options").

**Pipeline:** define explicit criteria → RECALL → SEARCH per option →
EXTRACT → VERIFY → score each option against criteria → weighted decision
matrix → recommendation with justification.

**Output:** a criteria-by-option matrix, a recommendation, and the
rationale with confidence. Flag criteria lacking evidence as gaps.

**Token:** `evaluation complete. <N> options | <M> criteria | winner: <x>`.

## Literature Review

**Trigger:** review a body of scholarly work ("state of the art",
"related work", "systematic review").

**Pipeline:** define inclusion/exclusion criteria → SEARCH scholarly chains
(Semantic Scholar, arXiv, CORE) → deduplicate → screen by title/abstract →
EXTRACT full texts → theme synthesis → gap analysis → related-work section.

**Output:** thematic synthesis, explicit inclusion criteria, a gap analysis
naming what is absent, and a source register.

**Token:** `lit-review complete. <N> works screened | <M> included | <G> gaps`.

## Monitoring / Delta

**Trigger:** track a topic across time ("what changed", "monitor X",
"watch this", "weekly briefing").

**Pipeline:** establish baseline → `kb` freshness check → re-SEARCH →
compare to baseline → report only the deltas → ingest the new results.

**Output:** a change report listing what is new or removed since the
baseline, dated, with the delta flagged — not a full re-summary.

**Token:** `monitor complete. <N> new | <M> changed | <K> removed since <date>`.

## Adversarial / Red-Team

**Trigger:** stress-test a plan, product, or conclusion ("what could go
wrong", "argue against", "red-team this").

**Pipeline:** restate the claim → SEARCH for disconfirming evidence →
attack each assumption → list failure modes and weaknesses → grade each
by likelihood and impact.

**Output:** a weakness register, an assumptions list with attack surface,
and an overall robustness verdict. No softening — the job is to find breaks.

**Token:** `red-team complete. <N> assumptions | <M> weaknesses | <K> unbroken`.

## Vetting / Due-Diligence

**Trigger:** verify a person, organization, or product ("vet X",
"background check", "is this legit", "due diligence").

**Pipeline:** define the checklist → RECALL → SEARCH per checklist item →
`corroborate` on contested items → grade each source for reliability →
flag red flags.

**Output:** a checklist with verified/partial/unverified per item, source
grades, and a red-flag register. Unverifiable items are stated, not assumed.

**Token:** `vetting complete. <N> items | <V> verified | <R> red flags`.
