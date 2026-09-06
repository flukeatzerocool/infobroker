// @implements REQ-033 REQ-100
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync, writeFileSync, existsSync, rmSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadQuotaState, getOrCreateCounter, checkQuota } from "./quota.js";

const QUOTA_FILE = join(tmpdir(), "infobroker", "quota.json");

let saved: string | null = null;

beforeAll(() => {
  if (existsSync(QUOTA_FILE)) saved = readFileSync(QUOTA_FILE, "utf-8");
});

afterAll(() => {
  if (saved === null) {
    rmSync(QUOTA_FILE, { force: true });
  } else {
    writeFileSync(QUOTA_FILE, saved);
  }
  loadQuotaState();
});

describe("quota state hardening (REQ-100)", () => {
  it("resets poisoned state instead of trusting negative or NaN counts", () => {
    const dir = mkdtempSync(join(tmpdir(), "ib-quota-"));
    writeFileSync(QUOTA_FILE, JSON.stringify({
      providers: {
        ddg: {
          daily: { count: -5, resetAt: "2099-01-01T00:00:00.000Z" },
          monthly: { count: Number.NaN, resetAt: "2099-01-01T00:00:00.000Z" },
        },
      },
    }));
    loadQuotaState();
    const report = checkQuota("ddg", { per_day: 100 });
    expect(report.daily.used).toBe(0);
    expect(report.daily.remaining).toBe(100);
    rmSync(dir, { recursive: true, force: true });
  });

  it("drops counters with malformed structure", () => {
    writeFileSync(QUOTA_FILE, JSON.stringify({
      providers: {
        broken: { daily: "nope" },
        ok: {
          daily: { count: 3, resetAt: "2099-01-01T00:00:00.000Z" },
          monthly: { count: 4, resetAt: "2099-01-01T00:00:00.000Z" },
        },
      },
    }));
    loadQuotaState();
    expect(checkQuota("broken", { per_day: 100 }).daily.used).toBe(0);
    expect(checkQuota("ok", { per_day: 100 }).daily.used).toBe(3);
  });

  it("preserves valid persisted counters", () => {
    writeFileSync(QUOTA_FILE, JSON.stringify({
      providers: {
        wikipedia: {
          daily: { count: 7, resetAt: "2099-01-01T00:00:00.000Z" },
          monthly: { count: 9, resetAt: "2099-01-01T00:00:00.000Z" },
        },
      },
    }));
    loadQuotaState();
    const c = getOrCreateCounter("wikipedia");
    expect(c.daily.count).toBe(7);
    expect(c.monthly.count).toBe(9);
  });
});