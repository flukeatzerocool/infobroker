# Confidence, Likelihood, and Source Grades

One scale, used everywhere: tool output, reports, and gated analysis. Do not
invent a second scale or leave a claim ungraded.

## Confidence (strength of the judgment)

| Label | Band | Meaning |
|-------|------|---------|
| High | 0.80–1.00 | Multiple independent, strong sources agree; little reason to doubt. |
| Medium | 0.50–0.79 | Evidence points one way but is incomplete, indirect, or partly contested. |
| Low | 0.00–0.49 | Thin, single-source, or conflicting evidence; treat as provisional. |

ICD 203 §D.5.e.(2) names the levels low, moderate and high; this project's
labels are Low, Medium and High, so Medium is the directive's moderate.

`verify_claims` reports numeric confidence in this range; map it to the label
for a report and never round up. When every supporting source is secondary or
aggregated, the configured calibration cap applies before the label is
assigned. `family_count` is the number of independent source families, not the
number of URLs.

## Likelihood (probability of the event) — separate from confidence

Confidence says how sure you are of the judgment; likelihood says how probable
the judged event is. You can hold High confidence that an event is unlikely.

The terms and bands are the analytic standards of ICD 203 §D.5.e.(2)(a). Use
this row of the directive's scale, verbatim:

| Term | Band |
|------|------|
| almost certain | 95–99% |
| very likely | 80–95% |
| likely | 55–80% |
| roughly even chance | 45–55% |
| unlikely | 20–45% |
| very unlikely | 5–20% |
| remote | 0–5% |

Do not substitute "probably", "possibly", or "maybe", and do not mix terms
from different rows of the directive's table: it accepts a second synonym row
(`remote`, `highly improbable`, `improbable`, `roughly even odds`, `probable`,
`highly probable`, `nearly certain`), and a product that mixes rows must carry
a disclaimer saying the terms express the same probability. One row, one
report, is simpler and needs no disclaimer.

Do not put a confidence level and a likelihood in the same sentence
(§D.5.e.(2)(b)): "high confidence that the launch is likely" forces the reader
to hold two scales at once. Split it: "we assess with high confidence that a
launch will occur; likelihood: likely."

A report claim may carry both `confidence` and `likelihood` as separate fields
— the constraint is on prose, not on the manifest.

## Modality (how a source states its claim)

Separate from confidence and likelihood. A source's *modality* says how the
evidence was stated, not how sure you are:

| Modality | Meaning | Write it as |
|----------|---------|-------------|
| `asserted` | The source states the claim plainly | "X is…" |
| `reported` | The source attributes or hedges it ("reportedly", "according to") | "X reportedly…" / "according to S#, X…" |
| `speculative` | The source states a possibility ("may", "appears to") | "X may…" |

`verify_claims` reports the modality on each source. Preserve it in the report:
never upgrade `reported` or `speculative` to a flat assertion. A non-asserted
manifest claim declares `modality` and an `attribution` phrase that must appear
in the body (REQ-026h, REQ-116). Modality never changes a confidence score.

## Source grades (Admiralty / NATO code)

Grade the source and the information independently. A single item carries two
characters, for example `B2`.

**Source reliability (A–F).** A = completely reliable; B = usually reliable;
C = fairly reliable; D = not usually reliable; E = unreliable; F = cannot be
judged.

**Information credibility (1–6).** 1 = confirmed by other independent sources;
2 = probably true; 3 = possibly true; 4 = doubtful; 5 = improbable; 6 = cannot
be judged.

Record the pair in the Source Register. Do not let a reliable source raise the
credibility of its own claim, and do not let corroboration raise a source's
reliability grade.

## GRADE mapping (informational)

For evidence-synthesis readers, the three-label scale maps to GRADE
certainty as follows. The mapping is informational; it does not create a
second scale, and a report still grades each claim on the scale above.

| Report confidence | GRADE certainty |
|-------------------|-----------------|
| High | High |
| Medium | Moderate |
| Low | Low to Very Low |

## Verdicts (fact-check)

True · Mostly True · Half True · Mostly False · False · Misleading · Mixture ·
Unverifiable. Split bundled claims; mark opinions and predictions "not
checkable" rather than forcing a verdict.

## Source primacy and interests

Mark each Source Register row **primary**, **secondary**, or **aggregated**.
Prefer a primary source where one exists; explain why a secondary source was
used when no primary is available. Where a source has an interest that could
influence the claim (funding, advocacy, commercial stake), state it in the
row's `Relevant interests` column. An unstated interest is a defect for
decision-driving reports.

## Recording the grades

- Report manifest: `claims[].verdict`, `claims[].confidence`,
  `claims[].likelihood`.
- Source Register: `Reliability`, `Credibility`, `Primary/Secondary`, and
  `Relevant interests` columns.
- `analysis-loop`: cite this file's bands when grading; do not restate them.
