// @implements REQ-010
// Resolution order for the shipped default and the user configuration layer:
// explicit env > existing sibling layer > user-scoped config directory.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const REPO_ROOT = join(import.meta.dirname, "..");

function resetEnv(): void {
  delete process.env["INFOBROKER_CONFIG"];
  delete process.env["INFOBROKER_CONFIG_LOCAL"];
  delete process.env["XDG_CONFIG_HOME"];
  delete process.env["APPDATA"];
  vi.resetModules();
}

async function loadConfigModule() {
  return import("./config.js");
}

describe("config path resolution (REQ-010)", () => {
  let dir: string;

  beforeEach(() => {
    resetEnv();
    dir = mkdtempSync(join(tmpdir(), "ib-config-path-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    resetEnv();
  });

  it("uses INFOBROKER_CONFIG when set", async () => {
    const base = join(dir, "custom.json");
    writeFileSync(base, "{}");
    process.env["INFOBROKER_CONFIG"] = base;
    const { getConfigPath } = await loadConfigModule();
    expect(getConfigPath()).toBe(base);
  });

  it("resolves the shipped default relative to the package when the env is unset", async () => {
    const { getConfigPath } = await loadConfigModule();
    expect(getConfigPath()).toBe(join(REPO_ROOT, "config.json"));
  });

  it("prefers an existing sibling layer over the user config directory", async () => {
    const base = join(dir, "config.json");
    const sibling = join(dir, "config.local.json");
    writeFileSync(base, "{}");
    writeFileSync(sibling, "{}");
    process.env["INFOBROKER_CONFIG"] = base;
    process.env["XDG_CONFIG_HOME"] = join(dir, "xdg");
    const { getUserConfigPath } = await loadConfigModule();
    expect(getUserConfigPath()).toBe(sibling);
  });

  it("falls back to the user config directory when no sibling layer exists", async () => {
    const base = join(dir, "config.json");
    writeFileSync(base, "{}");
    process.env["INFOBROKER_CONFIG"] = base;
    process.env["XDG_CONFIG_HOME"] = join(dir, "xdg");
    const { getUserConfigPath } = await loadConfigModule();
    expect(getUserConfigPath()).toBe(join(dir, "xdg", "infobroker", "config.local.json"));
  });

  it("lets INFOBROKER_CONFIG_LOCAL override both sibling and user config dir", async () => {
    const base = join(dir, "config.json");
    const explicit = join(dir, "explicit.local.json");
    writeFileSync(base, "{}");
    writeFileSync(join(dir, "config.local.json"), "{}");
    writeFileSync(explicit, "{}");
    process.env["INFOBROKER_CONFIG"] = base;
    process.env["INFOBROKER_CONFIG_LOCAL"] = explicit;
    process.env["XDG_CONFIG_HOME"] = join(dir, "xdg");
    const { getUserConfigPath } = await loadConfigModule();
    expect(getUserConfigPath()).toBe(explicit);
  });

  it("creates no user directory while resolving paths", async () => {
    const base = join(dir, "config.json");
    writeFileSync(base, "{}");
    process.env["INFOBROKER_CONFIG"] = base;
    process.env["XDG_CONFIG_HOME"] = join(dir, "xdg");
    const { getUserConfigPath } = await loadConfigModule();
    getUserConfigPath();
    expect(existsSync(join(dir, "xdg"))).toBe(false);
  });
});
