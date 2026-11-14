# Tasks — Corroboration pool routing and provenance fidelity

Execution log. One entry per plan step. Evidence lines are copy-pasted command
output or a named test, not summaries. Nothing below is started until the plan
gate passes and the user confirms the plan/build seam.

## Step 0 — Baseline (2026-11-14)

- `git log -1 --oneline` → `09a1374 docs(plans): record the temp-space finding in the AAR`
- `git status --short` → empty
- `npm run status` → unpushed 249, oldest 5.0 d, version 2026.11.11, latest
  tag v2026.11.07, open roadmap 2, last pipeline run 2026-11-07.
- `npm run check` → `gates: PASS (full, 162.7s)`; recorded full run for
  `09a1374b3785`.

### Plan-gate review record

Standard depth (`ROADMAP.md:17-31`, three findings, one new REQ, four commits
after the dispatch-2 amendment, all reversible).

1. Dispatch 1 — cold `independent-review`, artifact sha256 `4fe24ef8…6f`:
   `independent-review passed.` — 0 Blockers, 5 Majors, 5 Nits. Report at
   `plan.cold/report.md` (sha256 `7d684456…6c`). The reviewer ran stages 1–5
   in one cold context (the harness forbids nesting) and used 45 reads against
   a 40 budget; both recorded in its disclosure.
2. Majors resolved in the artifact: C-4 re-based on the reachable `searchers`
   seam; `finding_index` defined as the returned-array position; census row
   corrected to `:585` plus the `:304` verdict row; §7.4 and the §3 glossary
   added as registration surfaces; the full gate moved to the close-time tree.
3. Dispatch 2 — diff re-review of the revised artifact
   (sha256 `4b9554a5…2d`), report at `plan.cold/re-review.md`:
   `independent-review FAILED.` — all 10 prior findings RESOLVED, 1 new Major:
   a spec-only first commit cannot pass `validate-spec`, because the
   `@implements REQ-026i` tags land with the tests. Resolved in-text by merging
   steps 1–3 into one commit (four
   commits, not five), fixing the step-1 verify line, updating the header,
   listing `plan.cold/re-review.md` in Files expected, and re-citing the
   baseline census to `:585`. **Review cap reached**.
4. User authorized a third targeted re-review (cap waived). Dispatch 3 —
   `independent-review FAILED.` on two prose spots: the header still recorded
   the cap as terminal, and the rollback wording still claimed one commit per
   step. All four spots otherwise RESOLVED. Report at
   `plan.cold/re-review-3.md`, sha256 `9cc2a8e1…52`.
5. Amendments applied after dispatch 3 (header history, rollback granularity,
   per-commit `typecheck` gates, `re-review-3.md` in Files expected, step-1
   verify wording). Recorded as condition **C-1**.
6. Dispatch 4 — user-authorized targeted re-review of the amended artifact:
   `independent-review passed.` — all five spots RESOLVED, 0 blockers, one
   Major rejected as a blocker (F1: the Verification bullet claimed the whole
   gate set runs at every step) and three nits. Report at
   `plan.cold/re-review-4.md`, sha256 `6d91cd3a…b2`.
7. F1 applied after dispatch 4 as a one-sentence scope fix (condition
   **C-2**); `tasks.md` nit F2 (commit count) corrected above; nit F3 closed
   by this entry. Nit F4 (the AAR must record both post-cap authorizations)
   is carried to the close step.
8. Re-stamped: `kind planned`, `independence fresh`, `depth standard`,
   `stages 4`, plan sha256
   `724be19c96f1385de64d014259dc7ea7163e4a2bf5c37ad3ee7f54db88175067`
   (the reviewed bytes). The gate binds the stamp to that hash, so the F1
   sentence (C-2) cannot be edited in before `mark-build` without breaking the
   binding: the bytes were restored from the stamped copy, the stamp was
   re-made against `re-review-4.md`, `mark-build` recorded
   `npm run check → PASS (full, 163.0s)`, and only then was F1 applied. The
   final `plan.md` therefore differs from the reviewed artifact by that one
   clarified bullet, recorded here.

## Step 1 — Spec (REQ-026i, REQ-026d)

Status: done. Evidence:
- `validate-spec` → `143 REQs in spec (15 artifact-exempt)`, `128 REQs cited`,
  `All checks passed.`
- REQ-026i body: 532 chars, 7 SHALL, 5 backtick tokens, one paragraph.
- Registration surfaces: §9.5 manifest, §D taxonomy, §9.2 checklist, §7.4,
  §3 glossary, and §1.6 reservation (`026a`–`026i`).
- First run failed twice: `REQ-026i: no @implements citation` (the scan reads
  only the first tag line, `scripts/validate-spec.ts:91`) and `026i: in REQ
  manifest but missing from the block-reservation paragraph (§1.6)`. Both
  fixed; see AAR F-AAR-1/F-AAR-2.

## Step 2 — Source

Status: done. Evidence:
- `npm run typecheck` → exit 0.
- `applyPriority`: privacy intersects, quality orders via `orderFirstPassPool`.
- `snapshotCondensedSources`: schedules on `!content_sha256 || !snapshot_tier`.
- `provenance`: `findings[]` + per-source `finding_index`; types extended.

## Step 3 — Tests

Status: done. Evidence:
- `npx vitest run src/corroborate.test.ts` → `122 passed`.
- Named tests present: "re-snapshots a source that arrives with a hash but no
  tier", "attributes each provenance source to its returned finding", "orders
  the pool by configured provider priority for quality", "restricts privacy to
  the intersection with the caller's pool", "leaves a pool that satisfies no
  privacy provider unchanged".
- `npm run check-gate-coverage` → 118 cited, 1 exempt, 0 waived.

## Step 4 — Register census

Status: done. Evidence:
- `npx tsx docs/plans/2026-11-14-register-reconciliation/evidence/census.ts` →
  `rows: 276`, `distinct ids: 276`, `Resolved: 179`, `Closed-P3: 93`,
  `Scheduled-roadmap: 4`, `census self-check OK`.
- Rows `:742`, `:763`, `:765` read `**Resolved 2026-11-14**`; `:304` verdict
  row updated; disposition census at `:585` re-derived.

## Step 5 — Roadmap

Status: done. Evidence:
- `npm run check-roadmap` → `OK (3 section(s))`.

## Step 6 — README

Status: done. Evidence:
- `npm run validate-readme` → `0 error(s), 0 warning(s)`.

## Step 7 — Version stamp and CHANGELOG

Status: done. Evidence:
- `scripts/version.ts set 2026.11.14` → all seven sites rewritten.
- `npm run version-sync` → `Version sync OK. Root version: 2026.11.14`.

## Step 8 — Full gate

Status: done. Evidence:
- `npm run check` → `gates: PASS (full, 163.0s)`; `check-loop-artifacts` →
  `0 error(s), 1 warning(s)` (the warning is the pre-existing
  `2026-11-10-r6-encryption-capacity-remediation` plan, not this increment).
