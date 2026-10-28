// @implements REQ-122
import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  snapshotSource,
  snapshotIdentity,
  sha256Text,
  SNAPSHOT_SOURCE_TYPE,
  SNIPPET_SOURCE_TYPE,
} from "./preservation.js";
import { initKb, flushKbWrites, kbGet } from "./kb.js";
import type { KbConfig } from "./types.js";

const dirs: string[] = [];

function baseConfig(dir: string): KbConfig {
  return {
    storage_path: dir,
    embedding_model: "signed-hash-tfidf",
    chunk_size: 128,
    chunk_overlap: 16,
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

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "ib-preserve-"));
  dirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of dirs.splice(0)) {
    try {
      flushKbWrites();
    } catch {
      // a locked store may refuse to flush; cleanup still proceeds
    }
    rmSync(dir, { recursive: true, force: true });
  }
});

function withKb(): string {
  const dir = tempDir();
  initKb(baseConfig(dir));
  return dir;
}

describe("citation-grade snapshots (REQ-122)", () => {
  it("hashes deterministically", () => {
    expect(sha256Text("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("rejects non-http targets and empty text", () => {
    expect(snapshotSource({ url: "file:///etc/passwd", title: "x", text: "body" })).toBeNull();
    expect(snapshotSource({ url: "https://example.com/a", title: "x", text: "   " })).toBeNull();
  });

  it("stores document and snippet snapshots under distinct identities", () => {
    withKb();
    const url = "https://example.com/report";
    expect(snapshotIdentity(url, "document")).toBe(url);
    expect(snapshotIdentity(url, "snippet")).toBe(`${url}#snippet`);

    const doc = snapshotSource({ url, title: "Report", text: "The reservoir level fell by two metres." });
    expect(doc).not.toBeNull();
    expect(doc!.hash_basis).toBe("document");
    expect(doc!.snapshot_url).toBe(url);

    const snippet = snapshotSource({
      url,
      title: "Report",
      text: "The reservoir level fell by two metres.",
      basis: "snippet",
    });
    expect(snippet).not.toBeNull();
    expect(snippet!.hash_basis).toBe("snippet");
    expect(snippet!.snapshot_url).toBe(`${url}#snippet`);

    expect(kbGet(url)?.source_type).toBe(SNAPSHOT_SOURCE_TYPE);
    expect(kbGet(`${url}#snippet`)?.source_type).toBe(SNIPPET_SOURCE_TYPE);
  });

  it("bounds by UTF-8 bytes without splitting a character and reports truncation", () => {
    withKb();
    // "é" is two UTF-8 bytes; a 5-byte cap must not emit a broken character.
    const result = snapshotSource({
      url: "https://example.com/bytes",
      title: "Bytes",
      text: "aééé",
      maxBytes: 5,
    });
    expect(result).not.toBeNull();
    expect(result!.truncated).toBe(true);
    // 5 bytes is exactly "aéé"; the third "é" would cross the cap.
    expect(result!.snapshot_sha256).toBe(sha256Text("aéé"));
    const stored = kbGet(result!.snapshot_url);
    expect(stored).not.toBeNull();
    expect(stored!.text).not.toContain("\uFFFD");
  });

  it("reports a complete document as not truncated", () => {
    withKb();
    const result = snapshotSource({
      url: "https://example.com/small",
      title: "Small",
      text: "short text",
      maxBytes: 1024,
    });
    expect(result).not.toBeNull();
    expect(result!.truncated).toBe(false);
  });
});
