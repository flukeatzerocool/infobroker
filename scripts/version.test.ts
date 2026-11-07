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
import { today } from "./lib/version.js";

const ROOT = join(import.meta.dirname, "..");
const CURRENT = "2026.11.7";
const LEGACY = "2026.11.06";

const tempDirs: string[] = [];

function fixture(version = CURRENT): string {
  const dir = mkdtempSync(join(tmpdir(), "version-fixture-"));
  tempDirs.push(dir);
  mkdirSync(join(dir, "src"), { recursive: true });
  const files: Record<string, string> = {
    "package.json": JSON.stringify({ name: "fixture", version }, null, 2) + "\n",
    "package-lock.json":
      JSON.stringify(
        { name: "fixture", version, lockfileVersion: 3, packages: { "": { version } } },
        null,
        2,
      ) + "\n",
    "server.json": JSON.stringify({ version, packages: [{ version }] }, null, 2) + "\n",
    "src/index.ts": `const server = new McpServer({\n  name: "fixture",\n  version: "${version}",\n});\n`,
    "AGENTS.md": `# AGENTS.md — Fixture (v${version})\n`,
    "infobroker.md": `# Fixture\n\n**Spec version:** ${version}\n`,
    "README.md": [
      "# Fixture",
      "",
      `Last updated: ${CURRENT === version ? "2026-11-07" : "2026-11-06"}.`,
      "",
      "## Spec",
      "",
      "The server is built from a single source specification, `infobroker.md`",
      `(v${version}), which defines every requirement and the gates that verify it.`,
      "",
    ].join("\n"),
    "CHANGELOG.md":
      `# Changelog\n\n## ${version} — Fixture\n\n- Initial.\n\n` +
      `## ${LEGACY} — Fixture\n\n- Earlier.\n\n## 2026.9.30 — Fixture\n\n- Older.\n`,
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

describe("today", () => {
  it("spells a calendar date as valid SemVer without leading zeros", () => {
    expect(today(new Date(2026, 0, 5))).toBe("2026.1.5");
    expect(today(new Date(2026, 10, 7))).toBe("2026.11.7");
    expect(today(new Date(2027, 11, 31))).toBe("2027.12.31");
  });
});

describe("setVersion", () => {
  it("rewrites every enumerated stamp site", () => {
    const dir = fixture();
    expect(setVersion(CURRENT, dir)).toBe(true);

    expect(JSON.parse(read(dir, "package.json")).version).toBe(CURRENT);
    expect(JSON.parse(read(dir, "package-lock.json")).packages[""].version).toBe(CURRENT);
    expect(JSON.parse(read(dir, "server.json")).version).toBe(CURRENT);
    expect(JSON.parse(read(dir, "server.json")).packages[0].version).toBe(CURRENT);
    expect(read(dir, "src/index.ts")).toContain(`version: "${CURRENT}"`);
    expect(read(dir, "AGENTS.md")).toContain(`(v${CURRENT})`);
    expect(read(dir, "infobroker.md")).toContain(`**Spec version:** ${CURRENT}`);
    expect(read(dir, "README.md")).toContain(`(v${CURRENT}), which defines every requirement`);
    expect(read(dir, "README.md")).toContain("Last updated: 2026-11-07.");
  });

  it("round-trips to the original bytes", () => {
    const dir = fixture();
    const before = snapshot(dir);
    expect(setVersion(LEGACY, dir)).toBe(true);
    expect(setVersion(CURRENT, dir)).toBe(true);
    expect(snapshot(dir)).toEqual(before);
  });

  it("accepts a legacy padded target for the pipeline rewind", () => {
    const dir = fixture();
    expect(setVersion(LEGACY, dir)).toBe(true);
    expect(JSON.parse(read(dir, "package.json")).version).toBe(LEGACY);
    expect(JSON.parse(read(dir, "server.json")).version).toBe(LEGACY);
    expect(read(dir, "README.md")).toContain("Last updated: 2026-11-06.");
  });

  it("leaves CHANGELOG untouched", () => {
    const dir = fixture();
    const before = read(dir, "CHANGELOG.md");
    expect(setVersion(CURRENT, dir)).toBe(true);
    expect(read(dir, "CHANGELOG.md")).toBe(before);
  });

  it("fails loudly when a stamp anchor is missing", () => {
    const dir = fixture();
    writeFileSync(join(dir, "infobroker.md"), "# Fixture\n\nno spec stamp here\n");
    expect(setVersion(CURRENT, dir)).toBe(false);
  });

  it("fails when the README spec reference is missing", () => {
    const dir = fixture();
    writeFileSync(join(dir, "README.md"), "# Fixture\n\nLast updated: 2026-11-07.\n");
    expect(setVersion(CURRENT, dir)).toBe(false);
  });
});

describe("check", () => {
  it("passes on a consistent tree with mixed-spelling history", () => {
    expect(check(fixture())).toBe(true);
  });

  it("compares mixed-spelling CHANGELOG dates numerically", () => {
    const dir = fixture();
    expect(setVersion("2026.10.1", dir)).toBe(true);
    writeFileSync(
      join(dir, "CHANGELOG.md"),
      "# Changelog\n\n## 2026.10.1 — Fixture\n\n- New.\n\n## 2026.9.30 — Fixture\n\n- Old.\n",
    );
    // Lexicographic comparison would pick 2026.9.30 as the latest date.
    expect(check(dir)).toBe(true);
  });

  it("fails when the spec version drifts", () => {
    const dir = fixture();
    writeFileSync(join(dir, "infobroker.md"), `# Fixture\n\n**Spec version:** ${LEGACY}\n`);
    expect(check(dir)).toBe(false);
  });

  it("fails when the README spec reference drifts", () => {
    const dir = fixture();
    writeFileSync(
      join(dir, "README.md"),
      read(dir, "README.md").replace(`(v${CURRENT})`, `(v${LEGACY})`),
    );
    expect(check(dir)).toBe(false);
  });

  it("fails on a padded package version", () => {
    const dir = fixture();
    expect(setVersion(LEGACY, dir)).toBe(true);
    writeFileSync(join(dir, "CHANGELOG.md"), `# Changelog\n\n## ${LEGACY} — Fixture\n\n- Old.\n`);
    expect(check(dir)).toBe(false);
  });

  it("does not assert the README last-updated date", () => {
    const dir = fixture();
    writeFileSync(
      join(dir, "README.md"),
      read(dir, "README.md").replace("Last updated: 2026-11-07.", "Last updated: 2025-01-01."),
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
    expect(result.stderr).toContain("set <YYYY.M.D>");
  });

  it("rejects a truncated or over-long CalVer", () => {
    for (const value of ["2026.11", "2026.11.7.1"]) {
      const result = spawnSync("npx", ["tsx", "scripts/version.ts", "set", value], {
        cwd: ROOT,
        encoding: "utf8",
      });
      expect(result.status, value).toBe(1);
    }
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
