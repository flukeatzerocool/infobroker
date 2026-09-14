# Roadmap

<!--
  Format: one `## <title>` per upcoming item, followed by 1–3 bullet lines.
  Newest first. Remove entries once they ship (they move to CHANGELOG.md).
  Update this file when planning a release.
-->

<!-- No upcoming items. Remove entries once they ship to CHANGELOG.md. -->

## Semantic corroboration reconciliation (REQ-026 family)

- Replace the token-Jaccard claim clustering in `corroborate` (D-013) with
  embedding similarity, so paraphrased agreeing and contradicting claims
  group correctly.
- Depends on the local embedding model (REQ-103).

## Semantic passage ranking for deep search and question-grounded fetch (REQ-021b, REQ-028)

- Use the local embedding model in place of the hashed-TF-IDF passage
  scorer in `rerank.ts` for `deep` and `fetch_page question` responses.
- Improves ranking of passages that match intent without shared words.

## Cross-provider semantic deduplication and rerank (REQ-003, REQ-020 family)

- Collapse near-duplicate results across providers and order results by
  semantic match to intent, beyond today's URL/domain dedup.
- Depends on the local embedding model (REQ-103).

## Semantic query expansion and suggestion (REQ-020b, REQ-020e)

- Rank and cluster query variants and suggestions by meaning rather than
  lexical rules.

## Further embedding reuse (REQ-103 follow-on)

- Embedding-based intent classification to replace keyword task-type routing.
- Cross-lingual retrieval once the multilingual model swap (D-049) is active.
- Semantic KB sufficiency thresholds and near-duplicate report detection.

## Persistent key-pool rotation (deferred from competitive batch, 2026.09.04)

- Search Toolkit-style multi-key pools: ordered key lists per keyed provider,
  rotate on 401/403/429, per-key cooldown, persisted cursor. Deferred because
  every keyed provider caches its key at module scope, so rotation requires
  touching each keyed provider — see DECISIONS.md D-043.

## Emit the `rate_limited` error code (REQ-002 conformance)

- REQ-002 names `rate_limited` but no code path emits it. Deferred from the
  2026.09.03 cooldown change: a clean observable path (e.g. an explicitly
  requested provider returning 429) needs a small error-semantics decision
  before implementation. See DECISIONS.md D-041.
