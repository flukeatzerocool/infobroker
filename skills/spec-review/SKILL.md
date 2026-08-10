---
name: spec-review
description: >
  Use when the user asks to review or audit a software specification.
  Produces a scored report across 8 dimensions with a commit-readiness
  verdict. Do not use for general prose — use proofreading. Do not use
  to fix findings — use spec-engineering-loop.
metadata:
  version: "1.0"
---

# Spec Review

## When NOT to Use

- For grammar, spelling, or style corrections — use `proofreading`.
- When the user wants to fix problems, not assess them — use
  `spec-engineering-loop`. spec-review produces a report;
  spec-engineering-loop implements the fixes.
- For code review — use `code-review`.
- For a single typo or one-line fix — this skill is overkill.

## Mode Boundaries

Entirely read-only. Runs in plan mode only. Produces a report; never
edits files. The output report is the deliverable.

## Activation

Activate when ANY of these hold:

1. The target filename matches `holonovel.md`, `*-mcp.md`, `*-spec.md`,
   or `*-requirements.md`.
2. The document content contains `**REQ-` blocks — auto-detect
   regardless of filename.
3. The user says "review spec," "spec review," "audit spec," "check
   spec," "check this section," or "review this REQ."

If the target is ambiguous, ask: "Which file or section should I review?"

## Workflow

### Discovery

Before reviewing, scan for project conventions — they determine what
"correct" means. Check in order:

1. `AGENTS.md` — Layer map, spec editing conventions, requirement
   format, gate commands, prose conventions.
2. `package.json` — Verification scripts (lint, validate, audit).
3. `CHANGELOG.md` — Recent revision patterns.
4. The spec's own terminology section and any authoring-conventions
   appendix (e.g., Appendix M in Holonovel).

Record what you find. Every review callout that cites a
convention-breach must reference the specific rule (file:line or
section paragraph).

### Scope

- Named section or REQ → review only that scope.
- "review spec" with no qualifier → full document, all 8 dimensions.
- Spec longer than ~500 lines → ask: "Full review, or a specific
  section?"

Execute every dimension in scope. Each finding cites the exact
location (section, line, or REQ ID).

---

### 1. Structural Consistency

Mechanical checks — these would block an assemble or build step.

- **REQ block hygiene.** Every `**REQ-NNN — Title.**` block ends with
  `_Check:_` or `*Check:*` followed by at least one citation.
- **Manifest completeness.** Extract REQ IDs from the requirements
  manifest (Appendix E or equivalent) and from all `**REQ-` headers
  in the body. The two sets must be identical.
- **Test ID consistency.** Extract test IDs from the test catalogue
  (Appendix F or equivalent) and from `_Check:_` citations in REQ
  bodies. Report uncited tests and broken citations.
- **Gate reference form.** Gate references outside §8 must use `GN`
  form (e.g., "G2"), not "Gate 2." Verify against AGENTS.md — some
  projects don't enforce this.
- **Separator presence.** If the project uses `---` horizontal rules
  between top-level sections, flag missing separators. Skip if not
  a convention.
- **Appendix range accuracy.** If the spec intro states an appendix
  letter range (e.g., "Appendices A–Y"), the actual last appendix
  letter must match.
- **Cross-section count accuracy.** If a section text states a count
  of items in another section (e.g., "§6.5 has 14 metrics"), the
  actual count must match.
- **Assemble integrity.** If the project uses an assemble step,
  `build-phase-map.md` entries must match actual spec source files.

### 2. Contract Clarity

Each REQ must state a *verifiable outcome*, not an *implementation
prescription*. Apply the project's authoring conventions. Fallback
test: Could two different conformant builds satisfy this REQ using
different approaches?

Flag in REQ bodies:

- **Parameter types** — `string`, `number`, `boolean`, `integer`,
  `Map`, `Array`, `enum`. Exclude code blocks and backtick-quoted
  names.
- **Default clauses** — `(default ...)` or `default <value>`.
- **Enumerated catalogs** — 6+ items in a single REQ body sentence.
  Count tokens between commas.
- **Algorithm descriptions** — Sort orders, scan directions,
  procedural steps ("First X, then Y, and if Z then A").
- **Worked examples disguised as requirements** — tutorial-style
  REQs rather than contracts.
- **Implementation prescriptions** — Library names, file paths,
  specific data structures, language features.

### 3. Completeness

- **Undefined terms.** Extract capitalized terms from Terminology.
  Scan REQ bodies. Flag terms used but not defined, and definitions
  that diverge from usage.
- **Dangling references.** Every cross-reference (to a section,
  appendix, gate, REQ) must resolve. Verify each target exists.
- **TOC completeness.** TOC and body sections must be a bijection.
  Flag orphans in either direction.
- **Edge case acknowledgement.** For major subsystems, is there at
  least one REQ or prose section covering its primary failure mode?
  Flag subsystems with no visible error-handling coverage.

### 4. Consistency

- **Naming drift.** Same concept under different names across
  sections? Flag inconsistent forms. Don't flag intentional
  formatting differences (code identifiers vs. prose).
- **Hat-scoping consistency.** If the project uses hat-scoped
  markers (`*Game Master only*`), verify consistent marker text
  and placement convention.
- **Field name stability.** Tool parameters or data fields described
  with different names in different sections.
- **Near-duplicate content.** Paragraphs that restate the same
  information within a ~40-sentence window. Note whether intentional
  (reinforcement) or accidental (copy-paste drift).
- **Standing rule coherence.** Flag sections that contradict a
  declared standing rule.

### 5. Testability

- **Check citation presence.** Every REQ body ends with at least one
  `_Check:_` or `*Check:*` citation to a defined gate, test, or
  verification workflow.
- **Citation validity.** Every cited check is defined elsewhere.
  Flag dangling check citations.
- **Objective criteria.** Flag subjective acceptance criteria:
  "easy to use," "performs well," "reasonable," "sufficient."
- **Verifiability depth.** Note REQs with only manual verification —
  informational, not a failure.

### 6. Ambiguity

Lower bar for REQ bodies than non-normative prose. In a REQ body,
every ambiguous word is a potential implementer misinterpretation.

**In REQ bodies, flag:**

- **Hedging** — "should" (when meaning "must"), "might," "could,"
  "possibly," "ideally," "preferably."
- **Vague qualifiers** — "appropriate," "reasonable," "sufficient,"
  "adequate," "proper," "sensible."
- **Indefinite quantities** — "many," "some," "several," "a few."
- **Empty adverbs** — "quickly," "efficiently," "robustly."
- **Unanchored comparatives** — "faster," "better" without a baseline.

**In all prose, flag:**

- **Undefined thresholds** — "within a reasonable time," "with
  sufficient confidence."

**Red-team assessment.** For each flagged ambiguity in a REQ body,
state a plausible wrong reading an AI builder could adopt. If none
exists, the finding may be downgraded.

### 7. Spec Smell Detection

Patterns that signal structural problems.

- **Lifecycle repetition.** A REQ that restates what §6 (Build
  Process) or §7 (Runtime) already defines. Flag with the overlapping
  section reference.
- **Detail-density cliff.** Adjacent sections at radically different
  granularity — paragraph-level next to field-level.
- **Magic numbers without justification.** Thresholds, limits, and
  counts with no linked REQ or rationale.
- **Absolute claims without escape hatches.** "Always," "never,"
  "every," "none" — fragile across diverse implementations. Flag
  absolutes without an override mechanism.

### 8. Coherence

The spec as a unified document.

- **Builder-path coherence.** Following the spec's reading guide,
  does a first-time builder encounter information in logical order?
  Flag sections assuming knowledge not yet introduced.
- **Tone consistency.** Flag abrupt shifts — prescriptive to
  conversational, formal to tutorial-like.
- **Heading-content alignment.** Flag headings that promise more or
  different content than the section delivers.
- **Forward-reference hygiene.** Flag references to sections, REQs,
  or concepts before they're introduced.
- **Prose density balance.** Flag dramatic swings in detail density
  between adjacent sections.

### Severity Tiers

| Tier | Meaning | Blocks commit? |
|---|---|---|
| 🔴 Critical | Broken cross-references, REQ-manifest mismatch, undefined tools, missing required check citations. | Yes |
| 🟠 Major | Ambiguous REQ language, untestable criteria, significant naming drift, undefined terms in REQ bodies, magic numbers without justification. | No (should) |
| 🟡 Minor | Uncited test IDs, minor terminology drift, stale counts, near-duplicate paragraphs, missing `---` separators. | No |
| 🔵 Info | Readability suggestions, detail-density notes, REQs with only manual verification. | No |

### Output Format

```
# Spec Review: [scope]

**Spec:** [file path]
**Conventions:** [source — AGENTS.md, Appendix M, or "none detected"]
**Reviewer:** spec-review

## Overall Assessment

**Status:** ✅ PASS / 🟡 CONDITIONAL / 🔴 FAIL

**Summary:** [One paragraph. Concrete about what was reviewed and the
  dominant finding class.]

## Dimension Scores

| Dimension | Score | Key finding |
|---|---|---|
| 1. Structural consistency | X/5 | [worst finding or "—"] |
| 2. Contract clarity | X/5 | [worst finding or "—"] |
| 3. Completeness | X/5 | [worst finding or "—"] |
| 4. Consistency | X/5 | [worst finding or "—"] |
| 5. Testability | X/5 | [worst finding or "—"] |
| 6. Ambiguity | X/5 | [worst finding or "—"] |
| 7. Spec smells | X/5 | [worst finding or "—"] |
| 8. Coherence | X/5 | [worst finding or "—"] |

## Critical Findings

1. **[location]** — [finding].
2. ...

## Major Findings

1. **[location]** — [finding].
2. ...

## Minor Findings

1. **[location]** — [finding].
2. ...

## Info

- [location] — [observation].

## Verdict

✅ Ready to commit
  / 🟡 Conditional — fix Critical items and re-review
  / 🔴 Do not commit — resolve Critical and Major items first
```

### Verification

After producing the report, verify:

- [ ] Every finding cites a specific location.
- [ ] Every Critical finding is a genuine blocker.
- [ ] No finding prescribes an implementation fix.
- [ ] The verdict matches the severity of findings.

### Output Contract

Always produce a searchable one-line status:

```
spec-review passed. [scope] — [N]/8 dimensions ≥3/5, 0 Critical
spec-review FAILED. [scope] — [N] Critical, [M] Major
```

## Edge Cases

- **No spec conventions found.** Note in report header. Apply fallback
  contract test. Flag as Info.
- **Spec is a single section.** Skip document-level checks (manifest,
  TOC, appendix range, assemble integrity, coherence).
- **No REQ blocks.** Skip REQ-specific checks. Dimensions 2–6 narrow
  to prose-only analysis. Note in report.
- **Auto-detection false positive.** Ask: "Review as spec anyway, or
  cancel?"
- **Spec is large (>2000 lines).** Offer: "(1) full review, (2) a
  specific section, (3) pick 2–3 dimensions."
- **Finding contradicts a script check.** Prefer the script. Note
  discrepancy as Info: "validate.ts passed but manual review found
  [finding] — possible false negative."
- **No verification tooling exists.** Structural checks become manual
  greps. Flag: "No automated validator detected."

## Anti-patterns / Refuse to

- Do not produce findings without citing the exact spec location.
- Do not prescribe implementation fixes in findings.
- Do not skip the discovery phase — conventions vary across projects.
- Do not apply project-specific rules (Appendix M, `GN` form, `---`
  separators) to other projects without verifying conventions first.
- Do not present a finding you cannot justify with a specific spec
  line or convention citation.
- Do not mark as Critical something a script already catches — the
  automated gate covers it. Flag as Info if redundant.
- Do not rewrite the spec or generate corrected text. This skill
  assesses; `spec-engineering-loop` fixes. `proofreading` handles
  grammar.
