# Direction benchmark (REQ-135)

`cases.json` is a deterministic, offline requirement-quality corpus. Each case
states a query, whether **two materially different requirements** are plausible
for it (`expect_offer`), the task types an acceptable offer may name, and the
direction slots the block must report.

`scripts/benchmark-direction.ts` runs each query through the live classifier and
the live ambiguity rule (the same functions `search_web` uses), then reports:

- **offer_rate** — share of cases that should offer a choice and did;
- **false_offer_rate** — share of cases that should not offer and did;
- **mean_slot_recall** — share of expected direction slots actually reported.

The corpus is authored, not fitted: a case is `expect_offer` when the query
genuinely carries two requirements (a filing request that is also a paper
request), not because the implementation happens to tie. A disagreement between
the corpus and the server is a finding, not a fixture to edit.

`mean_slot_recall` is close to a floor today because the block always reports
`task_type` and `depth`; it gains discrimination as the block reports more
requirement attributes. Offer and false-offer rates are the discriminating pair.

Run:

```sh
npm run benchmark-direction
npm run benchmark-direction -- --json
```
