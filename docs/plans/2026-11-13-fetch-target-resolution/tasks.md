# Tasks — Fetch-target resolution before renderer dispatch

Plan: `plan.md` (revision 2, standard depth). Each task closes one done bar; do not
batch them across commits.

## T0 — Red-before probe (DB-1)

- [ ] Create `src/fetch-target.test.ts` holding only the structural case (C-5).
- [ ] Run `npx vitest run src/fetch-target.test.ts` and record the failure: the
      `fetchPageContent` body in `src/index.ts` does not contain `withGuardedTarget(`.
- [ ] Save the failing output in the AAR's verification table.

Writing the structural case alone matters: it keeps the red an assertion failure rather
than a module-resolution error, since the test file does not yet import C-1.

## T1 — Guard seam (C-1)

- [ ] Add `src/lib/fetch-target.ts` with the header `// @implements REQ-021a renderer-path`.
- [ ] Export `withGuardedTarget<T>(url, allowPrivate, dispatch)` awaiting
      `assertPublicUrlResolved(url, allowPrivate)` before `dispatch`.
- [ ] `npm run typecheck`.

## T2 — Dispatch choke point (C-2)

- [ ] Wrap the `fetchPageContent` body (`src/index.ts:916-1028`, through the non-hedged
      `for (const slug of renderers)` loop) in `withGuardedTarget`.
- [ ] Confirm the guard precedes the cooldown check, the throttle, the hedge, and
      `provider.fetchPage`.
- [ ] `grep -c "withGuardedTarget(url" src/index.ts` → **1** (DB-3).

## T3 — Fallback call site (C-3)

- [ ] Wrap the inner `fetchPageContent(target, …)` call in the `resolveFetchFallback`
      callback (`src/index.ts:1356-1363`) in a `try`/`catch`.
- [ ] On `SsrRefusalError`: `audit("network_target_refused", target)` and **return
      `null`**, so `resolveFetchFallback` serves the bibliographic record
      (`src/fetch-fallback.ts:255-262`) instead of failing the request. Rethrow
      anything else.
- [ ] Confirm a non-refusal fallback failure is unchanged, and that a DOI whose
      open-access host resolves privately still returns metadata (REQ-021h).

## T4 — Contract cases (C-4)

- [ ] Add the six cases (private, rebinding/metadata, unresolvable, public, opt-out,
      non-HTTP scheme) with the counter assertion that `dispatch` never runs on refusal.
- [ ] The non-HTTP case asserts `SsrRefusalError` naming the protocol — **not**
      `UnsupportedProtocolError`.
- [ ] Header tag `@implements REQ-021a renderer-path`.
- [ ] `npx vitest run src/fetch-target.test.ts src/lib/url-guard.test.ts` → all pass (DB-2).

## T5 — Traceability (DB-4)

- [ ] `npm run validate-spec` → exit 0 (the new module's `@implements` header is what
      keeps this green).
- [ ] `npm run check-gate-coverage` → exit 0.
- [ ] `git diff --stat infobroker.md` → empty.

## T6 — Changelog (C-6)

- [ ] Add a new `## 2026.11.11 — <title>` section (do not append to the hermetic entry).
- [ ] Cover both bullets and name the `fetch.allow_private_urls` escape hatch.
- [ ] `npm run version-sync`.

## T7 — Increment record (C-7)

- [ ] Write the AAR with the cap record (1 self + 1 cold pass + 1 targeted re-review),
      the red output, the gate results, and the dispositions.
- [ ] Carry the untested-fallback limit into the AAR explicitly.
- [ ] `npm run check-loop-artifacts` → 0 errors for this increment.

## T8 — Final gate (DB-5)

- [ ] `npm run check` (full) exit 0 on the final tree.
- [ ] If it fails, reopen T1–T4 as an amendment to the open increment; do not start a
      new plan.
