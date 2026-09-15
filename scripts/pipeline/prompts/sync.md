Sync the Infobroker MCP server implementation against the current
specification (infobroker.md). Scope your work to what changed this run —
do NOT re-audit the whole REQ surface.

1. Determine the change set:
   - `git diff HEAD -- infobroker.md` gives the REQ bodies added or modified
     this run. The read-through summary is at <READTHROUGH_JSON>; read it for
     high-severity findings that imply a source change.
   - `git diff HEAD --stat -- src/` plus untracked files under src/ give the
     source already touched.
   If no REQ body changed and no high finding implies a source change, report
   `SYNC COMPLETE (no REQ changes).` and stop.
2. For each changed REQ, produce a gap disposition table:
   | REQ | Gap | Disposition | Reason |
   |-----|-----|-------------|--------|
   Auto-confirm all dispositions — this is a trusted automated pipeline.
   Audit only the changed REQs; do NOT use Task/explore subagents to
   re-audit every REQ.
3. Implement all gaps where disposition is 'implement'. Batch the edits.
4. Load and apply the testing skill. Author or extend unit and integration
   tests for the changed REQs only — do not expand blanket coverage.
5. After all edits, run once each: `npm run validate-spec`, `npm run
   typecheck`, and `npm test`. Fix any failure.
6. Run `npm run version-bump` to update the version in package.json and
   src/index.ts to today's date. Leave the `## <version> — ` header that
   version-bump seeds in CHANGELOG.md empty — do not add content to it (the
   changelog step owns CHANGELOG content).
7. Review: load and apply the code-review skill against the sync diff
   (`git diff` plus untracked source files). Fix all critical and high
   findings (auto-confirm — this is a trusted automated pipeline), then
   re-run `npm run typecheck` and `npm test` once. If any critical finding
   cannot be fixed, report it as a failure.
8. Smoke test: start the server and call `infobroker_inspect_providers`
   (action spec). Verify:
   - Tool count has not decreased from the baseline
   - Provider count matches config.json
   - `last_spec_review` timestamp is current (within 24 hours)
   If any check fails, report the failure before declaring sync complete.

Do NOT commit. End with 'SYNC COMPLETE.' if all steps pass.
