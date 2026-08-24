// @implements REQ-084 REQ-085 REQ-011
// At-rest encryption for the knowledge base store and disk-saved reports.
// Zero-dependency: uses only node:crypto primitives. All format commits are
// versioned so a later format change cannot silently break older stores.
import { randomBytes, createCipheriv, createDecipheriv, scryptSync } from "node:crypto";
import { readFileSync } from "node:fs";

const MAGIC = "INFOKB1";
const ENVELOPE_VERSION = 1;
const KEY_BYTES = 32;
const NONCE_BYTES = 12;
const TAG_BYTES = 16;
const SALT_BYTES = 16;

// scrypt work factors (OWASP minimum for the passphrase path; runs once at
// startup). N=2^17, r=8, p=1 requires ~128 MiB, hence maxmem 256 MiB.
const SCRYPT_N = 2 ** 17;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_MAXMEM = 256 * 1024 * 1024;

// kdf byte values recorded in the envelope header.
const KDF_RAW_DEK = 0;
const KDF_SCRYPT_KEK = 1;

export type ResolvedKey =
  | { kind: "raw"; dek: Buffer }
  | { kind: "passphrase"; passphrase: string };

export interface EnvelopeHeader {
  version: number;
  kdf: number;
  salt: Buffer | null;
  wrappedDek: Buffer | null;
}

/**
 * THE one rule of AES-GCM (NIST SP 800-38D): a nonce must never be reused
 * under the same key. Each encryption draws a fresh 12-byte random nonce from
 * the CSPRNG. For a local store (writes at most a few times per minute) the
 * random-IV collision bound of 2^32 invocations is irrelevant.
 */
function encrypt(key: Buffer, plaintextBytes: Buffer, aad: Buffer): { ciphertext: Buffer; tag: Buffer; nonce: Buffer } {
  const nonce = randomBytes(NONCE_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  cipher.setAAD(aad);
  const ciphertext = Buffer.concat([cipher.update(plaintextBytes), cipher.final()]);
  return { ciphertext, tag: cipher.getAuthTag(), nonce };
}

function decrypt(key: Buffer, ciphertext: Buffer, aad: Buffer, nonce: Buffer, tag: Buffer): Buffer {
  const decipher = createDecipheriv("aes-256-gcm", key, nonce);
  decipher.setAAD(aad);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

export function deriveKek(passphrase: string, salt: Buffer): Buffer {
  return scryptSync(passphrase, salt, KEY_BYTES, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: SCRYPT_MAXMEM,
  });
}

function serializeHeader(header: EnvelopeHeader): Buffer {
  const parts: Buffer[] = [];
  parts.push(Buffer.from(MAGIC, "utf-8"));
  parts.push(Buffer.from([header.version, header.kdf]));
  if (header.salt) parts.push(header.salt);
  if (header.wrappedDek) parts.push(header.wrappedDek);
  return Buffer.concat(parts);
}

interface ParsedEnvelope {
  header: EnvelopeHeader;
  nonce: Buffer;
  ciphertext: Buffer;
  tag: Buffer;
}

/**
 * Serialize the encrypted envelope: magic + version + kdf + [salt][wrappedDek]
 * + nonce + ciphertext + tag. The full header is bound as AAD so tampering
 * with version, kdf, salt, or the wrapped DEK fails authentication.
 */
export function sealEnvelope(resolved: ResolvedKey, plaintextBytes: Buffer): Buffer {
  let dek: Buffer;
  let header: EnvelopeHeader;

  if (resolved.kind === "raw") {
    dek = resolved.dek;
    header = { version: ENVELOPE_VERSION, kdf: KDF_RAW_DEK, salt: null, wrappedDek: null };
  } else {
    dek = randomBytes(KEY_BYTES);
    const salt = randomBytes(SALT_BYTES);
    const kek = deriveKek(resolved.passphrase, salt);
    const aad = Buffer.concat([Buffer.from(MAGIC, "utf-8"), Buffer.from([ENVELOPE_VERSION, KDF_SCRYPT_KEK]), salt]);
    const { ciphertext, tag, nonce } = encrypt(kek, dek, aad);
    header = {
      version: ENVELOPE_VERSION,
      kdf: KDF_SCRYPT_KEK,
      salt,
      wrappedDek: Buffer.concat([nonce, ciphertext, tag]),
    };
  }

  const headerBytes = serializeHeader(header);
  const { ciphertext, tag, nonce } = encrypt(dek, plaintextBytes, headerBytes);
  return Buffer.concat([headerBytes, nonce, ciphertext, tag]);
}

export function parseEnvelope(blob: Buffer): ParsedEnvelope {
  const magic = blob.subarray(0, MAGIC.length).toString("utf-8");
  if (magic !== MAGIC) {
    throw new Error("unrecognized format");
  }
  const version = blob[MAGIC.length];
  if (version > ENVELOPE_VERSION) {
    throw new Error(`newer format version ${version}`);
  }
  const kdf = blob[MAGIC.length + 1];
  let offset = MAGIC.length + 2;
  let salt: Buffer | null = null;
  let wrappedDek: Buffer | null = null;
  if (kdf === KDF_SCRYPT_KEK) {
    salt = blob.subarray(offset, offset + SALT_BYTES);
    offset += SALT_BYTES;
    wrappedDek = blob.subarray(offset, offset + NONCE_BYTES + KEY_BYTES + TAG_BYTES);
    offset += NONCE_BYTES + KEY_BYTES + TAG_BYTES;
  } else if (kdf !== KDF_RAW_DEK) {
    throw new Error("unknown kdf");
  }
  const nonce = blob.subarray(offset, offset + NONCE_BYTES);
  const ciphertext = blob.subarray(offset + NONCE_BYTES, blob.length - TAG_BYTES);
  const tag = blob.subarray(blob.length - TAG_BYTES);
  return {
    header: { version, kdf, salt, wrappedDek },
    nonce,
    ciphertext,
    tag,
  };
}

export function openEnvelope(resolved: ResolvedKey, blob: Buffer): Buffer {
  const parsed = parseEnvelope(blob);
  const dek = resolveDek(resolved, parsed.header, blob);
  const headerBytes = serializeHeader(parsed.header);
  return decrypt(dek, parsed.ciphertext, headerBytes, parsed.nonce, parsed.tag);
}

function resolveDek(resolved: ResolvedKey, header: EnvelopeHeader, blob: Buffer): Buffer {
  if (header.kdf === KDF_RAW_DEK) {
    if (resolved.kind !== "raw") {
      throw new Error("store encrypted with a raw key — supply INFOBROKER_KB_KEY or kb.encryption.key_file");
    }
    return resolved.dek;
  }
  // kdf === KDF_SCRYPT_KEK
  if (resolved.kind !== "passphrase") {
    throw new Error("store encrypted with a passphrase — supply INFOBROKER_KB_PASSPHRASE");
  }
  const salt = header.salt!;
  const wrappedDek = header.wrappedDek!;
  const kek = deriveKek(resolved.passphrase, salt);
  const wrappedNonce = wrappedDek.subarray(0, NONCE_BYTES);
  const wrappedCt = wrappedDek.subarray(NONCE_BYTES, wrappedDek.length - TAG_BYTES);
  const wrappedTag = wrappedDek.subarray(wrappedDek.length - TAG_BYTES);
  const aad = Buffer.concat([Buffer.from(MAGIC, "utf-8"), Buffer.from([header.version, header.kdf]), salt]);
  return decrypt(kek, wrappedCt, aad, wrappedNonce, wrappedTag);
}

/** Peek the envelope header without decrypting — used to detect file state. */
export function isEncryptedEnvelope(blob: Buffer): boolean {
  return blob.length >= MAGIC.length && blob.subarray(0, MAGIC.length).toString("utf-8") === MAGIC;
}

function decodeKeyFromString(value: string): Buffer {
  const trimmed = value.trim();
  let raw: Buffer;
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    raw = Buffer.from(trimmed, "hex");
  } else {
    raw = Buffer.from(trimmed, "base64");
  }
  if (raw.length !== KEY_BYTES) {
    throw new Error("key must decode to 32 bytes (64 hex chars or 44 base64 chars)");
  }
  return raw;
}

export function readKeyFile(path: string): Buffer {
  return decodeKeyFromString(readFileSync(path, "utf-8"));
}

/**
 * Resolve the encryption key from the configured source chain, in order:
 * key file → INFOBROKER_KB_KEY (raw) → INFOBROKER_KB_PASSPHRASE (passphrase).
 * Returns null when no source is configured. Throws when a source is present
 * but invalid (never silently falls through to a weaker source).
 */
export function resolveKeySource(keyFile?: string): ResolvedKey | null {
  if (keyFile) {
    return { kind: "raw", dek: readKeyFile(keyFile) };
  }
  const rawEnv = process.env["INFOBROKER_KB_KEY"];
  if (rawEnv) {
    return { kind: "raw", dek: decodeKeyFromString(rawEnv) };
  }
  const passEnv = process.env["INFOBROKER_KB_PASSPHRASE"];
  if (passEnv) {
    return { kind: "passphrase", passphrase: passEnv };
  }
  return null;
}

/** Build a raw-DEK key from an explicit string (used by rekey). */
export function rawKeyFromString(value: string | undefined): ResolvedKey | null {
  if (!value) return null;
  return { kind: "raw", dek: decodeKeyFromString(value) };
}

/** Build a passphrase key from an explicit string (used by rekey). */
export function passphraseKey(value: string | undefined): ResolvedKey | null {
  if (!value) return null;
  return { kind: "passphrase", passphrase: value };
}
