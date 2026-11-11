// @implements REQ-040
// @implements REQ-040 fresh-layer
// @implements REQ-040 backup-bytes
// @implements REQ-040 patch-null-removal
// The reload_config configuration patch: deep-merge into the user layer,
// reject unknown keys, validate before writing, back up, and leave the
// previous state intact on failure.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, writeFileSync, rmSync, readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { Config } from "./types.js";

const BASE: Config = {
  config_version: 1,
  providers: {
    duckduckgo: {
      tier: "builtin",
      capabilities: ["web_search"],
      rate_limit: { per_second: 0.33 },
      enabled: true,
      priority: 10,
    },
  },
  dispatch: { general_web: ["duckduckgo"] },
  corroboration: {
    max_iterations: 5,
    max_http_calls: 30,
    confidence_threshold: 0.8,
    first_pass_max_results: 10,
    first_pass_max_providers: 5,
    similarity_threshold: 0.3,
  },
  output: { max_chars: 50000, latency_window_size: 100, fallback_depth: 3, max_redirect_hops: 5 },
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

  it("rejects a malformed provider auth field before writing", async () => {
    writeFileSync(
      basePath,
      JSON.stringify({
        ...BASE,
        providers: {
          ...BASE.providers,
          exa: {
            tier: "keyed_http",
            capabilities: ["web_search"],
            rate_limit: {},
            enabled: true,
            priority: 5,
            auth_env: "INFOBROKER_EXA_API_KEY",
          },
        },
      })
    );
    const mod = await loadModule();
    mod.loadConfig();
    expect(() => mod.patchUserConfigLayer({ providers: { exa: { auth_env: 42 } } })).toThrow(
      /Provider "exa": auth_env must be a non-empty string/
    );
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

// ---------------------------------------------------------------------------
// R2b-ii: fresh read, read-buffer backup, and null-removal (REQ-040)
// ---------------------------------------------------------------------------

const GENERIC_PROVIDER = {
  tier: "generic_http",
  capabilities: ["web_search"],
  enabled: true,
  priority: 20,
  endpoint: "https://api.example.com/search",
  query_param: "q",
  rate_limit: {},
};

function writeBaseWith(basePath: string, extra: Record<string, unknown>): void {
  writeFileSync(
    basePath,
    JSON.stringify({
      ...BASE,
      providers: { ...BASE.providers, ...extra },
    })
  );
}

describe("patchUserConfigLayer write ordering (REQ-040 fresh-layer, backup-bytes)", () => {
  let dir: string;
  let basePath: string;
  let userPath: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "ib-patch-order-"));
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

  it("merges over an edit made to the layer after startup (REQ-040 fresh-layer)", async () => {
    writeFileSync(userPath, JSON.stringify({ output: { hedge_enabled: false } }));
    const mod = await loadModule();
    mod.loadConfig();
    // External edit made after the startup snapshot was taken.
    writeFileSync(
      userPath,
      JSON.stringify({ output: { hedge_enabled: false }, corroboration: { kb_recall: true } })
    );
    mod.patchUserConfigLayer({ output: { hedge_max_delay_ms: 500 } });
    const written = JSON.parse(readFileSync(userPath, "utf-8"));
    expect(written.corroboration).toEqual({ kb_recall: true });
    expect(written.output).toEqual({ hedge_enabled: false, hedge_max_delay_ms: 500 });
  });

  it("backs up the exact layer bytes it read (REQ-040 backup-bytes)", async () => {
    const odd = '{\n    "output" : {"hedge_enabled": false}\n}\n';
    writeFileSync(userPath, odd);
    const mod = await loadModule();
    mod.loadConfig();
    const result = mod.patchUserConfigLayer({ output: { hedge_max_delay_ms: 500 } });
    expect(result.backup).toBeTruthy();
    expect(readFileSync(result.backup!, "utf-8")).toBe(odd);
  });

  it("refuses to patch an unparseable on-disk layer without writing", async () => {
    writeFileSync(userPath, "{ not json");
    const mod = await loadModule();
    mod.loadConfig();
    expect(() => mod.patchUserConfigLayer({ output: { hedge_enabled: true } })).toThrow();
    expect(readFileSync(userPath, "utf-8")).toBe("{ not json");
    expect(readdirSync(dir).some((f: string) => f.startsWith("config.local.json.bak-"))).toBe(false);
  });
});

describe("patchUserConfigLayer null removal (REQ-040 patch-null-removal)", () => {
  let dir: string;
  let basePath: string;
  let userPath: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "ib-patch-null-"));
    basePath = join(dir, "config.json");
    userPath = join(dir, "config.local.json");
    writeBaseWith(basePath, { my_search: GENERIC_PROVIDER });
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

  it("removes a declared auth_env from a user-layer provider", async () => {
    writeFileSync(
      userPath,
      JSON.stringify({ providers: { my_search: { auth_env: "INFOBROKER_MY_SEARCH_API_KEY" } } })
    );
    const mod = await loadModule();
    mod.loadConfig();
    const result = mod.patchUserConfigLayer({ providers: { my_search: { auth_env: null } } });
    const written = JSON.parse(readFileSync(userPath, "utf-8"));
    expect(written.providers.my_search).toEqual({});
    expect(mod.reloadConfig().providers.my_search?.auth_env).toBeUndefined();
    expect(result.changed).toEqual(["providers"]);
  });

  it("removes a declared url_env from a user-layer provider", async () => {
    writeFileSync(userPath, JSON.stringify({ providers: { my_search: { url_env: "MY_SEARCH_URL" } } }));
    const mod = await loadModule();
    mod.loadConfig();
    mod.patchUserConfigLayer({ providers: { my_search: { url_env: null } } });
    const written = JSON.parse(readFileSync(userPath, "utf-8"));
    expect(written.providers.my_search).toEqual({});
    expect(mod.reloadConfig().providers.my_search?.url_env).toBeUndefined();
  });

  it("removes a declared auth_optional from a user-layer provider", async () => {
    writeFileSync(userPath, JSON.stringify({ providers: { my_search: { auth_optional: true } } }));
    const mod = await loadModule();
    mod.loadConfig();
    mod.patchUserConfigLayer({ providers: { my_search: { auth_optional: null } } });
    const written = JSON.parse(readFileSync(userPath, "utf-8"));
    expect(written.providers.my_search).toEqual({});
    expect(mod.reloadConfig().providers.my_search?.auth_optional).toBeUndefined();
  });

  it("restores the shipped declaration when a shipped field is removed", async () => {
    writeBaseWith(basePath, {
      exa: {
        tier: "keyed_http",
        capabilities: ["web_search"],
        enabled: false,
        priority: 5,
        rate_limit: {},
        auth_env: "INFOBROKER_EXA_API_KEY",
      },
    });
    writeFileSync(userPath, JSON.stringify({ providers: { exa: { auth_env: "MY_EXA_KEY" } } }));
    const mod = await loadModule();
    mod.loadConfig();
    mod.patchUserConfigLayer({ providers: { exa: { auth_env: null } } });
    const written = JSON.parse(readFileSync(userPath, "utf-8"));
    expect(written.providers.exa.auth_env).toBeUndefined();
    expect(mod.reloadConfig().providers.exa?.auth_env).toBe("INFOBROKER_EXA_API_KEY");
  });

  it("treats a null on an absent key as a no-op", async () => {
    const mod = await loadModule();
    mod.loadConfig();
    const result = mod.patchUserConfigLayer({ providers: { my_search: { auth_optional: null } } });
    const written = JSON.parse(readFileSync(userPath, "utf-8"));
    expect(written).toEqual({});
    expect(result.changed).toEqual(["providers"]);
    expect(mod.reloadConfig().providers.my_search?.auth_optional).toBeUndefined();
  });

  it("still rejects a merged configuration that a removal makes invalid", async () => {
    // my_search exists only in the user layer, so removing its tier leaves it
    // without the required field.
    writeFileSync(basePath, JSON.stringify(BASE));
    writeFileSync(
      userPath,
      JSON.stringify({
        providers: {
          my_search: {
            ...GENERIC_PROVIDER,
            auth_header: "X-API-Key",
          },
        },
      })
    );
    const mod = await loadModule();
    mod.loadConfig();
    const before = readFileSync(userPath, "utf-8");
    expect(() => mod.patchUserConfigLayer({ providers: { my_search: { tier: null } } })).toThrow(
      /Config validation failed/
    );
    expect(readFileSync(userPath, "utf-8")).toBe(before);
  });
});
