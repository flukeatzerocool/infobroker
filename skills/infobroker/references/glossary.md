# Glossary

Terms the Infobroker skills and references use, defined once here so the rest
of the documentation can stay lean.

## Source grading (analysis-loop)

- **Reliability (A–F).** How trustworthy the *source* is: A completely
  reliable (primary/official/peer-reviewed) → E unreliable → F cannot be
  judged.
- **Credibility (1–6).** How trustworthy the *claim* is: 1 confirmed by
  multiple independent sources → 5 improbable → 6 cannot be judged.
- **A1 / B2 style grades.** Reliability letter + credibility number. "C3"
  reads "fairly reliable source, possibly true but uncorroborated."

## Corroboration (`verify_claims`)

- **Finding.** One topic with a claim, verdict, confidence, and up to three
  corroborating sources.
- **Verdict.** `confirmed` (independent agreement), `contested` (sources
  split, perspectives reported), or `unverified` (insufficient agreement).
- **Confidence.** 0.0–1.0, from the count of independent sources scaled by
  their authority weights (see `corroboration.md`).
- **Agreement map.** `green` (≥ confidence threshold), `yellow`
  (0.5 ≤ c < threshold), `red` (c < 0.5).
- **First-pass cap.** The Phase-1 broad search queries at most
  `corroboration.first_pass_max_providers` providers (highest priority
  first), then refines gaps against the full pool.
- **Gap.** A topic whose confidence is below the threshold and triggers a
  refined follow-up query.

## Delivery

- **EEI (Essential Element of Information).** A specific, answerable
  sub-question decomposed from a broad research question.
- **Workflow shape.** One of the research routing categories the `infobroker`
  orchestrator maps intent to (research & write, fact-check, deep-dive, …).
- **Completion token.** The grep-able one-line status that ends a workflow
  shape's deliverable, e.g. `research complete. <N> sources | <K> findings`.
- **KB-first.** `web_search` recalls the knowledge base before external
  providers, so cached answers never re-query the network.

## Server behavior

- **Dispatch chain.** The ordered provider list a task type routes through,
  with fallback on failure.
- **Hedge.** Fallback providers race the primary after a latency-derived
  window, instead of waiting out the primary's full timeout.
- **Cooldown.** A per-provider hold-off after a rate-limit/anti-bot response.
- **`resells` / `original_source`.** Aggregator backends (DuckDuckGo, Brave,
  SearXNG) resell other publishers' pages; the server reports each result's
  `original_source` where the API exposes it. First-party sources (Wikipedia,
  arXiv) leave it empty.
- **Freshness tier.** A decay/expiry schedule assigned to KB content
  (ephemeral / recent / stable / evergreen / report).
- **Provenance record.** The `verify_claims` block naming server version,
  iteration limit, threshold, and per-source-type contribution.
