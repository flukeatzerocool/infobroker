---
name: analysis-loop
description: >
  Use when the user asks to research a topic, investigate a question, or
  produce structured findings with cited, confidence-scored sources.
  Four-phase disciplined workflow modeled on the cyber threat intelligence
  lifecycle: scope → collect → analyze → refine. Use ONLY for systematic,
  gated research — not quick lookups or single-source Q&A.

  <example>
  User: "Research the current state of quantum-resistant cryptography
  adoption — what's deployed vs. theoretical?"
  </example>

  <example>
  User: "Investigate supply chain attacks targeting npm registries in
  2025-2026. Confidence-scored findings with citations."
  </example>

  Do not use for simple factual questions or when the infobroker skill
  is already loaded and has routed the request to a lighter workflow.
metadata:
  version: "1.0"
  category: research
---

# Analysis Loop

Disciplined research workflow: scope the question → collect and assess
sources → analyze and synthesize → disseminate and refine. One question
completes its full cycle before the next starts.

## When NOT to Use

- Single-source factual lookup — use `web_search` directly.
- The user wants the AI's internal knowledge, not web research.
- The `infobroker` skill is already loaded and routed the request to a
  lighter workflow shape — those handle lighter research. This skill is for
  when rigor matters.

## Phase 0 — Question Scoping

The most important phase. A poorly scoped question produces garbage output
regardless of collection quality. Modeled on CTI Planning & Direction.

### If the user's question is vague

Ask targeted clarifying questions. Use these dimensions:

1. **Intelligence requirement.** What decision does this research serve?
   "I want to know about AI safety" is not scoped. "I need to decide whether
   to adopt an AI safety policy for our LLM deployment, and I need to know
   what current regulatory frameworks require" is.

2. **Essential Elements of Information (EEIs).** Decompose into specific,
   answerable sub-questions. Example for "Is Rust ready for kernel
   development?":
   - Which major kernels/OS projects have merged Rust code?
   - What are the current limitations of Rust in kernel contexts?
   - What toolchain support exists for cross-compilation to kernel targets?
   - What is the community and maintainer stance?

3. **Scope boundaries.** State what is explicitly out of scope. Example:
   "Linux kernel only — not Windows, BSD, or embedded RTOS."

4. **Priority tiering.** Classify sub-questions:
   - **Must answer** — core; research is incomplete without this.
   - **Should answer** — important context.
   - **Could answer** — nice-to-have.

5. **Audience and format.** Who consumes this? CISO needs executive summary
   and risk ratings. Engineer needs technical depth. Researcher needs full
   methodology and citation trail.

6. **Time horizon.** Tactical (this session), operational (this week), or
   strategic (no immediate deadline). Governs depth.

**Gate.** Confirm before any search:

```
research-scoping passed. Question: <one-line> | EEIs: <N> |
Scope: <boundaries> | Format: <audience> | Horizon: <tactical/operational/strategic>
```

## Phase 1 — Collection & Source Assessment

Gather raw data and assess quality before analysis. Maps to CTI Collection
and Processing.

### Collection

Collection is executed with live lookups, never from model memory. Every
finding must trace to a source fetched this session — including when the
user answers scoping questions with "proceed with defaults" or closes a gap:
you still run the collection tools for that scope before analyzing.

1. **Query plan.** For each EEI, generate 2–3 variant search queries with
   different angles. A question about Rust kernel adoption should also be
   searched as "Rust kernel limitations challenges" (critical angle).

2. **Fetch full pages.** Use `infobroker_infobroker_fetch_page` for promising
   results. Do not rely on snippets — they lack the evidence needed for
   confidence scoring.

3. **Note collection gaps.** An EEI with no sources found is itself a finding.

### Source assessment

Grade every source used:

**Source Reliability:**
| Grade | Meaning |
|-------|---------|
| A | Completely reliable — primary source, official docs, peer-reviewed |
| B | Usually reliable — established publication, known expert |
| C | Fairly reliable — secondary source, editorial standards, occasional errors |
| D | Not usually reliable — unverified, anonymous, known bias |
| E | Unreliable — known misinformation |
| F | Cannot be judged — insufficient track record |

**Information Credibility:**
| Grade | Meaning |
|-------|---------|
| 1 | Confirmed by multiple independent sources |
| 2 | Probably true — confirmed by one other source |
| 3 | Possibly true — plausible but uncorroborated |
| 4 | Doubtful — conflicts with other sources or known facts |
| 5 | Improbable — likely disinformation or error |
| 6 | Cannot be judged |

A source graded C3 means "fairly reliable source, possibly true but
uncorroborated." A1 means "completely reliable, confirmed by multiple
independent sources."

### Reflexion gate

Before analysis, self-check:

- Did I actually call the search/fetch tools this session, or did I answer
  from memory? If no collection tool produced the sources, return to
  collection — findings from memory are not admissible.
- Did I search every EEI with at least 2 query angles?
- Did I fetch full pages for key sources, not just rely on snippets?
- Did I grade every source for reliability and credibility?
- Did I note collection gaps?
- Did I search for disconfirming evidence, not just confirming evidence?

If any check fails, return to collection.

**Gate:**

```
research-collection complete. <N> sources across <M> EEIs |
Reliability range: <lowest-highest> | <K> gaps
```

## Phase 2 — Analysis & Synthesis

Turn processed information into intelligence. Maps to CTI Analysis.

### Analysis

1. **Cross-reference.** Compare findings across sources for each EEI. Weight
   by reliability — an A1 source contradicting a D3 source is not a tie.

2. **Confidence scoring.** Assign to each key finding:
   - **High** — A1 or A2 sources, multiple independent confirmations, no
     credible contradictory evidence.
   - **Medium** — B-level sources, some corroboration, minor inconsistencies.
   - **Low** — C-level or below, single source, significant contradictions.
   - **No confidence** — no reliable source found.

3. **Contradictions.** When sources disagree: report both sides with their
   reliability grades. Note whether the disagreement is factual (same claim,
   different facts) or interpretive (same facts, different conclusions).

4. **Structured analytic techniques.** Apply at least one:
   - **Analysis of Competing Hypotheses (ACH)** — list explanations, evaluate
     evidence for/against each.
   - **Key Assumptions Check** — which assumptions underpin each finding?
     Which would change the conclusion if wrong?
   - **Devil's Advocacy** — argue against the strongest finding. Does it hold up?

### Synthesis

```
## Executive Summary
[3-5 sentence synthesis of highest-confidence findings]

## Findings by EEI
### EEI #1: [sub-question]
**Finding:** [1-2 sentences]
**Confidence:** High/Medium/Low
**Sources:** [grades]
**Contradictions:** [if any, with grades]
**Gaps:** [what remains unknown]

[...repeat for each EEI...]

## Source Register
| # | Source | Type | Reliability | Credibility | URL |
|---|--------|------|-------------|-------------|-----|

## Uncertainty Register
- [finding]: Low — single B3 source, not corroborated
- [finding]: Contested — A2 vs C4 sources disagree
- [gap]: EEI #3 has no sources found
```

### Reflexion gate

Self-check before presenting:

- Does every finding have a confidence score with justification?
- Are contradictions reported explicitly with both sides?
- Did I apply at least one structured analytic technique?
- Are source reliability grades included in the source register?
- Do I distinguish what I *know* from what I *infer*?

If any check fails, return to analysis.

**Gate:**

```
research-analysis complete. <N> findings | Confidence: <H>/<M>/<L> |
<K> contradictions | <G> gaps
```

## Phase 3 — Dissemination & Refinement

Maps to CTI Dissemination and Feedback. Deliver findings and close the loop
on gaps.

### Dissemination

Adapt vocabulary and depth to the audience defined in Phase 0. A CISO needs
"finding is well-supported by multiple authoritative sources" — not an
Admiralty Code explainer. Lead with the executive summary for executive
audiences; lead with EEI findings for technical audiences.

### Refinement

After dissemination, the user may challenge findings, identify gaps, or
request deeper sourcing. Each round:

1. **Challenge.** Re-examine sources. Run targeted search on the disputed
   claim. Was confidence justified?
2. **Gap.** Return to Phase 1 collection for that specific EEI — not the
   entire question.
3. **Expand.** New question surfaced? Return to Phase 0 for a fresh cycle.

Continue until all "Must answer" EEIs reach at least medium confidence, or
the user explicitly accepts remaining uncertainty. When the user closes the
loop or accepts remaining gaps, end your reply with the completion token
below, verbatim, as the final line — do not offer a follow-up before
emitting it.

```
analysis-loop complete. <N> findings | Confidence: <H>/<M>/<L> |
<K> sources | <G> gaps accepted | Refinement rounds: <R>
```

## Edge Cases

- **No sources found.** Report: "Zero usable sources." Suggest broader query
  angles or accept the gap as a finding.
- **All sources low-reliability (C or below).** Flag prominently. Present what
  exists but make the reliability limitation the lead finding.
- **Sources overwhelmingly agree.** Apply Devil's Advocacy — could they all
  share a false assumption?
- **User disputes a finding.** Stop and investigate. Treat the challenge as a
  new EEI.
- **Scope expands during research.** Return to Phase 0. Re-scoping at 20
  minutes beats delivering the wrong answer.
- **Web search unavailable.** Fall back to built-in `websearch`/`webfetch`.
  If both fail, flag all findings as low confidence.

## Output Contract

Every phase produces a grepable one-line status:

```
# After Phase 0
research-scoping passed. Question: <one-line> | EEIs: <N> |
Scope: <boundaries> | Format: <audience> | Horizon: <horizon>

# After Phase 1
research-collection complete. <N> sources across <M> EEIs |
Reliability range: <low-highest> | <K> gaps

# After Phase 2
research-analysis complete. <N> findings | Confidence: <H>/<M>/<L> |
<K> contradictions | <G> gaps

# After Phase 3
analysis-loop complete. <N> findings | Confidence: <H>/<M>/<L> |
<K> sources | <G> gaps accepted | Refinement rounds: <R>
```

## Mode Boundaries

- **Phases 0–2** run in plan mode (read + search + fetch only).
- **Phase 3** may involve writing findings to a file. If so, switch to build
  mode. The skill does not auto-switch.

## Anti-patterns / Refuse to

- Do not present findings without source reliability grades and confidence
  scores.
- Do not silently resolve contradictions — report both sides with grades.
- Do not present a single-source finding as fact. Frame it: "One B3 source
  reports…"
- Do not search only for confirming evidence. Search for disconfirming
  evidence with equal effort.
- Do not treat contradictory low-reliability sources as equal to consensus
  high-reliability sources. Weight by grade.
- Do not let recency bias override source reliability. A 2-year-old A1 source
  is often more trustworthy than a 2-day-old C3 source.
- Do not present Phase 2 findings without running the reflexion gate.
