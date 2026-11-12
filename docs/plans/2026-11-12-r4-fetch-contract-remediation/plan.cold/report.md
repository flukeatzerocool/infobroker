# Independent Cold Review — R4 fetch contract remediation

**Reviewer:** DeepSeek V4.1 Flash 1017 (fresh subagent; no authoring context)
**Plan sha256:** `f16abeb1829e2342adf07e613660f91f8f45daf372b428fdf61d3464baaf5ad7`
**Artifact:** `/home/fluke/Infobroker/docs/plans/2026-11-12-r4-fetch-contract-remediation/plan.md` (20,391 bytes, 312 lines)
**Repo root:** `/home/fluke/Infobroker`
**Depth:** standard · **Read budget:** 40 · **Reads used:** 32 read/grep/glob calls (plus two `shell` probes denied by permission; skill loads not counted)
**Stages:** 5/5 under the parent's stage mapping (1 Blocker, 2 Major/scope, 3 Assets, 4 Dependency/edge cases, 5 Verification). The skill's Stage 4 "re-zoom" was not triggered because no artifact edits were made during review.
**Comprehension (Stage 2):** faithful. The plan fixes three R4 findings by correcting prose, not behaviour: remove the false "Jina default" claim from the tool schema, tool description, REQ-021 and README; add `raw` to REQ-021's enumeration; rewrite §6.4 to state the chain, hedge, throttle/error and anti-bot fall-through. Evidence is one live-schema test plus read-back for §6.4/README; done means all three rows `Resolved`, gates green, roadmap section retired, CHANGELOG and increment record updated.

_Persisted by the parent session from the reviewer's final message; the reviewer could not write files (shell denied in the cold context)._

## Findings

### Major

1. **[Major][design] Missed default-claim surfaces.**
   The done bar says "no surface advertises a schema default" and the goal is one consistent statement (plan:67-72, 20-25), but the blast radius and slices name only five surfaces (plan:159-182). Two repo documents still advertise Jina as the default:
   - `AGENTS.md:16` — "Fetch URL content via Jina Reader (default) or native HTTP".
   - `infobroker.md:1431` — "`fetch_page` — Jina Reader as default renderer, native fallback".

   `AGENTS.md` is not in the Phase 0 audit list (plan:203-206), so the plan cannot even discover it. `infobroker.md` is audited, but no step edits a result outside REQ-021/§6.4; the audit step has no downstream action. `README.md:254` ("hands any URL to Jina Reader") is also an implied default claim, and the skills references (`skills/infobroker/SKILL.md:76,203`, `skills/technical-writing/SKILL.md:39`) describe Jina unconditionally. Fix: add these surfaces to the slice map/blast radius (or state explicitly that they are out of scope and narrow the done bar accordingly), and give Phase 0 step 2 a branch that edits every match it finds.

2. **[Major][design] README acceptance criterion has no matching step and collides with an existing paragraph.**
   The done bar requires the README to say that omitting `renderer` runs the chain and that a named value pins one renderer (plan:69-72), and D1 repeats that (plan:100-103). The actionable step only says "extend the fetch paragraph's fallback conditions to match §6.4" (plan:226-227; D3 plan:129-134). It never says to replace `README.md:254` ("hands any URL to Jina Reader"), the actual false-default sentence. Worse, the planned restatement duplicates the existing "Hedged fallback" paragraph at `README.md:780-796` (challenge fall-through is already at 787-790), which `scripts/validate-readme.ts:246-261` checks as near-duplicate sentences. The edited `### Content Extraction` h3 is also under the 350-word budget (`README.md:82-83`), yet the plan records no current/post word count and defers to `validate-readme` (plan:270-272), which the plan-review checklist expressly says not to do. Fix: name the exact README sentence change, record the h3 word count before/after, and resolve the duplicate by cross-referencing the hedge section or wording the fetch paragraph distinctly.

3. **[Major][clarity] The quoted REQ-021 edit does not produce the stated count and writes ungrammatical prose.**
   Plan:57-61 says the edit is `` `extract`. `` → `` `extract`, and `raw`. `` (+7 → 789). Applied literally to `infobroker.md:268`, that produces "..., `crawl`, and `extract`, and `raw`." and +11 characters → **793**, not 789. The +7/789 figure only works if the anchor is `and `extract`.` → `` `extract`, and `raw`. `` (removing the first "and"). D2's "805" is internally consistent with the intended 789+16, but not with the literal 793+16 = 809. The Appendix B limit still holds either way (793 < 800; 7 characters headroom, not 11), and 4 SHALL clauses / 16 backticks are correct, but the exact edit instruction is ambiguous and, followed literally, puts defective prose into the spec. Fix the anchor and restate the counts; C-2 should compare against the corrected anchor.

4. **[Major][clarity] "Three description strings in `src/index.ts`" contradicts the blast radius's two strings.**
   D5 (plan:145-148) and the non-closure rule (plan:91-92) scope production edits to three description strings, but the blast radius names exactly two: the tool description at `src/index.ts:1897` and the `renderer` schema description at `:1900` (plan:167-169). No third string is identified; C-1 (plan:254-258) also says "description strings" without a count. This matters because the non-closure rule is the guard against scope drift. Fix: state two, or name the third explicitly.

### Nit

5. **[Nit][clarity] Wrong line citation for the REQ-021 body.** Plan:43 and :45 cite `infobroker.md:267`, which is the REQ heading; the body is `infobroker.md:268` (the worklist row correctly cites 268 at `worklist.md:734`).

6. **[Nit][clarity] "Three surfaces" undercounts.** Plan:43 says three surfaces advertise the default; `AGENTS.md:16`, `infobroker.md:1431` and the implied `README.md:254` make at least five, which is also why finding 1 is a completeness risk.

7. **[Nit][design] F-R4-F-2 orphan phrasing.** Plan:282-284 says the roadmap coverage gap now includes F-R4-F-2 "after this section retires", but the R4 roadmap section (`ROADMAP.md:19`) never named F-R4-F-2; it was already unowned. The non-closure rule (plan:92-94) says unshipped rows stay on a successor section, yet no successor section is created; C-9 records this, but the wording should say F-R4-F-2 was already unowned rather than newly orphaned.

## Verified positives (not findings)

- **Predicates hold.** `renderer` is `.optional()` with no `.default` (`src/index.ts:1900`), descriptions claim a default (`:1897`, `:1900`), REQ-021 says "`jina` default" (`infobroker.md:268`), the handler is `renderer ? [renderer] : getDispatchChain("content_fetch")` (`src/index.ts:1131`), and the shipped chain is `["jina","native_fetch"]` (`config.json:259`). `raw` is in the schema (`src/index.ts:1908`), mandated by REQ-021j (`infobroker.md:297-298`) and absent from REQ-021's enumeration. §6.4 (`infobroker.md:841-845`) does contradict REQ-021's hedge and REQ-021f's challenge fall-through (`:268`, `:285-286`).
- **D1's rejected alternative is sound.** A schema default would make `renderer` always defined and collapse the dispatch to `[jina]`, disabling the hedge and `native_fetch` fallback; special-casing `"jina"` cannot distinguish a caller's pin from an injected default. Rejection is correct.
- **Appendix B compliance holds.** Body baseline is 782 characters (measured independently); the tool-signature exception applies because the body contains "Parameters:" (`infobroker.md:1606-1609`); 16 backticks and 4 SHALL clauses are within limits. **789 is correct for the intended grammatical anchor; 793 for the literal one quoted in the plan.** Either is under 800.
- **Gate and commit discipline are plausible.** `check` baseline is 22 gates (matches `AGENTS.md` gate table); CHANGELOG under the existing `## 2026.11.11` heading (`CHANGELOG.md:3`) matches the version-sync constraint; the three-commit order leaves each commit typecheck-clean and the full check runs on the final tree, as `AGENTS.md` requires. The new test's `listTools()`/`isolatedConfigEnv()` premise is real (`src/tool-surface.test.ts:12,46-50`), and the existing search_web test at `:187-236` is the right shape.
- **Roadmap trigger is met.** `ROADMAP.md:17-22` is the first section and its trigger is "after chunk R5 closes"; `docs/plans/2026-11-09-full-review-r5/aar.md` ends `LOOP PAUSED`.

## Unknowns

- **Baseline metrics** (99 unpushed commits, oldest 2.3 d, 154.5 s full check, 17 open roadmap items, the one pre-existing `check-loop-artifacts` warning) were not independently verified: `shell` was denied. The evidence sidecar confirms `git_head d43192dbf4ed…` and a clean tree except the increment directory; it does not carry those counts.
- **Plan sha256** was not independently recomputed (shell denied); the dispatched hash matches the sidecar's recorded hash and byte count.
- **Sentence count convention:** the plan's 5 sentences is consistent if the `_Check:` clause counts as a sentence; otherwise the body has 4. Either way under 8; `validate-spec`'s exact convention was not inspected.
- **Near-duplicate check outcome** cannot be known without the final README sentence; finding 2 is a risk, not a confirmed gate failure.
- **Evidence sidecar REQ coverage:** its `reqs` matches point at CHANGELOG/plan text, not the spec definition of REQ-021/021f/021j; the plan's spec citations were verified by direct read instead.
- **Report persistence:** not written (shell denied, cold-stage mode); parent must persist this report.

**Coverage:** plan artifact; evidence sidecar; `src/index.ts:1131,1897-1908`; `config.json:259`; `infobroker.md:267-301,841-845,1431,1598-1617`; `README.md:82-83,248-267,780-796`; `AGENTS.md:16`; `ROADMAP.md:17-22`; `CHANGELOG.md:1-16`; `worklist.md:257,269,734-737`; `src/clause-coverage.ts:1-90`; `src/tool-surface.test.ts:12,46-50,187-236`; `scripts/validate-readme.ts:246-261`; R5 AAR.

**Verdict:** 0 Blockers · 4 Majors · 3 Nits. The plan is executable and its predicates and Appendix B conclusion are sound; the Majors are completeness/clarity defects that should be corrected before execution, not reasons the document cannot be executed.

independent-review passed.
