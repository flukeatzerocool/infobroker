# AAR — R2b-i provider auth-field validation

**Status:** complete. The increment executed on 2026-11-11.

## What happened

Seven cold-review passes over five revisions (R2b → R2b-i narrowed to F-R2-3)
preceded execution. Execution itself was short: twelve rejection cases and six
behavioural cases were written red first, `validateConfig` gained three shape
rules, REQ-037 gained one sentence, and the roadmap section was split into two
successors.

## Done-bar evidence

| Clause | Evidence |
|---|---|
| DB-1 | `validateConfig` rejects `auth_env`/`url_env` when not a non-empty string and `auth_optional` when not a boolean; `null` falls out of the type test; `auth_optional: false` and an absent field accepted. Three rules in `src/config.ts:421-434`. |
| DB-2 | Twelve rejection cases in `src/config.test.ts`, each asserting `Provider "exa": <field> must be …`; `src/config.test.ts` → 105 passed. |
| DB-3 | Pre-fix run recorded in `tasks.md`: 19 failed, 86 passed, including the `loadConfig` reproduction with `auth_env: 42` and `exa` prepended to `general_web`. |
| DB-4 | `starts on shipped defaults for a malformed auth field…` and `…for a null auth field`: issue code `invalid_merged_user_layer`, message names `exa`/`auth_env`, layer bytes unchanged. |
| DB-5 | `rejects a malformed provider auth field before writing` in `src/config-patch.test.ts`: throws, no layer file created. |
| DB-6 | `rejects a malformed auth field on reload and keeps the previous configuration` and `rejects a null auth field on reload`: throws, previous `max_chars` retained. |
| DB-7 | `does not leak a credential-shaped value into the startup issue or the warning log` and `throws a redacted message on the reload path`: non-empty, name `exa`/`auth_env`, contain neither `sk-sentinel-a` nor `sk-sentin`. |
| DB-8 | REQ-037 body amended (`infobroker.md:420-429`); `npm run validate-spec` → all checks passed; three `@implements REQ-037 <branch>` tags added. |
| DB-9 | `CHANGELOG.md` entry under `## 2026.11.7`; `DECISIONS.md` D-098. |
| DB-10 | `ROADMAP.md` carries `## R2b-ii user-layer write ordering` and `## R2b-iii key-safety evidence`, no `## R2b`; `check-roadmap` OK (25 sections); worklist F-R2-3 `Resolved 2026-11-11`. |
| DB-11 | `npm run check` → PASS (full, 111.4 s). |

## What went right

- Every predicate in the plan was verified against source before the first edit:
  the throw site, the recovery message chain, the truthiness reads, and
  `applyDefaults` never coercing an auth field.
- Writing the twelve cases red first made the acceptance cases' green status an
  explicit observation rather than an assumption.
- The spec gap was caught before implementation: REQ-037 did not authorize the
  rule and the amendment landed in the same commit.

## What went wrong

- **The review loop did not converge.** Seven cold passes found real defects on
  every pass. Fixing wording repeatedly created new cross-references, and each
  new reference became the next pass's finding.
- **Scope wandered.** R2b was split into R2b-i/ii/iii only after five passes on a
  wider increment; the narrowing should have happened at the first F-R2-7
  evidence blocker.
- **Evidence was written to a recreated temp directory** early in the session,
  destroying the first cold report; later passes wrote to a stable subdirectory.
- Execution ran on a revision that was never cold-reviewed (recorded risk
  acceptance). The code diff is gate-covered, but that is compensating control,
  not a substitute for the review the plan wanted.

## Dispositions

| Item | Disposition |
|---|---|
| F-R2-3 | `Resolved` — this increment |
| F-R2-2 | Scheduled — § R2b-ii |
| F-R2-7 | Scheduled — § R2b-iii |
| Review-loop process | P2 — see `ROADMAP.md` § Review-loop convergence |

## Recommendations

The next plan for this area (R2b-ii or R2b-iii) should be drafted against the
narrowed scope from the start and should state a cold-pass cap in the plan
itself, not leave the cap to the agent's judgement.

## Loop status

LOOP PAUSED
