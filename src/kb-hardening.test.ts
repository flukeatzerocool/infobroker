// @implements REQ-060c REQ-066 REQ-100 REQ-067
import { describe, it, expect, afterAll } from "vitest";
import { mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initKb, kbIngest, chunkText } from "./kb.js";
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

describe("Chunking terminates and preserves content (REQ-067)", () => {
  const text = "a".repeat(600) + ". " + "b".repeat(600) + ". " + "c".repeat(600);

  it("advances instead of looping when chunk_overlap exceeds the split distance", () => {
    const dir = join(base, "chunk-overlap-store");
    initKb(makeConfig(dir, { chunk_size: 1000, chunk_overlap: 900 }));
    const chunks = chunkText(text, "t");
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.length).toBeLessThan(text.length);
    expect(chunks.every((c) => c.length > 0)).toBe(true);
  });

  it("caps the effective overlap so invalid configs cannot emit one-char chunks", () => {
    const dir = join(base, "chunk-overlap-cap-store");
    initKb(makeConfig(dir, { chunk_size: 1000, chunk_overlap: 900 }));
    expect(chunkText(text, "t").length).toBeLessThan(50);
  });

  it("preserves content when chunk_size is not finite", () => {
    const dir = join(base, "chunk-nan-size-store");
    initKb(makeConfig(dir, { chunk_size: NaN }));
    const chunks = chunkText("alpha beta gamma", "t");
    expect(chunks.length).toBe(1);
    expect(chunks[0]).toContain("alpha beta gamma");
  });

  it("does not propagate a non-finite overlap", () => {
    const dir = join(base, "chunk-nan-overlap-store");
    initKb(makeConfig(dir, { chunk_size: 10, chunk_overlap: NaN }));
    const chunks = chunkText("a".repeat(45), "t");
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.length).toBeLessThan(45);
  });
});
