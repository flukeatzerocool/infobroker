# AAR — R4 `fetch_page` extraction and date remediation

**Status:** complete · **Date:** 2026-11-11 · **Plan:** `plan.md` (stamped `planned`, depth `standard`, independence `fresh`)

## What shipped

1. **Date evidence classification (F-R4-C-2).** `src/datetime.ts` returns a
   `kind` (`modified` | `published`) and is now `detectDocumentDate`; selector
   lists are split and modification evidence outranks publication evidence. A
   publication date is reported as `published_date` with its source and
   confidence, never as `last_updated`; only modification evidence is stored as
   a KB `source_updated_at`; an ambiguous `<time datetime>` is
   low-confidence publication evidence.
2. **No-match extraction metadata (F-R4-D-1, F-R4-D-2).** Both no-match returns
   share `fullContentEnvelope`, reporting `meta.passages_returned: 0`,
   `meta.match_quality: "none"`, the mode, and the note; batch per-input
   metadata believes a reported count/band. The two vacuous rerank assertions
   were replaced with a real empty-content assertion.
3. **Raw and plain envelope metadata (F-R4-D-3, F-R4-D-5).** The plain envelope
   carries `url`, `extraction_mode`, and a zero passage count, so `raw` mode's
   `structuredContent` exposes every field REQ-021j names — now proven through
   the live handler instead of a synthetic envelope.
4. **Crawl and extract truncation (F-R4-C-9).** Both paths take an uncapped
   render bound and run the derived text through `maybeTruncate` once; a
   clipped crawl page carries its own `truncated`/`output_path` and the envelope
   reports `truncated` plus `meta.truncated_pages`; a clipped extract response
   carries the plain-path truncation trio.

## What went right

- The cold pass caught a real design defect before execution: the no-match
  branch was not reachable through a low-overlap question (`rankDocs` keeps
  every `score > 0` candidate). The plan was rewritten around the deterministic
  unreadable-content limb (`htmlToText("") → ""`), which the handler test now
  proves.
- The cold pass also caught a false premise in the date selector order
  (`og:updated_time` sat after the published selectors), turning an accidental
  precedence into a stated rule with a mixed-evidence test.
- Test-first execution surfaced the truncation orphan-file problem (the renderer
  layer's raw-HTML file would have been unreferenced), resolved by leaving that
  layer uncapped on the two paths.
- The dirty-tree `check` run is the expected pre-commit state; every gate is
  green and the commit series is typecheck-clean.

## What went wrong

- The draft plan's "question with no shared words" fixture was wrong; it took a
  cold pass to find it. Lesson recorded: a branch-reachability claim needs the
  filter predicate named, not inferred from the branch's intent.
- One tool edit (`D2` alternatives) briefly dropped a recorded alternative and
  was restored in the next edit; no artifact impact.

## Findings register

| ID | Finding | Severity | Disposition |
|---|---|---|---|
| A-1 | Twelve R4 register rows still carry `Scheduled-roadmap` with no owning roadmap section (F-R4-B-1, B-3, C-3…C-8, C-10, C-11, D-4, E-2, E-3). | P2 | Deferred by the user at plan approval — the plan states this increment does not create a section; `ROADMAP.md` scheduling is user-owned. |
| A-2 | `check-loop-artifacts` warning for `2026-11-10-r6-encryption-capacity-remediation` (missing **Done bar:** line). | P3 | Informational (C-8), unchanged. |
| A-3 | A low top score still returns a passage rather than the "page not answering" mode. | P3 | Informational — mode selection is outside every R4 row; recorded in the plan as out of scope. |

No P0. No open P1. The scheduled roadmap is unchanged apart from the retired
section.

## Backlog

92 unpushed commits before this increment, oldest 2.1 d; publication stays with
the user (D7). The commit series below is local only.

## Commit series

Three local commits, each `typecheck`-clean, no push. D6 planned four; the
datetime slice and the extraction-metadata slice were merged because both edit
`src/index.ts` in adjacent regions and a file-level split cannot separate them
without hunk surgery that buys no review value — the whole set is one roadmap
item.

1. `test(harness): serve configurable pages from the stub provider`
2. `fix(fetch): classify date evidence and complete extraction metadata`
3. `docs(roadmap): resolve the R4 extraction findings and retire the section`

## Next

`ROADMAP.md` § R4 fetch-page extraction remediation is retired; the next
scheduled section is `## R4 fetch-page classification remediation`, whose
trigger ("start after chunk R5 closes") is met.

LOOP PAUSED
