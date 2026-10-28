// @implements REQ-033 REQ-100
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadQuotaState, getOrCreateCounter, checkQuota } from "./quota.js";

// Quota state is resolved lazily, so the test seam can be set before the first
// load. Each run gets its own directory: the suite never reads or writes the
// real user quota file at $TMPDIR/infobroker/quota.json.
let stateDir: string;
let quotaFile: string;

beforeAll(() => {
  stateDir = mkdtempSync(join(tmpdir(), "ib-quota-"));
  quotaFile = join(stateDir, "quota.json");
  process.env["INFOBROKER_QUOTA_STATE"] = quotaFile;
});

afterAll(() => {
  rmSync(stateDir, { recursive: true, force: true });
  delete process.env["INFOBROKER_QUOTA_STATE"];
});

describe("quota state hardening (REQ-100)", () => {
  it("resets poisoned state instead of trusting negative or NaN counts", () => {
    writeFileSync(quotaFile, JSON.stringify({
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
  });

  it("drops counters with malformed structure", () => {
    writeFileSync(quotaFile, JSON.stringify({
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
    writeFileSync(quotaFile, JSON.stringify({
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
