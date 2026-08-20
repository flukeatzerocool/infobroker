Read infobroker.md end to end. Load and apply the proofreading skill in
spec mode. Verify every REQ body conforms to the spec's authoring
conventions (AGENTS.md Appendix B / SR-011): contracts not implementations,
no parameter types, no Default: clauses, no enumerated catalogues, no
algorithm descriptions. Flag any violation with the REQ number, the
offending text, and the rule violated.

The spec mode activates automatically when the document contains **REQ-**
blocks. Run all spec-mode checks (REQ block hygiene, manifest completeness,
test ID consistency, tool name consistency, authoring conventions, term
definition hygiene, golden transcript coverage). Report findings with
severity tiers (critical / high / info).

Auto-fix findings where safe: typo corrections, missing punctuation,
whitespace normalization. Do NOT auto-fix: REQ body rewrites, structural
changes, test ID assignments, or anything that changes semantic meaning.

Write a a machine-parseable summary to <SUMMARY_JSON> with the JSON shape
{"status":"complete","critical":N,"high":N,"info":N} and end your reply
with the line: READTHROUGH <crit> critical; <high> high; <info> info.

Gate: halt on critical > 0. Warn on high > 0. Info is advisory.
