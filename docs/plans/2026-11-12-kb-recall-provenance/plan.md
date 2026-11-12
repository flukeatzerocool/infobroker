# Plan — KB recalled-source provenance

**Status:** draft, awaiting plan review and user approval · **Date:** 2026-11-12 · **Depth:** light (one production mapping in one module, one test file, bookkeeping; no external, destructive, or publish surface)
**Review independence:** self — light depth, no cold pass (§0.5)
**Reviewed artifact:** stamped from this file into the plan-review artifact store outside the repository (mode 0600); the exact sha256 is in the gate output and in the `plan.evidence.md` sidecar beside the artifact (embedding a file's own hash in the file would invalidate it).
**Rollback cost:** 1 — one additive field in one recall mapping plus a test and bookkeeping; `git revert` restores prior behavior with no state or schema change.
**Roadmap item:** `ROADMAP.md` § KB recalled-source provenance (`ROADMAP.md:17-22`; removed from `ROADMAP.md` and folded into `CHANGELOG.md` when this increment closes)
**Predecessor:** `2026-11-07` pipeline run; version 2026.11.11, 106 unpushed commits (oldest 2.8 d)
**Origin:** cold-review finding from `docs/plans/2026-11-12-r5-corroboration-remediation/aar.md:53-57`, disposition **scheduled**.

## Why this section

`ROADMAP.md` § KB recalled-source provenance is the first section in the file,
and the ordering rule is top section first. Its trigger — "start with the next
`verify_claims` provenance change" — is satisfied by definition: this is that
change, and no other open roadmap item touches the `verify_claims` provenance
record.

The defect is one dropped field. REQ-026d requires the provenance record to
name, for each source, its retrieval time, content hash, source family, and
provider. The record's `sources[]` builder already reads `s.provider`
(`src/corroborate.ts:894`), and `attributeSource` already copies `r.provider`
onto the attributed source (`src/corroborate.ts:210`). The only link that
breaks the chain is the knowledge-base recall mapping
(`src/corroborate.ts:672-678`), which constructs a `SearchResult` from each
`KbSearchResult` and omits `provider` even though `KbSearchResult` carries it
(`src/types.ts:630`) and `kbSearch` populates it from the stored chunk
(`src/kb.ts:578`). Recalled sources therefore reach the provenance record with
`provider: undefined`, which JSON omits — an unpopulated REQ-026d field for
exactly the sources REQ-026e adds.

Two adjacent effects make the passthrough the correct fix rather than a local
patch: `snapshotSource` records `provider: source.provider`
(`src/corroborate.ts:943`), so a recalled source's preservation snapshot also
gains its ingest provider; and the source object is what callers read, so the
field is consistent between the finding, the provenance record, and the
snapshot.

## Baseline (verified this session)

- `npm run status` → version 2026.11.11 (latest tag `v2026.11.07`), **106
  unpushed commits, oldest 2.8 d**, 16 open roadmap items.
- `npm run check:fast` → **PASS** (19 gates, 22.7 s, sequential `--fast`).
  `npm run check` was not run this session; the plan schedules it on the final
  tree.
- Working tree was clean at plan time except for this increment directory.
- `npm run check-loop-artifacts` reports `missing aar.md` for this directory
  until T10 writes it. That transient red is created by the plan itself and is
  expected mid-increment; the gate is run only on the final tree.

## Predicates re-verified by reading the code this session

| Claim | Evidence | Verdict |
|---|---|---|
| Recall mapping drops `provider` | `src/corroborate.ts:672-678` maps `{ title, url, snippet, source_type, retrieval_origin }` only | Confirmed |
| The type can carry it | `KbSearchResult.provider: string` (`src/types.ts:630`), populated at `src/kb.ts:578` | Confirmed |
| The consumer already reads it | `attributeSource` `provider: r.provider` (`src/corroborate.ts:210`); provenance `provider: s.provider` (`src/corroborate.ts:894`) | Confirmed |
| No sibling consumer depends on the field being absent | `grep -n "\.provider" src/corroborate.ts` shows only config lookups, `attributeSource`, `provenance`, and `snapshotSource` | Confirmed |
| Spec already mandates the field | REQ-026d (`infobroker.md:327`) names "provider" per source; REQ-026e requires recalled results to be reconciled as sources | Confirmed — no spec edit needed |
| Existing tests do not pin the absence | `src/corroborate.test.ts:916-936` asserts tool/threshold/version only; the KB tests assert origins and counts, not provider | Confirmed |
| No other register cross-references the roadmap section | `grep -rn "KB recalled-source provenance" --include=*.md .` returns only `ROADMAP.md:17` and the closed R5 AAR (a historical record, not edited after close) | Confirmed — no same-step register update beyond `ROADMAP.md` |

## Blast radius

| File | Change | Size |
|---|---|---|
| `src/corroborate.ts` | add `provider: r.provider` to the KB recall mapping (one line, `:672-678`) | S |
| `src/corroborate.test.ts` | new `@implements REQ-026d` test asserting a recalled source's `provider` in the finding and in `provenance.sources`; empty-provider case asserts omission rather than fabrication | S |
| `CHANGELOG.md` | one entry under the current version section | S |
| `ROADMAP.md` | remove the `## KB recalled-source provenance` section | S |
| `docs/plans/2026-11-12-kb-recall-provenance/` | `plan.md`, `tasks.md`, `aar.md` (increment record) | S |

No type, config, schema, dependency, or provider-registry change. No new gate.

## Done bar

**Done bar:** a knowledge-base-recalled source in a `verify_claims` result
reports its ingest `provider` on the finding source and in the provenance
record's per-source entry; the new test fails on the unmodified source (red
result recorded in `tasks.md`) and passes on the final tree; a KB record with
an empty provider leaves the field omitted rather than stating a placeholder;
`ROADMAP.md` no longer carries the section and `CHANGELOG.md` carries one
entry; the increment record carries plan, tasks, and an AAR ending
`LOOP PAUSED` or `LOOP OPEN`; `npm run typecheck`, `npm run check:fast`,
`npm run validate-spec`, and `npm run check-loop-artifacts` exit 0 on the
final tree, and `npm run check` is run once on the final tree (an
`audit`-only failure caused by absent registry access is recorded as
environmental, never as a pass).

**Non-closure rule:** the slice stops if the fix requires changing REQ-026d's
field set, the provenance record's shape, the `CorroborationSource` type, or
the knowledge-base store; those stay scheduled and the AAR ends `LOOP OPEN`.

## Decisions

- **D1 — pass the ingest provider through the existing `provider` field.**
  The recall mapping sets `provider: r.provider`; no new field name.
  **Alternative rejected:** a separate `ingest_provider` field (REQ-026d's
  "provider" is the only per-source provider it names, and two fields would
  leave the required one empty for recalled sources); relabelling recalled
  sources with a constant such as `knowledge_base` (that is the retrieval
  channel, already carried by `retrieval_origin`, and would erase the ingest
  origin the roadmap asks for).
  - Consequence: a recalled source's preservation snapshot metadata
    (`snapshotSource`, `src/corroborate.ts:943`) also gains the ingest
    provider. That is the same fact, recorded in one more place.
- **D2 — no spec or README edit.** REQ-026d already requires the field and
  REQ-026e already requires recall; the implementation was non-conformant, not
  the requirement. Editing a REQ body would trigger the pipeline's spec→README
  binding for no semantic gain.
- **D3 — empty provider stays absent.** `attributeSource` writes
  `provider: r.provider`, so an empty string passes through and an absent
  value yields `undefined`, which JSON drops. The test pins omission rather
  than a fabricated `unknown` label, consistent with REQ-026h's
  "omit rather than fabricate" discipline.
- **D4 — one behavior commit, one docs commit.** The source change, its test,
  the changelog entry, and the roadmap removal are one concern and ship
  together; the increment record is the docs bucket. This is under the split
  limit and within the single-bucket-exception rule.

## Steps (execution order)

1. Add the failing test in `src/corroborate.test.ts` (recalled KB hit with
   `provider` and one external hit at a threshold that keeps the finding
   inspectable); run `npx vitest run src/corroborate.test.ts` and record the
   red result in `tasks.md`.
2. Apply the one-line mapping change in `src/corroborate.ts`.
3. Re-run the targeted suite; then `npm run typecheck` and `npm run check:fast`.
4. Add the `CHANGELOG.md` entry; remove the `ROADMAP.md` section.
5. Run `npm run validate-spec` and `npm run check` on the final tree; run
   `npm run check-loop-artifacts` after T10 writes `aar.md` (it is red until
   then, by design).
6. Commit in order: (a) source + test + changelog + roadmap (behavior
   concern), typecheck-verified; (b) increment record (`plan.md`, `tasks.md`,
   `aar.md`), typecheck-verified. Do not push — publication is the
   maintainer's decision and the push path is `npm run prep` / `npm run
   release`, not part of this increment.

## Edge cases

| Case | Handling |
|---|---|
| KB record with empty/absent `provider` | Field omitted, not fabricated (D3); pinned by the test's second case |
| Recalled source later retrieved live for the same URL | Existing behavior clears `retrieval_origin`; `provider` then describes the live serving provider because the external result overwrites attribution — unchanged by this plan and asserted by the existing upgrade test |
| `kbSearch` throws or KB unconfigured | Unchanged: recall is skipped, the external pass runs (REQ-026e) |
| Provenance stripped in compact output | Unchanged: `src/index.ts:2074` deletes `provenance` for compact; this plan does not touch verbosity |

## Verification

| Claim | Probe |
|---|---|
| Recalled provider reaches the finding and the provenance record | New test in `src/corroborate.test.ts` |
| No regression in corroboration behavior | `npx vitest run src/corroborate.test.ts` |
| Types hold | `npm run typecheck` |
| Spec traceability still passes | `npm run validate-spec` |
| Increment record contract | `npm run check-loop-artifacts` |
| Gate suite | `npm run check:fast`, then `npm run check` |
