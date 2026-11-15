#!/usr/bin/env npx tsx
// assert-skills.ts — Gate for repo-mode research runs: verify that the
// run-local opencode project declares this working tree's skills directory,
// so `--mcp=repo` cannot silently exercise an installed copy instead.
// Role: gate, invoked by scripts/test-research.sh (not wired into a
// package.json script — a deviation from the AGENTS.md wording, recorded as
// D-129). Reads `opencode debug config`'s captured output, never the network.
//
// Usage: assert-skills.ts <debug-config.json> <project-opencode.json> <expected-skills-dir>
// Exit: 0 assertion holds · 1 input unreadable/malformed or assertion failed
//       · 2 unexpected internal error.

import { readFileSync, realpathSync } from "node:fs";
import { resolve } from "node:path";

export type SkillAssertion = { ok: boolean; detail: string };

type Layer = {
  type?: unknown;
  path?: unknown;
  source?: unknown;
  info?: { skills?: unknown } | null;
};

/** Canonical path for comparison; a missing path falls back to resolve(). */
function canonical(path: string): string {
  try {
    return realpathSync(path);
  } catch {
    // Nonexistent paths are still comparable as resolved strings; the
    // assertion then fails on the comparison rather than on the fs error.
    return resolve(path);
  }
}

function describeSkills(skills: unknown): string {
  if (!Array.isArray(skills)) return `skills is ${skills === undefined ? "absent" : typeof skills}`;
  return `skills = [${skills.map((s) => String(s)).join(", ")}]`;
}

/**
 * Assert that the project layer of a captured `opencode debug config` declares
 * <expectedDir> in its skills list. Returns { ok, detail }; `detail` always
 * names what was found so a refusal is diagnosable.
 */
export function assertSkills(
  debugConfigPath: string,
  projectConfigPath: string,
  expectedDir: string,
): SkillAssertion {
  let raw: string;
  try {
    raw = readFileSync(debugConfigPath, "utf8");
  } catch (error) {
    return { ok: false, detail: `cannot read debug config ${debugConfigPath}: ${(error as Error).message}` };
  }

  let layers: unknown;
  try {
    layers = JSON.parse(raw);
  } catch (error) {
    return { ok: false, detail: `debug config ${debugConfigPath} is not JSON: ${(error as Error).message}` };
  }

  if (!Array.isArray(layers)) {
    return { ok: false, detail: `debug config is ${typeof layers}, expected an array of layers` };
  }

  const wanted = canonical(projectConfigPath);
  const match = layers.find(
    (layer): layer is Layer =>
      typeof layer === "object" &&
      layer !== null &&
      (layer as Layer).type === "document" &&
      typeof (layer as Layer).path === "string" &&
      canonical((layer as Layer).path as string) === wanted,
  );

  if (!match) {
    const seen = layers
      .map((l) => (typeof l === "object" && l !== null ? `${String((l as Layer).type)}:${String((l as Layer).path ?? (l as Layer).source ?? "")}` : typeof l))
      .join(" | ");
    return { ok: false, detail: `no document layer for ${projectConfigPath}; layers seen: ${seen}` };
  }

  const skills = match.info?.skills;
  if (!Array.isArray(skills)) {
    return { ok: false, detail: `project layer ${projectConfigPath} has no skills array (${describeSkills(skills)})` };
  }

  const expected = canonical(expectedDir);
  const hit = skills.some((s) => typeof s === "string" && canonical(s) === expected);
  if (!hit) {
    return { ok: false, detail: `project layer ${projectConfigPath} does not declare ${expectedDir} (${describeSkills(skills)})` };
  }

  return { ok: true, detail: `project layer declares ${expectedDir}` };
}

function main(argv: string[]): number {
  const [debugConfig, projectConfig, expectedDir] = argv;
  if (!debugConfig || !projectConfig || !expectedDir) {
    process.stderr.write(
      "usage: assert-skills.ts <debug-config.json> <project-opencode.json> <expected-skills-dir>\n",
    );
    return 1;
  }
  const { ok, detail } = assertSkills(debugConfig, projectConfig, expectedDir);
  (ok ? process.stdout : process.stderr).write(`${detail}\n`);
  return ok ? 0 : 1;
}

if (import.meta.filename === process.argv[1]) {
  try {
    process.exit(main(process.argv.slice(2)));
  } catch (error) {
    process.stderr.write(`assert-skills: unexpected error: ${(error as Error).message}\n`);
    process.exit(2);
  }
}
