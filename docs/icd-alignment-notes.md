# ICD 203/206 alignment notes

Working notes for REQ-115 and REQ-118. The directives are United States
Intelligence Community Directives; the excerpts below are short quotations kept
only to record what each citation rests on. Nothing here paraphrases a provision
that was not read.

## Sources read

| Directive | Copy read | Notes |
|---|---|---|
| ICD 203, *Analytic Standards* | `https://www.dni.gov/files/documents/ICD/ICD-203.pdf` (fetched 2026-11-15, HTTP 200, 1,479,568 bytes), extracted with `pdftotext -layout` | Signed 2 January 2015; the copy read carries a technical amendment signed 21 January 2022 (Analytic Ombuds designation). Section numbers below are from this copy. |
| ICD 206, *Sourcing Requirements for Disseminated Analytic Products* | `https://irp.fas.org/dni/icd/icd-206.pdf` (FAS-hosted copy, extracted with `pdftotext -layout`) | The DNI-hosted PDF is malformed: `pdftotext` and `ghostscript` both extract zero bytes. The FAS copy supersedes the 17 October 2007 directive and states that it "becomes effective on the date of signature"; the signature date is not legible in the extraction, so no date is attributed beyond that. |

The 2026-11-15 attempt recorded in `CHANGELOG.md` failed on the reader, not on
access: the reader cannot parse a PDF, and `curl` plus a local extractor can.

## ICD 203 §D.5.e.(2) — uncertainty, likelihood, confidence

Quoted (a):

> For expressions of likelihood or probability, an analytic product must use
> one of the following sets of terms: almost no chance / remote; very unlikely /
> highly improbable; unlikely / improbable (improbably); roughly even chance /
> roughly even odds; likely / probable (probably); very likely / highly
> probable; almost certain(ly) / nearly certain.

with the bands `01-05%`, `05-20%`, `20-45%`, `45-55%`, `55-80%`, `80-95%`,
`95-99%`, and:

> Analysts are strongly encouraged not to mix terms from different rows.
> Products that do mix terms must include a disclaimer clearly noting the terms
> indicate the same assessment of probability.

Quoted (b):

> To avoid confusion, products that express an analyst's confidence in an
> assessment or judgment using a "confidence level" (e.g., "high confidence")
> must not combine a confidence level and a degree of likelihood, which refers
> to an event or development, in the same sentence.

What this changes here:

1. `even chance` is not one of the directive's terms; the row-1 term is
   `roughly even chance`. The likelihood lexicon is renamed accordingly.
2. The bands already match (`0–5 … 95–99` against `01-05 … 95-99`); the
   reference now cites the source of the bands instead of presenting them as
   local invention.
3. The confidence/likelihood separation is stated as a rule, not a habit:
   REQ-115 carries it, and `confidence.md` explains it.

Not adopted: the directive's second synonym row (`remote`, `highly improbable`,
…) is documented but not added to the schema — the shipped lexicon already uses
one term per band, and widening a manifest enum needs its own increment.

## ICD 203 §D.5.e.(1) — sources and credibility

Quoted:

> Analytic products should identify underlying sources and methodologies upon
> which judgments are based, and use source descriptors in accordance with ICD
> 206 … to describe factors affecting source quality and credibility.

This is why REQ-118 points at ICD 206 rather than inventing a scheme: the
directive delegates the sourcing elements to ICD 206.

## ICD 206 §D.3.a.(6) — source reference citation elements

Quoted (elements list, condensed to the element names):

> … (b) Identification of the information originator, author, producer, or
> owner … (c) An unambiguous source identifier … (d) A title for the source
> document … (e) The date of issuance, publication, or posting. If date of
> online posting is unknown, then date of online access …

What this changes here: the Source Register already carries the source name,
type, interests, publication and access dates, and a durable citation
identifier. The register's source name is the originator element, the dates are
element (e), and the citation identifier is element (c). REQ-118 now cites the
directive for the fields it already requires, and names the originator
explicitly.

Two ICD 206 elements are deliberately **not** adopted, because they are
classification-system machinery with no meaning outside a classified product:
portion marking and the overall document classification (elements (a), (g),
(h)).

## Deliberate divergence: grading scheme

ICD 206 does not define a source-reliability or information-credibility scale.
The Admiralty/NATO pair (`A–F` / `1–6`) that REQ-115 and REQ-118 require is a
separate convention that satisfies ICD 203 §D.5.e.(1)'s "factors affecting
source quality and credibility" without being mandated by it. The divergence is
recorded in `DECISIONS.md` rather than presented as doctrine compliance.
