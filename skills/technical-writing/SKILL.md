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
   Adjust depth and vocabulary for the reader. When the Infobroker
   orchestrator invokes this skill as the WRITE step of a workflow shape, the
   document type is a research report and its structure is the shared
   skeleton plus the routed shape's block in
   `skills/infobroker/references/report-template.md`. Report conventions take
   precedence over the API-reference, tutorial, and user-guide templates
   below.

2. **Gather source material.** Collect code, schemas, existing docs, design
   documents, and commit history. Identify authoritative sources.

   **Infobroker Integration**: Source material comes from the extract and
   verify phases of the Infobroker pipeline — `search_web` and `fetch_page`.
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

## Research Reports (Infobroker workflow shapes)

When this skill runs as the Infobroker WRITE step, write a research report,
not generic documentation:

1. **Use the routed shape.** The orchestrator supplies the workflow shape,
   audience, and target length. The structure is the shared skeleton in
   `skills/infobroker/references/report-template.md` plus that shape's block.
2. **Fill every section.** Executive Summary, Methodology & Scope, Key
   Findings, Evidence & Sources, Contradictions, Gaps, Source Register, and
   Recommendations. Do not drop a section because it is empty — state "none
   found" or why it does not apply.
3. **Preserve evidence binding.** Keep the `[S#]` marker assigned during
   verification on every factual claim. Do not introduce a claim while
   drafting that the collected evidence does not support.
4. **Calibrate to the reader.** Executive audiences lead with the summary and
   recommendations; technical audiences lead with method and findings. Honor
   the requested length rather than padding to a fixed size.
5. **Do not substitute a documentation genre.** An API reference or tutorial
   is the wrong deliverable for a routed research shape.

For standalone documentation requests (no routed shape), use the generic
workflow above and the matching document-type template.

## Best Practices

- Lead each section with the action the reader must take.
- Provide complete, copy-pasteable examples.
- Use consistent templates across similar documents.
- Write scannable content with headings, tables, and lists.
- Version the documentation alongside the software.

## Output Contract

Always end with a searchable one-line status:

```
technical-writing complete. <doc type> | <N> sections | no placeholders
```

`<doc type>` is the document type identified in step 1 (research report,
API reference, tutorial, user guide, changelog, or architecture doc). Replace
`no placeholders` with a list of any placeholder text the review could
not resolve.

## Edge Cases

- **Undocumented behavior:** Document it as "current behavior" and flag it for
  engineering confirmation.
- **Multiple audiences:** Layer essentials first, with expandable advanced sections.
- **Rapidly changing APIs:** Prominently note the version and date.
- **Missing material:** List what is missing and ask for it rather than guessing.

## Infobroker Integration

This skill is the write step of the Infobroker Research & Write pipeline.
Input material comes from Infobroker search and extraction tools, processed
through `summarization`. Output is then polished by `proofreading`.
