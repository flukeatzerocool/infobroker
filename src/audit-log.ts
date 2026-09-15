// @implements REQ-098
// Persistent audit trail for security-relevant events (REQ-098): refused
// network targets, content-policy flags, config reloads, KB encryption
// transitions, key-material operations, and quota exhaustion. Owner-only,
// append-only, and never a dependency of the triggering operation.
import { appendFileSync, chmodSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { homedir } from "node:os";
import { getConfig } from "./config.js";

function auditPath(): string {
  const configured = getConfig().output?.audit_log_path;
  if (configured) {
    return configured.startsWith("~/") ? `${homedir()}${configured.slice(1)}` : configured;
  }
  return `${homedir()}/.local/share/infobroker/audit.log`;
}

/**
 * REQ-098: one audit entry is one line. Strip CR/LF and other control
 * characters from the detail so untrusted text (for example a refused URL)
 * cannot inject additional, forged entries into the append-only trail.
 */
function sanitizeDetail(detail: string): string {
  return detail.replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]+/g, " ");
}

/**
 * Record one audit entry: an ISO timestamp, an event kind, and a short
 * detail string. Never pass secrets or full retrieved content here — the
 * detail field is meant for URLs, slugs, and counts. Failures are swallowed
 * so the triggering operation proceeds per REQ-098.
 */
export function audit(event: string, detail: string): void {
  try {
    const path = auditPath();
    const dir = dirname(path);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o700 });
    if (!existsSync(path)) {
      appendFileSync(path, "", { mode: 0o600 });
      try {
        chmodSync(path, 0o600);
      } catch {
        // best effort — a non-owner-readable audit file is not a blocker
      }
    }
    appendFileSync(path, `${new Date().toISOString()} ${event} ${sanitizeDetail(detail)}\n`);
  } catch {
    // REQ-098: audit failure must not break the triggering operation.
  }
}