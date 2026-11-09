# Tasks — R1 contract remediation

- [x] Baseline: clean tree at `ce7ed34`, 2 unpushed, `npm run check` green.
- [x] F-R1-1: `compactEnvelope` in `verbosity.ts`.
- [x] F-R1-1: apply compact in `finalizeToolResult` with text rewrite.
- [x] F-R1-1: tests for envelope compaction, notices retention, finding-shape preservation.
- [x] F-R1-2: `cacheHitPayload` routes the cache-hit path through `maybeTruncate`; reports `output_path`.
- [x] F-R1-2: test the full-file and in-band-note contract.
- [x] F-R1-3: `requestLimit` in `normalizer.ts`; use it at the provider call.
- [x] F-R1-3: test `requestLimit` bounds.
- [x] Cross-tool check 7/7 normal and 7/7 compact.
- [x] `check:fast` and `check` exit 0.
- [x] Worklist findings → `Resolved`; retire the roadmap remediation section; AAR.
- [ ] Commit.
