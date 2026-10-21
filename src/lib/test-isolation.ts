// @implements REQ-055
// Test/gate isolation helper. Server-spawning checks inherit `process.env` by
// default; without this they can open (and migrate) the real user knowledge
// base. The helper writes a temp config whose storage path is a fresh temp
// directory, pins the JSON backend, and redirects HOME/XDG/TMPDIR.
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

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
  const root = mkdtempSync(join(tmpdir(), "infobroker-gate-"));
  const storagePath = join(root, "knowledge-base");
  mkdirSync(storagePath, { recursive: true, mode: 0o700 });

  const shipped = JSON.parse(readFileSync(join(REPO_ROOT, "config.json"), "utf-8")) as {
    kb?: Record<string, unknown>;
  };
  shipped.kb = {
    ...(shipped.kb ?? {}),
    storage_path: storagePath,
    store_backend: "json",
    auto_index: false,
  };
  const configPath = join(root, "config.json");
  writeFileSync(configPath, JSON.stringify(shipped, null, 2), { mode: 0o600 });

  return {
    root,
    configPath,
    storagePath,
    env: {
      ...base,
      HOME: root,
      XDG_DATA_HOME: join(root, "data"),
      TMPDIR: root,
      INFOBROKER_CONFIG: configPath,
      INFOBROKER_CONFIG_LOCAL: join(root, "config.local.json"),
    },
  };
}
