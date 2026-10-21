// @implements REQ-108 REQ-085
// One-time, non-destructive migration from the legacy JSON store to the
// SQLite store. The JSON file is never renamed until the SQLite transaction
// has committed and the database file is durable.
import { randomUUID } from "node:crypto";
import {
  chmodSync,
  closeSync,
  existsSync,
  fsyncSync,
  openSync,
  readFileSync,
  renameSync,
  unlinkSync,
} from "node:fs";
import { join } from "node:path";
import { isEncryptedEnvelope, openEnvelope, resolveKeySource, type ResolvedKey } from "./kb-crypto.js";
import { LEGACY_JSON_STORE, LIVE_SQLITE_STORE } from "./kb-store.js";
import { SqliteStore } from "./kb-sqlite.js";
import type { KbChunk } from "./types.js";

interface LegacyStore {
  chunks: KbChunk[];
  idf: Record<string, number>;
  docCount: number;
  events: string[];
  model?: string;
  embed_state?: Record<string, unknown>;
}

export interface MigrationResult {
  status: "none" | "migrated" | "corrupt" | "locked" | "error";
  event?: string;
  message?: string;
  remediation?: string;
}

function fsyncFile(path: string): void {
  try {
    const fd = openSync(path, "r");
    try {
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
  } catch {
    // best effort
  }
}

function fsyncDir(dir: string): void {
  try {
    const fd = openSync(dir, "r");
    try {
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
  } catch {
    // best effort
  }
}

export function migrateLegacyJson(opts: {
  storagePath: string;
  encryptionEnabled: boolean;
  keyFile?: string;
}): MigrationResult {
  const jsonPath = join(opts.storagePath, LEGACY_JSON_STORE);
  const dbPath = join(opts.storagePath, LIVE_SQLITE_STORE);
  if (existsSync(dbPath) || !existsSync(jsonPath)) return { status: "none" };

  const bytes = readFileSync(jsonPath);
  let clear: Buffer;
  if (isEncryptedEnvelope(bytes)) {
    let key: ResolvedKey | null = null;
    try {
      key = resolveKeySource(opts.keyFile);
    } catch {
      key = null;
    }
    if (!key) {
      return {
        status: "locked",
        message: "Legacy knowledge base is encrypted but no key is available",
        remediation:
          "Set INFOBROKER_KB_KEY or INFOBROKER_KB_PASSPHRASE, or point kb.encryption.key_file at the key, then restart. The legacy store is untouched.",
      };
    }
    try {
      clear = openEnvelope(key, bytes);
    } catch {
      return {
        status: "locked",
        message: "Legacy knowledge base could not be decrypted (wrong key or tampered store)",
        remediation: "Verify the key with the encryption 'verify' action. The legacy store is untouched.",
      };
    }
  } else {
    clear = bytes;
  }

  let legacy: LegacyStore;
  try {
    const parsed = JSON.parse(clear.toString("utf-8")) as LegacyStore;
    if (!parsed || !Array.isArray(parsed.chunks) || typeof parsed.idf !== "object") {
      throw new Error("invalid store shape");
    }
    legacy = parsed;
  } catch {
    if (opts.encryptionEnabled) {
      return {
        status: "locked",
        message: "Legacy knowledge base is unreadable; enabled encryption prevents automatic recovery",
        remediation: "Inspect vector-store.json; restore a backup or disable encryption to enable legacy recovery.",
      };
    }
    const backup = join(opts.storagePath, `vector-store.corrupt-${Date.now()}.json`);
    renameSync(jsonPath, backup);
    return {
      status: "corrupt",
      event: `Storage corruption detected at ${new Date().toISOString()}. Backup: ${backup}`,
    };
  }

  const tempName = `.vector-store.migrate-${randomUUID()}.sqlite`;
  const tempPath = join(opts.storagePath, tempName);
  let store: SqliteStore | null = null;
  try {
    let secret: ResolvedKey | null = null;
    if (opts.encryptionEnabled) {
      try {
        secret = resolveKeySource(opts.keyFile);
      } catch {
        secret = null;
      }
      if (!secret) {
        return {
          status: "locked",
          message: "Knowledge base encryption is enabled but no key is available",
          remediation: "Configure the key, then restart. The legacy store is untouched.",
        };
      }
    }
    store = new SqliteStore(opts.storagePath, {
      fileName: tempName,
      journalMode: "DELETE",
      encryptionEnabled: opts.encryptionEnabled,
      secret,
    });
    store.init();
    for (let i = 0; i < legacy.chunks.length; i += 500) {
      store.insertChunks(legacy.chunks.slice(i, i + 500));
    }
    store.setMeta({
      idf: legacy.idf,
      docCount: legacy.docCount,
      ...(legacy.model ? { model: legacy.model } : {}),
      ...(legacy.embed_state ? { embed_state: legacy.embed_state } : {}),
    });
    for (const event of legacy.events ?? []) store.appendEvent(event);
    store.close();
    store = null;

    fsyncFile(tempPath);
    renameSync(tempPath, dbPath);
    chmodSync(dbPath, 0o600);
    fsyncDir(opts.storagePath);

    const migratedPath = join(opts.storagePath, `vector-store.json.migrated-${Date.now()}`);
    renameSync(jsonPath, migratedPath);
    return {
      status: "migrated",
      event: `Knowledge base migrated to ${LIVE_SQLITE_STORE} at ${new Date().toISOString()}; prior store preserved as ${migratedPath}`,
    };
  } catch (e) {
    store?.close();
    for (const path of [tempPath, `${tempPath}-wal`, `${tempPath}-shm`, `${tempPath}-journal`]) {
      try {
        if (existsSync(path)) unlinkSync(path);
      } catch {
        // best effort cleanup
      }
    }
    return {
      status: "error",
      message: `Knowledge base migration failed: ${e instanceof Error ? e.message : String(e)}`,
      remediation: "The legacy JSON store is untouched. Fix the reported error and restart.",
    };
  }
}
