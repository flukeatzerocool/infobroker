# Skill Authoring Template

Template for adding a new workflow shape (or a standalone research skill)
under `skills/`. Follow the conventions the bundled skills already use, so a
new shape is discoverable by the `infobroker` orchestrator and verifiable by
the gates.

## 1. File layout

```
skills/<name>/SKILL.md                 # required entry point
skills/<name>/references/<topic>.md    # optional reference material
```

## 2. Frontmatter

```yaml
---
name: <name>
description: >
  When to use, one paragraph: the research intents it serves, the tools it
  chains, and the escalation or fallback it offers. Keep it intent-driven so
  auto-selection can match user language to it.
metadata:
  version: "1.0"
  category: research
---
```

## 3. Body — required sections

1. **When to Use / When NOT to Use.** Boundary conditions, with the
   lighter/heavier skill each side routes to.
2. **Phase 0 — classify.** A gate that maps intent to this shape before any
   tool call, with a grep-able one-line status.
3. **Pipeline.** Compose the shared primitives from
   `skills/infobroker/references/workflows.md` — recall → search → extract →
   verify → write → polish → cite — into this shape's sequence. Every
   pipeline that may answer from the knowledge base MUST include a
   knowledge-base retrieval phase before external search (the `web_search`
   tool's built-in KB-first behavior satisfies this).
4. **Output contract.** A canonical output structure (link or embed a block
   from `skills/infobroker/references/report-template.md`) and edge cases.

## 4. Completion token (imperative)

End the deliverable with a single grep-able status line. State it as an
**imperative instruction inside the workflow steps** — e.g.:

> End your reply with the token, verbatim, as the final line:
> `<shape> complete. <N> sources | <K> findings | <gap> gaps noted`

A declarative `Token:` note in a reference file is not enough — the agent
must be told, as an action, to write the token. The token is part of the
deliverable, not a summary.

## 5. Wire it in

- Add the intent marker → shape row to `infobroker` `SKILL.md` Phase 0 and
  `references/journeys.md`.
- Add the shape definition to `references/workflows.md`.
- Add a node to the Mermaid diagram in `references/pipeline-map.md`.
- If the shape picks a structured analytic technique, follow the
  `analysis-loop` `references/techniques.md` selection guide and name the
  technique with its fit rationale.
