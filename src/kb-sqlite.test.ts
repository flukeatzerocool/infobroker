// @implements REQ-108 REQ-060a REQ-060b REQ-060c REQ-060d REQ-060e REQ-060f REQ-072 REQ-087 REQ-086
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync, existsSync, writeFileSync, readdirSync, readFileSync, openSync, readSync, closeSync } from "node:fs";
import { createHash, randomBytes } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { testTmpDir } from "./lib/test-tmp.js";
import { DatabaseSync } from "node:sqlite";
import { KbStoreFormatError, SQLITE_FORMAT_VERSION, SqliteStore, probeStoreFile } from "./kb-sqlite.js";
import type { KbChunk } from "./types.js";
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

const dir = testTmpDir("kb-sqlite-");

const cfg: KbConfig = {
  storage_path: dir,
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

  it("keeps an encrypted corruption backup out of the plaintext-archive sweep", () => {
    // REQ-108 recovery names a possibly-ciphertext backup with the `.enc`
    // suffix; the plaintext sweep (REQ-084) must not reap it.
    expect(isKbArchiveArtifact("vector-store.corrupt-1234.sqlite")).toBe(true);
    expect(isKbArchiveArtifact("vector-store.corrupt-1234.sqlite-wal")).toBe(true);
    expect(isKbArchiveArtifact("vector-store.corrupt-1234.sqlite.enc")).toBe(false);
    expect(isKbArchiveArtifact("vector-store.corrupt-1234.sqlite.enc-wal")).toBe(false);
    // The timestamp is Date.now() digits so the plaintext form stays eligible.
    expect(/^vector-store\.corrupt-\d+\.sqlite$/.test(`vector-store.corrupt-${Date.now()}.sqlite`)).toBe(true);
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

  it("returns identical results once the lexical prefilter is built", () => {
    for (let i = 0; i < 40; i++) {
      kbIngest(
        `alpha beta gamma document ${i} with shared lexical terms`,
        `doc ${i}`,
        `https://example.com/prefilter-${i}`,
        "test"
      );
    }
    const first = kbSearch("alpha beta", 10);
    expect(first.length).toBeGreaterThan(0);
    const second = kbSearch("alpha beta", 10);
    const rank = (rows: typeof first) => rows.map((r) => ({ url: r.source_url, score: r.score, title: r.title }));
    expect(rank(second)).toEqual(rank(first));
  });

  it("deletes by source and persists across re-init", () => {
    expect(kbDelete(undefined, "https://example.com/pottery")).toBeGreaterThan(0);
    initKb(cfg);
    expect(kbGet("https://example.com/pottery")).toBeNull();
    expect(kbSearch("quantum error correction", 5).length).toBeGreaterThan(0);
  });
});

function fixtureChunk(id: string, text: string): KbChunk {
  return {
    id,
    text,
    embedding: [1, 0, 0],
    source_url: `https://example.com/${id}`,
    chunk_index: 0,
    title: id,
    provider: "test",
    collection: "default",
    source_type: "web_search",
    freshness_tier: "stable",
    ingested_at: Date.now(),
  };
}

describe("Encryption transition atomicity (REQ-086)", () => {
  it("aborts on an undecodable row and keeps the store unchanged", () => {
    const dir = mkdtempSync(join(tmpdir(), "infobroker-kb-reseal-"));
    try {
      const seedStore = new SqliteStore(dir);
      seedStore.init();
      seedStore.insertChunks([fixtureChunk("c1", "content that must survive")]);
      seedStore.close();

      const path = join(dir, "vector-store.sqlite");
      const db = new DatabaseSync(path);
      db.prepare("UPDATE chunks SET payload = ? WHERE id = 'c1'").run(Buffer.from("not a sealed row", "utf-8"));
      db.close();

      const key = { kind: "raw" as const, dek: randomBytes(32) };
      const opened = new SqliteStore(dir);
      opened.init();
      expect(() => opened.enableEncryption(key)).toThrow(/could not be decoded/);
      expect(opened.format()).toBe("plaintext");
      opened.close();

      const check = new DatabaseSync(path, { readOnly: true });
      try {
        const row = check.prepare("SELECT COUNT(*) AS n FROM chunks").get() as { n: number };
        expect(row.n).toBe(1);
        const marker = check.prepare("SELECT value FROM meta WHERE key = 'encryption'").get() as
          | { value: string }
          | undefined;
        expect(marker?.value ?? "0").toBe("0");
      } finally {
        check.close();
      }

      // The store still opens; no key state drifted.
      const reopened = new SqliteStore(dir);
      reopened.init();
      expect(reopened.format()).toBe("plaintext");
      reopened.close();
    } finally {
      rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  });
});

describe("Fitted-model statistics (REQ-072)", () => {
  it("does not drift when a source URL is replaced", () => {
    const dir = mkdtempSync(join(tmpdir(), "infobroker-kb-idf-"));
    try {
      initKb({ ...cfg, storage_path: dir });
      kbIngest("alpha uniquetermone content", "drift", "https://example.com/drift", "test");
      kbIngest("beta uniquetermtwo content", "drift", "https://example.com/drift", "test");
      flushKbWrites();

      const store = new SqliteStore(dir);
      store.init();
      const meta = store.meta();
      expect(meta.docCount).toBe(1);
      expect(meta.idf["alpha"]).toBeUndefined();
      expect(meta.idf["beta"]).toBe(1);
      store.close();
    } finally {
      initKb(cfg);
      rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  });
});

describe("encrypted archive cleanup (REQ-084, REQ-085)", () => {
  it("removes plaintext archives on encrypted open but spares a protected migration source", () => {
    const archiveDir = mkdtempSync(join(tmpdir(), "infobroker-kb-archive-"));
    try {
      const key = { kind: "raw" as const, dek: randomBytes(32) };
      const store = new SqliteStore(archiveDir);
      store.init();
      store.enableEncryption(key);
      store.close();

      writeFileSync(join(archiveDir, "vector-store.json.migrated-1"), "plaintext archive");
      const reopened = new SqliteStore(archiveDir, { secret: key });
      reopened.init();
      reopened.close();
      expect(existsSync(join(archiveDir, "vector-store.json.migrated-1"))).toBe(false);

      writeFileSync(join(archiveDir, "vector-store.json"), "migration source");
      writeFileSync(join(archiveDir, "vector-store.json.migrated-2"), "plaintext archive");
      const guarded = new SqliteStore(archiveDir, {
        secret: key,
        protectedLegacyPath: join(archiveDir, "vector-store.json"),
      });
      guarded.init();
      guarded.close();
      expect(existsSync(join(archiveDir, "vector-store.json"))).toBe(true);
      expect(existsSync(join(archiveDir, "vector-store.json.migrated-2"))).toBe(false);
    } finally {
      rmSync(archiveDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  });
});

describe("store format marker and classification (REQ-085, REQ-108)", () => {
  function snapshotStoreDir(dir: string): Record<string, string> {
    const out: Record<string, string> = {};
    for (const name of readdirSync(dir).filter((entry) => entry.startsWith("vector-store.sqlite")).sort()) {
      out[name] = createHash("sha256").update(readFileSync(join(dir, name))).digest("hex");
    }
    return out;
  }

  function readUserVersion(path: string): number {
    const header = Buffer.alloc(100);
    const fd = openSync(path, "r");
    try {
      readSync(fd, header, 0, 100, 0);
    } finally {
      closeSync(fd);
    }
    return header.readUInt32BE(60);
  }

  it("classifies a missing and a zero-byte file as new", () => {
    const dir = mkdtempSync(join(tmpdir(), "infobroker-kb-probe-new-"));
    try {
      expect(probeStoreFile(join(dir, "vector-store.sqlite")).state).toBe("new");
      writeFileSync(join(dir, "vector-store.sqlite"), "");
      expect(probeStoreFile(join(dir, "vector-store.sqlite")).state).toBe("new");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("writes the marker on creation and leaves a pre-marker store at zero", () => {
    const dir = mkdtempSync(join(tmpdir(), "infobroker-kb-marker-"));
    const path = join(dir, "vector-store.sqlite");
    try {
      const store = new SqliteStore(dir, { journalMode: "DELETE" });
      store.init();
      store.appendEvent("marked");
      store.close();
      expect(readUserVersion(path)).toBe(SQLITE_FORMAT_VERSION);

      const raw = new DatabaseSync(path);
      raw.exec("PRAGMA user_version = 0");
      raw.close();
      const reopened = new SqliteStore(dir, { journalMode: "DELETE" });
      reopened.init();
      expect(reopened.events()).toEqual(["marked"]);
      reopened.close();
      expect(readUserVersion(path)).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("refuses a newer store without touching the directory", () => {
    const dir = mkdtempSync(join(tmpdir(), "infobroker-kb-newer-"));
    const path = join(dir, "vector-store.sqlite");
    try {
      const store = new SqliteStore(dir, { journalMode: "DELETE" });
      store.init();
      store.close();
      const raw = new DatabaseSync(path);
      raw.exec(`PRAGMA user_version = ${SQLITE_FORMAT_VERSION + 1}`);
      raw.close();

      const before = snapshotStoreDir(dir);
      expect(() => new SqliteStore(dir).init()).toThrow(KbStoreFormatError);
      try {
        new SqliteStore(dir).init();
      } catch (e) {
        expect((e as KbStoreFormatError).code).toBe("kb_store_newer_format");
      }
      expect(snapshotStoreDir(dir)).toEqual(before);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("classifies a non-SQLite file as unrecognized and a truncated header as corrupt", () => {
    const dir = mkdtempSync(join(tmpdir(), "infobroker-kb-probe-bad-"));
    const path = join(dir, "vector-store.sqlite");
    try {
      writeFileSync(path, "this is not a sqlite database at all");
      expect(probeStoreFile(path).state).toBe("unrecognized");
      writeFileSync(path, Buffer.concat([Buffer.from("SQLite format 3\0", "binary"), Buffer.alloc(20)]));
      expect(probeStoreFile(path).state).toBe("corrupt");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("removes a sidecar its own read-only probe created when the store is locked", () => {
    const dir = mkdtempSync(join(tmpdir(), "infobroker-kb-probe-locked-"));
    const path = join(dir, "vector-store.sqlite");
    try {
      const store = new SqliteStore(dir, { journalMode: "WAL" });
      store.init();
      store.close();
      const before = readdirSync(dir).sort();
      const busy = Object.assign(new Error("database is locked"), { code: "ERR_SQLITE_ERROR", errcode: 5 });
      const probe = probeStoreFile(path, (target, options) => {
        expect(options?.readOnly).toBe(true);
        writeFileSync(`${target}-shm`, "simulated sidecar");
        throw busy;
      });
      expect(probe.state).toBe("locked");
      expect(readdirSync(dir).sort()).toEqual(before);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
