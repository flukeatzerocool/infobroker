// @implements REQ-105
import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync, readFileSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
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
    const dir = mkdtempSync(join(tmpdir(), "ib-mig-"));
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
    const dir = mkdtempSync(join(tmpdir(), "ib-mig-"));
    expect(backupFile(join(dir, "absent.json"))).toBeNull();
  });
});
