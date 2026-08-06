# Skill Pipeline

```mermaid
flowchart TD
    U["👤 User asks a research/writing question"]

    U -->|"Research + Write"| RPMain

    subgraph RP["Research Professional Pipeline"]
        RPMain["infobroker web_search / converge"] --> Extract["infobroker fetch_page"]
        Extract --> Verify["deep-research Phase 3 + fact-checking"]
        Verify --> Summarize["summarization"]
        Summarize --> Write{"Output type?"}
        Write -->|"Report / doc / spec"| Tech["technical-writing"]
        Write -->|"Article / ad / persuasive"| Copy["copywriting"]
        Tech --> Polish["proofreading"]
        Copy --> Polish
    end

    U -->|"Fact-check"| FCMain

    subgraph FC["Fact-Check Pipeline"]
        FCMain["Extract claims from input"] --> FCSearch["infobroker web_search per claim"]
        FCSearch --> FCCC["infobroker converge cross-reference"]
        FCCC --> FCVerdict["fact-checking — assign verdicts"]
        FCVerdict --> FCSum["summarization — executive summary"]
    end

    U -->|"Code research"| CRMain

    subgraph CR["Code Research Pipeline"]
        CRMain["infobroker web_search provider=code"] --> CRFetch["infobroker fetch_page"]
        CRFetch --> CREval["code-review"]
        CREval --> CRDoc["technical-writing"]
    end

    Polish --> Output["📄 Researched, verified, written, proofread output"]
    FCSum --> Output2["📋 Fact-check report with confidence scores"]
    CRDoc --> Output3["📋 Evaluated code solutions with documentation"]

    style RP fill:#e8f5e9,stroke:#2e7d32
    style FC fill:#fff3e0,stroke:#ef6c00
    style CR fill:#e3f2fd,stroke:#1565c0
```

## Skill Dependency Graph

```
infobroker (orchestrator)
  ├── deep-research (sub-skill: Phase 3 verify, Phase 4 synthesize)
  ├── fact-checking (sub-skill: claim verdicts)
  ├── summarization (sub-skill: condense findings)
  ├── technical-writing (sub-skill: write docs/reports)
  ├── copywriting (sub-skill: write persuasive content)
  ├── proofreading (sub-skill: polish output)
  ├── code-review (sub-skill: evaluate code solutions)
  └── translation (sub-skill: multilingual output)

All sub-skills can be used standalone.
infobroker skill provides the pipeline orchestration.
```

## Client Instructions

`search-preferences.md` maps user intent to Infobroker tools.
It is loaded as an OpenCode instruction file and must appear
before any conflicting instruction files in the config.
