# AAR — Hermetic seams for the fetch-renderer chain and the crawl guard

**Done bar:** see `plan.md` · **Review cap:** 2; used 2 passes (one cold plan pass, one permitted diff re-review) · **Date:** 2026-11-14

## What was planned

Close `F-R4-B-3` and the remaining per-hop clause of `F-R4-C-3` by making the
Jina reader endpoint a deployment variable and driving both clauses on the
spawned server, without adding a seam for the crawl guard.

## What happened

1. Plan gate: cold pass returned FAILED — one Blocker (the exhausted-chain case
   reaches the archive fallback and is not hermetic) and five Majors. The plan was
   revised: Case B dropped and recorded as out-of-scope-by-evidence; hedging
   disabled for the fall-through case; endpoint normalization added; D2 re-anchored
   on REQ-021h; `fileLogs` placement fixed. The one permitted diff re-review
   returned `independent-review passed.`; its three nits (a line citation,
   a missing mutation in the done bar, a config-key prefix) were applied before
   the stamp.
2. `src/providers/jina.ts`: `jinaBaseUrl()` reads `INFOBROKER_JINA_URL` through
   `getEnvVar`, normalizes a trailing slash, defaults to `https://r.jina.ai/`;
   `fetchPage` and `health` both use it. `config.json` untouched — no `url_env`,
   so Jina stays usable with the variable unset.
3. `src/lib/stub-provider.ts`: `enable?: string[]` re-enables a shipped provider
   after the isolation loop and rejects an unknown slug.
4. `src/fetch-page-extraction.test.ts`: fall-through case with its own loopback
   reader stub and its own spawned server (hedging off); crawl refusal case over a
   redirect-to-`ftp:` hop on the shared server; shared config gained
   `fileLogs: true`; two clause tags.
5. `src/providers/jina.test.ts`: default endpoint, both normalization shapes,
   and the health base, with `fetch` stubbed (no network).
6. Docs and registers: `worklist.md` rows → `Resolved` with test and line and the
   branch caveat; `ROADMAP.md` section retired (4 sections → 3 work items);
   `DECISIONS.md` D-119; `CHANGELOG.md` entry; `README.md`, `AGENTS.md`, and
   `infobroker.md` §6.4 name the endpoint override.

## What went right

- The cold pass caught a defect that would have put a live archive.org request
  inside `check:fast`; the fix was a scope cut, not a weakened assertion.
- The crawl clause closed with no production change: the guard's protocol branch
  already refuses a hop the private-target opt-out would otherwise allow, so the
  planned seam was unnecessary.
- Every mutation discriminates: each new assertion fails with the branch it names
  removed and passes on the restored tree.

## What went wrong

- The first plan asserted an off-chain fact (that a port in a disabled provider
  cannot be reached) without checking `resolveProvider`, and depended on hedging
  behaviour it had not read. Both were found by review, not by the author.
- The register row's own premise was wrong: it said refusal was "gated solely by
  `allowPrivate`", omitting the protocol test two lines above. The row now states
  which branch drove the clause.

## Findings

| # | Finding | Severity | Disposition |
|---|---|---|---|
| 1 | Planned exhausted-chain case is not hermetic (archive fallback, `src/fetch-fallback.ts:281`) | P1 (normative gap in the plan) | Resolved in-session — case dropped before execution, recorded as out of scope with its existing REQ-021h taxonomy coverage |
| 2 | Hedge race could satisfy the fall-through assertion without the challenge being classified | P2 | Resolved in-session — `output.hedge_enabled: false`, sequential loop, mutation proves it |
| 3 | Register row premise omitted the guard's protocol branch | P2 | Resolved in-session — row rewritten, branch named, address-class branch cited to its unit test |
| 4 | `resolveProvider` resolves a named provider even when `enabled: false` | P3 | Closed as informational — an explicit `renderer` parameter is a direct request and no failure was demonstrated; chain selection still filters by `providerUsable` |
| 5 | Audit assertion failed as `ENOENT` instead of a clear boolean | P3 | Resolved in-session — `existsSync` assertion added ahead of the read |

## Verification

| Step | Files | Command | Result |
|---|---|---|---|
| Baseline | — | `npm run check` | PASS, 22 gates, 159.4 s at `a904207` |
| 1 endpoint | `src/providers/jina.ts`, `src/providers/jina.test.ts` | `npx vitest run src/providers/jina.test.ts` | 4 passed; `npx tsc --noEmit` → 0 |
| 2 fall-through | `src/lib/stub-provider.ts`, `src/fetch-page-extraction.test.ts` | `npx vitest run src/fetch-page-extraction.test.ts` | 14 passed (file), incl. the new case |
| 3 crawl guard | `src/fetch-page-extraction.test.ts` | `npx vitest run src/fetch-page-extraction.test.ts src/providers/jina.test.ts` | 18 passed |
| 4 docs/registers | `worklist.md`, `ROADMAP.md`, `DECISIONS.md`, `CHANGELOG.md`, `README.md`, `AGENTS.md`, `infobroker.md` | `npm run validate-spec`; `npm run validate-readme`; `npm run check-roadmap`; `npm run check-gate-coverage` | spec 0 errors; readme 0/0; roadmap OK (4 sections); gate coverage 117 cited / 1 exempt / 0 waived |
| 5 gates | — | `npm run check:fast` | PASS (fast, 32.3 s) — `check-loop-artifacts` green once this file existed |
| 5 gates (full) | — | `npm run check` | PASS (full, 176.8 s); no run record was written because the tree is dirty pre-commit — the tree-keyed record is written by the release path |

## Mutation log

| Clause | Mutation | Result |
|---|---|---|
| Jina default/override | `const override = undefined` (env read removed) | 3 failed, 1 passed (default case stays green) |
| Jina normalization | `return override;` (slash rule removed) | 2 failed, 2 passed (no-slash and health cases) |
| REQ-021f fall-through | `isBotChallenge(raw) && false` in the renderer attempt | 1 failed — served `jina` with the challenge body instead of `native_fetch` |
| REQ-021d per-hop guard | protocol test in `assertPublicUrl` disabled | 1 failed — no `network_target_refused` audit line exists |
| REQ-021d per-hop guard | crawl's `SsrRefusalError` branch loses its `audit()` | 1 failed — `existsSync(auditLogPath)` false |

Every mutation was reverted; `git diff src/index.ts src/lib/url-guard.ts` is empty.

## Deviations from the plan

- Task 3.3 gained an `existsSync(auditLogPath)` assertion so the two guard
  mutations fail on a named boolean rather than an `ENOENT`. Within the step's
  intent, recorded here.
- No other deviation. The Case B removal was a pre-execution plan amendment, not
  an execution deviation.

## Not done

- No commit and no push: the session was authorized to execute the plan, and the
  commit split is a separate step (source + tests; docs; plan artifacts).
- `C-4` note: the full `npm run check` ran on the final tree, so the registry-backed
  `audit` gate was executed rather than substituted.

**Review cap:** 2; used 2 passes.

LOOP PAUSED
