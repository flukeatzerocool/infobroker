// @implements REQ-060 REQ-060a REQ-060b REQ-060c REQ-060d REQ-060e REQ-060f REQ-060g REQ-084 REQ-085
// Legacy JSON backend for the knowledge base. It keeps the whole store in
// memory (the pre-SQLite behavior) and is retained as a one-release escape
// hatch; the SQLite backend is the default.
import {
  chmodSync,
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeSync,
} from "node:fs";
import { basename, dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import {
  isEncryptedEnvelope,
  openEnvelope,
  resolveKeySource,
  sealEnvelope,
  type ResolvedKey,
} from "./kb-crypto.js";
import {
  LEGACY_JSON_STORE,
  type KbMeta,
  type KbStore,
} from "./kb-store.js";
import type { KbChunk } from "./types.js";

interface Snapshot extends KbMeta {
  chunks: KbChunk[];
  events: string[];
}

export interface JsonStoreOptions {
  encryptionEnabled: boolean;
  keyFile?: string;
  onCorruption: () => string | null;
  onLock: (error: { code: string; message: string; remediation: string }) => void;
}

export class JsonStore implements KbStore {
  readonly backend = "json" as const;
  readonly path: string;
  private data: Snapshot = { chunks: [], idf: {}, docCount: 0, events: [] };
  private key: ResolvedKey | null = null;
  private opts: JsonStoreOptions;

  constructor(storagePath: string, opts: JsonStoreOptions) {
    this.path = join(storagePath, LEGACY_JSON_STORE);
    this.opts = opts;
  }

  init(): void {
    this.key = this.resolveKey();
    if (!existsSync(this.path)) {
      this.data = { chunks: [], idf: {}, docCount: 0, events: [] };
      return;
    }
    const bytes = readFileSync(this.path);
    if (isEncryptedEnvelope(bytes)) {
      if (!this.key) {
        this.opts.onLock({
          code: "config_error",
          message: "Knowledge base is encrypted but no usable key is configured",
          remediation:
            "Set INFOBROKER_KB_KEY or INFOBROKER_KB_PASSPHRASE, or point kb.encryption.key_file at a valid key file, then reload. The store file is untouched.",
        });
        return;
      }
      try {
        const parsed = JSON.parse(openEnvelope(this.key, bytes).toString("utf-8")) as Snapshot;
        if (!Array.isArray(parsed.chunks) || typeof parsed.idf !== "object") throw new Error("invalid store");
        this.data = parsed;
      } catch {
        this.opts.onLock({
          code: "config_error",
          message: "Knowledge base could not be decrypted (wrong key or tampered store)",
          remediation:
            "Verify the key with the encryption 'verify' action. The store file has not been modified; fix the key and restart.",
        });
      }
      return;
    }
    try {
      const parsed = JSON.parse(bytes.toString("utf-8")) as Snapshot;
      if (!Array.isArray(parsed.chunks) || typeof parsed.idf !== "object") throw new Error("invalid store");
      this.data = parsed;
      return;
    } catch {
      // fall through to corruption handling
    }
    if (this.opts.encryptionEnabled) {
      this.opts.onLock({
        code: "config_error",
        message: "Knowledge base store is unreadable; enabled encryption prevents automatic recovery",
        remediation:
          "Inspect vector-store.json; restore a backup or disable encryption to enable legacy recovery.",
      });
      return;
    }
    const event = this.opts.onCorruption();
    this.data = { chunks: [], idf: {}, docCount: 0, events: event ? [event] : [] };
  }

  private resolveKey(): ResolvedKey | null {
    try {
      return resolveKeySource(this.opts.keyFile);
    } catch {
      return null;
    }
  }

  close(): void {
    this.flush();
  }

  flush(): void {
    const clear = Buffer.from(JSON.stringify(this.data), "utf-8");
    let bytes = clear;
    if (this.opts.encryptionEnabled) {
      const key = this.key ?? this.resolveKey();
      if (!key) throw new Error("Knowledge base encryption is enabled but no key is available");
      bytes = Buffer.from(sealEnvelope(key, clear));
    }
    this.atomicWrite(bytes);
  }

  private atomicWrite(bytes: Buffer): void {
    const dir = dirname(this.path);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o700 });
    const tmp = join(dir, `.${basename(this.path)}.tmp-${randomUUID()}`);
    try {
      const fd = openSync(tmp, "w", 0o600);
      try {
        writeSync(fd, bytes);
        fsyncSync(fd);
      } finally {
        closeSync(fd);
      }
      chmodSync(tmp, 0o600);
      renameSync(tmp, this.path);
      try {
        const dfd = openSync(dir, "r");
        try {
          fsyncSync(dfd);
        } finally {
          closeSync(dfd);
        }
      } catch {
        // directory fsync is best effort
      }
    } catch (e) {
      try {
        if (existsSync(tmp)) unlinkSync(tmp);
      } catch {
        // ignore cleanup failure
      }
      throw e;
    }
  }

  *iterateChunks(): Iterable<KbChunk> {
    yield* this.data.chunks;
  }

  insertChunks(chunks: readonly KbChunk[]): void {
    this.data.chunks.push(...chunks);
  }

  replaceChunks(sourceUrl: string, chunks: readonly KbChunk[]): void {
    this.data.chunks = this.data.chunks.filter((c) => c.source_url !== sourceUrl);
    this.data.chunks.push(...chunks);
  }

  deleteWhere(predicate: (chunk: KbChunk) => boolean): number {
    const before = this.data.chunks.length;
    this.data.chunks = this.data.chunks.filter((c) => !predicate(c));
    return before - this.data.chunks.length;
  }

  replaceAllChunks(chunks: readonly KbChunk[]): void {
    this.data.chunks = [...chunks];
  }

  meta(): KbMeta {
    return {
      idf: this.data.idf,
      docCount: this.data.docCount,
      ...(this.data.model ? { model: this.data.model } : {}),
      ...(this.data.embed_state ? { embed_state: this.data.embed_state } : {}),
    };
  }

  setMeta(meta: KbMeta): void {
    this.data.idf = meta.idf;
    this.data.docCount = meta.docCount;
    this.data.model = meta.model;
    this.data.embed_state = meta.embed_state;
  }

  appendEvent(message: string): void {
    this.data.events.push(message);
    if (this.data.events.length > 100) this.data.events = this.data.events.slice(-100);
  }

  events(): string[] {
    return [...this.data.events];
  }

  format(): "encrypted" | "plaintext" | "none" {
    if (!existsSync(this.path)) return "none";
    return isEncryptedEnvelope(readFileSync(this.path)) ? "encrypted" : "plaintext";
  }
}
