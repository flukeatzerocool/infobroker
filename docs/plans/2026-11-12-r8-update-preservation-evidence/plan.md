# Plan — R8 update-preservation evidence

**Status:** revision 3 — cold pass complete, 5/5 stages, all Blockers resolved; awaiting user approval · **Date:** 2026-11-12 · **Depth:** standard (one new test file; three rows in an existing register plus cross-notes; removal of one roadmap section; one changelog section; one decision entry; the increment directory; no production, config, schema, dependency, destructive, credential, or publish surface)
**Review independence:** fresh — one cold pass (`independent-review` shape, five fresh reviewer dispatches, no authoring context) run against this artifact; Stage 1–5 reports in `plan.cold/`. Three Blockers and all Majors were resolved across revisions 2–3; Stage 5 returned GO with no Blockers.
**Rollback cost:** 0 — the only production-tree change is an additive test file; every other edit is documentation. `git revert` of the commit series leaves no state, schema, or behaviour change.
**Roadmap item:** `ROADMAP.md` § R8 update-preservation evidence (`ROADMAP.md:17-22`); removed from `ROADMAP.md` and folded into `CHANGELOG.md` when this increment closes.
**Predecessor:** version 2026.11.11 (latest tag `v2026.11.07`); 153 unpushed commits, oldest 3.1 d; 8 open roadmap items; `HEAD` `397dd61`; clean tree apart from this plan directory.

## Why this item

`ROADMAP.md` § R8 update-preservation evidence is the first open section in the
file, and file order selects it. Its trigger — "start after the sweep reaches
R9" (`ROADMAP.md:22`) — is satisfied: the sweep status board records R9
**closed 2026-11-10** and M1 closing the program
(`docs/plans/2026-11-09-full-review-sweep/worklist.md:603-604`). The R9 sections'
own triggers ("start after chunk M1 closes") are equally satisfied, so selection
is by file order, not by trigger uniqueness — the same rule the R7 export
increment applied (`docs/plans/2026-11-12-r7-export-remediation/plan.md:9-21`).

The item closes two rows filed by the R8 chunk as one finding:

- **F-R8-A-1** — REQ-043 has no test that simulates an update. The R8 verdict
  records the state layout as structurally correct (user layer under
  `$XDG_CONFIG_HOME`, KB store and reports under `~/.local/share`, quota under
  `$TMPDIR`) but notes "**no test simulates an update**"
  (`worklist.md:472`). REQ-043 requires that applying an update SHALL NOT
  remove, reset, or overwrite the user configuration layer, indexed KB content,
  or accumulated quota state, and that the server SHALL operate on preserved
  state after an update without reconfiguration (`infobroker.md:640-645`).
- **§2 F11 prose** — the failure-mode table asserts that "G1 update-preservation
  tests guard the guarantee" (`infobroker.md:76`), and the R8 prose verdict
  calls that sentence **false today** because no such test exists
  (`worklist.md:492`). The sentence becomes true when the test lands; it does
  not need rewording, because it names no implementation.

REQ-043 already states the obligation in contract terms, so this increment is
**evidence, not a behaviour fix**: the paths are already outside the distributed
tree and `check-shipped-kb-empty` / `check-pack` already assert the shipped tree
is clean. The gap is a missing G1 assertion that an update, applied over the
package tree, leaves user state readable and effective.

**A citation is not an assertion.** REQ-043 has a *carrier* today —
`src/config.test.ts:1` carries `@implements REQ-043` — which is why
`validate-spec` passes, but no test *asserts* the update behaviour. The new
header is a second carrier on the asserting test; the coverage gate was already
satisfied, so this is not a citation fix.

**"Reconcile" means the row is appended, not reworded.** The §2 F11 sentence is
true once the test exists, so the prose is left word-for-word and the evidence is
appended to the two worklist rows and the register; C-4 forbids weakening or
deleting the sentence. The "SHALL NOT remove, reset, **or overwrite**" limb is
carried by a byte-identity assertion on the user layer file, not only by the
merged value.

## Baseline (this session)

- `npm run status` → version 2026.11.11 (latest tag `v2026.11.07`), **153
  unpushed commits, oldest 3.1 d**, 8 open roadmap items.
- `npm run check:fast` → **PASS** (19 gates, 28.1 s), run **before** this plan
  directory existed, so the 19-gate set included `check-loop-artifacts` against
  a tree with no new increment.
- `npm run check` → **PASS** (22 gates, full, 157.8 s), run **after** T0 created
  `tasks.md` and `aar.md`; `check-loop-artifacts` reports 0 errors and one
  pre-existing warning (`2026-11-10-r6-encryption-capacity-remediation: plan.md
  has no **Done bar:** line`). The full baseline is green; the run is not
  recorded because the tree is dirty with this plan directory.
- Predicate re-verification (reads, this session):
  - `src/config.ts:108-122` resolves the shipped default at
    `<package root>/config.json` and the user layer at
    `$XDG_CONFIG_HOME/infobroker/config.local.json`, with an existing sibling
    `config.local.json` taking precedence.
  - `src/config.ts:1077` `loadConfig()` merges the user layer over the shipped
    default; `src/config.ts:263-266` `getUserConfigDrift()` returns `null` only
    when there is no user layer, otherwise a `ConfigDrift` object whose
    `hasDrift` is the predicate; `src/config.ts:84` `getStartupConfigIssue()`
    reports a startup fallback.
  - `src/config-migrations.ts:108-121`: a version-less layer yields
    `declared: null`, `outdatedVersion: false`, and `hasDrift` false when every
    top-level key is known. `output.max_chars` and `output.response_max_chars`
    are validated positive integers (`src/config.ts:769-778`).
  - `src/kb.ts:334-348` `initKb()` closes the previous store and opens the new
    one; `:489` `flushKbWrites(): void`; `:891` `kbIngest(...): number`; `:906`
    `kbStats()`; `:939` `kbGet(...)`. `initKb` arms a maintenance interval when
    `maintenance_interval_minutes > 0`; the shipped value is **60**
    (`config.json`), so a release re-init must set it to `0`.
  - `src/quota.ts:16` default path is `$TMPDIR/infobroker/quota.json`; `:22-27`
    `INFOBROKER_QUOTA_STATE` overrides it; `:130` `loadQuotaState(): void`;
    `:220` `increment(...): QuotaReport` (schedules a 30 s debounced write,
    `:83-89`); `:231` `checkQuota(...): QuotaReport` (calls `getOrCreateCounter`,
    so it can create/reset entries — it is not read-only); `:99,105-112`
    process-level `beforeExit` and signal handlers are registered at import.
  - `src/clause-coverage.ts:19,23,89-102`: running the detector on the REQ-043
    body returns `{"orBranches":0,"conditionals":0}` — the verb list is not a
    parenthesized enumeration and there is no WHEN clause, so no clause tag is
    required; a bare `@implements REQ-043` satisfies the gate. (The detector's
    live output, not only its line numbers, is the evidence.)
  - `grep -rn "update-preservation\|simulate.*update" src/**/*.test.ts` → none;
    `src/preservation.test.ts` is REQ-122 citation snapshots, unrelated.
  - `worklist.md:875` cites `infobroker.md:74` for F11; the row is actually at
    `:76` (F9 at `:74`). T6 corrects the stale anchor.
  - `worklist.md:620` (`F-R2-4`, P2, `Closed-P3`) mentions REQ-010's
    "update-preservation" clause; T6 adds a cross-note that the new test
    supersedes that phrase while the row's primary subject (REQ-010
    defaults-inheritance) stays closed.

## Alternatives considered

- **A — add an assertion to `src/config.test.ts`.** Rejected: it covers one of
  the three state kinds and no update simulation. REQ-043 names the layer, the
  KB, and quota together; splitting the evidence across three files repeats the
  `beforeAll`/`afterEach` machinery three times.
- **B — a packaging-level test that runs `npm pack`, installs the tarball, and
  restarts the server.** Rejected for G1: it needs registry access or a local
  install step, is slow, and `check-pack` already asserts the tarball boundary
  and a handshake from an empty config-less directory. The G1 obligation is that
  user state survives and is used, which a deterministic temp-root simulation
  proves without network.
- **C — extend the Debate Club Arena.** Rejected: the Arena drives the MCP
  server over stdio with recorded fixtures; an update is a restarted process
  with a replaced package root, not a tool exchange. It would add fixture
  machinery for no extra assertion.
- **D — copy the whole repository tree as the "install".** Rejected: copying
  `src/` and `node_modules` is slow and adds nothing; the guarantee is about
  *where user state lives*, not the module files. The simulation replaces a
  package root containing the shipped `config.json`, `package.json`, and a
  release marker, which is the surface an update rewrites.
- **E — seed `quota.json` by hand and only test the read path (fallback only).**
  The primary path writes through `increment()` and the real debounce timer,
  which proves the write and the read; the seeded-file variant stays as a
  recorded fallback (Test design §8) if fake timers do not drive the timer.
- **F — name the file `update-survival.test.ts` to avoid confusion with
  `src/preservation.test.ts` (REQ-122).** Rejected: `update-preservation` names
  the REQ-043 contract directly and keeps the register row self-describing; the
  register entry names both files so the two are not conflated.

## Blast radius

Sizes: **S** ≤ ~60 changed lines, **M** ≤ ~260.

| File | Change | Size |
|---|---|---|
| `src/update-preservation.test.ts` (new) | `// @implements REQ-043`; a temp world with `install/`, `xdg/`, `data/`, `closed/`; scenario stage 1 (setup) writes the user layer, loads config, ingests a KB document, and increments a quota counter; stage 2 (update) deletes and re-creates `install/` from a newer shipped snapshot; stage 3 (post-update read) re-imports the modules and runs the six assertions | M |
| `docs/plans/2026-11-09-full-review-sweep/worklist.md` | REQ-043 verdict row (`:472`) and §2 F11 prose row (`:492`) → `Resolved 2026-11-12` in the Verdict cell; register row `F-R8-A-1` (`:875`) → `**Resolved 2026-11-12**` with the test path; correct the stale `infobroker.md:74` anchor to `:76`; cross-note `F-R2-4` (`:620`) | S |
| `ROADMAP.md` | remove § R8 update-preservation evidence (`:17-22`) | S |
| `CHANGELOG.md` | one `## 2026.11.11 — …` section as the new top section, immediately after `# Changelog` (`:1`) and above `## 2026.11.11 — R7 export…` (`:3`), with the same `(REQ-…; F-…; D-…)` reference tail | S |
| `DECISIONS.md` | one entry (`D-111`) recording the G1 evidence shape: temp-root update simulation, value-only release delta, packaging left to `check-pack` | S |
| `docs/plans/2026-11-12-r8-update-preservation-evidence/` | `plan.md`, `tasks.md`, `aar.md`, `plan.cold/` (increment record) | S |

No production source change, no REQ body edit, and no config, schema,
dependency, provider-registry, tool-schema, or gate change. `src/index.ts` is
not touched; the test imports `config`, `kb`, and `quota` modules directly. The
one citation change is the new G1 `@implements REQ-043` header on the test,
which `validate-spec` / `check-gate-coverage` consume.

**Package-relative and default-path discovery are out of scope, deliberately.**
Scenario stage 1 sets `INFOBROKER_CONFIG` so the test controls the replaced
tree; the env-unset `packageRoot()` branch is already asserted by
`src/config-path.test.ts:44` and by `check-pack`'s config-less handshake. The
test also relocates the KB store and quota file into the user area through the
supported seams (user layer `kb.storage_path`, `INFOBROKER_QUOTA_STATE`). The
shipped defaults themselves are pinned by `check-shipped-kb-empty` (KB store
outside the tree) and §10.1 / `src/quota.ts:16` (quota under `$TMPDIR`); the test
adds the *update sequence* over a replaced tree, and its assertion 6 checks the
resolved paths are outside the tree rather than re-deriving the defaults.
Because `install/` has no sibling `config.local.json`, `src/config.ts:119`
falls through to the XDG layer, which is assertion 2.

**Register coupling.** `F-R8-A-1` appears in six places: the live register
(`worklist.md:875`), the REQ-043 verdict row (`:472`), the §2 F11 prose row
(`:492`), the §9.2 G1-integration row (`:547`, whose parenthetical still calls
the bullet carrier-less and F-R8-A-1 "(R8, open)"), the R2 REQ-010 row
(`:146`, the second copy of the `F-R2-4` phrase), and the historical chunk
record (`docs/plans/2026-11-10-full-review-r8/aar.md:32`). T6 updates the live
register, the two R8 verdict rows, `:547`'s parenthetical, and adds the
`F-R2-4` cross-note at both `:146` and `:620`, following the R7 increment's
precedent (`docs/plans/2026-11-12-r7-export-remediation/plan.md:111`). The R8
chunk AAR is a closed historical record and is left as written; no gate
cross-checks it (`check-loop-artifacts` reads `plan.md`/`tasks.md`/`aar.md`
presence and the terminal token only). `F-R2-4` keeps its `Closed-P3` verdict:
its subject is REQ-010 defaults inheritance, and the cross-note prevents the
registers from appearing to disagree.

## Test design (executable detail)

`src/update-preservation.test.ts`, one `describe` with `beforeAll`/`afterAll`
and per-state `it` blocks, mirroring `src/quota.test.ts`'s shared-fixture shape.
`vitest.config.ts` does not enable `globals`, so the file imports `describe`,
`it`, `expect`, `beforeAll`, `afterAll`, and `vi` from `vitest` explicitly (the
`src/quota.test.ts` header is the pattern).
The test is guarded with
`const describeLinux = process.platform === "linux" ? describe : describe.skip;`
because `XDG_CONFIG_HOME` is honoured only on Linux (`src/config.ts:98-106`);
on other platforms a skip is honest and never reads a real home directory.

**API contracts used (verified this session).** All are synchronous:
`kbIngest(text: string, title: string, sourceUrl: string, provider: string, collection?: string, sourceType?: string, freshnessTier?: string, sourceUpdatedAt?: string): number`
(`src/kb.ts:891`; `provider` is a free-form provenance label, `"test"` is the
existing convention at `src/kb.test.ts:433`); `kbGet(sourceUrl): { text, ... } | null`
(`:939`); `kbStats(): { chunk_count: number, ... }` (`:906`);
`flushKbWrites(): void` (`:489`); `initKb(config): void` closes the previous
store (`:339`); `loadQuotaState(): void` (`src/quota.ts:130`);
`increment(slug, limits?): QuotaReport` (`:220`); `checkQuota(slug, limits?): QuotaReport`
(`:231`).

1. **World.** `mkdtempSync(join(tmpdir(), "ib-update-"))` with:
   - `install/` — the replaceable package root, holding `config.json`,
     `package.json`, and `RELEASE`;
   - `xdg/` — `XDG_CONFIG_HOME`; the user layer is
     `xdg/infobroker/config.local.json`;
   - `data/` — `data/knowledge-base/` (KB store) and `data/quota.json`
     (`INFOBROKER_QUOTA_STATE`);
   - `closed/` — a scratch directory used only to release the stage-1 KB handle.

   Environment: `INFOBROKER_CONFIG=<install>/config.json`,
   `XDG_CONFIG_HOME=<xdg>`, `INFOBROKER_CONFIG_LOCAL` deleted,
   `INFOBROKER_QUOTA_STATE=<data>/quota.json`, and `HOME=<root>/home` (created
   empty). The `HOME` pin is what makes the mutation check hermetic: if the user
   layer is removed, the shipped `~/.local/share/...` defaults resolve inside the
   temp root instead of the maintainer's real store. `afterAll` releases the KB
   store, restores every env var, and removes the root (including `closed/` and
   `home/`).

2. **Shipped snapshots.** Read the repository `config.json`
   (`join(import.meta.dirname, "..", "config.json")`) and deep-clone it as
   `base`. Guard the arithmetic: `const maxChars = base.output?.max_chars;` must
   be a finite positive integer, else throw a diagnostic error before deriving
   `newMaxChars = maxChars + 1000`. Stage 1 writes `install/config.json` as the
   **unmodified** `base` clone; stage 2 writes the clone with
   `output.max_chars = newMaxChars`. The delta is a value, not a schema key, so
   REQ-105 drift is correctly absent; a schema-advancing release is REQ-105's
   surface, not this finding's. The user layer overrides a different key
   (`output.response_max_chars`) plus `kb.storage_path`.

3. **Scenario stage 1 — setup.** Write `install/` (release `"before"`), the user
   layer
   `{ kb: { storage_path: "<data>/knowledge-base" }, output: { response_max_chars: 4321 } }`,
   then `vi.resetModules()` and dynamic-import `./config.js`, `./kb.js`,
   `./quota.js`:
   - `loadConfig()` → assert the merged value is `4321`;
   - `initKb(cfg.kb)` → assert `getKbLockError()` is `null` →
     `kbIngest(BODY, "Update survival", "https://example.com/update-survival", "test")`
     where
     `BODY = "The reservoir level fell by two metres during the 2026 drought."`
     → `flushKbWrites()`;
   - `loadQuotaState()` → `vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] })`
     **before** the two `increment("duckduckgo")` calls, then
     `vi.advanceTimersByTime(30_000)` so the debounced write lands, with
     `vi.useRealTimers()` in a `finally`. Then read `data/quota.json` and pin
     both `resetAt` values to `2099-01-01T00:00:00.000Z` **unconditionally**
     (the `src/quota.test.ts:56` convention); the counts stay exactly what the
     server wrote, and the direct JSON read records them;
   - capture `layerBytesBefore = readFileSync(layerPath)`;
   - release the real KB handle with
     `initKb({ ...cfg.kb, storage_path: "<root>/closed", maintenance_interval_minutes: 0 })`
     — this closes the previous store (`src/kb.ts:339`) and, with the interval
     at `0`, arms no maintenance timer over the store that is deleted next.
     Expect and ignore one "Storage path changed" warning from `src/kb.ts:401-407`;
     note it in a code comment. Fallback if the close ever moves:
     `new SqliteStore(path)` from `src/kb-sqlite.ts` with `init()`/`close()`;
   - assert the state files exist and that no user file sits under `install/`.

4. **Scenario stage 2 — the update.** `rmSync(install, { recursive: true })` and
   recreate it from the *new* snapshot with `RELEASE` = `"after"`, leaving
   `xdg/` and `data/` untouched. `vi.resetModules()`.

5. **Scenario stage 3 — post-update read.** Dynamic-import fresh modules as
   `postCfgMod`, `postKb`, `postQuota`; `const postCfg = postCfgMod.loadConfig()`;
   `postKb.initKb(postCfg.kb)` and assert `postKb.getKbLockError()` is `null`;
   `postQuota.loadQuotaState()`. **Assertions 1–6 read only these stage-3
   instances**, never the stage-1 objects (whose store was moved to `closed/`).
   Do **not** call `increment` on this instance: only the stage-1 module owns a
   write timer, so no `beforeExit` flush can recreate the removed quota
   directory at teardown.

6. **Assertions — six numbered `it` blocks.**
   1. **the package tree was actually replaced** — `install/RELEASE` is
      `"after"`, `postCfg.output.max_chars === newMaxChars`, and the user value
      `postCfg.output.response_max_chars === 4321` still wins.
   2. **the user layer is still found and needs no reconfiguration** —
      `postCfgMod.getUserConfigPath()` is `<xdg>/infobroker/config.local.json`,
      `postCfgMod.getStartupConfigIssue()` is `null`,
      `postCfgMod.getUserConfigDrift()` is non-null with `hasDrift === false` (it
      is never `null` while a layer exists, per `src/config.ts:263-266`).
   3. **the user layer is not overwritten** — `readFileSync(layerPath)` equals
      `layerBytesBefore` byte for byte.
   4. **KB content survives** — `postKb.kbGet("https://example.com/update-survival")`
      returns a record whose `text === BODY`, and `postKb.kbStats().chunk_count`
      is `> 0`.
   5. **quota counters survive** — the direct JSON read shows
      `daily.count === 2` and `monthly.count === 2`, and
      `postQuota.checkQuota("duckduckgo")` reports `daily.used === 2`,
      `monthly.used === 2` (read last, because it can create/reset entries).
   6. **no user state lives in the package tree** — the post-update `install/`
      contains exactly the three shipped files; `resolve(postCfg.kb.storage_path)`
      and `postQuota.getQuotaStatePath()` are both outside `install/`.

7. **Mutation check (evidence, not a committed test).** After green: move the
   user-layer `kb.storage_path` inside `install/` (the update deletes it) → the
   KB assertion (4) and the containment assertion (6) fail; restore. Delete
   `xdg/` in stage 2 → assertions 1–3 fail (the user value reverts to the shipped
   default, and the layer is gone); with `HOME` pinned inside the temp root, the
   fallback defaults resolve there, not in the maintainer's real store. Restore.
   Both transcripts go to `tasks.md`, and `git status --porcelain` afterward
   shows only the new test file plus this plan directory (`git diff` is empty for
   tracked files, since the test is untracked).

8. **Fallback E (only if the debounced write does not land).** Seed
   `data/quota.json` with the full provider-keyed payload the loader accepts —
   `{"providers":{"duckduckgo":{"daily":{"count":2,"resetAt":"2099-01-01T00:00:00.000Z"},"monthly":{"count":2,"resetAt":"2099-01-01T00:00:00.000Z"}}}}`
   — **before** stage 2, and say in `tasks.md` and the AAR that the write path
   was not exercised. A top-level `{ daily, monthly }` object is not a valid
   shape: `sanitizeQuotaState` (`src/quota.ts:58-78`) discards it.

**Isolation and teardown.** `vitest.config.ts` sets only `include` and the two
30 s timeouts, so per-file isolation is vitest's default, not a configured
property; env vars are process-global within a worker, which is why the file is
self-contained and restores them in `afterAll`. `quota.ts` registers
`beforeExit`/signal handlers at module import (`:99,105-112`); the two module
instances (stage 1 and stage 3) add two listener sets, below the default warning
threshold. Only the stage-1 instance ever schedules a write, and the fake-timer
advance flushed it, so `beforeExit` has nothing to write. Everything else is
synchronous.

## Done bar

**Done bar:** F-R8-A-1 and the §2 F11 row each read `Resolved 2026-11-12` with
file:line evidence. Concretely: (1) `src/update-preservation.test.ts` exists,
carries `@implements REQ-043`, and its **six** numbered assertions
(Test design §6) pass on a simulated update, or — if fallback E ran — the AAR
states the write path was not exercised; (2) the mutation check fails assertion
4 (KB) and assertion 6 (path containment) when the KB path moves under
`install/`, and fails assertions 1–3 when `xdg/` is deleted, with both
transcripts in `tasks.md`; (3) `npx vitest run
src/update-preservation.test.ts` and `npm run typecheck` are green; (4)
`npm run validate-spec` and `npm run check-gate-coverage` pass (the added G1
citation is covered) and `ROADMAP.md` no longer carries § R8 update-preservation
evidence after that run, with `check-roadmap` green; (5) `worklist.md:472`,
`:492`, and `:875` carry the resolution and the test path, and `:875`'s
`infobroker.md:74` anchor is corrected to `:76`; (6) `CHANGELOG.md` has exactly
one new `## 2026.11.11 —` heading above the pre-existing
`## 2026.11.11 — R7 export…` heading (now at `:3`), and `DECISIONS.md` carries
`D-111`; (7) `npm run check` is
green **after** `aar.md` carries its terminal token; (8) the AAR ends
`LOOP PAUSED` with the review cap recorded.

## Review-loop cap (recorded, not judged at run time)

One cold pass at standard depth plus at most one targeted diff re-review of the
lines that changed. If the cold pass returns a blocker inside one assertion's
evidence, the revision narrows to that assertion instead of re-scoping the
increment. At the cap an unresolved item is escalated to the user. This
increment records the cap and does not retire `ROADMAP.md` § Review-loop
convergence; retiring that section is a user decision after the AAR.

## Phases and steps

### Phase 0 — Scaffold and baseline

- **T0.** Create `tasks.md` (this step list) and `aar.md` seeded with
  `LOOP OPEN`, so `check-loop-artifacts` sees a complete increment directory
  from the first gate run.
- **T1.** Record the baseline in `tasks.md`: `npm run status`, both gate runs
  (fast before the directory existed, full after T0), and the predicate reads.

### Phase 1 — The simulated-update test (F-R8-A-1)

- **T2.** Write `src/update-preservation.test.ts` per Test design. No production
  change. Every temp path stays under `mkdtempSync(tmpdir(), ...)` so
  `check-shipped-kb-empty` never sees an artifact.
- **T3.** Run the file and record the verbatim result. Two independent failure
  modes, each with its own remedy, recorded separately in `tasks.md`:
  **T3a** the stage-3 KB reopen (remedy: the `SqliteStore` fallback); **T3b**
  the quota timer (remedy: fallback E, with the weaker-path caveat).
- **T4 — mutation check.** Two in-place mutations, each reverted immediately,
  with the failure text recorded (Test design §7).
- **T5.** `npm run typecheck` and `npx vitest run src/update-preservation.test.ts`
  → green; `npx vitest run src/config.test.ts src/quota.test.ts src/kb.test.ts`
  → green (no interaction with the env seams those files use).

### Phase 2 — Bookkeeping

- **T6.** `worklist.md`: the REQ-043 row (`:472`) and §2 F11 row (`:492`) keep
  their `Surface | Verdict | Predicate` shape — the Verdict cell becomes
  `**Resolved 2026-11-12** (F-R8-A-1)` and the Predicate cell gains the test path
  and what it asserts; register row `F-R8-A-1` (`:875`) → `**Resolved
  2026-11-12**` with the same evidence and its anchor corrected from
  `infobroker.md:74` to `:76`; §9.2 row `:547` → its "has no carrier … (R8,
  open)" parenthetical replaced with the new carrier; `F-R2-4` gains the same
  cross-note at `:146` and `:620`, keeping its `Closed-P3` verdict because the
  row's subject is REQ-010 defaults inheritance.
- **T7.** Add `D-111` to `DECISIONS.md` (confirm the id first with
  `rg -o "D-\d{3}" DECISIONS.md | sort -u | tail`): the G1 update-preservation
  evidence is a temp-root simulation in `npm run test`; packaging parity stays
  with `check-pack`; a value-only release delta keeps REQ-105 drift out of
  scope.
- **T8.** Add the new `## 2026.11.11 — <title>` section as the **top** section,
  immediately after `# Changelog` (`CHANGELOG.md:1`) and above the current top
  section (`:3`), with the same `(REQ-…; F-…; D-…)` reference tail (version-sync
  pins the top date to `package.json`). This runs after T7 so the tail can cite
  `D-111`.
- **T9.** `npm run validate-spec` and `npm run check-gate-coverage` → green;
  **then** remove § R8 update-preservation evidence from `ROADMAP.md`;
  `npm run check-roadmap`. The removal follows the gate that
  `ROADMAP.md:22` names and the CHANGELOG record it moves into.

### Phase 3 — Gates and close

- **T10.** `npm run check-roadmap`, `npm run version-sync`, `npm run test`,
  `npm run check-shipped-kb-empty`, `npm run check-loop-artifacts`.
- **T11.** Rewrite `aar.md` with dispositions, the review cap, every gate result
  so far, and the terminal token. `npm run session:close`.
- **T12.** `npm run check` on the complete tree (full suite, un-piped, exit
  status recorded) — after T11 so `check-loop-artifacts` is satisfiable.
- **T13.** Write the T12 exit status into `tasks.md`/`aar.md` and commit the
  increment docs (commit 6). The one-line delta from the T12 tree is a
  documentation line; re-run `check-loop-artifacts` and `check-roadmap` after
  writing it.
- **T14.** `npm run check:fast` on the committed tree as the closing
  session-loop gate.

## Commit series

Each commit is `typecheck`-clean and passes the gate it feeds. Order differs
from the AGENTS docs list (README, CHANGELOG, DECISIONS, ROADMAP, AGENTS,
skills) only where the `D-111` dependency requires it: the decision lands
before the CHANGELOG entry that cites it.

1. `test(preservation)`: `src/update-preservation.test.ts` (T2–T5). Gate:
   `npx vitest run src/update-preservation.test.ts`, `typecheck`.
2. `docs(decisions)`: `D-111` (T7).
3. `docs(plans)`: the worklist rows and the `F-R2-4` cross-note (T6). Gate:
   `npm run test` (no gate reads the file; the suite proves the new test still
   passes beside the register edit).
4. `docs(changelog)`: the CHANGELOG section (T8); `version-sync`.
5. `docs(roadmap)`: removal (T9); `check-roadmap`, `validate-spec`,
   `check-gate-coverage`.
6. `docs(plans)`: this increment's `plan.md`, `tasks.md`, `aar.md`, `plan.cold/`
   (T11–T13); `check-loop-artifacts`.

The series is made in two blocks: commits 1–5 before T12; commit 6 is made by
T13 after the AAR is final and carries the increment docs plus the T12
transcript. T14 then verifies the committed tree, and `check-loop-artifacts` /
`check-roadmap` are re-run after the T13 write.

## Verification plan

| Step | Gate | Satisfiability evidence |
|---|---|---|
| Layer survives | `vitest run src/update-preservation.test.ts` | `config.test.ts:137-146` loads the user layer through `INFOBROKER_CONFIG_LOCAL`; `getUserConfigPath` is exported (`src/config.ts:115`) |
| KB survives | same suite | `kb-sqlite.test.ts:131` proves persistence across re-init; `flushKbWrites` is exported (`src/kb.ts:489`) |
| Quota survives | same suite | `quota.test.ts:56` proves persisted counters load; the state path is env-overridable (`src/quota.ts:22-27`) |
| New shipped default active | same suite | `loadConfig` merges over the replaced `config.json`; the value delta is derived from the file with an integer guard |
| Drift predicate | same suite | `detectConfigDrift` returns an object whose `hasDrift` is false for a known-key, version-less layer (`src/config-migrations.ts:108-121`) |
| No user state in the tree | same suite plus `check-shipped-kb-empty` | the test writes only under its temp root and asserts the resolved paths; the gate pins the shipped defaults |
| Coverage still holds | `validate-spec`, `check-gate-coverage` | REQ-043 already had a carrier (`src/config.test.ts:1`); the new header adds an asserting one |
| Whole-tree health | `npm run check` after T11 | 22 gates sequential; a T12 failure means fix, rewrite the AAR terminal token, re-run |

## Edge cases and rollback

- **Fake timers do not reach the quota module's `setTimeout`.** Fallback E
  (Test design §8) seeds the provider-keyed payload; the assertion stays
  "accumulated counters are read after update", and `tasks.md` plus the AAR
  record the weaker path.
- **A KB handle or timer outlives a module reset.** The release re-init sets
  `maintenance_interval_minutes: 0` on `closed/`, and only the stage-1 instance
  ever schedules a quota write, so `afterAll` removes the root without a live
  writer. If a later refactor removes `initKb`'s close, the fallback is
  `new SqliteStore(path)` with `init()`/`close()`.
- **`config.json` changes shape in a later release.** The snapshot is cloned
  from the repository file at run time, so the test follows; the integer guard
  turns a shape change into a clear error. A future rename of `max_chars` would
  make drift legitimately true and this assertion red — that is a signal to
  update the test, not a flake.
- **Non-Linux platform.** The suite skips, because `XDG_CONFIG_HOME` is honoured
  only on Linux; it never reads a real home directory.
- **Env leakage between tests.** `afterAll` restores `INFOBROKER_CONFIG`,
  `XDG_CONFIG_HOME`, `INFOBROKER_CONFIG_LOCAL`, `INFOBROKER_QUOTA_STATE`, and
  `HOME`, matching `config.test.ts` and `quota.test.ts`. The `HOME` pin is also
  the hermeticity guard for the mutation check.
- **`check-shipped-kb-empty` sees a stray store.** Every path is under the OS
  temp dir and removed in `afterAll`; the gate scans the repository tree only.
- **Rollback.** Per commit: `git revert <sha>`. The test commit is additive; the
  documentation commits revert with no production effect.

## Conditions to verify during execution

- **C-1** — the test must fail if the user layer is deleted (mutation check) and
  if the KB path is moved inside the install tree. A test that passes under both
  mutations is not evidence and stops the increment.
- **C-2** — the update is a *replacement* of the package root, not a config
  rewrite. If the implementation ends up calling `reloadConfig()` on an
  unchanged file, the finding's predicate ("simulates an update") is not met;
  stop and re-read F-R8-A-1.
- **C-3** — no REQ body edit. If `validate-spec` or the cold pass wants REQ-043
  reworded, that is a separate increment.
- **C-4** — §2 F11 is reconciled by the test, not by weakening the sentence; do
  not delete the "G1 update-preservation tests guard the guarantee" clause.
- **C-5** — `npm run check` runs only after `aar.md` carries a terminal token.
- **C-6** — the review cap: one cold pass, at most one diff re-review; at the cap
  an unresolved item goes to the user.

## Unknowns

- Whether a fresh module instance can open the store after stage 1 released it
  through the `closed/` re-init — T3a settles it; the documented close at
  `src/kb.ts:339` makes it a low risk.
- Whether `vi.useFakeTimers({ toFake: [...] })` drives the quota module's timer
  under vitest's default isolation — T3b settles it; fallback E is recorded.
- Whether vitest's default pool isolates `process.env` per file — assumed, not
  configured; the test is self-contained either way because it restores every
  env var.
- `D-111` is the working assumption for the next free decision id; T7 confirms it
  before writing.
- If `validate-spec` flags the new `src/*.test.ts` as an undocumented source file,
  T9 stops and adds whatever registration that gate demands (the file already
  carries `@implements REQ-043`; existing test files need no more).

## Evidence

- Plan artifact: stamped copy under
  `~/.local/state/opencode/plans/<repo-key>/` (sha256 recorded on the stamp).
- Preflight sidecars:
  `~/.local/state/opencode/plans/3b34aea2bce9fb4da60d99c296e2000157a146aca988b48969a73d1a3d3aec94/plan.evidence.json`
  and `.evidence.md`, generated 2026-11-12, `git HEAD` `397dd61`.
- `REQ-043` and `REQ-105` resolve to `infobroker.md:640` and `:647`; the
  preflight's extra absolute paths (`/config.json`, `/quota.json`,
  `/knowledge-base`) are backticked path literals, and `<root>/closed` is a real
  scratch directory the test creates and removes — none is a declared target.
  The declared targets are the five file paths in the Blast radius table; the
  sixth row is this increment's own directory.
- `src/update-preservation.test.ts` is the one declared target that does not
  exist yet; that is the increment's additive deliverable.
- Cold pass: `plan.cold/` — stage reports 1–5 plus `report.md`; the stamp records
  the `report.md` hash.
