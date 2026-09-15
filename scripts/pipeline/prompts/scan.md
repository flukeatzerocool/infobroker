Deep semantic scan of the project directories in `<SCAN_DIRS>` plus the root
docs (README.md, infobroker.md, config.json, package.json, tsconfig.json,
AGENTS.md, DECISIONS.md). This is a read-only audit — do NOT modify files.

The deterministic scan (`scripts/scan-refs.ts`, `scripts/scan-git-refs.ts`)
and the step-1 gates (`validate-spec`, `validate-readme`, `version-sync`)
already cover the mechanical checks: REQ citations resolving, provider parity,
hardcoded counts and versions, broken documented paths, orphaned reference
files, merged branches, and non-ancestor tags. Do NOT repeat those. Focus on
semantic staleness a gate cannot see:

1. Deprecated or renamed terms — prose that names a removed REQ, tool, or
   provider as if it were still current.
2. Contradicted prose — statements in docs or skills that describe a file,
   flag, or behavior that no longer exists in the tree.
3. Cross-reference staleness — DECISIONS.md or skill references that cite a
   spec section or REQ whose meaning has since changed.
4. Dead exports in src/ — report only symbols that are neither imported
   elsewhere nor named by any exported declaration (a type named in an
   exported signature must stay exported for declaration emit). This class is
   P3-informational; report it, do not treat it as blocking.

For each finding, report: file:line, what is stale, and the suggested fix.

Write a machine-parseable summary to <SUMMARY_JSON> with the JSON shape
{"status":"complete","findings":N} and end your reply with the line:
<LABEL> SCAN COMPLETE. N findings. (N is the count — N=0 means clean.)
