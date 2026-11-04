// @implements REQ-082 REQ-103
import { describe, it, expect, afterAll } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { initKb, kbIngest, kbStats, flushKbWrites } from "./kb.js";
import type { KbConfig } from "./types.js";

const base = mkdtempSync(join(tmpdir(), "infobroker-kb-model-"));

function makeConfig(storagePath: string, model: string): KbConfig {
  return {
    storage_path: storagePath,
    embedding_model: model,
    chunk_size: 512,
    chunk_overlap: 64,
    auto_index: false,
    default_collection: "default",
    max_results: 50,
    maintenance_interval_minutes: 0,
    kb_first_relevance_threshold: 0.3,
    kb_first_confidence_threshold: 0.5,
    freshness: {
      tiers: { stable: { decay_hours: 720, expiry_hours: 0 } },
      auto_classify: false,
      default_tier: "stable",
    },
  };
}

function storedDims(storagePath: string): number[] {
  const db = new DatabaseSync(join(storagePath, "vector-store.sqlite"), { readOnly: true });
  try {
    const dims: number[] = [];
    for (const row of db.prepare("SELECT payload FROM chunks").iterate() as Iterable<{ payload: Uint8Array }>) {
      const chunk = JSON.parse(Buffer.from(row.payload).toString("utf-8")) as { embedding: number[] };
      dims.push(chunk.embedding.length);
    }
    return dims;
  } finally {
    db.close();
  }
}

function seed(storagePath: string, model: string): void {
  initKb(makeConfig(storagePath, model));
  for (let i = 0; i < 10; i++) {
    kbIngest(
      `document ${i} about automobiles engines transmissions maintenance and repair procedures`,
      `doc ${i}`,
      `https://example.com/${i}`,
      "test"
    );
  }
  flushKbWrites();
}

afterAll(() => {
  rmSync(base, { recursive: true, force: true });
});

describe("Embedding-model reconciliation (REQ-082, REQ-103)", () => {
  it("re-embeds an lsa store when the configured model changes to signed-hash", () => {
    const dir = join(base, "lsa-to-hash");
    seed(dir, "lsa");
    expect(new Set(storedDims(dir))).toEqual(new Set([9]));

    initKb(makeConfig(dir, "signed-hash-tfidf"));

    expect(new Set(storedDims(dir))).toEqual(new Set([4096]));
    expect(kbStats().model_name).toBe("signed-hash-tfidf");
    expect(kbStats().events.some((event) => event.includes("Embedding model reconciled"))).toBe(true);
  });

  it("re-fits a signed-hash store when the configured model changes to lsa", () => {
    const dir = join(base, "hash-to-lsa");
    seed(dir, "signed-hash-tfidf");
    expect(new Set(storedDims(dir))).toEqual(new Set([4096]));

    initKb(makeConfig(dir, "lsa"));

    const dims = new Set(storedDims(dir));
    expect(dims.size).toBe(1);
    expect(dims.has(4096)).toBe(false);
    expect(kbStats().model_name).toBe("lsa");
    expect(kbStats().events.some((event) => event.includes("Embedding model reconciled"))).toBe(true);
  });

  it("re-embeds a legacy store with no recorded model and a stale vector width", () => {
    const dir = join(base, "legacy-store");
    seed(dir, "signed-hash-tfidf");

    const db = new DatabaseSync(join(dir, "vector-store.sqlite"));
    try {
      const rows = db.prepare("SELECT id, payload FROM chunks").all() as Array<{ id: string; payload: Uint8Array }>;
      const update = db.prepare("UPDATE chunks SET payload = ? WHERE id = ?");
      for (const row of rows) {
        const chunk = JSON.parse(Buffer.from(row.payload).toString("utf-8")) as { embedding: number[] };
        chunk.embedding = new Array(4000).fill(0.1);
        update.run(Buffer.from(JSON.stringify(chunk), "utf-8"), row.id);
      }
      db.prepare("DELETE FROM meta WHERE key = 'model'").run();
    } finally {
      db.close();
    }

    initKb(makeConfig(dir, "signed-hash-tfidf"));

    expect(new Set(storedDims(dir))).toEqual(new Set([4096]));
    expect(kbStats().events.some((event) => event.includes("Embedding model reconciled"))).toBe(true);
  });
});
