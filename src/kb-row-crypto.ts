// @implements REQ-084
// Per-row at-rest encryption for the SQLite knowledge base. The store keeps
// one salt in `meta`; a passphrase is stretched with scrypt exactly once at
// open, and each row is sealed with AES-256-GCM using a fresh nonce.
import { randomBytes } from "node:crypto";
import {
  deriveKek,
  openEnvelope,
  sealEnvelope,
  type ResolvedKey,
} from "./kb-crypto.js";

export const ROW_SALT_BYTES = 16;

export function newRowSalt(): Buffer {
  return randomBytes(ROW_SALT_BYTES);
}

/** Derive the row key once per store open. Raw keys are used directly. */
export function deriveRowKey(secret: ResolvedKey, salt: Buffer): Buffer {
  return secret.kind === "raw" ? secret.dek : deriveKek(secret.passphrase, salt);
}

export function sealRow(key: Buffer, clear: Buffer): Buffer {
  return sealEnvelope({ kind: "raw", dek: key }, clear);
}

export function openRow(key: Buffer, sealed: Buffer): Buffer {
  return openEnvelope({ kind: "raw", dek: key }, sealed);
}
