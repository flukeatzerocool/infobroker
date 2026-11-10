# Independent review — plan.cold report (stage 1)

**Reviewer:** `review` subagent (cold stage; single-context run — see Unknowns)
**Plan:** `docs/plans/2026-11-10-full-review-m1/plan.md`
**Plan sha256:** `877f6cd7c39b3850d0182023510de638b5f6548ec1210cb842ff72537c1d7beb`
**Date:** 2026-11-10 · **Depth:** standard
**Stages:** 1, 2, 3, 5 completed; **stage 4 N/A** (read-only reviewer; no edit was made, so there is no fix to re-zoom)
**Persisted by:** the parent session — the reviewer ran under a read-only harness and could not write this file. The body below is the reviewer's stage output, verbatim.

`independent-review FAILED. plan.md — 1 blocker`

## Blockers

### B1 — [design] The roadmap-mapping invariant is false for R2 and R3

Anchor: plan.md:13 (done bar (b)), plan.md:33 (M1-D3), plan.md:47 (EV4), plan.md:76 (step 12).

The plan asserts "every `Scheduled-roadmap` ID is named by a `ROADMAP.md` section" (plan.md:13), "maps each `Scheduled-roadmap` disposition to a section that names the ID" (plan.md:33), and "Every register row disposed `Scheduled-roadmap` names an ID that appears in `ROADMAP.md`" (plan.md:47). That is not true for the R2 and R3 findings.

- The register has **27** `Scheduled-roadmap` rows for `F-R2-*` and **15** for `F-R3-*` (42 total): `rg 'Scheduled-roadmap' worklist.md | rg -c 'F-R2-'` = 27, `... F-R3-` = 15.
- `ROADMAP.md` contains **zero** `F-R2-` or `F-R3-` tokens: `rg -c 'F-R2' ROADMAP.md` and `rg -c 'F-R3' ROADMAP.md` return no match; `rg -c 'F-R[0-9]'` = 63, all from other chunks.
- The R2 section (ROADMAP.md:76-82) and R3 section (ROADMAP.md:84-90) describe the work by behavior and the Trigger references "the R2/R3 finding register"; neither names a finding ID.

Consequence: step 12 as written would report 42 gaps. Under the plan's own non-closure rule (plan.md:15), an unresolved coverage gap keeps the roadmap item and ends `LOOP OPEN` — so the plan's expected close (PAUSED) is contradicted by its own evidence. Repairing it by adding the 42 IDs to the R2/R3 sections would violate "only the `## Full-repository review sweep` section is removed" and "the 27 remediation sections stay untouched" (plan.md:34, 82), so the done bar and the scope constraint cannot both be met.

Fix: redefine the invariant at the mapping level actually used — "every `Scheduled-roadmap` row maps to a remediation section that names the finding ID **or** its chunk's finding register; R2/R3 use the chunk-register form (42 rows)" — state that explicitly in done bar (b), M1-D3, EV4, and step 12, and record the per-chunk counts; or expand the retirement commit to add the IDs to R2/R3 and update M1-D4/scope. Do not close on the current invariant.

## Majors

### M1 — [design] The §1 goal 3 "P3 tracker repair" rests on evidence the cited record disclaims

Anchor: plan.md:15 (non-closure rule), plan.md:32 (M1-D2), plan.md:48 (EV5), plan.md:75 (step 11).

- worklist.md:86 assigns "§1 goal 3 (provider intelligence)" to R3.
- R3's own plan says the opposite: `docs/plans/2026-11-09-full-review-r3/plan.md:33` (D28) — "R3 owns §7.4 only"; R3's AAR (`docs/plans/2026-11-09-full-review-r3/aar.md:12`) — "14/14 REQs ... plus §7.4".
- Searching the R3 record for `provider intelligence`, `goal 3`, or `§1 goal` returns nothing.
- The only goal-3 reference is R9's preamble row (worklist.md:534), which asserts "R3 goal 3" as a claim, not evidence.

So the premise in M1-D2 — "the reviewing evidence already exists in the closed chunk's record" — is not established for this prose unit. If it does not exist, the plan's own non-closure rule (plan.md:15) makes this an unresolved coverage gap (`LOOP OPEN`), not a P3 tracker repair.

Fix: name the exact R3 REQ rows that supply the goal-3 evidence (the provider-selection/quality/routing rows, e.g. worklist.md:209, 216, 222) and state the prose row's predicate in step 11; or add an explicit bounded prose-review step for §1 goal 3; or classify it as a coverage gap and land `LOOP OPEN`. Do not write a `holds` row without a predicate.

### M2 — [design] Retirement, status close, and AAR tokens are written before the authoritative final gate; the red path does not undo them

Anchor: plan.md:15, plan.md:82-85 (steps 15-18).

Step 15 removes the ROADMAP section, step 16 writes both AARs with a terminal token, and step 17 marks M1 closed and sets next trigger `—`. Step 18 is the normative `npm run check`. But step 18's red path only says "re-opens the owning chunk and lands `LOOP OPEN`" and, for a formatting/tracker gate, "amend step 15 or 17 and re-run". It never says to restore the removed roadmap section, revert the status board, or rewrite the AAR tokens. That contradicts the non-closure rule ("the roadmap item stays", plan.md:15). The AARs are also written before the final check, so the final exit status cannot be recorded in them.

Fix: move the retirement, status close, and AAR token write after step 18, or add an explicit red-path rollback block: restore the `## Full-repository review sweep` section, reopen M1 on the status board, rewrite both AAR tokens to `LOOP OPEN`, and re-run `check-roadmap`/`check-loop-artifacts`/`npm run check`. Record step 18's exit status in the AARs after it runs.

### M3 — [design] Report-mode legs are recorded as "green" although `--report` always exits 0

Anchor: plan.md:13 (done bar (a)), plan.md:66 (step 5), plan.md:68 (battery table), plan.md:100 (anti-theater risk).

- `scripts/check-tdqs.ts:31`: "`--report` Print the JSON report and always exit 0 (informational)".
- `scripts/check-gate-coverage.ts:28`: "`--report` Print the classification and always exit 0 (informational)".
- `scripts/check-fixture-freshness.ts:10-11`: "Exit codes: 0 = report printed (always, including stale findings)".

Done bar (a) says "green meaning every deterministic leg exits 0" and lists "TDQS report" and "fixture freshness" among the legs. A recorded exit 0 for these commands cannot distinguish a pass from a structural violation or a stale fixture, so the exit-status column is vacuous for them. The anti-theater mitigation in plan.md:100 ("the report modes ... are the substantive evidence") depends on reading the report content, which the plan never says to record.

Fix: mark these three legs informational in the battery table; record the parsed content (structuralViolations count, G1 coverage/exemptions, fixture ages) as the evidence; and rely on the gating invocation from step 1 (or run `check-tdqs`/`check-gate-coverage` in gating mode) for the exit-0 claim. Rewrite done bar (a) to distinguish gating legs from informational legs.

### M4 — [design] The program plan.md and the sweep tasks.md are live cross-references the register list omits

Anchor: plan.md:34 (M1-D4 live-register list), plan.md:82 (step 15), plan.md:84 (step 17).

- `docs/plans/2026-11-09-full-review-sweep/plan.md:6` carries `**Roadmap item:** ROADMAP.md § Full-repository review sweep`. The same directory's `aar.md` is being rewritten as the program AAR (M1-D7), so the increment is open until M1 closes; the plan neither updates that roadmap line nor declares it historical.
- M1-D4 says "the live registers updated in the same step are `worklist.md`, `ROADMAP.md`, and the program AAR", but step 17 also edits `docs/plans/2026-11-09-full-review-sweep/tasks.md` (the M1 checkboxes), which the list omits.

The plan's claim that R1-R9 `plan.md`/`aar.md` are historical is correct per `docs/plans/README.md` ("Plans are not edited after close"), but the program plan is not in that set.

Fix: add the program `plan.md` and the sweep `tasks.md` to M1-D4; either update the program plan's `**Roadmap item:**` line in step 15 (before the increment closes) or list it explicitly as historical with the README rationale. State the treatment.

### M5 — [design] Done bar (f) and C-3 conflict for environmental gates

Anchor: plan.md:13 (done bar (f)), plan.md:21 (C-3), plan.md:99.

C-3 permits an environmental leg (`audit`, `check-pack`, `test-debate-club`) to be recorded `NOT_RUN` with a reason. But `npm run check` runs all 22 gates sequentially and stops at the first failure; a `NOT_RUN` environmental leg still makes the aggregate exit non-zero. Done bar (f) requires "a final un-piped `npm run check` on the finished tree exits 0", with no carve-out for C-3. The plan never defines the aggregate semantics for the NOT_RUN case.

Fix: define it: when a C-3 leg is `NOT_RUN`, the final-tree normative run is `npm run check:fast` plus the individually recorded non-fast legs, and the aggregate is recorded as "green with N NOT_RUN (environmental)"; otherwise `npm run check` must exit 0. Rewrite (f) accordingly.

## Nits

- N1 [clarity] plan.md:13/48/75 cite `worklist.md:82-104` for the 22 ownership units; the unit rows are 83-104 (line 82 is the separator). Cite 83-104.
- N2 [clarity] plan.md:48/75 say the ownership table "covers only §1 goals and §3 invariants"; it also covers §2 failure modes and §6.1-§6.2 (worklist.md:90, 103-104). Correct the sentence.
- N3 [design] plan.md:82/102 prove the retirement by count (28 → 27); the sweep section is itself well-formed, so a wrong-section removal would still leave 27. Diff the heading list (assert `## Full-repository review sweep` is absent and the 27 remediation headings are present).
- N4 [clarity] plan.md:44 EV1 says `check-loop-artifacts` passed "over 17 increments", but `listIncrements` scans 18 directories including the untracked M1 dir, and the gate prints the count (`scripts/check-loop-artifacts.ts`). Re-state the scan time or the count.
- N5 [clarity] plan.md:46 EV3 says "zero rows carry `**P0**`"; the register's severity cell is plain `P0` (worklist.md:579, 795), so `**P0**` is not a searchable token. Say "no row with severity `P0` and a non-`Resolved` disposition".
- N6 [clarity] plan.md:35 (M1-D5) calls the reconciliation a "`grep`/`comm` inspection"; tasks.md:33-36 records `sort -u` and `sed` and no `comm`. Align the wording or record the actual commands.
- N7 [clarity] plan.md:84 (step 17) ticks only the M1 boxes in `docs/plans/2026-11-09-full-review-sweep/tasks.md`; every R1-R9 checkbox (tasks.md:13-92) and Phase A's approval box (tasks.md:11) stay unticked while the board and AARs call those chunks closed. Tick or annotate them, or state that per-chunk checkboxes are historical.

## Adversarial-lens answers

- (a) "No code changes / LOOP OPEN on a red gate" can close the program only on the happy path. The red path is under-specified and conflicts with the retirement/status steps (M2) and with C-3's NOT_RUN allowance (M5).
- (b) The §1 goal 3 gap is real: no chunk record carries a goal-3 prose verdict, and R3's plan explicitly disclaims it. The P3 repair is only defensible if the plan names the REQ-row evidence and the row predicate (M1).
- (c) The step 18 vs step 19 ordering is coherent for the *content* (steps 15-17 edit the docs before step 18 reads them), but the terminal token and roadmap retirement are written before the authoritative gate (M2).
- (d) Removing the sweep section does not orphan a gate-checked cross-reference in `ROADMAP.md` (`check-non-goals` reads `## Non-goals`; `check-roadmap` reads section shape), but it orphans the program `plan.md:6` reference, which the plan does not name (M4).

## Verdict and counts

`independent-review FAILED. plan.md — 1 blocker`

Blockers: 1 · Majors: 5 · Nits: 7 · Stages: 1,2,3,5 (stage 4 N/A) · Reads: ~22/40

## Unknowns / isolation caveats

- Single-context run: the parent harness forbids spawning subagents, so stages 1, 2, 3, and 5 were executed in one context rather than five fresh contexts. Independence is weaker than the `independent-review` contract; every finding is anchored to a file:line so the parent can re-check it. This is the only isolation caveat.
- The 28-unpushed-commit state (C-1/EV8) and `npm run status` counts were not re-run; they are taken from the plan's evidence sidecar.
- `npm run check` (EV1) was not re-run; the green baseline is taken from the plan's tool-output row.
- The spec's §9.5 manifest was checked as 142 `| REQ-` rows, but the row-to-§4-ID mapping was not re-derived.
- The post-retirement `check-roadmap` run was not executed (read-only).
- The M1 `plan.md` is untracked at review time; the hash above is the dispatched hash.
