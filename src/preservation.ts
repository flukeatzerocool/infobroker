// @implements REQ-122
// Citation-grade source snapshots. A cited source is copied into the local
// knowledge base as an "evergreen" snapshot so a report can be rechecked after
// the live page changes or disappears. The hash is computed by the server, not
// the caller, and the snapshot inherits the KB's at-rest encryption. A snapshot
// records whether it covers the retrieved document or only a supplied snippet,
// so a receipt never upgrades an excerpt to document-grade evidence.

import { createHash } from "node:crypto";
import { isKbConfigured, kbIngest } from "./kb.js";
import {
  SNAPSHOT_COLLECTION,
  SNAPSHOT_SOURCE_TYPE,
  SNIPPET_SOURCE_TYPE,
} from "./kb-store.js";

export { SNAPSHOT_COLLECTION, SNAPSHOT_SOURCE_TYPE, SNIPPET_SOURCE_TYPE };
export const SNAPSHOT_TIER = "evergreen";
export const SNAPSHOT_MAX_BYTES = 2_000_000;

export type SnapshotBasis = "document" | "snippet";

export interface SnapshotInput {
  url: string;
  title: string;
  text: string;
  provider?: string;
  sourceUpdatedAt?: string;
  maxBytes?: number;
  /** What the supplied text represents (default: the retrieved document). */
  basis?: SnapshotBasis;
}

export interface SnapshotResult {
  snapshot_sha256: string;
  snapshot_tier: string;
  hash_basis: SnapshotBasis;
  snapshot_url: string;
  truncated: boolean;
}

export function sha256Text(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

/** Bound text by UTF-8 bytes without splitting a multi-byte character. */
function boundToBytes(text: string, maxBytes: number): { text: string; truncated: boolean } {
  const bytes = Buffer.from(text, "utf-8");
  if (bytes.byteLength <= maxBytes) return { text, truncated: false };
  let end = Math.max(0, maxBytes);
  while (end > 0 && (bytes[end]! & 0xc0) === 0x80) end--;
  return { text: bytes.subarray(0, end).toString("utf-8"), truncated: true };
}

/** REQ-122: a snippet snapshot gets its own identity so it can never replace
 * or masquerade as the document snapshot stored under the live URL. */
export function snapshotIdentity(url: string, basis: SnapshotBasis): string {
  return basis === "snippet" ? `${url}#snippet` : url;
}

export function snapshotSource(input: SnapshotInput): SnapshotResult | null {
  if (!isKbConfigured()) return null;
  if (!/^https?:\/\//i.test(input.url)) return null;
  const text = (input.text ?? "").trim();
  if (text.length === 0) return null;
  const basis = input.basis ?? "document";
  const { text: bounded, truncated } = boundToBytes(text, input.maxBytes ?? SNAPSHOT_MAX_BYTES);
  if (bounded.length === 0) return null;
  const snapshotUrl = snapshotIdentity(input.url, basis);
  const chunks = kbIngest(
    bounded,
    input.title || input.url,
    snapshotUrl,
    input.provider || "snapshot",
    SNAPSHOT_COLLECTION,
    basis === "snippet" ? SNIPPET_SOURCE_TYPE : SNAPSHOT_SOURCE_TYPE,
    SNAPSHOT_TIER,
    input.sourceUpdatedAt,
  );
  if (chunks === 0) return null;
  return {
    snapshot_sha256: sha256Text(bounded),
    snapshot_tier: SNAPSHOT_TIER,
    hash_basis: basis,
    snapshot_url: snapshotUrl,
    truncated,
  };
}
