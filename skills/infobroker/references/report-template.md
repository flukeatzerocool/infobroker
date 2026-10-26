# Report Template

Canonical output structure for Infobroker research deliverables. Each
workflow shape fills the shared skeleton and, where noted, appends its own
output block. Cite a source URL with every factual claim (see
`instructions/search-preferences.md`). Grade confidence, likelihood, and
sources with `confidence.md` — do not restate or invent a scale.

Every factual claim carries an inline citation marker `[S#]`, where `#` is
the row number of the claim's entry in the Source Register. The register row
carries the URL; a claim with no marker is a defect. `scripts/validate-report.ts`
checks this contract before the report is delivered.

## Report manifest

Every report opens with a fenced `report-manifest` JSON block. It is the
machine-readable summary of the report and the receipt payload. Only `shape`
and `claims` are required; omit a field rather than guess.

```report-manifest
{
  "shape": "Research & Write",
  "audience": "analyst",
  "methodology": "One line: scope, searches run, inclusion rules.",
  "assumptions": ["What was assumed rather than verified."],
  "alternatives": ["A competing hypothesis or option considered."],
  "gaps": ["What remains unknown."],
  "revision": 1,
  "claims": [
    {
      "claim": "the exact proposition the report asserts",
      "verdict": "True",
      "confidence": "High",
      "likelihood": "likely",
      "sources": ["S1", "S2"]
    }
  ]
}
```

When revising a delivered report, increment `revision` and set `supersedes`
to the prior report identity. Archive the report with a receipt
(`manage_kb` ingest, `source_type: "report"`) so `verify_report` can detect
source drift later.

## Shared skeleton (Research & Write, Deep-Dive, Gated Analysis, and the other shapes)

````
# <Title>

```report-manifest
{ ... }
```

## Executive Summary
[3–5 sentence synthesis of the highest-confidence findings. Lead with the
answer the user asked for.]

## Methodology & Scope
[What was asked and how it was answered: scope boundaries; the searches run
and when; inclusion/exclusion rules; the structured analytic technique and
why it fit; what this report does not cover.]

## Key Findings
### <Finding 1>
**Finding:** [1–2 sentences, with [S#] markers]
**Confidence:** High / Medium / Low
**Likelihood:** almost certain / very likely / likely / even chance /
unlikely / very unlikely / remote — omit when the claim is not probabilistic
**Sources:** [Admiralty pairs, e.g. A1 + B2 independent]
**Contradictions:** [both sides with grades, or "none found"]
**Gaps:** [what remains unknown]

## Assumptions
[What the analysis takes as given rather than verified. Keep this separate
from evidence so an inference is not mistaken for a confirmed fact.]

## Analysis of Alternatives
[Competing hypotheses or options considered, why each was rejected or kept,
and the strongest case against the leading judgment. State what evidence would
change the judgment.]

## Evidence & Sources
[URLs with the claim each source supports. No bare links.]

## Contradictions
[Where sources disagree: factual vs. interpretive, with grades.]

## Gaps
[Questions left open and why.]

## Source Register
| # | Source | Type | Primary/Secondary | Reliability | Credibility | Relevant interests | URL |
|---|--------|------|-------------------|-------------|-------------|--------------------|-----|

## Recommendations
[Actions implied by the findings, or "none" when the request was descriptive.]
````

## Per-shape blocks

### Fact-Check

```
| # | Claim | Verdict | Confidence | Likelihood | Justification | Sources |
|---|-------|---------|------------|------------|---------------|---------|
```
Verdicts: True, Mostly True, Half True, Mostly False, False, Misleading,
Mixture, Unverifiable. Split bundled claims; discard opinions as "not
checkable." Hold claims to primary sources where they exist, and state a
source's relevant interest where it could influence the claim.

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
## Identification and Screening
| Stage | Records |
|-------|---------|
| Identified | <n> |
| Duplicates removed | <n> |
| Screened | <n> |
| Excluded (with reasons) | <n> |
| Included | <n> |
## Thematic Synthesis
## Gap Analysis
## Source Register
```
Report the identification/screening/inclusion counts and every exclusion
reason; do not present a curated reading list as a systematic review.

### Monitoring / Delta

```
## Changes Since <baseline date>
### New
### Changed
### Removed
[Delta only — not a full re-summary.]

## Baseline and Verification
[The baseline report identity and its receipt. Run `verify_report` before
comparing; report source drift and unverifiable sources. Archive the new
revision with `supersedes` set to the baseline identity.]
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
Scope, Assumptions, Analysis of Alternatives, Evidence & Sources, Source
Register, and Recommendations, and this block for its analysis sections.

### Vetting / Due-Diligence

```
## Checklist
| Item | Status (verified / partial / unverified) | Sources |
|------|------------------------------------------|---------|
## Red-Flag Register
[Unverifiable items are stated, not assumed.]
```

## Audience profiles

Record the audience in the manifest and let it set depth, not facts:

- **executive** — answer first, one-page summary, implications and
  recommendations, minimal method detail.
- **analyst** — full skeleton, source grades, alternatives, and gaps.
- **engineer** — technical detail, exact versions, reproduction steps, and
  primary documentation over commentary.

Always end the reply with the shape's completion token from `workflows.md`.
