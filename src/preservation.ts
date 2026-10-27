// @implements REQ-122
// Citation-grade source snapshots. A cited source is copied into the local
// knowledge base as an "evergreen" snapshot so a report can be rechecked after
// the live page changes or disappears. The hash is computed by the server, not
// the caller, and the snapshot inherits the KB's at-rest encryption.

import { createHash } from "node:crypto";
import { isKbConfigured, kbIngest } from "./kb.js";

export const SNAPSHOT_COLLECTION = "sources";
export const SNAPSHOT_SOURCE_TYPE = "snapshot";
export const SNAPSHOT_TIER = "evergreen";
export const SNAPSHOT_MAX_BYTES = 2_000_000;

export interface SnapshotInput {
  url: string;
  title: string;
  text: string;
  provider?: string;
  sourceUpdatedAt?: string;
  maxBytes?: number;
}

export interface SnapshotResult {
  snapshot_sha256: string;
  snapshot_tier: string;
  hash_basis: "document";
}

export function sha256Text(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

export function snapshotSource(input: SnapshotInput): SnapshotResult | null {
  if (!isKbConfigured()) return null;
  if (!/^https?:\/\//i.test(input.url)) return null;
  const text = (input.text ?? "").trim();
  if (text.length === 0) return null;
  const maxBytes = input.maxBytes ?? SNAPSHOT_MAX_BYTES;
  const bounded = text.length > maxBytes ? text.slice(0, maxBytes) : text;
  const chunks = kbIngest(
    bounded,
    input.title || input.url,
    input.url,
    input.provider || "snapshot",
    SNAPSHOT_COLLECTION,
    SNAPSHOT_SOURCE_TYPE,
    SNAPSHOT_TIER,
    input.sourceUpdatedAt,
  );
  if (chunks === 0) return null;
  return {
    snapshot_sha256: sha256Text(bounded),
    snapshot_tier: SNAPSHOT_TIER,
    hash_basis: "document",
  };
}
