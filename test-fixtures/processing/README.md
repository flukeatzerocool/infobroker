# Processing benchmark (REQ-136)

`cases.json` is a deterministic, offline deduplication corpus. Each case carries
provider-shaped `results`, the URL pairs that express the same content
(`must_collapse`), the pairs that express different content (`must_survive`), and
the number of results the reconciler is expected to remove (`collapsed_count`).

`scripts/benchmark-processing.ts` runs the real reconciler and reports:

- **dedup_recall** — share of duplicate pairs that collapsed to exactly one
  representative;
- **dedup_precision** — share of distinct pairs that both survived;
- **collapsed_total_accuracy** — share of cases whose derived total
  (`results.length - kept.length`) matched the expectation.

The floor lives here with the corpus, as REQ-135's does.

## What the first run measured

`dedup_recall` 0.667 and `collapsed_total_accuracy` 0.667. Two cases —
`wire-syndication` and `mirror-repost` — carry byte-identical snippets under
different headlines, and the reconciler did not collapse them: similarity is
computed over title plus snippet, so a reworded headline moves the pair below the
0.85 threshold. That is a real gap in reheadlined-syndication handling, not a
fixture defect, and the floor records it rather than hiding it. Raising the floor
means fixing the reconciler, not editing the corpus.

`served` and `truncated` are out of scope: they enter the processing block from
the handler's cache and truncation state, which `SearchResult` cannot carry, so
an offline corpus cannot observe them.

Run:

```sh
npm run benchmark-processing
npm run benchmark-processing -- --json
```
