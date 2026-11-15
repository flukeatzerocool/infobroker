// @implements REQ-055
// Test/gate isolation helper. Server-spawning checks inherit `process.env` by
// default; without this they can open (and migrate) the real user knowledge
// base. The helper writes a temp config whose storage path is a fresh temp
// directory and redirects HOME/XDG/TMPDIR.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { RUN_ROOT_ENV, testTmpDir } from "./test-tmp.js";

const REPO_ROOT = join(import.meta.dirname, "..", "..");

export interface IsolatedConfig {
  root: string;
  configPath: string;
  storagePath: string;
  env: NodeJS.ProcessEnv;
}

export function isolatedConfigEnv(base: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  return makeIsolatedConfig(base).env;
}

export function makeIsolatedConfig(base: NodeJS.ProcessEnv = process.env): IsolatedConfig {
  const root = testTmpDir("iso-");
  const storagePath = join(root, "knowledge-base");
  mkdirSync(storagePath, { recursive: true, mode: 0o700 });
  // Short child temp dir: spawned processes (tsx) derive a Unix-socket path
  // from TMPDIR, and deep nesting overflows the ~104-byte sockaddr limit.
  const childTmp = join(root, "t");
  mkdirSync(childTmp, { recursive: true, mode: 0o700 });

  const shipped = JSON.parse(readFileSync(join(REPO_ROOT, "config.json"), "utf-8")) as {
    kb?: Record<string, unknown>;
  };
  shipped.kb = {
    ...(shipped.kb ?? {}),
    storage_path: storagePath,
    auto_index: false,
  };
  const configPath = join(root, "config.json");
  writeFileSync(configPath, JSON.stringify(shipped, null, 2), { mode: 0o600 });

  const env: NodeJS.ProcessEnv = {
    ...base,
    HOME: root,
    XDG_DATA_HOME: join(root, "data"),
    TMPDIR: childTmp,
    INFOBROKER_CONFIG: configPath,
    INFOBROKER_CONFIG_LOCAL: join(root, "config.local.json"),
  };
  // A spawned server or gate is its own process, not a vitest worker: leaving
  // these set would send its temp roots into this run's root instead of the
  // isolated TMPDIR the suite asserts on.
  delete env["VITEST"];
  delete env[RUN_ROOT_ENV];

  return { root, configPath, storagePath, env };
}
