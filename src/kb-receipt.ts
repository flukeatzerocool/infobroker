// @implements REQ-110 REQ-060i REQ-060b REQ-114 REQ-083
// Report verification receipts. A receipt is a canonical manifest of
// claim -> source -> retrieval time -> grade plus the hashes the server
// computed at ingest (REQ-110). This module is pure: canonical JSON, hashing,
// input validation, and the offline drift comparison used by the
// `verify_report` action (REQ-060i). It never performs network I/O.
import { createHash } from "node:crypto";
import type {
  ReportManifestMeta,
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
  reportSources: 100,
  claimChars: 2000,
  urlChars: 2048,
  snippetChars: 2000,
  metaLabelChars: 120,
  metaTextChars: 2000,
  metaListItems: 20,
  metaListItemChars: 500,
  revisionMax: 1_000_000,
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

function normalizeMeta(raw: unknown): { ok: true; value?: ReportManifestMeta } | { ok: false } {
  if (raw === undefined) return { ok: true };
  if (!isPlainObject(raw)) return { ok: false };
  const label = (key: string): string | undefined => {
    const value = raw[key];
    if (value === undefined) return undefined;
    if (typeof value !== "string") return undefined;
    const trimmed = value.trim();
    return trimmed === "" ? undefined : trimmed.slice(0, RECEIPT_LIMITS.metaLabelChars);
  };
  const text = (key: string): string | undefined => {
    const value = raw[key];
    if (value === undefined) return undefined;
    if (typeof value !== "string") return undefined;
    const trimmed = value.trim();
    return trimmed === "" ? undefined : trimmed.slice(0, RECEIPT_LIMITS.metaTextChars);
  };
  const list = (key: string): string[] | undefined => {
    const value = raw[key];
    if (value === undefined) return undefined;
    if (!Array.isArray(value)) return undefined;
    const items = value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter((item) => item !== "")
      .slice(0, RECEIPT_LIMITS.metaListItems)
      .map((item) => item.slice(0, RECEIPT_LIMITS.metaListItemChars));
    return items.length > 0 ? items : undefined;
  };
  const revisionRaw = raw["revision"];
  let revision: number | undefined;
  if (revisionRaw !== undefined) {
    if (typeof revisionRaw !== "number" || !Number.isInteger(revisionRaw) || revisionRaw < 1 || revisionRaw > RECEIPT_LIMITS.revisionMax) {
      return { ok: false };
    }
    revision = revisionRaw;
  }
  const meta: ReportManifestMeta = {
    ...(label("shape") ? { shape: label("shape") } : {}),
    ...(label("audience") ? { audience: label("audience") } : {}),
    ...(text("methodology") ? { methodology: text("methodology") } : {}),
    ...(list("assumptions") ? { assumptions: list("assumptions") } : {}),
    ...(list("alternatives") ? { alternatives: list("alternatives") } : {}),
    ...(list("gaps") ? { gaps: list("gaps") } : {}),
    ...(label("supersedes") ? { supersedes: label("supersedes") } : {}),
    ...(revision !== undefined ? { revision } : {}),
  };
  return { ok: true, ...(Object.keys(meta).length > 0 ? { value: meta } : {}) };
}

/**
 * Validate a caller-supplied receipt. Only structure is taken from the
 * caller: identity fields and every hash are computed by the server, so any
 * `sha256`, `digest_sha256`, `content_sha256`, or `source_sha256` is ignored.
 */
export function normalizeReceiptInput(
  raw: unknown,
): { ok: true; value: { claims: ReportReceiptInput["claims"]; sources?: ReportReceiptSourceInput[]; report?: ReportManifestMeta } } | { ok: false; error: ReceiptInputError } {
  if (!isPlainObject(raw)) {
    return { ok: false, error: { code: "invalid_input", message: "receipt must be an object" } };
  }
  const reportResult = normalizeMeta(raw["report"]);
  if (!reportResult.ok) {
    return {
      ok: false,
      error: { code: "invalid_input", message: "receipt.report must be an object with bounded string and list fields" },
    };
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
    const verdict = typeof item["verdict"] === "string" && item["verdict"].trim() !== "" ? item["verdict"].trim().slice(0, RECEIPT_LIMITS.metaLabelChars) : undefined;
    const likelihood = typeof item["likelihood"] === "string" && item["likelihood"].trim() !== "" ? item["likelihood"].trim().slice(0, RECEIPT_LIMITS.metaLabelChars) : undefined;
    const rawConfidence = item["confidence"];
    if (rawConfidence !== undefined && rawConfidence !== "High" && rawConfidence !== "Medium" && rawConfidence !== "Low") {
      return {
        ok: false,
        error: { code: "invalid_input", message: `receipt.claims[${index}].confidence must be High, Medium, or Low` },
      };
    }
    claims.push({
      claim,
      ...(grade ? { grade } : {}),
      ...(verdict ? { verdict } : {}),
      ...(rawConfidence ? { confidence: rawConfidence } : {}),
      ...(likelihood ? { likelihood } : {}),
      sources,
    });
  }
  // REQ-110: report-level sources (the Source Register) are optional and
  // bounded separately from per-claim source edges.
  const rawReportSources = raw["sources"];
  let reportSources: ReportReceiptSourceInput[] | undefined;
  if (rawReportSources !== undefined) {
    if (!Array.isArray(rawReportSources)) {
      return { ok: false, error: { code: "invalid_input", message: "receipt.sources must be an array" } };
    }
    if (rawReportSources.length > RECEIPT_LIMITS.reportSources) {
      return {
        ok: false,
        error: { code: "invalid_input", message: `receipt.sources exceeds ${RECEIPT_LIMITS.reportSources} entries` },
      };
    }
    const normalized: ReportReceiptSourceInput[] = [];
    for (const rawSource of rawReportSources) {
      const source = normalizeSource(rawSource);
      if (source === null) {
        return {
          ok: false,
          error: {
            code: "invalid_input",
            message: `receipt.sources entries need a url of at most ${RECEIPT_LIMITS.urlChars} characters and a snippet of at most ${RECEIPT_LIMITS.snippetChars} characters`,
          },
        };
      }
      normalized.push(source);
    }
    if (normalized.length > 0) reportSources = normalized;
  }
  return {
    ok: true,
    value: {
      claims,
      ...(reportSources ? { sources: reportSources } : {}),
      ...(reportResult.value ? { report: reportResult.value } : {}),
    },
  };
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
  sources?: ReportReceiptSourceInput[];
  report?: ReportManifestMeta;
  cachedDocument: (url: string) => { text: string; title: string } | null;
}): ReportReceiptManifest {
  const hashSource = (source: ReportReceiptSourceInput): ReportReceiptClaim["sources"][number] => {
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
  };
  const claims: ReportReceiptClaim[] = args.claims.map((claim) => ({
    claim: claim.claim,
    ...(claim.grade ? { grade: claim.grade } : {}),
    ...(claim.verdict ? { verdict: claim.verdict } : {}),
    ...(claim.confidence ? { confidence: claim.confidence } : {}),
    ...(claim.likelihood ? { likelihood: claim.likelihood } : {}),
    sources: claim.sources.map(hashSource),
  }));
  // REQ-110: the report links to the deduplicated union of its own sources and
  // every claim's sources. Sort by URL so the digest is deterministic.
  const linked = new Map<string, ReportReceiptClaim["sources"][number]>();
  for (const claim of claims) {
    for (const source of claim.sources) {
      if (!linked.has(source.url)) linked.set(source.url, source);
    }
  }
  for (const source of args.sources ?? []) {
    if (!linked.has(source.url)) linked.set(source.url, hashSource(source));
  }
  const sources = [...linked.values()].sort((a, b) => a.url.localeCompare(b.url));
  const manifest: Omit<ReportReceiptManifest, "digest_sha256"> = {
    version: 1,
    report_id: args.reportId,
    content_sha256: args.contentSha256,
    ...(args.report ? { report: args.report } : {}),
    ...(sources.length > 0 ? { sources } : {}),
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

  // REQ-060i: the report's linked sources are verified separately from the
  // per-claim source edges so `sources` keeps its established meaning.
  let reportSourcesVerified = 0;
  let reportSourcesUnverifiable = 0;
  let reportSourcesDrift = 0;
  for (const source of manifest.sources ?? []) {
    if (source.hash_basis !== "document") {
      reportSourcesUnverifiable++;
      continue;
    }
    const current = args.cachedDocument(source.url);
    if (current === null) reportSourcesUnverifiable++;
    else if (sha256Hex(current) === source.source_sha256) reportSourcesVerified++;
    else reportSourcesDrift++;
  }

  let state: ReportVerificationResult["state"];
  if (!digestMatch) state = "incomplete";
  else if (reportState === "drift" || sourcesDrift > 0 || reportSourcesDrift > 0) state = "drift";
  else if (reportState === "unverifiable" || sourcesUnverifiable > 0 || reportSourcesUnverifiable > 0) state = "unverifiable";
  else state = "verified";

  return {
    state,
    digest_match: digestMatch,
    digest_sha256: storedDigest,
    report: reportState,
    report_id: manifest.report_id,
    content_sha256: manifest.content_sha256,
    ...(manifest.report ? { report_meta: manifest.report } : {}),
    ...(manifest.report?.revision !== undefined ? { revision: manifest.report.revision } : {}),
    ...(manifest.report?.supersedes ? { supersedes: manifest.report.supersedes } : {}),
    claims: manifest.claims.length,
    sources: {
      total: sourcesVerified + sourcesUnverifiable + sourcesDrift,
      verified: sourcesVerified,
      drift: sourcesDrift,
      unverifiable: sourcesUnverifiable,
      details: drifts,
    },
    ...(manifest.sources
      ? {
          report_sources: {
            total: reportSourcesVerified + reportSourcesUnverifiable + reportSourcesDrift,
            verified: reportSourcesVerified,
            drift: reportSourcesDrift,
            unverifiable: reportSourcesUnverifiable,
          },
        }
      : {}),
  };
}
