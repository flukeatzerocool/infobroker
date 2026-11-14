# Tasks — Close the handler-level evidence rows, re-scope the seam-blocked residual

Execution order. A step is ticked only when it is verified.

**Plan:** `plan.md` (revision 3, sha256 `32454c8f…4bab04ea0`) · **Roadmap item:** `ROADMAP.md` § Missing test evidence across R4–R6

## Census (from plan.md, re-verified 2026-11-14)

| # | Row (worklist line) | Verdict | Test home |
|---|---|---|---|
| 1 | `F-R5-A-4` (`:743`) | open — drivable → **resolved** | `src/verify-claims-bounds.test.ts` (new) |
| 2 | `F-R6-D-3` (`:820`) | open — drivable (handler half) → **resolved** | `src/kb-handler-lock.test.ts` (new) |
| 3 | `F-R6-E-3` (`:823`) | open — feasibility gated → **blocked (measured)** | `src/kb-capacity-heap.test.ts` not written |
| 4 | `F-R4-B-3` (`:702`) | blocked — pointer only | seam section |
| 5 | `F-R4-C-3` per-hop-guard (`:709`) | blocked — sub-clause only | seam section |

## Step 0 — Increment record and baseline re-check

- [x] 0.1 `docs/plans/2026-11-14-handler-level-evidence-rows/plan.md` written; `tasks.md` seeded with the step list and the census table.
- [x] 0.2 `npm run check:fast` on the unchanged tree → **PASS** (fast, 28.5 s). Baseline `npm run check` at `6893c13` → PASS, 22 gates, 159.6 s.
- [x] 0.3 Target files absent; blocker probes hold (`src/providers/jina.ts:6`, `src/lib/url-guard.ts:97`).
- [x] 0.4 `check-loop-artifacts` expected red from 0.1 until 5.4 lands `aar.md`.

## Step 1 — Row 1, REQ-026g handler bounds

- [x] 1.1 Suite skeleton: `makeIsolatedConfig()` + a stdio client over a caller-supplied env.
- [x] 1.2 Temp config rewritten to `corroboration.max_batch_claims: 2` before spawn.
- [x] 1.3 Four rejection cases.
- [x] 1.4 Envelope assertions: `[ERROR]`, `error.code: invalid_input`, exact message.
- [x] 1.5 Four tags: `batch-both-inputs`, `batch-no-input`, `batch-empty-list`, `batch-cap`.
- [x] 1.6 Mutation proofs + revert; `typecheck`; file green (4 passed).

## Step 2 — Row 2, handler lock refusal and key-source precedence

- [x] 2.1 Fixture: isolated config, `kb.encryption.enabled: true`, no `key_file`, raw key in `INFOBROKER_KB_KEY`, `maintenance_interval_minutes: 0`; one document ingested; `flushKbWrites()`; store sha256 + size + mtime captured.
  *Implementation note:* `initKb` exposes no close (`src/kb.ts:351-356`), so the plan's "close the parent's store handle" is realized as the disabled maintenance writer plus a byte-level fingerprint. Key file written directly (base64 of 32 bytes) because `generateKeyFile` confines its target to the keys directory (`src/kb.ts:1251-1258`).
- [x] 2.2 Child A (env keys deleted): `claims` and `stats` refused with `config_error`; `encryption status` reachable with `locked`/`encrypted`/`none`/`false`/non-null `lock`; store byte-identical.
- [x] 2.3 Child B (key file holding the fixture raw key, no env key): `key_file`/resolvable/`enabled`; `claims` returns `[OK]`.
- [x] 2.4 Child C (bogus key file, valid env key): `key_file`/not resolvable/`locked` — no fallback.
- [x] 2.5 Five tags: `handler-lock-refusal`, `key-source-precedence`, `locked-encryption-reachable`, `claims-locked-refusal`, `store-unchanged-while-locked`.
- [x] 2.6 Mutation proofs + revert; `typecheck`; file green (3 passed, 4.2 s).

## Step 3 — Row 3, REQ-108 clause (a) feasibility probe

- [x] 3.1 `$TMPDIR` probe written (`/tmp/opencode/kb-heap-probe{,2,3,4,5,6}.mts`); source recorded in the AAR.
- [x] 3.2 Measurements:
  - Boot floor: 32 MB → exit 134 (V8 heap abort); **48 MB → booted in 1149 ms** and answered `manage_kb stats`.
  - Payload builds: 111,804,416 B (6792 chunks, chunk_size 2048) in 16,890 ms; 103,755,776 B (4828 chunks, 4096) in 21,885 ms; 135,081,984 B (8207 chunks, 2048) in 24,474 ms.
  - Reads at 48 MB: `stats`/`list`/`search`/`get` each returned `[OK]` in five of six runs; one `get` died with a V8 heap trace (probe4, third sequential child on a 99.0 MB store). Rerun of `get` at 48/96/192 MB passed.
  - Probe 6 (two sequential cycles of all four actions with reaped children) hung past 15 min and was killed.
- [x] 3.3 Decision rule applied → **blocked**: `W ≤ 20 s` is missed by two of three completed builds (16.9 s, 21.9 s, 24.5 s) and read-path determinism is unproven (1 of 6 `get` runs crashed; one cycle hung). No approximation substituted.
- [x] 3.4 Not executed — the lands branch is not taken.
- [x] 3.5 Recorded above, in `worklist.md:823`, and in `ROADMAP.md`.

## Step 4 — Rows 4–5, register re-scope

- [x] 4.1 `worklist.md`: rows 1–2 `Resolved`; row 3 blocked with the measurements; rows 4–5 keep their partial/blocked text plus the seam pointer.
- [x] 4.2 `ROADMAP.md`: evidence section reduced to row 3; new § Hermetic seam for the fetch-renderer chain and the crawl guard with two bullets and a trigger.
- [x] 4.3 `CHANGELOG.md`: one entry (2026.11.11 — Handler-level evidence).

## Step 5 — Verification and close

- [ ] 5.1 `npm run validate-spec`.
- [ ] 5.2 `npm run check-gate-coverage`; `npm run check:fast`.
- [ ] 5.3 `npm run check` (full).
- [ ] 5.4 `aar.md` with the cap line and terminal token.

## Mutation log

| Row | Mutation | Result |
|---|---|---|
| F-R5-A-4 | both-inputs branch body → `invalidInput("sentinel")` | 1 failed / 3 passed (only the both-inputs case) |
| F-R5-A-4 | refusal message → `claims accepts at most 10 entries` | 1 failed / 3 passed (only the cap case) |
| F-R6-D-3 | handler gate `action !== "encryption"` → `&& false` | 1 failed / 2 passed (locked-store case) |
| F-R6-D-3 | `kbEncryptionStatus` → `key_resolvable: true` | 2 failed / 1 passed (status-shape assertions) |
| F-R6-D-3 | `resolveKeySource` ignores a configured key file | 2 failed / 1 passed (key-file path + no-fallback) |
| F-R6-D-3 | key-file resolution falls back to the environment | 1 failed / 2 passed (no-fallback case) |
| F-R6-E-3 | — | not written (blocked) |

**D4 exemption:** the REQ-085 store-unchanged assertion (2.2) is not mutation-proved; its unit equivalent is `src/kb-encryption-sqlite.test.ts:124-126`. Every mutation above was reverted before its commit; `git diff src/` is empty.

## Deviations from the plan

- 2.1: no close API on the KB store, and `generateKeyFile` refuses a path outside the keys directory — both handled inside the same step, no new file.
- Step 3: the plan expected a single probe; six probe variants were needed to separate boot cost, build cost, and read determinism. All live outside the repo.
