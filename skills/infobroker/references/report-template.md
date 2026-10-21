# Report Template

Canonical output structure for Infobroker research deliverables. Each
workflow shape fills the shared skeleton and, where noted, appends its own
output block. Cite a source URL with every factual claim (see
`instructions/search-preferences.md`). Use the A1–F6 source grades from the
`analysis-loop` skill's source assessment when grading reliability and
credibility.

Every factual claim carries an inline citation marker `[S#]`, where `#` is
the row number of the claim's entry in the Source Register. The register row
carries the URL; a claim with no marker is a defect.

## Shared skeleton (Research & Write, Deep-Dive, Gated Analysis, and the other shapes)

```
# <Title>

## Executive Summary
[3–5 sentence synthesis of the highest-confidence findings. Lead with the
answer the user asked for.]

## Methodology & Scope
[What was asked and how it was answered: scope boundaries; the searches run
and when; inclusion/exclusion rules; the structured analytic technique and
why it fit; what this report does not cover.]

## Key Findings
### <Finding 1>
**Finding:** [1–2 sentences]
**Confidence:** High / Medium / Low
**Sources:** [grades, e.g. A1 + B2 independent]
**Contradictions:** [both sides with grades, or "none found"]
**Gaps:** [what remains unknown]

## Evidence & Sources
[URLs with the claim each source supports. No bare links.]

## Contradictions
[Where sources disagree: factual vs. interpretive, with grades.]

## Gaps
[Questions left open and why.]

## Source Register
| # | Source | Type | Reliability | Credibility | URL |
|---|--------|------|-------------|-------------|-----|

## Recommendations
[Actions implied by the findings, or "none" when the request was descriptive.]
```

## Per-shape blocks

### Fact-Check

```
| # | Claim | Verdict | Confidence | Justification | Sources |
|---|-------|---------|------------|---------------|---------|
```
Verdicts: True, Mostly True, Half True, Mostly False, False, Unverifiable.
Split bundled claims; discard opinions as "not checkable." Hold claims to
primary sources where they exist.

### Competitive Evaluation

```
## Criteria
[weighted, defined before scoring]

## Decision Matrix
| Criterion (weight) | Option A | Option B | ... |
|--------------------|----------|----------|-----|

## Recommendation
[leading option + rationale + confidence; flag criteria lacking evidence.]
```

### Literature Review

```
## Inclusion / Exclusion Criteria
## Thematic Synthesis
## Gap Analysis
## Source Register
```

### Monitoring / Delta

```
## Changes Since <baseline date>
### New
### Changed
### Removed
[Delta only — not a full re-summary.]
```

### Adversarial / Red-Team

```
## Weakness Register
| Weakness | Likelihood | Impact | Assumption attacked |
|----------|------------|--------|---------------------|
## Assumptions & Attack Surface
## Robustness Verdict
```

### Deep-Dive

```
## Subtopic Coverage
| # | Subtopic (EEI) | Sources | Confidence | Status |
|---|----------------|---------|------------|--------|
| 1 | [sub-question] | [S1, S3] | High / Medium / Low | answered / partial / gap |

## Thematic Synthesis
### <Theme>
[Synthesis across subtopics, grouped by theme rather than by source;
highest-confidence findings first.]

## Cross-Subtopic Contradictions
[Where subtopics disagree: factual vs. interpretive, with grades.]

## Open Questions
[Subtopic-level gaps and the query that would close each.]
```

Deep-Dive uses the shared skeleton for Executive Summary, Methodology &
Scope, Evidence & Sources, Source Register, and Recommendations, and this
block for its analysis sections.

### Vetting / Due-Diligence

```
## Checklist
| Item | Status (verified / partial / unverified) | Sources |
|------|------------------------------------------|---------|
## Red-Flag Register
[Unverifiable items are stated, not assumed.]
```

Always end the reply with the shape's completion token from `workflows.md`.
