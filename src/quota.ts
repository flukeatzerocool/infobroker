// @implements REQ-033 REQ-034
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

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

function ensureDir(): void {
  if (!existsSync(QUOTA_DIR)) {
    mkdirSync(QUOTA_DIR, { recursive: true });
  }
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
  ensureDir();
  try {
    if (existsSync(QUOTA_FILE)) {
      const raw = readFileSync(QUOTA_FILE, "utf-8");
      quotaState = JSON.parse(raw);
    }
  } catch {
    quotaState = { providers: {} };
  }
}

function saveQuotaState(): void {
  ensureDir();
  writeFileSync(QUOTA_FILE, JSON.stringify(quotaState, null, 2));
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

export function getCounter(slug: string): QuotaCounter | undefined {
  return quotaState.providers[slug];
}
