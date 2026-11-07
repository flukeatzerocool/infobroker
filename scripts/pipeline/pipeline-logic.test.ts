#!/usr/bin/env npx tsx
// pipeline-logic.test.ts — tests for the push-pipeline's shared decision
// helpers in lib.sh: step-range selection, findings parsing, secret redaction,
// run-directory resume selection, and the CLI surface. Offline and deterministic.
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
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

describe("staging safety", () => {
  it("denies secret-bearing and config paths", () => {
    for (const path of [
      "config.local.json",
      "nested/config.local.json",
      ".env",
      ".env.local",
      "certs/server.key",
      "certs/server.pem",
      "keys/store.p12",
      "id_rsa",
      ".infobroker/state.json",
      "vector-store.sqlite-wal",
    ]) {
      expect(runLib(`stage_path_denied "$1" && echo denied || echo allowed`, [path]).trim()).toBe("denied");
    }
    for (const path of ["src/index.ts", "README.md", "docs/key-rotation.md", "instructions/search-preferences.md"]) {
      expect(runLib(`stage_path_denied "$1" && echo denied || echo allowed`, [path]).trim()).toBe("allowed");
    }
  });

  it("resolves the version from the project dir, not the caller cwd", () => {
    const res = spawnSync("bash", ["-c", `source ${join(ROOT, LIB)}; pipeline_version "$1"`, "_", ROOT], {
      cwd: tmpdir(),
      encoding: "utf8",
    });
    expect(res.status).toBe(0);
    expect(res.stdout.trim()).toMatch(/^\d{4}\.\d{2}\.\d{2}$/);
  });
});

describe("should_skip_step", () => {
  function decision(stateFile: string, resumeActive: string, step: string, start = "", end = ""): string {
    return runLib(
      `if should_skip_step "$1" "$2" "$3" "$4" "$5" "$6"; then echo skip; else echo run; fi`,
      [stateFile, resumeActive, step, ORDER, start, end],
    ).trim();
  }

  it("skips a journaled step when the run is resuming", () => {
    const stateFile = join(tempDir("pipe-state-"), "state.json");
    writeFileSync(stateFile, JSON.stringify({ readthrough: true }));
    expect(decision(stateFile, "true", "readthrough")).toBe("skip");
    expect(decision(stateFile, "true", "sync")).toBe("run");
  });

  it("does not consult the journal when the run is not resuming", () => {
    const stateFile = join(tempDir("pipe-state-"), "state.json");
    writeFileSync(stateFile, JSON.stringify({ readthrough: true }));
    expect(decision(stateFile, "false", "readthrough")).toBe("run");
  });

  it("still honors --from/--to on a resumed run", () => {
    const stateFile = join(tempDir("pipe-state-"), "state.json");
    writeFileSync(stateFile, JSON.stringify({ readthrough: true }));
    expect(decision(stateFile, "true", "readthrough", "sync")).toBe("skip");
    expect(decision(stateFile, "true", "sync", "", "changelog")).toBe("run");
    expect(decision(stateFile, "false", "scan", "", "changelog")).toBe("skip");
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
  it("records repo, branch, head, and the run start time", () => {
    const file = join(tempDir("pipe-state-"), "state.json");
    runLib('state_init "$1" "$2" "$3" "$4"', [file, "/repo/a", "main", "abc123"]);
    const state = JSON.parse(readFileSync(file, "utf8"));
    expect(state).toMatchObject({
      repo: "/repo/a",
      branch: "main",
      head: "abc123",
    });
    expect(Number.isFinite(Date.parse(state.started_at))).toBe(true);
  });
});

describe("CLI surface", () => {
  it("--help lists the new flags and exits 0", () => {
    const res = spawnSync("bash", ["scripts/push-pipeline.sh", "--help"], { cwd: ROOT, encoding: "utf8" });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain("--run-id=<id>");
    expect(res.stdout).toContain("--to=S");
    expect(res.stdout).toContain("--no-commit");
    expect(res.stdout).toContain("--commit");
    expect(res.stdout).toContain("--no-mirror");
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

describe("derive_release_tag", () => {
  it("spells the tag as v<version>", () => {
    expect(runLib('derive_release_tag "$1"', ["2026.11.06"]).trim()).toBe("v2026.11.06");
  });
});

describe("classify_gate_failure", () => {
  it("passes on exit 0 regardless of attempt budget", () => {
    expect(runLib('classify_gate_failure "$1" "$2" "$3"', ["0", "5", "2"]).trim()).toBe("pass");
  });

  it("repairs until the budget is spent, then gives up", () => {
    const decisions = ["0", "1", "2"].map((attempt) =>
      runLib('classify_gate_failure "$1" "$2" "$3"', ["1", attempt, "2"]).trim(),
    );
    expect(decisions).toEqual(["repair", "repair", "giveup"]);
  });

  it("never repairs when the budget is zero", () => {
    expect(runLib('classify_gate_failure "$1" "$2" "$3"', ["1", "0", "0"]).trim()).toBe("giveup");
  });
});

describe("stage_denylist", () => {
  it("reports denied artifacts and ignores clean paths", () => {
    const staged = [
      "src/index.ts",
      "node_modules/pkg/index.js",
      "dist/server.js",
      "config.local.json",
      "secrets/id_rsa",
      "README.md",
    ].join("\n");
    expect(runLib('stage_denylist "$1"', [staged]).trim().split("\n")).toEqual([
      "node_modules/pkg/index.js",
      "dist/server.js",
      "config.local.json",
      "secrets/id_rsa",
    ]);
  });

  it("returns empty for a clean staged set", () => {
    expect(runLib('stage_denylist "$1"', ["src/index.ts\nREADME.md"]).trim()).toBe("");
  });
});

describe("should_commit", () => {
  it("skips an empty staged diff", () => {
    expect(runLib('should_commit "$1"', ["0"]).trim()).toBe("skip");
  });

  it("commits a non-empty staged diff", () => {
    expect(runLib('should_commit "$1"', ["1"]).trim()).toBe("commit");
  });
});

describe("recorded gate outputs", () => {
  const fixtureDir = join(ROOT, "test-fixtures", "pipeline");
  const fixtures = readdirSync(fixtureDir).filter((file) => file.endsWith(".txt"));

  it("has at least one recorded fixture", () => {
    expect(fixtures.length).toBeGreaterThan(0);
  });

  for (const file of fixtures) {
    it(`classifies ${file} from its recorded exit code`, () => {
      const body = readFileSync(join(fixtureDir, file), "utf8");
      const recorded = /^# rc: (\d+)$/m.exec(body);
      expect(recorded).not.toBeNull();
      const rc = Number(recorded![1]);
      const decision = runLib('classify_gate_failure "$1" "$2" "$3"', [String(rc), "2", "2"]).trim();
      expect(decision).toBe(rc === 0 ? "pass" : "giveup");
    });
  }
});

describe("review shards", () => {
  it("starts at S1 when there is no previous marker", () => {
    expect(runLib('next_review_shard "$1"', [""]).trim()).toBe("S1");
  });

  it("advances to the next shard", () => {
    expect(runLib('next_review_shard "$1"', ["S2"]).trim()).toBe("S3");
  });

  it("wraps from the last shard to the first", () => {
    const count = Number(runLib("review_shard_count").trim());
    expect(runLib('next_review_shard "$1"', [`S${count}`]).trim()).toBe("S1");
  });

  it("falls back to S1 for an unknown id", () => {
    expect(runLib('next_review_shard "$1"', ["S99"]).trim()).toBe("S1");
  });

  it("maps every shard id to a non-empty section range", () => {
    const count = Number(runLib("review_shard_count").trim());
    for (let i = 1; i <= count; i += 1) {
      expect(runLib('review_shard_sections "$1"', [`S${i}`]).trim().length).toBeGreaterThan(0);
    }
  });
});

describe("last_review_shard", () => {
  it("returns empty when no pipeline subject exists", () => {
    expect(runLib('last_review_shard "$1"', ["feat: thing\nfix: other"]).trim()).toBe("");
  });

  it("reads the newest marker", () => {
    const subjects = [
      "Push pipeline 2026-11-06 (review S3/6)",
      "Push pipeline 2026-11-05 (review S2/6)",
    ].join("\n");
    expect(runLib('last_review_shard "$1"', [subjects]).trim()).toBe("S3");
  });

  it("skips non-pipeline commits above the newest pipeline subject", () => {
    const subjects = ["README: tweak", "Push pipeline 2026-11-06 (review S4/6)"].join("\n");
    expect(runLib('last_review_shard "$1"', [subjects]).trim()).toBe("S4");
  });

  it("resets after a deep review", () => {
    const subjects = [
      "Push pipeline 2026-11-06 (deep review)",
      "Push pipeline 2026-11-05 (review S5/6)",
    ].join("\n");
    expect(runLib('last_review_shard "$1"', [subjects]).trim()).toBe("");
  });

  it("resets after an unmarked pipeline commit", () => {
    const subjects = ["Push pipeline 2026-11-06", "Push pipeline 2026-11-05 (review S5/6)"].join("\n");
    expect(runLib('last_review_shard "$1"', [subjects]).trim()).toBe("");
  });
});

describe("readthrough prompt scope", () => {
  const prompt = readFileSync(join(ROOT, "scripts", "pipeline", "prompts", "readthrough.md"), "utf8");

  it("takes its scope and base ref from the pipeline", () => {
    expect(prompt).toContain("<SCOPE>");
    expect(prompt).toContain("<BASE_REF>");
  });

  it("does not hardcode an end-to-end read", () => {
    expect(prompt).not.toContain("Read infobroker.md end to end");
  });
});

// ── split_commit_series ─────────────────────────────────────────────────────
// A split series must produce one commit per concern bucket, with every commit
// internally version-consistent (that is what the pre-commit `version-sync`
// hook enforces in the real repo), and must leave the final tree byte-identical
// to the tree it started from. The fixture repo carries a copy of the real
// version stamper so the rewind runs against the fixture root.

const VERSION_FILES = [
  "scripts/version.ts",
  "scripts/lib/version.ts",
  "scripts/lib/args.ts",
];

function copyVersionTooling(repo: string): void {
  for (const rel of VERSION_FILES) {
    const dest = join(repo, rel);
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, readFileSync(join(ROOT, rel)));
  }
  symlinkSync(join(ROOT, "node_modules"), join(repo, "node_modules"), "dir");
}

function writeStampFiles(repo: string, version: string): void {
  const iso = version.replace(/\./g, "-");
  const semver = version.split(".").map((s) => String(Number(s))).join(".");
  writeFileSync(
    join(repo, "package.json"),
    JSON.stringify(
      { name: "fixture", version, scripts: { typecheck: "exit 0" } },
      null,
      2,
    ) + "\n",
  );
  writeFileSync(
    join(repo, "package-lock.json"),
    JSON.stringify({ name: "fixture", version, packages: { "": { version } } }, null, 2) + "\n",
  );
  writeFileSync(
    join(repo, "server.json"),
    JSON.stringify({ version: semver, packages: [{ version: semver }] }, null, 2) + "\n",
  );
  writeFileSync(
    join(repo, "src/index.ts"),
    `const server = new McpServer({\n  name: "fixture",\n  version: "${version}",\n});\n`,
  );
  writeFileSync(join(repo, "AGENTS.md"), `# AGENTS.md — Fixture (v${version})\n`);
  writeFileSync(join(repo, "infobroker.md"), `# Fixture\n\n**Spec version:** ${version}\n`);
  writeFileSync(
    join(repo, "README.md"),
    `# Fixture\n\nLast updated: ${iso}.\n\n## Spec\n\nThe server is built from \`infobroker.md\`\n(v${version}), which defines every requirement and the gates that verify it.\n`,
  );
}

function git(repo: string, ...args: string[]): string {
  return execFileSync("git", ["-c", "user.name=Test", "-c", "user.email=test@example.com", ...args], {
    cwd: repo,
    encoding: "utf8",
  });
}

function seedSplitRepo(): { repo: string; snap: string; stampPaths: string } {
  const repo = tempDir("split-repo-");
  mkdirSync(join(repo, "src"), { recursive: true });
  writeStampFiles(repo, "2026.11.06");
  writeFileSync(join(repo, "CHANGELOG.md"), "# Changelog\n\n## 2026.11.06 — Fixture\n\n- Initial.\n");
  copyVersionTooling(repo);
  git(repo, "init", "-q");
  git(repo, "add", "-A");
  git(repo, "commit", "-q", "-m", "Initial");

  // Simulate a pipeline run: content changes plus a version bump.
  writeStampFiles(repo, "2026.11.07");
  writeFileSync(join(repo, "infobroker.md"), `# Fixture\n\n**Spec version:** 2026.11.07\n\nREQ-001 changed.\n`);
  writeFileSync(
    join(repo, "src/index.ts"),
    `// content change\nconst server = new McpServer({\n  name: "fixture",\n  version: "2026.11.07",\n});\n`,
  );
  writeFileSync(join(repo, "README.md"), readFileSync(join(repo, "README.md"), "utf-8") + "\nProse change.\n");
  writeFileSync(join(repo, "src/extra.ts"), "export const extra = 1;\n");
  writeFileSync(join(repo, "src/extra.test.ts"), "// test\n");
  mkdirSync(join(repo, "test-fixtures"), { recursive: true });
  writeFileSync(join(repo, "test-fixtures", "fixture.json"), "{}\n");
  writeFileSync(
    join(repo, "CHANGELOG.md"),
    "# Changelog\n\n## 2026.11.07 — Fixture\n\n- Changed.\n\n## 2026.11.06 — Fixture\n\n- Initial.\n",
  );
  git(repo, "add", "-A");

  const snap = join(repo, ".snapshot");
  mkdirSync(snap, { recursive: true });
  const stampPaths = join(snap, "stamp-paths.txt");
  writeFileSync(
    stampPaths,
    ["package.json", "package-lock.json", "server.json", "src/index.ts", "AGENTS.md", "infobroker.md", "README.md", "CHANGELOG.md"].join("\n") + "\n",
  );
  return { repo, snap, stampPaths };
}

function treeSnapshot(repo: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const rel of [
    "package.json",
    "package-lock.json",
    "server.json",
    "src/index.ts",
    "src/extra.ts",
    "src/extra.test.ts",
    "test-fixtures/fixture.json",
    "AGENTS.md",
    "infobroker.md",
    "README.md",
    "CHANGELOG.md",
  ]) {
    out[rel] = readFileSync(join(repo, rel), "utf-8");
  }
  return out;
}

function runSplit(repo: string, snap: string, stampPaths: string): { status: number; output: string } {
  const script = [
    `source ${LIB}`,
    `split_commit_series ${repo} 2026-11-07 2026.11.06 2026.11.07 ${snap} ${stampPaths} "Pipeline body."`,
  ].join("; ");
  const result = spawnSync("bash", ["-c", script], { cwd: ROOT, encoding: "utf8" });
  return { status: result.status ?? -1, output: `${result.stdout ?? ""}${result.stderr ?? ""}` };
}

describe("split_commit_series", () => {
  it("commits one bucket per concern and leaves the final tree intact", () => {
    const { repo, snap, stampPaths } = seedSplitRepo();
    const before = treeSnapshot(repo);

    const result = runSplit(repo, snap, stampPaths);
    expect(result.output).not.toContain("FAILED");
    expect(result.status, result.output).toBe(0);

    const subjects = git(repo, "log", "--format=%s").trim().split("\n");
    expect(subjects).toEqual([
      "Release: 2026.11.07",
      "Docs: update for 2026-11-07",
      "Tests: update for 2026-11-07",
      "Source: update for 2026-11-07",
      "Spec: update for 2026-11-07",
      "Initial",
    ]);
    // The source commit carries its own test ("source plus its tests").
    const sourceFiles = git(repo, "show", "--name-only", "--format=", "HEAD~3").trim().split("\n");
    expect(sourceFiles).toContain("src/extra.test.ts");

    // Every commit is internally version-consistent.
    for (const sha of git(repo, "rev-list", "HEAD").trim().split("\n")) {
      const at = (path: string): string => git(repo, "show", `${sha}:${path}`);
      const version = (JSON.parse(at("package.json")) as { version: string }).version;
      expect(at("src/index.ts")).toContain(`version: "${version}"`);
      expect(at("AGENTS.md")).toContain(`(v${version})`);
      expect(at("infobroker.md")).toContain(`**Spec version:** ${version}`);
      expect(at("README.md")).toContain(`(v${version}), which defines`);
      expect((JSON.parse(at("package-lock.json")) as { version: string }).version).toBe(version);
      const changelogTop = /^## (\d{4}\.\d{2}\.\d{2})/m.exec(at("CHANGELOG.md"));
      expect(changelogTop?.[1]).toBe(version);
    }

    expect(treeSnapshot(repo)).toEqual(before);
    expect(git(repo, "status", "--porcelain")).toBe("");
  });

  it("restores the tree and leaves no partial series when a step fails", () => {
    const { repo, snap, stampPaths } = seedSplitRepo();
    writeFileSync(
      join(repo, "package.json"),
      JSON.stringify({ name: "fixture", version: "2026.11.07", scripts: { typecheck: "exit 1" } }, null, 2) + "\n",
    );
    git(repo, "add", "-A");
    const before = treeSnapshot(repo);
    const head = git(repo, "rev-parse", "HEAD").trim();

    const result = runSplit(repo, snap, stampPaths);
    expect(result.status).toBe(1);
    expect(git(repo, "rev-parse", "HEAD").trim()).toBe(head);
    expect((JSON.parse(readFileSync(join(repo, "package.json"), "utf-8")) as { version: string }).version).toBe(
      "2026.11.07",
    );
    expect(treeSnapshot(repo)).toEqual(before);
  });
});
