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
4. Load and apply the testing skill. For every newly implemented or modified
   REQ, author or extend unit and integration tests covering its behavior —
   scope to the REQs touched this run, do not expand blanket coverage.
5. After all changes, run `npm run validate-spec` to confirm REQ coverage
   is intact and `npm test` to confirm no regression.
6. Run `npm run version-bump` to update the version in package.json and
   src/index.ts to today's date. Leave the `## <version> — ` header that
   version-bump seeds in CHANGELOG.md empty — do not add content to it (the
   changelog step owns CHANGELOG content).
7. Review: load and apply the code-review skill against the full sync diff
   (`git diff` plus untracked source files). Review for bugs, security,
   performance, readability, and maintainability with severity-tied feedback.
   Fix all critical and high findings (auto-confirm — this is a trusted
   automated pipeline), then re-run `npm run typecheck` and `npm test`. If any
   critical finding cannot be fixed, report it as a failure.
8. Smoke test: start the server and call `infobroker_inspect_providers` (action spec). Verify:
   - Tool count has not decreased from the baseline
   - Provider count matches config.json
   - No confidence scores below 50%
   - `last_spec_review` timestamp is current (within 24 hours)
   If any check fails, report the failure before declaring sync complete.

Do NOT commit. End with 'SYNC COMPLETE.' if all steps pass.
