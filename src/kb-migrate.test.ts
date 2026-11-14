// @implements REQ-108 REQ-085
import { describe, it, expect } from "vitest";
import { randomBytes } from "node:crypto";
import { mkdtempSync, writeFileSync, existsSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { migrateLegacyJson, writeMigrationArtifact } from "./kb-migrate.js";
import { isEncryptedEnvelope, openEnvelope, resolveKeySource, sealEnvelope } from "./kb-crypto.js";
import { join } from "node:path";
import { initKb, kbGet, kbStats, kbStoreFormat } from "./kb.js";
import type { KbConfig, KbChunk } from "./types.js";

function config(dir: string): KbConfig {
  return {
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
        stable: { decay_hours: 720, expiry_hours: 0 },
      },
      auto_classify: false,
      default_tier: "stable",
    },
  };
}

function legacy(chunk: KbChunk, events: string[] = []) {
  return JSON.stringify({
    chunks: [chunk],
    idf: { alpha: 1 },
    docCount: 1,
    events,
  });
}

const baseChunk = (text: string, source = "https://example.com/legacy"): KbChunk => ({
  id: "legacy-1",
  text,
  embedding: [1, 0, 0],
  source_url: source,
  chunk_index: 0,
  title: "Legacy",
  provider: "test",
  collection: "default",
  source_type: "web_search",
  freshness_tier: "stable",
  ingested_at: Date.now(),
});

describe("legacy JSON migration (REQ-108)", () => {
  it("migrates non-destructively and preserves a backup", () => {
    const dir = mkdtempSync(join(tmpdir(), "infobroker-kb-migrate-"));
    try {
      writeFileSync(join(dir, "vector-store.json"), legacy(baseChunk("legacy alpha text")));
      initKb(config(dir));
      expect(existsSync(join(dir, "vector-store.sqlite"))).toBe(true);
      expect(kbGet("https://example.com/legacy")?.text).toContain("legacy alpha text");
      expect(readdirSync(dir).some((f) => f.startsWith("vector-store.json.migrated-"))).toBe(true);
      expect(kbStats().events.some((e) => e.includes("migrated to vector-store.sqlite"))).toBe(true);
      // Idempotent: a second open does not create another backup.
      const before = readdirSync(dir).filter((f) => f.startsWith("vector-store.json.migrated-")).length;
      initKb(config(dir));
      const after = readdirSync(dir).filter((f) => f.startsWith("vector-store.json.migrated-")).length;
      expect(after).toBe(before);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("preserves the migrated source sealed when encryption is enabled (REQ-084, REQ-108)", () => {
    const dir = mkdtempSync(join(tmpdir(), "infobroker-kb-migrate-enc-"));
    try {
      writeFileSync(join(dir, "vector-store.json"), legacy(baseChunk("legacy alpha text")));
      const keyFile = join(dir, "key");
      writeFileSync(keyFile, `${randomBytes(32).toString("base64")}\n`, { mode: 0o600 });
      initKb({ ...config(dir), encryption: { enabled: true, key_file: keyFile } });
      expect(kbStoreFormat()).toBe("encrypted");
      expect(kbGet("https://example.com/legacy")?.text).toContain("legacy alpha text");
      expect(existsSync(join(dir, "vector-store.json"))).toBe(false);
      const artifacts = readdirSync(dir).filter((f) => f.startsWith("vector-store.json.migrated-"));
      expect(artifacts).toHaveLength(1);
      expect(artifacts[0]!.endsWith(".enc")).toBe(true);
      const sealed = readFileSync(join(dir, artifacts[0]!));
      expect(isEncryptedEnvelope(sealed)).toBe(true);
      const key = resolveKeySource(keyFile);
      expect(key).not.toBeNull();
      const reopened = JSON.parse(openEnvelope(key!, sealed).toString("utf-8")) as {
        chunks: Array<{ text: string }>;
      };
      expect(reopened.chunks[0]!.text).toBe("legacy alpha text");
      expect(kbStats().events.some((e) => e.includes("sealed as"))).toBe(true);
      // The plaintext-archive sweep must not reap the sealed artifact.
      initKb({ ...config(dir), encryption: { enabled: true, key_file: keyFile } });
      expect(readdirSync(dir).filter((f) => f.startsWith("vector-store.json.migrated-"))).toHaveLength(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("preserves an already-encrypted legacy store as a sealed artifact (REQ-108)", () => {
    const dir = mkdtempSync(join(tmpdir(), "infobroker-kb-migrate-enc-src-"));
    try {
      const key = { kind: "raw" as const, dek: randomBytes(32) };
      writeFileSync(
        join(dir, "vector-store.json"),
        sealEnvelope(key, Buffer.from(legacy(baseChunk("legacy sealed text"))))
      );
      const keyFile = join(dir, "key");
      writeFileSync(keyFile, `${key.dek.toString("base64")}\n`, { mode: 0o600 });
      initKb({ ...config(dir), encryption: { enabled: true, key_file: keyFile } });
      expect(kbGet("https://example.com/legacy")?.text).toContain("legacy sealed text");
      const artifacts = readdirSync(dir).filter((f) => f.startsWith("vector-store.json.migrated-"));
      expect(artifacts).toHaveLength(1);
      expect(artifacts[0]!.endsWith(".enc")).toBe(true);
      const opened = openEnvelope(key, readFileSync(join(dir, artifacts[0]!))).toString("utf-8");
      expect(JSON.parse(opened).chunks[0].text).toBe("legacy sealed text");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("discards the artifact but leaves no plaintext when the sealed write fails (REQ-084)", () => {
    const dir = mkdtempSync(join(tmpdir(), "infobroker-kb-migrate-write-fail-"));
    try {
      writeFileSync(join(dir, "vector-store.json"), legacy(baseChunk("legacy alpha text")));
      const keyFile = join(dir, "key");
      writeFileSync(keyFile, `${randomBytes(32).toString("base64")}\n`, { mode: 0o600 });
      const result = migrateLegacyJson({
        storagePath: dir,
        encryptionEnabled: true,
        keyFile,
        writeArtifact: () => {
          throw new Error("simulated write failure");
        },
      });
      expect(result.status).toBe("migrated");
      expect(result.event).toContain("discarded");
      expect(result.event).toContain("simulated write failure");
      expect(existsSync(join(dir, "vector-store.json"))).toBe(false);
      expect(readdirSync(dir).some((f) => f.startsWith("vector-store.json.migrated-"))).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("writes the artifact atomically and leaves no partial file (REQ-085)", () => {
    const dir = mkdtempSync(join(tmpdir(), "infobroker-kb-migrate-atomic-"));
    try {
      const target = join(dir, "artifact.enc");
      writeMigrationArtifact(target, Buffer.from("sealed-bytes"));
      expect(readFileSync(target, "utf-8")).toBe("sealed-bytes");
      expect(readdirSync(dir)).toEqual(["artifact.enc"]);
      // A temp-file + rename replaces the directory entry, so the inode changes;
      // a direct write to the final name would keep it (mutation witness).
      const firstIno = statSync(target).ino;
      writeMigrationArtifact(target, Buffer.from("sealed-again"));
      expect(readFileSync(target, "utf-8")).toBe("sealed-again");
      expect(statSync(target).ino).not.toBe(firstIno);
      expect(readdirSync(dir)).toEqual(["artifact.enc"]);
      const missing = join(dir, "absent", "artifact.enc");
      expect(() => writeMigrationArtifact(missing, Buffer.from("x"))).toThrow();
      expect(existsSync(missing)).toBe(false);
      expect(readdirSync(dir)).toEqual(["artifact.enc"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("refuses a newer encrypted legacy format without modifying it (REQ-085)", () => {
    const dir = mkdtempSync(join(tmpdir(), "infobroker-kb-migrate-newer-"));
    try {
      const key = { kind: "raw" as const, dek: randomBytes(32) };
      const sealed = sealEnvelope(key, Buffer.from(legacy(baseChunk("future format"))));
      sealed[Buffer.from("INFOKB1", "utf-8").length] = 99;
      const jsonPath = join(dir, "vector-store.json");
      writeFileSync(jsonPath, sealed);
      const keyFile = join(dir, "key");
      writeFileSync(keyFile, `${key.dek.toString("base64")}\n`, { mode: 0o600 });
      const result = migrateLegacyJson({ storagePath: dir, encryptionEnabled: true, keyFile });
      expect(result.status).toBe("locked");
      expect(readFileSync(jsonPath)[Buffer.from("INFOKB1", "utf-8").length]).toBe(99);
      expect(existsSync(join(dir, "vector-store.sqlite"))).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("backs up a corrupt legacy store and starts empty (F10)", () => {
    const dir = mkdtempSync(join(tmpdir(), "infobroker-kb-migrate-corrupt-"));
    try {
      writeFileSync(join(dir, "vector-store.json"), "{ not json");
      initKb(config(dir));
      expect(readdirSync(dir).some((f) => f.startsWith("vector-store.corrupt-"))).toBe(true);
      expect(kbStats().chunk_count).toBe(0);
      expect(kbStats().events.some((e) => e.includes("Storage corruption detected"))).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
