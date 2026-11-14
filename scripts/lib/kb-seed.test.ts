// scripts/lib/kb-seed.test.ts — unit test for the benchmark seed selector.
// The regression this pins: a sealed `.enc` migration artifact sorts newer than
// the plaintext archive and would otherwise be chosen as a corpus seed.
import { describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isLegacySeedName, selectLegacySeed } from "./kb-seed.js";

describe("benchmark legacy seed selection (REQ-108)", () => {
  it("never selects a sealed artifact even when it sorts newer", () => {
    const dir = mkdtempSync(join(tmpdir(), "infobroker-kb-seed-"));
    try {
      writeFileSync(join(dir, "vector-store.json.migrated-100"), "{\"chunks\":[]}");
      writeFileSync(join(dir, "vector-store.json.migrated-200.enc"), "ciphertext");
      expect(selectLegacySeed(dir)).toBe(join(dir, "vector-store.json.migrated-100"));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("prefers the live legacy store when it exists", () => {
    const dir = mkdtempSync(join(tmpdir(), "infobroker-kb-seed-live-"));
    try {
      writeFileSync(join(dir, "vector-store.json"), "{\"chunks\":[]}");
      writeFileSync(join(dir, "vector-store.json.migrated-100"), "{\"chunks\":[]}");
      expect(selectLegacySeed(dir)).toBe(join(dir, "vector-store.json"));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("returns null when only sealed artifacts are present", () => {
    const dir = mkdtempSync(join(tmpdir(), "infobroker-kb-seed-sealed-"));
    try {
      writeFileSync(join(dir, "vector-store.json.migrated-200.enc"), "ciphertext");
      expect(selectLegacySeed(dir)).toBeNull();
      expect(isLegacySeedName("vector-store.json.migrated-200.enc")).toBe(false);
      expect(isLegacySeedName("vector-store.json.migrated-200")).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
