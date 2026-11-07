The independent code review found high-severity defects in this run's code.
Resolve them with the smallest correct change.

- Findings: <SYNC_REVIEW_TXT>
- Counts: <SYNC_REVIEW_JSON>
- Write your dispositions to: <DISPOSITIONS_JSON>
- Write a short repair log to: <FIX_TXT>

Rules:

1. Independently verify each finding against the tree before editing. The
   reviewer is fallible: a false finding must not be "fixed" into the code.
2. Apply the smallest correct fix. Never delete or relax a test, gate,
   validation, or requirement contract to make a finding disappear.
3. Stay inside the reviewed diff. Do not refactor unrelated code.
4. Run only the targeted tests for the files you touched. The pipeline runs the
   full suite immediately afterwards and owns the final verdict.
5. Do not commit, tag, or push.

For each finding, record one entry in <DISPOSITIONS_JSON> as a JSON array:

[{"id":"1","status":"fixed","reason":"..."}]

Use status "rejected" with the reason when a finding is false or out of scope.
If a critical finding remains unfixable, say so explicitly in the repair log and
stop; do not hide it behind a rejected disposition.

End your reply with this line, verbatim, as the final line:

CODE REVIEW REPAIRS COMPLETE.
