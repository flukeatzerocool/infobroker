// @implements REQ-033 REQ-034 REQ-100
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { writeFileSync, mkdtempSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadQuotaState, getOrCreateCounter, checkQuota } from "./quota.js";
import { startStubProvider, writeHermeticConfig } from "./lib/stub-provider.js";
import { startMcpServer } from "./lib/mcp-stdio.js";

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

  // REQ-100: the same rule as the key-pool store — a foreign-owned directory is
  // refused on the read path, and the refusal is distinguishable from corrupt
  // state because the same file is read once the owner is restored.
  it("refuses to read state from a directory it does not own (REQ-100)", () => {
    const future = "2099-01-01T00:00:00.000Z";
    writeFileSync(quotaFile, JSON.stringify({
      providers: {
        owned: {
          daily: { count: 7, resetAt: future },
          monthly: { count: 0, resetAt: future },
        },
      },
    }));
    const uid = typeof process.getuid === "function" ? process.getuid() : 1000;
    const spy = vi.spyOn(process, "getuid").mockReturnValue((uid + 1) >>> 0);
    try {
      loadQuotaState();
      expect(checkQuota("owned", { per_day: 100 }).daily.used).toBe(0);
    } finally {
      spy.mockRestore();
    }
    loadQuotaState();
    expect(checkQuota("owned", { per_day: 100 }).daily.used).toBe(7);
  });
});

// REQ-033: the reset is exact. A counter whose window has just passed resets,
// and one whose window is still open is preserved — no undocumented grace.
describe("quota reset boundary (REQ-033)", () => {
  function seed(count: number, dailyResetAt: string, monthlyResetAt = "2099-01-01T00:00:00.000Z"): void {
    writeFileSync(quotaFile, JSON.stringify({
      providers: {
        boundary: {
          daily: { count, resetAt: dailyResetAt },
          monthly: { count, resetAt: monthlyResetAt },
        },
      },
    }));
    loadQuotaState();
  }

  it("resets a daily counter one second past its resetAt", () => {
    seed(42, new Date(Date.now() - 1_000).toISOString());
    expect(checkQuota("boundary", { per_day: 100 }).daily.used).toBe(0);
  });

  it("preserves a daily counter that has not reached its resetAt", () => {
    seed(42, new Date(Date.now() + 60_000).toISOString());
    expect(checkQuota("boundary", { per_day: 100 }).daily.used).toBe(42);
  });

  it("resets a monthly counter one second past its resetAt", () => {
    seed(42, "2099-01-01T00:00:00.000Z", new Date(Date.now() - 1_000).toISOString());
    expect(checkQuota("boundary", { per_month: 100 }).monthly.used).toBe(0);
  });

  it("preserves a monthly counter that has not reached its resetAt", () => {
    seed(42, "2099-01-01T00:00:00.000Z", new Date(Date.now() + 60_000).toISOString());
    expect(checkQuota("boundary", { per_month: 100 }).monthly.used).toBe(42);
  });
});

// REQ-034: 80% is the warning boundary and 100% is exhaustion.
describe("quota warning and exhaustion boundaries (REQ-034)", () => {
  function seed(count: number): void {
    const future = new Date(Date.now() + 3_600_000).toISOString();
    writeFileSync(quotaFile, JSON.stringify({
      providers: {
        threshold: {
          daily: { count, resetAt: future },
          monthly: { count: 0, resetAt: future },
        },
      },
    }));
    loadQuotaState();
  }

  it("does not warn below 80%", () => {
    seed(79);
    const report = checkQuota("threshold", { per_day: 100 });
    expect(report.warning).toBe(false);
    expect(report.exhausted).toBe(false);
  });

  it("warns at exactly 80%", () => {
    seed(80);
    const report = checkQuota("threshold", { per_day: 100 });
    expect(report.warning).toBe(true);
    expect(report.exhausted).toBe(false);
  });

  it("is exhausted at 100%", () => {
    seed(100);
    const report = checkQuota("threshold", { per_day: 100 });
    expect(report.exhausted).toBe(true);
  });
});

// REQ-033: a debounced write must not be lost when the process is stopped with
// a signal. The test drives the real server so the ordinary stop path is what
// is measured.

describe.each(["SIGTERM", "SIGINT"] as const)("quota flush on %s (REQ-033)", (signal) => {
  it("persists a pending increment before the process stops", async () => {
    const stub = await startStubProvider("ok");
    const cfg = writeHermeticConfig(stub.url);
    const quotaPath = join(cfg.root, "quota.json");
    try {
      const server = await startMcpServer({ env: cfg.env, clientName: "quota-signal-test" });
      try {
        const response = await server.call("tools/call", {
          name: "infobroker_search_web",
          arguments: { query: "signal-flush probe" },
        });
        const text = (response.result as { content?: Array<{ text?: string }> } | undefined)?.content?.[0]?.text ?? "";
        expect(text.startsWith("[OK] ")).toBe(true);

        await server.kill(signal);

        const persisted = JSON.parse(readFileSync(quotaPath, "utf-8")) as {
          providers?: Record<string, { daily?: { count?: number } }>;
        };
        const searxng = persisted.providers?.["searxng"];
        expect(searxng?.daily?.count ?? 0).toBeGreaterThan(0);
      } finally {
        await server.stop();
      }
    } finally {
      await stub.close();
      rmSync(cfg.root, { recursive: true, force: true });
    }
  });
});
