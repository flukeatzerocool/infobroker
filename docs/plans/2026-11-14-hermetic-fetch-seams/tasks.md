# Tasks — Hermetic seams for the fetch-renderer chain and the crawl guard

## Step 0 — Baseline and plan gate

- [x] 0.1 `npm run status` and `npm run check` baseline recorded in `plan.md`; tree clean apart from the increment directory.
- [x] 0.2 Plan review: `plan-review` at standard depth; cold pass recorded under `plan.cold/` (report sha256 `83b8e206…`), the blocker and majors resolved, diff re-review passed; plan stamped `fresh`, plan sha256 `356ee991…`.
- [x] 0.3 Re-verified: `JINA_BASE` was a bare constant at `src/providers/jina.ts:6`, and the guard's protocol test precedes the `allowPrivate` test (`src/lib/url-guard.ts:94-97`).

## Step 1 — Reader endpoint override (`src/providers/jina.ts`)

- [x] 1.1 `jinaBaseUrl()` reads `getEnvVar("jina", "_URL")`, normalizes a trailing `/`, defaults to `https://r.jina.ai/`; used by `fetchPage` and `health`.
- [x] 1.2 No `url_env` added to `config.json`; Jina stays usable with the variable unset (`providerUsable`, `src/config.ts:1179`).
- [x] 1.3 `src/providers/jina.test.ts`: default target, override without `/`, override with `/`, and the health base — `fetch` stubbed, no network. 4 passed.
- [x] 1.4 Mutation proofs: override read removed → 3 failed / 1 passed; normalization removed → 2 failed / 2 passed. Reverted.

## Step 2 — Renderer fall-through on the real handler (REQ-021f)

- [x] 2.1 `src/lib/stub-provider.ts`: `enable?: string[]` added to the options and the key set; the named providers are re-enabled after the isolation loop and an unknown slug throws.
- [x] 2.2 Case with its own inline reader stub (reader paths beginning `/http` counted separately) and its own spawned server: `enable: ["jina"]`, `chains.content_fetch: ["jina","native_fetch"]`, `fetch.allow_private_urls: true`, `fetch.cache.kb_read: false`, `output.hedge_enabled: false`.
- [x] 2.3 The fixture is asserted `isBotChallenge`-positive before use.
- [x] 2.4 Case asserts `status: "ok"`, `provider: "native_fetch"`, the page body and not the challenge text, and exactly one reader-path request.
- [x] 2.5 Tag: `// @implements REQ-021f renderer-fallthrough`.
- [x] 2.6 Mutation proof: `isBotChallenge(raw) && false` → failed with `provider: "jina"`. Reverted.
- [x] 2.7 Exhausted-chain case not added; the register row and D-119 record why.

## Step 3 — Crawl per-hop refusal under `allow_private_urls` (REQ-021d)

- [x] 3.1 `fileLogs: true` on the shared `beforeAll` config; no existing case asserted on the absence of a sink.
- [x] 3.2 Inline server: `/start` links to `/hop1` (302 → `ftp://example.com/x`) and `/hop2` (200).
- [x] 3.3 Asserts `status: "ok"`, results `[start, hop2]`, `attempts: 3`, `pages: 2`, and `network_target_refused` with the refused hop URL (plus an `existsSync` guard on the audit file — see the deviation).
- [x] 3.4 Tag: `// @implements REQ-021d per-hop-guard`.
- [x] 3.5 Mutation proofs: protocol test disabled → 1 failed (no audit file); crawl `audit()` removed → 1 failed. Reverted; `git diff src/index.ts src/lib/url-guard.ts` is empty.
- [x] 3.6 C-3 did not fire; no seam was added.

## Step 4 — Register, roadmap, docs

- [x] 4.1 `worklist.md`: `F-R4-B-3` and `F-R4-C-3` → `Resolved` with test, line, and the branch/exhausted-chain caveats.
- [x] 4.2 `ROADMAP.md`: section retired (4 sections → 3 work items).
- [x] 4.3 `DECISIONS.md`: D-119 (endpoint variable, no `url_env`/config key, normalization; protocol branch as the hermetic refusal).
- [x] 4.4 `CHANGELOG.md` entry; `README.md`, the `AGENTS.md` env table, and `infobroker.md` §6.4 name the override.
- [x] 4.5 `npm run validate-readme` → 0 error(s), 0 warning(s).
- [x] 4.6 `npm run validate-spec` → 0 source files without `@implements`, all checks passed; the generated auth reference was unchanged.

## Step 5 — Verification and close

- [x] 5.1 `npm run validate-spec` and `npm run check-gate-coverage` exit 0 (117 cited, 1 exempt, 0 waived).
- [x] 5.2 `npm run check:fast` → PASS (fast, 32.3 s).
- [x] 5.3 `npm run check` → PASS (full, 176.8 s); no run record, because the tree is dirty pre-commit.
- [ ] 5.4 Split commits — **not executed**: the session was authorized to execute the plan, not to commit. Planned split: source + tests; docs/registers/CHANGELOG; plan artifacts.
- [x] 5.5 `aar.md` written, ending `LOOP PAUSED`.

## Mutation log

| Clause | Mutation | Result |
|---|---|---|
| Jina default/override | `const override = undefined` (env read removed) | 3 failed, 1 passed (default stays green) |
| Jina normalization | `return override;` (slash rule removed) | 2 failed, 2 passed |
| REQ-021f fall-through | `isBotChallenge(raw) && false` | 1 failed — served `jina` with the challenge body |
| REQ-021d per-hop guard (protocol test removed) | protocol check in `assertPublicUrl` disabled | 1 failed — no `network_target_refused` audit line |
| REQ-021d per-hop guard (crawl skip removed) | `audit()` dropped from the `SsrRefusalError` branch | 1 failed — `existsSync(auditLogPath)` false |

## Deviations from the plan

- Cold review v1: Case B (exhausted chain) dropped — it reaches the archive fallback and cannot be hermetic; blocker resolved by scope, not by weakening.
- Task 3.3 gained an `existsSync(auditLogPath)` assertion so both guard mutations fail on a named boolean instead of `ENOENT`.
