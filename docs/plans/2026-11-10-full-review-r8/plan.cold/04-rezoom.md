# Stage 4 — Re-zoom (post-amendment)

Reviewer: review subagent (fresh context)
Plan sha256 at dispatch: `bebff03cd91a1e19d69419482385bf26b7ce0b4fa0e4abc14297c374242973f6`
Date: 2026-11-10

## Blockers

1. **[clarity] Appendix E double-assigned and prose counts inconsistent.** `:44` gave R8a four prose rows and R8b sixteen including Appendix E, while the same bullet and `:45` assigned Appendix E to R8a; `:13`/`:145` fixed R8a at four.
2. **[clarity] Probe leg (g) deferred to R8b although it is cluster A.** `:45` deferred (g); `:122` assigns it to cluster A and step 13 requires "legs c and g".

## Majors

3. `INFOBROKER_CONFIG_LOCAL` and the pre-leg resolved-path assertion missing from step 12.
4. "The server exposes no injectable fetcher (`src/update-check.ts:96,133`)" is contradicted by those very parameters — they are the injection points; only the call sites omit the argument.
5. The step-2 fallback was named but not defined.
6. Cluster G missing from the probe-dependence enumeration.
7. Provenance metadata did not bind stages to the amended sha.
8. Excluding `src/error-envelope.ts` from the P0 pool collides with R8-owned REQ-102 and D69.

## Nits

9. `policyMeta` citation short of `:142-150`.
10. Rehearsal root vs "every probe path under `/tmp/opencode/r8-probe/`".
11. "Network-free" update leg can still fetch.
12. Step 21's gate list omits `test-push-pipeline` and `test-debate-club`.
13. Split ownership of step 23(ii)/(iii) unstated.

## Unknowns

Whether the split triggers; whether the probe under `docs/plans/` trips a gate; whether `debate-club/src/client.ts` is the right stdio pattern.

## Judgement

Two partition-level blockers and six material majors; do not stamp `fresh` until they are resolved. All were resolved in the revision reviewed by the stage-5 re-audit.
