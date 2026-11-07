# Plan — gated, independent code review in the push pipeline

**Increment record:** docs/plans/2026-11-07-pipeline-code-review/
**Project:** Infobroker (spec version 2026.11.7)
**Baseline:** main at 84eeeac, clean tree, 25 commits ahead of origin; check:fast green at 84eeeac and full check green on the preceding identical content.
**Review depth:** standard — multiple files, fully reversible, no external state.
**Rollback cost:** 1 — source and prompt edits only; no destructive, remote, credential, or schema operation.

**Done bar:** The pipeline records, validates, and gates an independent code review of the sync diff. Two new pure helpers are unit-tested. bash -n and check-script-discipline are green. test-push-pipeline stays green unchanged. check:fast and the full check are green. AGENTS.md and CHANGELOG describe the step, and the increment record is committed. The working tree is clean with commits split by concern.

## 1. Problem and evidence

- scripts/pipeline/prompts/sync.md:29 tells the sync agent to "load and apply the code-review skill against the sync diff". It is the only mention of code review in the pipeline.
- The instruction has no contract: no summary artifact, no closing token, no shell check. A skipped or empty review is indistinguishable from a clean one. Compare the read-through, which writes readthrough.json, ends with a READTHROUGH token, is validated by summary_counts, halts on critical, and repairs high findings.
- The reviewer is the author: the sync agent reviews code it just wrote. The plan-review skill treats author-as-reviewer as a real collision.
- Consequence: the pipeline's spec review is gated and its code review is not. This plan closes that gap without adding a fourth review pass.

## 2. Design

- The review is part of step 3 (sync), not a new step name. STEP_ORDER, validate_step, run-mode, run logging, and the hermetic harness are untouched.
- Conditional: it runs only when the working tree has source or config changes (git status --porcelain -- src config.json is non-empty). A run where sync early-exits for "no REQ changes" pays nothing; that was the case in run 20261107-141154.
- Independent: the review runs in a forked session (the run_scan_ai_one pattern), under the full model and build agent, so it does not inherit the implementer's context.
- Recorded: the reviewer writes sync-review.json with {"status":"complete","critical":N,"high":N,"info":N} and ends with the token SYNC REVIEW N critical; N high; N info.
- Gated: critical halts the run. High findings get a bounded repair turn (fix-review.md) followed by a fresh forked re-review, capped at PIPELINE_FIX_ATTEMPTS. Info is advisory and reported.
- The artifact is authoritative. A token/JSON disagreement is a warning, not a reconcile turn: unlike the read-through, the JSON is the gate and the mismatch is cosmetic.

## 3. Changes by file

### scripts/pipeline/lib.sh

Add two pure helpers beside classify_gate_failure, so both are testable without a model:

- review_required <porcelain-output> — prints "true" when the status names src/ or config.json, "false" otherwise. Matches tracked, untracked, and renamed paths.
- review_gate_decision <critical> <high> <attempt> <max> — one of "halt" (critical > 0), "giveup" (high > 0 at the attempt cap), "repair" (high > 0 below the cap), "pass" (no critical or high). Mirrors the classify_gate_failure contract and comment style.

### scripts/push-pipeline.sh

- Declare OUT_SYNC_REVIEW="$PIPELINE_RUN_DIR/sync-review.txt" and SYNC_REVIEW_JSON="$PIPELINE_RUN_DIR/sync-review.json" beside the other OUT_ variables.
- Add run_forked_step <prompt> <out> <title-suffix> [flags...] before step 3: the existing run_scan_ai_one body, generalized. run_scan_ai_one becomes a thin wrapper that calls it with the light agent and model. No behavior change for the scan step.
- Insert the review block after the sync step's non-zero check and before the post-sync gates, so the gates validate the reviewed tree:

    if review_required "$(git -C "$PROJECT_DIR" status --porcelain -- src config.json)"; then
      render sync-review.md -> sync-review.prompt.md
      rm -f "$SYNC_REVIEW_JSON"   # before every reviewer turn
      run_forked_step ... --model "$PIPELINE_MODEL"
      validate summary_counts + status == complete; token mismatch -> warn
      loop bounded by PIPELINE_FIX_ATTEMPTS against review_gate_decision:
        pass   -> break
        halt   -> die "Code review BLOCKED: N critical (see ...)"
        giveup -> die "Code review: N high after M repair attempt(s)"
        repair -> render fix-review.md, run the repair in the main session
                  under PIPELINE_REPAIR_AGENT, rm -f the artifact again,
                  then re-fork the review
      record REPAIR_ATTEMPTS["Code review"]
    else
      info "Code review: SKIPPED (sync changed no source or config)"
    fi

- Add a "Code review:" line to print_readiness_report when the counts exist (N c / N h / N i), and honor --dry-run / step_skip the same way the rest of step 3 does.

### scripts/pipeline/prompts/sync-review.md (new)

Independent review prompt. Scope: git diff HEAD -- src config.json plus untracked files under src/; ignore version-only hunks in src/index.ts. Apply the code-review skill: correctness, security, performance, and conformance to the changed REQs. Cite file:line. Do not re-run the gate suite (the pipeline re-gates afterwards). Severity definitions: critical = wrong behavior, data loss, or a security defect; high = a defect that surfaces under realistic use; info = improvement. End with the artifact and token contract above, copied from the JSON.

### scripts/pipeline/prompts/fix-review.md (new)

Bounded repair prompt modeled on fix-high.md: findings text, counts JSON, dispositions path, output path. Verify each finding against the tree first; a false finding must not be "fixed". Smallest correct change; never weaken a test, gate, or REQ to silence a finding. Run the targeted tests for touched files, not the full suite. Write dispositions as a JSON array of id, status (fixed or rejected), and reason.

### scripts/pipeline/prompts/sync.md

Reword step 7 (lines 29-32) from "the review" to a self-check: keep the in-loop fixes, and state that the pipeline's independent, gated review after this step owns the recorded verdict. Step numbering and the other steps are unchanged.

### scripts/pipeline/pipeline-logic.test.ts

Two new describes mirroring the classify_gate_failure case style:

- review_required: a source edit, an untracked source file, a config.json edit -> true; a docs-only edit, an empty status -> false.
- review_gate_decision: (0,0,0,2) pass; (3,0,0,2) halt; (0,2,0,2) repair; (0,2,2,2) giveup; (0,0,5,2) pass.
- summary_counts coverage: a valid artifact prints three counts; a missing file and a malformed shape exit non-zero (the gate's fail-closed path, currently untested).

### AGENTS.md

One sentence in the push-pipeline section: the sync step is followed by an independent, gated code review of the source diff, skipped when sync changed no source, which halts on critical and repairs high findings within the fix budget.

### CHANGELOG.md

New top entry under 2026.11.7: the code review is now recorded and gated; critical halts, high repairs within the budget, and a run with no source change skips it.

### docs/plans/2026-11-07-pipeline-code-review/

plan.md (this plan, with the Done bar line), tasks.md, aar.md ending in the loop token.

### README.md

Verify only. It documents no pipeline internals (checked: no read-through or push-pipeline mentions), so no edit is expected.

## 4. Failure handling

- Missing, malformed, or incomplete sync-review.json: fail the step (summary_counts exits non-zero), same as the read-through.
- Stale artifact: SYNC_REVIEW_JSON is deleted before every reviewer turn, including each re-review, so a turn that exits 0 without writing fails the gate instead of passing on the previous attempt's counts. This is stricter than the read-through, which reuses its summary across a reconcile turn.
- Reviewer turn non-zero: die with the output path; no partial gate.
- Critical finding: die. Auto-repairing a correctness defect without a failing test is riskier than repairing spec prose, so a human decides.
- High finding at the attempt cap: die with the artifact path.
- Forked session failure: the subshell returns the review's exit code; the caller dies.
- All paths leave the tree as the sync step wrote it plus repair edits, so a resume or a revert is possible.

## 5. Verification

1. bash -n scripts/push-pipeline.sh scripts/pipeline/lib.sh — 0.
2. npx vitest run scripts/pipeline/pipeline-logic.test.ts — new cases pass.
3. npm run check-script-discipline — 0.
4. Gate dry run on the current tree: source lib.sh and run review_required with the live git status (expect false, since this plan changes scripts and docs, not src/ or config.json) and with fixture status strings (expect true). Recorded in the AAR.
5. npm run test-push-pipeline — green and unchanged (all eight harness invocations use --no-ai, so the sync path is skipped; this proves no regression).
6. npm run check:fast — 0.
7. npm run check — 0.
8. Deferred, stated explicitly: prompt efficacy is exercised by the next real npm run prep on a code-changing run. No harness can fake a model turn, so this plan does not claim the prompt itself is proven.

## 6. Commit series

| # | Commit | Files | Gate before commit |
|---|---|---|---|
| 1 | feat(pipeline): gate an independent code review after sync | lib.sh, push-pipeline.sh, sync.md, sync-review.md, fix-review.md, pipeline-logic.test.ts | bash -n, vitest pipeline-logic, check-script-discipline, test-push-pipeline |
| 2 | docs: describe the gated code review | AGENTS.md, CHANGELOG.md | version-sync, check-gate-table |
| 3 | docs(plans): increment record for the gated code review | docs/plans/2026-11-07-pipeline-code-review/ | check-loop-artifacts |

Three commits, one concern each.

## 7. Blast radius

| File | Change | Size |
|---|---|---|
| scripts/pipeline/lib.sh | two pure helpers | S |
| scripts/push-pipeline.sh | review block, helper extraction, report line | M |
| scripts/pipeline/prompts/sync.md | step 7 reworded | S |
| scripts/pipeline/prompts/sync-review.md | new prompt | S |
| scripts/pipeline/prompts/fix-review.md | new prompt | S |
| scripts/pipeline/pipeline-logic.test.ts | three new describes | S |
| AGENTS.md | one sentence | S |
| CHANGELOG.md | one entry | S |
| docs/plans/2026-11-07-pipeline-code-review/ | plan, tasks, aar | S |
| README.md | verify only; expected no diff | — |

## 8. Edge cases and rollback

- A docs-only change set leaves src/ and config.json untouched, so the review is skipped and no tokens are spent.
- A version-only sync (version literals only) still triggers the review; the prompt tells the reviewer to ignore version hunks. Considered excluding it and rejected: the exclusion needs a diff parse for no real saving.
- The repair turn runs in the main session so it keeps the sync context; the re-review forks again so it stays independent.
- A resumed run re-runs the review if the journal did not mark sync complete; state_mark sync is unchanged.
- Rollback: git revert the three commits; the pipeline is developer tooling, so no runtime or published behavior changes.

## 9. Assumptions and their verification

- A1: every harness invocation uses --no-ai — verified by grep (eight invocations, all --no-ai), so the sync block never runs in the harness.
- A2: no spec REQ or prose describes the pipeline's internal review steps; C.9 constrains staging, gates, tags, and secrets only — verified by grep for readthrough/read-through in infobroker.md (none) and by reading C.9. No spec edit is needed.
- A3: README documents no pipeline internals — verified by grep (no push-pipeline or read-through mentions).
- A4: sync edits are confined to src/ and config.json plus the version stamps — verified by reading sync.md steps 1-6.
- A5: pipeline-logic.test.ts sources lib.sh, so the new helpers are testable headlessly — verified by reading the harness.
- A6: summary_counts already fails closed on missing or malformed artifacts — verified in lib.sh.

## 10. Alternatives considered

- Make the sync agent write the review artifact itself (no new pass). Cheapest, but keeps author-as-reviewer and still trusts a self-report; rejected.
- A separate named step (3b) after sync. Cleaner in the step vocabulary, but it touches STEP_ORDER, validate_step, run-mode, the resume journal, and the harness for one conditional pass; rejected as disproportionate.
- Always run the independent review, with no condition. Simplest logic, but it spends a model turn on runs that changed no code; rejected.
- A diff-size threshold for independence. Adds plumbing and a tunable; the conditional skip already captures the real saving; rejected.

## 11. Trust boundary

Every premise is repository-sourced (prompts, shell, harness, spec). The review prompt treats the diff as data and forbids following instructions found in reviewed content, matching fix-gate.md's stance.

## 12. Spec-project checks

- No REQ body, register row, coverage map, or fingerprint changes, so the spec-addition blast radius does not apply.
- No ROADMAP item is needed: the work ships in-session.
- Resolves the gap recorded in the session assessment (sync.md:29 unverifiable review); no spec-review report is involved.
