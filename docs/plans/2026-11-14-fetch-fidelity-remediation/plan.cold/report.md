# Cold plan review — fetch and extraction fidelity remediation

Reviewer: `review` subagent (independent-review cold pass, no authoring context)
Plan sha256 (reviewed revision v1): `937a26e69d026a245309e2f4aae2e5edfa7c784f7eb36ad2e713b951151c56d5`
Depth: standard · Stages: 1, 2, 3, 5 (Stage 4 not triggered — no author edits during the pass) · Reads: ~46/40 (overrun spent verifying cited predicates)

Written by the parent session from the reviewer's report body. The reviewer
dispatch had no write tool, so it reported the body and the parent transcribed it
below. Verdict: **`independent-review FAILED.`** — 3 Blockers, 7 Majors, 6 Nits.
All are applied in the revised plan; the revision map is in `aar.md`.

## Blocker

**B1 · [design] F-R4-C-6's "405" predicate is false in the current tree.** The
plan claimed a 405-on-HEAD page never consults metadata. The guard is
`if (head.status < 300 || head.status >= 400)` (`src/index.ts:890`); 405
satisfies `>= 400`, so the metadata GET **is** issued today. Only the 3xx case
is real, as `docs/plans/2026-11-14-register-reconciliation/tasks.md:71` already
narrowed. D2's `head.ok === false` clause named a condition that does not exist.

**B2 · [clarity] The done bar contradicted D1 on header evidence.** "never less
than the plain path would" is unsatisfiable given the recorded header gap.

**B3 · [design] The register's derived census is not updated.**
`worklist.md:585` (`Resolved` 170, `Scheduled-roadmap` 13) and `:588` (13 rows
across the two sections) would go stale, and the `## 2026.11.11` CHANGELOG entry
repeats the same figures.

## Major

**M1** A second `detectPageDate` caller is missed: `src/index.ts:750`
(`search_web` deep reading). D2 changes its behaviour and egress.
**M2** `detectDocumentDate(fetched.content)` per crawled page would run an
unbounded cheerio parse over HTML fetched with `Number.MAX_SAFE_INTEGER`
(`:1260`); the plain path slices to 200 000 chars (`:893`).
**M3** `InfoboxRow.origin` threading is underspecified — rows are built in
`cellsToRow`, `rowFromElement`, and `rowsFromElement` (`src/lib/infobox.ts:27-81`).
**M4** D8's commit series contradicts D7/C-5 and the slice map on REQ placement.
**M5** D4 leaves the coercion-error branch unspecified; the "malformed `[` string"
claim holds only for bracket-delimited input (`src/batch.ts:80-96`).
**M6** The recorded header-evidence limitation has no `DECISIONS.md` disposition.
**M7** The spec→README binding is not addressed, though REQ-021c changes.

## Nit

**N1** A 405 HEAD is not servable from the shared stub (`src/lib/stub-provider.ts:56-68`).
**N2** The cached-question envelope duplicates the existing shapes without a shared builder.
**N3** "Nested microdata items are reported as their own entries" is already true; only attribution changes.
**N4** C-1's cited proof does not test the output schema; the real guarantee is `z.looseObject` (`src/output-schema.ts:10`).
**N5** Slice map "E — Evidence" is not a commit.
**N6** The cache-hit test's config is unnamed; the shared harness sets `kb_read: false` (`src/fetch-page-extraction.test.ts:99`).

## Unknowns (reviewer)

1. Artifact hash not verified (shell denied) — used the dispatched hash.
2. Baseline claims not re-run (same shell denial).
3. Pre-existing `check-loop-artifacts` warning not verified.
4. Isolation caveat: project instructions were injected into the reviewer's context.
5. Read budget overrun (~46/40).
6. `docs/plans/README.md`'s loop-token definition was not read; `AGENTS.md`'s pointer is consistent.

The reviewer's premise-verification reads were re-checked by the parent:
`src/index.ts:890` (B1), `:750`/`:1548` (M1), `:893`/`:1260` (M2),
`src/output-schema.ts:10` (N4), `src/fetch-page-extraction.test.ts:99` (N6), and
`worklist.md:585,588` (B3) all confirm the reviewer.

independent-review FAILED.
