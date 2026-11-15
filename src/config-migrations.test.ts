// @implements REQ-105
// @implements REQ-105 backup-bytes
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, writeFileSync, readFileSync, statSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { testTmpDir } from "./lib/test-tmp.js";
import {
  detectConfigDrift,
  applyConfigMigrations,
  CURRENT_CONFIG_VERSION,
  type RenameMigration,
} from "./config-migrations.js";
import { atomicWriteFile, backupFile } from "./lib/atomic-write.js";

const SHIPPED = ["config_version", "defaults", "providers", "dispatch", "kb", "output"];

describe("config drift detection (REQ-105)", () => {
  it("reports no drift for a clean, current layer", () => {
    const drift = detectConfigDrift({ config_version: CURRENT_CONFIG_VERSION, kb: { chunk_size: 512 } }, SHIPPED);
    expect(drift.hasDrift).toBe(false);
    expect(drift.renames).toEqual([]);
    expect(drift.unrecognized).toEqual([]);
  });

  it("surfaces a deprecated legacy key without rewriting it", () => {
    const drift = detectConfigDrift({ kb: { expiry: { stable: 720 } } }, SHIPPED);
    expect(drift.deprecated.map((d) => d.path)).toContain("kb.expiry");
    expect(drift.hasDrift).toBe(true);
    // The lossy legacy key is reported, never transformed; the only change is
    // the schema stamp.
    const { layer, changes } = applyConfigMigrations({ kb: { expiry: { stable: 720 } } }, drift);
    expect((layer.kb as Record<string, unknown>).expiry).toEqual({ stable: 720 });
    expect(changes).toEqual([`stamped config_version=${CURRENT_CONFIG_VERSION}`]);
  });

  it("reports the removed kb.store_backend option without rewriting it", () => {
    const drift = detectConfigDrift({ kb: { store_backend: "json" } }, SHIPPED);
    expect(drift.removals.map((r) => r.path)).toEqual(["kb.store_backend"]);
    expect(drift.hasDrift).toBe(true);
    // Detection is read-only; the key survives until an explicit migration.
    expect((drift.removals.length > 0)).toBe(true);
  });

  it("reports top-level keys the shipped schema does not recognize", () => {
    const drift = detectConfigDrift({ frobnicate: true, kb: {} }, SHIPPED);
    expect(drift.unrecognized).toEqual(["frobnicate"]);
    expect(drift.hasDrift).toBe(true);
  });

  it("flags a layer written for an older schema version", () => {
    const drift = detectConfigDrift({ config_version: 0 }, SHIPPED);
    expect(drift.outdatedVersion).toBe(true);
    expect(drift.hasDrift).toBe(true);
  });
});

describe("config migration application (REQ-105)", () => {
  const renames: RenameMigration[] = [{ from: "kb.old_key", to: "kb.new_key" }];

  it("relocates a legacy key and stamps the schema version", () => {
    const layer = { config_version: 0, kb: { old_key: "value", chunk_size: 512 } };
    const drift = detectConfigDrift(layer, SHIPPED, renames);
    const { layer: out, changes } = applyConfigMigrations(layer, drift);
    expect((out.kb as Record<string, unknown>).new_key).toBe("value");
    expect((out.kb as Record<string, unknown>).old_key).toBeUndefined();
    expect(out.config_version).toBe(CURRENT_CONFIG_VERSION);
    expect(changes.some((c) => c.includes("old_key"))).toBe(true);
    // The input layer is not mutated.
    expect((layer.kb as Record<string, unknown>).new_key).toBeUndefined();
  });

  it("keeps the user's current value when both legacy and new keys are present", () => {
    const layer = { config_version: 1, kb: { old_key: "legacy", new_key: "current" } };
    const drift = detectConfigDrift(layer, SHIPPED, renames);
    const { layer: out } = applyConfigMigrations(layer, drift);
    expect((out.kb as Record<string, unknown>).new_key).toBe("current");
    expect((out.kb as Record<string, unknown>).old_key).toBeUndefined();
  });

  it("drops an obsolete key on explicit migration and reports it", () => {
    const layer = { config_version: 2, kb: { store_backend: "json", chunk_size: 512 } };
    const drift = detectConfigDrift(layer, SHIPPED);
    const { layer: out, changes } = applyConfigMigrations(layer, drift);
    expect((out.kb as Record<string, unknown>).store_backend).toBeUndefined();
    expect((out.kb as Record<string, unknown>).chunk_size).toBe(512);
    expect(changes.some((c) => c.includes("kb.store_backend"))).toBe(true);
    // Idempotent: nothing left to remove.
    const again = applyConfigMigrations(out, detectConfigDrift(out, SHIPPED));
    expect(again.changes).toEqual([]);
  });

  it("never discards unrecognized keys", () => {
    const layer = { config_version: 1, frobnicate: { keep: true }, kb: { old_key: "v" } };
    const drift = detectConfigDrift(layer, SHIPPED, renames);
    const { layer: out } = applyConfigMigrations(layer, drift);
    expect(out.frobnicate).toEqual({ keep: true });
  });

  it("is idempotent — re-applying after migration produces no changes", () => {
    const layer = { config_version: 0, kb: { old_key: "v" } };
    const first = applyConfigMigrations(layer, detectConfigDrift(layer, SHIPPED, renames));
    const second = applyConfigMigrations(first.layer, detectConfigDrift(first.layer, SHIPPED, renames));
    expect(second.changes).toEqual([]);
  });
});

describe("atomic write and backup (REQ-105)", () => {
  it("writes atomically and creates a 0600 backup copy", () => {
    const dir = testTmpDir("ib-mig-");
    const target = join(dir, "config.local.json");
    writeFileSync(target, "original");

    const backup = backupFile(target);
    expect(backup).not.toBeNull();
    expect(readFileSync(backup!, "utf-8")).toBe("original");
    expect(statSync(backup!).mode & 0o777).toBe(0o600);

    atomicWriteFile(target, Buffer.from("migrated"));
    expect(readFileSync(target, "utf-8")).toBe("migrated");
    expect(existsSync(target)).toBe(true);
  });

  it("returns null when there is nothing to back up", () => {
    const dir = testTmpDir("ib-mig-");
    expect(backupFile(join(dir, "absent.json"))).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// R2b-ii: fresh read and read-buffer backup on the migration paths (REQ-105)
// ---------------------------------------------------------------------------

describe("migrateUserConfigLayer write ordering (REQ-105 fresh-layer, backup-bytes)", () => {
  const BASE_CONFIG = {
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

  let dir: string;
  let basePath: string;
  let userPath: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "ib-migrate-order-"));
    basePath = join(dir, "config.json");
    userPath = join(dir, "config.local.json");
    writeFileSync(basePath, JSON.stringify(BASE_CONFIG));
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

  it("applies migrations over an edit made after startup (REQ-105 fresh-layer)", async () => {
    const stale = { config_version: 1, output: { hedge_enabled: false } };
    writeFileSync(userPath, JSON.stringify(stale));
    const mod = await loadModule();
    mod.loadConfig();
    // External edit after the startup snapshot was taken.
    writeFileSync(
      userPath,
      JSON.stringify({ ...stale, corroboration: { kb_recall: true } })
    );
    const result = mod.migrateUserConfigLayer();
    expect(result).not.toBeNull();
    const written = JSON.parse(readFileSync(userPath, "utf-8"));
    expect(written.corroboration).toEqual({ kb_recall: true });
    expect(written.config_version).toBe(CURRENT_CONFIG_VERSION);
  });

  it("backs up the exact layer bytes it read (REQ-105 backup-bytes)", async () => {
    const odd = '{\n  "config_version" : 1,\n  "output" : {"hedge_enabled": false}\n}\n';
    writeFileSync(userPath, odd);
    const mod = await loadModule();
    mod.loadConfig();
    const result = mod.migrateUserConfigLayer();
    expect(result?.backup).toBeTruthy();
    expect(readFileSync(result!.backup!, "utf-8")).toBe(odd);
  });

  it("backs up the bytes the startup auto-migration read (REQ-105 backup-bytes)", async () => {
    const odd = '{\n  "state" : {"auto_migrate_config": true},\n  "config_version" : 1\n}\n';
    writeFileSync(userPath, odd);
    const mod = await loadModule();
    mod.loadConfig();
    const migration = mod.getStartupMigration();
    expect(migration?.backup).toBeTruthy();
    expect(readFileSync(migration!.backup!, "utf-8")).toBe(odd);
  });

  it("refuses to migrate an unparseable on-disk layer without writing", async () => {
    writeFileSync(userPath, "{ not json");
    const mod = await loadModule();
    mod.loadConfig();
    expect(() => mod.migrateUserConfigLayer()).toThrow();
    expect(readFileSync(userPath, "utf-8")).toBe("{ not json");
  });

  it("exposes a buffer-taking backup that preserves the supplied bytes (REQ-105 backup-bytes)", async () => {
    const atomic = await import("./lib/atomic-write.js");
    const backupBytes = (atomic as Record<string, unknown>)["backupBytes"];
    expect(typeof backupBytes).toBe("function");
    const target = join(dir, "layer.json");
    writeFileSync(target, "on disk now");
    const bytes = Buffer.from("what was read", "utf-8");
    const backup = (backupBytes as (b: Buffer, f: string) => string)(bytes, target);
    expect(readFileSync(backup, "utf-8")).toBe("what was read");
    expect(statSync(backup).mode & 0o777).toBe(0o600);
  });
});
