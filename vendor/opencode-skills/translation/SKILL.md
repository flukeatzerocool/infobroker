---
name: translation
description: >
  Use when the user asks to translate text or documents between languages.
  Preserve meaning, tone, formatting, and cultural context. Do not use for
  translating code identifiers or logic where meaning must remain in English.
license: MIT
metadata:
  author: awesome-ai-agent-skills contributors (adapted for Opencode)
  source: https://github.com/seb1n/awesome-ai-agent-skills
  version: 1.0.0
---

# Translation

## When NOT to Use

- For translating code logic or identifiers where the meaning must remain
  in English.
- When the user has not specified the target language or formality level.

## Workflow

1. **Analyze the source.** Identify domain, register, audience, and format.
   Note idioms, cultural references, and placeholders.

2. **Research terminology.** Build a glossary for technical, legal, or
   domain-specific terms. Use the user's translation memory if available.

   **Infobroker Integration**: Use `web_search` with Wiktionary or Wikipedia
   for domain terminology research. Use `fetch_page` for bilingual glossaries
   or parallel texts.

3. **Translate.** Preserve meaning, tone, and formatting. Keep placeholders,
   code blocks, and HTML/Markdown structure intact.

4. **Localize.** Adapt units, dates, currency, and culturally bound metaphors
   to the target locale.

5. **Review.** Check grammar, fluency, and consistency. Ensure no sentences
   are omitted or duplicated.

6. **Deliver with annotations.** Return the translation in the same format.
   Include notes for ambiguous choices.

## Best Practices

- Preserve structure, tags, and placeholders.
- Maintain terminology consistency across the document.
- Respect formality registers (e.g., tu vs. usted, casual vs. formal Japanese).
- Handle pluralization rules of the target language.
- Avoid literal translation of idioms.

## Edge Cases

- **Untranslatable terms:** Keep established technical terms in English and note
  the decision.
- **Right-to-left languages:** Use proper bidirectional markers for mixed text.
- **CJK length issues:** Flag translations that may exceed fixed-width UI fields.
- **Gendered language:** Ask for guidance or provide variants when the source is
  gender-neutral.

## Infobroker Integration

This skill can be inserted at any point in the Infobroker pipeline for
multilingual output. Use `web_search` with Wiktionary for terminology
research before translating. The translated output goes through
`proofreading` regardless of language.
