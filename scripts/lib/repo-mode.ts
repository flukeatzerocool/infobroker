// repo-mode.ts — shared repo-mode configuration for the research harness.
//
// Role: build tool. Both repo-mode entry points (scripts/test-research.sh and
// debate-club/scripts/lab.sh) build the same opencode project layer; keeping the
// MCP target, skills list, and KB isolation in one place stops them drifting
// apart. `.mjs` tests are run by the check-skill-harness gate; this module is
// exercised by scripts/lib/repo-mode.test.ts through vitest.
//
// The run-local layer is what makes a repo-mode run reproducible. Declaring
// this tree's skills stops an installed copy answering for it; pinning a
// run-scoped `kb.storage_path` and `kb.reports_dir` stops a recall from being
// corroborated by the operator's populated store or by an earlier run.
//
// Exit codes: 0 = pass; 1 = usage or build error; 2 = unexpected error.

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export interface IsolatedKbPaths {
  storagePath: string;
  reportsPath: string;
}

type JsonObject = Record<string, unknown>;

function isPlainObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The two run-scoped KB paths a repo-mode layer pins. */
export function isolatedKbPaths(kbRoot: string): IsolatedKbPaths {
  return {
    storagePath: join(kbRoot, "knowledge-base"),
    reportsPath: join(kbRoot, "reports"),
  };
}

/**
 * Pin an isolated KB on a run-local config layer.
 *
 * An explicit `kb: null` is the `constrained` Lab profile's "no knowledge
 * base" declaration; pinning a store would silently enable what the profile
 * disables, so that layer is returned unchanged.
 */
export function withIsolatedKb(layer: unknown, kbRoot: string): unknown {
  if (layer !== undefined && layer !== null && !isPlainObject(layer)) {
    throw new Error("repo-mode layer must be a JSON object");
  }
  const base: JsonObject = isPlainObject(layer) ? layer : {};
  if (base["kb"] === null) return { ...base };
  const { storagePath, reportsPath } = isolatedKbPaths(kbRoot);
  const kb = isPlainObject(base["kb"]) ? base["kb"] : {};
  return { ...base, kb: { ...kb, storage_path: storagePath, reports_dir: reportsPath } };
}

/**
 * The `opencode.json` a repo-mode run project declares: this tree's skills and
 * a local MCP command fed the run-local config layer.
 */
export function repoProjectConfig(repo: string, layerPath: string): JsonObject {
  return {
    "$schema": "https://opencode.ai/config.json",
    skills: [join(repo, "skills")],
    mcp: {
      infobroker: {
        type: "local",
        command: [join(repo, "node_modules", ".bin", "tsx"), join(repo, "src", "index.ts")],
        environment: {
          INFOBROKER_CONFIG: join(repo, "config.json"),
          INFOBROKER_CONFIG_LOCAL: layerPath,
        },
      },
    },
  };
}

const USAGE = `Usage: repo-mode.ts <command> [args]

  project <repo> <layer-path> <out-file>   Write the opencode project config.
  isolate-kb <kb-root> <layer-in> <out>    Pin the run-scoped KB on a layer.
                                           A missing <layer-in> starts from {}.
  paths <kb-root>                          Print the mcp-target KB lines.

Exit codes: 0 = pass; 1 = usage or build error; 2 = unexpected error.
`;

function readLayer(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, JSON.stringify(value, null, 2) + "\n");
}

function main(argv: string[]): number {
  if (argv.length === 0 || argv.includes("--help") || argv.includes("-h")) {
    process.stdout.write(USAGE);
    return argv.length === 0 ? 1 : 0;
  }
  const [command, ...rest] = argv;
  try {
    if (command === "project") {
      const [repo, layerPath, out] = rest;
      if (!repo || !layerPath || !out) {
        process.stderr.write(USAGE);
        return 1;
      }
      writeJson(out, repoProjectConfig(repo, layerPath));
      return 0;
    }
    if (command === "isolate-kb") {
      const [kbRoot, input, out] = rest;
      if (!kbRoot || !input || !out) {
        process.stderr.write(USAGE);
        return 1;
      }
      writeJson(out, withIsolatedKb(readLayer(input), kbRoot));
      return 0;
    }
    if (command === "paths") {
      const [kbRoot] = rest;
      if (!kbRoot) {
        process.stderr.write(USAGE);
        return 1;
      }
      const { storagePath, reportsPath } = isolatedKbPaths(kbRoot);
      process.stdout.write(`kb:${storagePath}\nkb:${reportsPath}\n`);
      return 0;
    }
    process.stderr.write(`Unknown command: ${command}\n${USAGE}`);
    return 1;
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main(process.argv.slice(2));
}
