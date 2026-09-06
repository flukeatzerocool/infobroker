// @implements REQ-098
import { describe, it, expect, vi, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { Config } from "./types.js";

const BASE: Config = {
  providers: {},
  dispatch: {},
  corroboration: {
    max_iterations: 5,
    max_http_calls: 30,
    confidence_threshold: 0.8,
    first_pass_max_results: 5,
    first_pass_max_providers: 5,
    similarity_threshold: 0.3,
  },
  output: { max_chars: 50000, latency_window_size: 100, fallback_depth: 3, max_redirect_hops: 5 },
};

let dirs: string[] = [];

afterEach(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
  dirs = [];
  delete process.env["INFOBROKER_CONFIG"];
  vi.resetModules();
});

async function loadAudit(auditLogPath: string): Promise<typeof import("./audit-log.js")> {
  const dir = mkdtempSync(join(tmpdir(), "ib-aud-"));
  dirs.push(dir);
  const cfg: Config = {
    ...BASE,
    output: { ...BASE.output, audit_log_path: auditLogPath },
  };
  const basePath = join(dir, "config.json");
  writeFileSync(basePath, JSON.stringify(cfg));
  process.env["INFOBROKER_CONFIG"] = basePath;
  vi.resetModules();
  return await import("./audit-log.js");
}

describe("audit trail (REQ-098)", () => {
  it("appends a timestamped entry to the configured owner-only file", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ib-aud-log-"));
    dirs.push(dir);
    const logPath = join(dir, "audit.log");
    const m = await loadAudit(logPath);
    m.audit("network_target_refused", "http://10.0.0.1/");
    const text = readFileSync(logPath, "utf-8");
    expect(text).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    expect(text).toContain("network_target_refused http://10.0.0.1/");
    if (process.platform !== "win32") {
      expect(statSync(logPath).mode & 0o777).toBe(0o600);
    }
  });

  it("is append-only across events", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ib-aud-log-"));
    dirs.push(dir);
    const logPath = join(dir, "audit.log");
    const m = await loadAudit(logPath);
    m.audit("config_reload", "success");
    m.audit("key_rekeyed", "/keys/x");
    const lines = readFileSync(logPath, "utf-8").trim().split("\n");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain("key_rekeyed /keys/x");
  });

  it("never blocks the triggering operation when the write fails", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ib-aud-log-"));
    dirs.push(dir);
    // Point the audit path at a location whose parent is a regular file, so
    // mkdir/write must fail.
    const fileAsDir = join(dir, "blocker");
    writeFileSync(fileAsDir, "not a directory");
    const m = await loadAudit(join(fileAsDir, "audit.log"));
    expect(() => m.audit("config_reload", "failed")).not.toThrow();
  });
});