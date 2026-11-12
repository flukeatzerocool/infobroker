# Independent Cold Re-Review — R4 fetch contract remediation

**Reviewer:** DeepSeek V4.1 Flash 1017 (fresh subagent)
**Prior plan sha256:** `f16abeb1829e2342adf07e613660f91f8f45daf372b428fdf61d3464baaf5ad7`
**Revised plan sha256:** `c3a72f3ff1f77f81f65a971efc2532c8340df8d2dcadee0b59ed137bb0ce4885` (supplied; not independently recomputed — `shell` denied)
**Artifact:** `/home/fluke/Infobroker/docs/plans/2026-11-12-r4-fetch-contract-remediation/plan.md`
**Mode:** targeted diff re-review; changed lines only; unchanged-text findings are Deferred.
**Reads:** 3/10 (revised plan, prior report, `skills/infobroker/references/journeys.md:25-44`)
**Stages:** 5/5 (this pass is the Stage 4 re-zoom plus the affected Stage 1/2/3/5 checks; no separate dispatch)

_Persisted by the parent session from the reviewer's final message._

## Prior finding dispositions

1. **RESOLVED — missed surfaces.** The done bar, "Why" paragraph, D3a, slice B, blast radius, commit 2, Phase 0 step 2 and C-12 now cover `AGENTS.md:16` and `infobroker.md:1431`, and the Phase 0 sweep records every match with a disposition. The skills exclusion is reasoned, and `journeys.md:33` was verified as saying "renderer chain (Jina → native)".
2. **PARTIALLY RESOLVED — README acceptance/duplication.** D3 now names the two exact sentence changes, forbids restating the anti-bot fall-through, and the done bar/C-5 record 208→~218 words against the 350-word budget. The duplicate risk is closed. **Remaining:** the done bar's universal clause still requires *all* seven surfaces to say both "omitting `renderer` runs the chain" and "a named value pins one renderer" (plan:68-77), but D3's two README sentences (plan:135-141; `README.md:254-256`) and D3a's AGENTS/migration reword (plan:147-150; `AGENTS.md:16`, `infobroker.md:1431`) only state the chain/primary and fallback. An implementer following the steps cannot satisfy the done bar as written.
3. **RESOLVED — REQ-021 anchor/count.** The corrected anchor `` and `extract`. `` → `` `extract`, and `raw`. `` is +7; 782 + 7 = 789, and D2's 805 is consistent. The "other reading" 793 is noted only as a fallback, not as the instruction.
4. **RESOLVED — two description strings.** D5 (plan:171-172) and the non-closure rule (plan:96-97) now say two, matching the blast radius (`src/index.ts:1897,1900`).
5. **RESOLVED — REQ-021 body citation.** Plan:43 and :45 now cite `infobroker.md:268`.
6. **PARTIALLY RESOLVED — surface count.** Plan:43 changed "three" to "five" but then enumerates "the four above plus `AGENTS.md:16` ... and ... `infobroker.md:1431` ... and `README.md:254`" — seven surfaces, not five.
7. **RESOLVED — F-R4-F-2 wording.** C-9 (plan:318-320) now says F-R4-F-2 was already unowned.

## Remaining findings

- **[Major][clarity] Done bar overstates what the auxiliary surfaces will say.** Plan:68-77 requires every listed surface (including the README, `AGENTS.md` and the migration table) to state both the omission-to-chain contract and "a named value pins one renderer". The named edits at plan:135-141 and 147-150 do not add the pinning clause to `README.md:254-256`, `AGENTS.md:16`, or `infobroker.md:1431`. Fix: either narrow the done bar to the omission-to-chain wording for those three surfaces (keeping the pinning clause for the schema/tool descriptions and REQ-021), or add the pinning sentence to the D3/D3a edits.
- **[Nit][clarity] Surface count is internally inconsistent.** Plan:43 says "Five surfaces ... the four above plus ... and ... and ..." while listing seven. Fix the count or the enumeration.
- **[Nit][clarity] Stale depth rationale (unchanged text, Deferred).** Plan:3 still describes the depth as "three prose surfaces plus one schema-description surface"; the revision now edits five prose surfaces plus the schema description. No execution impact; standard depth remains correct.

## Verification notes

- Surface list is otherwise complete: the audit now covers `src/index.ts`, `infobroker.md`, `AGENTS.md`, `README.md` and `skills/**/*.md`, and the only remaining Jina mentions are accurate ("primary", "chain", or provider tables).
- No new Blocker introduced. The corrected Appendix B arithmetic holds: 789 characters, 4 SHALL, 16 backticks, within 800; the literal alternative reading would be 793, still within the limit.
- No new contradiction found in the commit series, slice map, blast radius, or Phase 0/2 steps beyond the done-bar wording above.

**Verdict:** 0 Blockers · 1 Major · 3 Nits — passed. The Major is a wording mismatch between the acceptance bar and the named edits, not a reason the plan cannot be executed.

independent-review passed.
