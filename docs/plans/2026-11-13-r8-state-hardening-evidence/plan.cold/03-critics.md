# Stage 3 — critics

## Design lens

### [Blocker] [design] The done bar demands mutation evidence no step produces, from an undeclared target
plan.md:301-305 (done bar 1) requires each of the three new state tests to fail
"when its guard is removed (key-pool read guard, key-pool write uid compare,
**quota read guard**), with the before/after transcripts in `tasks.md`".
- T4 (plan.md:350-351) only adds the quota test and runs it green.
- T5 (plan.md:352-357) performs exactly two mutations, both in
  src/key-pool.ts (a: `loadState` guard; b: `ensureStateDir` uid compare).
- T8 (plan.md:365-366) covers `resolveKeyFile`'s `mkdirSync`.
No step removes src/quota.ts:41-46's uid compare, and src/quota.ts is **not**
in the declared target set (plan.md:155-166) or in the sidecar's target table.
As written the increment cannot satisfy its own completion criterion; the close
at T16/T18 will either fail the bar or be recorded falsely. Fix: add a T4b that
mutates quota.ts:41-46 (and declare src/quota.ts as a temporarily-mutated target,
restored byte-identically), or narrow done bar (1) to the two guards actually
mutation-tested.

### [Minor] [design] A third copy of the uid compare and its message string
plan.md:182-191 adds `assertOwnedDir`, duplicating src/key-pool.ts:60-65 and
src/quota.ts:41-46. Alternative G (plan.md:146-149) rejects consolidation on
scope grounds, which is defensible, but the refusal message now exists in three
places and the plan requires the read copy to be "reused verbatim" from the
write copy with nothing enforcing that.

### [Nit] [design] `uid + 1` assumes the uid space is not saturated
plan.md:231 and :461 stub `getuid` to "current uid plus one". On a host where
the test user is the maximum uid this wraps; the write test would then see an
owned directory and fail for the wrong reason. Guard with a modulo or pick 0/1
when the current uid is at the boundary.

### [Nit] [design] TOCTOU between `existsSync` and `statSync` is reported as an ownership refusal
plan.md:183-189's guard returns on a missing directory and otherwise stats it.
A directory removed between the two calls makes `statSync` throw ENOENT, which
the wrapper (plan.md:196-202) audits as `key_pool_state_read_refused`. The same
shape exists in the write guard, so this is inherited, not introduced — but the
read wrapper makes the message newly misleading.

## Structural lens

### [Major] [design] The phases cannot produce the stated commit series
See Stage 1 Major 1. T2→T10 yields history order (fix, test, spec, decisions,
plans, changelog, roadmap, plans), not the enumerated 1..8. The duplicated
`docs(plans)` subject at positions 5 and 8 (plan.md:432-438) also means the
series has two commits with the same type, which an implementer cannot
disambiguate from the plan.

### [Minor] [design] The committed tree is not the tree the full suite ran on
T17 (plan.md:411-412) runs `npm run check`; T18 (plan.md:413-414) then edits
tasks.md and aar.md and commits, and T19 runs only `check:fast`, which excludes
`audit`, `check-pack` and `test-debate-club` (AGENTS §Gates). The delta is
docs-only, so the risk is low, but done bar (7)'s "green on the tree that
carries the AAR's terminal token" is satisfied only because the token precedes
the edit, not because the shipped tree was gated. Cheapest fix: state that the
T18 delta is docs-only and that `check:fast` is the covering gate, or re-run
`check` after T18.

### [Nit] Commit 2 mixes a production fix with a test rework
plan.md:426-428 bundles the `loadState` guard with the malformed-test rewrite.
AGENTS' bucket is "source plus its tests", so this is within convention; noted
only because the fail-before transcript for the *rework* is not separately
captured.

## Style lens

### [Nit] "three new state tests" vs "two ownership tests"
plan.md:302 counts three; plan.md:158 counts two in the same file plus one in
quota.test.ts. Consistent if read carefully, but the two sentences use the same
noun for different sets.

### [Nit] "Rollback cost: 1" uses an undefined scale
plan.md:5 gives a numeric cost with no rubric anywhere in the document.

### [Nit] "Predecessor:" mixes version, tag and commit count
plan.md:7 lists version, tag, unpushed count and age under one label.

## Verified as claimed (no finding)

- REQ-099/REQ-100 bodies: infobroker.md:676-677 / :679-680.
- `detectClauseRequirements` yields 0 or-branches and 0 conditionals for both
  bodies (src/clause-coverage.ts:19-23, :89-101: parenthesised-only OR enum, a
  narrow `WHEN … a/an … or` class-list detector, and `when … declares` — neither
  REQ matches). A bare `@implements REQ-100` is sufficient; no G3 clause-tag
  failure at T10/T14.
- `resetKeyPoolStateForTests` seeds a non-null state and clears the cached path
  (src/key-pool.ts:266-269), and `loadState` returns early on non-null state
  (:94) — so the existing malformed test (src/key-pool.test.ts:108-116) never
  reads the file. The plan's diagnosis and the fresh-module remedy are correct.
- `loadQuotaState` re-reads on every call (no loaded-once cache,
  src/quota.ts:130-151), so the quota test's post-restore `used === 7` is
  reachable after the refused load resets state to empty (:133-137).
- `resolveApiKey` consults the plural pool first (src/key-pool.ts:168-173), so
  the read test's `_API_KEYS = "k1,k2"` seeding is valid.
- `resolveKeyFile` creates the directory before the containment check
  (src/kb.ts:1228 vs :1230-1233); nothing in `initKb` touches `keys_dir`
  (only src/kb.ts:1216 references it), so `existsSync(keysDir) === false`
  holds before the call.
- src/kb-crypto.ts:193-195 only decodes — the stale worklist anchor is stale.
- §E rows at infobroker.md:1866/1869/1873, D-112 highest (DECISIONS.md:5),
  CHANGELOG top section (:3), ROADMAP §R8 at :17-22, worklist :482/:483/:878/:879.
