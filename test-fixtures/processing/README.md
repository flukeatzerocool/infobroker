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

## What the floor holds

`dedup_recall` 1.000, `dedup_precision` 1.000 and `collapsed_total_accuracy` 1.000
over eight cases. The first run measured 0.667 recall: `wire-syndication` and
`mirror-repost` carry byte-identical snippets under different headlines, and the
reconciler compared title plus snippet, so a reworded headline pushed the pair
below the 0.85 threshold. That gap is closed by the snippet basis in REQ-020j,
which a headline cannot dilute.

Recall and collapse-total are pinned at the measured value. Precision keeps a
0.05 margin: the reconciler still admits one false-positive class — a long shared
boilerplate body with no identifying names, dates or numbers on either side —
which `boilerplate-shared` deliberately does not test. One collapsed distinct
pair drops precision to 0.90 and fails the gate.

`boilerplate-shared` measures full-text similarity 0.838, 0.012 below the
threshold. That margin is load-bearing: if the similarity model drifts above it,
the pair collapses on the unguarded full-text branch and the case fails red for
the wrong reason. Re-author the case rather than relax the guard.

`served` and `truncated` are out of scope: they enter the processing block from
the handler's cache and truncation state, which `SearchResult` cannot carry, so
an offline corpus cannot observe them.

Run:

```sh
npm run benchmark-processing
npm run benchmark-processing -- --json
```
