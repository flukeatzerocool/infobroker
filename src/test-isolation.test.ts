// @implements REQ-055 REQ-108
import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { makeIsolatedConfig } from "./lib/test-isolation.js";

const REPO_ROOT = join(import.meta.dirname, "..");

function findFile(dir: string, name: string): boolean {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && findFile(join(dir, entry.name), name)) return true;
    if (entry.isFile() && entry.name === name) return true;
  }
  return false;
}

describe("gate isolation (REQ-055)", () => {
  it("makes a server-spawning gate write only inside the temp store", () => {
    const iso = makeIsolatedConfig();
    try {
      // The shipped config is temporarily switched to SQLite so the spawned
      // server creates an observable artifact in the isolated directory.
      const config = JSON.parse(readFileSync(iso.configPath, "utf-8")) as {
        kb: Record<string, unknown>;
      };
      config.kb.store_backend = "sqlite";
      writeFileSync(iso.configPath, JSON.stringify(config, null, 2));

      // Remove the outer helper's artifacts so anything found afterwards was
      // created by the spawned gate itself.
      rmSync(iso.configPath, { force: true });
      rmSync(iso.storagePath, { recursive: true, force: true });

      const canaryDir = mkdtempSync(join(tmpdir(), "infobroker-canary-"));
      const canary = join(canaryDir, "vector-store.json");
      writeFileSync(canary, "canary");
      const before = statSync(canary).mtimeMs;

      execFileSync("npx", ["tsx", "scripts/check-intent-citations.ts"], {
        cwd: REPO_ROOT,
        env: iso.env,
        timeout: 120_000,
        stdio: "pipe",
      });

      expect(findFile(iso.root, "config.json")).toBe(true);
      expect(statSync(canary).mtimeMs).toBe(before);
      rmSync(canaryDir, { recursive: true, force: true });
    } finally {
      rmSync(iso.root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  }, 180_000);
});
