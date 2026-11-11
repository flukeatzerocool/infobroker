# Tasks — R2c-i provider status surface

**Status:** executed 2026-11-11 (plan revision 4)
**Plan:** `plan.md` in this directory
**Findings:** F-R2-9, F-R2-12, F-R2-19, F-R2-20, F-R2-21 → `Resolved`

## Phase 0 — Discovery (no edits)

- [x] 0.1 Baseline confirmed: `git log -1` = `8954ccb`, clean tree, `npm run
      status` (24 roadmap items, 67 unpushed), `npm run check` PASS (22 gates,
      120.0 s). Pre-change targeted suites: 124 passed.
- [x] 0.2 P1-P11 re-confirmed. The frozen `providerUsable` table (§ below)
      confirms P11 exactly: the optional-key providers are `true` with no key
      and `false` when all keys are rejected.
- [x] 0.3 Sibling-REQ sweep: no other REQ binds the list row or the
      `inactive_reason` vocabulary; no fixture under `test-fixtures/` mentions
      `inspect_providers` or `inactive_reason`.
- [x] 0.4 Surface pins recorded: `src/tool-surface.test.ts:110` pins the
      `health`-required description; `check-intent-citations` 141 citations;
      `debate-club/src/mcp-contract.test.ts:389-420` asserts unfiltered length =
      `provider_count`, `native_fetch` marked, and
      `active_provider_count ≤ enabled_provider_count`.
- [x] 0.5 Quota-seed path: `stack_exchange` is enabled and ships
      `rate_limit.per_day: 300`; seed `daily.count = 240` (the 80 % boundary)
      with `monthly.count = 0`, both with a future `resetAt`.
- [x] 0.6 REQ bodies measured before the amend: REQ-013 381, REQ-024a 495,
      REQ-129 640 characters.
- [x] 0.7 README passages chosen: the privacy-reference paragraph (`:660-666`).
      The inspect-providers passage (`:286-292`) needs no change.
- [x] 0.8 `DECISIONS.md` highest ID confirmed D-099 → D-100/D-101/D-102
      allocated; no existing decision covered the optional-key question.
- [x] 0.9 `git check-ignore` exits 1 — the increment directory is trackable.

### Frozen `providerUsable` truth table (pre-change, `8954ccb`)

Captured with `/tmp/opencode/r2c-frozen-table.ts`: shipped `enabled` state,
`[F0 no-keys, F1 one-usable-key, F2 all-keys-rejected]`, plus a disabled
variant. Every provider also returns `false` when disabled. Highlights:

| provider | auth_env | optional | F0 | F1 | F2 |
|---|---|---|---|---|---|
| core | INFOBROKER_CORE_API_KEY | no | **false** | true | false |
| semantic_scholar | INFOBROKER_SEMANTIC_SCHOLAR_API_KEY | yes | true | true | **false** |
| stack_exchange | INFOBROKER_STACK_EXCHANGE_API_KEY | yes | true | true | **false** |
| github | INFOBROKER_GITHUB_API_KEY | yes | true | true | **false** |
| exa / tavily / yep / searxng | declared | — | false | false | false |
| all keyless providers | — | — | true | true | true |

The optional-key row (F2 = `false`) is the case the re-review caught: the
optional exemption applies only to the zero-key case. This table is embedded
verbatim as `FROZEN` in `src/provider-status.test.ts`.

## Phase 1 — Additive skeleton, then failing evidence

- [x] 1.1 `src/provider-status.ts` created (`assessProvider`,
      `selectActiveRows`, `keyPoolRow`, interim reason mapping);
      `providerInactiveReason`/`assessProviderStatus` removed from
      `src/index.ts`, which now calls the shared assessment. Suite green
      (141 tests), proving the move is inert.
- [x] 1.2 `src/config.ts`: `classifyCredential` added (tested, not yet wired).
- [x] 1.3 `provider-status.test.ts`: frozen equivalence table + DB-1 reason
      table.
- [x] 1.4 `provider-status.test.ts`: F-R2-21 rows (five non-active reasons).
- [x] 1.5 `provider-status.test.ts`: `selectActiveRows`, `keyPoolRow`.
- [x] 1.6 `provider-status.test.ts`: five branch tags + retained `exhausted`;
      optional-credential cases.
- [x] 1.7 `provider-list.test.ts`: seeded quota warning, spawned filtered and
      unfiltered lists, spec-count assertion.
- [x] 1.8 `privacy.test.ts`: DB-4 cases.
- [x] 1.9 Pre-fix observations recorded below.

### Pre-fix observations

| Case | Observed before the fix |
|---|---|
| 1.3 pool reason (`credential: "unusable"`) | **FAIL** — returned `no_api_key` (1 failed / 25 passed in `provider-status.test.ts`) |
| 1.3 frozen table (all providers × F0/F1/F2) | PASS — regression evidence; the table is the delegation guard, green by construction |
| 1.3 `selectActiveRows`, `keyPoolRow` | PASS — new pure predicates, nothing to be red |
| 1.4 five non-active reasons | 4 PASS / pool case FAIL (same case as 1.3) |
| 1.5 quota-seeded filter | **FAIL** when the old filter predicate was temporarily restored: the degraded `stack_exchange` row appeared under `status: "active"` (1 failed / 1 passed). Restored immediately; green |
| 1.5 spec-count assertion | PASS — `active_provider_count` already counts assessed-active; kept as the DB-8 regression |
| 1.8 `core.requires_account` | **FAIL** — `false` (2 failed / 4 passed in `privacy.test.ts`) |

## Phase 2 — Fix

- [x] 2.1 `src/config.ts`: `providerUsable` delegates to `classifyCredential`.
- [x] 2.2 `src/provider-status.ts`: `assessProvider` implemented; reason
      mapping adds `credentials_unavailable` for `unusable`.
- [x] 2.3 `src/index.ts`: assessment input, list rows then `selectActiveRows`,
      `key_pool` via `keyPoolRow`, module citation.
- [x] 2.4 `src/privacy.ts`: D4 derivation (`credential` first, tier fallback).
- [x] 2.5 `src/health-status.ts`: comment corrections.
- [x] 2.6 `infobroker.md`: REQ-013, REQ-024a, REQ-129, glossary, §7 unchanged
      (already accurate).
- [x] 2.7 `npm run generate-privacy`; regenerated reference staged.
- [x] 2.8 Suites green: `provider-status` + `privacy` + `provider-list` +
      `config` + `key-pool` → 148 passed; frozen table green.

### Amendment measurements

| REQ | Before | After | Limit |
|---|---|---|---|
| REQ-013 | 381 | 405 | 800 |
| REQ-024a | 495 | 527 | 800 |
| REQ-129 | 640 | 651 | 800 |

## Phase 3 — Verification and documentation

- [x] 3.1 Diff audited against the blast radius. One recorded deviation:
      `scripts/lib/provider-privacy.ts` (the generated reference's summary
      sentence named only "tier and resale flag"; it now names the declared
      credential). See the AAR.
- [x] 3.2 Targeted suites green (see 2.8).
- [x] 3.3 `typecheck`, `validate-spec` (post-commit), `check-gate-coverage` (117
      cited / 1 exempt), `check-intent-citations` (0 findings) all exit 0.
- [x] 3.4 `README.md` privacy paragraph updated; `validate-readme` 0/0.
- [x] 3.5 `DECISIONS.md`: D-100, D-101, D-102.
- [x] 3.6 `CHANGELOG.md`: entry under the current `## 2026.11.7` section.
- [x] 3.7 `ROADMAP.md`: § R2c → § R2c-ii; § R2b-iii bullet and trigger updated,
      close condition preserved; `check-roadmap` OK, `check-non-goals` OK.
- [x] 3.8 `worklist.md`: five findings `Resolved 2026-11-11`; prose rows
      148/151/168 corrected; 169/170/639 untouched.
- [x] 3.9 `AGENTS.md`: clause-tag example renamed.
- [x] 3.10 `aar.md`: evidence table, dispositions, LOOP token.
- [x] 3.11 Final `npm run check` and `check-loop-artifacts` green.

## Phase 4 — Commit series

- [x] 4.1 `fca73ea` — spec, source, tests, generated reference, generator
      prose. Gate: `typecheck`, targeted suites; `validate-spec` verified
      post-commit (its generated-artifact check compares against HEAD).
- [x] 4.2 Documentation and record (`README`, `DECISIONS`, `CHANGELOG`,
      `ROADMAP`, `AGENTS`, `worklist`, this directory).

## Review history

- [x] 5.1 Cold pass on revision 2: FAILED (5 blockers, 13 majors, 10 nits);
      report `review/cold-b206ecb.md`.
- [x] 5.2 Targeted diff re-review of revision 3: FAILED (1 new blocker R1 —
      the optional-key class flip; 5 nits). Report:
      `review/rereview-104d722.md`.
- [x] 5.3 Revision 4 corrections applied; review cap reached; the user accepted
      rev 4 as the recorded risk acceptance (stamp).
- [x] 5.4 The gate refused to bind the revision-2 cold report to the revision-4
      plan at `mark-build`, so the plan was re-stamped `self` at standard depth
      with the gate's fixed risk-acceptance condition. Recorded in the AAR.
