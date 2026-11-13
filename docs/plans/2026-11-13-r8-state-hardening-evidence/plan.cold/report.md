Reviewer: review subagent (DeepSeek V4.1 Flash 1017 via opencode-go)
Plan sha256: 74c81fb75f22f731b66b51c9c5b89ba021978352bdd41b2542eef28263a0e864

# Cold review — R8 state-hardening evidence

**Verdict: NO-GO** — 1 Blocker, 2 Majors, 6 Minors
**Stages: 4/5** (1, 2, 3, 5 run; 4 not triggered — no author edits)
**Comprehension: faithful-with-gaps**
**Reads: 33/40**

## Blocker

1. **[Blocker] [design] The done bar requires mutation evidence that no step
   produces, for a file outside the declared target set.** plan.md:301-305
   requires the quota read guard to fail "when its guard is removed", with a
   transcript. T4 (plan.md:350-351) only adds and runs the test; T5
   (plan.md:352-357) mutates src/key-pool.ts only; T8 covers src/kb.ts. The
   guard lives at src/quota.ts:41-46, which is absent from the Blast radius
   (plan.md:155-166) and the sidecar target table. Fix: add a T4b that mutates
   quota.ts:41-46, restores byte-identically, and records the transcript; or
   narrow done bar (1) to the two guards actually mutated.

## Majors

2. **[Major] [clarity] Commit 1 cannot be authored last and land first.**
   plan.md:373-376 makes `docs(spec)` "commit 1" *after* commits 2 and 3 exist
   (T6 :359, T9 :369), while plan.md:425-438 lists it first. The reconciling
   mechanism is never named. Fix: move T10 before T2, or relabel the series to
   the order the steps produce.

3. **[Major] [design] "This increment asserts both halves" overstates the
   evidence.** plan.md:30 says both refusal directions are asserted; Alternative
   C (plan.md:115-123) defers the quota write refusal, and src/quota.ts is
   untouched. T12 will nonetheless mark F-R8-F-1 `Resolved`, and a reader of
   that row will infer that REQ-100's write refusal is asserted for both state
   stores. Fix: reword :30 to name the key-pool store, and state in the
   worklist evidence sentence that the quota write path is a named residual.

## Minors

4. **[Minor] [clarity]** plan.md:5, :478-479 claim reverting the `loadState`
   guard leaves "the two new read-refusal tests" red; only
   src/key-pool.test.ts test 2 is affected — the quota test targets
   src/quota.ts's own guard.

5. **[Minor] [clarity]** Line-citation drift: plan.md:445 cites
   `src/key-pool.ts:32-33` for `state = null` (actual 38-39); plan.md:34-35,
   :79, :448 cite `resolveKeyFile`/`mkdirSync` at `:1224-1235`/`:1229`
   (actual src/kb.ts:1226-1235, :1228); plan.md:79 cites `generateKeyFile`
   through `:1346` (ends :1344).

6. **[Minor] [clarity]** plan.md:267-268 describes the quota seed as
   `daily.count = 7` only; src/quota.ts:78 drops a provider lacking a valid
   `monthly`, so a literal fixture makes the post-restore assertion
   (`.daily.used === 7`) return 0. Say "the shape at quota.test.ts:61-74
   (daily and monthly)".

7. **[Minor] [clarity]** The REQ-099 test (plan.md:280-291) omits `mkdtempSync`
   and `rmSync` in `finally`, which every neighbouring test in
   src/kb-encryption-tools.test.ts performs (e.g. :171-185).

8. **[Minor] [design]** T18 (plan.md:413-414) commits tasks.md/aar.md edits
   made after the T17 full `check`; the shipped tree is only covered by
   `check:fast` (T19), which excludes `audit`, `check-pack`, and
   `test-debate-cob`. Doc-only delta, but done bar (7)'s "green on the tree that
   carries the AAR's terminal token" is true only by ordering, not by
   coverage.

9. **[Minor] [design]** `assertOwnedDir` (plan.md:182-191) makes the uid
   compare and refusal message a third copy (src/key-pool.ts:60-65,
   src/quota.ts:41-46), with "reused verbatim" enforced only by prose.

Nits (not counted): `§Design` has no anchor (plan.md:348 vs :174/:275); `uid+1`
saturation (plan.md:231, :461); TOCTOU ENOENT reported as a read refusal
(plan.md:183-189); "three new state tests" vs "two ownership tests"
(plan.md:302 vs :158); undefined "Rollback cost: 1" scale (plan.md:5);
"Predecessor:" mixes three facts (plan.md:7).

## Verified, no finding

`detectClauseRequirements` returns 0/0 for REQ-099 and REQ-100
(src/clause-coverage.ts:19-23, :89-101) — no clause tag is required, so G3 does
not fail at T10/T14. `resetKeyPoolStateForTests` does not force a re-read
(src/key-pool.ts:94, :266-269), so the malformed-state test is indeed vacuous
today — the plan's central diagnosis is correct. `loadQuotaState` re-reads every
call (src/quota.ts:130-151), so the quota test's restore assertion is
reachable. `resolveApiKey` consumes the plural pool (src/key-pool.ts:168-173).
`resolveKeyFile` creates before confining (src/kb.ts:1228 vs :1230-1233) and
nothing in `initKb` creates `keys_dir` (only :1216 references it). All ten
targets exist. REQ bodies, §9.2 probes (:1083-1084), §E rows
(infobroker.md:1866/1869/1873), D-112, CHANGELOG:3, ROADMAP:17-22 and worklist
rows :482/:483/:878/:879 match the plan.

## Unknowns

- Whether `vi.spyOn(process, "getuid")` type-checks; the plan names the
  `Object.defineProperty` fallback, so this is bounded, not blocking.
- The "166 unpushed / 3.8 d" baseline was not re-derived (no mutating git
  commands permitted); HEAD fc6228c matches the sidecar.
- Stage isolation was not enforced: all stages ran in one child context and
  AGENTS.md was injected. Findings were re-verified against file:line, but
  cross-stage contamination cannot be ruled out.
- `report.md` was not written to disk by this reviewer (read-only mandate);
  its sha256 must be computed by the parent after persisting this text.

## Coverage

Stages 1, 2, 3, 5 completed; Stage 4 not required. 33/40 reads. Scope held to
the artifact, the two sibling files, the cited targets and the one support file
each factual claim needed (src/quota.ts, src/kb.ts, src/kb-crypto.ts,
src/clause-coverage.ts). No repository sweep.

independent-review NO-GO.
