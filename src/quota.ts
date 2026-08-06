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

function ensureDir(): void {
  if (!existsSync(QUOTA_DIR)) {
    mkdirSync(QUOTA_DIR, { recursive: true });
  }
}

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
  return new Date(resetAt) <= new Date();
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
  used: number;
  remaining?: number;
  resetAt?: string;
  warning: boolean;
  exhausted: boolean;
}

export function increment(slug: string, limits?: {
  per_day?: number;
  per_month?: number;
}): QuotaReport {
  const counter = getOrCreateCounter(slug);
  counter.daily.count++;
  counter.monthly.count++;

  const dailyCap = limits?.per_day ?? Infinity;
  const monthlyCap = limits?.per_month ?? Infinity;

  const dailyUsed = counter.daily.count;
  const monthlyUsed = counter.monthly.count;

  const dailyPct = dailyUsed / dailyCap;
  const monthlyPct = monthlyUsed / monthlyCap;

  const exhausted = dailyUsed >= dailyCap || monthlyUsed >= monthlyCap;
  const warning = dailyPct >= 0.8 || monthlyPct >= 0.8;

  saveQuotaState();

  return {
    used: Math.max(dailyUsed, monthlyUsed),
    remaining: dailyCap < Infinity ? dailyCap - dailyUsed : undefined,
    resetAt: counter.daily.resetAt,
    warning,
    exhausted,
  };
}

export function checkQuota(
  slug: string,
  limits?: { per_day?: number; per_month?: number }
): QuotaReport {
  const counter = getOrCreateCounter(slug);
  const dailyCap = limits?.per_day ?? Infinity;
  const monthlyCap = limits?.per_month ?? Infinity;

  const dailyUsed = counter.daily.count;
  const monthlyUsed = counter.monthly.count;

  const dailyPct = dailyUsed / dailyCap;
  const monthlyPct = monthlyUsed / monthlyCap;

  const exhausted = dailyUsed >= dailyCap || monthlyUsed >= monthlyCap;
  const warning = dailyPct >= 0.8 || monthlyPct >= 0.8;

  return {
    used: Math.max(dailyUsed, monthlyUsed),
    remaining: dailyCap < Infinity ? dailyCap - dailyUsed : undefined,
    resetAt: counter.daily.resetAt,
    warning,
    exhausted,
  };
}

export function getQuotaStatePath(): string {
  return QUOTA_FILE;
}

export function getCounter(slug: string): QuotaCounter | undefined {
  return quotaState.providers[slug];
}
