// gate-manifest.ts — the single gate manifest for Infobroker.
//
// One source of truth for scripts/run-gates.ts (execution),
// scripts/check-gate-table.ts (the AGENTS.md gates table), and the
// `check` / `check:fast` package scripts. A gate's name is its npm script
// name, so a manifest entry cannot drift into an invocation that does not
// exist. `fast` marks the gates that need no network and no build artifact;
// `check:fast` runs exactly those, and `check` runs every gate in order.

export interface Gate {
  /** npm script name; also the row label in the AGENTS.md gates table. */
  name: string;
  /** What the gate checks, in the words the AGENTS.md table shows. */
  description: string;
  /** Included in `check:fast` (no network, no build artifact required). */
  fast: boolean;
}

// Order matters: it is the order `check` runs, and the old `&&` chain is the
// prefix so the historical failure order is preserved.
export const GATES: readonly Gate[] = [
  {
    name: "typecheck",
    description: "TypeScript type checking (`tsc --noEmit`)",
    fast: true,
  },
  {
    name: "version-sync",
    description: "Every version reference matches `package.json`",
    fast: true,
  },
  {
    name: "validate-spec",
    description: "Spec-code traceability, REQ body hygiene, bidirectional coverage",
    fast: true,
  },
  {
    name: "validate-readme",
    description: "README structure, tool/provider reconciliation, links, comparison table",
    fast: true,
  },
  {
    name: "check-roadmap",
    description: "Roadmap admission rule: one section per item, 1–3 bullets, a `**Trigger:**` line",
    fast: true,
  },
  {
    name: "check-non-goals",
    description: "Scope non-goals: list integrity in `DECISIONS.md` and a pointer from `ROADMAP.md`",
    fast: true,
  },
  {
    name: "check-report-fixtures",
    description: "Report contract fixtures: skeleton, manifest, citations, Source Register (REQ-116)",
    fast: true,
  },
  {
    name: "check-script-discipline",
    description:
      "Script discipline: shebang + header, exit-code contract, import.meta.dirname, no empty catch; `bash -n` syntax and removed-flag (`--attach`) checks over shell entry points and `scripts/**/*.mjs`",
    fast: true,
  },
  {
    name: "check-tdqs",
    description: "Deterministic TDQS 1.2 structural conformance over the live tool surface (REQ-106)",
    fast: true,
  },
  {
    name: "check-intent-citations",
    description:
      "Routing citations resolve against the live tool schema; every registered tool and declared operation is cited (REQ-107)",
    fast: true,
  },
  {
    name: "check-harness-expectations",
    description:
      "Harness `tool_audit` keys are registered with their encoded behavior and recognized by their evaluators",
    fast: true,
  },
  {
    name: "check-gate-coverage",
    description: "Every G1 REQ is backed by a test citation or a recorded exemption (REQ-055)",
    fast: true,
  },
  {
    name: "check-skill-harness",
    description:
      "Skill-check and event-stream evaluators: advisory exclusion, gating, intermediate-message tokens",
    fast: true,
  },
  {
    name: "test",
    description: "Vitest unit and integration tests",
    fast: true,
  },
  {
    name: "check-pack",
    description:
      "Published tarball allowlist/denylist and an MCP handshake from an empty config-less directory",
    fast: false,
  },
  {
    name: "test-debate-club",
    description:
      "debate-club Arena: deterministic, offline tool-contract suite (typecheck + fixture replay)",
    fast: false,
  },
  {
    name: "audit",
    description:
      "Dependency vulnerability gate — fails on high/critical `npm audit` findings (REQ-101); requires registry access",
    fast: false,
  },
  {
    name: "check-shipped-kb-empty",
    description: "Repo ships an empty KB — storage_path outside the tree, no KB artifacts",
    fast: true,
  },
  {
    name: "check-gate-table",
    description: "The AGENTS.md gates table matches this manifest",
    fast: true,
  },
  {
    name: "check-loop-artifacts",
    description: "Increment artifacts under `docs/plans/` carry plan, tasks, and a terminal LOOP token",
    fast: true,
  },
  {
    name: "typecheck:scripts",
    description: "TypeScript type checking for `scripts/` (`tsc -p tsconfig.scripts.json`)",
    fast: true,
  },
] as const;

/** The command that runs one gate. */
export function gateCommand(gate: Gate): string[] {
  return ["npm", "run", gate.name];
}

/** Gates `check:fast` runs, in manifest order. */
export function fastGates(): Gate[] {
  return GATES.filter((gate) => gate.fast);
}

/** The gates-table block, markers included, as pasted into AGENTS.md. */
export function renderGatesBlock(): string {
  const rows = GATES.map(
    (gate) => `| \`npm run ${gate.name}\` | ${gate.description} |`,
  );
  return [
    "<!-- gates:begin -->",
    "| Gate | What it checks |",
    "|---|---|",
    ...rows,
    "<!-- gates:end -->",
  ].join("\n");
}

/** The gates-table block without its markers, for comparison. */
export function renderGatesTable(): string {
  const block = renderGatesBlock().split("\n");
  return block.slice(1, -1).join("\n");
}
