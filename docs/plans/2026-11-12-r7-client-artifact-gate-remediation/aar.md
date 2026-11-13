# AAR — R7 client-artifact gate remediation

**Status:** closed 2026-11-12 · **Loop:** `LOOP PAUSED`
**Plan:** `docs/plans/2026-11-12-r7-client-artifact-gate-remediation/plan.md` (revision 2, standard depth; cold pass 4/5 stages plus one diff re-review and one post-cap verification).
**Predecessor:** `docs/plans/2026-11-12-r7-routing-citation-remediation/`.
**Roadmap:** § R7 client-artifact gate remediation retired to this entry; § Review-loop convergence **stays** (see the cap record).

## Scope

F-R7-A-1 (REQ-050 content gate warned), F-R7-A-2 (REQ-051 clauses unasserted,
token clause misattributed), F-R7-D-1 (pipeline TAIL omitted TRANSLATE),
F-R7-D-3 (no manifest-language instruction or stale-value check), F-R7-D-4 (an
unsupported drafted claim could be softened instead of removed or marked
unverified). One defect class: a G3 content gate asserting less than its REQ.

## What happened

1. `validate-spec` now fails on a missing instruction file or orchestrator
   skill, and on a missing clause: REQ-050's KB-first / external-fallback /
   reserved-`manage_kb` trio; REQ-051's two pipelines, per-pipeline KB phase,
   Phase-0 escalation anchor, manifest, quality gate, archive receipt, and
   `verify_report`. The imperative-token message names `(REQ-051/REQ-052, §9.4)`
   — its actual carrier — instead of implying a REQ body states the rule.
2. The pipeline diagram's TAIL and the Fact-Check chain carry `translate`; the
   gate asserts the tail phase order and that any inline chain reaching
   `archive` names `translate` and `revalidate` first. `REPORT_TAIL` gained
   `TRANSLATE`, so every shape `**Pipeline:**` paragraph must carry it.
3. Both `SKILL.md` REDRAFT-CHECK blocks and the `workflows.md` bullet now say an
   unsupported claim is removed or marked unverified; a new enumerating helper
   covers all three blocks and rejects softening-to-modality.
4. TRANSLATE records the output language in the manifest; REVALIDATE passes
   `--expect-language <tag>`. `validateReport(text, { expectLanguage })` and the
   `validate-report` flag reject a missing (`manifest-language-required`) or
   stale (`manifest-language-mismatch`) value. `D-109` records why the check is
   caller-declared.
5. Registers: eight worklist rows resolved, the roadmap section removed, a
   CHANGELOG entry added, and §9.4 extended to name the new content checks.

## What went right

- Every new assertion was probed red-first and restored: REQ-050 paragraph
  deletion (0 → 1), escalation imperative (0 → 1), both ARCHIVE receipts (0 → 1),
  TAIL `translate` (0 → 1), a shape-pipeline `TRANSLATE` (0 → 1), the old
  soften-to-modality wording (0 → 1), the TRANSLATE manifest-language sentence
  (0 → 1), and the three language cases via the CLI (2 → 0 / 1 / 1).
- The pre-implementation probes found two loose anchors before they shipped:
  the file-level `receipt` check was satisfied by the tool-selection table
  (`SKILL.md:221`), so it moved into the per-ARCHIVE-step assertion; and the
  first `/soften/i` rule rejected the correct "never rescued by … softening"
  sentence, so it narrowed to `soften … modality`.
- The reviewer's C-8 finding (the Phase 0 table also contains "escalate to
  `analysis-loop`") produced a precise imperative anchor instead of a broader
  check.

## What went wrong

- **The review cap was exceeded.** The plan recorded one cold pass plus one diff
  re-review. After the re-review's C-8/C-9 amendments, a bounded verification
  was needed to satisfy the build gate's `independent-review passed.` token; it
  found the escalation anchor still loose, which needed a second bounded
  verification. Two post-cap passes ran. Consequently § Review-loop
  convergence is **not** retired.
- **The receipt assertion was initially too coarse** — caught by its own probe,
  not by review.
- One probe (`P3`) first returned exit 0 after removing both ARCHIVE receipts,
  because a third `receipt` mention in the tool table satisfied the file-level
  check; the assertion was scoped to the ARCHIVE steps.
- The `build-review passed.` contract was not emitted before the first edit;
  the gate checks (stamp, hash, independence token, changed state, rollback)
  were applied, but the audit line was omitted and is recorded here rather
  than retroactively.

## Finding dispositions

| Finding | Severity | Disposition | Evidence |
|---|---|---|---|
| F-R7-A-1 | P2 | resolved in-session | `validate-spec` REQ-050 block; deletion probe exit 1; file-absence error |
| F-R7-A-2 | P2 | resolved in-session | six clause assertions; token message names `(REQ-051/REQ-052, §9.4)`; probes exit 1 |
| F-R7-D-1 | P2 | resolved in-session | TAIL and FC chain carry `translate`; TAIL sequence + chain rule; `REPORT_TAIL` includes `TRANSLATE` |
| F-R7-D-3 | P2 | resolved in-session | `--expect-language`; three tests; `D-109` |
| F-R7-D-4 | P2 | resolved in-session | three REDRAFT-CHECK blocks reworded; softening probe exit 1 |

No open P0/P1 beyond the scheduled roadmap. The next open roadmap section is
§ R7 export remediation.

## Review record

| Pass | Result | Notes |
|---|---|---|
| Self (revision 1) | passed | checklist applied in-context |
| Cold (revision 1) | `FAILED` — 3 blockers / 4 majors / 4 minors / 4 nits | `/tmp/opencode/r7-client-artifact-cold-report.md`; 4 stages, 30/40 reads |
| Diff re-review (revision 2) | `plan-review passed.` — 0 blockers, 1 major, 2 soft | `/tmp/opencode/r7-client-artifact-rereview.md`; C-8/C-9 |
| Post-cap verification 1 | `independent-review FAILED.` — C-8 escalation half | `/tmp/opencode/r7-client-artifact-final-verification.md` (superseded) |
| Post-cap verification 2 | `independent-review passed.` | `/tmp/opencode/r7-client-artifact-final-verification.md` |

Review-loop cap: one cold pass plus at most one diff re-review. **The cap was
exceeded by two bounded post-cap verifications**, user-authorized by the
"execute plan" instruction, each limited to the amended lines. Recorded, not
excused.

## Step-to-evidence

| Step | Command | Result |
|---|---|---|
| Baseline | `npm run check` | PASS, full, 164.0 s, 22 gates (`936fb99`) |
| REQ-050/051/120 probes | `npx tsx scripts/validate-spec.ts` | green on tree; each seeded deletion exit 1 |
| Language CLI | `validate-report --expect-language …` | `en` 0; `de` 1 `manifest-language-mismatch`; missing 1 `manifest-language-required` |
| Unit tests | `npx vitest run src/report-contract.test.ts` | 29/29 PASS |
| Typechecks | `npm run typecheck`, `npm run typecheck:scripts` | PASS |
| Doc/register gates | `validate-spec`, `validate-readme`, `check-roadmap`, `check-non-goals`, `version-sync`, `check-loop-artifacts`, `check-report-fixtures`, `check-script-discipline` | all exit 0 |
| Close gates | `npm run check:fast`; `npm run check` | PASS 27.2 s; PASS 162.1 s, 22 gates, recorded for `b3f5aa6` |

LOOP PAUSED
