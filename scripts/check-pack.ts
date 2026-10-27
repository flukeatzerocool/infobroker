#!/usr/bin/env npx tsx
// check-pack.ts — gate: verify the published npm artifact is self-contained.
//
// Packs the package, asserts the allowlist (shipped config, skills,
// instructions, compiled server) and the denylist (user config, KB artifacts,
// secrets, sources), then installs the tarball in a scratch directory with no
// config.json and drives an MCP initialize + tools/list handshake.
//
// Exit codes: 0 = pass; 1 = check failure; 2 = fatal unexpected error.
// Usage: npx tsx scripts/check-pack.ts [--help]

import { spawn, spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { handleHelp } from "./lib/args.js";

const ROOT = join(import.meta.dirname, "..");
const USAGE = `Usage: npx tsx scripts/check-pack.ts

Packs the package and verifies the tarball is runnable without a local
config.json. Exit codes: 0 pass, 1 check failure, 2 fatal error.
`;

const REQUIRED = [
  "package.json",
  "README.md",
  "LICENSE",
  "bin/infobroker.js",
  "dist/index.js",
  "config.json",
  "skills/infobroker/SKILL.md",
  "instructions/search-preferences.md",
];

const EXPECTED_TOOLS = [
  "infobroker_fetch_page",
  "infobroker_get_citations",
  "infobroker_inspect_providers",
  "infobroker_manage_kb",
  "infobroker_reload_config",
  "infobroker_search_web",
  "infobroker_verify_claims",
];

const MAX_TARBALL_BYTES = 2 * 1024 * 1024;

class CheckError extends Error {}

function run(command: string, args: string[], cwd: string): void {
  const result = spawnSync(command, args, { cwd, encoding: "utf-8" });
  if (result.status !== 0) {
    throw new CheckError(
      `${command} ${args.join(" ")} failed (exit ${result.status ?? "signal"}):\n${result.stderr || result.stdout}`,
    );
  }
}

function forbidden(path: string): boolean {
  return (
    path === "config.local.json" ||
    path.startsWith("knowledge-base/") ||
    path.startsWith("src/") ||
    path.startsWith("scripts/") ||
    path.startsWith("test-fixtures/") ||
    path.startsWith("debate-club/") ||
    path.startsWith("node_modules/") ||
    path === ".env" ||
    path.startsWith(".env.") ||
    path.endsWith(".sqlite") ||
    path.endsWith(".sqlite-wal") ||
    path.endsWith(".sqlite-shm")
  );
}

function err(message: string): never {
  throw new CheckError(message);
}

interface PackReport {
  filename: string;
  size: number;
  files: { path: string }[];
}

function pack(destination: string): PackReport {
  const result = spawnSync("npm", ["pack", "--json", "--pack-destination", destination], {
    cwd: ROOT,
    encoding: "utf-8",
  });
  if (result.status !== 0) {
    err(`npm pack failed (exit ${result.status ?? "signal"}):\n${result.stderr || result.stdout}`);
  }
  const start = result.stdout.indexOf("[");
  if (start === -1) err(`npm pack produced no JSON:\n${result.stdout}`);
  const reports = JSON.parse(result.stdout.slice(start)) as PackReport[];
  const report = reports[0];
  if (!report) err("npm pack returned an empty report");
  return report;
}

function assertContents(report: PackReport): void {
  const paths = new Set((report.files ?? []).map((f) => f.path));
  const missing = REQUIRED.filter((p) => !paths.has(p));
  if (missing.length > 0) {
    err(`tarball is missing required entries: ${missing.join(", ")}`);
  }
  const forbiddenPaths = [...paths].filter(forbidden);
  if (forbiddenPaths.length > 0) {
    err(`tarball contains forbidden entries: ${forbiddenPaths.join(", ")}`);
  }
  if (report.size > MAX_TARBALL_BYTES) {
    err(`tarball is ${report.size} bytes, above the ${MAX_TARBALL_BYTES}-byte cap`);
  }
}

function handshake(packageRoot: string, scratch: string): Promise<void> {
  const home = join(scratch, "home");
  mkdirSync(join(home, ".config"), { recursive: true });
  mkdirSync(join(home, ".local", "share"), { recursive: true });
  mkdirSync(join(scratch, "tmp"), { recursive: true });

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    HOME: home,
    XDG_CONFIG_HOME: join(home, ".config"),
    XDG_DATA_HOME: join(home, ".local", "share"),
    TMPDIR: join(scratch, "tmp"),
  };
  delete env["INFOBROKER_CONFIG"];
  delete env["INFOBROKER_CONFIG_LOCAL"];

  const child = spawn("node", [join(packageRoot, "bin", "infobroker.js")], {
    cwd: scratch,
    env,
    stdio: ["pipe", "pipe", "pipe"],
  });

  return new Promise((resolve, reject) => {
    let stderr = "";
    let settled = false;
    let timer: NodeJS.Timeout | undefined;

    const finish = (error?: Error): void => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 1_000).unref();
      if (error) reject(error);
      else resolve();
    };

    const fail = (error: Error): void => finish(error);

    timer = setTimeout(() => {
      fail(new CheckError(`MCP handshake timed out after 15s\n${stderr}`));
    }, 15_000);

    child.on("error", (error) => fail(new CheckError(`failed to start server: ${error.message}`)));
    child.on("exit", (code, signal) => {
      if (!settled) {
        fail(new CheckError(`server exited before the handshake completed (code ${code}, signal ${signal})\n${stderr}`));
      }
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    const lines = createInterface({ input: child.stdout });
    lines.on("line", (line) => {
      if (settled) return;
      let message: { id?: number; result?: { tools?: { name: string }[] } };
      try {
        message = JSON.parse(line) as typeof message;
      } catch {
        // MCP stdio reserves stdout for JSON-RPC; anything else is a defect.
        fail(new CheckError(`non-JSON stdout from server: ${line.slice(0, 200)}`));
        return;
      }
      if (message.id === 1) {
        child.stdin.write(
          `${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })}\n`,
        );
        child.stdin.write(
          `${JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} })}\n`,
        );
      } else if (message.id === 2) {
        const names = (message.result?.tools ?? []).map((tool) => tool.name).sort();
        const expected = [...EXPECTED_TOOLS].sort();
        if (JSON.stringify(names) !== JSON.stringify(expected)) {
          fail(new CheckError(`tools/list returned [${names.join(", ")}], expected [${expected.join(", ")}]`));
          return;
        }
        finish();
      }
    });

    child.stdin.write(
      `${JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "check-pack", version: "1.0.0" },
        },
      })}\n`,
    );
  });
}

async function main(): Promise<void> {
  handleHelp(process.argv, USAGE);
  const unknown = process.argv.slice(2).filter((arg) => arg !== "--help" && arg !== "-h");
  if (unknown.length > 0) err(`unknown argument(s): ${unknown.join(" ")}\n${USAGE}`);

  const scratch = mkdtempSync(join(tmpdir(), "infobroker-pack-"));
  try {
    run("npm", ["run", "build"], ROOT);
    const report = pack(scratch);
    assertContents(report);

    const extract = join(scratch, "extract");
    mkdirSync(extract, { recursive: true });
    run("tar", ["-xzf", join(scratch, report.filename), "-C", extract], ROOT);
    const packageRoot = join(extract, "package");
    symlinkSync(
      join(ROOT, "node_modules"),
      join(packageRoot, "node_modules"),
      process.platform === "win32" ? "junction" : "dir",
    );

    const runDir = join(scratch, "run");
    mkdirSync(runDir, { recursive: true });
    await handshake(packageRoot, runDir);

    console.log(
      `check-pack: OK (${report.files.length} files, ${report.size} bytes, ${EXPECTED_TOOLS.length} tools)`,
    );
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

main().catch((error: unknown) => {
  if (error instanceof CheckError) {
    console.error(`check-pack: FAIL\n${error.message}`);
    process.exit(1);
  }
  console.error(`check-pack: FATAL\n${error instanceof Error ? error.stack ?? error.message : String(error)}`);
  process.exit(2);
});
