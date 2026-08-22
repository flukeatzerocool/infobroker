Sync the Infobroker MCP server implementation against the current
specification (infobroker.md). You already have the full REQ surface and
the current src/ tree in your context from the prior step.

1. If the prior read-through step modified infobroker.md, re-read it now.
2. Audit src/ — compare each source file against the REQs it implements.
   Produce a gap disposition table:
   | REQ | Gap | Disposition | Reason |
   |-----|-----|-------------|--------|
   Auto-confirm all dispositions — this is a trusted automated pipeline.
3. Implement all gaps where disposition is 'implement'. For each batch of
   changes, run `npm run typecheck` and fix any type errors before continuing.
4. After all changes, run `npm run validate-spec` to confirm REQ coverage
   is intact and `npm test` to confirm no regression.
5. Run `npm run version-bump` to update the version in package.json and
   src/index.ts to today's date.
6. Smoke test: start the server and call `infobroker_providers` (action spec). Verify:
   - Tool count has not decreased from the baseline
   - Provider count matches config.json
   - No confidence scores below 50%
   - `last_spec_review` timestamp is current (within 24 hours)
   If any check fails, report the failure before declaring sync complete.

Do NOT commit. End with 'SYNC COMPLETE.' if all steps pass.
