# Delta Baseline

```report-manifest
{
  "shape": "Monitoring / Delta",
  "audience": "analyst",
  "as_of": "2026-10-26",
  "handling": "TLP:CLEAR",
  "target_length": 600,
  "supersedes": "report://baseline",
  "revision": 2,
  "claims": [
    { "claim": "claim one is stable", "verdict": "True", "confidence": "High", "sources": ["S1"] },
    { "claim": "claim two is stable", "verdict": "False", "confidence": "High", "sources": ["S1"] },
    { "claim": "claim three is new", "verdict": "Unverifiable", "confidence": "Low", "sources": ["S3"] }
  ]
}
```

## Executive Summary

Baseline. [S1]

## Methodology & Scope

Offline fixture.

## Key Findings

### Claim one
**Finding:** claim one is stable. [S1]
**Confidence:** High

### Claim two
**Finding:** claim two is stable. [S1]
**Confidence:** High

### Claim three
**Finding:** claim three is new. [S3]
**Confidence:** High

## Changes Since 2026-09-01

Delta fixture.

## Baseline and Verification

Baseline fixture verified offline.

## Assumptions

Fixtures are stable.

## Analysis of Alternatives

None.

## Evidence & Sources

- [S1] https://example.com/one
- [S3] https://example.com/three

## Contradictions

None.

## Gaps

None.

## Source Register

| # | Source | Type | Primary/Secondary | Reliability | Credibility | Relevant interests | Published | Accessed | URL |
|---|--------|------|-------------------|-------------|-------------|--------------------|-----------|----------|-----|
| S1 | Source one | primary | primary | A | 1 | none | 2026-01-15 | 2026-10-26 | https://example.com/one |
| S3 | Source three | primary | primary | A | 1 | none | 2026-01-15 | 2026-10-26 | https://example.com/three |

## Recommendations

None.
