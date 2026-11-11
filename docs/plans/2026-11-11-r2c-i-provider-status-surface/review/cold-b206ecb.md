Reviewer: review subagent (deepseek-v4.1-flash orchestrator over 5 fresh contexts)
Plan sha256: b206ecb38f10234a5f39325ba57e5544549f563cd67d20cf09e916a54c9c10a4
Artifact: docs/plans/2026-11-11-r2c-provider-status-surface/plan.md (revision 2, before the directory rename)
Depth: standard · Independence: fresh
Stages: 4/5 (Stage 4 not triggered — no author edits during the pass)
Verdict: independent-review FAILED — 5 blockers (3 clarity, 2 design), 13 majors (7 clarity, 6 design), 10 nits
Comprehension: faithful-with-gaps (done bar recovered; gap = commit count)

This file is the cold-pass report as returned. It is not edited after stamping.

---

## Independent review — cold pass

**Reviewer:** deepseek-v4.1-flash (orchestrator) over 5 fresh contexts
**Plan sha256:** b206ecb38f10234a5f39325ba57e5544549f563cd67d20cf09e916a54c9c10a4 *(verified by `sha256sum`, matches the declared hash)*
**Artifact:** `/home/fluke/Infobroker/docs/plans/2026-11-11-r2c-provider-status-surface/plan.md` (519 lines)
**Depth:** standard · **Independence:** fresh (no authoring context, no prior findings, no sidecar conclusions passed to any reviewer)

### Stage coverage

| Stage | Context | Reads | Outcome |
|---|---|---|---|
| Prepare | parent | 3 | hash matches; 15 targets exist, 3 marked *new* correctly absent |
| 1 — zoom out | fresh | 10 | 3 Blockers, 10 Majors, 7 Nits |
| 2 — comprehension | fresh | 1 | **faithful-with-gaps** (done-bar recovered; gap = commit count) |
| 3 — critics ×3 | fresh ×3 | 24 | design 2B/8M, structural 2B/6M/5N, style 1B/12M/6N |
| 4 — re-zoom | — | — | **not triggered**: no author edits, artifact sha256 unchanged |
| 5 — readiness | fresh | 5 | **NO-GO**, 3 Blockers |

Stages executed: **4 of 5**. Synthesis read the artifact once (parent work, outside reviewer budget).

---

## Blockers — 5 (clarity 3, design 2)

**B1 [clarity] Rollback cardinality contradicts the commit series.** `plan.md:11` "revert **two** commits" and `plan.md:501` "Revert the two commits" versus `plan.md:447` "**Three commits**" with three enumerated at `:450–460`; `:453` adds a "fold commit 1 and 2" alternative that would make it two again. A literal two-commit revert leaves commit 2's source on top of reverted spec (or vice versa) — a non-building tree. *Must change:* one cardinality in all three places, and § Rollback must name the buckets it reverts.

**B2 [design] Phase 1 cannot be executed in the stated order.** `plan.md:389–393` (Phase 1 step 2) writes `src/provider-status.test.ts` importing `classifyCredential` (`:390`) and covering `selectActiveRows` (`:392`); both are created in Phase 2 (`:405–410`, `:407`). Nonexistent exports make the file unloadable, so step 5's "record every pre-fix result" (`:400–401`) and DB-1's red-before evidence (`:150–153`) cannot be produced. *Must change:* land `classifyCredential` as a no-op delegation in Phase 1, or split the test file so Phase 1 exercises only the moved predicate.

**B3 [design] Commit 1 knowingly violates the standard it cites.** `plan.md:451–453` commits spec-only and expects `validate-spec` to fail until tags land in commit 2. `AGENTS.md` requires "add the tags **in the same commit as the REQ change**" and "`validate-spec` must pass before committing". The fallback ("or fold … if it blocks", `:452–453`) is an unresolved fork selected at commit time, and folding changes the commit count B1 already can't agree on. *Must change:* pre-decide — spec + tags + REQ body in one commit — and remove the either/or.

**B4 [design] The REQ-013 branch tag inventory contradicts the plan's own measurement.** P4 (`:93–99`) records today's tags as `latency-threshold`, `partial-results`, `exhausted`, `quota-warning` and states `detectClauseRequirements` counts **five** branches (2 + 3). DB-3 (`:163–166`) and C-4 (`:469–473`) then declare the five to be `missing-key`, `unreachable`, `latency-threshold`, `provider-degraded`, `quota-warning` — dropping the live `exhausted` tag without retiring it and re-declaring `quota-warning` as if new. Which tags G3 accepts is not derivable. *Must change:* quote the amended REQ-013 enumerations and map each extracted branch to exactly one tag name; state `exhausted`'s fate.

**B5 [clarity] F-R2-21 is claimed `Resolved` with no work item.** `plan.md:67` lists it in scope with disposition `Resolved`, but no P1–P10 premise (`:73–131`), no DB clause (`:137–214`), and no verification row (`:512–519`) mentions it. *Must change:* name the phase and the clause that resolves F-R2-21, or move it to § R2c-ii.

## Majors — 13

**M1 [clarity] "the only response delta" is false.** `plan.md:14` and `:496–497` versus DB-2 (`:154–156`, degraded rows leave the `active` list) and § User impact (`:491–493`). Approving on `:14` approves a narrower change than ships. *Must change:* say "the only new *field value*", and list the filter-membership delta.

**M2 [design] DB-8 contradicts DB-4 and the blast radius.** `:209–211` promises "no observable change to the health action's or the spec action's reported fields", while `:313–315` changes `doSpecHealth` and DB-4 (`:179–181`) flips `requires_account` for `core`, `exa`, `tavily`, `yep` — a reported posture if REQ-129 requires the tool to report it. One spawned assertion on `active_provider_count` cannot audit "fields" plural.

**M3 [design] The equivalence table cannot be the guard it is claimed to be.** `:144–148` calls it "the guard that the D2 delegation is behavior-preserving", but Phase 2 step 2 (`:407–408`) rewrites `providerUsable` as a wrapper over `classifyCredential` — the table compares new code against new code. It also exercises the credential axis only, while `providerUsable` also decides on `enabled` and URL (`:235–237`). *Must change:* compare against a frozen copy of the pre-fix predicate.

**M4 [design] Cooling-down evidence is promised and produced by no step.** DB-1's clause covers "all rejected, **or all cooling down**" (`:138–139`), verification claims "rejected **and cooling-down** pools" (`:512`), but the only evidence sentence names `markKeyRejected` (`:149–150`) and Phase 1 builds "a rejected pool" (`:391`). D3's mitigation (`:256–258`) is itself conditional on provider-level cooldown, which a key-level cooldown need not set.

**M5 [design] No step attaches the `REQ-024a` citation to the new module.** C-4 requires `REQ-024a` "on the module that implements the reason vocabulary" (`:472–473`); the blast radius for `src/provider-status.ts` (`:310–311`) and Phase 2 steps 1/3 (`:405–410`) describe exports only. `validate-spec` fails undocumented source files, so DB-7's path depends on a missing step.

**M6 [design] DB-4's freshness gate names a check that may not cover the file.** `:182–184` requires "`npm run validate-spec`'s freshness check green" for `provider-privacy.md`, and `:322–323`/`:417` invoke `npm run generate-privacy`. `AGENTS.md` documents only `generate-auth` and names `scripts/lib/provider-privacy.ts` as the generator surface; the script name and the gate's coverage of this reference are uncorroborated.

**M7 [clarity] Three decisions required, two IDs allocated, one written.** DB-6 (`:201–203`) requires the narrowing, the optional-key rule, **and** the cooldown boundary; Phase 0 step 8 allocates "D-100 and D-101" (`:379–381`); Phase 3 step 5 writes only the first two (`:431–432`).

**M8 [design] The R2c split leaves a dangling reference and silently drops a close condition.** DB-6's acceptance is scoped to the trigger ("it reads … — a condition, so it cannot dangle", `:190–194`), but two other reviewers independently cite `ROADMAP.md:19` still naming "§ R2c's F-R2-9" in the same section's bullet, and `ROADMAP.md:21`'s "close when F-R2-7 is `Resolved`" disappearing from the quoted replacement. `check-roadmap` enforces shape, not references.

**M9 [design] Global key-pool state has no owner in the new unit test.** DB-1 drives `classifyCredential` through `markKeyRejected` over a real pool (`:149–150`); C-7's isolation contract covers `INFOBROKER_QUOTA_STATE` only (`:483–485`). Nothing resets or redirects key-pool state between cases.

**M10 [design] `dispatch` is out of scope while its predicate changes underneath it.** `:344` puts dispatch out of scope; D2 makes `providerUsable` a wrapper (`:235–238`), and dispatch consumes it. DB-8's audit is a diff-vs-blast-radius check, not a behavioural check on chain selection.

**M11 [clarity] Phase 1's "verbatim / inert" premise contradicts D2.** `:386–388` moves `providerInactiveReason` "and the assessment" **verbatim**; D2 specifies a new pure `assessProvider(input)` (`:238–244`), and the assessment in `src/index.ts` closes over module state. Whether `providerInactiveReason` and `assessProviderStatus` are renamed, wrapped, or deleted is never stated; the inertness proof is against a shape Phase 2 discards.

**M12 [clarity] `credentials_unavailable` can label a provider the plan documents as account-free.** DB-1's trigger is `auth_env` declared + ≥1 key + none usable (`:137–139`) with no required/optional distinction, while DB-4 requires `semantic_scholar`, `stack_exchange`, `github` to report `requires_account: false` (`:179–181`) because they "work anonymously" (`:269–273`). With a present-but-rejected optional key the two assertions describe the same provider differently, and no clause says which wins.

**M13 [clarity] The artifact's stated reason for `C-indep` no longer holds in this environment.** `plan.md:4–7` and `:476–480` justify shipping without a cold pass on "`subagent` depth limit 1". This pass ran five fresh contexts from a subagent context: depth ≥ 2 is available. The `NOT_RUN` premise is unsupported as of this review, so `C-indep` cannot rest on it.

## Nits — 10

- **N1 [clarity]** Phase 2 steps 1 and 3 are the same instruction twice (`:405–406`, `:409–410`); the removal of `src/index.ts`'s old predicate is never a step, though it is in the blast radius (`:312–315`).
- **N2 [clarity]** Garbled sentence: "no observable change to … reported fields **change**" (`:209–211`).
- **N3 [clarity]** "three call sites" (`:11–13`) versus four `src/index.ts` touchpoints in the blast radius (`:312–315`).
- **N4 [clarity]** Title says `R2c-i` (`:1`), DB-6 deletes § R2c and creates only § R2c-ii (`:190`), and the directory slug carries neither (`:15–16`) — three labels for one increment.
- **N5 [clarity]** "REQ-024a names the pool case as a **fifth** distinguishing cause" (`:261–262`) doesn't parse against the three-item enumeration the plan itself quotes (`:287–289`).
- **N6 [clarity]** `classifyCredential`'s five classes are named but never defined, and no class→reason map is given (`:233–234` vs `:137–146`).
- **N7 [clarity]** Deferred-row bookkeeping names rows 169 and 170 only (`:195–197`); F-R2-23's row disposition is unstated.
- **N8 [clarity]** `CHANGELOG.md` gains an entry "under `## 2026.11.7`" (`:201`, `:433`) while the baseline version is already 2026.11.7 (`:41`); no step decides bump vs unreleased heading (`version-sync` gates on it).
- **N9 [clarity]** Commit 2 folds `CHANGELOG.md` into the source bucket (`:454–456`), diverging from the AGENTS.md docs bucket without saying so.
- **N10 [clarity]** DB-2's seed note omits a field its own premise requires: D8 seeds "80 % of the daily cap" (`:297–299`) while P10 states `sanitizeQuotaState` needs **both** `daily` and `monthly` with a parseable `resetAt` (`:127–129`); a daily-only seed is discarded and yields a green-before with the wrong reason.

Also carried as low-severity observations: `:8–10` carries no sha256 of the reviewed artifact though `docs/plans/README.md:10` asks for it; `:426–427` runs the `tool-metrics` suite while tool counters are out of scope (`:342–346`); `selectActiveRows`' signature is never given (`:244`, `:276`); the "5 majors, all corrected" claim (`:5`, `:28`) is self-reported with no finding list; the split rationale "share one assessment path" (`:55–57`) does not describe F-R2-12 or F-R2-19.

## Unknowns (carried, never dropped)

1. `ROADMAP.md:19`/`:21` exact text — cited identically by two independent lenses but not read inside any budget.
2. Whether `npm run generate-privacy` exists, and whether `validate-spec` checks that reference's freshness (AGENTS.md documents `generate-auth` only).
3. REQ-013's amended enumerations — the source of the DB-3 tag names; never quoted in the artifact.
4. Whether `requires_account` is emitted in `inspect_providers` output (decides M1/M2's scope).
5. `worklist.md` rows 148/151/168–170 and F-R2-23's row.
6. Whether quota state is keyed per provider slug (DB-2's seeding premise) and whether `makeIsolatedConfig`'s `env` reaches a spawned child.
7. `DECISIONS.md` highest ID = D-099 and whether an existing decision already covers the optional-key question.
8. Whether the `status` enum is exactly `["active","all"]` and whether `cooldown_remaining_ms` exists as a row field.
9. `CHANGELOG.md` heading state for an unpushed increment.

**Isolation note:** every reviewer was a fresh context receiving only the artifact path + hash, the target list, and the two cited standards; the assumptions were given as hypotheses to *falsify*, not conclusions to confirm. Host-level project instructions were visible to the reviewers (AGENTS.md is also an injected instruction file); this weakens, but does not invalidate, the cold pass.

```
independent-review FAILED. plan.md — 5 blockers

1. [clarity] Rollback says two commits; Phase 4 defines three — plan.md:11, :447, :501
2. [design]  Phase 1 tests import symbols Phase 2 creates — plan.md:389-393 vs :405-410
3. [design]  Commit 1 knowingly red on validate-spec, against AGENTS.md same-commit rule — plan.md:450-453
4. [design]  REQ-013 tag set contradicts the plan's own branch count (exhausted dropped) — plan.md:93-99 vs :163-166, :469-473
5. [clarity] F-R2-21 claimed Resolved with no step, premise, or evidence — plan.md:67

Blockers 5 (clarity 3, design 2) · Majors 13 (clarity 7, design 6) · Nits 10
Stages 4/5 (Stage 4 not triggered: no edits) · reads 40/40 reviewer + 1 parent synthesis
Comprehension: faithful-with-gaps
```
