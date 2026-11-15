#!/usr/bin/env npx tsx
// assert-skills.test.ts — unit tests for the repo-mode skills assertion:
// a matching project layer passes, a missing skills entry fails, and a layer
// identified by a different path fails. Offline and deterministic; fixtures
// are written to a per-suite temp dir and removed in teardown.
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { assertSkills } from "./assert-skills.js";

const root = mkdtempSync(join(tmpdir(), "infobroker-assert-skills-"));
const project = join(root, "mcp-project", "opencode.json");
const skillsDir = join(root, "repo", "skills");

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

function capture(layers: unknown): string {
  const file = join(root, `debug-${Math.random().toString(16).slice(2)}.json`);
  writeFileSync(file, JSON.stringify(layers, null, 2));
  return file;
}

const ambient = {
  type: "document",
  path: join(root, "ambient", "opencode.json"),
  info: { skills: [join(root, "installed", "skills")] },
};

describe("assertSkills", () => {
  it("passes when the project layer declares the expected directory", () => {
    const file = capture([ambient, { type: "directory", source: join(root, "ambient") }, { type: "document", path: project, info: { skills: [skillsDir] } }]);
    const result = assertSkills(file, project, skillsDir);
    expect(result.ok).toBe(true);
    expect(result.detail).toContain(skillsDir);
  });

  it("fails when the project layer has no skills array", () => {
    const file = capture([ambient, { type: "document", path: project, info: {} }]);
    const result = assertSkills(file, project, skillsDir);
    expect(result.ok).toBe(false);
    expect(result.detail).toContain(project);
  });

  it("fails when only a different layer carries the skills entry", () => {
    const file = capture([{ type: "document", path: join(root, "other.json"), info: { skills: [skillsDir] } }]);
    const result = assertSkills(file, project, skillsDir);
    expect(result.ok).toBe(false);
    expect(result.detail).toContain("no document layer");
  });

  it("fails when the layer identifies the project but lists another directory", () => {
    const file = capture([{ type: "document", path: project, info: { skills: [join(root, "elsewhere", "skills")] } }]);
    const result = assertSkills(file, project, skillsDir);
    expect(result.ok).toBe(false);
    expect(result.detail).toContain("does not declare");
  });
});
