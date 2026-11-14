// @implements REQ-066 undefined-tier-default REQ-074 default-tier-defined
// A chunk stored under a tier the configuration no longer defines must still
// decay and expire, by the configured default tier. Before this, such a chunk
// scored 1 forever and never expired.
import { describe, it, expect, afterAll } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initKb, kbIngest, kbSearch, kbList, runMaintenance } from "./kb.js";
import type { KbConfig } from "./types.js";

const roots: string[] = [];

function makeConfig(storagePath: string, decayHours: number, expiryHours: number): KbConfig {
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
      // Only `stable` is defined; the chunk below is stored under "stabel".
      tiers: { stable: { decay_hours: decayHours, expiry_hours: expiryHours } },
      auto_classify: false,
      default_tier: "stable",
    },
  };
}

function freshRoot(): string {
  const dir = mkdtempSync(join(tmpdir(), "infobroker-kb-tier-"));
  roots.push(dir);
  return dir;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

afterAll(() => {
  for (const dir of roots.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("undefined freshness tier resolution (REQ-066, REQ-074)", () => {
  it("decays a chunk stored under an undefined tier by the default tier", async () => {
    const dir = freshRoot();
    // 0.0002 hours ≈ 0.72 s, so a short wait puts the chunk well past its
    // decay and expiry windows without hanging the suite.
    initKb(makeConfig(dir, 0.0002, 0));
    kbIngest(
      "retrieval decay probe text about ranking",
      "decay-probe",
      "https://example.com/decay-probe",
      "web",
      undefined,
      undefined,
      "stabel",
    );
    await sleep(900);

    const [hit] = kbSearch("retrieval decay probe", 5);
    expect(hit?.freshness_tier).toBe("stabel");
    expect(hit!.freshness_score).toBeLessThan(1);
  });

  it("expires a chunk stored under an undefined tier by the default tier", async () => {
    const dir = freshRoot();
    initKb(makeConfig(dir, 0, 0.0002));
    kbIngest(
      "retrieval expiry probe text about ranking",
      "expiry-probe",
      "https://example.com/expiry-probe",
      "web",
      undefined,
      undefined,
      "stabel",
    );
    expect(kbList()).toHaveLength(1);
    await sleep(900);

    runMaintenance();
    expect(kbList()).toHaveLength(0);
  });
});
