// @implements REQ-060c REQ-066 REQ-100
import { describe, it, expect, afterAll } from "vitest";
import { mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initKb, kbIngest } from "./kb.js";
import type { KbConfig } from "./types.js";

const base = mkdtempSync(join(tmpdir(), "infobroker-kb-hardening-"));

function makeConfig(storagePath: string, overrides: Partial<KbConfig> = {}): KbConfig {
  return {
    storage_path: storagePath,
    embedding_model: "signed-hash-tfidf",
    chunk_size: 512,
    chunk_overlap: 64,
    auto_index: false,
    default_collection: "default",
    max_results: 50,
    maintenance_interval_minutes: 60,
    kb_first_relevance_threshold: 0.3,
    kb_first_confidence_threshold: 0.5,
    freshness: {
      tiers: { stable: { decay_hours: 720, expiry_hours: 0 } },
      auto_classify: false,
      default_tier: "stable",
    },
    ...overrides,
  };
}

afterAll(() => {
  rmSync(base, { recursive: true, force: true });
});

describe("KB store permissions (REQ-100)", () => {
  it("creates the storage directory owner-only (0700)", () => {
    const dir = join(base, "perm-store");
    initKb(makeConfig(dir));
    const mode = statSync(dir).mode & 0o777;
    expect(mode).toBe(0o700);
  });
});

describe("KB maintenance interval (REQ-066)", () => {
  it("accepts a zero interval (disabled) and still supports ingest", () => {
    const dir = join(base, "no-maint-store");
    initKb(makeConfig(dir, { maintenance_interval_minutes: 0 }));
    const count = kbIngest("maintenance disabled still indexes content", "t", "https://example.com/m", "test");
    expect(count).toBeGreaterThan(0);
  });
});
