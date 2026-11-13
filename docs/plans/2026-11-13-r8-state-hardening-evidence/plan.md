# Plan — R8 state-hardening evidence

**Status:** revision 2b — cold-pass findings resolved, diff re-review passed, plus one condition-only amendment (declaring `src/kb.ts` mutation-only) · **Date:** 2026-11-13 · **Depth:** standard
**Review independence:** fresh — one cold pass at standard depth (`plan.cold/report.md`, NO-GO: 1 Blocker, 2 Majors, 6 Minors), then one targeted diff re-review (`plan.cold/06-rereview.md`, `independent-review passed.`, no new Blocker/Major). The re-review's one deferred Major — `src/kb.ts` used as a mutation target but not declared — is resolved by the condition-only amendment recorded in §Review-loop cap.
**Rollback cost:** 1 — reversible (scale: 0 pure add, 1 reversible edit, 2 destructive). The unit is commits 2–3 as a set: reverting the `loadState` guard alone leaves the key-pool read-refusal test red.
**Roadmap item:** `ROADMAP.md:17-22` § R8 state-hardening evidence; removed from `ROADMAP.md` and folded into `CHANGELOG.md` when this increment closes.
**Predecessor version:** `2026.11.11` (latest tag `v2026.11.07`, `HEAD` `fc6228c`). Working tree was clean before this directory existed.

## Why this item

`ROADMAP.md` § R8 state-hardening evidence is the first open section in
file order, and file order selects it. Its trigger — "start after the sweep
reaches R9" (`ROADMAP.md:22`) — is satisfied: the sweep status board records
the **R9 review chunk** closed 2026-11-10 and **M1** closing the program
(`docs/plans/2026-11-09-full-review-sweep/worklist.md:603-604`).

The section closes two R8 findings of one shape: a REQ clause has no test.

- **F-R8-F-1 — REQ-100's ownership refusal is unasserted.** REQ-100:
  "The server SHALL refuse to read or write state in a directory it does not
  own" (`infobroker.md:679-681`). The write half exists in both state stores
  — `src/key-pool.ts:50-65` `ensureStateDir()` and `src/quota.ts:36-47`
  `ensureDir()` both compare `statSync(dir).uid` with `process.getuid()` and
  throw — but no test exercises either. **The read half is missing for the
  key-pool store:** `loadState()` (`src/key-pool.ts:93-106`) reads
  `resolveStatePath()` without any ownership check, while
  `loadQuotaState()` (`src/quota.ts:130-151`) calls `ensureDir()` before
  reading. The worklist's "branch exists (`src/key-pool.ts:63`) but is
  untested" (`worklist.md:483`) is therefore true of the *save* path only.
- **F-R8-F-2 — REQ-099's absent-directory creation is unasserted.** REQ-099:
  "The designated directory SHALL be created with owner-only permissions when
  absent" (`infobroker.md:676-678`). The implementation is
  `src/kb.ts:1226-1235` `resolveKeyFile()` — `mkdirSync(dir, { recursive:
  true, mode: 0o700 })` at `:1228`, before the confinement check. The
  existing confinement test (`src/kb-encryption-tools.test.ts:171-186`) always
  passes a `keys_dir` that already exists (`makeConfig` sets `keys_dir: dir`,
  `:37-59`), so the creation branch never runs. The finding's anchor
  "(`src/kb-crypto.ts` key-file creation)" (`worklist.md:879`) is stale:
  `kb-crypto.ts` only decodes key bytes (`:193-195`); creation lives in
  `kb.ts`.

**The evidence this increment adds, precisely.** For REQ-100: the *write*
refusal is asserted for the key-pool store and the *read* refusal for both
stores (quota's read guard exists; key-pool's is added here). The quota
*write* refusal is **not** separately asserted — it calls the same
`ensureDir()` whose throw the quota read test exercises, and the debounce
needed to trigger it would couple the assertion to timer state
(Alternative C). That gap is a named residual in the AAR and in the worklist
evidence sentence; the increment does not claim it is closed. For REQ-099:
the absent-directory creation branch is asserted, including its idempotence
and that confinement still holds.

No REQ body changes. The state-directory ownership rule is already declared
twice (REQ-100's permission clause, §E A01/A04/A08 rows at
`infobroker.md:1866,1869,1873`); this increment only makes it observable.

## Baseline (this session)

- `npm run status` → version `2026.11.11` (latest tag `v2026.11.07`),
  **166 unpushed commits, oldest 3.8 d**, 6 open roadmap items.
- `npm run check` → **exit 0**, `gates: PASS (full, 165.2 s)`, 22 gates,
  `HEAD` `fc6228c`, tree clean before this directory existed; recorded run
  key `fc6228cdf81d`. One pre-existing warning: `2026-11-10-r6-encryption-
  capacity-remediation` has no `**Done bar:**`.
- Predicate reads (this session):
  - `src/key-pool.ts:38-39` `state`/`statePath` module state; `:50-65`
    `ensureStateDir` — creates 0700 when absent, otherwise `chmodSync`
    best-effort, then `statSync(dir).uid !== process.getuid()` → throw;
    `:93-106` `loadState` with **no** ownership check (`readFileSync` in a
    bare `try`, `catch` → empty state, no audit); `:108-131` `saveState`
    catches the throw and calls `audit("key_pool_state_write_refused", …)`;
    `:190-206` `resolveApiKeyForEnv` calls `loadState()`, advances the cursor,
    and calls `saveState()`; `:230-234` `markKeyRejected` calls `loadState()`
    then `saveState()` synchronously (`:236-241` `markKeyRateLimited`
    likewise); `:266-269` `resetKeyPoolStateForTests` sets
    `state = { cursor: 0, keys: {} }` and clears the cached `statePath` — it
    does **not** force a re-read, because `loadState` returns early on a
    non-null `state` (`:94`). Consequence: the existing malformed-state test
    (`src/key-pool.test.ts:108-116`) is satisfied without reading the file —
    `resolveApiKey` writes the sanitized in-memory state over it. The read
    path has no test today in either direction.
  - `src/quota.ts:36-47` `ensureDir` (same uid compare, throws); `:20-28`
    `INFOBROKER_QUOTA_STATE` test seam, path cached in module state on first
    `resolveQuotaPath()`; `:130-151` `loadQuotaState` (guard first, `catch` →
    `audit("state_dir_refused", …)`, empty state; no loaded-once cache, so it
    re-reads every call); `:153-165` `saveQuotaState` (guard, then 0600
    write); `:78` admits a provider only when **both** `daily` and `monthly`
    sanitize.
  - `src/kb.ts:1215-1222` `resolveKeysDir` (config `keys_dir`, else a sibling
    of `storage_path`, else `~/.local/share/infobroker/keys`, `:1820` of
    `config.json`); `:1226-1235` `resolveKeyFile` (mkdir 0700 when absent at
    `:1228`, then `relative()` containment at `:1230-1233`);
    `:1329-1344` `generateKeyFile` (refuses an existing file, atomic write).
  - `src/key-pool.test.ts:1` header `@implements REQ-104 REQ-011`; `:23-35`
    per-test temp dir, `INFOBROKER_KEYPOOL_STATE`, reset; `:95-106` 0700
    directory case; `:108-116` malformed-state reset.
  - `src/quota.test.ts:1` header `@implements REQ-033 REQ-034 REQ-100`;
    `:13-28` fixed `quotaFile` in `beforeAll`; `:30-74` the REQ-100 describe,
    including `:61-74` "preserves valid persisted counters" (daily **and**
    monthly); no `vi` import.
  - `src/kb-encryption-tools.test.ts:1` header includes REQ-099; `:37-59`
    `makeConfig` with `keys_dir: dir`; `:171-186` the confinement test
    (`mkdtempSync` + `finally { rmSync }` shape).
  - `src/clause-coverage.ts` `detectClauseRequirements` on the REQ-099 and
    REQ-100 bodies returns `{orBranches: 0, conditionals: 0}`, so no clause
    tag is required for a bare `@implements`.
  - `src/kb-crypto.ts:193-195` `readKeyFile` only decodes; no directory
    creation (confirms the stale anchor).
  - `grep -rn "getuid" src scripts` → `src/quota.ts:41,43` and
    `src/key-pool.ts:60,62` only; no test stubs it today.
  - `DECISIONS.md` highest id `D-112`; `CHANGELOG.md:3` top section is
    `## 2026.11.11 — R8 notice and REQ-096 gate-traceability evidence`;
    `package.json:3` `2026.11.11`.
  - `worklist.md:482` (REQ-099) and `:483` (REQ-100) carry
    `finding:F-R8-F-2` / `finding:F-R8-F-1`; register rows `:878`/`:879` are
    `Scheduled-roadmap`.

## Alternatives considered

- **A — make a directory owned by another uid and test the real syscall.**
  Rejected: needs `root` (`chown`), so the suite would be root-only or skip,
  and a skipped test proves nothing.
- **B — stub `process.getuid` to report a foreign uid.** Chosen (used by
  both new state tests): the guard reads `process.getuid()` at call time
  (`src/key-pool.ts:60-62`, `src/quota.ts:41-43`), so substituting the value
  makes an owned directory look foreign without touching the filesystem. The
  stub value is `(uid + 1) >>> 0`, which differs from `uid` at every value
  including the uid-space maximum. Fallback if the TypeScript types reject
  `vi.spyOn` on an optional POSIX method: `Object.defineProperty(process,
  "getuid", { value, configurable: true })`, restored in `finally`.
- **C — also assert the quota *write* refusal with fake timers.**
  Deferred, not rejected on merit: `saveQuotaState` only runs from the
  debounced 30 s timer (`src/quota.ts:84-96`), so the test would install fake
  timers in a file whose other tests spawn a loopback server, and a real timer
  left pending by an earlier test could write the same file inside the stub
  window. The write half is asserted once, on the synchronous key-pool path;
  the quota write path calls the same `ensureDir()` whose throw the read test
  exercises. Recorded as a residual in the AAR.
- **D — assert the audit lines instead of the behaviour.** Rejected: the
  audit trail needs an `INFOBROKER_CONFIG` override and a module reload in
  files that do not use one today, and it would still leave "no state was
  read or written" unproven. Behaviour is the REQ clause; audit content is
  REQ-098's, already covered by `src/audit-log.test.ts`.
- **D2 — make `resetKeyPoolStateForTests` set `state = null` so the seam
  forces a re-read.** Rejected as the wrong lever: it is a shared seam used
  by every test in the file, and changing it would silently alter the
  existing malformed-state test's meaning. The read tests instead take a
  **fresh module instance** (`vi.resetModules()` + `await
  import("./key-pool.js")`), the pattern `src/audit-log.test.ts:33-44`
  already uses.
- **D3 — share the ownership check as one helper across both stores.**
  Rejected as scope creep (Alternative G in revision 1). The refusal message
  is deliberately identical in all three copies so both directions report the
  same directory; the duplication is three short comparisons, not logic that
  can drift in behaviour. Recorded as an accepted minor.
- **E — narrow REQ-100's sentence to the write direction.** Rejected: the
  roadmap offers no such option, and narrowing a REQ to match an incomplete
  implementation removes the obligation. The key-pool read guard is ~12
  lines and mirrors `loadQuotaState`.
- **F — put the keys-dir creation test in `src/kb-crypto.test.ts`.**
  Rejected: creation is `resolveKeyFile` in `kb.ts`; `kb-crypto.ts` is the
  pure envelope module. The confinement test's home already carries the
  REQ-099 citation.

## Blast radius

Sizes: **S** ≤ ~60 changed lines, **M** ≤ ~260.

| File | Change | Size |
|---|---|---|
| `src/key-pool.ts` | add a read-side ownership guard used by `loadState` (refuse to read, audit `key_pool_state_read_refused`, reset in-memory state); `saveState`'s existing guard unchanged | S |
| `src/key-pool.test.ts` | header gains `REQ-100`; `vi` import, `freshKeyPool()` helper, two ownership tests (write refusal, read refusal), and the existing malformed-state test switched to a fresh module so it actually reads | S |
| `src/quota.test.ts` | `vi` import; one test: a valid state file in a foreign-owned directory is not read, then is read after restore | S |
| `src/kb-encryption-tools.test.ts` | one test: a `keys_dir` that does not exist is created 0700, idempotently, and confinement still refuses an outside path | S |
| `infobroker.md` | §9.2 verification list (`:1083-1084`) gains the ownership-refusal and keys-directory-creation probes; no REQ body edit | S |
| `docs/plans/2026-11-09-full-review-sweep/worklist.md` | surface rows `:482`/`:483` and register rows `:878`/`:879` → `**Resolved 2026-11-13**`; correct the stale `src/kb-crypto.ts` anchor at `:879` and the `src/key-pool.ts:63` anchors at `:483`/`:878` | S |
| `ROADMAP.md` | remove § R8 state-hardening evidence (`:17-22`) | S |
| `CHANGELOG.md` | one `## 2026.11.11 — …` section as the new top section | S |
| `DECISIONS.md` | one entry (`D-113`) | S |
| `docs/plans/2026-11-13-r8-state-hardening-evidence/` | `plan.md`, `tasks.md`, `aar.md`, `plan.cold/` | S |

**Mutation-only, not a deliverable:** `src/quota.ts` is temporarily edited in
T6(c) (the uid compare forced to `false`) and `src/kb.ts` in T9 (the
`mkdirSync` removed from `resolveKeyFile`); both are restored
byte-identically (sha256 compared, `git status --porcelain` confirming no
surviving change) before the commit that follows each mutation. They are
listed here so each mutation has a declared target; the committed tree never
contains a change to either file.

No config, schema, dependency, provider-registry, tool-schema, gate-manifest,
or REQ-body change. No `scripts/` change. The one production behaviour
change is the key-pool read guard.

## Design — REQ-100 ownership refusal (F-R8-F-1)

### Production change: `src/key-pool.ts`

Add a read-side guard next to `ensureStateDir` and call it at the top of
`loadState`:

```ts
// REQ-100: reading is refused too, not only writing. The directory is not
// created on the read path — a missing directory means "no state yet".
function assertOwnedDir(dir: string): void {
  if (!existsSync(dir)) return;
  if (typeof process.getuid === "function") {
    const st = statSync(dir);
    if (st.uid !== process.getuid()) {
      throw new Error(`Refusing to use key-pool state directory "${dir}" — not owned by this user`);
    }
  }
}
```

`loadState` gains, before its existing `try`:

```ts
  try {
    assertOwnedDir(dirname(resolveStatePath()));
  } catch (e) {
    audit("key_pool_state_read_refused", e instanceof Error ? e.message : String(e));
    state = { cursor: 0, keys: {} };
    return state;
  }
```

`ensureStateDir`'s throw message is reused verbatim so both directions report
the same directory. The guard runs on the first load only (`state` is cached
afterwards), so there is no per-call `statSync` cost. `saveState` is
unchanged. A directory removed between `existsSync` and `statSync` surfaces as
an audited refusal rather than an unhandled throw; that shape is inherited
from `ensureStateDir` and is acceptable (the audit line is informational, and
the state resets safely).

### Tests — `src/key-pool.test.ts`

Header becomes `// @implements REQ-104 REQ-011 REQ-100` (no clause tag: the
detector returns 0/0 for REQ-100). Add `vi` to the existing vitest import and
one helper:

```ts
// REQ-100 read-path tests need a module whose `state` is still null: the
// shared seam clears the cached path but seeds an empty in-memory state, so
// `loadState` returns early and never reads the file.
async function freshKeyPool(): Promise<typeof import("./key-pool.js")> {
  vi.resetModules();
  return await import("./key-pool.js");
}
```

Add a describe `"state directory ownership (REQ-100)"` reusing the file's
`dir`/`stateFile` fixture.

1. **Write refusal** (static instance; the write path is synchronous).
   `process.env["INFOBROKER_ACME_API_KEY"] = "k1"`; stub
   `process.getuid` to `(uid + 1) >>> 0` inside `try`/`finally`;
   `markKeyRejected("acme", "k1")` (synchronous `loadState` + `saveState`);
   assert `existsSync(stateFile) === false` and `readdirSync(dir)` is empty
   (no `.key-pool.json.tmp-*` residue — the guard throws before the temp
   file is opened). Restore `getuid`; `resetKeyPoolStateForTests()`;
   `markKeyRejected("acme", "k1")` again → `existsSync(stateFile) === true`.
   The second half proves the refusal was ownership, not a read-only or
   otherwise unusable directory.
2. **Read refusal** (fresh module). Seed legitimately on the static
   instance: `process.env["INFOBROKER_ACME_API_KEYS"] = "k1,k2";
   markKeyRejected("acme", "k1")` → the state file records k1 disabled. Stub
   `getuid` to a foreign value; `const kp = await freshKeyPool()`; assert
   `kp.resolveApiKey("acme") === "k1"` — the foreign-directory state was
   ignored, so a key recorded as rejected is offered again. Restore
   `getuid`; `const restored = await freshKeyPool()`; assert
   `restored.resolveApiKey("acme") === "k2"` — with the real owner the same
   file *is* read. (Against the pre-fix `loadState` the first assertion
   returns `"k2"`, which is the fail-before evidence.)
3. **Strengthen the existing malformed-state test** (`:108-116`). Replace
   its `resetKeyPoolStateForTests()` with `await freshKeyPool()` and drive
   the assertions through that instance, so REQ-100's "validate before use,
   discard and reset" clause is proven by an actual read. The assertions stay
   the same (`resolveApiKey` returns `"k1"`; the file's `cursor` is a number
   and `keys` is `{}`). Without this, the pre-fix test is green whether or
   not `sanitizePoolState` runs.

`process.getuid` is stubbed via `vi.spyOn(process, "getuid")` or, if the
types reject it, the `Object.defineProperty` fallback from Alternative B;
every stub is restored in `finally` so a failing assertion cannot leak a
foreign uid into later tests.

### Tests — `src/quota.test.ts`

Add `vi` to the existing vitest import and one test in the REQ-100 describe
(`:30-74`), on the file's fixed `quotaFile`:

- Write a valid state file for slug `owned` in the shape `:61-74` uses —
  **both** `daily` and `monthly` counters (`daily.count = 7`, monthly `0`),
  each with a future `resetAt`, because `src/quota.ts:78` drops a provider
  whose `monthly` does not sanitize. Stub `getuid` to a foreign value;
  `loadQuotaState()`; assert `checkQuota("owned", { per_day: 100 }).daily.used
  === 0` — the foreign-directory state was refused. Restore `getuid`;
  `loadQuotaState()`; assert `.daily.used === 7`. The path is cached in
  module state (`src/quota.ts:20-28`), so the test must not change
  `INFOBROKER_QUOTA_STATE`; it reuses `quotaFile`.

## Design — REQ-099 absent-directory creation (F-R8-F-2)

One test in `src/kb-encryption-tools.test.ts`, after the confinement test
(`:171-186`), following that test's fixture shape: `const dir =
mkdtempSync(join(tmpdir(), "ibk-tools-keysdir-")); try { … } finally {
rmSync(dir, { recursive: true, force: true }); }`.

1. `const base = makeConfig(dir, { enabled: false })`; `const keysDir =
   join(dir, "nested", "keys")`; `initKb({ ...base, keys_dir: keysDir })`.
2. Assert `existsSync(keysDir) === false` first, so the fixture cannot decay
   into a no-op if `initKb` ever starts creating the directory.
3. `const resolved = resolveKeyFile(join(keysDir, "kb.key"))` → assert the
   returned path is absolute and inside `keysDir`, the directory now exists,
   and on POSIX its mode is `0o700` (`statSync(keysDir).mode & 0o777`).
4. Call `resolveKeyFile` again → directory still exists, mode unchanged
   (the creation branch is idempotent).
5. Assert `resolveKeyFile(join(dir, "outside.key"))` still throws
   `/outside the keys directory/` with the new `keys_dir` — creation does not
   weaken confinement.

File mode (`0o600`) and parent-directory modes are not asserted: REQ-099
names the directory only, and `generateKeyFile`'s 0600 write is
REQ-060g-adjacent evidence already exercised by the existing key-file tests.
The mode assertion is POSIX-only (`process.platform !== "win32"`), matching
`src/key-pool.test.ts:102-105`.

## Done bar

**Done bar:** F-R8-F-1 and F-R8-F-2 each read `**Resolved 2026-11-13**` with
file:line evidence. Concretely: (1) the three state tests (two in
`src/key-pool.test.ts`, one in `src/quota.test.ts`) pass, the key-pool read
test is red before the guard (T3) and green after it (T4), and each guard
mutation in T6 fails the test it covers — with the transcripts in `tasks.md`;
(2) the keys-directory creation test passes and fails when
`resolveKeyFile`'s `mkdirSync` is removed (T9); (3) `npm run typecheck` and
`npx vitest run src/key-pool.test.ts src/quota.test.ts
src/kb-encryption-tools.test.ts` are green; (4) `npm run validate-spec`,
`npm run check-gate-coverage`, `npm run check-roadmap`, and
`npm run version-sync` are green; (5) `worklist.md:482`, `:483`, `:878`, and
`:879` carry the resolution, the stale `kb-crypto.ts` anchor is corrected, and
the F-R8-F-1 evidence sentence names the quota-write residual; (6)
`CHANGELOG.md` has one new `## 2026.11.11 —` heading above the pre-existing
top section, `DECISIONS.md` carries `D-113`, and the §9.2 bullets carry the
two new probes; (7) `npm run check` is green on the tree that carries the
AAR's terminal token, and the only later delta is documentation, covered by
T19's `check:fast`; (8) the AAR ends `LOOP PAUSED` with the review cap and the
quota-write residual recorded.

## Review-loop cap (recorded, not judged at run time)

One cold pass at standard depth (completed: `plan.cold/report.md`, NO-GO) plus
one targeted diff re-review of the lines changed by revision 2 (completed:
`plan.cold/06-rereview.md`, `independent-review passed.`, no new
Blocker/Major). The re-review deferred one Major from unchanged text — T9
mutates `src/kb.ts` while only `src/quota.ts` was declared mutation-only — and
it is resolved by a **condition-only amendment**: `src/kb.ts` is now named in
the §Blast radius mutation-only paragraph, the §Evidence target list, T9's
`git status` confirmation, and the plan-gate preflight evidence. No new file, gate,
or destructive operation is introduced, so the amendment is verified by
`build-review` rather than a second review pass. At the cap an unresolved item
would have been escalated to the user; none remained.

## Phases and steps

### Phase 0 — Scaffold and baseline

- **T0.** Create `tasks.md` (this step list) and `aar.md` seeded with
  `LOOP OPEN`, so `check-loop-artifacts` sees a complete increment directory
  from the first gate run.
- **T1.** Record the baseline in `tasks.md`: `npm run status`, the full
  `npm run check` run (165.2 s, `HEAD` `fc6228c`, before this directory
  existed), the cold-pass report, and the predicate reads above.

### Phase 1 — Spec probe list (commit 1)

- **T2.** Add the two §9.2 bullets beside `infobroker.md:1083-1084` and run
  `npm run validate-spec` → green. The bullets describe the probes the tests
  in Phases 2–3 implement, so they are authored first and the commits follow
  the spec → source/test → docs order. **commit 1** (`docs(spec)`).

### Phase 2 — State ownership evidence (F-R8-F-1)

- **T3 — fail-before.** Add the helper, the two tests, and the
  malformed-test change to `src/key-pool.test.ts` (header, `vi` import,
  describe) **before** the production guard. Run `npx vitest run
  src/key-pool.test.ts`: the write test is expected green (the save-path
  guard already exists) and the **read test must be red**, returning `"k2"`
  where the assertion wants `"k1"`. That red run is the fail-before evidence;
  if both are green, the fresh module is not fresh (or the malformed-test
  change did not land) — record and re-scope.
- **T4.** Add `assertOwnedDir` and the `loadState` guard to
  `src/key-pool.ts` per §Design — REQ-100; re-run `npx vitest run
  src/key-pool.test.ts` → green.
- **T5.** Add the quota read-refusal test per §Design — REQ-100; run
  `npx vitest run src/quota.test.ts` → green.
- **T6 — mutation checks.** (a) Remove the `loadState` guard → the key-pool
  read test must fail; (b) replace the uid compare in `ensureStateDir` with
  `false` → the key-pool write test must fail; (c) replace the uid compare in
  `src/quota.ts:41-46` with `false` → the quota read test must fail. Restore
  all three files byte-identically (`sha256sum` before/after) and re-run
  green. Confirm `git status --porcelain` shows only the intended files (no
  `src/quota.ts` change). Transcripts in `tasks.md`.
- **T7.** `npm run typecheck` and `npx vitest run src/key-pool.test.ts
  src/quota.test.ts` → green; **commit 2** (`fix(key-pool)`).

### Phase 3 — Keys-directory creation evidence (F-R8-F-2)

- **T8.** Add the creation test to `src/kb-encryption-tools.test.ts` per
  §Design — REQ-099; run `npx vitest run src/kb-encryption-tools.test.ts` →
  green.
- **T9 — mutation check.** Remove the `mkdirSync` from `resolveKeyFile` →
  the creation test must fail; restore byte-identically (`sha256sum`
  before/after) and confirm `git status --porcelain` shows no `src/kb.ts`
  change; re-run green. Transcript in `tasks.md`.
- **T10.** `npx vitest run src/kb-encryption-tools.test.ts` and
  `npm run typecheck` → green; **commit 3** (`test(kb)`).

### Phase 4 — Bookkeeping

- **T11.** Add `D-113` to `DECISIONS.md` (highest existing id `D-112`): the
  ownership refusal is asserted by substituting `process.getuid` — no root,
  no ownership-changing syscall; the read direction needed a key-pool guard;
  the quota write path is asserted only through the shared `ensureDir` and is
  a named residual; keys-directory creation is asserted in
  `kb-encryption-tools.test.ts` because the code lives in `resolveKeyFile`,
  not `kb-crypto.ts`. **commit 4** (`docs(decisions)`).
- **T12.** `worklist.md`: surface rows `:482` (REQ-099) and `:483` (REQ-100)
  → `**Resolved 2026-11-13**` with the new test paths in the Predicate cell;
  register rows `:878`/`:879` → `**Resolved 2026-11-13**` with the evidence
  sentence (including the quota-write residual for F-R8-F-1); correct the
  stale `src/kb-crypto.ts` anchor at `:879` to `src/kb.ts:1226-1235`, and
  refresh the `src/key-pool.ts:63` anchor at `:483`/`:878` to the post-edit
  line number (the guard moves `loadState` down). **commit 5**
  (`docs(plans)` — resolve the R8 state-hardening rows).
- **T13.** Add the new `## 2026.11.11 — <title>` section as the **top**
  section, immediately after `# Changelog` and above
  `## 2026.11.11 — R8 notice and REQ-096…` (`:3`), naming the key-pool read
  guard as the one behaviour change and the reference tail
  `(REQ-099; REQ-100; F-R8-F-1; F-R8-F-2; D-113)`. **commit 6**
  (`docs(changelog)`); `npm run version-sync` green.
- **T14.** `npm run validate-spec` and `npm run check-gate-coverage` → green;
  **then** remove `ROADMAP.md:17-22`; `npm run check-roadmap` → green;
  **commit 7** (`docs(roadmap)`). § Review-loop convergence and § Hermetic
  test option forwarding stay: the first is a user decision, and the second's
  trigger ("the next increment that touches the hermetic harness") does not
  fire because this increment adds no harness call.

### Phase 5 — Gates and close

- **T15.** `npm run check-roadmap`, `npm run version-sync`, `npm run test`,
  `npm run check-loop-artifacts`, `npm run check-shipped-kb-empty`.
- **T16.** Rewrite `aar.md` with dispositions, the cold-pass cap and its
  findings, the quota-write residual, every gate result so far, and the
  terminal token. `npm run session:close`.
- **T17.** `npm run check` on the complete tree (full suite, un-piped, exit
  status recorded) — after T16 so `check-loop-artifacts` is satisfiable.
- **T18.** Write the T17 exit status into `tasks.md`/`aar.md`; re-run
  `check-loop-artifacts` and `check-roadmap`; **commit 8** (`docs(plans)` —
  record the R8 state-hardening increment). The only delta after T17 is
  documentation; T19's `check:fast` is the covering gate for the committed
  tree.
- **T19.** `npm run check:fast` on the committed tree as the closing
  session-loop gate.

## Commit series

Eight commits, each `typecheck`-clean, in the order the phases produce them
(spec → source+tests → docs). The two `docs(plans)` commits carry distinct
subjects so the series is unambiguous.

1. `docs(spec)`: the two §9.2 verification bullets (T2).
2. `fix(key-pool)`: `assertOwnedDir`, the `loadState` guard, the two
   key-pool tests, the malformed-test rework, the header, and the quota
   read-refusal test (T3–T7). Gate:
   `npx vitest run src/key-pool.test.ts src/quota.test.ts`,
   `npm run typecheck`.
3. `test(kb)`: the keys-directory creation test (T8–T10). Gate:
   `npx vitest run src/kb-encryption-tools.test.ts`.
4. `docs(decisions)`: `D-113` (T11).
5. `docs(plans)`: resolve the R8 state-hardening rows — the two surface rows,
   two register rows, anchor corrections (T12).
6. `docs(changelog)`: the CHANGELOG section (T13); `npm run version-sync`.
7. `docs(roadmap)`: removal (T14); `check-roadmap`, `validate-spec`,
   `check-gate-coverage`.
8. `docs(plans)`: record the R8 state-hardening increment — `plan.md`,
   `tasks.md`, `aar.md`, `plan.cold/` (T16–T18); `check-loop-artifacts`.

## Verification plan

| Step | Gate | Satisfiability evidence |
|---|---|---|
| Key-pool write refusal | `vitest run src/key-pool.test.ts` | `markKeyRejected` calls `saveState` synchronously (`src/key-pool.ts:230-234`); `ensureStateDir` throws on a foreign uid (`:60-65`); the throw precedes `openSync` (`:113-115`), so no temp file is created |
| Key-pool read refusal | same suite | a fresh module instance starts with `state = null` (`src/key-pool.ts:38-39`, `:266-269`), so `resolveApiKey` → `loadState` really reads the file; the new guard runs first and resets state; the post-restore fresh instance reads the same file, so the first result came from the guard |
| Quota read refusal | `vitest run src/quota.test.ts` | `loadQuotaState` calls `ensureDir` first (`src/quota.ts:130-136`) and its `catch` resets state (`:133-137`); the file is re-read after restore, so refusal ≠ corruption; the seed carries both counters (`:78`) |
| uid substitution is faithful | same suites | both guards read `process.getuid()` at call time (`src/key-pool.ts:60-62`, `src/quota.ts:41-43`); `typeof process.getuid === "function"` still holds under a stub; `(uid + 1) >>> 0 ≠ uid` |
| Keys directory created 0700 | `vitest run src/kb-encryption-tools.test.ts` | `resolveKeyFile` runs `mkdirSync(dir, { recursive: true, mode: 0o700 })` when absent (`src/kb.ts:1228`); umask 022 masks group/other, not owner bits |
| Creation is idempotent | same suite | the branch is guarded by `!existsSync(dir)` (`src/kb.ts:1228`) |
| Confinement still holds | same suite | the containment `relative()` check runs after creation (`src/kb.ts:1230-1233`); existing test at `:171-186` is unchanged |
| Gate citations | `check-gate-coverage` | REQ-099/REQ-100 are G1 and already cited (`src/kb-encryption-tools.test.ts:1`, `src/quota.test.ts:1`); added citations are additive |
| Clause tags | `validate-spec` | `detectClauseRequirements` returns 0/0 for both bodies (recorded in Baseline) |
| Whole-tree health | `npm run check` after T16 | 22 gates sequential (`scripts/lib/gate-manifest.ts`) |

## Edge cases and rollback

- **`getuid` not stubbable.** If `vi.spyOn(process, "getuid")` is rejected by
  the type checker, use the `Object.defineProperty` fallback and restore the
  original descriptor in `finally`; do not skip the test.
- **Running as root (CI).** The stub returns `(uid + 1) >>> 0`, which differs
  from the real uid at every value including the maximum, so the refusal path
  is exercised either way.
- **The write-refusal test leaves a temp file.** `saveState` opens the temp
  file only after `ensureStateDir`, so a temp file means the guard ran after
  the throw point — stop and record; do not loosen the assertion to "no state
  file" alone.
- **The read test is green before the guard, or returns `"k2"` after it.**
  The module is not fresh: `resetKeyPoolStateForTests()` seeds an empty
  state object and `loadState` returns early, so no file is read. Use
  `freshKeyPool()` and record the observed state; do not fall back to the
  shared seam.
- **Directory removed between `existsSync` and `statSync`.** The read guard
  audits `key_pool_state_read_refused` and resets state. The write guard has
  the same inherited shape. Both are safe (no state written, corruption
  impossible); the audit text is informational.
- **Quota test interference.** The quota path is cached per module; the new
  test reuses `quotaFile` and must not set `INFOBROKER_QUOTA_STATE`. A stray
  30 s timer from an earlier test writes only to the same file and can only
  affect the post-restore assertion, not the refusal assertion.
- **`mkdirSync` mode under a restrictive umask.** Owner bits are set
  explicitly; if a future environment sets a umask that strips owner write,
  the mode assertion fails loudly rather than silently passing.
- **Rollback.** Revert commits 2–3 as a set. The mutation transcripts are not
  commits; all mutated files are restored byte-identically (sha256 compared)
  before commit 2, and `git status --porcelain` proves no `src/quota.ts`
  change survives.

## Conditions to verify during execution

- **C-1** — the key-pool read test must be **red before** the guard (T3) and
  green after it (T4). A read test that is green before the guard is not
  reaching the read path; stop and re-scope rather than accepting a green
  run.
- **C-2** — no REQ body edit. REQ-099 and REQ-100 are unchanged; the only
  spec edit is the §9.2 verification list.
- **C-3** — the ownership tests prove behaviour (no write / no read), not the
  audit line. Do not add an `INFOBROKER_CONFIG` override to the state test
  files.
- **C-4** — the review cap: one cold pass (done) plus at most one targeted
  diff re-review; at the cap an unresolved item goes to the user.
- **C-5** — `npm run check` runs only after `aar.md` carries a terminal
  token.
- **C-6** — no config, dependency, gate-manifest, or tool-schema change.

## Unknowns

- Whether `vi.spyOn(process, "getuid")` type-checks; the fallback is named.
- Whether any other test file depends on key-pool state being read from a
  directory the process does not own. Expected none: no test sets a foreign
  uid today (`grep -rn "getuid" src` returns the two modules only); T7's
  targeted run and T17's suite settle it.
- Whether the post-restore quota read is affected by counters a previous test
  left in the seeded file; the test seeds its own slug (`owned`) and asserts
  that slug only, so unrelated counters cannot change the result.

## Evidence

- Plan artifact: stamped copy under
  `~/.local/state/opencode/plans/<repo-key>/`, sha256 recorded on the stamp.
- Cold pass: `plan.cold/` in this directory — `00-scope.md`,
  `01-02-stages.md`, `03-critics.md`, `04-rezoom.md`, `05-readiness.md`,
  `report.md`. Revision 2 resolves the Blocker and both Majors plus all six
  Minors; the targeted diff re-review is recorded in the same directory.
- Declared targets are the ten file paths in the Blast radius table plus this
  increment's own directory. `src/quota.ts` and `src/kb.ts` are mutation-only
  targets (restored byte-identically, never committed).
