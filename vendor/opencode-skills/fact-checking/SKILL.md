---
name: fact-checking
description: >
  Use when the user asks to fact-check, verify, or validate a claim.
  Extract assertions, find authoritative sources, cross-reference evidence,
  and assign confidence-scored verdicts. For broad research questions spanning
  multiple topics, use deep-research instead.
license: MIT
metadata:
  author: awesome-ai-agent-skills contributors (adapted for Opencode)
  source: https://github.com/seb1n/awesome-ai-agent-skills
  version: 1.0.0
---

# Fact-Checking

## When NOT to Use

- For opinions, subjective judgments, or unfalsifiable statements.
- When there are no accessible authoritative sources.
- For broad research questions spanning multiple topics — use `deep-research` instead.

## Workflow

1. **Extract claims.** Split the input into individual, verifiable assertions.
   Discard opinions but note them as "not checkable."

2. **Classify each claim.** Determine whether it is statistical, historical,
   scientific, definitional, or attributional.

3. **Find authoritative sources.** Prefer primary sources (official data,
   peer-reviewed papers, archived transcripts, government records). Supplement
   with reputable fact-checking organizations.

   **Infobroker Integration**: Use `choose_provider` to select the best search
   backend for the claim type — Wikipedia for historical/definitional,
   Semantic Scholar for scientific, Wikidata for statistical facts.

4. **Cross-reference.** Check each claim against at least two independent
   sources. Note corroboration, contradiction, or partial support. Use
   Infobroker `converge` for automated multi-source verification.

5. **Assign verdicts.** Use: True, Mostly True, Half True, Mostly False,
   False, or Unverifiable. Include a confidence score (0.0–1.0) and a brief
   justification.

6. **Compile the report.** List each claim with its verdict, confidence,
   evidence, and source links. Provide an overall assessment.

## Best Practices

- Split bundled claims into separate assertions.
- Prioritize primary sources over secondary reporting.
- Note context and framing that could make a true number misleading.
- Distinguish "false" from "unverifiable."
- Check the date of both the claim and the evidence.

## Edge Cases

- **Predictions:** Label as "not verifiable" and assess the credibility of the source.
- **Rapidly changing statistics:** Note the claim date and verification date.
- **Satire or hyperbole:** Note the intent rather than issuing a literal verdict.
- **No public source:** Label "Unverifiable — no public source" and suggest
  requesting documentation from the claimant.

## Infobroker Integration

This skill is the verdict engine in the Infobroker Fact-Check Pipeline.
After Infobroker `web_search` and `converge` find and cross-reference
sources, this skill assigns confidence-scored verdicts. The pipeline then
routes to `summarization` for the executive summary.
