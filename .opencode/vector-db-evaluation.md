# Vector Database Selection for a Rust Backend — 5M-Document Semantic Search

```report-manifest
{
  "shape": "Competitive Evaluation",
  "audience": "engineer",
  "target_length": 2000,
  "language": "en",
  "as_of": "2026-11-15",
  "handling": "TLP:CLEAR",
  "methodology": "Weighted criteria fixed before scoring. Evidence drawn from vendor primary documentation (READMEs, pricing pages, API references) and crates.io registry metadata for Rust client maturity; secondary benchmark blogs were excluded where primary sources existed. Cost model built from published list rates against a stated 5M x 1536-dimension assumption.",
  "assumptions": [
    "5M documents average one 1536-dimension float32 embedding each (~30.7 GB raw).",
    "Query volume in the 10k-100k searches/day range with top_k of 10-50.",
    "Workload is metadata-filtered semantic search, not pure ANN over an unfiltered corpus.",
    "Self-hosting on a single cloud VM is acceptable; a managed control plane is optional.",
    "The team will not add a second general-purpose database tier for this feature."
  ],
  "alternatives": [
    "pgvector inside the existing Postgres, accepted for one less system to operate.",
    "Qdrant Cloud Standard instead of self-hosted Qdrant, trading cost for zero operations.",
    "Pinecone, accepting managed lock-in in exchange for no infrastructure work."
  ],
  "gaps": [
    "No reproducible 5M x 1536-dimension benchmark run by a neutral party was found for all five options; Qdrant's published benchmark is vendor-run.",
    "Qdrant Cloud Standard list price for a specific cluster shape is behind a calculator, not a published rate card.",
    "Actual query volume and filtering selectivity were not supplied, so cost figures are a modelled range.",
    "Recall target and p95 latency SLO were not supplied."
  ],
  "revision": 1,
  "claims": [
    {"claim": "Qdrant is written in Rust and ships an official Rust client library.", "verdict": "True", "confidence": "High", "likelihood": "almost certain", "sources": ["S1", "S3"]},
    {"claim": "The official Qdrant Rust client is actively maintained and widely adopted.", "verdict": "True", "confidence": "High", "likelihood": "almost certain", "sources": ["S3"]},
    {"claim": "Pinecone's documented SDK surface does not include Rust.", "verdict": "True", "confidence": "High", "likelihood": "almost certain", "sources": ["S5", "S6"]},
    {"claim": "Weaviate publishes no official Rust client and its community client list covers only PHP and Ruby.", "verdict": "True", "confidence": "High", "likelihood": "almost certain", "sources": ["S11", "S12"]},
    {"claim": "Milvus standalone depends on etcd and object storage such as MinIO.", "verdict": "True", "confidence": "High", "likelihood": "almost certain", "sources": ["S14", "S15"]},
    {"claim": "pgvector's HNSW index supports at most 2,000 dimensions for the vector type and 4,000 for halfvec.", "verdict": "True", "confidence": "High", "likelihood": "almost certain", "sources": ["S17"]},
    {"claim": "Pinecone serverless charges $0.33/GB/month storage, $4-4.50 per million write units and $16-18 per million read units on the Standard plan.", "verdict": "True", "confidence": "High", "likelihood": "almost certain", "sources": ["S8"]},
    {"claim": "Weaviate's paid cloud entry tier starts at $45/month.", "verdict": "True", "confidence": "High", "likelihood": "almost certain", "sources": ["S13"]},
    {"claim": "Qdrant quantization reaches 4x compression with scalar quantization and up to 32x with binary quantization.", "verdict": "True", "confidence": "High", "likelihood": "almost certain", "sources": ["S2"]},
    {"claim": "Qdrant reports the highest RPS and lowest latency across most of its own benchmark scenarios.", "verdict": "Unverifiable", "confidence": "Low", "likelihood": "even chance", "sources": ["S20"], "modality": "reported", "attribution": "according to Qdrant's own benchmark"}
  ]
}
```

## Executive Summary

Adopt **Qdrant**, self-hosted behind its gRPC API, with **pgvector held as the explicit fallback** if you already run Postgres and value one fewer system over peak vector throughput [S1][S17].

The decisive factor is not raw speed — at 5M x 1536 dimensions every option here works. It is **language fit and operational surface**. Qdrant is itself written in Rust, and its Rust client is the vendor's own crate, published from the `qdrant` organisation, at v1.20.0 with ~2.9M downloads in the last 90 days [S1][S3]. Pinecone's documented SDKs are Python, Node.js, Java, Go and a CLI — no Rust [S5]; its last official-looking Rust crate has not been published since September 2024 [S6]. Weaviate lists neither an official nor a community Rust client [S11][S12]. Milvus has an official Rust SDK but far thinner adoption (~26k total downloads) and a much heavier deployment [S16][S15].

Qdrant also removes the 30 GB memory cliff: scalar quantization compresses your 5M vectors to roughly 7.7 GB, and binary quantization to under 1 GB, versus ~31 GB raw [S2].

## Methodology & Scope

Criteria were fixed before scoring, then weighted. Each option was scored against vendor primary sources only: project READMEs, API reference pages, published price cards, and crates.io registry metadata. Secondary "vector database pricing 2026" blog posts appeared heavily in search results and were discarded — several contradicted each other on Pinecone's own rates, which the primary price card resolves [S8].

Not covered: recall benchmarks run by us, embedding model selection, re-ranking, and hybrid/sparse search tuning. Those are follow-on work.

## Criteria

| # | Criterion | Weight | Why it matters here |
|---|-----------|--------|---------------------|
| 1 | Rust client maturity | 25% | A stale or absent client turns every feature into a hand-rolled HTTP wrapper |
| 2 | Operational footprint | 20% | Cost of running it is mostly people-time, not compute |
| 3 | Scale behaviour at 5M | 20% | Recall and latency must hold with filters applied |
| 4 | Memory / cost efficiency | 20% | 5M x 1536 float32 is ~30 GB; that dominates the bill |
| 5 | Ecosystem lock-in | 15% | Migrating a vector store is a re-index, not a dump-and-restore |

## Decision Matrix

Scored 1–5. Weighted total in the final column.

| Option | Rust client (25%) | Ops footprint (20%) | Scale @5M (20%) | Memory/cost (20%) | Lock-in (15%) | Weighted |
|---|---|---|---|---|---|---|
| **Qdrant** | 5 — own crate, v1.20.0, 2.9M recent downloads [S3] | 4 — single binary, optional cloud [S1] | 5 — filter-aware HNSW, purpose-built [S1] | 5 — 4x–32x quantization [S2] | 5 — Apache-2.0, self-host or managed [S1] | **4.80** |
| **pgvector** | 4 — `pgvector` crate, 6.0M recent downloads [S18] | 5 — you already run Postgres [S17] | 3 — 2,000-dim HNSW cap, filtered scans need tuning [S17] | 3 — ~31 GB index in RAM [S17] | 5 — plain SQL, no lock-in [S17] | **3.95** |
| **Milvus** | 3 — official SDK, ~26k downloads [S16] | 2 — etcd + object storage required [S15] | 5 — built for 10M+, disaggregated [S14] | 4 — DiskANN, strong compression [S14] | 4 — Apache-2.0 [S14] | **3.55** |
| **Pinecone** | 1 — no Rust SDK documented [S5] | 5 — fully managed [S8] | 4 — serverless, scales without ops | 3 — $0.33/GB + metered reads [S8] | 2 — proprietary, no self-host [S8] | **2.95** |
| **Weaviate** | 2 — no official Rust client [S11][S12] | 4 — single binary, cloud available | 4 — HNSW + async indexing | 3 — vector cache sizing required | 4 — open source [S10] | **3.30** |

## Key Findings

### Finding 1 — Rust client maturity is the widest gap between options

**Finding:** Qdrant's Rust client is a first-party crate from the `qdrant` GitHub organisation, currently v1.20.0, with 6.29M lifetime and 2.93M recent downloads, republished October 2026 [S3]. Pinecone documents SDKs for Python, Node.js, Java, Go and a CLI, with no Rust entry [S5]; the `pinecone-sdk` crate in the `pinecone-io` organisation has not been published since 2024-09-06 [S6]. Weaviate's official client list contains no Rust option, and its community-client page lists only PHP and Ruby [S11]; the `weaviate-client` crate's last publication was March 2023 with 14 recent downloads [S12].
**Confidence:** High
**Sources:** A1 + A1 + A2 independent registry data
**Contradictions:** none found
**Gaps:** Milvus' Rust SDK is officially maintained and current (v3.0.3, October 2026) but has ~26k lifetime downloads — maintained, not proven at scale [S16].

### Finding 2 — pgvector's dimension ceiling is a live trap, not a theoretical one

**Finding:** pgvector's HNSW index accepts at most 2,000 dimensions for the `vector` type and 4,000 for `halfvec`, while the column type itself stores up to 16,000 [S17]. At 1536 dimensions you are inside the limit today — but a move to a 3,072-dimension embedding model (a common upgrade path) forces you to `halfvec`, a cast-based expression index, or dimensionality reduction [S17]. Filtered queries also need `hnsw.iterative_scan` enabled to avoid returning fewer than `LIMIT` rows, because filtering is applied after the index scan [S17].
**Confidence:** High
**Sources:** A1 (vendor documentation stating the limit explicitly)
**Contradictions:** none found
**Gaps:** none — this is a documented hard limit.

### Finding 3 — Operational footprint separates Milvus from everything else

**Finding:** Milvus is a four-layer disaggregated system — access, coordinator, worker nodes, and storage — where storage itself comprises etcd for metadata, a log broker, and object storage [S14]. Its own standalone install guide warns that etcd requires local NVMe with >500 IOPS and <10 ms p99 fsync latency, because slow disk causes frequent cluster elections [S15]. Qdrant, Weaviate and pgvector are each a single process against a single data directory [S1][S10][S17].
**Confidence:** High
**Sources:** A1 (Milvus architecture and prerequisite docs)
**Contradictions:** none found
**Gaps:** Milvus's complexity buys real capability above ~50M vectors; at 5M it is unearned.

### Finding 4 — Memory is where the money actually goes

**Finding:** Qdrant documents scalar quantization at 4x compression, binary quantization up to 32x, and product quantization up to 64x [S2]. Applied to this workload, 5M x 1536 float32 vectors at ~30.7 GB raw become ~7.7 GB at 8-bit scalar and under 1 GB at binary. pgvector's own scaling guidance recommends `halfvec` and binary quantization for a smaller working set, which tells you the default does not fit comfortably [S17]. Qdrant additionally supports keeping vectors on disk with memory-mapped storage, which pgvector's HNSW index does not do the same way.
**Confidence:** High
**Sources:** A1 + A1
**Contradictions:** none found
**Gaps:** Recall loss under quantization is embedding-dependent and must be measured on your corpus.

### Finding 5 — Pinecone's cost model is fine at low QPS and punitive at high QPS

**Finding:** Pinecone serverless meters four dimensions — read units, write units, storage, and egress — at $0.33/GB/month storage, $4–4.50 per million write units, and $16–18 per million read units on Standard, with a $50/month minimum [S8][S9]. Against ~30.7 GB of storage that is ~$10/month of storage, dominated instead by reads: at 100k queries/day a single-read-unit query is ~3M RU/month (~$51), and at 1M queries/day it is ~$510/month. Because reads are metered independently of storage, the bill tracks traffic rather than data size.
**Confidence:** Medium
**Sources:** A1 for the rates; B2 for the modelling
**Contradictions:** none found — available secondary summaries of Pinecone pricing disagree with each other, which is why only the price card was used.
**Gaps:** The exact read-unit consumption of your query shape is unknown until measured; Pinecone returns RU counts per response for this purpose [S9].

## Assumptions

1. One 1536-dimension embedding per document, no multi-vector or ColBERT layout.
2. Read-heavy workload with a modest write rate after the initial backfill.
3. Metadata filtering (tenant, date, category) is applied on most queries — this is the case that punishes naive post-filtering.
4. A single-node deployment is acceptable for v1; horizontal scaling is a later problem.

## Analysis of Alternatives

**pgvector — the strongest rejected option.** If Postgres is already in the stack, pgvector gives you ACID, joins against document metadata, point-in-time recovery and one backup strategy, for zero new systems [S17]. The `pgvector` Rust crate has 6.0M recent downloads [S18]. Reject it only if you expect to (a) exceed ~10M vectors, (b) move past 2,000 dimensions, or (c) run high-QPS filtered search where post-filter recall tuning becomes a second job. Any of those flips this recommendation. Note also that `pgvectorscale` adds a StreamingDiskANN index and reports large wins over Pinecone's s1 index at 50M scale — but that is a Timescale benchmark of its own product [S19].

**Milvus — right tool, wrong size.** Its disaggregated architecture is genuinely the best answer above ~50M vectors, and its Rust SDK is real [S14][S16]. At 5M it costs you etcd, object storage, and a tuning surface you do not need yet.

**Pinecone — buy speed, rent lock-in.** Zero ops and excellent for validating the feature in a week [S8]. But with no documented Rust SDK [S5], you would be writing and owning an HTTP client, and the read-unit meter makes cost scale with success.

**Weaviate — good database, wrong ecosystem for this team.** Modules and built-in vectorization are attractive if you want Weaviate to call the embedding provider for you [S10]. But the absence of any maintained Rust client [S11][S12] means an untyped REST layer in a codebase otherwise compiled.

**The strongest case against Qdrant:** it is a second stateful system to operate, back up and monitor, and its published benchmark is its own [S20]. If your team is small and Postgres-first, that operational delta is a real cost — which is exactly why pgvector sits 0.85 weighted points behind rather than being dismissed.

## Contradictions

Qdrant's benchmark page reports Qdrant leading on RPS and latency in almost all scenarios, and simultaneously reports it being up to 10x slower than Milvus when indexing 10M+ vectors of 96 dimensions [S20]. Both statements come from the vendor about its own product, so the favourable half should be treated as reported, not established. No independent head-to-head across all five options at 5M x 1536 was located.

## Gaps

1. No neutral benchmark at this exact shape and scale.
2. Qdrant Cloud Standard pricing for a specific cluster is calculator-gated, so managed cost is unquantified.
3. Query volume, filter selectivity, and recall target were not provided; the cost model is a range, not a quote.
4. Re-index cost on model change — the number that most often surprises teams — was not measured for any option.

## Evidence & Sources

- Qdrant is written in Rust, is Apache-2.0, and positions itself on extended filtering support — [S1]
- Qdrant quantization achieves 4x (scalar) to 32x (binary) and up to 64x (product) compression — [S2]
- Official Qdrant Rust client v1.20.0, 6.29M lifetime / 2.93M recent downloads, published 2026-10-22 — [S3]
- Qdrant Cloud bills by resource usage; free tier capped at 1 GB RAM / 4 GB disk — [S4]
- Pinecone's documented SDKs are Python, Node.js, Java, Go and CLI — [S5]
- `pinecone-sdk` last published 2024-09-06 — [S6]
- `pinecone-rs` community crate abandoned 2024-01 — [S7]
- Pinecone rate card: $0.33/GB/month, $4–4.50/M WU, $16–18/M RU, $50 minimum — [S8]
- Pinecone meters read units, write units, storage and egress; responses report RU counts — [S9]
- Weaviate server is Go — [S10]
- Weaviate community client list covers PHP and Ruby only — [S11]
- `weaviate-client` crate last published 2023-03, 3.1k lifetime downloads — [S12]
- Weaviate pricing: free 100k objects, Flex from $45/month — [S13]
- Milvus is a four-layer disaggregated architecture using Faiss/HNSW/DiskANN/SCANN — [S14]
- Milvus standalone requires etcd with NVMe-grade disk, plus object storage — [S15]
- Official Milvus Rust SDK v3.0.3, ~26k lifetime downloads, published 2026-10-26 — [S16]
- pgvector HNSW index limits: 2,000 dims (vector), 4,000 (halfvec), 64,000 (bit); iterative scans for filtered queries; scaling guidance recommends halfvec and binary quantization — [S17]
- `pgvector` Rust crate, 22.5M lifetime / 6.0M recent downloads — [S18]
- pgvectorscale StreamingDiskANN and Timescale's own 50M-vector Pinecone comparison — [S19]
- Qdrant's self-reported benchmark observations — [S20]

## Source Register

| # | Source | Type | Primary/Secondary | Reliability | Credibility | Relevant interests | Published | Accessed | DOI | URL |
|---|--------|------|-------------------|-------------|-------------|--------------------|-----------|----------|-----|-----|
| S1 | Qdrant repository README | Vendor docs | Primary | A | 1 | Vendor of subject | 2026 | 2026-11-15 | — | https://raw.githubusercontent.com/qdrant/qdrant/master/README.md |
| S2 | Qdrant quantization guide | Vendor docs | Primary | A | 1 | Vendor of subject | 2026 | 2026-11-15 | — | https://qdrant.tech/documentation/guides/quantization/ |
| S3 | crates.io `qdrant-client` | Registry | Primary | A | 1 | Neutral | 2026-10-22 | 2026-11-15 | — | https://crates.io/crates/qdrant-client |
| S4 | Qdrant pricing | Vendor pricing | Primary | A | 1 | Vendor of subject | 2026 | 2026-11-15 | — | https://qdrant.tech/pricing/ |
| S5 | Pinecone API reference | Vendor docs | Primary | A | 1 | Vendor of subject | 2026-11 | 2026-11-15 | — | https://docs.pinecone.io/reference/api/introduction |
| S6 | crates.io `pinecone-sdk` | Registry | Primary | A | 1 | Neutral | 2024-09-06 | 2026-11-15 | — | https://crates.io/crates/pinecone-sdk |
| S7 | crates.io `pinecone-rs` | Registry | Primary | B | 2 | Neutral | 2024-01-24 | 2026-11-15 | — | https://crates.io/crates/pinecone-rs |
| S8 | Pinecone pricing | Vendor pricing | Primary | A | 1 | Vendor of subject | 2026 | 2026-11-15 | — | https://www.pinecone.io/pricing/ |
| S9 | Pinecone cost documentation | Vendor docs | Primary | A | 1 | Vendor of subject | 2026 | 2026-11-15 | — | https://docs.pinecone.io/guides/manage-cost/understanding-cost |
| S10 | Weaviate repository README | Vendor docs | Primary | A | 1 | Vendor of subject | 2026 | 2026-11-15 | — | https://raw.githubusercontent.com/weaviate/weaviate/main/README.md |
| S11 | Weaviate community clients | Vendor docs | Primary | A | 1 | Vendor of subject | 2026 | 2026-11-15 | — | https://weaviate.io/developers/weaviate/client-libraries/community |
| S12 | crates.io `weaviate-client` | Registry | Primary | A | 1 | Neutral | 2023-03-08 | 2026-11-15 | — | https://crates.io/crates/weaviate-client |
| S13 | Weaviate pricing | Vendor pricing | Primary | A | 1 | Vendor of subject | 2026 | 2026-11-15 | — | https://weaviate.io/pricing |
| S14 | Milvus architecture overview | Vendor docs | Primary | A | 1 | Vendor of subject | 2026 | 2026-11-15 | — | https://milvus.io/docs/architecture_overview.md |
| S15 | Milvus standalone prerequisites | Vendor docs | Primary | A | 1 | Vendor of subject | 2026 | 2026-11-15 | — | https://milvus.io/docs/prerequisite-docker.md |
| S16 | crates.io `milvus-sdk-rust` | Registry | Primary | A | 1 | Neutral | 2026-10-26 | 2026-11-15 | — | https://crates.io/crates/milvus-sdk-rust |
| S17 | pgvector README | Vendor docs | Primary | A | 1 | Maintainer of subject | 2026 | 2026-11-15 | — | https://github.com/pgvector/pgvector |
| S18 | crates.io `pgvector` | Registry | Primary | A | 1 | Neutral | 2026-05-22 | 2026-11-15 | — | https://crates.io/crates/pgvector |
| S19 | pgvectorscale README | Vendor docs | Primary | B | 2 | Vendor of competing product | 2026 | 2026-11-15 | — | https://github.com/timescale/pgvectorscale |
| S20 | Qdrant benchmarks | Vendor benchmark | Primary | B | 2 | Vendor benchmarking itself | 2024-06 | 2026-11-15 | — | https://qdrant.tech/benchmarks/ |

## Recommendations

1. **Adopt Qdrant self-hosted, via the gRPC port, using the `qdrant-client` crate directly.** No HTTP shim, no community wrapper. Pin to the crate version matching your server minor version.

2. **Enable scalar (int8) quantization on day one.** It takes ~30.7 GB of vectors to ~7.7 GB, which is the difference between a 64 GB instance and a 16 GB instance. Measure recall@10 against exact search before and after on a 10k-document sample; add binary quantization only if the recall budget survives.

3. **Spike for one week before committing.** Load 5M vectors, measure filtered-query p95 at your real filter selectivity, and confirm recall@10 ≥ your target. This is the cheapest way to retire the report's biggest gap.

4. **Keep pgvector as the documented fallback.** Record the two triggers that would have justified it — already running Postgres AND a forecast under 10M vectors with no 3,072-dimension model on the roadmap — so the decision is reproducible rather than re-litigated.

5. **Model Pinecone's read units before choosing managed.** If you want zero ops, price 1M queries/day against the read-unit meter first; that is where the cost curve bends [S8][S9].
