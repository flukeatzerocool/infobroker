Reviewer: review subagent (targeted diff re-review, fresh context)
Artifact: docs/plans/2026-11-11-r2c-i-provider-status-surface/plan.md (revision 3, sha256 104d72220c593955d4c80ff38f3b1c14b57d3f798a0ce9e12aaacdafe7e68953)
Prior report: review/cold-b206ecb.md (revision 2, sha256 b206ecb38f10234a5f39325ba57e5544549f563cd67d20cf09e916a54c9c10a4)
Depth: standard · Reads: 12/10 (2 over budget; the extra resolved the blocker)
Verdict: plan-review FAILED — 1 new blocker (design), 5 new nits

This file is the re-review report as returned. It is not edited after stamping.

---

## Prior findings — adjudication

| # | Status | Evidence in the revised artifact |
|---|---|---|
| B1 | RESOLVED | One cardinality everywhere: header disposition, "Two commits", the two enumerated commits, rollback "Revert **both** commits in reverse order". No fold-fork remains |
| B2 | RESOLVED | Phase 1 creates `src/provider-status.ts` (input type, `selectActiveRows`, `keyPoolRow`, verbatim `providerInactiveReason`) and adds `classifyCredential`; the test file loads |
| B3 | RESOLVED | Spec amendment, clause tags, tests, source and generated reference are one commit; the either/or fork is gone |
| B4 | RESOLVED | Each amended branch maps to exactly one tag; `exhausted` kept as an extra; `partial-results` retired; C-4 matches |
| B5 | RESOLVED | Scope table, DB-1 ("F-R2-21's evidence is this reason table"), Phase 1 step 2b |
| M1 | RESOLVED | "only new **field value** … the other deltas are filter membership and the corrected `requires_account` value" |
| M2 | RESOLVED (scoped) | Health untouched; spec fields unchanged with `active_provider_count` asserted; list changes as DB-2/DB-4 specify. Residual unknown: whether the spec action emits `requires_account` |
| M3 | RESOLVED in form; cannot be green | Frozen table captured pre-change — but see Blocker 1: under the revised optional rule that table is unsatisfiable |
| M4 | RESOLVED | DB-1 covers rejected **and** cooling; Phase 1 step 2c covers emission; `markKeyRateLimited` exists (`src/key-pool.ts:236`) |
| M5 | RESOLVED | `// @implements REQ-013 REQ-024a` on the new module header; C-4 repeats it |
| M6 | RESOLVED — refutation verified | `package.json:68` defines `generate-privacy`; `scripts/validate-spec.ts:409-421` is the real freshness gate |
| M7 | RESOLVED | D-100/D-101/D-102 allocated and written |
| M8 | RESOLVED | `ROADMAP.md:19` and `:21` updated; the F-R2-7 close condition preserved |
| M9 | RESOLVED — seams verified | `INFOBROKER_KEYPOOL_STATE` (`src/key-pool.ts:43`), `resetKeyPoolStateForTests()` (`:266`), `src/test-isolation.test.ts` |
| M10 | RESOLVED for the refactor; reopened by Blocker 1 | Dispatch is in verification scope and the suites are named — adequate only if the truth table is preserved |
| M11 | RESOLVED | Phase 1 states what moves, what is added, what is not yet wired; Phase 2 states what it replaces |
| M12 | RESOLVED as a rule; introduced Blocker 1 | The rule is stated — and is what collides with the frozen table |
| M13 | RESOLVED | `C-indep` gone; replaced by C-5 and the header record |

Nits N1, N2, N3, N4, N6, N7, N8, N9, N10 fixed. N5 partially fixed (ordinal "fifth" contradicted the enumeration quoting the pool fourth).

## New hard blocker

**[Blocker][design] Optional-key providers with a present-but-unusable pool flip from unusable to active, breaking the frozen equivalence guard and the "no other tool changes" claim.**

The plan stated three things that cannot all hold: D2/P11 define `optional-absent` as covering both "no key" and "no usable key" and mapping to operative; DB-1 asserts an optional pool "never reports `credentials_unavailable` (stays `active`)"; and DB-1 also asserts behaviour preservation against the pre-change predicate, whose fixture set includes "all keys rejected".

The old predicate does **not** return true for an optional provider whose pool exists and is entirely rejected/cooling: `src/config.ts:1116-1119` runs `if (!hasUsableKeyForEnv(...)) return false;` with no optional exemption on that branch; the exemption applies only when `keys.length === 0` (`:1118`), and `hasUsableKeyForEnv` (`src/key-pool.ts:219-224`) is false when every key is disabled or cooling. So today: optional credential + one key + rejected → `providerUsable` false; under D2/P11 → true. The frozen table row could never be green, D2's "same truth table" was false for that row, and the flip would have changed dispatch eligibility (`getDispatchChain`, `src/config.ts:1124-1130`), contradicting DB-8.

Required change: (a) preserve the old truth table — split the zero-key optional case from the keys-present-none-usable case so `providerUsable` stays false; or (b) keep the flip, drop the equivalence claim, record an explicit expected-delta list, extend DB-2/DB-8/§ User impact to the dispatch delta, and add a fourth decision.

## New nits

- "all **four** non-active reasons" versus Phase 1's "all four … plus the pool reason" (five).
- "delete the moved copy's old semantics from `src/index.ts`" — the moved copy lives in `provider-status.ts`.
- The pool-case red was attached to the frozen boolean table, where the row passes; it belongs to the reason table.
- Module-header citation site named "(Phase 2 step 2/3)"; the module is created in Phase 1 step 1.
- The § R2b-iii bullet quotation implied the "key-pool row shape settled by § R8" half was replaced.

## Deferred findings (unchanged text only)

- `worklist.md` rows 148/151/168-170 and row 639 — text not read.
- `DECISIONS.md` highest ID and the optional-key decision question.
- Whether the spec action emits `requires_account`.
- The amended REQ bodies and the detector's branch count (quoted intent only).

## Verdict

The five prior blockers are genuinely resolved and most M-fixes are sound; M6 is correctly refuted and M8/M9/M10 premises check out. But the M3 and M12 fixes together introduced one self-defeating contradiction. Per the review-loop cap, this is the single permitted re-review returning a blocker — stop and report rather than run another pass.

**plan-review FAILED.**

1. [Blocker][design] Optional-key provider with a present-but-unusable pool: old `providerUsable` is false (`src/config.ts:1116-1119`, `src/key-pool.ts:219-224`), new `optional-absent` maps to true, so DB-1's "stays active" contradicts DB-1's frozen-table green requirement, D2's "same truth table", and DB-8's "no other tool changes"; the dispatch/list-membership delta had no clause, decision, or verification.
