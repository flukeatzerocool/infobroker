A repair pass has responded to the high-severity findings from the last
read-through. Verify that response against the tree. This is not a second
read-through: do not re-audit the specification, do not raise findings outside
the list, and do not re-read the whole spec front to back.

- Prior read-through text: <READTHROUGH_TXT>
- Repair dispositions (JSON): <DISPOSITIONS_JSON>

For each finding in the dispositions file:

1. Read the cited REQ body, spec section, configuration key, and
   implementation.
2. Decide whether the disposition matches the tree. A `fixed` finding whose
   text is unchanged, or changed only cosmetically, is still open. A `rejected`
   finding must be re-checked on its evidence — a rejection is not a pass.
3. Report a finding as open only when you can point at the text or code that
   still contradicts it.

Then write <SUMMARY_JSON> (an absolute path) as your last action, with exactly
the JSON shape {"status":"complete","critical":N,"high":N,"info":N}. Count
`critical` and `high` from the findings that remain open; carry the prior
read-through's info count forward without re-deriving it. A missing,
unparseable, or stale summary fails the pipeline gate.

End your reply with this line, verbatim, as the final line, copying the numbers
from the JSON you just wrote:

READTHROUGH <crit> critical; <high> high; <info> info
