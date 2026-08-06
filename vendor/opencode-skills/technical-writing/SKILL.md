---
name: technical-writing
description: >
  Use when the user asks to write, draft, or improve technical documentation
  such as API references, tutorials, user guides, or architecture docs. Do
  not use for marketing copy or changelog workflows.
license: MIT
metadata:
  author: awesome-ai-agent-skills contributors (adapted for Opencode)
  source: https://github.com/seb1n/awesome-ai-agent-skills
  version: 1.0.0
---

# Technical Writing

## When NOT to Use

- For marketing or persuasive copy.
- When source material is missing and no one can provide authoritative details.
- For git-integrated changelog workflows — use `changelog-before-commit` instead.

## Workflow

1. **Identify document type and audience.** Determine whether the output is
   an API reference, tutorial, user guide, changelog, or architecture doc.
   Adjust depth and vocabulary for the reader.

2. **Gather source material.** Collect code, schemas, existing docs, design
   documents, and commit history. Identify authoritative sources.

   **Infobroker Integration**: Source material comes from Phase 1–3 of the
   Infobroker pipeline — `web_search`, `fetch_page`, and `deep-research`.
   Use `fetch_page` with Jina Reader for clean Markdown of web sources.

3. **Design the structure.** Create an outline that follows conventions for
   the document type. API references use a per-endpoint template; tutorials
   follow step-by-step progression.

4. **Write the content.** Use clear, direct language. Prefer active voice and
   short sentences. Include complete, runnable code examples. Define acronyms
   on first use.

5. **Add navigation.** Include a table of contents, cross-references, and
   "Next steps" sections.

6. **Review.** Verify code examples run, endpoints match the implementation,
   and no placeholder text remains.

## Best Practices

- Lead each section with the action the reader must take.
- Provide complete, copy-pasteable examples.
- Use consistent templates across similar documents.
- Write scannable content with headings, tables, and lists.
- Version the documentation alongside the software.

## Edge Cases

- **Undocumented behavior:** Document it as "current behavior" and flag it for
  engineering confirmation.
- **Multiple audiences:** Layer essentials first, with expandable advanced sections.
- **Rapidly changing APIs:** Prominently note the version and date.
- **Missing material:** List what is missing and ask for it rather than guessing.

## Infobroker Integration

This skill is Phase 5 of the Infobroker Research Professional pipeline
and the documentation arm of the Code Research pipeline. Input material
comes from Infobroker search and extraction tools, processed through
`deep-research` and `summarization`. Output is then polished by `proofreading`.
