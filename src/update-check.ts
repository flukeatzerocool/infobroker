// @implements REQ-112
// Opt-in update-availability check. Compares the running build version with the
// latest published npm package version. Disabled unless the user opts in; the
// check is bounded, cached, and never downloads, installs, or applies anything.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { atomicWriteFile } from "./lib/atomic-write.js";

const REGISTRY_URL = "https://registry.npmjs.org/infobroker/latest";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
// A transient network failure should not suppress the opt-in check for a day.
const NEGATIVE_TTL_MS = 60 * 60 * 1000;
const MAX_RESPONSE_BYTES = 64 * 1024;

export interface UpdateState {
  status: "disabled" | "pending" | "current" | "available" | "unavailable";
  current_version: string;
  latest_version?: string;
  checked_at?: string;
}

interface CacheFile {
  checked_at: string;
  latest_version: string;
  status: "current" | "available" | "unavailable";
}

let state: UpdateState = { status: "disabled", current_version: "unknown" };

export function defaultUpdateCachePath(): string {
  return join(tmpdir(), "infobroker", "update-check.json");
}

export function getUpdateState(): UpdateState {
  return { ...state };
}

/** Reset module state between tests. */
export function resetUpdateCheckForTest(): void {
  state = { status: "disabled", current_version: "unknown" };
}

function isCacheFile(value: unknown): value is CacheFile {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  if (typeof record["checked_at"] !== "string" || Number.isNaN(Date.parse(record["checked_at"]))) return false;
  if (typeof record["latest_version"] !== "string") return false;
  const status = record["status"];
  if (status !== "current" && status !== "available" && status !== "unavailable") return false;
  if (status !== "unavailable" && record["latest_version"].length === 0) return false;
  return true;
}

function readCache(cachePath: string): CacheFile | null {
  try {
    if (!existsSync(cachePath)) return null;
    const parsed = JSON.parse(readFileSync(cachePath, "utf-8"));
    if (!isCacheFile(parsed)) return null;
    const ttl = parsed.status === "unavailable" ? NEGATIVE_TTL_MS : CACHE_TTL_MS;
    if (Date.now() - Date.parse(parsed.checked_at) > ttl) return null;
    return parsed;
  } catch {
    // A missing or malformed cache is equivalent to no cache.
    return null;
  }
}

function writeCache(cachePath: string, next: CacheFile): void {
  try {
    atomicWriteFile(cachePath, Buffer.from(`${JSON.stringify(next)}\n`, "utf-8"), 0o600);
  } catch {
    // The cache is best-effort; a failed write must not affect the server.
  }
}

/** Compare dotted numeric versions (CalVer) component by component. */
export function compareVersions(a: string, b: string): number {
  const left = a.split(/[^0-9]+/).filter(Boolean).map(Number);
  const right = b.split(/[^0-9]+/).filter(Boolean).map(Number);
  const length = Math.max(left.length, right.length);
  for (let i = 0; i < length; i++) {
    const l = left[i] ?? 0;
    const r = right[i] ?? 0;
    if (l !== r) return l - r;
  }
  return 0;
}

/**
 * Run one check. Never throws: a network, parse, or shape failure becomes
 * `unavailable`, which is informational only.
 */
export async function runUpdateCheck(
  currentVersion: string,
  fetcher: typeof fetch = fetch,
  cachePath: string = defaultUpdateCachePath()
): Promise<UpdateState> {
  const checkedAt = new Date().toISOString();
  try {
    const response = await fetcher(REGISTRY_URL, {
      method: "GET",
      headers: { accept: "application/json" },
      redirect: "error",
      signal: AbortSignal.timeout(2000),
    });
    if (!response.ok) throw new Error(`registry returned ${response.status}`);
    const text = await response.text();
    if (text.length > MAX_RESPONSE_BYTES) throw new Error("registry response too large");
    const parsed = JSON.parse(text) as Record<string, unknown>;
    const latest = parsed["version"];
    if (typeof latest !== "string" || latest.length === 0) throw new Error("registry response has no version");
    const status = compareVersions(latest, currentVersion) > 0 ? "available" : "current";
    state = { status, current_version: currentVersion, latest_version: latest, checked_at: checkedAt };
    writeCache(cachePath, { checked_at: checkedAt, latest_version: latest, status });
    return { ...state };
  } catch {
    state = { status: "unavailable", current_version: currentVersion, checked_at: checkedAt };
    writeCache(cachePath, { checked_at: checkedAt, latest_version: "", status: "unavailable" });
    return { ...state };
  }
}

/**
 * REQ-112: configure the check. A fresh cache is used without a request; an
 * enabled check with no fresh cache starts in the background and reports
 * `pending` until it settles. Disabling is immediate and performs no I/O.
 */
export function configureUpdateCheck(
  enabled: boolean,
  currentVersion: string,
  cachePath: string = defaultUpdateCachePath(),
  fetcher: typeof fetch = fetch
): UpdateState {
  if (!enabled) {
    state = { status: "disabled", current_version: currentVersion };
    return { ...state };
  }
  const cached = readCache(cachePath);
  if (cached) {
    state = {
      status: cached.status === "unavailable" ? "unavailable" : cached.status,
      current_version: currentVersion,
      latest_version: cached.latest_version || undefined,
      checked_at: cached.checked_at,
    };
    return { ...state };
  }
  state = { status: "pending", current_version: currentVersion };
  void runUpdateCheck(currentVersion, fetcher, cachePath);
  return { ...state };
}
