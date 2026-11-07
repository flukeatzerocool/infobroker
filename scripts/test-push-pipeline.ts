#!/usr/bin/env npx tsx
/**
 * test-push-pipeline.ts — hermetic harness for the publication pipeline. [gate]
 *
 * Purpose: the shell pipeline could only be tested against production, so a
 * control-flow defect surfaced as a failed publish. This harness builds a
 * disposable repository with a bare remote, copies the real pipeline scripts
 * into it, and stubs only the project toolchain (`INFOBROKER_PIPELINE_STUB=1`,
 * double-keyed to the scratch root). State, staging, denylist, secret scan,
 * commit, tag decision, atomic push, and resume are exercised for real.
 *
 * Usage: npx tsx scripts/test-push-pipeline.ts [--keep]
 * Exit codes: 0 = every case passed, 1 = a case failed, 2 = fatal.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { handleHelp, parseFlag, rejectUnknown } from "./lib/args.js";

const ROOT = join(import.meta.dirname, "..");
const SCRATCH_BASE = join("/tmp/opencode", "push-pipeline-harness");
const VERSION = "2026.11.07";
const TAG = `v${VERSION}`;

const USAGE = `Usage: npx tsx scripts/test-push-pipeline.ts [--keep]

  --keep  Keep the scratch repositories for debugging.
  --help  Show this message.
`;

let failures = 0;
const keep = parseFlag(process.argv.slice(2), "--keep");
handleHelp(process.argv.slice(2), USAGE);
rejectUnknown(process.argv.slice(2), new Set(["--keep", "--help", "-h"]), USAGE);

function check(name: string, condition: boolean, detail = ""): void {
  if (condition) {
    console.log(`PASS ${name}`);
  } else {
    failures++;
    console.error(`FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function git(cwd: string, args: string[]): string {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function tryGit(cwd: string, args: string[]): string | null {
  try {
    return git(cwd, args);
  } catch {
    return null;
  }
}

interface Repo {
  root: string;
  work: string;
  origin: string;
  runDir: string;
}

function write(work: string, path: string, body: string): void {
  writeFileSync(join(work, path), body);
}

/** buildRepo — a disposable repository with the real pipeline scripts. */
function buildRepo(name: string): Repo {
  mkdirSync(SCRATCH_BASE, { recursive: true });
  const root = mkdtempSync(join(SCRATCH_BASE, `${name}-`));
  const work = join(root, "work");
  const origin = join(root, "origin.git");
  mkdirSync(work);
  mkdirSync(join(root, "tmp"));

  execFileSync("git", ["init", "-q", "-b", "main", work]);
  git(work, ["config", "user.email", "harness@example.invalid"]);
  git(work, ["config", "user.name", "Pipeline Harness"]);

  write(work, "package.json", `${JSON.stringify({ name: "harness", version: VERSION }, null, 2)}\n`);
  write(
    work,
    "CHANGELOG.md",
    `# Changelog\n\n## ${VERSION}\n\n- Base entry for the harness.\n`,
  );
  write(work, "README.md", "# Harness\n\nA disposable tree for the push pipeline.\n");
  write(work, ".gitignore", "node_modules\n");
  write(work, "work.txt", "base\n");
  cpSync(join(ROOT, "scripts"), join(work, "scripts"), { recursive: true });
  // The copied pipeline shells out to `npx tsx scripts/...`; point it at the
  // real toolchain without copying it.
  execFileSync("ln", ["-s", join(ROOT, "node_modules"), join(work, "node_modules")]);

  git(work, ["add", "-A"]);
  git(work, ["commit", "-q", "-m", `${VERSION} — harness base`]);
  execFileSync("git", ["init", "-q", "--bare", origin]);
  git(work, ["remote", "add", "origin", origin]);
  git(work, ["push", "-q", "-u", "origin", "main"]);

  return { root, work, origin, runDir: join(root, "run") };
}

interface RunResult {
  status: number | null;
  output: string;
}

function runPipeline(repo: Repo, args: string[], runDir = repo.runDir): RunResult {
  const env = {
    ...process.env,
    INFOBROKER_PIPELINE_STUB: "1",
    INFOBROKER_PIPELINE_TEST_ROOT: repo.work,
    PIPELINE_RUN_DIR: runDir,
    TMPDIR: join(repo.root, "tmp"),
    OPC_TIMEOUT: "1",
  };
  const result = spawnSync("bash", [join(repo.work, "scripts", "push-pipeline.sh"), ...args], {
    cwd: repo.work,
    env,
    encoding: "utf8",
  });
  return { status: result.status, output: `${result.stdout ?? ""}\n${result.stderr ?? ""}` };
}

function tail(text: string): string {
  return text.split("\n").slice(-12).join("\n");
}

function hasRef(origin: string, ref: string): string | null {
  return tryGit(origin, ["rev-parse", "--verify", "-q", ref]);
}

/** prepareChange — an untracked file the pipeline will stage and commit. */
function prepareChange(repo: Repo): void {
  write(repo.work, "ahead.txt", "ahead\n");
}

function withRepo(name: string, body: (repo: Repo) => void, cleanup = true): void {
  const repo = buildRepo(name);
  try {
    body(repo);
  } catch (error) {
    failures++;
    console.error(`FAIL ${name} — threw: ${(error as Error).message}`);
  } finally {
    if (cleanup && !keep) rmSync(repo.root, { recursive: true, force: true });
    else if (keep) console.log(`KEEP ${repo.root}`);
  }
}

// ── case 1: happy path ───────────────────────────────────────────────────────
withRepo("happy", (repo) => {
  prepareChange(repo);
  const result = runPipeline(repo, ["--no-ai", "--yes", "--no-mirror"]);
  check("happy path exits 0", result.status === 0, tail(result.output));
  const remoteHead = hasRef(repo.origin, "refs/heads/main");
  const localHead = git(repo.work, ["rev-parse", "HEAD"]);
  check("branch reached the bare remote", remoteHead !== null);
  check("the run committed and pushed", remoteHead === localHead && localHead !== git(repo.origin, ["rev-parse", "refs/heads/main~1"]));
  check("tag reached the bare remote", hasRef(repo.origin, `refs/tags/${TAG}`) === localHead);
});

// ── case 2: --no-push commits locally only ───────────────────────────────────
withRepo("no-push", (repo) => {
  prepareChange(repo);
  const base = git(repo.work, ["rev-parse", "HEAD"]);
  const remoteBase = hasRef(repo.origin, "refs/heads/main");
  const result = runPipeline(repo, ["--no-ai", "--yes", "--no-push", "--no-mirror"]);
  check("--no-push exits 0", result.status === 0, tail(result.output));
  check("--no-push created a local commit", git(repo.work, ["rev-parse", "HEAD"]) !== base);
  check("--no-push created no local tag", tryGit(repo.work, ["rev-parse", "-q", "--verify", `refs/tags/${TAG}`]) === null);
  check("--no-push left the remote untouched", hasRef(repo.origin, "refs/heads/main") === remoteBase && hasRef(repo.origin, `refs/tags/${TAG}`) === null);
});

// ── case 3: preflight rejects a staged change ───────────────────────────────
withRepo("staged", (repo) => {
  const base = git(repo.work, ["rev-parse", "HEAD"]);
  write(repo.work, "staged.txt", "staged\n");
  git(repo.work, ["add", "staged.txt"]);
  const result = runPipeline(repo, ["--no-ai", "--yes", "--no-mirror"]);
  check("preflight rejects a staged tree", result.status === 1, tail(result.output));
  check("preflight changed no commit", git(repo.work, ["rev-parse", "HEAD"]) === base);
});

// ── case 4: a published tag is refused ──────────────────────────────────────
withRepo("published", (repo) => {
  const base = git(repo.work, ["rev-parse", "HEAD"]);
  git(repo.origin, ["update-ref", `refs/tags/${TAG}`, base]);
  prepareChange(repo);
  const result = runPipeline(repo, ["--no-ai", "--yes", "--no-mirror"]);
  check("a published tag is refused", result.status === 1, tail(result.output));
  check("the refusal names the immutable rule", /already published/.test(result.output));
  check("the published tag did not move", hasRef(repo.origin, `refs/tags/${TAG}`) === base);
});

// ── case 5: a local-only tag is moved (interrupted publish retry) ───────────
withRepo("retry-move", (repo) => {
  const base = git(repo.work, ["rev-parse", "HEAD"]);
  git(repo.work, ["tag", TAG, base]);
  prepareChange(repo);
  const result = runPipeline(repo, ["--no-ai", "--yes", "--no-mirror"]);
  check("a local-only tag retry exits 0", result.status === 0, tail(result.output));
  const head = git(repo.work, ["rev-parse", "HEAD"]);
  check("the local tag follows HEAD", git(repo.work, ["rev-parse", `${TAG}^{commit}`]) === head);
  check("the retried tag reached the remote", hasRef(repo.origin, `refs/tags/${TAG}`) === head);
});

// ── case 6: resume after a failed push ──────────────────────────────────────
withRepo("resume", (repo) => {
  prepareChange(repo);
  // Reject the first push at the remote, then let the resume through.
  writeFileSync(join(repo.origin, "hooks", "pre-receive"), "#!/usr/bin/env bash\nexit 1\n", { mode: 0o755 });
  const first = runPipeline(repo, ["--no-ai", "--yes", "--no-mirror"]);
  check("a rejected push fails the run", first.status === 1, tail(first.output));
  rmSync(join(repo.origin, "hooks", "pre-receive"));
  const second = runPipeline(repo, ["--no-ai", "--yes", "--no-mirror", "--resume"], repo.runDir);
  check("resume after a failed push exits 0", second.status === 0, tail(second.output));
  check("resume publishes the tag", hasRef(repo.origin, `refs/tags/${TAG}`) !== null);
});

// ── case 7: --dry-run is non-mutating ───────────────────────────────────────
withRepo("dry-run", (repo) => {
  const base = git(repo.work, ["rev-parse", "HEAD"]);
  const result = runPipeline(repo, ["--no-ai", "--dry-run", "--yes", "--no-mirror"]);
  check("--dry-run exits 0", result.status === 0, tail(result.output));
  check("--dry-run leaves the tree clean", git(repo.work, ["status", "--porcelain"]) === "");
  check("--dry-run creates no commit", git(repo.work, ["rev-parse", "HEAD"]) === base);
  check("--dry-run creates no tag", tryGit(repo.work, ["rev-parse", "-q", "--verify", `refs/tags/${TAG}`]) === null);
});

if (failures > 0) {
  console.error(`\ntest-push-pipeline: FAIL (${failures} case failure(s))`);
  process.exit(1);
}
console.log("\ntest-push-pipeline: PASS");
