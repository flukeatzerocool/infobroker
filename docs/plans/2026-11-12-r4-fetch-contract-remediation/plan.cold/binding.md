# Independent Cold Binding Check — R4 fetch contract remediation

Plan sha256: e64be868ca5d78e5194c922afb966c5e94c2f937fff603ec877faa293b734174
**Reviewer:** DeepSeek V4.1 Flash 1017 (fresh subagent)
**Artifact:** `/home/fluke/Infobroker/docs/plans/2026-11-12-r4-fetch-contract-remediation/plan.md`
**Reads:** 3/5 (final plan, prior re-review, `AGENTS.md:12-19`) plus one `sha256sum`
**Stages:** 5/5 (binding confirmation under the same five-stage mapping; the prior re-review was the Stage 4 re-zoom)
**Hash check:** `sha256sum` returned `e64be868ca5d78e5194c922afb966c5e94c2f937fff603ec877faa293b734174`, matching the supplied value.

_Persisted by the parent session from the reviewer's final message._

## Prescribed fixes

1. **Done-bar split — CONFIRMED.** `plan:67-74` now divides the surfaces correctly: the `renderer` schema description, tool description and REQ-021 carry both the omission-to-chain and the named-value-pins clauses; the README, `AGENTS.md`'s tool table and the migration table carry the chain/primary/fallback statement without a default claim. This matches D3 (`plan:135-141`) and D3a (`plan:148-159`) and closes the re-review Major. No surface is now required to state a clause its named edit does not produce.
2. **Six-surface count — CONFIRMED as written.** `plan:43` says six surfaces and enumerates exactly six: schema description, tool description, REQ-021, `AGENTS.md:16`, `infobroker.md:1431`, `README.md:254`. The external `AGENTS.md` update makes one of the six stale — see the Nit below — but the count/enumeration fix itself is applied.
3. **Depth rationale — CONFIRMED.** `plan:3` now says "five prose surfaces plus one schema-description surface and one test file", matching the five prose surfaces (REQ-021, §6.4, README, `AGENTS.md`, migration table) plus the schema description and test.
4. **C-13 — CONFIRMED present.** `plan:318-322` records the three clarifications and delegates diff confirmation to `build-review`.

## Remaining findings

- **[Nit][clarity] Stale AGENTS predicate and a no-op planned edit.** `plan:43` still quotes `AGENTS.md:16` as "Jina Reader (default)", and D3a at `plan:149` still says it is reworded from that text. `AGENTS.md:16` now reads "Fetch URL content through the renderer chain (Jina Reader primary) or native HTTP" — already the target statement — so the actual default-claim count is five, not six, and Phase 2 step 6 (`plan:261`) has nothing to change in that file. Execution is unaffected: record `AGENTS.md` as already-satisfied in Phase 0 and skip the reword; update the row to five surfaces (or note the external fix).
- **[Nit][clarity] C-13's "exactly" is overbroad.** `plan:318-322` says the three clarifications are exactly the changes between the reviewed artifact and the stamped one, but this revision also updated the independence record at `plan:4` and C-7 (`plan:314-317`). `build-review`'s diff confirmation will see those edits too. List them as review-record updates or drop "exactly". No execution impact.

## Execution-affecting changes

None beyond the three clarifications and the already-applied `AGENTS.md` row. The done bar, steps, slice map, blast radius, conditions and verification table remain internally consistent. Appendix B arithmetic is unchanged and still holds: 789 characters for the intended anchor, 793 for the alternative reading, 4 SHALL, 16 backticks, within 800. No new Blocker or Major.

**Verdict:** 0 Blockers · 0 Majors · 2 Nits — passed.

independent-review passed.
