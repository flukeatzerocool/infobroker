# Tasks — R5 citation and prose remediation

- [ ] T1 (red) Add the two compact `get_citations` cases plus a `citations()`
      helper to `src/dispatch-orchestration.test.ts`; run them and record that
      the compact body has no `meta`.
- [ ] T2 Parameterize `compactEnvelope`/`pickRequiredMeta` in
      `src/verbosity.ts`, export `CITATION_REQUIRED_META_KEYS`, and add the
      shaper cases to `src/verbosity.test.ts`.
- [ ] T3 Thread `requiredMetaKeys` through `finalizeToolResult` in
      `src/structured-output.ts`; add the case to `src/structured-output.test.ts`.
- [ ] T4 Add the per-tool key map in `src/index.ts` and make the
      `get_citations` handler emit its full meta; T1 goes green.
- [ ] T5 Rewrite the §8.2 independence paragraph in `infobroker.md` around
      source families and `corroboration.family_similarity_threshold`.
- [ ] T6 Add the `CHANGELOG.md` bullet under `## 2026.11.11`.
- [ ] T7 Retire the roadmap section; disposition the two register rows and the
      two verdict rows (`:314`, `:324`) as `Resolved`; leave the M1 census
      snapshot alone.
- [ ] T8 Run `typecheck`, `validate-spec`, `validate-readme`, `check-roadmap`,
      `version-sync`, `test`, `test-debate-club`, then `npm run check`.
- [ ] T9 Commit in the planned order; record the AAR and its loop token.
