#!/usr/bin/env npx tsx
// pipeline-logic.test.ts — tests for the push-pipeline's shared decision
// helpers in lib.sh: step-range selection, findings parsing, secret redaction,
// run-directory resume selection, and the CLI surface. Offline and deterministic.
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "..", "..");
const LIB = "scripts/pipeline/lib.sh";

const tempDirs: string[] = [];

function tempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function runLib(script: string, args: string[] = [], env: Record<string, string> = {}): string {
  return execFileSync("bash", ["-c", `source ${LIB}; ${script}`, "_", ...args], {
    cwd: ROOT,
    env: { ...process.env, ...env },
    encoding: "utf8",
  });
}

function runLibStatus(script: string, args: string[] = [], env: Record<string, string> = {}) {
  return spawnSync("bash", ["-c", `source ${LIB}; ${script}`, "_", ...args], {
    cwd: ROOT,
    env: { ...process.env, ...env },
    encoding: "utf8",
  });
}

afterEach(() => {
  while (tempDirs.length > 0) rmSync(tempDirs.pop()!, { recursive: true, force: true });
});

const ORDER = "readthrough sync auth changelog scan readme";

function range(start: string, end: string): Record<string, "run" | "skip"> {
  const out = runLib(
    `for s in ${ORDER}; do if step_should_run "$1" "$s" "$2" "$3"; then echo "$s:run"; else echo "$s:skip"; fi; done`,
    [ORDER, start, end],
  );
  return Object.fromEntries(
    out.trim().split("\n").map((line) => {
      const [step, state] = line.split(":");
      return [step, state as "run" | "skip"];
    }),
  );
}

describe("step_should_run", () => {
  it("runs every step when no range is supplied", () => {
    expect(range("", "")).toEqual({
      readthrough: "run",
      sync: "run",
      auth: "run",
      changelog: "run",
      scan: "run",
      readme: "run",
    });
  });

  it("skips steps before --from", () => {
    const result = range("sync", "");
    expect(result.readthrough).toBe("skip");
    expect(result.sync).toBe("run");
    expect(result.readme).toBe("run");
  });

  it("skips steps after --to (inclusive end)", () => {
    const result = range("", "changelog");
    expect(result.readthrough).toBe("run");
    expect(result.changelog).toBe("run");
    expect(result.scan).toBe("skip");
    expect(result.readme).toBe("skip");
  });

  it("honors both bounds together", () => {
    const result = range("sync", "changelog");
    expect(result.readthrough).toBe("skip");
    expect(result.sync).toBe("run");
    expect(result.changelog).toBe("run");
    expect(result.scan).toBe("skip");
  });

  it("runs everything when a name is not in the order (validation handles typos)", () => {
    expect(range("bogus", "").readthrough).toBe("run");
  });
});

describe("findings_count", () => {
  it("accepts an integer", () => {
    const file = join(tempDir("pipe-find-int-"), "s.json");
    writeFileSync(file, JSON.stringify({ status: "complete", findings: 4 }));
    expect(runLib('findings_count "$1"', [file]).trim()).toBe("4");
  });

  it("accepts an array", () => {
    const file = join(tempDir("pipe-find-arr-"), "s.json");
    writeFileSync(file, JSON.stringify({ findings: [{ kind: "a" }, { kind: "b" }] }));
    expect(runLib('findings_count "$1"', [file]).trim()).toBe("2");
  });

  it("fails on a malformed or missing count", () => {
    const file = join(tempDir("pipe-find-bad-"), "s.json");
    writeFileSync(file, JSON.stringify({ findings: "many" }));
    expect(runLibStatus('findings_count "$1"', [file]).status).not.toBe(0);
  });
});

describe("scan_staged_for_secrets", () => {
  it("reports path and line without leaking the matched value", () => {
    const dir = tempDir("pipe-secret-");
    execFileSync("git", ["init", "-q"], { cwd: dir });
    execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: dir });
    execFileSync("git", ["config", "user.name", "test"], { cwd: dir });
    const secret = `sk-${"A".repeat(24)}`;
    writeFileSync(join(dir, "leak.txt"), `token = ${secret}\n`);
    execFileSync("git", ["add", "leak.txt"], { cwd: dir });

    const out = runLib("scan_staged_for_secrets", [], { PROJECT_DIR: dir });
    expect(out).toContain("leak.txt:1");
    expect(out).toContain("[secret-pattern]");
    expect(out).not.toContain(secret);
    expect(out).not.toContain("AAA");
  });
});

describe("latest_run_dir", () => {
  it("selects the newest run matching repo and branch", () => {
    const root = tempDir("pipe-runs-");
    const make = (name: string, repo: string, branch: string) => {
      const dir = join(root, name);
      execFileSync("mkdir", ["-p", dir]);
      writeFileSync(join(dir, "state.json"), JSON.stringify({ repo, branch, head: "x" }));
    };
    make("run-20260101-000000", "/repo/a", "main");
    make("run-20260102-000000", "/repo/other", "main");
    make("run-20260103-000000", "/repo/a", "dev");

    const out = runLib('latest_run_dir "$1" "$2" "$3"', [root, "/repo/a", "main"]).trim();
    expect(out).toBe(join(root, "run-20260101-000000"));
  });

  it("fails when no run matches", () => {
    const root = tempDir("pipe-runs-none-");
    expect(runLibStatus('latest_run_dir "$1" "$2" "$3"', [root, "/repo/a", "main"]).status).not.toBe(0);
  });
});

describe("state_init", () => {
  it("records repo, branch, and head", () => {
    const file = join(tempDir("pipe-state-"), "state.json");
    runLib('state_init "$1" "$2" "$3" "$4"', [file, "/repo/a", "main", "abc123"]);
    expect(JSON.parse(readFileSync(file, "utf8"))).toEqual({
      repo: "/repo/a",
      branch: "main",
      head: "abc123",
    });
  });
});

describe("CLI surface", () => {
  it("--help lists the new flags and exits 0", () => {
    const res = spawnSync("bash", ["scripts/push-pipeline.sh", "--help"], { cwd: ROOT, encoding: "utf8" });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain("--run-id=<id>");
    expect(res.stdout).toContain("--to=S");
    expect(res.stdout).toContain("--no-commit");
  });

  it("rejects an unknown flag with the full usage", () => {
    const res = spawnSync("bash", ["scripts/push-pipeline.sh", "--bogus"], { cwd: ROOT, encoding: "utf8" });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("Unknown flag: --bogus");
    expect(res.stderr).toContain("--run-id=<id>");
  });
});

describe("push_action", () => {
  it("skips when --no-push is set", () => {
    expect(runLib('push_action true false false true').trim()).toBe("skip");
  });

  it("reports nothing to ship when there is no commit, no ahead, and a tag exists", () => {
    expect(runLib('push_action false false false false').trim()).toBe("nothing");
  });

  it("auto-approves with --yes on a shippable run", () => {
    expect(runLib('push_action false true false true').trim()).toBe("auto");
  });

  it("prompts on an interactive shippable run", () => {
    expect(runLib('push_action false false true true').trim()).toBe("prompt");
  });

  it("fails closed on a non-interactive run without --yes", () => {
    const res = runLibStatus('push_action false false false true');
    expect(res.status).toBe(1);
    expect(res.stdout.trim()).toBe("require-tty");
  });
});

describe("ERR-trap tolerance", () => {
  it("run_gate captures a failure without tripping the caller's ERR trap", () => {
    const log = join(tempDir("pipe-gate-"), "gate.log");
    const out = runLib(
      `set -Ee; trap 'exit 99' ERR; rc=0; run_gate probe "$1" false || rc=$?; echo "rc=$rc"`,
      [log],
    );
    expect(out).toContain("rc=1");
  });
});

describe("scan_staged_for_secrets scope", () => {
  it("does not flag secrets that were already committed", () => {
    const dir = tempDir("pipe-secret-committed-");
    execFileSync("git", ["init", "-q"], { cwd: dir });
    execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: dir });
    execFileSync("git", ["config", "user.name", "test"], { cwd: dir });
    writeFileSync(join(dir, "leak.txt"), `token = sk-${"B".repeat(24)}\n`);
    execFileSync("git", ["add", "leak.txt"], { cwd: dir });
    execFileSync("git", ["commit", "-qm", "seed"], { cwd: dir });
    writeFileSync(join(dir, "clean.txt"), "nothing sensitive here\n");
    execFileSync("git", ["add", "clean.txt"], { cwd: dir });

    const out = runLib("scan_staged_for_secrets", [], { PROJECT_DIR: dir });
    expect(out.trim()).toBe("");
  });
});
