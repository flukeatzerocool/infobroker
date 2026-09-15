// @implements REQ-104
// Persistent credential-pool rotation for keyed providers. A provider may be
// given an ordered pool of credentials through the environment
// (`INFOBROKER_<PROVIDER>_API_KEYS`, comma/whitespace separated) as well as the
// single-key variable of REQ-011. Each call takes the next available key;
// rejected keys are disabled for the session and rate-limited keys cool down
// individually. Selection state persists across restarts, keyed by a hash so
// no credential material is ever written to disk or surfaced.
import { randomBytes } from "node:crypto";
import {
  readFileSync,
  writeSync,
  existsSync,
  mkdirSync,
  chmodSync,
  statSync,
  renameSync,
  openSync,
  closeSync,
  fsyncSync,
} from "node:fs";
import { join, dirname, basename } from "node:path";
import { tmpdir } from "node:os";
import { audit } from "./audit-log.js";

interface KeyState {
  disabled?: boolean;
  cooldownUntil?: number;
}

interface PoolState {
  cursor: number;
  keys: Record<string, KeyState>;
}

export const DEFAULT_KEY_COOLDOWN_MS = 30_000;

let state: PoolState | null = null;
let statePath: string | null = null;

function resolveStatePath(): string {
  if (!statePath) {
    statePath = process.env["INFOBROKER_KEYPOOL_STATE"] || join(tmpdir(), "infobroker", "key-pool.json");
  }
  return statePath;
}

// REQ-100: the state directory is owner-only, and the server refuses to
// operate on a directory it does not own (mirrors quota.ts).
function ensureStateDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true, mode: 0o700 });
  } else {
    try {
      chmodSync(dir, 0o700);
    } catch {
      // best effort — a pre-existing directory may be owned by another user
    }
  }
  if (typeof process.getuid === "function") {
    const st = statSync(dir);
    if (st.uid !== process.getuid()) {
      throw new Error(`Refusing to use key-pool state directory "${dir}" — not owned by this user`);
    }
  }
}

// REQ-100: parsed state is validated structurally and by numeric bounds before
// use; invalid state is discarded and reset rather than trusted.
function sanitizePoolState(raw: unknown): PoolState {
  const out: PoolState = { cursor: 0, keys: {} };
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  const r = raw as Record<string, unknown>;
  if (typeof r.cursor === "number" && Number.isInteger(r.cursor) && r.cursor >= 0) {
    out.cursor = r.cursor;
  }
  const keys = r.keys;
  if (keys && typeof keys === "object" && !Array.isArray(keys)) {
    for (const [id, value] of Object.entries(keys as Record<string, unknown>)) {
      if (!value || typeof value !== "object" || Array.isArray(value)) continue;
      const v = value as Record<string, unknown>;
      const entry: KeyState = {};
      if (v.disabled === true) entry.disabled = true;
      if (typeof v.cooldownUntil === "number" && Number.isFinite(v.cooldownUntil)) {
        entry.cooldownUntil = v.cooldownUntil;
      }
      if (Object.keys(entry).length > 0) out.keys[id] = entry;
    }
  }
  return out;
}

function loadState(): PoolState {
  if (state) return state;
  try {
    const raw = JSON.parse(readFileSync(resolveStatePath(), "utf-8")) as unknown;
    const cleaned = sanitizePoolState(raw);
    if (JSON.stringify(cleaned) !== JSON.stringify(raw)) {
      audit("key_pool_state_reset", "persisted key-pool state failed validation and was reset");
    }
    state = cleaned;
  } catch {
    state = { cursor: 0, keys: {} };
  }
  return state;
}

function saveState(): void {
  if (!state) return;
  const p = resolveStatePath();
  try {
    const dir = dirname(p);
    ensureStateDir(dir);
    const tmp = join(dir, `.${basename(p)}.tmp-${randomBytes(6).toString("hex")}`);
    const fd = openSync(tmp, "w", 0o600);
    try {
      writeSync(fd, JSON.stringify(state));
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    renameSync(tmp, p);
  } catch (e) {
    // Persistence is best-effort; rotation still works in memory. A refusal to
    // use the state directory is recorded so the operator can see it.
    audit("key_pool_state_write_refused", e instanceof Error ? e.message : String(e));
  }
}

// A stable, non-reversible identifier for a credential, so persisted state
// never contains key material (REQ-011, REQ-104).
function keyId(key: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}

function scopedId(slug: string, key: string): string {
  return keyId(`${slug}:${key}`);
}

export function envNames(slug: string): { many: string; single: string } {
  const upper = slug.toUpperCase();
  return { many: `INFOBROKER_${upper}_API_KEYS`, single: `INFOBROKER_${upper}_API_KEY` };
}

export function poolKeys(slug: string): string[] {
  const { many, single } = envNames(slug);
  const multi = (process.env[many] ?? "")
    .split(/[\s,]+/)
    .map((k) => k.trim())
    .filter((k) => k.length > 0);
  if (multi.length > 0) return multi;
  const one = process.env[single];
  return one && one.length > 0 ? [one] : [];
}

function available(id: string, now: number): boolean {
  const s = state!.keys[id];
  if (!s) return true;
  if (s.disabled) return false;
  if (s.cooldownUntil && s.cooldownUntil > now) return false;
  return true;
}

// Next usable credential in round-robin order, or undefined when the pool is
// empty or every credential is disabled/cooling down. A single-key provider
// behaves exactly as before.
export function resolveApiKey(slug: string, now: number = Date.now()): string | undefined {
  const keys = poolKeys(slug);
  if (keys.length === 0) return undefined;
  const s = loadState();
  for (let offset = 0; offset < keys.length; offset++) {
    const idx = (s.cursor + offset) % keys.length;
    const id = scopedId(slug, keys[idx]);
    if (available(id, now)) {
      s.cursor = (idx + 1) % keys.length;
      saveState();
      return keys[idx];
    }
  }
  return undefined;
}

export function markKeyRejected(slug: string, key: string): void {
  const s = loadState();
  s.keys[scopedId(slug, key)] = { ...s.keys[scopedId(slug, key)], disabled: true };
  saveState();
}

export function markKeyRateLimited(slug: string, key: string, durationMs: number = DEFAULT_KEY_COOLDOWN_MS): void {
  if (durationMs <= 0) return;
  const s = loadState();
  s.keys[scopedId(slug, key)] = { ...s.keys[scopedId(slug, key)], cooldownUntil: Date.now() + durationMs };
  saveState();
}

// Apply a provider response status to the pool: 401/403 disables the key for
// the session, 429 cools it down. Other statuses are left to the retry policy.
export function noteAuthStatus(slug: string, key: string, status: number, cooldownMs: number = DEFAULT_KEY_COOLDOWN_MS): void {
  if (status === 401 || status === 403) markKeyRejected(slug, key);
  else if (status === 429) markKeyRateLimited(slug, key, cooldownMs);
}

export function keyPoolStatus(slug: string, now: number = Date.now()): Array<{ index: number; available: boolean; reason?: string }> {
  const keys = poolKeys(slug);
  if (keys.length === 0) return [];
  const s = loadState();
  return keys.map((key, index) => {
    const st = s.keys[scopedId(slug, key)];
    if (!st) return { index, available: true };
    if (st.disabled) return { index, available: false, reason: "rejected" };
    if (st.cooldownUntil && st.cooldownUntil > now) {
      return { index, available: false, reason: "cooldown", };
    }
    return { index, available: true };
  });
}

// Test/ops helper: drop in-memory state (does not touch the persisted file).
export function resetKeyPoolStateForTests(): void {
  state = { cursor: 0, keys: {} };
  statePath = null;
}
