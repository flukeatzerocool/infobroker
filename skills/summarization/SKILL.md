---
name: summarization
description: >
  Use when the user asks to summarize, condense, or distill text, documents,
  or articles. Produce accurate summaries at configurable detail levels. Do
  not use for text already under 100 words where highlighting key sentences
  is sufficient.
license: MIT
metadata:
  author: awesome-ai-agent-skills contributors (adapted for Opencode)
  source: https://github.com/seb1n/awesome-ai-agent-skills
  version: 1.0.0
---

# Summarization

## When NOT to Use

- When the source is already very short (under 100 words); offer to highlight
  key sentences instead.
- When the user needs exact quotes rather than a paraphrase.

## Workflow

1. **Analyze the input.** Determine length, structure, domain, and whether
   it is one document or many.

2. **Choose the strategy.**
   - **Extractive:** Keep key sentences verbatim for factual or legal texts.
   - **Abstractive:** Rewrite in new words for readability.
   - **Hierarchical:** Provide a one-line TLDR, a short paragraph, and a
     detailed breakdown.
   - **Multi-document:** Synthesize across several sources.

3. **Identify key information.** Extract core claims, findings, decisions,
   action items, and supporting data. Rank by importance.

4. **Generate the summary.** Match the requested length and detail. Preserve
   factual accuracy. Do not introduce information not in the source.

5. **Verify faithfulness.** Compare the summary against the source. Check
   numbers, proper nouns, and causal claims.

## Best Practices

- Front-load the most important information.
- Preserve numerical precision.
- Match the source's tone.
- For multi-document summaries, organize by theme rather than by source.
- Flag contradictions rather than choosing one side.

## Edge Cases

- **Contradictory source:** Highlight the contradiction in the summary.
- **Technical jargon:** Define terms for non-specialists; preserve vocabulary
  for experts.
- **Truncated source:** Note that the summary may be incomplete.
- **Overlapping sources:** Deduplicate repeated information.

## Infobroker Integration

This skill is Phase 4 of the Infobroker Research Professional pipeline.
It condenses findings from `deep-research` and `fact-checking` into a
concise digest before `technical-writing` produces the final output.
