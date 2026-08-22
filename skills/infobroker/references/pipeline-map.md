# Skill Pipeline

```mermaid
flowchart TD
    U["👤 User asks a research/writing question"]

    U -->|"Research + Write"| RPMain

    subgraph RP["Research Professional Pipeline"]
        RPMain["infobroker web_search / corroborate"] --> Extract["infobroker fetch_page"]
        Extract --> Verify["deep-research Phase 3 + fact-checking"]
        Verify --> Summarize["summarization"]
        Summarize --> Write["technical-writing"]
        Write --> Polish["proofreading"]
        Polish --> Translate["translation (optional)"]
    end

    U -->|"Fact-check"| FCMain

    subgraph FC["Fact-Check Pipeline"]
        FCMain["Extract claims from input"] --> FCSearch["infobroker web_search per claim"]
        FCSearch --> FCCC["infobroker corroborate cross-reference"]
        FCCC --> FCVerdict["fact-checking — assign verdicts"]
        FCVerdict --> FCSum["summarization — executive summary"]
    end

    U -->|"High-stakes rigor"| ALMain

    subgraph AL["Analysis Loop (escalation)"]
        ALMain["scope → collect → analyze → refine"]
    end

    Translate --> Output["📄 Researched, verified, written, proofread output"]
    FCSum --> Output2["📋 Fact-check report with confidence scores"]
    ALMain --> Output3["🧭 Confidence-scored, gated findings"]

    style RP fill:#e8f5e9,stroke:#2e7d32
    style FC fill:#fff3e0,stroke:#ef6c00
    style AL fill:#f3e5f5,stroke:#6a1b9a
```

## Skill Dependency Graph

```
infobroker (orchestrator)
  ├── deep-research (sub-skill: Phase 3 verify, Phase 4 synthesize)
  ├── fact-checking (sub-skill: claim verdicts)
  ├── summarization (sub-skill: condense findings)
  ├── technical-writing (sub-skill: write docs/reports)
  ├── proofreading (sub-skill: polish output)
  └── translation (sub-skill: multilingual output)

analysis-loop (sibling — escalate for gated analytic rigor)
  └── consumed directly by Infobroker tools, not by the orchestrator

All sub-skills can be used standalone.
infobroker skill provides the pipeline orchestration.
```

## Client Instructions

`search-preferences.md` maps user intent to Infobroker tools.
It is loaded as an OpenCode instruction file and must appear
before any conflicting instruction files in the config.
