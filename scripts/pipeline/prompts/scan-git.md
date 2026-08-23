Audit the git repository and the Infobroker MCP server source for dead and
stale code. This is a read-only audit — do NOT modify any files, run git
GC, prune branches, or delete anything.

Part A — Git repo (refs + working tree):
1. Stale branches — run `git branch -a` and `git branch --merged main`.
   Report local branches already merged into main (safe to delete), and
   remote-tracking branches whose commits no longer exist on any local ref.
2. Stale tags — list `git tag`. Report tags pointing at commits that have
   since been superseded by a version bump (stale version tags), or tags
   whose code no longer matches the current tree.
3. Deleted-but-referenced files — run `git log --diff-filter=D --name-only`
   and cross-check every deleted path against current references in
   README.md, config.json, AGENTS.md, package.json, and `src/` imports.
   Report any path still referenced after deletion.
4. Stale cross-ref identifiers — `git grep` for REQ-\d+ numbers, tool names
   (`infobroker_*`), and provider slugs across all refs
   (`git grep <term> $(git for-each-ref --format='%(refname)')`), then
   report any identifier found in non-HEAD refs that no longer resolves in
   the current infobroker.md, src/index.ts, or config.json.

Part B — Infobroker MCP server source (static audit):
5. Tool surface reconciliation — every `server.registerTool("...")` name in
   src/index.ts must appear in infobroker.md, the README tool surface table,
   and skills/ references; and every tool the spec or README promises must
   be registered. Report tools missing from either side.
6. Provider drift — reconcile src/providers/*.ts, config.json providers,
   AGENTS.md provider registry, and skills/infobroker/references/
   provider-auth.md. Report any provider present in one place but missing
   from another.
7. Dead exports / unused imports — in src/, report exported functions,
   types, or constants never imported elsewhere, and imports of modules or
   symbols that no longer exist.
8. Hardcoded drift — compare build-version / numeric constants hardcoded in
   src/index.ts (e.g. the `version` string and any counts) against
   package.json and config.json. Report any mismatch.

For each finding, report: file:line, what's dead/outdated, and the suggested
fix.

Write a machine-parseable summary to <GIT_SUMMARY_JSON> with the JSON shape
{"status":"complete","findings":N} and end your reply with the line:
<LABEL> GIT SCAN COMPLETE. N findings. (N is the count — N=0 means clean.)
