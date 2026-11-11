# Tasks — R2e financial source and prose reconciliation

**Plan:** `plan.md` · **Status:** executed · **Date:** 2026-11-11

Red-first evidence: each behavior change's test was written and run **before**
its fix. The red run recorded the observed failure; the green run recorded the
pass.

## Phase 0 — Scaffold and baseline

- [x] 0. `plan.md`, `tasks.md`, in-progress `aar.md` (final line `LOOP OPEN`).
- [x] 1. Baseline re-confirmed on the execution HEAD: `npm run check` PASS,
      22 gates, 116.6 s, HEAD `3ea4cdf`; working tree clean before the
      increment record.
- [x] 2. Seam audit: `world_bank` has one registration site
      (`src/providers/index.ts:27,58`), one frozen-status entry
      (`src/provider-status.test.ts:169`), one slug entry
      (`src/providers/registered-slugs.ts:32`), and one test import
      (`src/providers/new-providers.test.ts:11`); `config.json` needed no edit.

## Phase 1 — Failing evidence first

`npx vitest run src/providers/new-providers.test.ts` on the unmodified
provider → **7 failed | 14 passed** (all seven indicator-path cases red).

| # | Finding | Test file | Assertion | Red result | Green |
|---|---|---|---|---|---|
| 3a | F-R2-36 | `src/providers/new-providers.test.ts` | "US GDP" requests `/v2/country/USA/indicator/NY.GDP.MKTP.CD`; one result per non-null year with the D4 shape | failed (documents endpoint called) | pass |
| 3b | F-R2-36 | same | "world inflation" resolves `WLD` | failed | pass |
| 3c | F-R2-36 | same | "gdp growth" selects `NY.GDP.MKTP.KD.ZG`, not `NY.GDP.MKTP.CD` | failed | pass |
| 3d | F-R2-36 | same | a null observation is dropped | failed | pass |
| 3e | F-R2-36 | same | a non-OK indicator response throws `RetryableError` | failed | pass |
| 3f | F-R2-36 | same | an unrecognized query still calls the document endpoint | pass (retained behavior) | pass |
| 3g | D2 | same | a failed country-list fetch falls back to the document endpoint | failed | pass |
| 3h | D2 | same | "inflation in Germany" resolves `DEU`; "tell us about inflation" resolves `WLD` | failed | pass |

Green: **21 passed** for the file after the fix.

## Phase 2 — Implementation

- [x] 4. `src/providers/world_bank.ts` — country-list request (`per_page=400`),
      alias table, indicator request, result mapping; document path retained;
      `health()` unchanged; header citations gained `REQ-095`.
      Evidence: `npx vitest run src/providers/new-providers.test.ts` → 21
      passed. Live: direct provider call returned 9 indicator facts, title
      "United States — GDP (current US$) (2025)", two HTTP calls both 200.

## Phase 3 — Prose and documentation

- [x] 5. `infobroker.md` §1 glossary and §5.3 sketch/prose per D5; §6.3 World
      Bank row (`:834`; SearXNG row `:820` verified), §A.2 entry, §A.5 entry
      per D6. Evidence: `npm run validate-spec` → all checks passed
      (142 REQs, 0 uncited files).
- [x] 6. `README.md` five privacy sites and the provider-table row per D7;
      `skills/infobroker/references/config-tune.md:97`. Evidence:
      `npm run validate-readme` → 0 errors, 0 warnings; `grep -n "privacy"
      README.md` reviewed (sites 205/473/498-499/801 corrected).

## Phase 4 — Commit series and release

- [x] 7. Content slices committed at the pre-run version (C-1): `npm run check`
      → PASS (22 gates, 117.7 s) before the first commit;
      (a) `b898146` docs(spec); (b) `ea96abe` fix(providers);
      (c) `a3e8aae` docs(readme). Each pre-commit `version-sync` → OK at
      2026.11.7.
- [x] 8. `npx tsx scripts/version.ts bump` → 2026.11.11 across all stamps;
      CHANGELOG entry added; `npx tsx scripts/version.ts check` → OK.
- [x] 9. `worklist.md`: F-R2-36, F-R2-38, F-R2-41, F-R2-42 → `Resolved` with
      one-line summaries.
- [x] 9a. Reachability probe (C-2): MCP `search_web` "US GDP" (task_type
      financial, fresh) → provider `duckduckgo`, `fallback_used: true` on the
      deployed 2026.11.7 build, so `sec_edgar` did not preempt in that call;
      direct probe of the new provider → 9 indicator facts. `sec_edgar`'s own
      count could not be measured from the shell (DNS `EAI_AGAIN` for
      `efts.sec.gov`). No preemption demonstrated → no successor roadmap item.
- [x] 10. `ROADMAP.md`: R2e section removed; `npm run check-roadmap` → OK.

## Phase 5 — Verification

- [x] 11. Final gates on the final tree: see `aar.md`.
- [x] 11a. Advisory live probe: indicator path returned 9 facts; the document
      fallback test covers the fallback path deterministically.
- [x] 12. `aar.md` finalised with the terminal token and the probe outcome.
- [x] 13. Release commit `docs(release): record the R2e close`.
