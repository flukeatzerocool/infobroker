# AAR — fetch and extraction fidelity remediation

**Review cap:** 3 passes; used 3 passes

## What was supposed to happen

Fix six `Scheduled-roadmap` rows from the full-review register — F-R4-C-4,
F-R4-C-5, F-R4-C-6, F-R4-C-11, F-R4-D-4, F-R4-E-2 — with a driving test per
behavior change, one REQ-021c scope amendment, the README/decision/register
bookkeeping, and the roadmap section retired. Done bar: all six `Resolved`,
every change pinned by a test that fails on the unmodified source, gates green,
section gone.

## What happened

All six landed. The plan's six-commit series ran as five: `src/index.ts` and
`src/fetch-page-extraction.test.ts` carry both slice A (date reach) and slice B
(cache parity), so partial-hunk staging was the only way to keep them apart.
Collapsing those two into one coherent "fetch response paths" commit was the
honest minimum; the deviation is a commit-count change with no scope change,
recorded here rather than as a plan amendment.

| Finding | Disposition |
|---|---|
| F-R4-C-4 | Resolved — crawl and extract read the date from the raw HTML already fetched; no extra request (stub `requests` delta asserted = 1) |
| F-R4-C-5 | Resolved — `question` served from a fresh KB copy, passages ranked from cached text, zero-passage hit returns the full-content envelope |
| F-R4-C-6 | Resolved — metadata read follows the redirect chain through `fetchFollowRedirects`; 302 case driven against a bespoke loopback server |
| F-R4-C-11 | Resolved — property belongs to its nearest `itemscope` ancestor |
| F-R4-D-4 | Resolved — guard judges the coerced value; stringified array and `[]` refused, one value (any shape) deferred to `doFetchPage` |
| F-R4-E-2 | Resolved — required `InfoboxRow.origin` → additive `source_representation`; `source` stays `wikipedia` |

Also shipped: D-121 (header evidence unavailable on crawl/extract), the REQ-021c
scope sentences with `crawl-date` / `extract-date` clause tags, the README date
sentence, and the register census re-derived to 176 `Resolved` / 93
`Closed-P3` / 7 `Scheduled-roadmap`.

## What went right

- **The cold pass paid for itself.** It caught a false predicate (405 was never
  broken), an unsatisfiable done-bar clause, a second `detectPageDate` caller,
  an unbounded cheerio parse, and a stale register census — five of which would
  have surfaced as mid-execution surprises.
- **Red-first evidence held.** All 14 new tests failed before the fixes
  (7 in the spawned-server suite, 7 across the unit suites) and passed after;
  no test had to be weakened.
- **Shared builders removed duplication** (`dateMetaFrom`, `passageEnvelope`)
  instead of adding a third copy of each shape.

## What went wrong

- **Two review findings were my own drafting errors** (the 405 predicate and a
  commit-count contradiction), both caught only by a reviewer, not by the self
  pass. The self pass leaned on the finding text instead of re-reading the
  guard condition.
- **The first `session:close` failed on an environment condition, not a code
  one**: `/tmp` had 419 inodes free of 1,048,576, consumed by ~14 000 stale
  test fixtures (`ib-cfg-*`, `infobroker-health-*`, `adv-*`, …) from earlier
  sessions, so `test-push-pipeline` could not create its run directory and
  reported 6 case failures. Clearing the stale fixture directories restored
  1.03 M inodes and the re-run passed (29.8 s). No source change was needed.
- **Premise drift risk on the E-2 `source` value**: D6 kept `source:
  "wikipedia"` deliberately, so REQ-021i's "source representation" rides on a
  new field rather than the existing one. Correct, but it means a consumer that
  only reads `source` still cannot tell infobox from table.

## Findings and dispositions

| ID | Finding | Severity | Disposition |
|---|---|---|---|
| E1 | `src/index.ts` and the fetch test file carry two slices, so the planned six commits became five | P3 | Recorded; no scope change |
| E2 | `source_representation` is additive, so `source`-only consumers cannot distinguish representations | P3 | Closed as informational — REQ-021i reports representation, and the field is present on every wikipedia fact |
| E4 | `/tmp` inode exhaustion (stale harness fixtures) made `test-push-pipeline` fail once; cleared, re-ran green | P3 | Closed — environment condition, no code change; fixture dirs are recreated per run and never committed |
| E3 | Deep-read (`search_web`) inherits one extra metadata GET on a redirected page | P3 | Closed as informational — recorded under D2/C-13, suite pins the contract via a stubbed `detectDate` |

## Verification

- Red evidence: `npx vitest run` on the four unit suites → 4 files failed, 7 failed / 52 passed; on `src/fetch-page-extraction.test.ts` → 7 failed / 14 passed.
- Green: same suites → 59/59 and 21/21; `fetch-cache`, `datetime`, `deep-search`, `batch`, `tool-surface`, `infobox` → 68/68.
- `npm run typecheck` → clean. `npm run check:fast` → PASS (19 gates, 29.7 s). `npm run check` → **PASS (22 gates, 161.8 s)**.
- `npm run validate-spec` → all checks passed (REQ-021c 593 chars / 6 sentences / 5 SHALL / 2 backticks). `npm run check-intent-citations` → 172 citations, 0 findings. `npm run validate-readme` → 0 errors.
- Census: `evidence/census.ts` → 276 rows / 276 IDs, 176 `Resolved`, 93 `Closed-P3`, 7 `Scheduled-roadmap`, 0 scheduled rows without a roadmap mention.

## Backlog

243 unpushed commits, oldest 4.9 d at session start; this increment adds five
more and D9 keeps publication user-authorized. `npm run prep` / `npm run
release` were not run.

LOOP PAUSED
