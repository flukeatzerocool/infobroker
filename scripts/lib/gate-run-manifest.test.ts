// gate-run-manifest.test — unit tests for the gate-run record. Role: test.
//
// Every case builds a throwaway git repository, so the suite exercises the real
// git plumbing (tree object and clean-tree check) rather than a stub. Records
// are written under the OS temp directory, keyed by repo root, and removed in
// `afterEach`.

import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  gateRunMatches,
  readGateRun,
  recordPath,
  recordedMode,
  treeState,
  writeGateRun,
} from "./gate-run-manifest.js";

const repos: string[] = [];

function makeRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), "infobroker-gate-run-"));
  repos.push(dir);
  const git = (...args: string[]): string =>
    execFileSync("git", ["-c", "user.email=t@example.com", "-c", "user.name=T", ...args], {
      cwd: dir,
      encoding: "utf-8",
    });
  git("init", "-q");
  writeFileSync(join(dir, "a.txt"), "one\n");
  git("add", "a.txt");
  git("commit", "-q", "-m", "first");
  return dir;
}

function commit(dir: string, message: string): void {
  writeFileSync(join(dir, `note-${message}.txt`), `${message}\n`);
  execFileSync("git", ["add", "-A"], { cwd: dir });
  execFileSync(
    "git",
    ["-c", "user.email=t@example.com", "-c", "user.name=T", "commit", "-q", "-m", message],
    { cwd: dir },
  );
}

afterEach(() => {
  for (const dir of repos.splice(0)) {
    rmSync(recordPath(dir), { force: true });
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("gate run record", () => {
  it("records and matches the exact tree", () => {
    const dir = makeRepo();
    expect(readGateRun(dir)).toBeNull();
    expect(gateRunMatches(dir, "full")).toBe(false);

    const record = writeGateRun(dir, "full");
    expect(record).not.toBeNull();
    expect(readGateRun(dir)?.mode).toBe("full");
    expect(gateRunMatches(dir, "full")).toBe(true);
    expect(gateRunMatches(dir, "fast")).toBe(true);
    expect(recordedMode(dir)).toBe("full");
  });

  it("does not let a fast record satisfy a full requirement", () => {
    const dir = makeRepo();
    writeGateRun(dir, "fast");
    expect(gateRunMatches(dir, "fast")).toBe(true);
    expect(gateRunMatches(dir, "full")).toBe(false);
    expect(recordedMode(dir)).toBe("fast");
  });

  it("invalidates after a new commit", () => {
    const dir = makeRepo();
    writeGateRun(dir, "full");
    commit(dir, "second");
    expect(gateRunMatches(dir, "full")).toBe(false);
    expect(recordedMode(dir)).toBeNull();
  });

  it("invalidates on a modified tracked file", () => {
    const dir = makeRepo();
    writeGateRun(dir, "full");
    writeFileSync(join(dir, "a.txt"), "edited\n");
    expect(gateRunMatches(dir, "full")).toBe(false);
  });

  it("invalidates on an untracked file and refuses to record a dirty tree", () => {
    const dir = makeRepo();
    writeFileSync(join(dir, "scratch.txt"), "untracked\n");
    expect(treeState(dir)?.clean).toBe(false);
    expect(writeGateRun(dir, "full")).toBeNull();
    expect(readGateRun(dir)).toBeNull();
  });

  it("keys the record by repository root", () => {
    const first = makeRepo();
    const second = makeRepo();
    writeGateRun(first, "full");
    expect(recordPath(first)).not.toBe(recordPath(second));
    expect(gateRunMatches(first, "full")).toBe(true);
    expect(gateRunMatches(second, "full")).toBe(false);
  });

  it("treats a corrupt record as absent", () => {
    const dir = makeRepo();
    mkdirSync(dirname(recordPath(dir)), { recursive: true });
    writeFileSync(recordPath(dir), "{not json\n");
    expect(readGateRun(dir)).toBeNull();
    expect(gateRunMatches(dir, "full")).toBe(false);
  });
});
