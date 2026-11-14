# Plan — Fetch-target resolution before renderer dispatch

**Status:** draft 2026-11-13 (revision 3 — re-review amendments) · **Depth:** standard
**Rollback:** revert three commits — (1) the guard module, dispatch wrap, fallback catch, and tests, (2) the changelog line, (3) the increment record. No runtime state, no schema, no config. Rollback cost 1 (0 add, 1 reversible edit, 2 destructive).
**Roadmap item:** none — this is register row `F-R4-A-2`, taken up directly from the full-review register. The roadmap gained items B–F in the same session; this one is the increment, not a queued section.
**Predecessor:** `fe740d3` (`docs(plans): record the hermetic option forwarding increment`)

## Review depth

**Standard.** The change sits on the SSRF trust boundary, it alters observable fetch
behavior (a target that resolves to a private address is now refused even when a
third-party renderer — not our transport — would have made the connection), and it
adds one module and one test file. Self pass, then one cold pass via
`independent-review`. Rollback cost 1, no destructive or external state, so it is not
deep.

## Baseline (verified this session)

- `npm run check:fast` → **PASS** (19/19 gates, 28.4 s) at `fe740d3`, before any edit.
- `npm run status` → version 2026.11.11 (latest tag v2026.11.07), 198 unpushed commits (oldest 4.1 d), **0 open roadmap items**.
- Defect evidence, read this session:
  - `src/index.ts:1150` — the only guard before dispatch is `assertPublicUrl`, a string / IP-literal check that never consults DNS.
  - `src/index.ts:908-936` — `fetchPageContent` reaches `provider.fetchPage(url)` at `:935` for any non-native renderer with no resolution step. The native branch at `:929` is guarded, because `fetchFollowRedirects` re-guards every hop.
  - `src/index.ts:882` — `assertPublicUrlResolved` exists in the file, but only inside `detectPageDate`.
  - Four of the five `fetchPageContent` call sites map a refusal to a refusal: `:711` → `:715` (null plus an audit entry), `:1212` → `:1216` (skip hop plus an audit entry), `:1280` → `:1284`, `:1343` → `:1347` (both `network_target_refused`).
  - **The fifth does not.** The `:1360` call sits inside the callback passed to `resolveFetchFallback` (`:1356-1363`), *outside* the `try` that closes at `:1352`. `resolveFetchFallback` (`src/fetch-fallback.ts:242`, `:265`) awaits `fetchContent` with no `catch`, so a refusal there escapes to the tool boundary as an internal error.
  - `src/lib/url-guard.ts:115-138` — `assertPublicUrlResolved(rawUrl, allowPrivate, resolver = defaultResolver)`; the resolver is injectable and already exercised by `src/lib/url-guard.test.ts:80-107` with a `stubResolver` covering private, rebinding, unresolvable, public, and opt-out cases. `assertPublicUrl` (`:87-99`) throws `SsrRefusalError` for a non-HTTP scheme; `UnsupportedProtocolError` is thrown only by `assertHttpUrlProtocol` (`:171`).
  - `scripts/validate-spec.ts:147-148` — every `src/**/*.ts` without an `@implements` header is an error, so the new module cannot ship without one.
- Spec: REQ-021a (`infobroker.md:271`) refuses "a URL whose host resolves to a loopback, private, link-local, or metadata address" with **no path qualifier**. The code, not the spec, is non-conformant. The §7 test plan (`infobroker.md:1084`) already names this exact test.
- Decision: D-047 (`DECISIONS.md:1520`) records "Hostnames are resolved and every resolved address is validated per hop and per request". The renderer path contradicts the recorded decision.

## Problem

`fetch_page` resolves and re-validates the target on the native path and in date
detection, but not on the path that hands the URL to a third-party renderer. A hostname
that passes the literal string check and resolves privately is forwarded to Jina (or
any configured renderer) unchanged. Two independent failures follow: the tool's own
REQ-021a promise is unkept, and `fetch.allow_private_urls=false` stops meaning what it
says for every renderer that is not `native_fetch`. Because the renderer makes the
connection, a private address is dereferenced by a third party on the caller's behalf
rather than by our transport — so the native-path fix already shipped does not cover it.

The fallback path adds a second face to the same defect: `resolveFetchFallback` fetches
a **different** target (the OpenAlex open-access URL, or the archive copy) which the
entry guard never saw. Guarding `fetchPageContent` makes that path reachable, so this
plan closes it rather than inheriting it.

## Change entries

**C-1 (S) — `src/lib/fetch-target.ts` (new, ~30 lines).** Header
`// @implements REQ-021a renderer-path` (required: `validate-spec` fails an uncited
source file). Export
`withGuardedTarget<T>(url, allowPrivate, dispatch: () => Promise<T>, resolver: Resolver = defaultResolver): Promise<T>`
that awaits `assertPublicUrlResolved(url, allowPrivate, resolver)` and only then invokes
`dispatch`. One seam, one ordering contract, testable without importing the server
module. The `resolver` parameter is **not** dead surface: C-4 is the only way to reach
it, and it is what lets the contract cases run without real DNS. **Alternative rejected:** calling `assertPublicUrlResolved` at each call site —
five edits, five chances to diverge, and a sixth call site added later would silently
miss it. **Alternative rejected:** guarding only when the chain lacks `native_fetch` —
the chain is config-driven, and the crawl/extract/fallback paths would no longer share
one rule. **Alternative rejected:** folding `assertHttpUrlProtocol` in — `fetch_page`
already runs it at `:1133` and maps the result to `invalid_input`, which is a caller
error rather than a network-target refusal; duplicating it inside the guard would turn
one refusal class into two.

**C-2 (S) — `src/index.ts`, dispatch choke point.** Wrap the whole `fetchPageContent`
body (`:916-1028`, through the non-hedged `for (const slug of renderers)` loop) in
`withGuardedTarget(url, allowPrivate, async () => { … })`. The guard runs before any
cooldown check, throttle, retry, hedge, or renderer dispatch. No signature change.

**C-3 (S) — `src/index.ts`, fallback call site.** The `:1356-1363` callback that
`resolveFetchFallback` invokes for the open-access target must not let a refusal escape,
and must not turn it into a hard failure of the whole request. Wrap the inner
`fetchPageContent(target, …)` call in `try`/`catch`: on `SsrRefusalError`, record
`audit("network_target_refused", target)` and **return `null`**, so
`resolveFetchFallback` treats it as a failed open-access fetch and serves the
bibliographic record it has already fetched from Crossref (`src/fetch-fallback.ts:255-262`).
Rethrow anything else. Required because that target is not the URL the entry guard saw,
and because the surrounding `try` closed at `:1352`. **Alternative rejected:** letting
the refusal escape as an internal error. **Alternative rejected:** returning
`network_target_refused` for the whole request — it passes, but it discards a metadata
answer the tool is required to serve (REQ-021h: "a metadata-only one SHALL return the
bibliographic record"), converting a tightening into a regression. Degrading to metadata
is also what the pre-change behavior produced, so this closes the gap without changing
the caller-visible outcome for a DOI.

**C-4 (S) — `src/fetch-target.test.ts` (new, ~75 lines).** Header
`// @implements REQ-021a renderer-path`. Table-driven unit test of C-1 with the existing
`stubResolver` shape: a private-resolving host refuses and `dispatch` is never called
(counter stays 0); a rebinding host answering `169.254.169.254` refuses; an unresolvable
host refuses (fail-closed); a public host runs `dispatch` exactly once and returns its
value; `allowPrivate: true` runs `dispatch` for a private host; a non-HTTP scheme
refuses with `SsrRefusalError` naming the protocol (what `assertPublicUrl` throws at
`url-guard.ts:94-95`).

**C-5 (S) — `src/fetch-target.test.ts`, structural case.** Read `src/index.ts` with
`readFileSync` (precedent: `src/tool-surface.test.ts:14`) and assert the
`fetchPageContent` body contains `withGuardedTarget(`. Rationale: the C-4 cases prove
the contract, but not that the choke point adopts it; without this case, deleting the
wrap leaves every test green. This is the red-before probe — it fails on today's tree
because the symbol does not exist.

**C-6 (S) — `CHANGELOG.md`.** New `## 2026.11.11 — <title>` heading (two same-version
headings already exist at `:3` and `:14`, so this is an added section, not bullets
appended to the hermetic entry) with two bullets: the resolved-address guard now runs
before any renderer receives the target, so a hostname resolving to a private or
metadata address is refused on every fetch path; and a host whose name cannot be
resolved is refused too. Name the `fetch.allow_private_urls` escape hatch.

**C-7 (S) — `docs/plans/2026-11-13-fetch-target-resolution/`.** `plan.md` (this text,
with the `**Review cap:**` and `**Done bar:**` lines), `tasks.md`, and `aar.md` at close.

## Blast radius

| File | Change | Size | Gate |
|---|---|---|---|
| `src/lib/fetch-target.ts` | new guard seam plus `@implements` header | S | `typecheck`, `test`, `validate-spec` |
| `src/index.ts` | wrap one function body; catch a refusal at the fallback call site | S | `typecheck`, `test` |
| `src/fetch-target.test.ts` | new contract cases plus structural case | S | `typecheck`, `test` |
| `CHANGELOG.md` | new same-version section | S | `version-sync` |
| `docs/plans/2026-11-13-fetch-target-resolution/{plan,tasks,aar}.md` | increment record | M | `check-loop-artifacts` |

No file outside this table is modified. No spec (`infobroker.md`) change: REQ-021a
already binds the behavior for every path, so this closes a conformance gap rather than
changing a contract. No config change and no new parameter on the tool surface.

## Verification

| Done bar | Step |
|---|---|
| **DB-1** — the red proves the gap | step 0: write C-5's structural case alone, run `npx vitest run src/fetch-target.test.ts` → fails because `withGuardedTarget` is absent from `src/index.ts`. Writing it alone is what keeps the red an assertion failure rather than a module-resolution error. |
| **DB-2** — the contract holds in code | after C-1..C-5: `npx vitest run src/fetch-target.test.ts src/lib/url-guard.test.ts` → all pass, including every case of C-4 |
| **DB-3** — exactly one dispatch wrap | `npm run typecheck` exit 0; `grep -c "withGuardedTarget(url" src/index.ts` → **1** (the count excludes the import line, which the plain symbol grep would match) |
| **DB-4** — traceability intact | `npm run validate-spec` exit 0 — the new module's `@implements` header is why; `npm run check-gate-coverage` exit 0 |
| **DB-5** — the tree is green | `npm run check` (full) exit 0 on the final tree; `check-loop-artifacts` shows `0 error(s)` for the new increment |

Not verified by a test: the C-3 degradation. `src/index.ts` cannot be imported by a
test (its `main()` connects a stdio transport at import time), and the hermetic harness
serves everything from loopback with `allow_private_urls` enabled, so it cannot produce
a private resolution. `resolveFetchFallback`'s metadata branch is already covered at the
unit level (`src/fetch-fallback.test.ts`), so the untested residue is the two-line catch
that reaches it. Recorded as a limit in the AAR, not claimed as covered.

## Commit order

0. Pre-edit: write C-5's structural case alone, run it, record the failure (DB-1).
1. `fix(fetch): resolve the target before any renderer receives it` — C-1..C-5. Gates: `npm run typecheck`, `npx vitest run src/fetch-target.test.ts src/lib/url-guard.test.ts`, `npm run validate-spec`.
2. `docs(changelog): record renderer-path target resolution` — C-6. Gates: `npm run version-sync`.
3. `docs(plans): record the fetch-target resolution increment` — C-7. Gates: `npm run check-loop-artifacts`.
4. `npm run check` (full) once on the final tree — DB-5.

A failure at step 4 reopens step 1's files as an amendment to the open increment.

## Risks and mitigations

- **One extra DNS lookup per fetch.** The native path now resolves at the choke point and
  again per redirect hop inside `fetchFollowRedirects`. Accepted: one lookup per
  `fetch_page` call, against a guard that currently does zero. Not gated — a timing
  assertion would be flaky.
- **A split-horizon name that only the renderer's resolver could resolve is now refused
  before the renderer tries.** The intended tightening, but a behavior change for anyone
  relying on the renderer's DNS. Mitigation: `fetch.allow_private_urls` remains the
  documented escape hatch, and C-6 states it.
- **Fail-closed on resolver failure can surface `network_target_refused` for a resolver
  outage.** The message names the host and says it could not be resolved, so the caller
  is not told to relax the private-network guard.
- **The structural case (C-5) is a text check, not a behavioral one.** It catches a
  dropped wrap, not a wrap moved after the dispatch. Mitigation: C-2 places the call
  around the whole body.
- **The fallback degradation is untested** (see Verification). Accepted with the reason
  recorded, because no harness can produce a private resolution end to end.
- **Resolve-vs-connect TOCTOU is unchanged** — D-047 names it as a residual risk; this
  change narrows, not widens, the window by resolving at one choke point.

## User impact

Tool output changes only for targets that resolve to a private, link-local, or metadata
address (now refused on every path, including a fallback-derived target) and for
hostnames that cannot be resolved (refused rather than attempted). No parameter, schema,
or response-shape change. No restart or config edit needed. Rollback cost 1.

## Amendment 1 — cold review, 2026-11-13

One cold pass (4 of 5 lenses, single context) returned `independent-review FAILED.`
with one Blocker and three Majors. Every finding was re-verified against the tree
before this revision.

| ID | Finding | Resolution in revision 2 |
|---|---|---|
| B1 | C-4's sixth case asserted `UnsupportedProtocolError`, which `assertPublicUrlResolved` never throws; DB-2 could not pass | Case now asserts `SsrRefusalError` naming the protocol (`url-guard.ts:94-95`); C-1 records why `assertHttpUrlProtocol` is not folded in |
| M1 | The claim that all five call sites map a refusal was false for `:1360`, and the wrap makes it reachable | New **C-3** catches the refusal at the fallback call site; Baseline states four of five; the untested residue is named |
| M2 | The new module needs an `@implements` header or `validate-spec` fails | Added to **C-1** and to the blast-radius row |
| M3 | `grep -n "withGuardedTarget"` also matches the import, so DB-3 was unsatisfiable | DB-3 now counts `withGuardedTarget(url` → 1 |
| m1 | C-2's range ended at `:1023`, excluding the non-hedged dispatch loop | Range corrected to `:916-1028` |
| m2 | The optional `resolver` parameter had no consumer | Dropped; C-4 exercises `withGuardedTarget` directly |
| m3 | "under the current version" would append to the hermetic changelog entry | C-6 now specifies a new `## 2026.11.11 — <title>` section |
| m4 | Unclear which file carries the `renderer-path` tag | Both: the module header and the test header |
| m5 | No end-to-end proof that a private renderer target returns `network_target_refused` | Recorded as a limit in Verification and carried into the AAR |

Cross-cutting change: the plan now schedules the fallback gap it would otherwise have
introduced, and the changelog entry covers it.

## Amendment 2 — targeted re-review, 2026-11-13

The targeted re-review returned `independent-review FAILED.` with one new Blocker and
one Major; the other eight findings were confirmed closed. Both were verified against the
tree before editing.

| ID | Finding | Resolution in revision 3 |
|---|---|---|
| B2 | Dropping the `resolver` parameter made C-4 unrunnable: without injected DNS, `allowPrivate: true` plus an unresolvable host still throws (`url-guard.ts:126-130`), and the public-host case would need live DNS | `resolver` **restored** on `withGuardedTarget`; C-1 states that C-4 is its only consumer, so it is a test seam rather than dead surface |
| M4 | C-3's hard `network_target_refused` would discard the Crossref record the fallback had already fetched, regressing REQ-021h's metadata-only clause | C-3 now catches **inside** the callback and returns `null`, so the metadata branch still serves; the hard-refusal option is recorded as considered and rejected |
| m6 | Second `fetchContent` call cited at `:259`, actual `:265` | Corrected in Baseline |
| m7 | `audit(...)` in C-3 named a fallback target not in scope at the outer call | Resolved by moving the catch inside the callback, where `target` is the parameter |

The `:259`/`:265` correction is citation-only; the claim that `resolveFetchFallback`
awaits `fetchContent` with no internal `catch` (span `:224-277`) holds.

**Review cap:** standard — 1 self pass plus 1 cold pass; at most 1 diff re-review, then escalate.

**Done bar:** DB-1 through DB-5 pass, the structural case fails on the pre-change tree
and passes after it, `grep -c "withGuardedTarget(url" src/index.ts` returns 1, the
fallback call site degrades a refusal to the metadata branch instead of failing the
request, and no REQ body is edited.
