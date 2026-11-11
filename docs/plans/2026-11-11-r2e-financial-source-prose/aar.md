# AAR — R2e financial source and prose reconciliation

**Status:** closed · **Date:** 2026-11-11
**Plan:** `plan.md` · **Tasks:** `tasks.md` · **Predecessor:** `3ea4cdf`
**Roadmap item:** `ROADMAP.md` § R2e financial source and prose reconciliation (retired to `CHANGELOG.md`)

## What happened

1. Confirmed the baseline at `3ea4cdf`: `npm run check` PASS (22 gates,
   116.6 s), clean tree, 21 open roadmap items.
2. Wrote the red indicator-path tests first: `npx vitest run
   src/providers/new-providers.test.ts` → 7 failed / 14 passed on the
   unmodified provider.
3. Rewrote `src/providers/world_bank.ts` as indicator-first: a deterministic
   alias table selects an indicator, the country list (`per_page=400`) resolves
   the location (names case-insensitive, ISO codes uppercase-only), and the
   Indicators API returns one `structured_fact` per non-null year. The document
   index stays as the fallback for unrecognized queries and for a failed
   country-list request. `health()` is unchanged.
4. Corrected the spec prose: §1 glossary and §5.3 (interface sketch, rate-limit
   ownership, dispatch rule), §6.3 World Bank row, §A.2 World Bank entry, §A.5
   SearXNG entry (GET, upstream forwarding).
5. Corrected the user-facing echoes: five README sites (varied wording) and
   `skills/infobroker/references/config-tune.md:97`.
6. Committed the content slices at `2026.11.7` before the bump (C-1):
   `b898146` spec, `ea96abe` provider, `a3e8aae` readme.
7. Bumped to `2026.11.11`, added the CHANGELOG entry, marked the four register
   rows `Resolved`, retired the roadmap section, and ran the full gate suite.

## What went right

- Red-first paid off twice: the seven red tests pinned the new behavior, and the
  failure trace exposed a latent test-harness bug (§What went wrong, item 2)
  that would have made any argument-inspecting mock fail only in teardown.
- The indicator path was verified live, not only against fixtures: a direct
  provider call returned 9 observations, title
  "United States — GDP (current US$) (2025)", from two successful HTTP calls.
- Cold review caught two real defects before execution (a contradictory done
  bar and a stale "cache" in the blast radius) plus the §6.3 two-row and
  version-stamp omissions. All were fixed in the plan, not discovered in build.
- Committing before the bump kept every content commit internally
  version-consistent; the pre-commit `version-sync` was green on each.

## What went wrong

1. **Commit-subject limit.** The first spec commit subject was 73 characters; the
   `commit-msg` hook rejected it. Because the failure chain used `;`, the
   already-staged `infobroker.md` was swept into the provider commit. Recovered
   with `git reset --soft HEAD~2`, re-staged by file, and re-committed with a
   63-character subject. No published history was rewritten (commits were
   local-only).
2. **Latent harness bug in the test file.** `beforeEach(() => mockFetch.mockReset())`
   returned the mock object, which Vitest treats as a teardown callback and calls
   with no arguments. The previous default implementation ignored arguments, so
   the defect was invisible; the new URL-aware mock threw during cleanup. Fixed
   in the same file with a block-bodied hook.
3. **Direct `sec_edgar` probe unavailable.** The shell-side probe failed with DNS
   `EAI_AGAIN` for `efts.sec.gov`, so EDGAR's own result count for "US GDP" was
   not measured from the shell. The MCP-level probe supplied the operational
   answer (see Findings).
4. **The deployed MCP build predates this change** (2026.11.7), so a
   `search_web` call could not exercise the new indicator path end to end. The
   path was measured directly instead.

## Findings

| Finding | Severity | Disposition |
|---|---|---|
| Test hook returned the mock, so Vitest invoked it as teardown with no arguments | P2 | **Resolved in-session** — `beforeEach` block body; the file's 21 tests pass |
| Commit subject exceeded the 72-character hook limit and a staged spec file was swept into the next commit | P2 | **Resolved in-session** — `reset --soft`, file-scoped staging, shorter subject; three content commits re-created cleanly |
| `sec_edgar` live count unmeasured from the shell (DNS) | P3 | **Closed informational** — the chain-level probe covers the operation; no gate depends on live network |
| Deployed server predates the change, so chain-level reachability of the new path is unproven end to end | P3 | **Closed informational** — direct provider probe returned 9 facts; the MCP probe showed `sec_edgar` did not preempt "US GDP"; no successor roadmap item filed |
| §A.5 keeps the unverified "274 search backends" figure | P3 | **Closed informational** — out of this section's scope by the plan |

Probe outcome (C-2): MCP `search_web` "US GDP" (`task_type: financial`,
`fresh: true`) → `provider: duckduckgo`, `meta.fallback_used: true` on the
deployed 2026.11.7 build; direct new-provider call → 9 indicator facts.
EDGAR preemption was **not** demonstrated, so no `## Financial chain query-level
routing` item was filed.

## Recommendations

None. F-R2-36, F-R2-38, F-R2-41, and F-R2-42 are `Resolved`; the roadmap
section is retired; the next scheduled work is `## R3 findings remediation`
per `ROADMAP.md`. Publication remains with the user (78 unpushed commits before
this increment).

LOOP PAUSED
