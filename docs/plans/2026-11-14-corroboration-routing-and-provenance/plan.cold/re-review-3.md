# Targeted re-review (pass 3) — `plan.md`

**Artifact:** `/home/fluke/Infobroker/docs/plans/2026-11-14-corroboration-routing-and-provenance/plan.md`
**Declared sha256:** `59c66f5ec70dd6b245268b1baecf71600d740bff0efa957da4fbe2d0d7a02e30`
**Computed sha256:** `59c66f5ec70dd6b245268b1baecf71600d740bff0efa957da4fbe2d0d7a02e30` — exact match (`sha256sum`)
**Prior pass:** `plan.cold/re-review.md` (sha256 `ac465f0d182183ed7141dfdadda61840a35d63352515a9f6675ed9812186e321`)
**Mode:** cold, targeted re-review, standard depth, read-only. No authoring context received.

## Spot disposition

| Spot | Verdict | Evidence |
|---|---|---|
| 1 — Commit series | **RESOLVED** (one Nit) | `plan.md:266-278`, `plan.md:186-189`, `plan.md:224-227`; `scripts/validate-spec.ts:140-142`; AGENTS.md § Spec Authoring |
| 2 — Step count | **RESOLVED as specified**; one new Major introduced by the same change (N1) | grep: zero matches for `five`, `fix(verify)`, `5 commits`, `five-commit`, `commit 5`; four commits at `plan.md:266, 269, 279, 281, 283` |
| 3 — Header and Files expected | **STILL-BLOCKING** | `plan.md:3-5` and `plan.md:7-9` contradict the authorized third pass; `plan.cold/re-review.md` is listed at `plan.md:376` |
| 4 — Baseline census citation | **RESOLVED** | `plan.md:80-81`, `plan.md:237-239`, `plan.md:338-339`; verified `worklist.md:584` = Severity census, `worklist.md:585` = Disposition census |

Severity counts: **Blocker 0 · Major 2 · Nit 3.**

## Spot 1 — RESOLVED

`plan.md:266-268` declares four commits, and `plan.md:269-278` makes commit 1 steps 1–3 as **one** commit over `infobroker.md`, `src/corroborate.ts`, `src/types.ts`, `src/index.ts`, `src/corroborate.test.ts`, gated on `npm run validate-spec`, `npm run typecheck`, `npx vitest run src/corroborate.test.ts`, and `npm run check-gate-coverage`.

That is internally consistent with the gate:

- `scripts/validate-spec.ts:140-142` errors on a REQ with no `@implements` citation and no waiver, so a spec-only commit would fail its own gate.
- `plan.md:224-227` places the `@implements REQ-026i` clause tags and the `REQ-026d` tag in the test file inside commit 1, satisfying the AGENTS.md § Spec Authoring rule ("tags in the same commit as the REQ change").
- `check-gate-coverage` is satisfied by the same commit because the tests carrying the citations land with the REQ.

The step-1 Verify line (`plan.md:186-189`) no longer asserts a step-1 green: it states that `validate-spec` requires the citation arriving in step 3 and that steps 1–3 land as one commit. **Nit [clarity]:** it still opens with the step-local imperative "Verify: `npm run validate-spec`". Rewording to "Verify at the joint commit boundary (after step 3)" would remove the residual reading that `validate-spec` is a step-1 gate.

## Spot 2 — RESOLVED as specified

The check requested passes: no surviving "five", no `fix(verify)`, no fifth commit. The series enumerates exactly four (`plan.md:269`, `279`, `281`, `283`).

However, the same commit-series change leaves a surviving contradiction — reported below as **N1**.

## Spot 3 — STILL-BLOCKING [Major][clarity]

`plan.md:3-5` says:

> "…the diff re-review raised one Major on the commit series, resolved in-text and **not re-reviewed (cap reached)**"

and `plan.md:7-9` says:

> "**Review independence:** fresh — **two** cold dispatches (initial pass, then one diff re-review) …; **neither** reviewer saw the authoring context"

Both record the cap as terminal and omit the authorized third dispatch. The required history is three cold dispatches: cold pass, diff re-review, and this authorized targeted re-review. The phrase "not re-reviewed (cap reached)" is now superseded by the dispatch itself.

The Files-expected half is satisfied: `plan.cold/re-review.md` is listed at `plan.md:376`.

**What must change:** update after this pass (before the final stamp) to something like: *Status — cold pass passed (0 blockers, 5 majors / 5 nits resolved); diff re-review raised one Major on the commit series, resolved in-text; a third, user-authorized targeted re-review (cap waived) is recorded in `plan.cold/re-review-3.md`.* And: *Review independence — fresh; three cold dispatches (initial, diff, authorized targeted) over frozen artifacts; no reviewer saw the authoring context.*

If the header is edited after this pass, the recorded plan sha will change; the review record should either cite the final plan sha or be regenerated. **Nit [clarity]:** add `plan.cold/re-review-3.md` to Files expected (`plan.md:374-378`) since this pass creates it.

## Spot 4 — RESOLVED

`plan.md:80-81` attributes the census to `docs/plans/2026-11-09-full-review-sweep/worklist.md:585` (disposition), not `:584`. `plan.md:237-239` updates the **disposition** row at `:585`, expects `Resolved 179` / `Scheduled-roadmap 4`, and explicitly forbids touching the severity row at `:584`. Done bar 1 (`plan.md:338-339`) cites `:585`. Verified directly: `worklist.md:584` is "Severity census"; `worklist.md:585` is "Disposition census".

## New findings introduced by the changed spots

### N1 — [Major][clarity] The four-commit change leaves a false per-step commit claim

`plan.md:302-303` still says:

> "**Rollback:** each step is its own commit; reverting the series restores the previous contract…"

That is false against the new series: eight steps map to four commits — steps 1–3 → commit 1, steps 4–5 → commit 2, step 6 → commit 3, step 7 → commit 4, step 8 → no commit (`plan.md:266-285`). During rollback this misstates granularity: "step 2" is not independently revertible.

`plan.md:156-158` compounds it: "Commits follow the bucket order spec → source → tests → docs → release, one concern per commit, with `npm run typecheck` after each." Commit 1 merges the spec, source, and tests buckets, so the sentence now reads as one commit per bucket when commit 1 deliberately merges three.

**What must change:** replace line 303 with "the series is four commits; steps 1–3 land as one"; and qualify line 158 to say typecheck runs after the code commit and before each later commit (or list typecheck in commits 2–4's gate lines).

### N2 — [Nit][clarity] Typecheck omitted from commits 2–4

`plan.md:279-285` lists `check-roadmap`/census, `validate-readme`, and `version-sync` as the gates for commits 2–4, while `plan.md:158` and AGENTS.md's commit routine require `npm run typecheck` after every split commit. Add it to each gate line or narrow the sentence.

## Unknowns

- I did not read `tasks.md` (not in the dispatch paths). If it mirrors the commit series, it may still carry the old count or the per-step wording.
- I did not execute any gate. Spot 1's consistency was verified against `scripts/validate-spec.ts:140-142` and the plan's own gate lists, not a run.
- I did not re-read `plan.cold/report.md`; I accepted the prior re-review's recital (`re-review.md:9-10`) and the user-provided history for the cold-pass counts.
- Host-injected AGENTS.md and user-level instructions were present; per the skill this weakens isolation. No authoring conversation was received.
- Read-only: I could not write `plan.cold/re-review-3.md`; this report is returned in full.

## Reads used

1. `plan.md` (393 lines, full)
2. `plan.cold/re-review.md` (56 lines)
3. `scripts/validate-spec.ts:120-164`
Plus two greps (`plan.md` for `five|fix(verify)|5 commits|five-commit|commit 5`; `worklist.md` for the two census headings) and one allowlisted `sha256sum`/`ls`. Repo-root only; no globbing.

---

**Verdict:** three of four spots resolved; spot 3 still blocking (header omits the authorized third dispatch), plus one new Major on the rollback/commit-count wording. Both are prose fixes, but the artifact as dispatched (sha `59c66f5e…`) does not meet the stated header requirement.

independent-review FAILED.
