# Retrieval-quality benchmark (REQ-130)

`queries.json` is a deterministic, offline retrieval benchmark. Each entry
carries a query, graded relevance judgments, and the raw multi-provider
results that a search would have returned. `scripts/benchmark-retrieval.ts`
runs those raw results through the real reconciliation path
(`reconcileResults`) and reports precision@k, recall@k, MRR, and nDCG, plus the
same metrics for unchanged provider order so the reconciliation effect is
visible.

This is distinct from `test-fixtures/calibration/gold.json` (REQ-123), which
measures confidence calibration, not retrieval quality.

Run:

```sh
npm run benchmark-retrieval
npm run benchmark-retrieval -- --json
```

`baseline.json` records the committed floor used by
`src/retrieval-benchmark.test.ts`. Refresh it deliberately, with a recorded
reason, after a ranking change:

```sh
npm run benchmark-retrieval -- --update-baseline
```

Keep fixtures small and offline. Add a query with judgments and raw results;
do not fetch live pages here.
