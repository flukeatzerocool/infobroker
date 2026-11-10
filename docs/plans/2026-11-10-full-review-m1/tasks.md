# Tasks — full-review sweep, chunk M1 and program close

Increment: `docs/plans/2026-11-10-full-review-m1/`. One checkbox per plan step.
Commands are recorded verbatim so the result is reproducible.

## Phase 0 — Scaffold and baseline

- [x] Write `plan.md`, this `tasks.md`, and the `aar.md` stub (terminal `LOOP OPEN`).
- [x] User approves execution (plan step 0).
- [x] `npm run check` un-piped; record exit status, gate count, wall time, `audit` advisories, HEAD.
- [x] Record `git status --porcelain`, `git rev-parse --short HEAD`, `npm run status`, tagged version.
- [x] `npm run check-fixtures -- --now=2026-11-10`; record fixture ages (informational).

## Phase 1 — Machine evidence

Record each leg as `command` → status → wall time → observation. Gating legs must
exit 0; informational legs record their parsed result, not their (always-0) exit.

- [x] `npm run check-pack` (gating)
- [x] `npm run test-debate-club` (gating)
- [x] `npm run audit` (gating)
- [x] `npm run check-tdqs -- --report` (informational: structural-violation count)
- [x] `npm run check-gate-coverage -- --report` (informational: G1 coverage/exemptions)
- [x] `npm run check-intent-citations` (gating)
- [x] `npm run check-report-fixtures` (gating)
- [x] `npm run validate-spec` (gating)
- [x] `npm run validate-readme` (gating)
- [x] `npm run check-shipped-kb-empty` (gating)
- [x] `npm run check-gate-table` (gating)
- [x] `npm run check-loop-artifacts` (gating)

## Phase 2 — Coverage reconciliation

- [x] REQ closure: distinct §4 REQ IDs vs 142; every verdict cell is `holds`, `finding:<ID>`, or `deferred:<chunk>`.
      `grep -o '^| REQ-[0-9a-z]*' docs/plans/2026-11-09-full-review-sweep/worklist.md | sort -u | wc -l`
- [x] Finding closure: cited IDs vs register rows; every row has chunk, predicate, severity, disposition; zero non-`Resolved` `P0`.
      `grep -oE 'finding:F-[A-Za-z0-9-]+' … | sed 's/finding://' | sort -u` vs `grep -oE '^\| F-[A-Za-z0-9-]+' … | sed 's/^| //' | sort -u`
- [x] Prose closure: all 22 ownership units (`worklist.md:83-104`); write the §1 goal 3 row (`finding:F-R2-27`) and file the ownership conflict (P3).
- [x] Section-level prose walk: every section named in a chunk's `Spec:` line has a prose row or that chunk's REQ rows.
- [x] Disposition mapping: 74 ID-named / 42 chunk-register / 52 unbacked (R4 18, R5 27 + 1 malformed, R6 6); record the census; repair the `F-R5-B-8` row's unescaped pipes.
- [x] Roadmap shape: heading-list diff (sweep absent, 27 remediation + `## Non-goals` present); `npm run check-roadmap`; `npm run check-non-goals`.
- [x] Chunk closure: status board R1–R9 + M1 closed; every `docs/plans/*/aar.md` carries a terminal token.

## Phase 3 — Close

- [x] Disposition M1 findings: `F-M1-1` (goal-3 ownership conflict, P3 `Closed-P3`), `F-M1-2` (disposition drift census, P3 `Closed-P3`). A behavioral red names its chunk and lands `LOOP OPEN`.
- [x] Remove `## Full-repository review sweep` from `ROADMAP.md`; apply the two bounded register repairs; update the status board (M1 closed, next trigger `—`); tick the verified sweep `tasks.md` boxes.
- [x] `npm run check` un-piped (first authoritative gate); on red, apply the step-16 rollback rule and do not write a token.
- [x] Program AAR in `docs/plans/2026-11-09-full-review-sweep/aar.md` (Phase-A record preserved; counts; census; terminal token).
- [x] M1 AAR in this directory (terminal token).
- [x] `npm run check` un-piped on the finished tree; a red gate flips both tokens to `LOOP OPEN` and restores the roadmap section.
- [x] Split commits: `docs(review)` → `docs(roadmap)` → `docs(plans)`; `npm run session:close`.
