Scan the <SCAN_DIR> directory for dead and outdated data. This is a
read-only audit — do NOT modify any files. <SCAN_DIR> is one directory of
the project tree; also scan the root files (README.md, infobroker.md,
config.json, package.json, tsconfig.json, AGENTS.md, DECISIONS.md) and the
other tracked project directories (src/, scripts/, skills/, instructions/,
test-fixtures/) for stale references into and out of this directory.

Checklist:
1. REQ citations in source code — grep for REQ-\d+ patterns. Each REQ number
   must exist in infobroker.md. Report any that don't.
2. Deprecated or renamed terms — grep for any stale references to removed
   REQs, tools, or providers no longer configured.
3. Hardcoded counts — check if provider count, tool count, REQ count, or
   other numeric constants in source code match the `providers` spec action
   output or current infobroker.md.
4. Stale file paths — check import paths, config references, and README
   paths exist on disk.
5. Dangling cross-references in DECISIONS.md — verify every cited REQ and
   spec section reference resolves in infobroker.md.
6. Provider references — check config.json provider entries against
   src/providers/ files. Report providers in source with no config entry
   and vice versa.
7. Project-folder staleness — report root config/docs entries (paths, tool
   names, provider slugs, file references) that point at files no longer
   present in the tree, and files present on disk that nothing references.

For each finding, report: file:line, what's dead/outdated, and the suggested
fix.

Write a machine-parseable summary to <SUMMARY_JSON> with the JSON shape
{"status":"complete","findings":N} and end your reply with the line:
<LABEL> SCAN COMPLETE. N findings. (N is the count — N=0 means clean.)
