# Framework Basis

Documents the structured-analysis frameworks the analysis-loop skill draws on
and why. The intelligence cycle is the shared spine across every audience the
skill serves; cyber threat intelligence (CTI) is **one** contributing
tradition — not the defining one — alongside journalism verification, market
research, academic review, and engineering decision practice.

## The shared spine: the intelligence cycle

The analysis-loop's four phases — scope → collect → analyze → disseminate —
map to the intelligence cycle's Planning & Direction, Collection and
Processing, Analysis and Production, and Dissemination and Feedback. This is
not CTI-specific: OSINT analysts, intelligence-driven market researchers, and
newsrooms with a verification desk all run a version of the same loop. That is
why the skill frames itself on the cycle, not on any single domain.

## The technique canon

The structured analytic techniques in `techniques.md` come from the
intelligence-community tradecraft canon:

- **Heuer & Pherson, *Structured Analytic Techniques for Intelligence
  Analysis*** — the eight-family taxonomy (decomposition and visualization,
  idea generation, scenarios and indicators, hypothesis generation and
  testing, assessment of cause and effect, challenge analysis, conflict
  management, decision support), and its "Choosing the Right Technique"
  guide that matches technique to analysis state by fit.
- **CIA, *A Tradecraft Primer*** — the diagnostic / contrarian / imaginative
  grouping, with a "when to use / method / value added" structure per
  technique.
- **ICD 203 (Analytic Standards)** — the directive that makes structured
  techniques an expected part of an analytic product, the origin of the
  "show sources, state confidence, challenge your own judgments" discipline.

## Audience-native frameworks

Where a workflow shape serves an audience, its technique selection leans on
that audience's native method:

| Audience | Native framework(s) | Where it surfaces |
|----------|---------------------|-------------------|
| CTI / intelligence analysts | Intelligence cycle, Diamond Model, kill-chain analysis | gated analysis, red-team |
| Journalists | EFCSN / AFP fact-checking code: ≥2 independent sources, primary-source preference, evidence for *and* against, named-source discipline; Steensen et al. source criticism | fact-check |
| Market researchers | SWOT, PESTEL / environment scanning, triangulation, decision matrices | competitive evaluation, monitoring |
| Academics | Systematic-review method (PRISMA-style inclusion criteria), evidence grading | literature review |
| Engineers | Premortem, FMEA, weighted decision matrices | deep-dive, competitive evaluation |

The mapping is behavioral: a fact-check applies source criticism rather than
a SWOT; a competitive evaluation applies a decision matrix rather than a
devil's advocacy. The per-shape mapping lives in
`skills/infobroker/references/workflows.md`; this file records *why* each
family is used.
