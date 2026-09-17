# Contributing to Infobroker

Thanks for your interest in Infobroker. This document explains how to set up
the project, run its checks, and submit changes.

## Where to contribute

The canonical repository is **[git.gay/flukeatzerocool/Infobroker](https://git.gay/flukeatzerocool/Infobroker)**.
File issues and open pull requests there.

The GitHub repository is a **read-only mirror** kept in sync from the canonical
origin, so changes opened against GitHub cannot be merged. Use GitHub only to
read the code.

## Development setup

Requirements: Node.js 20 or newer.

```sh
npm install       # install dependencies
npm run start     # run the server via tsx
```

## Before you commit

Run the full gate. It must pass before a pull request is considered:

```sh
npm run check
```

This runs typecheck, spec validation, README validation, script-discipline
checks, the test suite, the dependency-vulnerability audit, and the
empty-shipped-KB check. See `AGENTS.md` for what each gate enforces.

For server behavior, `infobroker.md` is the source of truth: every requirement
(REQ) there is implemented and cited from `src/`. When you change behavior,
change the corresponding REQ in the same commit.

## Making a change

1. Open an issue on the canonical repository describing the problem or
   proposal, especially for behavior changes.
2. Create a branch, make the change, and add or update tests.
3. Run `npm run check` until it passes.
4. If the change is semantic (behavior, tools, providers, or the spec), add an
   entry to `CHANGELOG.md` dated with today's calendar version. Version
   references are kept in sync by `npm run version-bump`.
5. Open a pull request against the canonical repository.

## Conventions

- Follow the existing code style; do not add comments unless they explain
  non-obvious intent.
- Keep scripts, specs, and documentation consistent with the conventions in
  `AGENTS.md`.
- Commit messages: a short summary line; the project's own pipeline uses
  `YYYY.MM.DD — <title>`.

## Reporting security issues

Please do not open a public issue for a security vulnerability. Report it
privately to the maintainers through the canonical repository.
