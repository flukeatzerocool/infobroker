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

Also check semantic staleness a mechanical gate cannot see: prose or skill
references that name a removed REQ, tool, or provider as if it were still
current, or that describe a file, flag, or behavior no longer present in the
tree. Report these under the same severity tiers.

Do not re-implement the mechanical gates. `npm run validate-spec`,
`npm run validate-readme`, `npm run test`, and `npm run check-gate-coverage`
already verify REQ structure and mechanical limits, manifest completeness,
bidirectional citation, clause coverage, tool and provider names, and README
claims. Run a gate once if you need its output; do not rebuild its checks with
ad-hoc `npx tsx -e` or grep probes. Spend the step's effort on what the gates
cannot see: semantic staleness and prose quality.

Auto-fix findings where safe: typo corrections, missing punctuation,
whitespace normalization. Do NOT auto-fix: REQ body rewrites, structural
changes, test ID assignments, or anything that changes semantic meaning.

Use the Write tool to create <SUMMARY_JSON> (an absolute path) with exactly
the JSON shape {"status":"complete","critical":N,"high":N,"info":N}. Writing
this file is part of the step, not a formality: the pipeline gate fails the
run when the file is missing, unparseable, or its counts disagree with your
closing token. Do not state that you wrote it unless a Write tool call
succeeded. Likewise, claim an auto-fix only when an Edit or Write call for
it succeeded — a correction you describe but never apply leaves the spec
unfixed.

End your reply with this line, verbatim, as the final line:

READTHROUGH <crit> critical; <high> high; <info> info

Gate: halt on critical > 0. Warn on high > 0. Info is advisory.
