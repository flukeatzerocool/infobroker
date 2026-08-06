---
name: code-review
description: >
  Use when the user asks for a code review, PR review, or diff analysis.
  Review for bugs, security, performance, readability, and maintainability
  with severity-tied feedback. Do not use for quick code lookups or reading
  code without evaluating it.
license: MIT
metadata:
  author: awesome-ai-agent-skills contributors (adapted for Opencode)
  source: https://github.com/seb1n/awesome-ai-agent-skills
  version: 1.0.0
---

# Code Review

## When NOT to Use

- Generated or vendored files unless explicitly requested.
- Style-only reformatting PRs with no semantic changes.
- Very large diffs (>1000 lines) without first warning the user and proposing
  to split the review.

## Workflow

1. **Establish context.** Read the file, diff, or PR. Identify changed lines
   and the author's intent from commit messages, PR description, and
   surrounding code.

2. **Check correctness.** Trace data flow through changed functions. Look for
   null dereferences, off-by-one errors, unhandled exceptions, race conditions,
   and resource leaks.

3. **Check security.** Scan for SQL injection, XSS, hardcoded secrets, insecure
   crypto, missing auth, and risky dependency additions.

4. **Check performance.** Flag nested loops over large data, N+1 queries,
   repeated allocations, and blocking calls in async contexts.

5. **Check readability and maintainability.** Evaluate naming, function length,
   duplication, type annotations, and adherence to project style.

6. **Report findings.** For each issue, state: severity (Critical / Warning /
   Info), file/line, problem, and a concrete fix or code snippet. Prioritize
   the top 5–7 issues.

## Severity Rules

- **Critical:** Must be fixed before merge. Security vulnerabilities,
  correctness bugs, or data-loss risks.
- **Warning:** Should be fixed soon. Performance issues, missing auth, or
  maintainability problems.
- **Info:** Suggestion. Style, naming, or minor improvements.

## Best Practices

- Review the diff, not the whole file. Only comment on pre-existing issues
  when they interact with the change.
- Suggest a replacement, not just a complaint.
- Acknowledge clean patterns when you see them.
- Verify tests exist for new logic and exercise edge cases, not just the
  happy path.

## Edge Cases

- **Incomplete context:** State assumptions clearly when you cannot access the
  full repository.
- **Language idioms:** Adjust expectations by language; explicit error returns
  are normal in Go, not necessarily a smell.
- **Large PRs:** Warn the author and focus on the highest-risk files first.

## Infobroker Integration

This skill is the evaluation phase of the Infobroker Code Research pipeline.
Code solutions found via Infobroker `web_search` (with Stack Exchange or
GitHub) and extracted via `fetch_page` are routed through this skill for
quality assessment before `technical-writing` documents the findings.
