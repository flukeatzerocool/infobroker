# Corroboration — How `verify_claims` Reaches a Verdict

Agent-facing explanation of the `verify_claims` tool (the corroboration
engine). Use it to read a `verify_claims` result correctly and to present
findings consistently in reports (see `report-template.md`).

## The loop

1. **Knowledge-base recall (REQ-026e).** Prior stored findings reconcile as
   corroborating sources first. Never blocks external search; a result is
   never served from the KB alone.
2. **Phase 1 — broad pass.** Search the highest-authority providers first, up
   to `corroboration.first_pass_max_providers` (default 5), each returning up
   to `corroboration.first_pass_max_results` (default 5) results. The pass
   runs in small concurrent batches and stops early once every finding clears
   the confidence bar, so cost tracks how quickly the truth is pinned down.
3. **Phase 2 — reconcile.** Group results into topics; cluster the claims per
   topic by snippet similarity (`corroboration.similarity_threshold`, default
   0.3). A dominant agreement cluster vs. competing clusters decides the
   verdict.
4. **Phase 3 — refine.** Topics below the confidence bar become gaps; targeted
   refined queries run concurrently across the remaining provider pool, up to
   the HTTP-call budget.

## Confidence

Confidence starts from the number of **independent source families** (distinct
origins: a canonical URL, a registrable domain, or a distinct text that is not
republished wire copy) and is then scaled by the sources' authority weight.
`family_count` reports the family count, and a finding supported only by
secondary or aggregated sources is capped at the configured
`corroboration.calibration.secondary_only_cap`.

| Independent sources | Base confidence |
|---------------------|-----------------|
| 0 | 0.0 |
| 1 | 0.3 |
| 2 | 0.7 |
| 3+ | 0.9 |
| 5+ | 1.0 |

Authority weights (`corroboration.authority_weights`) scale this up or down:
`academic`, `encyclopedia`, `archive`, `structured_fact`, `definition`,
`location` = 1.0; `code`, `semantic`, `synthesis` = 0.9; `news` = 0.8;
`web_search` = 0.7. Two pages on the same registrable domain are not independent, and neither are
two domains republishing substantially the same text.

## Verdicts and the agreement map

The default `confidence_threshold` is **0.8**. Each finding reports one
verdict, and the response's `agreement_map` buckets topics three ways:

| Bucket | Rule | Meaning |
|--------|------|---------|
| `green` | confidence ≥ threshold | Confirmed — independent sources agree |
| `yellow` | 0.5 ≤ confidence < threshold | Partially corroborated |
| `red` | confidence < 0.5 | Unverified, contested, or single-source |

A finding whose sources split into competing clusters is reported `contested`
with both perspectives, never silently merged. `corroboration` is
`"complete"` when every finding clears the threshold, else `"partial"`.

## Reading a result in prose

- "Confirmed" → state the claim and how many independent sources agree, with
  the highest-authority source named.
- "Contested" → present both perspectives with their source grades; do not
  pick the louder one.
- "Unverified" → frame as "one source reports…" or "no independent source
  found," never as fact.

Every finding carries up to three sources; each source binds to the specific
claim it supports (REQ-026b). The response's `provenance` block names the
server version, iteration limit, threshold, and per-source-type contribution,
so a downstream citation can document the analytic tooling used.

## Batch mode: fact-checking a draft

Pass a claim list instead of a single query when a draft has several
independent claims:

```
verify_claims (claims: ["the bridge inspection found the structure sound",
                        "the deck was replaced in 2019"])
```

- One finding comes back per claim, in the order supplied, with `claim_index`
  and `batch: true`. Identical claims collapse; `duplicate_claims` reports how
  many were dropped.
- A claim with no attributed source is returned `unverified` with
  `sources: []` — it is not silently dropped, so every claim in the draft
  gets a row.
- The batch shares one HTTP-call budget and one iteration bound. A late claim
  can end `unverified` because an earlier claim consumed the budget; that is a
  gap to report, not a failure.
- Supply either `query` or `claims`, never both.

## Discrete claims vs. interpretive theses

`verify_claims` settles discrete claims. It does not settle an argument.

- **Discrete claim** — a date, number, quotation, attribution, or event. Send
  it to `verify_claims` and carry the verdict into the report. When the
  evidence does not support it, attribute it, soften it to the source
  `modality`, or delete it. Never leave it asserted because the surrounding
  argument is persuasive.
- **Interpretive thesis** — a statement about meaning or causation ("X
  explains Y"). It has no verdict. Decompose it into the premises that carry
  the argument, verify those as discrete claims, and record the thesis itself
  in the manifest `assumptions`, with the strongest counter-reading in
  `Analysis of Alternatives`. A thesis supported only by verified premises is
  a defensible reading, not a confirmed fact.
- **Rhetorical quantities are still discrete claims.** "It takes about ten
  days", "roughly 45", and "the country lost the ability to tell" each assert
  something checkable and each must pass REDRAFT-CHECK. Narrative register
  does not relax the contract; an essay is held to the same claims as a
  report.

## Spans and modality

Each source carries:

- `span` — `{start, end, text}` locating the sentence in the source `snippet`
  that supports the claim. `snippet.slice(span.start, span.end) === span.text`
  always holds. The span is omitted when no sentence matches, so a missing
  span means "not located", never "no evidence".
- `modality` — `asserted`, `reported` (attribution or hedging: "reportedly",
  "according to"), or `speculative` (possibility: "may", "appears to"), with
  `modality_marker` naming the matched word. Modality is **advisory**: it never
  changes confidence, verdict, or family count.

Read the modality when writing. A `reported` source supports "reportedly …",
not a flat assertion; a `speculative` source supports "may …". When a claim in
a report is non-asserted, declare it in the manifest:

```json
{ "claim": "…", "modality": "reported", "attribution": "reportedly" }
```

The report validator fails when the attribution does not appear in the body, so
a hedged source can never be upgraded to fact silently (REQ-026h, REQ-116).

