// @implements REQ-111a
// Operational call log: one sanitized JSON line per tool invocation, outbound
// HTTP request, or provider attempt. Records carry no query, URL, snippet, or
// credential — only a sanitized name, an outcome, and elapsed time — so the
// log is safe to leave on by default and safe to share when diagnosing a
// session. A write failure never fails the triggering operation.
import { appendFileSync, chmodSync, existsSync, mkdirSync, renameSync, rmSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { getConfig } from "./config.js";

export type CallLogMode = "off" | "stderr" | "file";

export interface CallLogTarget {
  mode: CallLogMode;
  path?: string;
}

type Outcome = "ok" | "empty" | "error" | "cooldown" | "quota" | "parse_error" | "http_error" | "network_error";

// REQ-111a: owner-readable is a property of the file, not only of the process
// that created it. A path is tightened once per process, so a log left behind
// with a loose mode is fixed on the next write without a chmod per record.
const permissionsChecked = new Set<string>();

function expandHome(path: string): string {
  return path.startsWith("~/") ? join(homedir(), path.slice(2)) : path;
}

/** The configured sink. A partial config object disables logging. */
export function callLogTarget(): CallLogTarget {
  try {
    const output = getConfig().output;
    const mode = output?.call_log ?? "off";
    if (mode === "off") return { mode: "off" };
    const path = expandHome(output?.call_log_path ?? "~/.local/share/infobroker/call-log.jsonl");
    return { mode, path };
  } catch {
    // A broken configuration must not break logging or the caller.
    return { mode: "off" };
  }
}

function sanitize(value: string): string {
  const cleaned = value.toLowerCase().replace(/[^a-z0-9_.-]+/g, "-").replace(/^-+|-+$/g, "");
  return cleaned.slice(0, 64) || "unknown";
}

function rotateIfNeeded(path: string, maxBytes: number): void {
  try {
    if (!existsSync(path) || statSync(path).size < maxBytes) return;
    rmSync(`${path}.1`, { force: true });
    renameSync(path, `${path}.1`);
  } catch {
    // Rotation is best-effort; the existing file keeps growing rather than
    // breaking the tool call.
  }
}

function writeRecord(record: Record<string, unknown>): void {
  try {
    const target = callLogTarget();
    if (target.mode === "off" || !target.path) return;
    const line = `${JSON.stringify(record)}\n`;
    if (target.mode === "stderr") {
      process.stderr.write(line);
      return;
    }
    const output = getConfig().output;
    const maxBytes = output?.call_log_max_bytes ?? 2_000_000;
    const dir = dirname(target.path);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o700 });
    rotateIfNeeded(target.path, maxBytes);
    if (!existsSync(target.path)) {
      appendFileSync(target.path, "", { mode: 0o600 });
    }
    if (!permissionsChecked.has(target.path)) {
      try {
        chmodSync(target.path, 0o600);
        permissionsChecked.add(target.path);
      } catch {
        // Best effort: a non-owner-readable log is not a blocker.
      }
    }
    appendFileSync(target.path, line);
  } catch {
    // REQ-111a: a logging failure must not fail the triggering operation.
  }
}

export function recordTool(tool: string, ok: boolean, durationMs: number): void {
  writeRecord({
    ts: new Date().toISOString(),
    kind: "tool",
    name: sanitize(tool),
    status: ok ? "ok" : "error",
    duration_ms: Math.max(0, Math.round(durationMs)),
  });
}

export function recordHttp(provider: string, ok: boolean, durationMs: number, httpStatus?: number): void {
  writeRecord({
    ts: new Date().toISOString(),
    kind: "http",
    name: sanitize(provider),
    status: ok ? "ok" : "http_error",
    duration_ms: Math.max(0, Math.round(durationMs)),
    ...(httpStatus !== undefined ? { http_status: httpStatus } : {}),
  });
}

export function recordAttempt(provider: string, outcome: Outcome, durationMs = 0, errorCode?: string): void {
  writeRecord({
    ts: new Date().toISOString(),
    kind: "provider",
    name: sanitize(provider),
    status: outcome,
    duration_ms: Math.max(0, Math.round(durationMs)),
    ...(errorCode ? { error_code: sanitize(errorCode) } : {}),
  });
}
