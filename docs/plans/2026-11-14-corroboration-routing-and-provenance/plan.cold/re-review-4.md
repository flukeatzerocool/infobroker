## Cold targeted re-review (pass 4) — `plan.md`

**Artifact:** `/home/fluke/Infobroker/docs/plans/2026-11-14-corroboration-routing-and-provenance/plan.md`
Plan sha256: 724be19c96f1385de64d014259dc7ea7163e4a2bf5c37ad3ee7f54db88175067
**Declared sha256:** `724be19c96f1385de64d014259dc7ea7163e4a2bf5c37ad3ee7f54db88175067`
**Computed sha256:** `724be19c96f1385de64d014259dc7ea7163e4a2bf5c37ad3ee7f54db88175067` — exact match (`sha256sum`)
**Prior pass:** `plan.cold/re-review-3.md` (declared sha `59c66f5e…2e30` for the pre-amendment artifact)
**Mode:** cold, targeted re-review, standard depth, read-only. No authoring context received. I could not write `re-review-4.md`; report returned in full.

### Spot disposition

| Spot | Verdict | Evidence |
|---|---|---|
| 1 — Header: three dispatches, cap not terminal | **RESOLVED** (one Nit) | `plan.md:3-8`, `plan.md:10-12`, `plan.md:363-365` |
| 2 — Rollback: four commits, steps 1–3 as one | **RESOLVED** | `plan.md:308-312` |
| 3 — Steps preamble; typecheck in commits 2–4 | **RESOLVED** | `plan.md:159-162`; `plan.md:285`, `:288`, `:290` |
| 4 — `re-review-3.md` in Files expected | **RESOLVED** | `plan.md:385` |
| 5 — Step 1 verification not a step-1 `validate-spec` gate | **RESOLVED** (residual elsewhere, F1) | `plan.md:193-197` |
| Commit series = exactly four, no self-contradiction on count | **CONFIRMED** | `plan.md:160`, `:269-291`, `:308` |

Severity counts: **Blocker 0 · Major 1 · Nit 4.**

### Spot 1 — RESOLVED

`plan.md:3-8` now records three dispatches: the cold pass ("0 blockers; 5 majors and 5 nits resolved"), the diff re-review ("raised a Major on the commit series (resolved in-text)"), and "a third, user-authorized targeted re-review (cap waived)". The superseded phrase "not re-reviewed (cap reached)" is gone. `plan.md:10-12` says "**three** cold dispatches (initial, diff re-review, user-authorized targeted re-review) … no reviewer saw the authoring context" — replaced "two"/"neither". Neither line calls the cap terminal; `plan.md:363-365` states the cap as a declaration and the third dispatch's authorization requirement, which is the correct non-terminal form.

Nit [clarity], `plan.md:10-12`: the header counts three dispatches, but this review is a fourth, so the header is stale by one pass on exactly the field spot 1 governs. Same lag the prior pass predicted (`re-review-3.md:54`). Because this occurs on every pass, it cannot be closed by editing; it is properly closed by the AAR recording the dispatch count and the user authorization, not by a fifth header edit.

### Spot 2 — RESOLVED

`plan.md:308-312` reads: "**Rollback:** the series is four commits; steps 1–3 land as one because the REQ citation must ship with the REQ … Reverting only the tracker/README/release commits leaves the behavior change in place." The prior false claim ("each step is its own commit", `re-review-3.md:64-66`) is gone. The two-part statement now matches the series: reverting all four restores the prior contract; reverting only commits 2–4 leaves the behavior change, which is true because the routing code lands in commit 1. No residual per-step claim survives anywhere in `plan.md` (grep for `per step|each step|own commit|one concern per commit|per bucket` returns only `plan.md:330`, which is F1 below, and does not bear on commit granularity).

### Spot 3 — RESOLVED

`plan.md:159-162`: "The deliverable is four commits (steps 1–3 land as one), so `npm run typecheck` runs on the code commit and again before each later commit; `npm run check` runs once on the close-time tree." That is neither "one commit per bucket" nor "typecheck after every step".

All three later commits carry typecheck in their gate lines: commit 2 `plan.md:284-286` ("`npm run typecheck`, `npm run check-roadmap`, plus the census re-derivation"), commit 3 `:287-288` ("`npm run typecheck`, `npm run validate-readme`"), commit 4 `:289-291` ("`npm run typecheck`, `npm run version-sync`"). Commit 1 `:281-283` carries typecheck plus `validate-spec`, the corroborate tests, and `check-gate-coverage`. Consistent with `plan.md:271` ("each earlier commit passes its own gate before the next is staged").

### Spot 4 — RESOLVED

`plan.md:385` lists `…/plan.cold/re-review-3.md`. Sibling entries `:383-384` cover `report.md` and `re-review.md`.

Nit [clarity], `plan.md:383-387`: `plan.cold/re-review-4.md` (this pass) is not listed. Same one-pass lag as spot 1's nit; a plan cannot enumerate the review that reviews it.

### Spot 5 — RESOLVED (amended line), with residual at F1

`plan.md:193-197` now opens "Verify at the joint commit boundary (after step 3): `npm run validate-spec` … `validate-spec` also requires the `@implements` citation, which arrives in step 3, so steps 1–3 land as one commit (see Commit series)." The step-local imperative "Verify:" that `re-review-3.md:30` flagged is replaced by an explicit boundary scoping. No step-1 `validate-spec` gate remains in **step 1's own verification**.

### Commit-count confirmation

Four commits, enumerated once, at `plan.md:269-291` (commit 1 = `:274-283`, commit 2 = `:284-286`, commit 3 = `:287-288`, commit 4 = `:289-291`), declared four at `:160`, `:271`, and `:308`. Cross-checked for the old five-commit count: grep for `five|5 commits|fix(verify)|commit 5|five-commit` over the increment directory hits nothing in `plan.md`. Steps 4–7 map to commits 2–4 and step 8 is close-time-only, which matches. Done bar (`:341-359`) and User impact (`:316-323`) make no per-commit claim. **Nothing in `plan.md` contradicts itself about the commit count.**

### New findings

**F1 — [Major][clarity] The Verification section reinstates the step-local `validate-spec` claim that spot 5 removed.**
`plan.md:327-330`: "The targeted gate set (`typecheck`, `validate-spec`, `check-gate-coverage`, `validate-readme`, `check-roadmap`, `check-intent-citations`, `version-sync`, `npx vitest run src/corroborate.test.ts`) runs on the working tree at every step."

Steps 1 and 2 have no `@implements` citation until step 3, so by the plan's own reasoning (`plan.md:193-197`, `:278-281`) both `validate-spec` and `check-gate-coverage` fail on the step-1 and step-2 working trees. The bullet asserts they run — and by implication pass — at every step, which is the precise misreading spot 5 was dispatched to remove, restated 130 lines later and outside the amended line. This does not affect the commit count (it is a verification-granularity claim), and step 8 (`:264-267`) already lists the targeted suite correctly at its own boundary.

What must change: scope the sentence, e.g. "each gate runs at the step whose Verify line names it; `typecheck` and the corroborate tests run on the step-2/step-3 working tree, `validate-spec` and `check-gate-coverage` first pass at the joint step-1–3 commit boundary, and the remainder at the close-time tree." I have not marked this a blocker for the targeted pass: all five dispatched spots resolve, and the specific line they name is fixed. It is a one-sentence fix, appropriate to record alongside the other residual condition rather than to trigger a fifth dispatch (AGENTS.md Review-Loop Governance, narrowing rule).

**F2 — [Nit][clarity] `tasks.md:18` still describes the increment as five commits.**
"Standard depth (…, one new REQ, **five commits**, all reversible)." `tasks.md:35-36` in the same record corrects to four ("commits, not five"), and `plan.md` is consistently four. The stale figure is a descriptor of the dispatch-1 artifact, but it reads as a current property of the plan and sits above the correction. Reword to "four commits after the dispatch-2 amendment" or leave the historical framing explicit.

**F3 — [Nit][clarity] `tasks.md:44-47` records the amendments as "Not re-reviewed".**
That entry was accurate at stamp time but is now false: this pass is that re-review. The record needs a dispatch-4 line naming `plan.cold/re-review-4.md`, otherwise the durable execution log understates the pass count that `plan.md:10-12` reports — and `plan.md` lists `tasks.md` as a deliverable (`:386`).

**F4 — [Nit][clarity] The AAR must record authorization for both post-cap dispatches.**
`plan.md:363-365` requires a third dispatch's authorization in the AAR; this fourth dispatch also needs one. Still satisfiable at close (the AAR does not yet exist, `plan.md:89`, `:266-267`), so this is a reminder for the close step, not a defect in the artifact. Noted because the header now asserts a count the AAR must corroborate.

### Unknowns

- I did not read `plan.cold/report.md`, `re-review.md`, or `infobroker.md`; I accepted `re-review-3.md`'s recital of the cold-pass counts and `tasks.md:21-38` for the dispatch history. No authoring conversation was received.
- I executed no gate. Spot 3's typecheck claims and spot 5's joint-boundary reasoning were checked against the plan's own text and the gate names in AGENTS.md, not against a run of `validate-spec`.
- I read `tasks.md`, which was not among the dispatch paths, because the prior pass left it as an Unknown (`re-review-3.md:80`) and it mirrors the commit series. Treat F2–F3 as secondary to the `plan.md` finding.
- Host-injected AGENTS.md and user-level instructions were present, which the skill counts as weakened isolation; the dispatch also supplied the prior pass's findings, so my spot framing is inherited rather than independently discovered. I never saw the authoring conversation.

### Reads used

1. `plan.md` (402 lines, full)
2. `plan.cold/re-review-3.md` (97 lines, full)
3. `tasks.md` (87 lines, full)

Plus one `sha256sum`, one `ls` of the increment and `plan.cold/` directories, and one `grep` (`five|5 commits|per step|each step|every step|one concern per commit|per bucket|each step is|own commit`) over the increment directory. Repo-root only; no globbing, no reads outside the dispatch paths except the sibling `tasks.md` noted above.

---

**Verdict:** all five amended spots RESOLVED and the four-commit series is internally consistent; no blocker. One Major [clarity] at `plan.md:327-330` (F1) is a one-sentence residual of the spot-5 defect class, and three nits record the by-one-pass staleness of the header and `tasks.md`. The artifact meets the dispatched requirements.

independent-review passed.
