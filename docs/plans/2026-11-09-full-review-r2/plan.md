# Plan — Full-review sweep, chunk R2 (config, providers, resilience)

**Status:** approved with conditions; two post-cap amendments (C-1, C-2) recorded and verified by build-review · **Date:** 2026-11-09 · **Depth:** deep (worklist D4: this is the credentials chunk) · **Review route:** deep — self pass plus one cold pass; two targeted re-reviews used.
**Review independence:** fresh cold pass, 7 reviewer dispatches, 51/80 reads; cold artifact `/tmp/opencode/r2-cold/report.md`, sha256 `7b6c7e90…`. The cold pass reviewed plan sha256 `b41b0f5f…`; the two post-cap amendments changed the plan afterwards, so no passing token was issued.
**Risk accepted:** execution proceeds without a passing `independent-review` token at deep depth — the two post-cap amendments (C-1, C-2) are recorded here and verified by `build-review` §6; authorized by the user on 2026-11-09 ("add addressing d1 c2 to this plan. execute plan").

## Conditions

- **C-1 — Sub-defect notation.** The plan no longer uses the reserved `deferred:<chunk>` token for sub-surface defects. D20 and D21 now record them as a prose note in the predicate cell ("sub-surface deferred to <chunk>") with a `file:line`/`spec:line` pointer, and reserve `deferred:<chunk>` for a whole-REQ verdict per the worklist. *Verification:* read D20/D21 and the Phase 3 register instruction; no `deferred:` token appears in a sub-defect instruction.
- **C-2 — Non-closure after a split.** Phase 3 step 5 now says non-closure leaves the trigger on the current unit — R2a or R2b when split, R2 when unsplit — so it no longer contradicts the split that replaces the R2 row. D14 also states the R2a-close done-bar subset. *Verification:* read Phase 3 step 5 and D14; the non-closure instruction names the current unit, not a deleted row.
**Rollback cost:** 1 — review-only unless a bounded P0 fix lands; the close writes docs and split commits.
**Roadmap item:** `ROADMAP.md` § Full-repository review sweep
**Tracker:** `docs/plans/2026-11-09-full-review-sweep/worklist.md`
**Predecessor:** chunk R1 closed and its remediation retired, commit `3cba54c`, `LOOP PAUSED`.

## Done bar

**Done bar:** chunk R2 is closed when all 25 worklist REQs (`REQ-010`, `011`, `013`, `014`, `015`, `129`, `104`, `030`, `031`, `031a`, `032`, `033`, `034`, `035`, `036`, `037`, `038`, `040`, `070`, `071`, `095`, `024`, `024a`, `024b`, `024c`) and every R2-owned prose surface (§1 goals 1–2, SR-001, SR-004, SR-005, SR-006, SR-010, §5.3, §6.3, §7.1–7.3 limited per D18, App A) carry a verdict; every finding has a `file:line` or `spec:line` predicate, a P-severity, and a terminal disposition; zero P0 is open; the R2 verdict table and finding register are in `worklist.md`; the roadmap trigger names R3; `npm run check` exits 0 on the final tree after a final `npm run check:fast`; and the AAR ends `LOOP PAUSED`.

**Non-closure rule:** a P0 that cannot be fixed inside D12's bound stops the chunk. The AAR then ends `LOOP OPEN`, the roadmap trigger stays on R2, and the done bar is not claimed — the two conditions cannot both be satisfied.

## Scope

**In scope.** Configuration resolution and validation, the user layer and hot reload, credential pools, provider registration and tiers, provider status/latency/health reporting, throttling, quota, retry, timeout, cooldown, fallback chains, dispatch tables and task types, the provider privacy posture and its generated reference, and the App A catalog's accuracy against `config.json`.

**Out of scope.** Provider result parsing and normalization (chunk R3); `fetch_page` transport and extraction (R4); corroboration (R5); KB (R6); client artifacts and README (R7); deployment state paths (quota/update-check/state-health files) and its security surface (R8); task-type *classification* semantics beyond the financial chain (R3 owns REQ-020a). Cross-chunk calls into these modules are read only as evidence, never judged here. Configuration-path resolution (`getConfigPath`, `getUserConfigPath`) is in scope under REQ-010; the worklist's R8 code line naming a nonexistent `src/config-path.ts` is a tracker drift corrected at close (Phase 3 step 2).

## Decisions

- **D12 — Fix policy.** P0 fixed in-session within the R1 bound: at most 2 source files (a regression test file counts as one) and 100 changed lines, one attempt; exceeding it or failing to reach green lands `LOOP OPEN`. P1 scheduled on `ROADMAP.md`; P2 fixed only on a demonstrated failure; P3 record-and-close.
- **D13 — Increment record.** `docs/plans/2026-11-09-full-review-r2/` carries this plan, `tasks.md`, and `aar.md`; the worklist carries the verdict table and the finding register. If the chunk splits, the one `aar.md` carries the R2a verdicts with `LOOP OPEN` naming R2b, and is rewritten at R2b close with `LOOP PAUSED`.
- **D14 — Split rule.** R2 is the joint-heaviest chunk. A split is by cluster, so it never divides a review unit, and it is **decided at the end of Phase 1 and recorded before Phase 2**.
  - **R2a** = clusters A–E plus the §1 goals 1–2, SR-001/004/005/006/010, §5.3, §A.1–A.7 and §6.3 prose rows. REQs: `010`, `011`, `013`, `014`, `015`, `024`, `024a`, `024b`, `024c`, `034`, `036`, `037`, `040`, `070`, `071`, `104`, `129` (17).
  - **R2b** = clusters F–G plus the §7.1–7.3 prose row (per D18). REQs: `030`, `031`, `031a`, `032`, `033`, `035`, `038`, `095` (8).
  - The union is the 25-REQ list, 17 + 8, and every review unit including cluster H has exactly one owner. At an R2a close, the done bar applies to R2a's REQ and prose subset and the successor trigger is R2b, not R3.
  - **Trigger:** split when the Phase 1 enumeration records more than 120 distinct `file:line` predicates, or when four or more clusters each need a live probe. The amendment replaces the single R2 row in the worklist with R2a and R2b rows, each carrying its own REQ list, so the status-board chain reads R1 → R2a → R2b → R3. Each sub-chunk closes by the same checklist; the trigger cell advances to the next sub-chunk, and the chunk is complete only after R2b.
- **D20 — Cross-chunk output clauses.** R2 judges R2-owned REQ clauses that report another chunk's data as contract output: the presence and shape of the persistent-state paths and the KB block in `REQ-024c`. R8 owns the path derivation and safety, R6 owns the correctness of the KB quantities; a defect there is recorded as a prose note in that predicate cell — "sub-surface deferred to R8" / "to R6" — not as a finding row and not as a `deferred:<chunk>` verdict (the worklist reserves that token for a whole-REQ disposition). `REQ-033` is judged for persistence and reset behavior; R8 owns the SR-007 prose row, and a defect that violates both is filed once under R2 (`REQ-033`) while R8's prose row cites it.
- **D21 — Cross-chunk filing rule.** A defect found through an R2 verdict is filed under R2 when it violates an R2-owned REQ. A pure prose or module defect in another chunk's surface that violates no R2 REQ is recorded as a prose note in the predicate cell — "sub-surface deferred to <chunk>" plus a `spec:line`/`file:line` pointer — never as a finding ID and never as the reserved `deferred:<chunk>` verdict — except the clause-coverage blind spot, which D22 files under R9. `SR-003` belongs to R8; R2 judges key secrecy only through `REQ-011`/`REQ-104`. §6.3 endpoint rows are judged against `config.json` and the provider modules only as corroboration, not as an R4 module review; §5.3 is judged against `src/types.ts`, not against R1's helpers.
- **D22 — Clause-tag authority.** The REQ text governs, not the detector. `src/clause-coverage.ts` only counts parenthesized "or" groups and passes any REQ with two tags, so a branch it cannot see is still a clause finding (worklist calibration rule 5). The detector's blind spot is filed once as a P1 under R9 against `src/clause-coverage.ts` (`REQ-055`), with a pointer from the R2 verdict; this is the D21 exception.
- **D18 — §7.1–7.3 boundary.** R2 reviews §7.1–7.3 only where the text is a table or rule over `config.json` providers, capabilities, quota demotion, and cooldown exclusion (`REQ-030`, `REQ-034`, `REQ-038`). The task-type classification sentence about semantic similarity and the confidence floor belongs to `REQ-020a` and is deferred to R3; a defect there is filed once, under R3.
- **D19 — Deep rehearsal.** R2 touches credential handling, so the probes are rehearsed without reading or writing real secrets: `key-pool` and `getEnvVar` behavior is exercised only through tests and temp env vars, and no probe prints a credential value. Backout is `git checkout` of the review docs; no credential, config layer, or state file is mutated.
- **D15 — Citation resolution.** Classify `_Check:_` first: `REQ-024*` are G0+G1, so verify the registered tool schema and a live stdio response as well as the test; `REQ-129` is G1+G3, so verify the generated privacy reference and its staleness gate; the rest are G1 and require the cited test to exercise the stated behavior, not merely name the REQ.
- **D16 — State safety.** No review step may mutate the real user layer (`$XDG_CONFIG_HOME/infobroker/config.local.json`), the real quota file, operational-history file, or the real KB. Every live probe runs with a temp `TMPDIR` and a temp `INFOBROKER_CONFIG_LOCAL`; if a probe cannot be isolated it is `NOT_RUN`, not a finding.
- **D17 — No push.** Publication stays user-authorized.

## Evidence base (this session)

| # | Evidence | Source | Trust |
|---|---|---|---|
| EV1 | Baseline green at `3cba54c`: `npm run check` PASS (22 gates, 58.1 s); tree clean; 4 unpushed commits | tool output, 2026-11-09 | tool-output |
| EV2 | 25 R2 REQs confirmed in the worklist and the §9.5 manifest: §4.2 = 7, §4.4 = 10, §4.5 = 1, §4.6 = 3, plus `REQ-024`/`024a`/`024b`/`024c` from §4.3 | `infobroker.md`, `worklist.md` | repo |
| EV3 | Citation map: 010/015/037 `config.test.ts`, 011 `server-manifest.test.ts`, 013 `health-status.test.ts`, 014 `providers/generic-http.test.ts`, 129 `scripts/lib/provider-privacy.test.ts` + `privacy.test.ts`, 104 `key-pool.test.ts`, 030 `rate-limiter.test.ts`, 031 `hedge.test.ts` + `config.test.ts`, 031a/034 `chain.test.ts`, 032 `retry.test.ts`, 033 `quota.test.ts` (034 is carried by `chain.test.ts`, not `quota.test.ts`), 035/071 `http.test.ts` (071 also `lib/html.test.ts`), 036 `latency.test.ts`, 038 `cooldown.test.ts` + `error-envelope.test.ts`, 040 `config-patch.test.ts`, 070 `providers/index.test.ts`, 095 `providers/github.test.ts` + `providers/new-providers.test.ts`, 024* `index.ts` + `tool-metrics.test.ts` + debate-club `mcp-contract.test.ts` | `grep @implements`, 2026-11-09 | repo |
| EV4 | Surface: `config.ts` (1035 L, holds the path resolution and patch logic; `config-path.test.ts` and `config-patch.test.ts` are test-only files), `config-migrations.ts`, `key-pool.ts` (227 L), `rate-limiter.ts` (69 L), `quota.ts` (228 L), `retry.ts`, `cooldown.ts`, `health-status.ts`, `latency.ts`, `hedge.ts`, `chain.ts`, `providers/index.ts`, `providers/generic-http.ts`, `privacy.ts`, `lib/timeout.ts`, `lib/html.ts` | `wc -l`, `ls src/config*` | repo |
| EV5 | `REQ-013` already carries clause tags (`latency-threshold`, `partial-results`, `exhausted`, `quota-warning`) and `REQ-038` carries `rate-limit`/`anti-bot`; `REQ-104` and `REQ-031` carry none, and the detector cannot see unparenthesized branches (`src/clause-coverage.ts:17`, `:66`) — judged per D22 | `src/clause-coverage.ts`, `src/clause-coverage.test.ts` | repo |
| EV6 | `REQ-129` is generated by `scripts/lib/provider-privacy.ts` into `skills/infobroker/references/provider-privacy.md`; staleness is checked in `scripts/validate-spec.ts:409` | `scripts/lib/provider-privacy.ts` | repo |
| EV7 | `inspect_providers` dispatch: `list` at `src/index.ts:1841`, `health` at `:1843`; the `:2152` list branch is `manage_kb`'s list action, not this tool | `src/index.ts` | repo |
| EV8 | `REQ-031a` is implemented in `src/chain.ts:95` (comment at `:91`); `REQ-013`/`REQ-024a` share one assessment at `src/index.ts:1424`; `REQ-024c` counts exclude inline renderer fallbacks at `:1586`; `reloadConfig` is `src/config.ts:992`, `patchUserConfigLayer` `:294`, `applyUserLayerMigrations` `:255` | `grep -n` | repo |

## Review surface

| Cluster | Files | REQs | Carrying gates/tests |
|---|---|---|---|
| A — Config resolution and validation | `config.ts` (`loadConfig`, `getConfigPath`, `getActiveProviders`, `getDispatchChain`), `config-migrations.ts` | 010, 037 | `config.test.ts`, `config-path.test.ts`, `shipped-config.test.ts`, `validate-spec` |
| B — Hot reload and patch | `reloadConfig` (`config.ts:992`), `patchUserConfigLayer` (`:294`), `applyUserLayerMigrations` (`:255`), `reload_config` handler | 040 | `config-patch.test.ts`, `config.test.ts`, live isolated reload |
| C — Secrets, pools, privacy posture | `getEnvVar`, `key-pool.ts`, `privacy.ts`, `scripts/lib/provider-privacy.ts`, `skills/infobroker/references/provider-privacy.md` | 011, 104, 129 | `server-manifest.test.ts`, `key-pool.test.ts`, `privacy.test.ts`, `scripts/lib/provider-privacy.test.ts`, `validate-spec` privacy staleness |
| D — Registration and tiers | `src/providers/index.ts` (`resolveProvider`), `src/providers/generic-http.ts`, `src/providers/registered-slugs.ts`, `src/lib/html.ts` (`USER_AGENT`), `src/http.ts` (header injection), config `disabled` handling | 014, 015, 070, 071 | `src/providers/index.test.ts`, `src/providers/generic-http.test.ts`, `src/http.test.ts`, `src/lib/html.test.ts`, `config.test.ts` |
| E — Status, latency, reporting | `health-status.ts`, `latency.ts`, `index.ts:1424`–`:1645` action implementations, dispatch at `:1838`–`:1853` | 013, 024, 024a, 024b, 024c, 034, 036 | `health-status.test.ts`, `latency.test.ts`, `tool-metrics.test.ts`, `chain.test.ts` (034), debate-club `mcp-contract.test.ts`, live `inspect_providers` list/health/spec |
| F — Throttling, quota, resilience | `rate-limiter.ts`, `quota.ts`, `retry.ts`, `lib/timeout.ts`, `cooldown.ts`, `chain.ts`, `hedge.ts` | 030, 031, 031a, 032, 033, 035, 038 | `rate-limiter.test.ts`, `quota.test.ts`, `retry.test.ts`, `timeout.test.ts`, `cooldown.test.ts`, `chain.test.ts`, `hedge.test.ts` |
| G — Dispatch and task types | `config.json` dispatch table, `getDispatchChain`, `src/task-type.ts` (read only) | 095 | `src/providers/new-providers.test.ts`, `src/providers/github.test.ts`, config tests |
| H — Catalog and dispatch prose | §A.1–A.7, §6.3, §7.1–7.3 (per D18) vs `config.json` | prose | `shipped-config.test.ts`, `validate-spec` |

### Prose ownership (R2 rows)

| Surface | Owner | What is checked |
|---|---|---|
| §1 goal 1 free first / privacy | R2 | Default chain contains only no-auth providers; privacy posture claims match config |
| §1 goal 2 upgrade path | R2 | Keyed and self-hosted tiers remain optional and additive |
| §3 SR-001, SR-004, SR-005, SR-006, SR-010 | R2 | Invariant text matches the registration, zero-config, reload, and validation behavior |
| §5.3 plugin interface | R2 | Interface sketch matches the capability and tier unions in `src/types.ts` |
| §6.3 provider API conventions | R2 | Endpoint bases and rate notes match `config.json`; provider modules are corroboration only (D21) |
| §7.1–7.3 task types, dispatch, deprioritization | R2 (D18 limit) | Table matches `config.json` dispatch; quota demotion and cooldown exclusion match `chain.ts`; classification semantics deferred to R3 |
| §A.1–A.7 provider catalog | R2 | Every listed provider exists with the stated tier, auth, and endpoint, and no configured provider is missing |

## Steps

### Phase 0 — Baseline

1. Re-run `npm run check:fast` un-piped and record the exit status; run every carrying test un-piped: `npx vitest run src/config.test.ts src/config-path.test.ts src/config-patch.test.ts src/config-migrations.test.ts src/key-pool.test.ts src/privacy.test.ts src/rate-limiter.test.ts src/quota.test.ts src/retry.test.ts src/lib/timeout.test.ts src/cooldown.test.ts src/chain.test.ts src/hedge.test.ts src/health-status.test.ts src/latency.test.ts src/http.test.ts src/lib/html.test.ts src/error-envelope.test.ts src/server-manifest.test.ts src/shipped-config.test.ts src/providers/index.test.ts src/providers/generic-http.test.ts src/providers/github.test.ts src/providers/new-providers.test.ts src/tool-metrics.test.ts scripts/lib/provider-privacy.test.ts`.
2. Record `git status --porcelain` and `git rev-parse --short HEAD`; confirm `3cba54c` or note the drift.

### Phase 1 — Enumerate

1. Record `file:line` anchors for clusters A–H; confirm the 25 REQ rows against the worklist and the §9.5 manifest.
2. Record which R2 REQs are G0/G3 and which already carry clause tags (EV5); clause findings are adjudicated against the REQ text (D22).
3. Apply D14: count the distinct `file:line` predicates and the clusters needing a live probe. If the trigger fires, write the R2a/R2b amendment to `worklist.md` before Phase 2; if not, record `split: not triggered` and continue as one chunk.

### Phase 2 — Review (read-only)

1. Run `code-review` cluster by cluster in a fresh context and `drift-report` over clusters H and the §5.3/§6.3/§7.x prose.
2. Open every cited test and check the assertion against the REQ text. Specific branch checks:
   - **REQ-010**: user layer precedence; the three-way discovery order (`INFOBROKER_CONFIG_LOCAL` when set, else an existing layer beside the resolved default, else the user configuration directory); `INFOBROKER_CONFIG` override; defaults inheritance; preservation across update.
   - **REQ-011**: no key value in config, output, errors, logs, or `inspect_providers`; missing required key → `inactive`/`no_api_key`; optional key still operable.
   - **REQ-013**: `inactive` (both the missing-key and unreachable legs), `degraded` (latency, partial, and quota-warning legs), and `exhausted`; startup does not block on assessment. A leg with no clause tag is still a finding (D22).
   - **REQ-014**: a generic provider added from the user layer alone, declaring endpoint, request construction and authentication, liveness probe, and result mapping; appended to or referenced from a dispatch chain; invalid config rejected on load and reload.
   - **REQ-015**: disabled provider absent from chains and recommendations; configuration entry and backend module retained; disabled state preserved across updates.
   - **REQ-129**: posture fields derived from config, overrides win, `unknown` for an absent posture, the generated document is not stale, and the live `inspect_providers` list response reports the posture for every provider it lists.
   - **REQ-104**: rejection not retried, rate-limited cooldown while others serve, persistence across restart, empty pool → unavailable without blocking fallback, and no credential in config values, output, logs, errors, or provider reports.
   - **REQ-030**: per-provider scope, minimum interval, jitter, non-negative.
   - **REQ-031/031a**: priority order, disabled/unauthenticated exclusion, hedging switch, max depth, `all_providers_exhausted` vs empty-success, general_web retry once without repeating an attempted provider.
   - **REQ-032/035**: per-provider backoff/count and timeout; timeout as transient.
   - **REQ-033**: durable counters, UTC daily and month-boundary reset (D20: persistence behavior, not the path convention).
   - **REQ-034**: 80% `degraded` + `quota_warning`, 100% `exhausted` + skipped until reset.
   - **REQ-036**: bounded window, configurable strategy, no unbounded all-time accumulation.
   - **REQ-037**: every rejection class named in the REQ, and invalid reload keeps the previous config.
   - **REQ-038**: cooldown on rate-limit and anti-bot; skip during fallback without a new outbound call **even when the provider is the chain primary**; expiry; quota untouched; reported through `inspect_providers`; `retry_after_ms`; every provider-attributable error remediation naming the provider-status surface.
   - **REQ-040**: reload without restart, invalid → previous config still serves + error, patch merge/reject/preserve-backup/validate/rollback.
   - **REQ-070/071**: registration mapping independent of handlers, disabled-but-registered; one consistent outbound identifier across tiers and transports (evidence: `http.test.ts:27`).
   - **REQ-095**: `financial` classifies, chain providers are zero-config, at least one primary-source filings source and one economic-indicator source, falls back per REQ-031.
   - **REQ-024/024a/024b/024c**: live schema and stdio response; per-action fields, the four non-active reasons, list `status` filter, inline renderer marking, the health-without-`provider` error path (`src/index.ts:1844`–`:1846`), spec build identity/uptime/request count/state-file paths and the configured/enabled/active distinction excluding inline fallbacks, KB block when configured (D20), and health error/success timestamps — a fresh server has no history, so the probe first produces one success and one forced failure, or the predicate records `health-status.test.ts` plus the operational-history source as the evidence.
3. Live probes, isolated per D16. No probe mutates real state: every probe runs with a temp `TMPDIR` and a temp `INFOBROKER_CONFIG_LOCAL`; the patch probe is state-mutating only inside that temp layer. Probes: `inspect_providers {action:"list"}`, `{action:"spec"}`, `{action:"health", provider:<free_http>}`, `{action:"health"}` without a provider (error path), one success plus one forced provider failure before the health call; a `reload_config` with an invalid temp patch followed by an observation that the previous config still serves; a quota-persistence probe under the temp `TMPDIR`. Drive the server through a purpose-written stdio probe script under `/tmp/opencode/r2-probe/` (not committed): it spawns `npx tsx src/index.ts` with the temp env, speaks JSON-RPC over stdio, and enforces a 30 s per-call timeout. The debate-club client is not usable here — `debate-club/src/client.ts` hard-codes replay mode and owns its own temp config. A probe that times out or is blocked by network denial is recorded `NOT_RUN` with the reason, not a finding.
4. Check each carrying gate's assertion against the REQ it claims to carry; a green gate asserting less is a finding.

### Phase 3 — Disposition and close

1. P0 fix with a regression test inside D12; otherwise record P1/P2/P3.
2. Write the verdict table and finding register to `worklist.md`; correct the tracker drift found in this plan (both R2 entries — the chunk entry and the status-board row — omit §4.3 for `REQ-024*`; the R8 code line names a nonexistent `src/config-path.ts`).
3. Run `npm run check:fast`, then `npm run check`, un-piped, and record the exit status.
4. Only after the gates are green, write the AAR with the recorded gate evidence and the terminal token.
5. On closure, edit the next-trigger surface to name the next chunk: the `**Trigger:**` line of the single `ROADMAP.md` sweep section and the `Next trigger` cell of the worklist status board. On non-closure (P0 outside D12), leave both on the current unit — R2a or R2b when split, R2 when unsplit — and land `LOOP OPEN`.
6. `npm run session:close`; split commits after the final tree is green.

## Commit order

The deliverable is a commit series when the tree changes at close; each commit is `npm run typecheck`-clean and the final tree runs the full gate.

1. `fix(<area>): <P0 finding>` — only when a bounded P0 fix lands: source plus its regression test. Gate: `npm run typecheck` and the touched test files.
2. `docs(plans): close chunk R2 and record verdicts` — `worklist.md` verdict table, register, and tracker-drift correction; `ROADMAP.md` trigger advance on closure; this plan, `tasks.md`, `aar.md`. Gate: `npm run check-loop-artifacts`, `npm run check-roadmap`.
3. `docs(roadmap): schedule R2 findings` — only when a P1 landed: the ROADMAP section. Gate: `npm run check-roadmap`. A behavior change to a shipped surface would also need a CHANGELOG entry per `changelog-before-commit`; scheduling a review finding is not one.

A clean close collapses to commit 2 alone, which carries the trigger advance. A non-closure series ends after commit 2's AAR form, with the trigger unchanged.

## Risks

- **Chunk drag.** 25 REQs across 16 modules; D14 defines the split before work starts.
- **State leakage.** `reload_config` patch and quota probes write to real user state if not isolated; D16 is the guard.
- **G0 misclassification.** `REQ-024*` are G0+G1; a missing unit test is not a finding if the live schema and stdio surface are correct.
- **Privacy-doc finding vs generated artifact.** `REQ-129` findings should distinguish a stale generated file (regenerate) from a wrong derivation (`privacy.ts`).
- **Clause-tag false negatives.** The detector cannot see unparenthesized "or" branches and passes any REQ with two tags (D22); judge against the REQ text and file the detector gap once against `src/clause-coverage.ts`.
- **Shared files.** `chain.ts` is touched again by R3 (`REQ-020a`); `config-migrations.ts` is also in R8's code surface; `src/types.ts` and `src/http.ts` are shared with R1/R4. Here judge only the R2 predicates and defer the rest (D21).
- **Live network.** Health checks may be blocked; record `NOT_RUN`, do not inflate findings.
