// @implements REQ-111a
import { describe, it, expect, vi, afterEach } from "vitest";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
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
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
  dirs = [];
  delete process.env["INFOBROKER_CONFIG"];
  delete process.env["INFOBROKER_CONFIG_LOCAL"];
  vi.restoreAllMocks();
  vi.resetModules();
});

function tmp(): string {
  const dir = mkdtempSync(join(tmpdir(), "ib-call-log-"));
  dirs.push(dir);
  return dir;
}

async function loadLog(output: Partial<Config["output"]>): Promise<typeof import("./call-log.js")> {
  const dir = tmp();
  const cfg: Config = { ...BASE, output: { ...BASE.output, ...output } };
  const configPath = join(dir, "config.json");
  writeFileSync(configPath, JSON.stringify(cfg));
  process.env["INFOBROKER_CONFIG"] = configPath;
  process.env["INFOBROKER_CONFIG_LOCAL"] = join(dir, "config.local.json");
  vi.resetModules();
  return await import("./call-log.js");
}

describe("operational call log (REQ-111a)", () => {
  it("writes one JSON line per record with no query or content", async () => {
    const logPath = join(tmp(), "calls.jsonl");
    const log = await loadLog({ call_log: "file", call_log_path: logPath });

    log.recordTool("infobroker_search_web", true, 12.4);
    log.recordHttp("duckduckgo", false, 3.6, 429);
    log.recordAttempt("duckduckgo", "cooldown", 0);

    const lines = readFileSync(logPath, "utf-8").trim().split("\n").map((line) => JSON.parse(line));
    expect(lines).toHaveLength(3);
    expect(lines[0]).toMatchObject({ kind: "tool", name: "infobroker_search_web", status: "ok", duration_ms: 12 });
    expect(lines[1]).toMatchObject({ kind: "http", name: "duckduckgo", status: "http_error", http_status: 429, duration_ms: 4 });
    expect(lines[2]).toMatchObject({ kind: "provider", name: "duckduckgo", status: "cooldown", duration_ms: 0 });
    for (const line of lines) {
      const keys = Object.keys(line).sort();
      expect(keys.every((key) => ["ts", "kind", "name", "status", "duration_ms", "http_status", "error_code"].includes(key))).toBe(true);
    }
    if (process.platform !== "win32") {
      expect(statSync(logPath).mode & 0o777).toBe(0o600);
    }
  });

  it("sanitizes names so a value cannot inject a newline", async () => {
    const logPath = join(tmp(), "calls.jsonl");
    const log = await loadLog({ call_log: "file", call_log_path: logPath });
    log.recordAttempt("evil\nprovider name", "error", 1, "bad\ncode");
    const [line] = readFileSync(logPath, "utf-8").trim().split("\n");
    const parsed = JSON.parse(line);
    expect(parsed.name).toBe("evil-provider-name");
    expect(parsed.error_code).toBe("bad-code");
    expect(line).not.toContain("\n");
  });

  it("writes to stderr when configured", async () => {
    const log = await loadLog({ call_log: "stderr" });
    const write = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    log.recordTool("infobroker_fetch_page", false, 9);
    expect(write).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(String(write.mock.calls[0]?.[0]).trim());
    expect(payload).toMatchObject({ kind: "tool", name: "infobroker_fetch_page", status: "error" });
  });

  it("writes nothing when disabled", async () => {
    const logPath = join(tmp(), "calls.jsonl");
    const log = await loadLog({ call_log: "off", call_log_path: logPath });
    log.recordTool("infobroker_search_web", true, 1);
    expect(existsSync(logPath)).toBe(false);
  });

  it("rotates at the configured byte bound", async () => {
    const logPath = join(tmp(), "calls.jsonl");
    const log = await loadLog({ call_log: "file", call_log_path: logPath, call_log_max_bytes: 1024 });
    for (let i = 0; i < 20; i++) log.recordTool("infobroker_search_web", true, i);
    expect(existsSync(`${logPath}.1`)).toBe(true);
    // Rotation happens before the next append, so the live file may overshoot
    // the bound by at most one record.
    expect(readFileSync(logPath, "utf-8").length).toBeLessThan(2048);
    expect(readFileSync(`${logPath}.1`, "utf-8").length).toBeGreaterThan(0);
  });

  it("never throws when the log path is unwritable", async () => {
    const dir = tmp();
    const notADir = join(dir, "not-a-dir");
    writeFileSync(notADir, "x");
    const log = await loadLog({ call_log: "file", call_log_path: join(notADir, "calls.jsonl") });
    expect(() => log.recordTool("infobroker_search_web", true, 1)).not.toThrow();
    expect(existsSync(join(notADir, "calls.jsonl"))).toBe(false);
  });
});
