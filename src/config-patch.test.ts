// @implements REQ-040
// The reload_config configuration patch: deep-merge into the user layer,
// reject unknown keys, validate before writing, back up, and leave the
// previous state intact on failure.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, writeFileSync, rmSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const BASE = {
  config_version: 1,
  providers: {
    duckduckgo: { tier: "builtin", capabilities: ["web_search"], enabled: true, priority: 10 },
  },
  dispatch: { general_web: ["duckduckgo"] },
  output: { fallback_depth: 3, max_redirect_hops: 5 },
};

describe("patchUserConfigLayer (REQ-040)", () => {
  let dir: string;
  let basePath: string;
  let userPath: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "ib-patch-"));
    basePath = join(dir, "config.json");
    userPath = join(dir, "config.local.json");
    writeFileSync(basePath, JSON.stringify(BASE));
    process.env["INFOBROKER_CONFIG"] = basePath;
    process.env["INFOBROKER_CONFIG_LOCAL"] = userPath;
  });

  afterEach(() => {
    delete process.env["INFOBROKER_CONFIG"];
    delete process.env["INFOBROKER_CONFIG_LOCAL"];
    rmSync(dir, { recursive: true, force: true });
  });

  async function loadModule() {
    vi.resetModules();
    return await import("./config.js");
  }

  it("writes a patch into a new user layer with no backup when none exists", async () => {
    const mod = await loadModule();
    mod.loadConfig();
    const result = mod.patchUserConfigLayer({ output: { hedge_enabled: true } });
    expect(result.changed).toEqual(["output"]);
    expect(result.backup).toBeNull();
    expect(JSON.parse(readFileSync(userPath, "utf-8"))).toEqual({ output: { hedge_enabled: true } });
    expect(mod.reloadConfig().output.hedge_enabled).toBe(true);
  });

  it("deep-merges over an existing layer and preserves unrelated keys", async () => {
    writeFileSync(userPath, JSON.stringify({ output: { hedge_enabled: false }, corroboration: { kb_recall: true } }));
    const mod = await loadModule();
    mod.loadConfig();
    mod.patchUserConfigLayer({ output: { hedge_max_delay_ms: 500 } });
    const written = JSON.parse(readFileSync(userPath, "utf-8"));
    expect(written.output).toEqual({ hedge_enabled: false, hedge_max_delay_ms: 500 });
    expect(written.corroboration).toEqual({ kb_recall: true });
  });

  it("rejects an unknown top-level key without writing", async () => {
    const mod = await loadModule();
    mod.loadConfig();
    expect(() => mod.patchUserConfigLayer({ bogus: 1 })).toThrow(/Unknown configuration key/);
    expect(existsSync(userPath)).toBe(false);
  });

  it("validates the merged configuration before writing", async () => {
    const mod = await loadModule();
    mod.loadConfig();
    expect(() => mod.patchUserConfigLayer({ output: { fallback_depth: 0 } })).toThrow(/Config validation failed/);
    expect(existsSync(userPath)).toBe(false);
  });

  it("backs up the previous layer when one exists", async () => {
    writeFileSync(userPath, JSON.stringify({ output: { hedge_enabled: false } }));
    const mod = await loadModule();
    mod.loadConfig();
    const result = mod.patchUserConfigLayer({ output: { hedge_enabled: true } });
    expect(result.backup).toBeTruthy();
    expect(existsSync(result.backup!)).toBe(true);
    expect(JSON.parse(readFileSync(result.backup!, "utf-8"))).toEqual({ output: { hedge_enabled: false } });
  });
});
