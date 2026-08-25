# Structured Analytic Techniques — Catalog & Selection Guide

Companion to the analysis-loop `SKILL.md`. Each technique states its fit
criterion, method, and output. Select a technique by matching the *analysis
state* to a fit criterion, not by familiarity; name the technique and its
fit rationale in the output; apply it as one discrete pass.

The taxonomy follows the intelligence-community tradecraft canon
(Heuer & Pherson, *Structured Analytic Techniques*; the CIA *A Tradecraft
Primer*; ICD 203). Eight techniques are curated here across the families of
hypothesis generation and testing, challenge analysis, assessment of cause
and effect, scenarios and indicators, diagnostics, and decision support.

## Selection Guide

Answer these questions about the analysis state; an affirmative answer
points to the technique(s) to apply. Apply one technique per discrete pass.

| If the analysis is at this state… | Apply… |
|-----------------------------------|--------|
| More than one explanation is plausible, and evidence must settle it | Analysis of Competing Hypotheses |
| Conclusions rest on assumptions that have not been stated or tested | Key Assumptions Check |
| A consensus or a strong finding has not been challenged | Devil's Advocacy |
| The deliverable is a plan, forecast, or recommendation that could be wrong | Premortem Analysis |
| The value of the work is tracking what happens next | Indicators |
| Source reliability is uneven or a key source is questionable | Quality-of-Information Check |
| A choice must be made among options with competing criteria | Decision Matrix |
| A strong conclusion is about to be treated as settled and needs scrutiny | Structured Self-Critique |

### Analysis of Competing Hypotheses (ACH)

**Fit.** Multiple competing explanations exist for the same body of evidence,
and no single explanation is obviously correct.

**Method.** List every plausible hypothesis; array the evidence against each;
favor evidence that discriminates between hypotheses (the most diagnostic
items) over evidence consistent with all of them. Tilt toward rejecting
hypotheses, not confirming a favorite. Re-rank as new evidence arrives.

**Output.** The ranked hypotheses with the discriminating evidence that moves
each one up or down, and the hypothesis best supported by the diagnostic
evidence.

### Key Assumptions Check

**Fit.** Findings or a recommendation rest on assumptions that have not been
made explicit.

**Method.** List the stated and unstated assumptions under each key finding;
for each, ask how much support it has, whether it could be wrong, what would
follow if it failed, and how it could be verified. Flag assumptions that are
both load-bearing and unverified.

**Output.** A list of assumptions, each marked for how load-bearing it is and
how verifiable, with the ones that would change the conclusion if wrong
highlighted.

### Devil's Advocacy

**Fit.** A consensus or a strong finding has formed and has not been
seriously challenged.

**Method.** Build the strongest possible case for the opposite conclusion:
outline the mainline judgment and its assumptions, select the most
challengeable ones, review the evidence for questionable validity or gaps,
and present the alternative explanation. Identify the argument explicitly as
contrarian so it is not read as the settled position.

**Output.** The strongest counter-argument to the mainline finding, the
precise assumptions or evidence it attacks, and a judgment of whether the
mainline holds after the challenge.

### Premortem Analysis

**Fit.** The deliverable is a plan, forecast, or recommendation that could
fail, and the hidden failure modes matter.

**Method.** Assume the plan or prediction has already failed; from that
start, reconstruct how the failure happened — what dependency broke, what
evidence was missed, what overconfidence set it up. Enumerate the failure
paths, then check each against the current evidence.

**Output.** The plausible failure paths, each tied to the specific
dependency or assumption that would produce it, and the mitigations or
caveats they imply.

### Indicators

**Fit.** The value of the work is tracking whether a judgment holds or a
change occurs over time.

**Method.** Derive a short list of measurable or observable signposts that
would confirm, weaken, or invalidate a current finding; state the direction
each indicator would move and what that movement would mean. Prefer
indicators that are discriminating and checkable from outside sources.

**Output.** A signpost list, each indicator paired with the inference to draw
from its movement, usable later to re-assess whether the finding still holds.

### Quality-of-Information Check

**Fit.** Source reliability is uneven, or a pivotal source is of questionable
quality.

**Method.** Re-evaluate each key piece of information independently of where
it came from: is it confirmed by an independent source, plausible, doubtful,
or improbable? Separate the *source* grade (reliability of the provider) from
the *information* grade (credibility of the claim), and re-grade when new
sources appear.

**Output.** An updated reliability/credibility grade for each contested
source, plus a statement of which findings stand on solid versus weak
information.

### Decision Matrix

**Fit.** A choice must be made among options against explicit, weighted
criteria.

**Method.** Define the criteria before scoring; weight them; score each
option against each criterion; produce a criteria-by-option matrix. Flag
criteria for which evidence is missing rather than guessing a score.

**Output.** The weighted matrix, the leading option, and the criteria that
lack evidence (so a reader can see how sensitive the choice is).

### Structured Self-Critique

**Fit.** A strong conclusion is about to be treated as settled and deserves
structured scrutiny before dissemination.

**Method.** Assume the role of a skeptical reviewer of your own analysis:
identify the key assumptions, the weakest evidence, and the alternative
explanations you have not ruled out; grade the analysis against them; state
where confidence is lower than the headline suggests.

**Output.** A self-assigned read on the analysis's weak points — the
assumptions and evidence a rigorous challenger would attack first — and any
confidence caveats that belong in the dissemination phase.
