---
name: spec-engineering-loop
description: >
  Use when the user asks to improve or strengthen a subsystem of a
  specification document. Three-phase workflow: research (codebase + web) →
  draft plan → execute with verification.

  <example>
  User: "Deep research the Convert job. How does it work? Strengths and
  weaknesses. Areas for improvement."
  </example>

  Use ONLY when the user names a subsystem to improve or uses keywords
  "strengthen," "spec-improve," or "improve the spec."
  Do not use for ad-hoc documentation edits or prose polishing without
  structural analysis.
metadata:
  version: "1.0"
---

# Spec Engineering Loop

One-shot workflow: research one subsystem of a specification document,
produce concrete improvement recommendations, draft a plan, and execute
it with verification. The default is one subsystem at a time —
subsystem A completes its full 3-phase cycle before subsystem B starts.

## When NOT to Use

- No spec document exists (ask the user to identify one).
- The user asked for a quick explanation or Q&A, not an improvement cycle.
- The spec is prose-only with no verification pipeline — the research
  phase still works, but execution has nothing to gate on. Flag this.
- Trivial changes: typos in comments, formatting fixes without semantic
  impact. Single-turn edits don't need the full loop.

## Phase 0 — Project Discovery

Before any research, discover the project's spec conventions. Scan these
files, in order, until you find a spec document:

1. `AGENTS.md` — check for a "Layer map" or spec file reference.
2. Files named `spec.md`, `specification.md`, or `<project>.md` at root.
3. `README.md` — scan for spec file references or build commands.
4. Ask the user: "Which file is the canonical specification?"

Once the spec file is found, discover:

- **Verification command.** Look in `package.json` scripts, `Makefile`,
  or `AGENTS.md` for lint/validate/test commands. Prefer the one
  described as "run before committing" or "check."
- **Changelog.** Look for `CHANGELOG.md` or `CHANGES.md`.
- **Requirement convention.** Scan the spec for requirement patterns
  (e.g., `**REQ-NNN**`, `R-001`, numbered sections). Note the format.
- **Test convention.** If a test catalogue or test IDs exist, note the
  format (e.g., `T1`, `TC-001`).
- **Authoring conventions.** Scan the spec, `AGENTS.md`, `CONTRIBUTING.md`,
  or similar files for rules governing how requirements are written. Common
  patterns: contracts vs. implementation ("what, not how"), prohibited
  detail types (algorithms, data formats, library choices, default values),
  and style checklists. Record any conventions found. If none: note it —
  the fallback is "state contracts, not implementations."

**Gate.** Present a one-line summary and wait for confirmation:

```
spec-discovery passed. Spec: <file> | Verify: <command> | Changelog: <file>
```

The user must confirm or correct before Phase 1.

## Phase 1 — Scope & Research

### Subject selection

Two paths:

- **Explicit argument.** The user said "improve the Convert job" — use
  that subject directly.
- **No argument.** Scan the spec for top-level sections (ATX-`##`
  headings) or named subsystems. Present them as a numbered list. Ask:
  "Which subsystem should I analyze?" Use `question` with
  `multiple: true` so the user can pick several. If multiple are
  selected, process one at a time in the order chosen.

### Codebase research (ReAct loop)

Work through the target subsystem methodically. The pattern is
Thought → Action → Observation:

1. **Read the spec sections.** For every `##` heading or named segment
   that mentions the target subsystem, read it in full. Do not skim —
   every paragraph may contain a cited REQ, a gate reference, or an
   implementation constraint.

2. **Read the changelog trail.** For each spec section read, search the
   changelog for entries that reference the same subsystem or section
   number. Trace how the subsystem evolved across revisions. An area
   that has been revised 5 times in 2 weeks may have a different kind
   of weakness than an area untouched for months.

3. **Read implementation evidence.** If the project includes code built
   from this spec (e.g., a `src/` tree, reference implementation),
   read the files that implement the target subsystem. Look for:
   - Spec drift — code that doesn't match what the spec says.
   - Gaps — spec sections with no corresponding implementation.
   - Over-implementation — code for mechanics the spec never defined.

4. **Synthesize findings.** Produce a structured report:
   - **How it works.** One paragraph tracing the subsystem's role in
     the spec, what it depends on, and what depends on it.
   - **Strengths.** What does it do well? Concrete, cited evidence.
   - **Weaknesses.** Gaps, ambiguity, stale assumptions, missing edge
     cases. Each weakness cites a spec line, changelog entry, or
     implementation file.
   - **Improvement areas.** At least 3 specific, actionable
     recommendations. Each names what to change and why.

### Web calibration

After codebase research, supplement with web search. Codebase analysis
tells you what the spec *says*. Web research tells you whether what it
says is *still right*.

Search for current information relevant to the subsystem's domain
using `infobroker_infobroker_web_search`. Examples by subsystem type:

- **Tool/job workflows:** search for current best practices in that
  tooling domain (e.g., "PDF to Markdown conversion best practices
  2026" for a Convert job).
- **Architecture decisions:** search for whether prescribed stack
  versions are still current (e.g., "Node.js LTS version 2026").
- **Verification methodology:** search for advances in the testing or
  verification strategy the spec employs.
- **Spec methodology itself:** if the spec prescribes a process (e.g.,
  "chunked reading with 10-section budget"), search for whether that
  approach is still considered best practice.

Cross-reference web findings with codebase findings:

- Does any web finding contradict a spec assumption? Flag it.
- Does any web finding confirm a codebase-identified gap? Cite both.
- If no relevant web results, note it — do not fabricate.

### Reflexion gate

Before presenting the research report, run this self-check:

- Did I read every section that mentions this subsystem? Verify with
  grep.
- Did I search the web for current information?
- Does each weakness cite a concrete source (spec line, changelog
  entry, or implementation file)?
- Are there at least 3 actionable improvement areas?
- If web search returned nothing relevant, did I note that in the
  report?
- Do my improvement recommendations state contracts (what a conformant
  system must do), not implementation prescriptions (how to do it)?
  Apply the authoring conventions discovered in Phase 0. If a
  recommendation names a specific format, algorithm, library, data
  structure, or language feature, rephrase it as an outcome that
  multiple implementations could satisfy. If no conventions were found,
  apply the fallback: every recommendation must be verifiable without
  prescribing implementation details.

If any check fails, return to research. Do not present incomplete
findings.

### Baseline quality gate

If the spec is larger than ~2000 lines, ask the user: "Run baseline
spec-review on [subsystem], or skip? Baseline takes longer on large
specs." If the user skips, note in the research report that spec-review was
skipped by user request and proceed to the gate.

Otherwise, load `spec-review` and review the target subsystem. This
is read-only — no edits. The report surfaces structural problems
(dangling references, manifest mismatches, contract clarity
violations, ambiguity in REQ bodies) that manual codebase research
may miss.

Cross-reference the spec-review findings with the research report:

- Does a spec-review finding confirm a codebase-identified weakness?
  Cite both.
- Does spec-review surface an issue the research missed? Add it to
  the improvement areas.
- If spec-review passes with zero Critical or Major findings, note it
  — the subsystem may not need structural improvements.

Produce the baseline line:

```
spec-review passed. [subsystem] — [N]/8 dimensions ≥3/5, 0 Critical
```

or

```
spec-review FAILED. [subsystem] — [N] Critical, [M] Major
```

If spec-review found Critical or Major issues the research didn't
identify, return to research and add them to the improvement areas
before presenting the report.

**Gate.** Present the report. The user may ask to go deeper or confirm.

```
spec-research complete. <subsystem>: <N> improvements, <M> web-calibrated
```

## Phase 2 — Draft Plan

Produce a concrete implementation plan. Every improvement becomes one
plan entry with this shape:

```
### Change N: [one-line summary]
**File:** <path>, after <anchor>
**Prose:**
```
<exact new text including requirement IDs, check citations, formatting>
```
**Manifest:** add <id> to <section>
**Test:** add <id> to <section>
```

An improvement that says "consider hardening X" without the exact edit
is not concrete — re-research until you can write the edit.

Example — one plan entry from a real session:

```
### Change 1: Add REQ-102 (conversion contract)
**File:** holonovel.md, after REQ-020 (line 425, §5.2)
**Prose:**
```
**REQ-102 — Conversion contract.** The Convert job must verify that
every converted source passes a fidelity check: heading counts must
match within ±5%, table counts within ±10%, and no section longer
than 50 source lines may be dropped. Fidelity failures stop the line.
The converter records a fidelity report at build handoff. _Check:_ T93.
```
**Manifest:** add REQ-102 to Appendix E
**Test:** add T93 to Appendix F "Conversion fidelity"
```

Before running plan-review, apply the authoring conventions discovered in
Phase 0. For each new requirement, ask: "Could two different
implementations satisfy this requirement using different approaches?" If
not, the requirement prescribes an implementation detail — rephrase it as
an outcome contract. If no conventions were found, apply the fallback:
every requirement must be verifiable without constraining how it's
achieved.

Example — a requirement that fails this check, and the corrected version:

❌ "Decision IDs must use snake_case."
   → Snake_case is an implementation detail. Two implementations could
   use kebab-case and still satisfy the "must be consistent" contract.

✓ "Decision IDs returned in [NEED_INPUT] responses must be identical in
   format and naming across every implementation built from this
   specification, such that a caller who learns the workflow on one
   implementation can invoke the decision with the same identifier on
   another."
   → States what consistent behavior looks like, not which format to use.

### Identifier namespace check

Before assigning new requirement IDs, test IDs, or any spec-scoped identifier
in the plan, verify the namespace with a semantic search — not by reading a
region of the manifest table. Tables may be ordered by criteria other than ID
number (e.g., spec version grouping), so a region read of the "end" of a table
may miss entries inserted elsewhere in the body.

For spec conventions discovered in Phase 0:

- If requirements use the form `REQ-NNN` with a manifest appendix, grep the
  full spec for all current IDs and extract the next-available number:
  `grep -oE 'REQ-[0-9]+' <spec> | sort -t'-' -k2 -n | tail -5`.
  Do not rely on a region read — the manifest may not be numerically ordered.

- If tests use sequential IDs (e.g., `TNN`), grep the test catalogue similarly
  and confirm the next-available number.

- If the spec uses a different ID format, use the equivalent search.

Record the confirmed next-available IDs in the plan. A collision detected at
execution time — a new REQ number that already exists in the spec — indicates
this check was skipped and is a plan defect.

After drafting, load `plan-review` and run the full checklist. The plan
must pass all hard blockers before the user sees it. Produce the line:

```
plan-review passed. <N> changes across <M> files — [one-line scope]
```

If `plan-review FAILED.`, fix the blockers and re-run.

### Spec quality gate

Load `spec-review` and review the target subsystem of the spec (the
unchanged spec file — not the draft plan). This is read-only. The
report surfaces spec-content quality issues across 8 dimensions:
structural consistency, contract clarity, completeness, consistency,
testability, ambiguity, spec smells, and coherence.

Cross-reference the spec-review report with the plan:

- Does the plan address every Critical and Major finding? If a
  Critical finding has no corresponding change in the plan, the plan
  is incomplete — return to drafting and add the missing change.
- Does any planned change risk introducing a new finding (e.g., a new
  REQ with parameter types or default clauses)? Flag it in the plan
  for the user.
- If spec-review passes with zero Critical or Major findings and the
  plan makes no content changes (e.g., it only adds new REQs without
  modifying existing ones), note it — no spec content risk.

Produce the line:

```
spec-review passed. [subsystem] — [plan addresses all Critical/Major findings]
```

or

```
spec-review FAILED. [subsystem] — [N] Critical, [M] Major findings not addressed by plan
```

If `spec-review FAILED.`, return to drafting and add changes to
address the unaddressed findings. Do not present the plan to the user until
the plan covers all Critical spec-review findings.

**Gate.** Show the plan. The user must confirm with "execute plan,"
"go ahead," or equivalent. Do not enter Phase 3 without confirmation.

## Phase 3 — Execute

Runs in **build mode**. Load `build-review` before starting.

Execution order: build-review → apply change batches → verify →
changelog-before-commit → commit → after-action-report.

### Batch discipline

Apply edits in change groups, not arbitrary counts. A change group is
self-contained: add a requirement → update the manifest → add the test.
That group might be 3 edits or 10. The boundary is: run the verification
command and get a clean pass.

### Expected cascading failures

After adding a new requirement ID, expect these validator complaints:

- New REQ not in the manifest (Appendix E or equivalent).
- Test ID count mismatch.
- Cross-reference totals stale.
- **Spec hash drift.** When amending spec source files, `npm run
  assemble` produces a new SHA-256 that downstream artifacts (DECISIONS.md,
  server metadata) may store. A stale hash blocks pre-commit hooks — update
  the stored hash before committing. A content-only change (no REQ
  additions) still changes the hash via the assembly.

These are consequences of the change, not regressions. Fix them as part
of the same batch.

### Reflexion after each batch

After each change group, run the verification command. Then reflect:

- **Passed.** → next batch.
- **Failed.** → are the failures from this batch or pre-existing?
  - **New failures** — fix only these before the next batch.
  - **Pre-existing failures** — note them, do not fix. They are not
    this batch's scope.
- Does this batch's new prose pass the Phase 1 "what, not how" check?
  (Re-verify against authoring conventions discovered in Phase 0.)

Do not continue past a new failure. A batch that introduces a
verification regression must be fixed before the next batch starts.

### Final verification

When all batches are done, the verification command must exit zero.
Pre-existing warnings are acceptable. New errors or warnings introduced
by these changes are not.

### Changelog and commit

Load `changelog-before-commit`. Stage the changelog alongside the spec
changes — one atomic commit. The commit message mirrors the changelog
entry.

### AAR

Load `after-action-report`. Produce a structured AAR covering what was
planned vs. what happened, what went right/wrong, and any
recommendations.

```
spec-engineering complete. Commit <hash>: <N> changes, <verification> passed
```

## Edge Cases

### No spec document found
Ask the user: "Which file is the canonical specification?" Do not guess.

### No verification command found
Phase 2 still drafts the plan. Before Phase 3, create a minimal
verification step (at minimum: grep for REQ-ID collisions and
unreferenced test IDs). Flag the missing verifier in the AAR.

### No changelog found
Skip changelog update. Note the gap in the research report and AAR.

### Web search unavailable
Fall back to codebase-only research. Flag in the report: "Web research
skipped — findings may not reflect current best practices."

### No implementation to cross-reference
Skip the implementation evidence step. Note the gap in the report.

### Plan review fails
Fix the blockers in the draft. Re-run plan-review. Do not enter Phase 3
until `plan-review passed.` is produced.

### Multiple subsystems selected
Process one at a time, in the order the user selected them. The full
3-phase cycle for subsystem A completes (through commit) before
subsystem B starts.

### Verification fails after all batches
If the verification command still fails after fixing all batch-level
issues, present the residual failures to the user. Do not commit. The
user decides: fix further, accept partial, or revert.

## Output Contract

Every phase produces a searchable one-line status. These are handoff
tokens — other skills and future sessions can grep for them:

```
# After Phase 0
spec-discovery passed. Spec: <file> | Verify: <command> | Changelog: <file>

# After Phase 1
spec-research complete. <subsystem>: <N> improvements, <M> web-calibrated

# After Phase 2
plan-review passed. <N> changes across <M> files — [one-line scope summary]

# After Phase 3
spec-engineering complete. Commit <hash>: <N> changes, <verification> passed
```

## Mode Boundaries

- **Phases 0–2** run in plan mode (read + grep + glob only). No edits.
- **Phase 3** runs in build mode (edits + bash). The user must switch
  agents (or say "execute plan") to enter build mode. The skill does
  not auto-switch.
- If the user is already in build mode from the start, all phases may
  run in one session, but Phases 0–2 still use read-only tools until
  the plan is confirmed.

## Anti-patterns / Refuse to

- Do not skip the discovery phase and assume another project's conventions.
- Do not skip web calibration in Phase 1 — stale information is a
  failure mode.
- Do not execute Phase 3 without a confirmed `plan-review passed.` line.
- Do not present vague improvements ("consider improving X") — every
  recommendation must name the exact spec line and the exact new prose.
- Do not commit without running the verification command.
- Do not fix pre-existing verification failures — those are out of scope
  for this improvement.
- Do not continue past a batch that introduces a new verification failure.
