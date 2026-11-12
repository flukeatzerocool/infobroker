# Plan — R7 monitoring and watchlist remediation

**Status:** revision 2, plan gate passed, awaiting user approval · **Date:** 2026-11-12 · **Depth:** standard (two libraries, one new library module, two CLI entry points, five test files, one fixture, two REQ bodies; no destructive, credential, publish, or schema-migration surface)
**Review independence:** fresh — one cold pass (`independent-review`, artifact `/tmp/opencode/r7-monitoring-cold-review.md`, sha256 `d2ae102a…015f`, 5 stages, 28/40 reads) returned `FAILED` with 3 Blockers / 4 Majors / 6 Minors / 4 Nits; every one is resolved in this revision, and the targeted diff re-review (`/tmp/opencode/r7-monitoring-diff-rereview.md`, 9/10 reads) returned `independent-review passed.` with two bookkeeping nits and one provenance nit, all applied here. The cold reviewer's own note: all five stages ran in a single fresh context because it could not nest subagents, so independence is weaker than the skill's per-stage contract; it never saw the authoring context.
**Rollback cost:** 1 — additive fields on a pure delta, a receipt-backed CLI mode behind a new flag, and one new library module; `git revert` of the commit series restores the prior scripts with no state or config migration.
**Roadmap item:** `ROADMAP.md` § R7 monitoring and watchlist remediation (`ROADMAP.md:17-23`); removed from `ROADMAP.md` and folded into `CHANGELOG.md` when this increment closes.
**Predecessor:** version 2026.11.11 (latest tag `v2026.11.07`); 124 unpushed commits, oldest 3.0 d; 13 open roadmap items; `HEAD` `ec7d337`, clean tree.

## Why this section

`ROADMAP.md` § R7 monitoring and watchlist remediation is the first open section in
the file, and the ordering rule is top section first. Its trigger — "start after
chunk R8 closes" — is satisfied: the sweep status board records R8 **closed
2026-11-10** (`docs/plans/2026-11-09-full-review-sweep/worklist.md:602`). The four
remaining R7 sections carry the same trigger (`ROADMAP.md:25-51`); file order puts
this one first.

Two of the six findings are headline gaps in the contract the documentation already
states. `README.md:361-368` tells users "monitoring can baseline, revalidate, and
publish a delta revision", and `DECISIONS.md:849-856` (D-063) says `monitor-watchlist`
"calls the local MCP server over stdio and writes one claim-delta record per topic",
but the comparison engine (`src/lib/report-delta.ts`) is a byte-free Markdown diff
with no receipt, no `verify_report`, and no source drift. REQ-117 (`infobroker.md:488-489`)
requires a receipt baseline, `verify_report` revalidation before comparing, source
drift and unverifiable sources surfaced rather than treated as unchanged, and a
revision/supersedes chain on the delta. The REQ does not say what a comparison
without a receipt is, and the implementation cannot do the receipted path at all;
this increment implements the receipted path and makes the receiptless path a
stated, visible mode rather than an unstated default (see B2 in the cold review and
T15).

The other four findings are lifecycle defects in the runner: the run record is
overwritten unconditionally (`scripts/monitor-watchlist.ts:160`), `last_run` is read
(`src/lib/watchlist.ts:41`) but never written, so a due topic is reselected on every
invocation, and the dry-run and per-topic error-isolation paths have no assertion.
The runner has no test for its control flow at all — only its response parser
(`scripts/monitor-watchlist.test.ts`).

## Baseline (verified this session)

- `npm run status` → version 2026.11.11 (latest tag `v2026.11.07`), **124 unpushed
  commits, oldest 3.0 d**, 13 open roadmap items.
- `npm run check` → **PASS, full, 155.8 s, exit 0** at `ec7d337` (`gates: recorded
  full run for ec7d33797c60`): `vitest` 119 files / 1408 tests, `test-debate-club`
  8 files / 61 tests, `check-pack` 370 files, `check-gate-table` 22 gates,
  `check-gate-coverage` 117/118 G1 cited (1 exempt), `check-report-fixtures` 25
  fixtures / 0 violations. The tree was clean, so this is a true green baseline.
- **Expected red once this directory exists.** `docs/plans/**` is gate-scanned and
  `check-loop-artifacts` requires `plan.md`, `tasks.md`, and a terminal-token
  `aar.md`; until T1 writes the last two, `npm run check` fails at that gate for a
  self-inflicted reason. That is expected and is not a tree defect. This baseline is
  claimed **green at `ec7d337`, before the directory existed** — do not re-take it
  after T1 and call it green.

## Predicates re-verified by reading the code this session

| Claim | Evidence | Verdict |
|---|---|---|
| `monitor-delta` never calls the server | `scripts/monitor-delta.ts` imports `readFileSync`/`handleHelp` only; no MCP client import | Confirmed — F-R7-E-1 |
| Snapshot sources are id strings only | `src/lib/report-delta.ts:34` stores `parseSourceRegister(text).sources.keys()` | Confirmed — F-R7-E-2 |
| Source diff is set membership | `src/lib/report-delta.ts:76-84` builds `Set` of ids and filters | Confirmed — same-id URL drift is invisible |
| The delta carries no revision/supersedes | `ReportDelta` (`:9-17`) and `ReportSnapshot` (`:19-22`) have no such field; `readSnapshot` drops `manifest.value` | Confirmed — F-R7-E-3 |
| Manifests do carry revision/supersedes | `ReportManifest` (`src/lib/report-manifest.ts:38-52`); `validateReport` rejects `revision > 1` without `supersedes` (`:298-303`) | Confirmed — the parse step discards them |
| `verify_report` returns deterministic verification fields | `ReportVerificationResult` (`src/types.ts:456-483`): `state`, `digest_match`, `report`, `revision`, `supersedes`, `sources.details[]`, `claims` (a **count**) | Confirmed — the delta can carry them |
| `verify_report` also returns clock-derived fields | `age_days`, `stale`, `created_at` computed from `Date.now()` (`src/kb.ts:1130-1145`) | Confirmed — must be dropped for deterministic output |
| The `verify_report` envelope is `[OK] {results:[verification]}` | `src/index.ts:2479-2502`; the error branch is `[ERROR] {code,message,remediation}` | Confirmed — a parser mirrors `parseVerifyEnvelope` |
| The stored report text cannot be re-parsed | `kbGet` joins chunk texts with `"\n"` (`src/kb.ts:845-865`); `chunkText` trims each chunk, prefixes the title, and overlaps windows (`src/kb.ts:264-300`) | Confirmed — a stored-text baseline is unworkable (alternative A) |
| `content_sha256` cannot bridge a local file | The receipt hash covers the canonical **stored** document (`src/index.ts:2418-2420` comment; `verifyReceipt` compares `sha256Hex(reportText)` at `src/kb-receipt.ts:359-363`) | Confirmed — no byte-level file↔receipt bridge (alternative B) |
| The receipt's claim texts are not exposed | `verify_report` returns `claims: number` only (`src/types.ts:471`); the manifest itself is not on the tool surface | Confirmed — only a count-level identity check is available |
| Trimmed dry-run return and per-topic isolation exist today | dry-run/empty early return `scripts/monitor-watchlist.ts:117-122`; per-topic `try`/`catch` `:144-159` | Confirmed — behavior exists, no assertion (F-R7-E-5; the finding's `:95-100` line refs predate a later edit) |
| The run record overwrites unconditionally | `writeFileSync(recordPath, …)` at `scripts/monitor-watchlist.ts:160`, outside any retention branch; `previousClaims` (`:73-81,136`) feeds only the delta | Confirmed — F-R7-E-6 |
| `last_run` has no writer | `dueTopics` reads it (`src/lib/watchlist.ts:39-46`); `grep -rn "last_run" src scripts` shows no assignment outside the test | Confirmed — F-R7-E-7 |
| `parseSourceRegister` is called from two sites | `src/lib/report-delta.ts:34` and `src/lib/report-manifest.ts:669` | Confirmed — an additive return field is cheap |
| Monitor entry points are scripts, not MCP tools | `package.json:85-86`; neither name appears in the tool registration | Confirmed — no tool-surface, intent-citation, or README §MCP change |
| `dist/` is not tracked | `git ls-files dist` → 0 files | Confirmed — no build artifact to regenerate |

## Alternatives considered

- **A — baseline from the stored report text (`manage_kb action=get`).** Rejected:
  `get` reassembles chunk text with a title prefix, per-chunk trimming, and overlap
  (`src/kb.ts:845-865,264-300`), so the Store Register tables and manifest fence
  cannot be re-parsed reliably. The baseline artifact must stay the local Markdown
  file.
- **B — prove the baseline file with a hash bridge (`sha256(file) === content_sha256`).**
  Rejected: `content_sha256` covers the canonical stored document, not the ingested
  bytes (`src/index.ts:2418-2420`), so the comparison would fail on any report whose
  chunking differs from the file. A false-negative gate is worse than a weak check.
- **C — expose the receipt manifest on the tool surface** (new `manage_kb` action or
  extra `verify_report` fields) so the delta can match claim texts exactly. Rejected:
  REQ-060i enumerates the response fields, so this needs a REQ edit, an intent-citation
  and README pass, and a thesaurus of test updates for one evidence improvement. The
  count-level identity check (below) catches the stale-baseline case the finding
  names.
- **D — keep the pure diff and narrow REQ-117 to "a delta exists".** Rejected: the
  roadmap bullet says implement, and README already promises baseline/revalidate/
  publish. Narrowing the spec would make the README lie.
- **E — make `--receipt` mandatory.** Rejected: `monitor-delta` is also the offline
  comparator for two local drafts, and a receipt cannot exist for a draft that was
  never ingested. Instead a receiptless run is explicit and visible — it stamps
  `"baseline_verified": false` plus a `baseline_unverified` note into the output and
  warns on stderr — and REQ-117 is amended so the revalidation clause is conditional
  on a baseline that carries a receipt. Without that amendment the optional flag
  would leave a live normative SHALL unmet (cold-review B2).
- **F — chosen design.** `monitor-delta --receipt <report-id>` revalidates the
  baseline with `verify_report` before comparing, requires `digest_match`,
  `report: "verified"`, and a claim-count match against the baseline snapshot,
  then attaches a deterministic verification block (state, receipt revision,
  supersedes, drift URLs, unverifiable URLs, report-level counts) to the delta.
  Register-level drift stays a pure file comparison in the library. The watchlist
  runner keeps its own record lifecycle, extracted into a testable module.

## Blast radius

| File | Change | Size |
|---|---|---|
| `src/lib/report-manifest.ts` | `parseSourceRegister` returns an additive `rows: Map<string, {url, reliability, credibility}>` beside the unchanged `sources` map; both call sites compile untouched | S |
| `src/lib/report-delta.ts` | `SourceRow` type; `ReportSnapshot` gains `sources: SourceRow[]`, `revision?`, `supersedes?` and reads them in `readSnapshot`; `ReportDelta` gains `changed_sources`, `baseline_revision`, `current_revision`, `current_supersedes`; `diffReports` reports same-id URL/reliability/credibility drift; pure `successionIssues(delta, baselineId?)` returns the revision-contract problems | M |
| `src/lib/watchlist.ts` | new pure `markRun(watchlist, id, at): Watchlist` returning a copy with `last_run` set; `WatchTopic`/`Watchlist` unchanged in shape | S |
| `src/lib/watchlist-run.ts` (new) | `@implements REQ-125`; `runWatchlist({watchlist, watchlistPath, outDir, dryRun, callTool, now})` owning selection, the dry-run short-circuit, per-topic isolation, found-versus-retained claims, record writing, and the atomic `last_run` write-back; `RunRecord` moves here with its three new fields | M |
| `scripts/monitor-delta.ts` | new `--receipt <report-id>` (requires `--baseline`) and optional `--baseline-id <id>`; the `import.meta.url` entry guard it lacks today (cold-review B1), a pure exported `buildComparison(baseline, current, verification?)` and `comparisonVerdict(comparison, baselineId?)`, and an exported `parseVerifyReport`; refuses an unverified baseline; `comparisonVerdict` drives exit 1; usage, header role, and exit-code contract updated | M |
| `scripts/monitor-watchlist.ts` | argument/IO shell only: load, call `runWatchlist`, print; `parseVerifyEnvelope` stays exported for the existing test; `RunRecord` re-exported from the new module | M |
| `src/monitor-delta.test.ts` | new assertions: same-id URL drift, reliability drift, `baseline_revision`/`current_revision`/`current_supersedes`, succession issues, `changed_sources` on the fixture pair; clause tags | S |
| `src/lib/watchlist.test.ts` | `markRun` cases (sets `last_run`, copies, leaves siblings alone) | S |
| `src/lib/watchlist-run.test.ts` (new) | injected `callTool` stub and a `mkdtemp` out-dir: dry-run calls nothing and creates no directory; one failing topic does not abort the next; a failed run retains the prior claims; a successful claim-less run flags `suspected_empty` and does not restate claims on the next success; a non-empty run that drops a claim reports it removed; a second invocation selects nothing because `last_run` was written back | M |
| `scripts/monitor-delta.test.ts` (new) | `parseVerifyReport` mapping (`[OK]` verification, `[ERROR]`, non-JSON), `comparisonVerdict` refusals, a drifted source URL reaching `verification.source_drift`, and the deterministic field subset (a repeat-and-compare with two different clocks yields identical output) | S |
| `scripts/monitor-watchlist.test.ts` | unchanged in substance; keeps the `[ERROR]`-recording coverage and adds the claim-retention tag if it moves | S |
| `test-fixtures/reports/delta/current-drift.md` (new) | copy of `current.md` with `S1`'s URL and Reliability changed (same ids), so the fixture pair exercises id-stable drift | S |
| `infobroker.md` | REQ-117 gains the delta-records-verification clause; REQ-125 gains the `last_run` persistence and claim-retention clauses | S |
| `README.md` | the monitoring paragraph (`:361-368`) names the receipt-backed delta mode and the retention/write-back behavior | S |
| `docs/plans/2026-11-09-full-review-sweep/worklist.md` | six finding rows `F-R7-E-1/2/3/5/6/7` (`:838-852`) and the REQ-117/REQ-125 table rows (`:426-427`) → `Resolved 2026-11-12` with evidence | S |
| `ROADMAP.md` | remove § R7 monitoring and watchlist remediation | S |
| `CHANGELOG.md` | one section under `2026.11.11` | S |
| `docs/plans/2026-11-12-r7-monitoring-watchlist-remediation/` | `plan.md`, `tasks.md`, `aar.md` | S |

No tool schema, config, provider registry, dependency, gate definition, or
`dist/` change.

## Done bar

**Done bar:** every one of F-R7-E-1, E-2, E-3, E-5, E-6, and E-7 has a committed test
and a gate-visible behavior, and the delta cannot claim a baseline it did not
verify. Concretely:

1. `monitor-delta --receipt <id>` exits 1 with a named reason when the envelope is
   an error, `digest_match` is false, `report` is not `verified`, or the recorded
   claim count differs from the baseline snapshot; a receiptless run exits 0 but
   stamps `baseline_verified: false` with a `baseline_unverified` note and warns on
   stderr. Both paths are asserted through the exported pure seam, not through
   `main()`. The amended REQ-117 states the receipted obligation and the
   receiptless marking.
2. A same-id URL change and a same-id reliability change both appear in
   `changed_sources` with `url: a → b` / `reliability: A → B`; a verification
   object whose `sources.details[]` carries a drifted and an unverifiable URL puts
   both in `verification.source_drift` / `verification.unverifiable_sources`, and
   `verification.report_source_drift` carries the report-level counts.
3. `successionIssues` reports a changed report whose `current_revision` did not
   increase over `baseline_revision` and a `current_supersedes` that does not equal
   `--baseline-id`; the delta carries both revisions and the current supersedes;
   `monitor-delta` exits 1 on a non-empty issue list.
4. `runWatchlist` in dry-run mode calls no tool and creates no out-directory; a
   failing topic does not abort the next; a failed run keeps `claims` empty with
   `retained_claims` set and `carried_over: true`; a successful claim-less run sets
   `suspected_empty: true` without restating the retained claims as new on the next
   success; a non-empty run that drops a claim reports it as removed; a completed
   run writes `last_run` back so a second invocation selects nothing. A recorded
   CLI transcript shows `scripts/monitor-watchlist.ts --dry-run` creates no
   out-directory and exits 0.
5. The verification block is deterministic: a repeat-and-compare run under two
   different clocks produces byte-identical JSON (no `age_days`, `stale`, or
   `created_at`).
6. `npx vitest run src/monitor-delta.test.ts src/lib/watchlist.test.ts src/lib/watchlist-run.test.ts scripts/monitor-delta.test.ts scripts/monitor-watchlist.test.ts`,
   `npm run typecheck`, `npm run typecheck:scripts`, `npm run validate-spec`,
   `npm run check-roadmap`, `npm run check-script-discipline`,
   `npm run check-report-fixtures`, and `npm run validate-readme` are green on the
   final tree; `npm run check` is green **after** `aar.md` carries its terminal
   token.
7. The six finding rows and the two REQ table rows read `Resolved 2026-11-12` with
   file:line evidence, the roadmap section is gone, the CHANGELOG carries one
   section, and the AAR ends `LOOP PAUSED` with the review cap recorded.

## Review-loop cap (recorded, not judged at run time)

Per `ROADMAP.md` § Review-loop convergence, the cap is stated here: **one cold pass
at standard depth, plus at most one targeted diff re-review of the lines that
changed.** Both are now spent (see Review independence), and no second full pass
will run; any unresolved item is escalated to the user rather than re-scoped. If a cold-pass blocker sits inside one finding's evidence, the revision
narrows to that finding instead of re-scoping the combined increment. This
increment records the cap and, like the three prior increments, leaves § Review-loop
convergence open — retiring it is a user decision after the AAR.

## Phases and steps

### Phase 0 — Scaffold and baseline

- **T0.** Record in `tasks.md`: the `npm run status` block, the green `npm run
  check` result above with its tree key, the `check-report-fixtures` file count (25;
  `scripts/check-report-fixtures.ts:56` reads the directory non-recursively, so the
  new `delta/current-drift.md` stays outside that gate), and the two static red
  proofs for E-6/E-7 (`grep` showing the unconditional record write and the absence
  of a `last_run` writer).
- **T1.** Create `tasks.md` (this step list) and `aar.md` seeded `LOOP OPEN`, so
  `check-loop-artifacts` is satisfiable from the first gate run onward.

### Phase 1 — Delta library (F-R7-E-2, F-R7-E-3)

- **T2.** Add `test-fixtures/reports/delta/current-drift.md`: copy of `current.md`
  with `S1`'s register URL changed to `https://example.com/one-moved`, its
  Reliability changed to `B`, and the matching `[S1]` bullet in `## Evidence &
  Sources` changed to the same URL, ids unchanged, so the only delta is one changed
  source. It must still validate; `readSnapshot` throws otherwise, so the fixture
  is proven before the parser changes.
- **T3 — red.** Extend `src/monitor-delta.test.ts` with assertions for
  `changed_sources` (URL and reliability drift on the fixture pair),
  `baseline_revision` / `current_revision` / `current_supersedes`, and
  `successionIssues`, including the un-incremented-revision case. Run
  `npx vitest run src/monitor-delta.test.ts` → expect failures on the missing
  fields/helper (not an ENOENT). Record the transcript in `tasks.md`.
- **T4.** In `src/lib/report-manifest.ts`, extend `parseSourceRegister` with the
  additive `rows` map (url, reliability, credibility) built from the same cells it
  already reads; leave `sources` and every finding code untouched.
- **T5.** In `src/lib/report-delta.ts`: `SourceRow`, the `sources`/`revision`/
  `supersedes` snapshot fields read from `extractManifest`, `changed_sources` in
  `diffReports` (compare by id; emit `url:`, `reliability:`, `credibility:` change
  strings in a stable order), `baseline_revision`/`current_revision`/
  `current_supersedes` on the delta, and `successionIssues(delta, baselineId?)`
  reporting `revision-not-incremented` when claims or sources changed without
  `current_revision > baseline_revision`, and `supersedes-mismatch` when
  `baselineId` is given and `current_supersedes !== baselineId`. Keys of
  `new_sources`/`removed_sources` stay ids so the existing assertions hold.
- **T6.** Re-run the two delta test files; expect green. Record the red→green pair.

### Phase 2 — Receipt-backed delta (F-R7-E-1)

- **T7.** In `scripts/monitor-delta.ts` add the `import.meta.url ===
  pathToFileURL(process.argv[1]).href` entry guard (`scripts/monitor-watchlist.ts:172-177`
  is the model; the file currently calls `main()` unconditionally at `:80`, so
  importing it from a test would `process.exit(2)`), then `--receipt <report-id>`
  (requires `--baseline`) and optional `--baseline-id <id>` defaulting to the
  receipt id. Export `parseVerifyReport(text)` returning
  `{ok: true, verification} | {ok: false, error}` over the
  `[OK] {results:[…]}` / `[ERROR] {…}` envelopes, mirroring `parseVerifyEnvelope`
  (`scripts/monitor-watchlist.ts:51-71`). Spawn the server with the same
  `StdioClientTransport` pattern as `monitor-watchlist` (`:125-131`), call
  `infobroker_manage_kb {action:"verify_report", source_url: receipt}`, and refuse
  (exit 1, named reason on stderr) when: the envelope is an error, `digest_match`
  is not `true`, `report` is not `"verified"`, or `verification.claims` differs from
  the baseline snapshot's claim count.
- **T8.** Attach the deterministic verification block:
  `verification: {state, digest_match, report_revision, report_supersedes,
  source_drift: string[], unverifiable_sources: string[],
  report_source_drift: {total, drift, unverifiable}}`. `source_drift` and
  `unverifiable_sources` come from `sources.details[]` (deduped URLs, sorted);
  `report_source_drift` carries the report-level counts, which REQ-060i exposes as
  counts only (`src/types.ts:479-485`) — the per-URL list is unavailable for that
  limb and the AAR records the limitation. Explicitly **not** `age_days`, `stale`,
  or `created_at`. Export a pure `buildComparison(baseline, current, verification?)`
  that assembles the diff, the block, and `baseline_verified` (true only when a
  verification is present) so done-bar 1 has a testable seam; a run without
  `--receipt` produces `baseline_verified: false` plus `baseline_unverified: "no
  receipt supplied; the baseline was not revalidated"` and one stderr warning.
- **T9.** Print the new fields in text mode (changed sources, verification line,
  revisions/supersedes), and consult the exported pure
  `comparisonVerdict(comparison, baselineId?)` — which combines `successionIssues`
  with the refusal set — exiting 1 with each issue on stderr when non-empty. Update
  the file header (role, exit-code contract) and `USAGE`;
  `npm run check-script-discipline` must stay green.
- **T10.** Add `scripts/monitor-delta.test.ts`: envelope mapping (verification,
  `[ERROR]`, non-JSON), `comparisonVerdict` refusals (digest mismatch, not verified,
  claim-count mismatch, revision issue), a drifted URL and an unverifiable URL
  reaching the block's lists, and the determinism check (`buildComparison` twice
  with different clock inputs; byte-identical JSON). Run it.

### Phase 3 — Watchlist runner lifecycle (F-R7-E-5, F-R7-E-6, F-R7-E-7)

- **T11.** In `src/lib/watchlist.ts` add `markRun(watchlist, id, at)` (pure copy with
  `last_run`). Test it in `src/lib/watchlist.test.ts`.
- **T12.** Create `src/lib/watchlist-run.ts` with `@implements REQ-125`:
  `runWatchlist` selects due topics via `dueTopics(…, now)`, returns immediately on
  `dryRun` (no tool call, no `mkdirSync`), then for each topic reads the prior
  record, calls the injected `callTool`, builds the record, writes it with mode
  0600, and finally rewrites the watchlist file through `atomicWriteFile(path,
  Buffer.from(json), 0o600)` (`src/lib/atomic-write.ts:20`) with every attempted
  topic's `last_run` set, preserving unknown topic fields.
  Record semantics (found vs retained): a **failed** run keeps `claims: []`,
  `retained_claims: prior`, `carried_over: true`, `status: "error"`, an empty
  `delta`, and the prior `last_success_at` (omitted when the prior record predates
  the field — no migration, the field is optional); a **successful claim-less** run
  keeps `claims: []`, `retained_claims: prior`, `carried_over: true`,
  `suspected_empty: true`, and diffs nothing; a **successful non-empty** run sets
  `claims`, clears `retained_claims`, sets `last_success_at = ran_at`, and computes
  `diffClaims(effectivePrior, claims)` where `effectivePrior` is the prior
  `claims` when non-empty else the prior `retained_claims` — so a recovery does not
  restate retained claims as new, and a genuine removal inside a non-empty result
  is still reported as removed.
  Ownership: the runner owns only `last_run` in the watchlist file; it rewrites the
  file atomically, which means last-writer-wins under concurrent invocations (cron
  or CI must not overlap), and a scheduler that regenerates the file discards
  `last_run` — that is the scheduler's contract, not hidden state kept elsewhere.
  No in-repo consumer reads the record JSON (`grep` shows only the script), so the
  three new fields are additive for existing records.
- **T13.** Reduce `scripts/monitor-watchlist.ts` to argument parsing, file loading,
  `runWatchlist`, and output; keep `parseVerifyEnvelope` exported and re-export
  `RunRecord`. Update the header and `USAGE` exit-code contract.
- **T14.** Write `src/lib/watchlist-run.test.ts` with a stub `callTool` and a
  `mkdtemp` directory: dry-run (no calls, no directory), error isolation (topic 1
  throws, topic 2 records), failed-run retention, claim-less `suspected_empty` then
  no restatement on recovery, a genuine removal reported from a non-empty result,
  and `last_run` write-back (second invocation selects nothing). The first run of
  this file is a legitimate red — the module does not exist, so the import fails —
  and that transcript is recorded; the T0 static proof remains the evidence for the
  behavior gap itself.
- **T14b.** Record a network-free CLI transcript against a temp watchlist and a
  fresh `--out` directory under an isolated config: `--dry-run` exits 0, prints the
  due id, and creates no out-directory. This is the only check of the entry-point
  wiring (T13) that does not spawn a provider call.

### Phase 4 — Spec, docs, bookkeeping

- **T15.** Amend REQ-117 in two places. Rewrite the opening sentence so the
  revalidation duty attaches to a baseline that carries a receipt and the
  receiptless case is marked unverified (`A monitoring run SHALL revalidate a
  baseline report that carries a verification receipt with \`verify_report\` before
  comparing, and SHALL mark a baseline without a receipt as unverified.`). Add a
  final sentence: `The delta SHALL record the baseline's verification outcome, the
  compared revisions, and whether the current report supersedes the baseline.`
  Drafted body: 654 chars, 7 SHALL, 1 backtick token (current 494 chars / 6 SHALL /
  1 backtick); the sentence count depends on the splitter (4 by a naive `[.!?] `
  split, 5 by the draft's own), so record the gate's number at this step in
  `tasks.md` rather than trusting either. This is what closes cold-review B2:
  without the rewrite the optional `--receipt` flag would leave a live normative
  SHALL unmet.
- **T16.** Append two sentences to REQ-125: `The runner SHALL persist each completed
  attempt's run time so the next invocation advances due selection.` and `The runner
  SHALL preserve a topic's last known claims when a run fails or returns no claims,
  and SHALL report an empty result separately from a retained one.` Drafted body:
  697 chars, 7 SHALL, 0 backticks (current 450 chars / 4 SHALL / 0 backticks); the
  sentence count is 4 naive, 6 drafted, and the gate's number is recorded at this
  step.
- **T17.** Add clause tags in the test files, one per newly asserted branch:
  `@implements REQ-117 verified-baseline`, `REQ-117 baseline-unverified`,
  `REQ-117 source-drift`, `REQ-117 unverifiable-sources`,
  `REQ-117 revision-supersedes`, `REQ-125 dry-run`, `REQ-125 error-isolation`,
  `REQ-125 claim-retention`, `REQ-125 empty-result`, `REQ-125
  last-run-persistence`. Run `npm run validate-spec`.
- **T18.** Update the README monitoring paragraph (`README.md:361-368`) to name the
  receipt-backed delta mode, the explicit unverified marking, and the retention and
  `last_run` behavior, inside the existing word budget. Run `npm run validate-readme`.
- **T19.** Update the six finding rows and the REQ-117/REQ-125 table rows in
  `docs/plans/2026-11-09-full-review-sweep/worklist.md` to
  `Resolved 2026-11-12` with file:line evidence. For F-R7-E-2 the evidence names the
  URL and grade drift in the delta and states the narrowing explicitly: hash drift
  is surfaced through `verify_report`, whose report-level source limb exposes counts
  only (REQ-060i's response shape), so no per-URL report-level list is claimed.
- **T20.** Remove § R7 monitoring and watchlist remediation from `ROADMAP.md`;
  `npm run check-roadmap` → OK.
- **T21.** Add the CHANGELOG section under `2026.11.11` (the version-sync gate pins
  the top date to `package.json`; do not invent a date).

### Phase 5 — Gates and close

- **T22.** `npm run typecheck`, `npm run typecheck:scripts`, `npm run validate-spec`,
  `npm run validate-readme`, `npm run check-roadmap`, `npm run
  check-script-discipline`, `npm run check-report-fixtures`, and the five test files
  above.
- **T23.** Rewrite `aar.md` with dispositions, the review cap, and the terminal
  `LOOP PAUSED` / `LOOP OPEN` token; `npm run session:close`.
- **T24.** `npm run check-loop-artifacts`, then `npm run check` on the final tree
  (full suite, exit status recorded).

## Verification plan

| Step | Gate | Satisfiability evidence |
|---|---|---|
| Delta drift/succession (E-2, E-3) | `npx vitest run src/monitor-delta.test.ts` | fields are additive on a pure function; `current-drift.md` is cut from a fixture pair that validates today |
| Receipt refusal + determinism (E-1) | `npx vitest run scripts/monitor-delta.test.ts` | `parseVerifyReport`/`buildComparison`/`comparisonVerdict` are pure and importable once T7 adds the entry guard; the envelope shape is read from `src/index.ts:2479-2502` |
| Runner lifecycle (E-5, E-6, E-7) | `npx vitest run src/lib/watchlist-run.test.ts` | the module takes an injected `callTool` and `now`, so no server or clock is needed |
| CLI wiring (E-5) | recorded T14b transcript | dry-run is network-free and creates no directory |
| Script discipline (both CLIs) | `npm run check-script-discipline` | header role and exit-code contract are edited with the flags (T9, T13) |
| Spec traceability | `npm run validate-spec` | new tags are additive; both amended bodies fit Appendix B (654 and 697 chars) |
| README truth | `npm run validate-readme` | the paragraph is edited in the same commit as the behavior |
| Bookkeeping | `check-roadmap`, `check-loop-artifacts` | section removal + terminal AAR token |
| Whole-tree health | `npm run check` after T23 | 22 gates sequential; the only expected baseline red is the AAR T23 writes |

## Edge cases and rollback

- **A receiptless run is not silently verified.** `baseline_verified: false` plus a
  `baseline_unverified` note and a stderr warning; exit stays 0 because a local
  two-draft comparison is legitimate, and the amended REQ-117 says so.
- **Count mismatch is a weak identity check.** Receipt claim texts are not on the
  tool surface (alternative C), so a baseline file with the same claim count but
  different text passes this check; the delta still marks the run verified because
  the *stored* report verified. This limitation is stated in the AAR, not hidden.
- **Report-level source drift is count-only.** `verify_report` exposes
  `report_sources` as counts (`src/types.ts:479-485`), so the block carries
  `report_source_drift` counts and only per-claim URLs reach `source_drift`. F-R7-E-2's
  hash limb is closed through `verify_report`, and its worklist evidence states the
  narrowing rather than claiming a per-URL report-level list.
- **Zero-claim receipt.** A stored report with no claims verifies with `claims: 0`;
  the check compares against the snapshot count, so two zeros match and the run
  proceeds. The delta is then claim-free, which is honest.
- **Genuinely empty watch result.** A successful claim-less run is reported as
  `suspected_empty: true` with the prior claims retained, not as "all claims
  removed", because zero findings is indistinguishable from a degraded provider
  (the F-R7-E-4 neighborhood). A genuine removal inside a non-empty result is still
  reported as removed; the ambiguity only covers the transition to zero.
- **Ownership and concurrency of `last_run`.** The runner owns only the `last_run`
  field and rewrites the file atomically (0600). Two overlapping invocations are
  last-writer-wins, so cron/CI must not overlap; a scheduler that regenerates the
  watchlist discards `last_run`, which is its contract and not hidden runner state.
  No in-repo consumer reads the record JSON, so the three new fields are additive.
- **Server failure in `--receipt` mode.** A spawn/connect failure is fatal (exit 2),
  never a silent downgrade to a receiptless comparison.
- **Clock-derived fields.** `age_days`, `stale`, and `created_at` are dropped; the
  determinism test would fail if a later edit leaks them back in.
- **`last_run` write-back on a failed attempt.** The attempt advances the interval
  even when it errors, so a persistently broken topic is retried on its interval
  rather than on every invocation; the record's `status: "error"` keeps the failure
  visible. Recording the attempt is what REQ-125's added clause says.
- **Watchlist file unreadable or unwritable at write-back.** The runner reports the
  error and exits 1; run records already written are kept, since they are
  independent files.
- **Fixture drift copy fails validation.** `readSnapshot` throws on an invalid
  report, so T2 proves the fixture before the parser changes at T4.
- **Rollback.** Per commit: `git revert <sha>`. Phase 1 is additive (fields +
  fixture + tests); Phase 2 is behind a new flag plus an entry guard; Phase 3 moves
  code without changing the record format's meaning; Phase 4 is docs. No state,
  schema, or config is migrated.

## Commit series

Each commit is `typecheck`-clean and passes the gate it feeds. Order matches the
convention buckets in `AGENTS.md`.

1. `fix(report-delta)`: `parseSourceRegister` rows, snapshot sources/revision/
   supersedes, `changed_sources`, the named revision fields, `successionIssues`, the
   drift fixture, and the Phase 1 tests. Gate: `vitest run
   src/monitor-delta.test.ts`, `typecheck`.
2. `feat(monitoring)`: the `monitor-delta` entry guard, `--receipt`/`--baseline-id`,
   the verification parser and pure comparison seam, the deterministic block,
   exit-code and usage updates, and `scripts/monitor-delta.test.ts`. Gate: `vitest`,
   `check-script-discipline`.
3. `feat(monitoring)`: `markRun`, `src/lib/watchlist-run.ts`, the slimmed
   `monitor-watchlist`, `watchlist-run.test.ts`, and the T14b dry-run transcript
   recorded in `tasks.md`. Gate: `vitest`, `typecheck`, `check-script-discipline`.
4. `docs(spec)`: the REQ-117 amendment and the REQ-125 additions plus the clause
   tags. Gate: `validate-spec`.
5. `docs`: README paragraph, worklist dispositions, roadmap removal, CHANGELOG.
   Gate: `validate-readme`, `check-roadmap`, `version-sync`.
6. `docs(plans)`: this increment's `plan.md`, `tasks.md`, `aar.md`.
   Gate: `check-loop-artifacts`.

## Conditions to verify during execution

- **C-1** — `--receipt` is optional by design (alternative E) and REQ-117's amended
  opening sentence carries the receiptless obligation; the done bar holds only if
  the receiptless output stamps `baseline_verified: false` with the
  `baseline_unverified` note and warns.
- **C-2** — the verification block carries only the named deterministic fields
  (`state`, `digest_match`, `report_revision`, `report_supersedes`, `source_drift`,
  `unverifiable_sources`, `report_source_drift`); a repeat-and-compare under two
  clocks must be byte-identical.
- **C-3** — `parseSourceRegister`'s new `rows` field is additive; both existing call
  sites (`report-delta.ts:34`, `report-manifest.ts:669`) compile unchanged, and no
  finding code moves.
- **C-4** — `new_sources`/`removed_sources` stay id-keyed so the existing delta
  assertions and fixture pair keep their meaning; only `changed_sources` adds a new
  key.
- **C-5** — `check-loop-artifacts` is red from T1 until T23 writes the terminal AAR;
  that red is expected and is not a tree defect.
- **C-6** — the review cap: one cold pass, at most one diff re-review; at the cap any
  unresolved item is escalated to the user, never re-scoped.

## Unknowns

- Whether any gate pins the `monitor-delta` usage string verbatim — `grep -rn
  "monitor-delta" README.md scripts skills` shows only `package.json`, `README:361`,
  and `CHANGELOG`; T22's full run settles it.
- Whether the Appendix B counter agrees with the drafted REQ counts (654 chars / 7
  SHALL / 1 backtick for REQ-117; 697 / 7 / 0 for REQ-125) — T15/T16 re-count with
  the gate's own counter and record both numbers; both drafts sit well inside the
  800/8/8/5 limits either way.
