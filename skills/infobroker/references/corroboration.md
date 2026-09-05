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

Confidence starts from the number of **independent** sources (distinct
registrable domains) and is then scaled by the sources' authority weight.

| Independent sources | Base confidence |
|---------------------|-----------------|
| 0 | 0.0 |
| 1 | 0.3 |
| 2 | 0.7 |
| 3+ | 0.9 |
| 5+ incl. a primary source | 1.0 |

Authority weights (`corroboration.authority_weights`) scale this up or down:
`academic`, `encyclopedia`, `archive`, `structured_fact`, `definition`,
`location` = 1.0; `code`, `semantic`, `synthesis` = 0.9; `news` = 0.8;
`web_search` = 0.7. Two pages on the same registrable domain are not
independent.

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
