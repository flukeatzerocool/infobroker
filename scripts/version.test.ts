#!/usr/bin/env npx tsx
// version.test.ts — unit tests for the version stamp rewrite (`setVersion`),
// the sync check, and the `set` CLI guard. Role: test. Each case builds a
// throwaway fixture tree that mirrors the real file formats, so the rewrite is
// exercised against the same anchors the repository uses. Offline, deterministic.

import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { check, setVersion } from "./version.js";

const ROOT = join(import.meta.dirname, "..");
const OLD = "2026.11.06";
const NEW = "2026.11.07";

const tempDirs: string[] = [];

function fixture(): string {
  const dir = mkdtempSync(join(tmpdir(), "version-fixture-"));
  tempDirs.push(dir);
  mkdirSync(join(dir, "src"), { recursive: true });
  const files: Record<string, string> = {
    "package.json": JSON.stringify({ name: "fixture", version: OLD }, null, 2) + "\n",
    "package-lock.json":
      JSON.stringify(
        { name: "fixture", version: OLD, lockfileVersion: 3, packages: { "": { version: OLD } } },
        null,
        2,
      ) + "\n",
    "server.json":
      JSON.stringify({ version: "2026.11.6", packages: [{ version: "2026.11.6" }] }, null, 2) + "\n",
    "src/index.ts": `const server = new McpServer({\n  name: "fixture",\n  version: "${OLD}",\n});\n`,
    "AGENTS.md": `# AGENTS.md — Fixture (v${OLD})\n`,
    "infobroker.md": `# Fixture\n\n**Spec version:** ${OLD}\n`,
    "README.md": [
      "# Fixture",
      "",
      `Last updated: ${OLD.replace(/\./g, "-")}.`,
      "",
      "## Spec",
      "",
      "The server is built from a single source specification, `infobroker.md`",
      `(v${OLD}), which defines every requirement and the gates that verify it.`,
      "",
    ].join("\n"),
    "CHANGELOG.md": `# Changelog\n\n## ${OLD} — Fixture\n\n- Initial.\n`,
  };
  for (const [path, content] of Object.entries(files)) {
    writeFileSync(join(dir, path), content);
  }
  return dir;
}

function read(dir: string, path: string): string {
  return readFileSync(join(dir, path), "utf-8");
}

function snapshot(dir: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const path of [
    "package.json",
    "package-lock.json",
    "server.json",
    "src/index.ts",
    "AGENTS.md",
    "infobroker.md",
    "README.md",
  ]) {
    out[path] = read(dir, path);
  }
  return out;
}

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("setVersion", () => {
  it("rewrites every enumerated stamp site", () => {
    const dir = fixture();
    expect(setVersion(NEW, dir)).toBe(true);

    expect(JSON.parse(read(dir, "package.json")).version).toBe(NEW);
    expect(JSON.parse(read(dir, "package-lock.json")).packages[""].version).toBe(NEW);
    expect(JSON.parse(read(dir, "server.json")).version).toBe("2026.11.7");
    expect(read(dir, "src/index.ts")).toContain(`version: "${NEW}"`);
    expect(read(dir, "AGENTS.md")).toContain(`(v${NEW})`);
    expect(read(dir, "infobroker.md")).toContain(`**Spec version:** ${NEW}`);
    expect(read(dir, "README.md")).toContain(`(v${NEW}), which defines every requirement`);
    expect(read(dir, "README.md")).toContain("Last updated: 2026-11-07.");
  });

  it("round-trips to the original bytes", () => {
    const dir = fixture();
    const before = snapshot(dir);
    expect(setVersion(NEW, dir)).toBe(true);
    expect(setVersion(OLD, dir)).toBe(true);
    expect(snapshot(dir)).toEqual(before);
  });

  it("leaves CHANGELOG untouched", () => {
    const dir = fixture();
    const before = read(dir, "CHANGELOG.md");
    expect(setVersion(NEW, dir)).toBe(true);
    expect(read(dir, "CHANGELOG.md")).toBe(before);
  });

  it("fails loudly when a stamp anchor is missing", () => {
    const dir = fixture();
    writeFileSync(join(dir, "infobroker.md"), "# Fixture\n\nno spec stamp here\n");
    expect(setVersion(NEW, dir)).toBe(false);
  });

  it("fails when the README spec reference is missing", () => {
    const dir = fixture();
    writeFileSync(join(dir, "README.md"), "# Fixture\n\nLast updated: 2026-11-06.\n");
    expect(setVersion(NEW, dir)).toBe(false);
  });
});

describe("check", () => {
  it("passes on a consistent tree", () => {
    expect(check(fixture())).toBe(true);
  });

  it("fails when the spec version drifts", () => {
    const dir = fixture();
    writeFileSync(join(dir, "infobroker.md"), `# Fixture\n\n**Spec version:** ${NEW}\n`);
    expect(check(dir)).toBe(false);
  });

  it("fails when the README spec reference drifts", () => {
    const dir = fixture();
    writeFileSync(
      join(dir, "README.md"),
      read(dir, "README.md").replace(`(v${OLD})`, `(v${NEW})`),
    );
    expect(check(dir)).toBe(false);
  });

  it("does not assert the README last-updated date", () => {
    const dir = fixture();
    writeFileSync(
      join(dir, "README.md"),
      read(dir, "README.md").replace("Last updated: 2026-11-06.", "Last updated: 2025-01-01."),
    );
    expect(check(dir)).toBe(true);
  });
});

describe("set CLI guard", () => {
  it("rejects a non-CalVer argument", () => {
    const result = spawnSync("npx", ["tsx", "scripts/version.ts", "set", "not-a-version"], {
      cwd: ROOT,
      encoding: "utf8",
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("set <YYYY.MM.DD>");
  });

  it("documents the set subcommand in --help", () => {
    const result = spawnSync("npx", ["tsx", "scripts/version.ts", "--help"], {
      cwd: ROOT,
      encoding: "utf8",
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("set <version>");
  });
});
