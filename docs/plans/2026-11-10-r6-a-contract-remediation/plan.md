# Plan — R6 `manage_kb` action-contract remediation

**Status:** approved by user ("execute plan") · **Date:** 2026-11-10 · **Depth:** standard
**Review independence:** fresh — cold pass 1 FAILED (2 Blockers, 3 Majors), diff re-review passed. Stamp `d739c6f2…5262a`, cold report `/tmp/opencode/r6-a-cold.md` (`4b5eceb4…2727`, stages 4/5).
**Rollback cost:** 1 — source + tests + docs; no config, dependency, schema, or destructive change
**Roadmap item:** `ROADMAP.md` § R6 `manage_kb` action-contract remediation (retire on close)
**Predecessor:** `ad56707` (M1 close, review program closed). R7 closed 2026-11-09 (`LOOP PAUSED`), so this item's trigger — "start after chunk R7 closes" — is satisfied.

## Baseline (verified this session)

- `npm run check` → PASS (full, 22 gates, 52.1 s) at HEAD `ad56707`, tree clean.
- `npm run status` → version 2026.11.7, 27 open roadmap items, 31 unpushed, last pipeline run 2026-11-07.
- The first roadmap section is this item; every earlier-defined chunk (R1–R9, M1) is closed.

## Done bar

**Done bar:** F-R6-A-1, F-R6-A-2, and F-R6-A-3 are fixed and marked `Resolved` in the
worklist register; the F-R6-A-2 identity legs fail on the pre-fix source tree and pass
after the fix (F-R6-A-1 and F-R6-A-3 are pinning tests that pass on both trees); the R6
action-contract section is retired from `ROADMAP.md` (27 work items → 26); a CHANGELOG
entry covers the behavior changes; `npm run check:fast` and `npm run check` exit 0 on the
final tree; the increment record under `docs/plans/2026-11-10-r6-a-contract-remediation/`
carries plan, tasks, and an AAR ending `LOOP PAUSED`.

## Findings in scope

| ID | Predicate (verified by reading the branch) | Fix |
|---|---|---|
| F-R6-A-1 | `manage_kb.max_results` advertises default 8 / max 50 (`src/index.ts:1994`), but no test pins the schema or the behavior; the unconfigured-KB guard (`src/index.ts:2058-2059`) and the unopenable-store lock error (`src/kb.ts:390-424`) have no assertion | Tests only |
| F-R6-A-2 | Text-only ingest discards a caller `source_url`: the `else if (!url)` branch overwrites `finalUrl` with the report identity or `""` (`src/index.ts:2236-2243`); an empty identity makes `sqliteList` key each chunk separately (`chunk:<id>`, `src/kb.ts:730`) | Behavior: preserve the caller identity; synthesize a stable `text://` identity when none is given |
| F-R6-A-3 | Receipt-for-non-report, receipt-without-KB, and at-least-one-of-text-or-url refusals exist only in the handler (`src/index.ts:2185-2186,2221-2227`) | Tests only (handler-level, Arena) |

## Design decisions

**D1 — Identity rule for text-only ingest (`src/index.ts`).** Resolve the identity once
from the caller: fetched `url` wins, then `source_url`, then a synthesized identity.
A report with no caller identity keeps `resolveReportIdentity` (`report://<slug>`); a
report with `source_url` keys by that supplied URL (and its receipt is stored under the
same identity). Non-report text ingests with no identity get a new
`resolveTextIdentity(title)` → `text://<slug>`. Rejected alternatives: (a) preserve
`source_url` only and keep `""` when absent — leaves the one-entry-per-chunk list
fragmentation that is part of the finding predicate; (b) require `source_url` for text
ingest — breaks REQ-060b, which allows text alone; (c) reuse `report://` for non-reports —
collides with the report receipt namespace and REQ-060i verification.

**D2 — `text://` is a document identity, not a fetchable URL.** It is never fetched,
only stored and listed, matching the existing `report://` convention. Two text ingests
with the same title share the identity and the second replaces the first under REQ-072's
same-source replacement; a caller who needs distinct documents supplies `source_url`.
`slugify` today falls back to the literal `"report"` for a title with no alphanumerics,
so the helper parameterizes the fallback (`slugify(title, fallback)`) and text identities
use `"note"`: distinct documents in the report namespace are never collided by a
punctuation-only title. Two punctuation-only titles still share `text://note`; that is
recorded as a known limitation, not silently merged.

**D3 — No REQ body change.** REQ-060b already permits text-only ingest and requires a
reported source identifier; REQ-060e already requires distinct list entries. The change
brings code into line with the existing contract, so `infobroker.md` is untouched and the
spec→README binding does not trigger.

**D4 — "Invalid KB" scope and assertion strength.** REQ-060 lumps "unconfigured or
invalid" into one error clause. The handler has two real error paths: KB absent
(`kb: null` in the user layer) and a configured-but-unopenable store. The unopenable
case is caught by the inner `initKb` catch (`src/kb.ts:416-424`), whose remediation is
deliberately generic ("Inspect the knowledge-base directory and its permissions…"); the
path-naming remediation at `src/kb.ts:459` belongs to the outer catch and is unreachable
for this failure. The test therefore asserts `config_error`, a message matching
`/could not be opened/`, a non-empty remediation, and no results — it does **not** demand
the storage path, so F-R6-A-1 stays tests-only. A structurally invalid KB block in the
user layer instead falls back to shipped defaults — a config-layer contradiction already
scheduled as F-R6-B-4 — and is explicitly out of scope here.

**D5 — Arena test home.** The refusals and identity behavior live in the tool handler,
not in `kb.ts`; the in-process unit suite registers no tool, so it cannot call one. New
tests go in a new Arena file `debate-club/src/kb-contract.test.ts` (real stdio server,
replay fixtures), while the schema contract stays in `src/tool-surface.test.ts`.
Rejected: extending `mcp-contract.test.ts` — it already carries 600+ lines and one
shared server.

**D6 — Harness change lands before the fail-first run.** `startServer` gains an optional
parameter whose `configLayer(tmpDir)` returns a partial user-layer object. The client
builds the layer as a shallow merge over its default object
(`{...defaultLayer, ...configLayer(tmpDir)}`), so `kb: null` replaces the default `kb`
block and validation skips it (`src/config.ts:129-152,877`; `src/index.ts:2600-2602`).
The caller receives `tmpDir` so a test can create the unopenable `storage_path` file and
return `{ kb: { storage_path: file } }`. This is test infrastructure only; it changes no
server behavior and is committed with the tests.

## Blast radius

| File | Change | Size |
|---|---|---|
| `debate-club/src/client.ts` (`:59-77`) | `startServer(options?: { configLayer?: (tmpDir: string) => Record<string, unknown> })` with shallow-merge semantics; default layer unchanged | S |
| `src/kb.ts` (`:851-862`) | Parameterize `slugify`'s fallback; add and export `resolveTextIdentity(title): string` | S |
| `src/index.ts` (`:2236-2243`) | Resolve ingest identity from `url` → `source_url` → synthesized; call `resolveTextIdentity` for anonymous non-report text | S |
| `src/tool-surface.test.ts` | New schema-contract test: `manage_kb.max_results` default 8, min 1, max 50 (bounds only if the serialized schema exposes them — see Step 0.3) | S |
| `src/kb.test.ts` | Unit test for `resolveTextIdentity`: spaces/punctuation slug, same-title stability, punctuation-only fallback `text://note` | S |
| `debate-club/src/kb-contract.test.ts` (new) | Arena contract tests for A-1/A-2/A-3 | M |
| `CHANGELOG.md` | One `2026.11.7` entry covering the behavior changes | S |
| `ROADMAP.md` (`:17-23`) | Retire the section; leave the other R6 sections | S |
| `docs/plans/2026-11-09-full-review-sweep/worklist.md` | Mark F-R6-A-1/2/3 `Resolved` | S |
| `docs/plans/2026-11-10-r6-a-contract-remediation/{plan,tasks,aar}.md` | Increment record | S |

No new parameter, action, or tool is added, so `check-intent-citations` routing files
need no edit; Step 0 confirms that before any change.

## Implementation steps

**Step 0 — Surface probes (read-only).**
1. `npm run check-intent-citations` — confirm the action set and parameter enum already
   cover `max_results`/ingest; record that no routing edit is needed.
2. Grep sibling REQs for the ingest identity contract: REQ-060b (text or URL), REQ-060e
   (distinct entries), REQ-060f (get by source URL), REQ-072 (same-source replacement),
   REQ-060i (report identity). Confirm none conflicts with D1/D2.
3. Probe the serialized schema: start nothing; inspect `listTools()` output for
   `manage_kb.max_results` and record whether `minimum`/`maximum` survive zod→JSON-Schema.
   If they do not, the schema test asserts `default === 8` plus the behavior cap, and
   Step 1 records the omission instead of inventing a second introspection path.

**Step 1 — Tests and harness first.**
1. **1.0 Harness (D6).** Modify `debate-club/src/client.ts` for the optional
   `configLayer` hook; keep the current default object byte-identical. Confirm
   `npx tsc -p debate-club/tsconfig.json` passes.
2. `src/tool-surface.test.ts`: new test tagged `// @implements REQ-060 REQ-060a` reading
   `listTools()` and asserting `props.max_results.default === 8`, `minimum === 1`,
   `maximum === 50` (bounds subject to Step 0.3), and that the tool description still
   states the default.
3. `src/kb.test.ts`: `resolveTextIdentity` returns `text://` + a non-empty slug for
   titles with spaces/punctuation, reuses the same slug for the same title, and returns
   `text://note` for a punctuation-only title.
4. `debate-club/src/kb-contract.test.ts`, tagged
   `// @implements REQ-060 REQ-060a REQ-060b REQ-060e REQ-060f REQ-060g`:
   - **A-2 preserved identity:** ingest text with `source_url` (collection
     `arena-contract`); assert `results[0].url` equals it, `get` by that identity returns
     the text, and `list` filtered to the collection returns exactly one entry with
     `chunk_count === chunks_ingested`.
   - **A-2 synthesized identity:** ingest title-only text without `source_url`; assert
     the returned identity matches `text://<slug>` and `list` yields one entry, not one
     per chunk.
   - **A-2 report identity:** ingest report text with `source_url` and a minimal receipt;
     assert `report_id` equals the supplied URL and `verify_report` with it succeeds
     (proves receipt and report share the identity).
   - **A-1 max-results behavior:** ingest 12 one-chunk documents into `arena-cap`;
     `search` with `max_results: 3` returns exactly 3, omitting it returns ≤ 8, and
     `max_results: 50` is accepted.
   - **A-1 unconfigured KB:** start a server whose user layer sets `kb: null`; any
     `manage_kb` action returns `[ERROR]` with `code: "config_error"`, a non-empty
     remediation, and no `results`.
   - **A-1 unopenable store:** start a server whose `kb.storage_path` is a regular file;
     `list` returns `[ERROR]` `config_error` with a message matching
     `/could not be opened/` and a non-empty remediation; `encryption` (status) still
     answers `[OK]` per REQ-060g's reachability rule.
   - **A-3 refusals:** receipt with `source_type: "explicit"` → `invalid_input`; report
     with `save_to: "disk"` and a receipt → `receipt_requires_kb`; missing text and url
     → `invalid_input`; assert no chunk was written for each refusal.
5. **Fail-first run.** With `client.ts` and the tests in place but `src/index.ts`
   unchanged, run the Arena file and `src/kb.test.ts`. Expected: the A-2 identity legs
   fail on the returned/listed identity; `src/kb.test.ts` fails at module load because
   `resolveTextIdentity` does not yet exist; the A-1 and A-3 legs pass (pinning tests).
   Record the exact failures in `tasks.md`. This is the regression evidence — the
   harness change is explicitly in place first, so a failure cannot be a harness artifact.

**Step 2 — Fix.**
1. `src/kb.ts`: parameterize `slugify(title, fallback = "report")`; export
   `resolveTextIdentity(title)` → `text://${slugify(title, "note")}`.
2. `src/index.ts`: replace the `else if (!url)` overwrite with a single identity
   resolution — `url` wins, then `source_url`, then `resolveReportIdentity` for reports
   or `resolveTextIdentity` for other text. Leave the `dest.disk` `file://` override
   unchanged (out of scope; see Out of scope).

**Step 3 — Docs and close.**
1. CHANGELOG entry under `## 2026.11.7` describing (a) text-only ingest keeping
   `source_url`/a stable text identity and (b) the new handler-level contract tests; name
   REQ-060, REQ-060a, REQ-060b.
2. Retire the roadmap section (27 work items → 26; `## Non-goals` is not a work item) and
   mark the three register rows `Resolved` in place.
3. Write `plan.md` (this text, post-review stamp), `tasks.md` (with the pre-fix failure
   evidence), and `aar.md` ending `LOOP PAUSED`.
4. Run `npm run session:close` (validates loop artifacts, runs `check:fast`, prints
   cadence; does not commit).

## Verification

| Check | Command | Expected |
|---|---|---|
| Harness typecheck | `npx tsc -p debate-club/tsconfig.json` | PASS after Step 1.0 |
| Regression proof | Arena + `src/kb.test.ts` before Step 2 | A-2 identity legs fail; A-1/A-3 pass; recorded |
| Unit | `npx vitest run src/tool-surface.test.ts src/kb.test.ts` | PASS after Step 2 |
| Arena | `npm run test-debate-club` | PASS (existing 3 files + 1 new) |
| Fast gates | `npm run check:fast` | PASS |
| Full gates | `npm run check` | PASS (22 gates; audit needs network) |
| Roadmap/loop | `npm run check-roadmap`, `npm run check-loop-artifacts` | PASS (also inside fast) |
| Spec | `npm run validate-spec` | PASS, citation present for REQ-060/060a/060b |

## Commit series

1. `fix(kb): keep the caller source identity on text-only ingest` —
   `src/index.ts`, `src/kb.ts`, `src/tool-surface.test.ts`, `src/kb.test.ts`,
   `debate-club/src/client.ts`, `debate-club/src/kb-contract.test.ts`.
   Gate: `npm run typecheck` + `npx tsc -p debate-club/tsconfig.json` + the two vitest
   files + `npm run test-debate-club`.
2. `docs(kb): resolve the F-R6-A contract findings and record the increment` —
   `CHANGELOG.md`, `ROADMAP.md`, `worklist.md`, the increment record.
   Gate: `npm run check:fast`, then full `npm run check` on the final tree.

## Edge cases and rollback

- `source_url: ""` is treated as absent (falsy), consistent with the existing `url` check.
- Both `url` and `source_url` present: the fetched URL wins (current behavior preserved).
- Report text-only with `source_url` now stores under that identity instead of
  `report://<slug>`; the receipt is keyed by the same `finalUrl`, so `verify_report` stays
  consistent (asserted by the A-2 report leg). Consequence: the report no longer
  participates in the prefix-scoped meaning-equivalence dedup (`src/kb.ts:604-621`);
  recorded here rather than fixed, since F-R6-B-5 owns that path.
- Documents already stored with `source_url: ""` keep fragmenting in `list`; no
  migration is attempted (out of scope, and the store is user-local).
- A punctuation-only title maps to `text://note`, so two such titles share an identity
  and the second replaces the first; callers needing both supply `source_url`.
- Rollback: revert commit 1 for code/tests, commit 2 for docs; no persisted state changes.

## Out of scope

- `save_to: "both"` still overrides the KB identity with the `file://` disk path.
- The config-layer "invalid KB block" contradiction (F-R6-B-4) and the other R6 sections.
- Migration or rekeying of existing empty-identity rows.

## Evidence

- `npm run check` PASS at `ad56707` (this session, un-piped, 52.1 s).
- Lines cited above read this session: `src/index.ts:1994,2058-2059,2185-2186,2221-2227,2236-2243,2290`;
  `src/kb.ts:390-424,730,851-862,604-621`; `src/tool-surface.test.ts:187-210`;
  `debate-club/src/client.ts:59-77`; `src/config.test.ts:605-625`.
- `src/tool-surface.test.ts:187-210` is the `search_web` schema test; its presence is the
  evidence that no `manage_kb` equivalent exists.
- Preflight sidecar: generated after the plan is stamped.
