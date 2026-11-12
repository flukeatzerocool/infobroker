# Delta amendment — R3 `search_web` findings remediation

**Date:** 2026-11-11 · **Scope:** test-support and harness only, no production behavior change.

## D-1 — Test-support additions to `src/lib/stub-provider.ts`

The approved plan named the existing hermetic stub as the evidence surface for
F-R3-15 (collapse before the maximum slice) and F-R3-24 (deep reading under
compact verbosity). The stub could not express either case: it returned one
result on a fixed `https://example.com/stub` URL and served only the search
endpoint.

`StubProviderOptions` gained four additive, optional fields:

- `results` — number of results the `ok` mode returns (default 1).
- `urls` — explicit result URLs.
- `servePages` — return this stub's own `/page/N` URLs.
- `contents` — per-result text.

The stub also serves `/page/N` as a small HTML page so a deep read stays on the
loopback interface. Existing callers pass a mode string or `{ mode, delayMs }`
and are unchanged; the `ok` payload keeps its previous single-result shape by
default and now also carries a `snippet` field (the same text as `content`).

## D-2 — Arena client timeout in `debate-club/src/client.ts`

F-R3-22 makes a research compile derive more than one variant for an ordinary
multi-token query. The Arena research case therefore performs up to
`research.max_variants` searches plus a deep pass per variant, each bounded by
`deep.max_ms`, and exceeded the harness's fixed 30 s RPC timeout. The timeout
is raised to 60 s with a comment naming the reason. No assertion is weakened.

## Review note

Both deltas are test-support or harness constants, reversible, and outside the
declared blast radius. Per `build-review` §1 they are recorded here rather than
folded silently into the plan; the production change surface is unchanged.
