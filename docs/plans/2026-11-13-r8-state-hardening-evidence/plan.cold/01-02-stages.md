# Stages 1–2

## Stage 1 — zoom out

### [Major] [clarity] Commit 1 cannot be both authored last and first in history
plan.md:373-376 (T10) says commit 1 (`docs(spec)`) "is made here, after the
tests exist (the spec bucket lands first in history but is authored last)".
T10 executes after T6 (commit 2, plan.md:359) and T9 (commit 3, plan.md:369),
so committing at T10 places the spec change **third** in history, not first.
plan.md:425-438 enumerates it as commit 1. The mechanism that reconciles the
two (rebase, or authoring the spec text before T2 and committing later) is
never stated. Fix: either move T10 before T2 or relabel the series to the
order actually produced.

### [Major] [clarity] "This increment asserts both halves" is not true of quota
plan.md:30 claims "This increment asserts both halves" of REQ-100's refusal.
Alternative C (plan.md:115-123) explicitly defers the quota **write** refusal,
and the Blast radius (plan.md:155-166) does not touch src/quota.ts. Only the
key-pool store gets both directions; quota gets read only. The sentence
overstates the evidence that T12 will mark `Resolved` in worklist.md:483/878.

### [Minor] [clarity] Rollback claim names two read-refusal tests, one is unaffected
plan.md:5 and :478-479 say reverting the `loadState` guard "would leave the two
new read-refusal tests red". Reverting the key-pool guard affects only
src/key-pool.test.ts test 2; the quota read test (plan.md:262-273) exercises
src/quota.ts's own `ensureDir` and stays green.

### [Minor] [clarity] Line citations drift from the code they name
- plan.md:445 cites `src/key-pool.ts:32-33` for `state = null`; the declaration
  is at src/key-pool.ts:38-39.
- plan.md:34-35, :79 cite `resolveKeyFile` at `:1224-1235` with `mkdirSync` at
  `:1229`; the function is src/kb.ts:1226-1235 and `mkdirSync` is :1228.
  plan.md:448 cites `:1228-1230`.
- plan.md:79 cites `generateKeyFile` `:1329-1346`; it ends at :1344.
  None changes a decision; all are cheap to correct.

### [Minor] [clarity] Quota seed prose omits the `monthly` counter the sanitizer requires
plan.md:267-268 specifies "a valid state file ... with `daily.count = 7` and a
future `resetAt`". src/quota.ts:78 admits a provider only when **both** daily
and monthly sanitize (`if (daily && monthly)`). A literal implementer writes a
daily-only fixture and the post-restore assertion (`.daily.used === 7`) returns
0. The pointer to quota.test.ts:61-74 rescues it only if followed exactly.

### [Minor] [clarity] The new REQ-099 test has no fixture/cleanup step
plan.md:280-291 starts at `makeConfig(dir, ...)` and never says to create `dir`
with `mkdtempSync` or remove it in `finally`. Every neighbouring test in
src/kb-encryption-tools.test.ts (e.g. :171-185) does both.

### [Nit] [clarity] `§Design` is referenced, never anchored
T3 and T9 point at "§Design" (plan.md:348, :369); the sections are titled
"Design — REQ-100 …" (plan.md:174) and "Design — REQ-099 …" (plan.md:275) with
no `§Design` heading.

## Stage 2 — comprehension (paraphrase, 181 words)

The increment converts two untested REQ clauses into asserted behaviour.
REQ-100 requires refusing to read or write state in a directory the process
does not own; the write guard exists in key-pool and quota, but only key-pool's
read path lacks one. REQ-099 requires creating the keys directory 0700 when
absent; `resolveKeyFile` does that, but the existing test always pre-creates the
directory. The work is: add an ownership check to key-pool's `loadState`; add
tests for key-pool write refusal, key-pool read refusal, quota read refusal, and
keys-directory creation; switch the malformed-state test to a fresh module so it
really reads; then update the spec's §9.2 probe list, DECISIONS (D-113), the
worklist rows, CHANGELOG, and remove the roadmap section. Done means the three
new state tests pass and each fails when its guard is removed, the creation test
fails when `mkdirSync` is removed, typecheck and five named gates are green, the
worklist rows read `Resolved` with the stale `kb-crypto` anchor corrected, and
the AAR ends `LOOP PAUSED`. Eight commits, one per concern.

**Comprehension: faithful-with-gaps.** The mechanism, blast radius and done-bar
are unambiguous. The one thing a reader must guess is how commit 1 lands first
in history while being authored last (Stage 1, first Major).
