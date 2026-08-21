---
name: proofreading
description: >
  Use when the user asks to proofread, grammar-check, or copy-edit text.
  Correct grammar, spelling, punctuation, style, clarity, and consistency.
  Use when the file matches a spec naming convention (*-mcp.md, holonovel.md,
  *-spec.md) to run structural consistency checks (REQ hygiene, manifest
  completeness, tool name consistency, golden transcript coverage) in
  addition to grammar corrections. Do not use for creative writing where
  intentional rule-breaking is part of the voice.
license: MIT
metadata:
  author: awesome-ai-agent-skills contributors (adapted for Opencode)
  source: https://github.com/seb1n/awesome-ai-agent-skills
  version: 1.0.0
---

# Proofreading

## When NOT to Use

- For creative writing where intentional rule-breaking is part of the voice.
- When the user wants a full rewrite rather than corrections.
- Spec mode structural checks are NOT skipped for these reasons — they
  apply regardless of intent when the filename matches a spec convention.

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

## Spec Mode

Activate spec mode when the target file matches one of these patterns:
`*-mcp.md`, `*-spec.md`, `holonovel.md`, when the user says
"spec audit," "validate spec," "check spec," or "proofread spec,"
or when the document content contains `**REQ-` blocks (auto-detect
regardless of filename).

Spec mode runs after the standard workflow passes (steps 1-6 above).
Findings are reported in severity tiers with the same change-list format
as grammar corrections.

### Spec mode checklist (7 checks)

1. **REQ block hygiene.** Scan for `**REQ-NNN — Title.**` patterns.
   Every REQ block must end with a check citation (`_Check:_ TNN.` or
   `*Check:* TNN.`). Blocks missing the citation are flagged. Citations
   referencing test IDs not present in Appendix F are broken cross-
   references.

2. **Manifest completeness.** Extract REQ IDs from the Appendix E
   requirements manifest table. Extract REQ IDs from bold-labeled REQ
   headers in the body. Report REQs in the manifest but absent from the
   body. Report REQs in the body but absent from the manifest. The two
   sets must be identical.

3. **Test ID consistency.** Extract test IDs from the Appendix F test
   catalogue table. Extract test IDs from `_Check:_` citations in REQ
   bodies. Report uncited tests (in Appendix F but never cited by a
   REQ). Report broken citations (`_Check:_ TNN` with no matching
   Appendix F entry).

4. **Tool name consistency.** Extract tool names from the construction
   section (§5.4 or equivalent — the numbered list of domain tools),
   the runtime naming section (§6.4 or equivalent), and the golden
   transcript tool calls. Flag conflicts: individual parser tools
   (`look`, `go`, `take`) appearing alongside a consolidated
   `play_command` tool. Flag tool names used in the transcript but
   never defined in a REQ or construction section.

5. **Authoring conventions.** In each REQ body (the paragraph between
   `**REQ-NNN — Title.**` and the next `**REQ-` or heading), flag:
   - Parameter types: `string`, `number`, `boolean`, `integer`, `Map`,
     `Array` (exclude code blocks and backtick-quoted tool names)
   - Default clauses: `(default ...)` or `default <value>`
   - Enumerated catalogs: lists of 6+ items in a single sentence
     (count tokens between commas in a REQ body)

6. **Term definition hygiene.** Terminology sections (§3 or equivalent)
   define capitalized terms. Scan REQ bodies for these terms. Flag
   terms used in REQ bodies that aren't defined in Terminology. Flag
   definitions that differ from usage (e.g., "Project" defined with
   capitalization but consistently referenced as "project").

7. **Golden transcript coverage.** The golden transcript should exercise
   every parser command and error category defined in REQs. For each
   parser command listed in a REQ (e.g., LOOK, GO, TAKE, DROP,
   EXAMINE, INVENTORY, WAIT), verify a corresponding transcript
   interaction exists. Flag missing commands. Flag error categories
   referenced in REQs but never triggered in the transcript
   (`RULE_VIOLATION`, `NOT_FOUND`, `AMBIGUOUS`, `NOT_IMPLEMENTED`).

### Severity tiers

**Critical** — block a build or push: C1 tool name conflicts, C2
undefined workflow tools, C3 manifest/body REQ mismatch, C4
missing golden transcript coverage for required parser commands.

**Warning** — need attention but don't block: W1 uncited test
IDs, W2 minor authoring convention violations, W3
capitalization/terminology inconsistency.

**Info** — advisory: I1 general readability, I2 potential
clarity improvements.

## Output Format

Provide the corrected text and an annotated list of changes with original,
correction, and reason.

## Best Practices

- Use a multi-pass approach rather than one read.
- Preserve the author's voice.
- Show your work with a change list.
- Apply the chosen style guide consistently.
- Separate objective errors from subjective suggestions.

## Pre-commit and Pre-push Integration

Spec mode is designed to run as a gate before commits or pushes. Two
recommended patterns:

**Package.json script (for spec projects):**
```json
{
  "scripts": {
    "check": "npx tsx scripts/validate-spec.ts",
    "proofread": "npx tsx scripts/validate-spec.ts --grammar"
  }
}
```
A `scripts/validate-spec.ts` runs the spec-mode checks and exits
non-zero on critical findings. The `--grammar` flag adds the
standard proofreading passes (steps 1-6). Prefer `npm run check`
as the default verify command for spec projects.

**Git hook pattern:**
```bash
#!/bin/sh
# .git/hooks/pre-push or .git/hooks/pre-commit
# Block push/commit if spec files changed and checks fail
if git diff --cached --name-only | grep -qE '(holonovel\.md|inform-mcp\.md|.*-(mcp|spec)\.md)$'; then
  npm run check || {
    echo "Spec consistency checks failed. Fix before pushing."
    exit 1
  }
fi
```

Also usable as an OpenCode skill: `@proofreading inform-mcp.md` or
"Proofread the spec" triggers spec mode when the filename matches a
spec pattern, running both grammar checks and structural validation.

## Edge Cases

- **Intentional deviations:** Ask before correcting purposeful fragments or
  colloquialisms.
- **Mixed languages:** Exclude code, foreign phrases, and brand names from
  spelling checks.
- **Regional English:** Respect American vs. British conventions.
- **Technical jargon:** Cross-reference domain glossaries before flagging terms.

## Infobroker Integration

This skill is Phase 6 (final pass) of the Infobroker Research Professional
pipeline. It polishes output from `technical-writing`.
All factual content was verified upstream by `deep-research` and
`fact-checking` — this phase handles only language quality.
