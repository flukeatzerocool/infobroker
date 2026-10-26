// @implements REQ-110 REQ-060i REQ-060b
// Report verification receipts. A receipt is a canonical manifest of
// claim -> source -> retrieval time -> grade plus the hashes the server
// computed at ingest (REQ-110). This module is pure: canonical JSON, hashing,
// input validation, and the offline drift comparison used by the
// `verify_report` action (REQ-060i). It never performs network I/O.
import { createHash } from "node:crypto";
import type {
  ReportReceiptClaim,
  ReportReceiptInput,
  ReportReceiptManifest,
  ReportReceiptSourceInput,
  ReportSourceCheck,
  ReportVerificationResult,
} from "./types.js";

/** Bounds for one receipt (REQ-110). Oversize is rejected, never truncated. */
export const RECEIPT_LIMITS = {
  claims: 100,
  sourcesPerClaim: 25,
  claimChars: 2000,
  urlChars: 2048,
  snippetChars: 2000,
} as const;

export type ReceiptInputError =
  | { code: "invalid_input"; message: string }
  | { code: "receipt_requires_kb"; message: string };

export function sha256Hex(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

/**
 * Canonical JSON: object keys sorted at every level, array order preserved,
 * no insignificant whitespace. Undefined values are dropped by JSON.stringify.
 */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  const parts: string[] = [];
  for (const key of keys) {
    const item = record[key];
    if (item === undefined) continue;
    parts.push(`${JSON.stringify(key)}:${canonicalJson(item)}`);
  }
  return `{${parts.join(",")}}`;
}

/** `digest_sha256` covers the manifest without itself (REQ-110). */
export function receiptDigest(manifest: Omit<ReportReceiptManifest, "digest_sha256">): string {
  return sha256Hex(canonicalJson(manifest));
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function boundedString(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed === "") return null;
  if (trimmed.length > max) return null;
  return trimmed;
}

function normalizeSource(raw: unknown): ReportReceiptSourceInput | null {
  if (!isPlainObject(raw)) return null;
  const url = boundedString(raw["url"], RECEIPT_LIMITS.urlChars);
  if (url === null) return null;
  const title = typeof raw["title"] === "string" ? raw["title"].slice(0, RECEIPT_LIMITS.claimChars) : "";
  const retrievedAt = raw["retrieved_at"];
  // REQ-110: the snippet is hashed when no cached document backs the source,
  // so it is bounded before it reaches the hasher. Oversize is rejected.
  const rawSnippet = raw["snippet"];
  if (typeof rawSnippet === "string" && rawSnippet.length > RECEIPT_LIMITS.snippetChars) return null;
  return {
    url,
    title,
    ...(typeof retrievedAt === "string" && retrievedAt.trim() !== "" ? { retrieved_at: retrievedAt.trim() } : {}),
    ...(typeof rawSnippet === "string" ? { snippet: rawSnippet } : {}),
  };
}

/**
 * Validate a caller-supplied receipt. Only structure is taken from the
 * caller: identity fields and every hash are computed by the server, so any
 * `sha256`, `digest_sha256`, `content_sha256`, or `source_sha256` is ignored.
 */
export function normalizeReceiptInput(
  raw: unknown,
): { ok: true; value: { claims: ReportReceiptInput["claims"] } } | { ok: false; error: ReceiptInputError } {
  if (!isPlainObject(raw)) {
    return { ok: false, error: { code: "invalid_input", message: "receipt must be an object" } };
  }
  const rawClaims = raw["claims"];
  if (!Array.isArray(rawClaims)) {
    return { ok: false, error: { code: "invalid_input", message: "receipt.claims must be an array" } };
  }
  if (rawClaims.length === 0) {
    return { ok: false, error: { code: "invalid_input", message: "receipt.claims must not be empty" } };
  }
  if (rawClaims.length > RECEIPT_LIMITS.claims) {
    return {
      ok: false,
      error: { code: "invalid_input", message: `receipt.claims exceeds ${RECEIPT_LIMITS.claims} entries` },
    };
  }
  const claims: ReportReceiptInput["claims"] = [];
  for (const [index, item] of rawClaims.entries()) {
    if (!isPlainObject(item)) {
      return { ok: false, error: { code: "invalid_input", message: `receipt.claims[${index}] must be an object` } };
    }
    const claim = boundedString(item["claim"], RECEIPT_LIMITS.claimChars);
    if (claim === null) {
      return {
        ok: false,
        error: {
          code: "invalid_input",
          message: `receipt.claims[${index}].claim must be a non-empty string of at most ${RECEIPT_LIMITS.claimChars} characters`,
        },
      };
    }
    const rawSources = item["sources"] ?? [];
    if (!Array.isArray(rawSources)) {
      return { ok: false, error: { code: "invalid_input", message: `receipt.claims[${index}].sources must be an array` } };
    }
    if (rawSources.length > RECEIPT_LIMITS.sourcesPerClaim) {
      return {
        ok: false,
        error: {
          code: "invalid_input",
          message: `receipt.claims[${index}].sources exceeds ${RECEIPT_LIMITS.sourcesPerClaim} entries`,
        },
      };
    }
    const sources: ReportReceiptSourceInput[] = [];
    for (const rawSource of rawSources) {
      const source = normalizeSource(rawSource);
      if (source === null) {
        return {
          ok: false,
          error: {
            code: "invalid_input",
            message: `receipt.claims[${index}].sources entries need a url of at most ${RECEIPT_LIMITS.urlChars} characters and a snippet of at most ${RECEIPT_LIMITS.snippetChars} characters`,
          },
        };
      }
      sources.push(source);
    }
    const grade = typeof item["grade"] === "string" && item["grade"].trim() !== "" ? item["grade"].trim() : undefined;
    claims.push({ claim, ...(grade ? { grade } : {}), sources });
  }
  return { ok: true, value: { claims } };
}

/**
 * Build the server-owned canonical manifest. The report identity and content
 * hash come from the stored document; per-source hashes come from the cached
 * document when present, otherwise from the caller's snippet.
 */
export function buildReceiptManifest(args: {
  reportId: string;
  contentSha256: string;
  claims: ReportReceiptInput["claims"];
  cachedDocument: (url: string) => { text: string; title: string } | null;
}): ReportReceiptManifest {
  const claims: ReportReceiptClaim[] = args.claims.map((claim) => ({
    claim: claim.claim,
    ...(claim.grade ? { grade: claim.grade } : {}),
    sources: claim.sources.map((source) => {
      const cached = args.cachedDocument(source.url);
      const basis = cached !== null ? ("document" as const) : ("snippet" as const);
      const hashed = cached !== null ? cached.text : source.snippet ?? "";
      const retrievedAt = source.retrieved_at ?? (cached !== null ? new Date().toISOString() : undefined);
      return {
        url: source.url,
        title: cached?.title ?? source.title ?? "",
        ...(retrievedAt ? { retrieved_at: retrievedAt } : {}),
        hash_basis: basis,
        source_sha256: sha256Hex(hashed),
      };
    }),
  }));
  const manifest: Omit<ReportReceiptManifest, "digest_sha256"> = {
    version: 1,
    report_id: args.reportId,
    content_sha256: args.contentSha256,
    claims,
  };
  return { ...manifest, digest_sha256: receiptDigest(manifest) };
}

/**
 * Offline verification (REQ-060i). Recompute the digest over the stored
 * manifest and compare the stored report/source hashes against the current
 * cached content. Snippet-basis sources are `unverifiable`, never `drift`,
 * and absence from the cache is likewise `unverifiable`.
 */
export function verifyReceipt(args: {
  manifest: ReportReceiptManifest;
  reportText: string | null;
  cachedDocument: (url: string) => string | null;
}): ReportVerificationResult {
  const { manifest } = args;
  const { digest_sha256: storedDigest, ...rest } = manifest;
  const digestMatch = receiptDigest(rest) === storedDigest;

  const reportState: ReportVerificationResult["report"] = args.reportText === null
    ? "unverifiable"
    : sha256Hex(args.reportText) === manifest.content_sha256
      ? "verified"
      : "drift";

  const drifts: ReportSourceCheck[] = [];
  let sourcesVerified = 0;
  let sourcesUnverifiable = 0;
  let sourcesDrift = 0;
  for (const [claimIndex, claim] of manifest.claims.entries()) {
    for (const source of claim.sources) {
      if (source.hash_basis !== "document") {
        sourcesUnverifiable++;
        drifts.push({
          claim_index: claimIndex,
          url: source.url,
          state: "unverifiable",
          hash_basis: source.hash_basis,
        });
        continue;
      }
      const current = args.cachedDocument(source.url);
      if (current === null) {
        sourcesUnverifiable++;
        drifts.push({ claim_index: claimIndex, url: source.url, state: "unverifiable", hash_basis: source.hash_basis });
      } else if (sha256Hex(current) === source.source_sha256) {
        sourcesVerified++;
      } else {
        sourcesDrift++;
        drifts.push({ claim_index: claimIndex, url: source.url, state: "drift", hash_basis: source.hash_basis });
      }
    }
  }

  let state: ReportVerificationResult["state"];
  if (!digestMatch) state = "incomplete";
  else if (reportState === "drift" || sourcesDrift > 0) state = "drift";
  else if (reportState === "unverifiable" || sourcesUnverifiable > 0) state = "unverifiable";
  else state = "verified";

  return {
    state,
    digest_match: digestMatch,
    digest_sha256: storedDigest,
    report: reportState,
    report_id: manifest.report_id,
    content_sha256: manifest.content_sha256,
    claims: manifest.claims.length,
    sources: {
      total: sourcesVerified + sourcesUnverifiable + sourcesDrift,
      verified: sourcesVerified,
      drift: sourcesDrift,
      unverifiable: sourcesUnverifiable,
      details: drifts,
    },
  };
}
