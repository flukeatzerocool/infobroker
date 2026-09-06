// @implements REQ-033 REQ-034 REQ-100
import { chmodSync, mkdirSync, readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { audit } from "./audit-log.js";

interface QuotaCounter {
  daily: { count: number; resetAt: string };
  monthly: { count: number; resetAt: string };
}

interface QuotaState {
  providers: Record<string, QuotaCounter>;
}

const QUOTA_DIR = join(tmpdir(), "infobroker");
const QUOTA_FILE = join(QUOTA_DIR, "quota.json");

let quotaState: QuotaState = { providers: {} };
let writeTimer: ReturnType<typeof setTimeout> | null = null;
const WRITE_INTERVAL_MS = 30_000;

// REQ-100: the state directory is owner-only, and the server refuses to
// operate on a directory it does not own (pre-creation/symlink hardening).
function ensureDir(): void {
  if (!existsSync(QUOTA_DIR)) {
    mkdirSync(QUOTA_DIR, { recursive: true, mode: 0o700 });
  }
  if (typeof process.getuid === "function") {
    const st = statSync(QUOTA_DIR);
    if (st.uid !== process.getuid()) {
      throw new Error(`Refusing to use quota directory "${QUOTA_DIR}" — not owned by this user`);
    }
  }
}

function sanitizeCounter(c: unknown): { count: number; resetAt: string } | null {
  if (!c || typeof c !== "object") return null;
  const cc = c as Record<string, unknown>;
  if (typeof cc.count !== "number" || !Number.isFinite(cc.count) || cc.count < 0) return null;
  if (typeof cc.resetAt !== "string" || Number.isNaN(Date.parse(cc.resetAt))) return null;
  return { count: Math.floor(cc.count), resetAt: cc.resetAt };
}

// REQ-100: parsed state is validated structurally and by numeric bounds before
// use; invalid state is discarded and reset rather than trusted.
function sanitizeQuotaState(raw: unknown): QuotaState {
  const out: QuotaState = { providers: {} };
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  const providers = (raw as Record<string, unknown>).providers;
  if (!providers || typeof providers !== "object" || Array.isArray(providers)) return out;
  for (const [slug, counter] of Object.entries(providers)) {
    if (typeof counter !== "object" || counter === null) continue;
    const c = counter as Record<string, unknown>;
    const daily = sanitizeCounter(c.daily);
    const monthly = sanitizeCounter(c.monthly);
    if (daily && monthly) out.providers[slug] = { daily, monthly };
  }
  return out;
}

function scheduleWrite(): void {
  if (writeTimer) return;
  writeTimer = setTimeout(() => {
    writeTimer = null;
    saveQuotaState();
  }, WRITE_INTERVAL_MS);
}

function flushWrite(): void {
  if (writeTimer) {
    clearTimeout(writeTimer);
    writeTimer = null;
    saveQuotaState();
  }
}

process.on("beforeExit", () => flushWrite());

function getDailyReset(): string {
  const now = new Date();
  const reset = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return reset.toISOString();
}

function getMonthlyReset(): string {
  const now = new Date();
  const reset = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return reset.toISOString();
}

function isExpired(resetAt: string): boolean {
  return new Date(resetAt) < new Date(Date.now() - 30_000);
}

export function loadQuotaState(): void {
  try {
    ensureDir();
  } catch (e) {
    audit("state_dir_refused", e instanceof Error ? e.message : String(e));
    quotaState = { providers: {} };
    return;
  }
  try {
    if (existsSync(QUOTA_FILE)) {
      const raw = readFileSync(QUOTA_FILE, "utf-8");
      const parsed = JSON.parse(raw) as unknown;
      const cleaned = sanitizeQuotaState(parsed);
      if (JSON.stringify(cleaned) !== JSON.stringify(parsed)) {
        audit("quota_state_reset", "persisted quota state failed validation and was reset");
      }
      quotaState = cleaned;
    }
  } catch {
    quotaState = { providers: {} };
  }
}

function saveQuotaState(): void {
  try {
    ensureDir();
    writeFileSync(QUOTA_FILE, JSON.stringify(quotaState, null, 2), { mode: 0o600 });
    try {
      chmodSync(QUOTA_FILE, 0o600);
    } catch {
      // best effort
    }
  } catch (e) {
    audit("quota_state_write_refused", e instanceof Error ? e.message : String(e));
  }
}

export function getOrCreateCounter(slug: string): QuotaCounter {
  let counter = quotaState.providers[slug];
  if (!counter) {
    counter = {
      daily: { count: 0, resetAt: getDailyReset() },
      monthly: { count: 0, resetAt: getMonthlyReset() },
    };
    quotaState.providers[slug] = counter;
  }

  if (isExpired(counter.daily.resetAt)) {
    counter.daily = { count: 0, resetAt: getDailyReset() };
  }
  if (isExpired(counter.monthly.resetAt)) {
    counter.monthly = { count: 0, resetAt: getMonthlyReset() };
  }

  return counter;
}

export interface QuotaReport {
  exhausted: boolean;
  warning: boolean;
  daily: { used: number; remaining: number; resetAt: string };
  monthly: { used: number; remaining: number; resetAt: string };
}

function buildReport(counter: QuotaCounter, limits?: { per_day?: number; per_month?: number }): QuotaReport {
  const dailyCap = limits?.per_day ?? Infinity;
  const monthlyCap = limits?.per_month ?? Infinity;

  const dailyUsed = counter.daily.count;
  const monthlyUsed = counter.monthly.count;

  const dailyPct = dailyUsed / dailyCap;
  const monthlyPct = monthlyUsed / monthlyCap;

  return {
    exhausted: dailyUsed >= dailyCap || monthlyUsed >= monthlyCap,
    warning: dailyPct >= 0.8 || monthlyPct >= 0.8,
    daily: {
      used: dailyUsed,
      remaining: dailyCap < Infinity ? dailyCap - dailyUsed : Infinity,
      resetAt: counter.daily.resetAt,
    },
    monthly: {
      used: monthlyUsed,
      remaining: monthlyCap < Infinity ? monthlyCap - monthlyUsed : Infinity,
      resetAt: counter.monthly.resetAt,
    },
  };
}

export function increment(slug: string, limits?: {
  per_day?: number;
  per_month?: number;
}): QuotaReport {
  const counter = getOrCreateCounter(slug);
  counter.daily.count++;
  counter.monthly.count++;
  scheduleWrite();
  return buildReport(counter, limits);
}

export function checkQuota(
  slug: string,
  limits?: { per_day?: number; per_month?: number }
): QuotaReport {
  const counter = getOrCreateCounter(slug);
  return buildReport(counter, limits);
}

export function getQuotaStatePath(): string {
  return QUOTA_FILE;
}
