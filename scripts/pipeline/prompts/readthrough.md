Read infobroker.md end to end. Apply the proofreading skill to the spec
prose: grammar, spelling, punctuation, style, and consistency. Then run
the spec authoring audit directly against every REQ body (the mechanical
`validate-spec` gate covers structure; this step checks authoring
conformance): verify every REQ body conforms to the spec's authoring
conventions (AGENTS.md Appendix B / SR-011): contracts not implementations,
no parameter types, no Default: clauses, no enumerated catalogues, no
algorithm descriptions. Flag any violation with the REQ number, the
offending text, and the rule violated.

Also check: REQ block hygiene (missing `_Check:` citations), manifest
completeness, test ID consistency, tool name consistency, term definition
hygiene, and golden transcript coverage. Report findings with severity
tiers (critical / high / info).

Auto-fix findings where safe: typo corrections, missing punctuation,
whitespace normalization. Do NOT auto-fix: REQ body rewrites, structural
changes, test ID assignments, or anything that changes semantic meaning.

Write a a machine-parseable summary to <SUMMARY_JSON> with the JSON shape
{"status":"complete","critical":N,"high":N,"info":N} and end your reply
with the line: READTHROUGH <crit> critical; <high> high; <info> info.

Gate: halt on critical > 0. Warn on high > 0. Info is advisory.
