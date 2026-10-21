// @implements REQ-108 REQ-060a REQ-060b REQ-060c REQ-060d REQ-060e REQ-060f REQ-072 REQ-087
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  initKb,
  kbIngest,
  kbSearch,
  kbStats,
  kbList,
  kbGet,
  kbDelete,
  flushKbWrites,
} from "./kb.js";
import type { KbConfig } from "./types.js";
import { isKbArchiveArtifact, isKbStoreArtifact } from "./kb-store.js";

const dir = mkdtempSync(join(tmpdir(), "infobroker-kb-sqlite-"));

const cfg: KbConfig = {
  storage_path: dir,
  store_backend: "sqlite",
  embedding_model: "signed-hash-tfidf",
  chunk_size: 512,
  chunk_overlap: 64,
  auto_index: false,
  default_collection: "default",
  max_results: 50,
  maintenance_interval_minutes: 0,
  kb_first_relevance_threshold: 0.3,
  kb_first_confidence_threshold: 0.5,
  freshness: {
    tiers: {
      ephemeral: { decay_hours: 24, expiry_hours: 168 },
      recent: { decay_hours: 168, expiry_hours: 720 },
      stable: { decay_hours: 720, expiry_hours: 0 },
      evergreen: { decay_hours: 0, expiry_hours: 0 },
    },
    auto_classify: false,
    default_tier: "stable",
  },
};

beforeAll(() => initKb(cfg));

afterAll(() => {
  flushKbWrites();
  rmSync(dir, { recursive: true, force: true });
});

describe("KB artifact predicates (REQ-108)", () => {
  it("separates archives from live stores", () => {
    expect(isKbArchiveArtifact("vector-store.json.migrated-123")).toBe(true);
    expect(isKbArchiveArtifact("vector-store.corrupt-123.json")).toBe(true);
    expect(isKbArchiveArtifact("vector-store.pre-rollback-123.sqlite")).toBe(true);
    expect(isKbArchiveArtifact("vector-store.sqlite")).toBe(false);
    expect(isKbStoreArtifact("vector-store.sqlite")).toBe(true);
    expect(isKbStoreArtifact("vector-store.sqlite-wal")).toBe(true);
    expect(isKbStoreArtifact("vector-store.json")).toBe(true);
    expect(isKbStoreArtifact("unrelated.txt")).toBe(false);
  });
});

describe("SQLite knowledge base (REQ-108)", () => {
  it("ingests and retrieves chunks from the database", () => {
    kbIngest(
      "quantum computing error correction is a rapidly advancing field",
      "quantum",
      "https://example.com/quantum",
      "test"
    );
    expect(kbSearch("quantum error correction", 5)[0]?.source_url).toBe(
      "https://example.com/quantum"
    );
    expect(existsSync(join(dir, "vector-store.sqlite"))).toBe(true);
  });

  it("reports stats, list, and get from streamed rows", () => {
    kbIngest(
      "the history of ancient pottery in mesopotamia is long and varied",
      "pottery",
      "https://example.com/pottery",
      "test"
    );
    const stats = kbStats();
    expect(stats.chunk_count).toBeGreaterThanOrEqual(2);
    expect(stats.storage_size_bytes).toBeGreaterThan(0);
    const list = kbList();
    expect(list.map((e) => e.source_url)).toContain("https://example.com/pottery");
    expect(kbGet("https://example.com/pottery")?.title).toBe("pottery");
  });

  it("replaces a source without increasing the chunk count", () => {
    const before = kbStats().chunk_count;
    kbIngest("updated pottery text", "pottery", "https://example.com/pottery", "test");
    expect(kbStats().chunk_count).toBe(before);
    expect(kbGet("https://example.com/pottery")?.text).toContain("updated pottery");
  });

  it("deletes by source and persists across re-init", () => {
    expect(kbDelete(undefined, "https://example.com/pottery")).toBeGreaterThan(0);
    initKb(cfg);
    expect(kbGet("https://example.com/pottery")).toBeNull();
    expect(kbSearch("quantum error correction", 5).length).toBeGreaterThan(0);
  });
});
