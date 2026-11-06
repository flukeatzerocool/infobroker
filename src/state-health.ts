// @implements REQ-111
// Local state-health assessment and response notices. Everything here is
// computed from already-loaded local state; the only network-dependent input is
// the cached update-check result, which never blocks a response.
import { homedir } from "node:os";
import { getConfig, getStartupConfigIssue, getUserConfigDrift, type StartupConfigIssue } from "./config.js";
import type { ConfigDrift } from "./config-migrations.js";
import {
  getKbEncryptionState,
  isKbConfigured,
  kbSupportsClaims,
  kbSupportsReportReceipts,
} from "./kb.js";
import { getUpdateState, type UpdateState } from "./update-check.js";
import { activeCooldowns } from "./cooldown.js";
import type { ToolNotice } from "./types.js";

const MAX_NOTICES = 5;

export interface StateHealth {
  config: {
    drift: ConfigDrift | null;
    startup_error: StartupConfigIssue | null;
    auto_migrate_config: boolean;
  };
  kb: {
    configured: boolean;
    backend: "sqlite" | null;
    encryption: "enabled" | "disabled" | "locked";
    supports_claims: boolean;
    supports_report_receipts: boolean;
  };
  update: UpdateState;
  notices: ToolNotice[];
}

function scrub(value: string): string {
  let out = value.replace(/[\r\n]+/g, " ").trim();
  const paths = [
    homedir(),
    process.cwd(),
    process.env["INFOBROKER_CONFIG"],
    process.env["INFOBROKER_CONFIG_LOCAL"],
  ].filter((p): p is string => typeof p === "string" && p.length > 1);
  for (const path of paths) out = out.split(path).join("<path>");
  return out;
}

function summarize(items: string[], limit = 3): string {
  if (items.length <= limit) return items.join(", ");
  return `${items.slice(0, limit).join(", ")} (+${items.length - limit} more)`;
}

function collect(bound: number): ToolNotice[] {
  const notices: ToolNotice[] = [];
  const issue = getStartupConfigIssue();
  if (issue) {
    notices.push({
      code: "config_invalid_startup",
      severity: "action_required",
      message: `Running on shipped defaults: ${scrub(issue.message)}`,
      remediation: scrub(issue.remediation),
    });
  }

  const drift = getUserConfigDrift();
  if (drift) {
    if (drift.renames.length > 0 || drift.outdatedVersion) {
      const pieces: string[] = [];
      if (drift.outdatedVersion) pieces.push(`schema v${drift.declaredVersion} → v${drift.currentVersion}`);
      if (drift.renames.length > 0) pieces.push(summarize(drift.renames.map((r) => `${r.from} → ${r.to}`)));
      notices.push({
        code: "config_migration_pending",
        severity: "action_required",
        message: `User config migration pending: ${pieces.join("; ")}.`,
        remediation:
          "Run infobroker_reload_config with migrate: true (backs up config.local.json first), or set state.auto_migrate_config: true.",
      });
    }
    if (drift.deprecated.length > 0) {
      notices.push({
        code: "config_key_deprecated",
        severity: "action_required",
        message: `Deprecated user config key: ${summarize(drift.deprecated.map((d) => `${d.path} → ${d.replacement}`))}.`,
        remediation: "Replace the deprecated key in config.local.json manually; it is not rewritten automatically.",
      });
    }
    if (drift.removals.length > 0) {
      // One notice per obsolete key: dropping the key needs operator action,
      // so this is action_required rather than an informational duplicate.
      notices.push({
        code: "config_key_removed",
        severity: "action_required",
        message: `Obsolete user config key: ${summarize(drift.removals.map((r) => r.path))}.`,
        remediation:
          "Run infobroker_reload_config with migrate: true to drop it; a legacy vector-store.json migrates automatically.",
      });
    }
    if (drift.unrecognized.length > 0) {
      notices.push({
        code: "config_key_unrecognized",
        severity: "action_required",
        message: `Unrecognized user config key(s): ${summarize(drift.unrecognized, 5)}.`,
        remediation: "Remove or correct these top-level keys in config.local.json; they are retained but ignored.",
      });
    }
  }

  const update = getUpdateState();
  if (update.status === "available" && update.latest_version) {
    notices.push({
      code: "update_available",
      severity: "info",
      message: `Infobroker ${update.latest_version} is available (running ${update.current_version}).`,
      remediation: "Update from the source repository or npm, then restart the server. No update is applied automatically.",
    });
  }

  // REQ-111a: cooldowns are informational and follow action-required notices,
  // so a config problem is never crowded out by a transient provider hold-off.
  for (const cooling of activeCooldowns().slice(0, 2)) {
    const seconds = Math.ceil(cooling.remaining_ms / 1000);
    notices.push({
      code: "provider_cooldown",
      severity: "info",
      message: `${cooling.provider} is cooling down for ${seconds}s.`,
      remediation:
        "The hold-off is automatic; retry after it expires, or use infobroker_inspect_providers action=health to confirm provider status.",
      details: { provider: cooling.provider, remaining_ms: cooling.remaining_ms },
    });
  }

  return notices.slice(0, bound);
}

/** REQ-111: bounded, stable notices for the current local state. */
export function collectNotices(): ToolNotice[] {
  try {
    return collect(MAX_NOTICES);
  } catch {
    // A notice must never turn a successful tool call into an error.
    return [];
  }
}

export function computeStateHealth(): StateHealth {
  const config = getConfig();
  const configured = isKbConfigured();
  return {
    config: {
      drift: getUserConfigDrift(),
      startup_error: getStartupConfigIssue(),
      auto_migrate_config: config.state?.auto_migrate_config === true,
    },
    kb: {
      configured,
      backend: configured ? "sqlite" : null,
      encryption: getKbEncryptionState(),
      supports_claims: kbSupportsClaims(),
      supports_report_receipts: kbSupportsReportReceipts(),
    },
    update: getUpdateState(),
    notices: collect(MAX_NOTICES),
  };
}

/**
 * REQ-111: add `notices` to the first [OK] JSON content item. With no notices,
 * or if the item is not a parseable [OK] envelope, the result is returned
 * byte-for-byte unchanged. Never throws.
 */
export function injectNotices<T>(result: T, notices: ToolNotice[]): T {
  if (notices.length === 0) return result;
  const content = (result as { content?: unknown })?.content;
  if (!Array.isArray(content)) return result;
  const index = content.findIndex(
    (item) =>
      typeof item === "object" &&
      item !== null &&
      (item as { type?: unknown }).type === "text" &&
      typeof (item as { text?: unknown }).text === "string" &&
      (item as { text: string }).text.startsWith("[OK] ")
  );
  if (index < 0) return result;
  const item = content[index] as { type: "text"; text: string };
  const start = item.text.indexOf("{");
  if (start < 0) return result;
  try {
    const payload = JSON.parse(item.text.slice(start)) as Record<string, unknown>;
    if (typeof payload !== "object" || payload === null || Array.isArray(payload)) return result;
    if (Array.isArray(payload["notices"]) && (payload["notices"] as unknown[]).length > 0) return result;
    payload["notices"] = notices;
    const next = [...(content as unknown[])];
    next[index] = { ...item, text: `[OK] ${JSON.stringify(payload)}` };
    return { ...(result as object), content: next } as T;
  } catch {
    // Non-JSON or malformed content is left untouched.
    return result;
  }
}
