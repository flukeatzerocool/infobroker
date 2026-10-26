# Delta Baseline

```report-manifest
{
  "shape": "Monitoring / Delta",
  "audience": "analyst",
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

### Claim two
**Finding:** claim two is stable. [S1]

### Claim three
**Finding:** claim three is new. [S3]

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

| # | Source | Type | Primary/Secondary | Reliability | Credibility | Relevant interests | URL |
|---|--------|------|-------------------|-------------|-------------|--------------------|-----|
| S1 | Source one | primary | primary | A | 1 | none | https://example.com/one |
| S3 | Source three | primary | primary | A | 1 | none | https://example.com/three |

## Recommendations

None.
