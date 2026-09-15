Deep git-history scan for dead and stale code. This is a read-only audit — do
NOT modify files, run git GC, prune branches, or delete anything.

The deterministic scan (`scripts/scan-git-refs.ts`) already covers merged
branches and non-ancestor tags, and the step-1 gates cover the tool surface,
provider drift, and hardcoded versions. Do NOT repeat those. Focus on
git-history facts a gate cannot see:

1. Deleted-but-referenced files — run `git log --diff-filter=D --name-only`
   over history. Report any deleted path that a current tracked file still
   references (check README.md, config.json, AGENTS.md, package.json, src/,
   and skills/). Historical mentions in CHANGELOG.md or DECISIONS.md that
   describe the deletion are not findings.
2. Stale identifiers on recent refs — an identifier (REQ id, `infobroker_*`
   tool, provider slug) present on a tag or branch in the current CalVer line
   but absent from current infobroker.md, src/index.ts, and config.json.
   Older release tags are historical and not findings.

For each finding, report: file:line, what is dead or outdated, and the
suggested fix.

Write a machine-parseable summary to <GIT_SUMMARY_JSON> with the JSON shape
{"status":"complete","findings":N} and end your reply with the line:
<LABEL> GIT SCAN COMPLETE. N findings. (N is the count — N=0 means clean.)
