# Stage 5 — Readiness (and one re-audit)

Reviewer: review subagent (fresh context) · Date: 2026-11-10

## First readiness pass — sha256 `bebff03c…`

Verdict: **NOT READY**. Four blockers:

1. Appendix E assigned to both R8a and R8b across `:13`, `:44`, `:45`, `:145`.
2. Split gate deferred probe leg (g) although R8a's step 13 requires it for `REQ-105`.
3. The committed probe harness had no specified invocation, transport, capture format, or root-confinement assertion.
4. The step-2 fallback was named but never defined.

Majors: the `src/update-check.ts:96,133` "no injectable fetcher" rationale is refuted by those lines; D72's `INFOBROKER_CONFIG_LOCAL` and pre-leg path assertion were absent from step 12; "state paths" was unenumerated; §2 F11's evidence file was not in any read list; step 23(iii) "written verbatim" had no referent.

Nits: `policyMeta` citation; `finalizeToolResult` off-by-one; rollback-cost wording; `--dry-run` semantics; "no notice array" vs "no `notices` key".

## Re-audit — sha256 `c3768594…` (the one permitted re-run)

Five of the six prior points were resolved in the text (Appendix E partition 5/15 and consistent at `:44`, `:45`, `:85`, `:145`; leg (g) in R8a; harness invocation `npx tsx …/probe.ts` spawning `npx tsx src/index.ts` over stdio with `structuredContent` capture and `probe-log.md`; the step-2 fallback defined with a file:line and a third-argument timeout; `INFOBROKER_CONFIG_LOCAL` cleared and the pre-leg path assertion present).

Remaining blocker B1: the update-check network-freedom claim was still inverted — `configureUpdateCheck`/`runUpdateCheck` default their fetcher to the real global `fetch` (`src/update-check.ts:96,133`), the server call sites simply omit the argument (`src/index.ts:99,2405,2582`), so the stated safety basis contradicted the same bullet's own malformed-cache clause and the risk section's "no injectable fetcher".

Remaining major M1: the split trigger could not be read consistently — "probe legs cover A, B, E, and F" versus "probe-dependent" and "only step 11 decides", with A and B both test-observed.

Nits: "R8a holds 5 and R8b 15" had no stated antecedent; the key-pool state file was unnamed.

**Re-audit verdict: `NOT READY — 1 blocker`. A readiness stage that fails twice is escalated, not looped.**

## Parent resolution after escalation

Both remaining findings were resolved in the artifact (final sha256 `2e8c0a4c9dcb6edc451e404136c92762391e7f25a89ebb7ab0a7eb89f7e21f4a`):

- leg (d) now states the **cache short-circuit** as the offline mechanism, records any absent/expired/malformed-cache sub-case under `state.update_check: true` as `NOT_RUN`, and the risk line says "no injectable fetcher *at the server's call sites*";
- the probe-dependence rule now distinguishes "has a probe leg" from "probe-dependent";
- the prose-row antecedent and the `key-pool.json` path were named.

No further readiness dispatch was run: the independent-review cap is reached and the residual is a single factual correction the parent was able to verify against the cited source. `build-review` should re-verify these three points at build start.
