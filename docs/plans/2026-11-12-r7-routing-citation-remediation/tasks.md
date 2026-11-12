# Tasks — R7 routing-citation remediation

Source plan: `plan.md` (revision 3). Depth: standard. Rollback cost: 1.

## Phase 0 — Scaffold and baseline

- [x] **T0** Baseline recorded.
  - `npm run status` → version 2026.11.11 (latest tag `v2026.11.07`), 135
    unpushed commits, oldest 3.0 d, 11 open roadmap items.
  - `npm run check` → PASS (full, 159.0 s, 22 gates, recorded for `0852120`),
    run before this plan directory existed. Pre-existing warning:
    `check-loop-artifacts` → `2026-11-10-r6-encryption-capacity-remediation:
    plan.md has no **Done bar:** line`. `npm run audit` → 4 low advisories,
    below the REQ-101 threshold.
- [x] **T1** `tasks.md` and `aar.md` (seeded `LOOP OPEN`) present.

## Phase 1 — Derived surface (F-R7-G-1)

- [x] **T2** Red: seeded `skills/infobroker/references/troubleshooting.md` with
  `` `infobroker_fetch_pagez` `` → `npx tsx scripts/check-intent-citations.ts`
  exited **0** (141 citations, 0 findings) before the change. Tree restored.
- [x] **T3** `prefixPolicyFor(file)` + `EXPLICIT_PREFIX_POLICY` in
  `src/intent-citations.ts`; no I/O added.
- [x] **T4** Surface builder (instruction + `SKILL.md` + sorted
  `skills/infobroker/references/*.md`) in `scripts/check-intent-citations.ts`;
  caught directory failure exits 2.
- [x] **T5** Green: gate exits 0 on the unmodified corpus (172 citations);
  T2's seed now exits **1** with `unknown_tool` at
  `troubleshooting.md:94`.
- [x] **T6** New-file probe: `references/probe-surface.md` with
  `` `infobroker_bogus_tool` `` failed the gate with no registration edit
  (`unknown_tool` at `probe-surface.md:2`, exit 1); deleted and green again.

## Phase 2 — Bare-tool detection (F-R7-G-2)

- [x] **T7** Red: seed `` `fetch_pages (crawl)` `` in `troubleshooting.md`
  → exit **0** before the change.
- [x] **T8** `isCitationShaped(args)` + `nearMiss(name, knownSlugs)` +
  `containsSlug(name, knownSlugs)` wired into the bare branch of
  `looksLikeTool`; unknown → `unknown_tool`.
- [x] **T9** Green: the T7 seed exits **1** with `unknown_tool` at
  `troubleshooting.md:94`; corpus run green.
- [x] **T10** Unit tests added (near-miss, affix, arg-shaped, prose guards,
  policy derivation, composition) → `npm run test` 32/32 in the file,
  1435/1435 overall.
- [x] **T11** False-positive audit: final corpus → **172 citations, 0 findings**.

## Phase 3 — Documentation and registers (F-R7-G-3 and bookkeeping)

- [x] **T12** README `:482-489` names the user layer → `validate-readme` exit 0.
- [x] **T13** `### D-108` added under `## Active Decisions`.
- [x] **T14** Worklist: REQ-107 / REQ-054 verdict rows and F-R7-G-1/2/3
  register rows → `Resolved 2026-11-12`; both stale README line references
  corrected. Acceptance: five matching lines, all resolved.
- [x] **T15** § R7 routing-citation remediation removed; § Review-loop
  convergence **kept** (cap was exceeded once, see AAR) → `check-roadmap`
  exit 0.
- [x] **T16** CHANGELOG sibling section, date `2026.11.11` → `version-sync`
  exit 0.

## Phase 4 — Gates and close

- [x] **T17** Local gate suite: `validate-spec` 0, `check-roadmap` 0,
  `check-non-goals` 0, `version-sync` 0, `check-script-discipline` 0,
  `check-loop-artifacts` 0, `typecheck` 0, `typecheck:scripts` 0,
  `check-intent-citations` 0, `validate-readme` 0, `test` 0 (1435 tests).
- [x] **T18** `aar.md` dispositions, cap record, terminal token;
  `npm run session:close`.
- [ ] **T19** `npm run check` on the final tree (full, un-piped) with exit
  status recorded.

## Red/green transcript log

| Probe | Before | After |
|---|---|---|
| T2/T5 renamed prefixed tool in `troubleshooting.md` | exit 0, 0 findings (141 citations) | exit 1, `unknown_tool` at `troubleshooting.md:94` |
| T6 new reference file, bogus tool | not parsed (file would be invisible) | exit 1, `unknown_tool` at `probe-surface.md:2` |
| T7/T9 renamed bare tool `fetch_pages (crawl)` | exit 0, 0 findings | exit 1, `unknown_tool` at `troubleshooting.md:94` |
| T4 missing reference directory | would throw (exit 1) | exit 2, `cannot read skills/infobroker/references/` |
| T11 corpus false-positive count | 0 findings on the old 5-file surface | 0 findings on 172 citations across 16 files |
