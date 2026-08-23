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
  version: 1.2.0
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
Proofreading keeps its prose identity here: it corrects grammar,
punctuation, style, and prose-level consistency. **Structural
assessment is not proofreading's job.** This skill *detects* structural
problems but hands off their verdict to `spec-review`, which owns the
8-dimension assessment and severity tiers. Do not self-grade structural
severity here.

### Prose checks (owned by proofreading)

1. **Grammar, spelling, punctuation** — steps 1–4 apply to REQ bodies
   and spec prose verbatim. Fix subject-verb, tense, spelling,
   punctuation per the style guide.

2. **Style & voice consistency** — enforce heading capitalization,
   number formatting, abbreviations, and consistent terminology
   (step 4), including near-duplicate paragraphs and terminology drift
   in prose within a ~40-sentence window (step 5).

3. **Prose-adjacent structural break risk** — a grammar/style fix must
   never break a `**REQ-NNN — Title.**` block or its `_Check:_`
   citation. Before applying an edit inside a REQ body, confirm the
   edit does not alter the block boundary, the REQ ID, or the check
   citation. If a correction would, flag it as `PR-<n> [structural]`
   (below) and do not apply the edit.

4. **Modal-term consistency** — verify RFC 2119 keyword spelling and
   capitalization is consistent within the file ("SHALL" vs "shall",
   "MUST" vs "must") per the project's stated convention. This is a
   style-consistency fix. Do not adjudicate modal *meaning* here —
   a SHOULD used where MUST is intended is a strength issue, not a
   casing issue: flag it as `PR-<n> [structural]` and defer to
   spec-review.

5. **Bad-word / weak-predicate list** — in spec prose, treat "etc.,"
   "and/or," "TBD," "TBS," "support(s)," "provide(s)," "handle(s),"
   "as appropriate," and "if needed" as word-choice issues; suggest a
   concrete replacement. In a REQ body, these are ambiguity findings,
   not grammar: emit `PR-<n> [structural]` and defer to spec-review
   rather than applying a prose fix.

### Structural handoff (owned by spec-review)

When the file matches a spec convention, scan for the following and
report each as a **handoff finding** — detected, never graded here:

- REQ block hygiene — blocks missing a `_Check:_` / `*Check:*` citation.
- Manifest completeness — REQ IDs in the Appendix E manifest vs. body.
- Test ID consistency — test IDs in Appendix F vs. `_Check:_` citations.
- Tool name consistency — parser tools vs. a consolidated `play_command`
  tool; transcript tool names undefined in a REQ or construction section.
- Term definition hygiene — capitalized terms used in REQ bodies but
  undefined in Terminology.
- Golden transcript coverage — parser commands / error categories in
  REQs but never exercised in the transcript.
- Check-restatement / vacuous verification — a `_Check:_` citation or
  acceptance criterion that restates the REQ in other words rather than
  naming a distinct observable condition. Defer to spec-review
  (Testability).
- Unmet promised capability — a capability promised in the intro,
  mission statement, or reading guide with no corresponding REQ. Defer
  to spec-review (Completeness/Coherence).

For each, emit:

```
PR-<n> [structural] <location> — <what was detected>.
  → defer verdict to spec-review.
```

The finding carries a `PR-<n>` ID for downstream tracking. It assigns no
Critical/Major/Minor tier — `spec-review` grades severity and
`spec-engineering-loop` fixes. A structural finding does not stop a
grammar pass; prose corrections proceed independently.

### Standards reference

The structural handoff items map to these criteria; name the criterion
when emitting a `[structural]` finding to keep detection grounded:

| Handoff item | Criterion |
|---|---|
| REQ block hygiene, check-restatement | IEEE 29148 *verifiable* |
| Manifest / test ID consistency | IEEE 29148 *consistent*, *traceable* |
| Term definition hygiene | IEEE 29148 *unambiguous*, *understandable* |
| Unmet promised capability | IEEE 29148 *complete*, *traceable*; OpenSpec "what's missing" |
| Golden transcript coverage | OpenSpec scenario-exercises-requirement |
| Modal-term / bad-word checks | RFC 2119; requirements-writing ambiguity lists |

The discipline is unchanged: proofreading *detects* these and defers
their verdict to `spec-review`, which owns severity grading.

## Output Format

Provide the corrected text and an annotated list of changes with original,
correction, and reason. Number each correction `PR-<n>` so it can be
referenced downstream:

```
1. PR-1 [location]: "original" → "correction" — [reason].
2. PR-2 [location]: "original" → "correction" — [reason].
```

Structural handoff findings reuse the same numbering with a `[structural]`
tag and a `→ defer verdict to spec-review` note (see Spec Mode).

### Output Contract

Always produce a searchable one-line status:

```
proofread passed. [scope] — N corrections, 0 structural findings deferred
proofread FAILED. [scope] — M structural findings → session handed to spec-review
```

The `FAILED.` form is for when structural findings were detected;
the prose pass is still completed and reported. The token is grep-able by
`build-review` (as an `Evidence:` source) and `after-action-report`
(follow-through register).

## Edit audit trail

Proofreading edits the file. Treat each correction as rollback-cost 1
(git-reversible): every applied edit must be individually revertible.
When run inside a build (spec-engineering-loop Phase 3 or a
`build-review` step), emit an evidence line for the pass:

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

This skill is the polish step of the Infobroker Research & Write pipeline.
It polishes output from `technical-writing`.
All factual content was verified upstream by the workflow's verify phase —
this phase handles only language quality.
