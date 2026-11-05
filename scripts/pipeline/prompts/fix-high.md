The spec read-through recorded high-severity findings. They are advisory to
the deterministic gates, but the push pipeline will not ship with them
outstanding. Resolve them.

- Findings: <READTHROUGH_TXT>
- Counts: <READTHROUGH_JSON>

For each high finding:

1. Independently verify it against the tree. Read the cited REQ body, spec
   section, configuration key, and implementation. The reviewer is fallible:
   a finding can be false or already resolved, and a false finding must not
   be "fixed" into the spec.
2. If it is real, apply the smallest correct fix — spec prose or REQ body,
   implementation, configuration, test, or skill. Follow the spec authoring
   rules: contracts not implementations, the Appendix B mechanical limits,
   REQ manifest and §D taxonomy consistency, and README updates when a REQ
   or tool/provider claim changes. Do not weaken a contract to make a
   finding disappear.
3. If it is false or already resolved, change nothing and record the
   evidence.

Do not make unrelated changes. Run `npm run check` and fix only failures
your edits caused.

Write one disposition per high finding — `fixed` or `rejected`, each with a
one-line reason — to <FIX_TXT>.

Also write the same dispositions to <DISPOSITIONS_JSON> as a JSON array, one
entry per high finding in the order they appear in <READTHROUGH_TXT>:

[{"id":"H1","disposition":"fixed","evidence":"one line"},{"id":"H2","disposition":"rejected","evidence":"one line"}]

`disposition` is exactly `fixed` or `rejected`. The next step verifies these
entries, so an entry that overstates what changed sends the reviewer after a
fix that is not there.
