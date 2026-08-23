---
name: proofreading
description: >
  Use when the user asks to proofread, grammar-check, or copy-edit text.
  Correct grammar, spelling, punctuation, style, clarity, and consistency.
  Do not use for creative writing where intentional rule-breaking is part of
  the voice.
license: MIT
metadata:
  author: awesome-ai-agent-skills contributors (adapted for Opencode)
  source: https://github.com/seb1n/awesome-ai-agent-skills
  version: 2.0.0
---

# Proofreading

## When NOT to Use

- For creative writing where intentional rule-breaking is part of the voice.
- When the user wants a full rewrite rather than corrections.

## Workflow

1. **Grammar check.** Fix subject-verb agreement, tense errors, dangling
   modifiers, fragments, and run-on sentences.

2. **Spelling and word choice.** Catch misspellings, homophones, and words
   used in the wrong context. Verify domain terms.

3. **Punctuation.** Review commas, semicolons, colons, dashes, hyphens,
   apostrophes, and quotation marks according to the style guide.

4. **Style and consistency.** Enforce heading capitalization, number
   formatting, abbreviations, passive voice, and consistent terminology.
   Verify the document conforms to any design philosophy or principles it
   declares (e.g., simplicity, no jargon, beginner-friendly). Flag deviations
   from that philosophy.

5. **Clarity and readability.** Flag long sentences, dense paragraphs, and
   jargon. Provide a readability score if useful.

6. **Tone check.** Ensure the tone matches the user's intent. Flag tonal shifts.

## Output Format

Provide the corrected text and an annotated list of changes with original,
correction, and reason. Number each correction `PR-<n>` so it can be
referenced downstream:

```
1. PR-1 [location]: "original" → "correction" — [reason].
2. PR-2 [location]: "original" → "correction" — [reason].
```

### Output Contract

Always produce a searchable one-line status:

```
proofread passed. [scope] — N corrections
```

The token is grep-able by `build-review` (as an `Evidence:` source) and
`after-action-report` (follow-through register).

## Edit audit trail

Proofreading edits the file. Treat each correction as rollback-cost 1
(git-reversible): every applied edit must be individually revertible.
When run inside a build, emit an evidence line for the pass:

```
Evidence: proofread passed. <scope> — N corrections applied.
```

If any correction is reverted, record the revert and its reason in the
change list rather than silently dropping it.

## Best Practices

- Use a multi-pass approach rather than one read.
- Preserve the author's voice.
- Show your work with a change list.
- Apply the chosen style guide consistently.
- Separate objective errors from subjective suggestions.

## Edge Cases

- **Intentional deviations:** Ask before correcting purposeful fragments or
  colloquialisms.
- **Mixed languages:** Exclude code, foreign phrases, and brand names from
  spelling checks.
- **Regional English:** Respect American vs. British conventions.
- **Technical jargon:** Cross-reference domain glossaries before flagging terms.

## Infobroker Integration

This skill is the polish step of the Infobroker Research & Write pipeline.
It polishes output from `technical-writing`.
All factual content was verified upstream by the workflow's verify phase —
this phase handles only language quality.
