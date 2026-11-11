# AAR — R2c-i provider status surface

**Status:** executed 2026-11-11 (plan revision 4) — complete
**Plan:** `plan.md` (revision 4, stamped)
**Findings:** F-R2-9, F-R2-12, F-R2-19, F-R2-20, F-R2-21 → `Resolved`

## What happened

The first startable roadmap item (§ R2c provider status and inspection) was
narrowed to its list-row findings and executed. `inspect_providers` now derives
every list row from one pure assessment (`src/provider-status.ts`); the
credential classification behind `providerUsable` became one function
(`classifyCredential`) that dispatch and the list share; the privacy posture
derives the account requirement from the declared credential; and REQ-013's
dead "partial results" degraded leg was replaced by the provider-reported leg.

Baseline `8954ccb`, `npm run check` PASS (22 gates). One production commit
(`fca73ea`) plus this documentation commit.

## Evidence — done bar

| Clause | Evidence |
|---|---|
| DB-1 | `src/provider-status.test.ts` — five-reason table, required/optional cases, rejected and cooling pools, precedence; `classifyCredential` table; the frozen pre-change `providerUsable` table embedded verbatim (green from the start, the delegation guard). Pool case red before the fix (`no_api_key`) |
| DB-2 | `src/provider-list.test.ts` — spawned server, `stack_exchange` daily counter seeded at 240/300, unfiltered row `degraded`, filtered list omits it, filtered rows all `active`. Red under the temporarily restored old filter (observed, then restored) |
| DB-3 | Five branch tags in `src/provider-status.test.ts` (`missing-key`, `unreachable`, `provider-degraded`, `latency-threshold`, `quota-warning`) plus the retained `exhausted` tag; `health-status.test.ts` tag and case title renamed; `health-status.ts` comments corrected |
| DB-4 | `src/privacy.test.ts` — derivation table, optional-vs-required, overrides, and the shipped-provider table; CORE red before (`false`). Regenerated `provider-privacy.md`; `validate-spec` freshness green post-commit |
| DB-5 | `infobroker.md` — REQ-013 381→405, REQ-024a 495→527, REQ-129 640→651 characters, all inside Appendix B; glossary row and §7 unchanged (already accurate); `validate-spec` passes |
| DB-6 | `ROADMAP.md` § R2c → § R2c-ii, § R2b-iii bullet and trigger updated with the close condition preserved; worklist five rows resolved and rows 148/151/168 rewritten; `DECISIONS.md` D-100/D-101/D-102; `CHANGELOG.md` entry; `AGENTS.md` tag example; `README.md` privacy paragraph; `check-roadmap`, `check-non-goals`, `validate-readme`, `check-loop-artifacts` pass |
| DB-7 | `typecheck`, `validate-spec`, `check-gate-coverage` (117 cited / 1 exempt / 0 waived), `check-intent-citations` (0 findings), `npm run check` |
| DB-8 | Diff audit: every changed file is in the plan's blast radius except the recorded deviation below; the spec action's `active_provider_count` asserted equal to the assessed-active count through the spawned test |

## Deviations

1. **`scripts/lib/provider-privacy.ts` edited (outside the plan's blast
   radius).** The generated reference's summary sentence claimed the posture
   derives from "each provider's tier and resale flag"; after D-101 it also
   derives the account requirement from the declared credential. The sentence
   is generated from that script, so leaving it would have shipped an artifact
   whose own summary was false. One sentence, no behavior. Recorded here rather
   than as a plan amendment because no done-bar clause changed.
2. **`validate-spec` runs post-commit.** Its generated-artifact check compares
   the regenerated reference against `HEAD`, so it cannot pass on a tree that
   has not committed the regenerated file. It passed on `fca73ea`.
3. **Re-stamped `self` at standard depth with the gate's risk-acceptance
   condition.** `mark-build` refused to bind the revision-2 cold report to the
   revision-4 plan ("not bound to this plan"), which is correct — the report's
   `Plan sha256` names revision 2. Rather than fabricate a binding, the plan was
   re-stamped as `self` with the user's recorded acceptance. The cold pass and
   re-review artifacts remain in `review/` as evidence.

## Review history

| Event | Outcome |
|---|---|
| Cold pass (revision 2, 4/5 stages) | FAILED — 5 blockers, 13 majors, 10 nits; `review/cold-b206ecb.md` |
| Targeted re-review (revision 3) | FAILED — 1 new blocker (the optional-key class flip), 5 nits; `review/rereview-104d722.md` |
| Revision 4 | Corrected every blocker and nit; `optional-absent` now means zero keys configured, so the frozen truth table holds |
| Review cap | Spent; revision 4 accepted by the user as recorded risk acceptance |

## Findings and dispositions

| Finding | Disposition |
|---|---|
| F-R2-9 | Resolved — pool reason + single-key `key_pool` visibility |
| F-R2-12 | Resolved — `requires_account` from the declared credential |
| F-R2-19 | Resolved — five branch tags and tests; probe wiring remains § R2c-ii as planned |
| F-R2-20 | Resolved — filter on the reported status |
| F-R2-21 | Resolved — five non-active reasons asserted |
| Cold/re-review findings | All resolved in revision 4 except the one refuted with evidence (`generate-privacy` exists; freshness gate at `scripts/validate-spec.ts:409-421`) |
| Review-artifact binding | Handled by a truthful re-stamp (`self` + the gate's acceptance condition); recorded in Deviations |
| Deferred | F-R2-22, F-R2-23, F-R2-24 → § R2c-ii; F-R2-7 → § R2b-iii |

## What went right

- The frozen pre-execution truth table turned the re-review's blocker into a
  mechanical check rather than a second argument: the optional-key row printed
  `false` for an all-rejected pool before any code changed.
- The spawned integration test produces a real degraded row deterministically by
  seeding quota at the 80 % boundary — no latency or network dependency.
- The generated privacy reference changed by exactly one row, which is the
  visible proof that D-101 does what it claims.

## What went wrong

- The plan's Phase-1 sequencing put tests before the symbols they import twice
  (caught by the cold pass, fixed by landing the module with the old reason
  mapping first). The executed order worked, but only because I read the plan
  as "structure first, reason last".
- I optimistically claimed "no passing token needed" when stamping; the gate
  caught the unbound report at `mark-build`, which is the correct behavior and
  cost one extra stamp cycle.
- `validate-spec`'s generated-artifact check depends on commit state, which the
  plan's Phase 4 gate ordering did not anticipate.

## Recommendations

- When a plan's later phase creates symbols an earlier phase's tests import,
  state the exact compile order in the phase steps — "structure first, behavior
  second" is still ambiguous.
- A fresh stamp should be attempted at `mark-build` time in the plan's Phase 4
  step list, not discovered there.

`npm run check` → PASS (full, 22 gates, 115.9 s) on the final tree.

LOOP PAUSED — gates green; no open P0/P1 beyond the scheduled roadmap sections.
The deferred health/spec findings carry § R2c-ii; F-R2-7 carries § R2b-iii.
