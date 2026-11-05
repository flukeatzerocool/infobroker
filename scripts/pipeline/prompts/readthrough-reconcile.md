Your summary artifact and your closing token disagree. This is a bookkeeping
error, not a request to re-review anything.

- Summary JSON: <SUMMARY_JSON>
- The analysis reply that ended with the token: <READTHROUGH_TXT>

1. Read both. Decide which counts state your final analysis. Do not re-run the
   review, do not edit the spec or the tree, and do not rewrite the analysis
   text.
2. If your analysis is genuinely ambiguous about a finding, keep the higher
   count: a finding you cannot rule out is not resolved.
3. Rewrite <SUMMARY_JSON> with the Write tool, exactly
   {"status":"complete","critical":N,"high":N,"info":N}, using those final
   counts. This is your only permitted change.

Reply with one line and nothing else: RECONCILED <critical> <high> <info>
