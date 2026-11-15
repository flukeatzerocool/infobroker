// @implements REQ-060c REQ-066 REQ-083 REQ-100 REQ-067 REQ-085 REQ-108
import { describe, it, expect, afterAll, vi } from "vitest";
import { closeSync, existsSync, ftruncateSync, mkdirSync, openSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { join } from "node:path";
import { testTmpDir } from "./lib/test-tmp.js";
import { DatabaseSync } from "node:sqlite";
import { SqliteStore } from "./kb-sqlite.js";
import { initKb, kbIngest, kbSearch, kbStats, kbGet, chunkText, flushKbWrites, getKbLockError } from "./kb.js";
import type { KbConfig } from "./types.js";

const base = testTmpDir("kb-hardening-");

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

  it("removes expired tiers on startup, keeps indefinite and unknown tiers", () => {
    const dir = join(base, "startup-expiry-store");
    const config = makeConfig(dir, {
      maintenance_interval_minutes: 0,
      freshness: {
        tiers: {
          short: { decay_hours: 1, expiry_hours: 1 },
          keep: { decay_hours: 1, expiry_hours: 0 },
        },
        auto_classify: false,
        default_tier: "keep",
      },
    });
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
      initKb(config);
      kbIngest("short lived ephemeral note", "short", "https://example.com/short", "test", undefined, "test", "short");
      kbIngest("kept forever stable note", "keep", "https://example.com/keep", "test", undefined, "test", "keep");
      kbIngest("unknown tier note", "unknown", "https://example.com/unknown", "test", undefined, "test", "retired");

      vi.setSystemTime(new Date("2026-01-01T02:00:00.000Z"));
      initKb(config); // startup maintenance runs inside initKb

      expect(kbGet("https://example.com/short")).toBeNull();
      expect(kbGet("https://example.com/keep")).not.toBeNull();
      expect(kbGet("https://example.com/unknown")).not.toBeNull();

      const events = kbStats().events;
      expect(events.some((event) => /Maintenance at .*: removed \d+ expired chunks/.test(event))).toBe(true);
      expect(events.some((event) => /error/i.test(event))).toBe(false);
    } finally {
      initKb(makeConfig(join(base, "startup-expiry-restore"), { maintenance_interval_minutes: 0 }));
      vi.useRealTimers();
    }
  });

  it("removes expired content at the configured interval without a re-init", () => {
    const dir = join(base, "interval-expiry-store");
    const config = makeConfig(dir, {
      maintenance_interval_minutes: 1,
      freshness: {
        tiers: { short: { decay_hours: 1, expiry_hours: 0.001 } },
        auto_classify: false,
        default_tier: "short",
      },
    });
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
      initKb(config);
      kbIngest("interval tick note", "tick", "https://example.com/tick", "test", undefined, "test", "short");
      expect(kbGet("https://example.com/tick")).not.toBeNull();

      // The 60 s tick advances the clock past the 3.6 s expiry; no re-init.
      vi.advanceTimersByTime(60_000);
      expect(kbGet("https://example.com/tick")).toBeNull();
      expect(kbStats().events.some((event) => /removed 1 expired chunks/.test(event))).toBe(true);
    } finally {
      initKb(makeConfig(join(base, "interval-expiry-restore"), { maintenance_interval_minutes: 0 }));
      vi.useRealTimers();
    }
  });

  it("expires by freshness tier, not by source_type", () => {
    const dir = join(base, "tier-vs-source-store");
    const config = makeConfig(dir, {
      maintenance_interval_minutes: 0,
      freshness: {
        tiers: {
          short: { decay_hours: 1, expiry_hours: 1 },
          keep: { decay_hours: 1, expiry_hours: 0 },
        },
        auto_classify: false,
        default_tier: "keep",
      },
    });
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
      initKb(config);
      // Same tier, different source_type: both expire.
      kbIngest("short web result", "s1", "https://example.com/s1", "test", undefined, "fetch_page", "short");
      kbIngest("short claim result", "s2", "https://example.com/s2", "test", undefined, "corroborate", "short");
      // Same source_type, indefinite tier: retained.
      kbIngest("kept web result", "k1", "https://example.com/k1", "test", undefined, "fetch_page", "keep");

      vi.setSystemTime(new Date("2026-01-01T02:00:00.000Z"));
      initKb(config);

      expect(kbGet("https://example.com/s1")).toBeNull();
      expect(kbGet("https://example.com/s2")).toBeNull();
      expect(kbGet("https://example.com/k1")).not.toBeNull();
    } finally {
      initKb(makeConfig(join(base, "tier-vs-source-restore"), { maintenance_interval_minutes: 0 }));
      vi.useRealTimers();
    }
  });

  it("retains reports through an expiring tier (REQ-083)", () => {
    const dir = join(base, "report-retention-store");
    const config = makeConfig(dir, {
      maintenance_interval_minutes: 0,
      freshness: {
        tiers: {
          short: { decay_hours: 1, expiry_hours: 1 },
          keep: { decay_hours: 1, expiry_hours: 0 },
        },
        auto_classify: false,
        default_tier: "keep",
      },
    });
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
      initKb(config);
      kbIngest("expiring web result", "w", "https://example.com/short-web", "test", undefined, "web_search", "short");
      kbIngest(
        "expiring report body that must never be removed",
        "short report",
        "report://short-report",
        "explicit",
        "reports",
        "report",
        "short"
      );

      vi.setSystemTime(new Date("2026-01-01T02:00:00.000Z"));
      initKb(config);

      expect(kbGet("https://example.com/short-web")).toBeNull();
      expect(kbGet("report://short-report")).not.toBeNull();
    } finally {
      initKb(makeConfig(join(base, "report-retention-restore"), { maintenance_interval_minutes: 0 }));
      vi.useRealTimers();
    }
  });
});

describe("Startup resilience (REQ-085, REQ-108)", () => {
  it("recovers from a corrupt metadata index instead of throwing (REQ-108 corrupt-metadata)", () => {
    const dir = join(base, "corrupt-meta-store");
    initKb(makeConfig(dir));
    kbIngest("a recoverable document about basalt columns", "recover", "https://example.com/recover", "test");
    flushKbWrites();

    const db = new DatabaseSync(join(dir, "vector-store.sqlite"));
    db.prepare("UPDATE meta SET value = ? WHERE key = 'idf'").run('{"basalt":1,"columns"');
    db.close();

    expect(() => initKb(makeConfig(dir))).not.toThrow();
    expect(getKbLockError()).toBeNull();
    expect(kbSearch("basalt columns", 5).length).toBeGreaterThan(0);
    expect(readdirSync(dir).some((name) => name.startsWith("vector-store.corrupt-"))).toBe(true);
    expect(kbStats().events.some((event) => event.includes("was corrupt"))).toBe(true);
  });

  it("reports an unusable storage path as a lock error instead of throwing (REQ-085 unreadable-store)", () => {
    const notADir = join(base, "not-a-directory");
    writeFileSync(notADir, "x");
    expect(() => initKb(makeConfig(join(notADir, "sub")))).not.toThrow();
    const lock = getKbLockError();
    expect(lock?.code).toBe("config_error");
    expect(lock?.remediation).toContain("storage path");
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

function truncateStore(path: string, size: number): void {
  const fd = openSync(path, "r+");
  try {
    ftruncateSync(fd, size);
  } finally {
    closeSync(fd);
  }
}

function archiveNames(dir: string): string[] {
  return readdirSync(dir).filter((name) => name.startsWith("vector-store.corrupt-"));
}

describe("corrupt live store recovery (REQ-108)", () => {
  it("preserves a backup, continues empty, and reports the event", () => {
    const dir = join(base, "corrupt-live-store");
    initKb(makeConfig(dir, { maintenance_interval_minutes: 0 }));
    kbIngest("alpha beta content before corruption", "corrupt", "https://example.com/corrupt", "test");
    flushKbWrites();
    const path = join(dir, "vector-store.sqlite");
    truncateStore(path, 600);
    const damaged = readFileSync(path);

    initKb(makeConfig(dir, { maintenance_interval_minutes: 0 }));
    expect(getKbLockError()).toBeNull();
    expect(kbStats().chunk_count).toBe(0);
    const archived = archiveNames(dir).find((name) => !name.endsWith("-wal") && !name.endsWith("-shm"));
    expect(archived).toBeTruthy();
    expect(readFileSync(join(dir, archived!))).toEqual(damaged);
    const events = kbStats().events;
    expect(events.at(-1)).toContain("Storage corruption detected at ");
    expect(events.at(-1)).toContain(join(dir, archived!));
    expect(kbIngest("fresh content after recovery", "fresh", "https://example.com/fresh", "test")).toBeGreaterThan(0);
    expect(kbSearch("fresh content", 5).length).toBeGreaterThan(0);
  });

  it("leaves a non-SQLite file untouched and locks", () => {
    const dir = join(base, "not-a-store");
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    const path = join(dir, "vector-store.sqlite");
    writeFileSync(path, "this is not a sqlite database at all");
    const before = readFileSync(path);

    initKb(makeConfig(dir, { maintenance_interval_minutes: 0 }));
    expect(getKbLockError()?.code).toBe("config_error");
    expect(getKbLockError()?.message).toContain("unrecognized");
    expect(readFileSync(path)).toEqual(before);
    expect(archiveNames(dir)).toEqual([]);
  });

  it("locks an encrypted store when the key is absent and keeps it readable", () => {
    const dir = join(base, "missing-key-store");
    const good = join(base, "missing-key-store.key");
    writeFileSync(good, randomBytes(32).toString("base64"), { mode: 0o600 });
    const encrypted = (keyFile: string) =>
      makeConfig(dir, { maintenance_interval_minutes: 0, encryption: { enabled: true, key_file: keyFile } });

    initKb(encrypted(good));
    kbIngest("secret alpha content", "secret", "https://example.com/secret", "test");
    flushKbWrites();

    initKb(encrypted(join(base, "absent.key")));
    expect(getKbLockError()?.code).toBe("config_error");
    expect(getKbLockError()?.message).toMatch(/no key/i);

    initKb(encrypted(good));
    expect(getKbLockError()).toBeNull();
    expect(kbSearch("secret alpha content", 5).length).toBeGreaterThan(0);
  });
});

describe("corrupt store recovery backout (REQ-108)", () => {
  function seedCorrupt(dir: string): Buffer {
    const store = new SqliteStore(dir, { journalMode: "DELETE" });
    store.init();
    store.appendEvent("seed event");
    store.close();
    const path = join(dir, "vector-store.sqlite");
    truncateStore(path, 600);
    return readFileSync(path);
  }

  it("restores the archive when the creation open fails, once per attempt", () => {
    const dir = join(base, "restore-create-fail");
    const damaged = seedCorrupt(dir);
    const path = join(dir, "vector-store.sqlite");
    let opens = 0;
    const refusing = (target: string, options?: { readOnly?: boolean }) => {
      opens += 1;
      if (!options?.readOnly) throw new Error("creation refused");
      return new DatabaseSync(target, options);
    };

    const store = new SqliteStore(dir, { allowRecovery: true, journalMode: "DELETE", openDatabase: refusing });
    expect(() => store.init()).toThrow("creation refused");
    expect(opens).toBe(2); // probe read-only, then the refused creation
    expect(readFileSync(path)).toEqual(damaged);
    expect(archiveNames(dir)).toEqual([]);

    expect(() => store.init()).toThrow("creation refused");
    expect(readFileSync(path)).toEqual(damaged);
    expect(archiveNames(dir)).toEqual([]);
  });

  it("restores the archive when the encryption bootstrap fails after creation", () => {
    const dir = join(base, "restore-bootstrap-fail");
    const damaged = seedCorrupt(dir);
    const path = join(dir, "vector-store.sqlite");
    const store = new SqliteStore(dir, {
      allowRecovery: true,
      encryptionEnabled: true,
      secret: null,
      journalMode: "DELETE",
    });
    expect(() => store.init()).toThrow(/no key/i);
    expect(readFileSync(path)).toEqual(damaged);
    expect(existsSync(path)).toBe(true);
    expect(archiveNames(dir)).toEqual([]);
  });

  it("does not recover when the caller has not opted in", () => {
    const dir = join(base, "recovery-opted-out");
    const damaged = seedCorrupt(dir);
    const path = join(dir, "vector-store.sqlite");
    const store = new SqliteStore(dir, { journalMode: "DELETE" });
    expect(() => store.init()).toThrow(/corrupt/i);
    expect(readFileSync(path)).toEqual(damaged);
    expect(archiveNames(dir)).toEqual([]);
  });
});
