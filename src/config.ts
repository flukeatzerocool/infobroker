// @implements REQ-010 REQ-011 REQ-013 REQ-014 REQ-015 REQ-026a REQ-037 REQ-040 REQ-042 REQ-043 REQ-067 REQ-074 REQ-084 REQ-105 REQ-113
import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import type { Config, ProviderConfig } from "./types.js";
import {
  detectConfigDrift,
  applyConfigMigrations,
  CURRENT_CONFIG_VERSION,
  type ConfigDrift,
} from "./config-migrations.js";
import { atomicWriteFile, backupFile } from "./lib/atomic-write.js";

/**
 * Numeric configuration must be finite: JSON can express `Infinity` through an
 * overflowing literal such as `1e999`, and `typeof NaN === "number"` with
 * `NaN < N` false would otherwise pass every lower-bound check.
 */
function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** Largest delay Node accepts without emitting a 1 ms timer-overflow clamp. */
const MAX_TIMER_MS = 2_147_483_647;
/** Base backoff ceiling; with retry_count <= 10 the exponential stays below MAX_TIMER_MS. */
const MAX_RETRY_BACKOFF_MS = 60_000;
const MAX_RETRY_COUNT = 10;
const MAX_MAINTENANCE_MINUTES = Math.floor(MAX_TIMER_MS / 60_000);

let configPath: string;
let cachedConfig: Config | null = null;
// The parsed user configuration layer and the shipped top-level key set, kept
// so REQ-105 drift detection can run without re-reading the files.
let userConfigLayer: Record<string, unknown> | null = null;
let shippedTopLevel: string[] = [];

/** REQ-113: why startup fell back to shipped defaults. */
export interface StartupConfigIssue {
  code: "invalid_user_json" | "invalid_merged_user_layer" | "auto_migration_invalid" | "auto_migration_failed";
  message: string;
  remediation: string;
}

/** REQ-105: the migration applied automatically at startup, if any. */
export interface StartupMigration {
  changes: string[];
  backup: string | null;
  path: string;
}

let startupConfigIssue: StartupConfigIssue | null = null;
let startupMigration: StartupMigration | null = null;

export function getStartupConfigIssue(): StartupConfigIssue | null {
  return startupConfigIssue;
}

export function getStartupMigration(): StartupMigration | null {
  return startupMigration;
}

function packageRoot(): string {
  // Resolves to the repository root when running src/ under tsx and to the
  // installed package root when running the compiled dist/ entry point.
  return join(import.meta.dirname, "..");
}

function userConfigDir(): string {
  if (process.platform === "win32") {
    return process.env["APPDATA"] || join(homedir(), "AppData", "Roaming");
  }
  if (process.platform === "darwin") {
    return join(homedir(), "Library", "Application Support");
  }
  return process.env["XDG_CONFIG_HOME"] || join(homedir(), ".config");
}

export function getConfigPath(): string {
  if (!configPath) {
    configPath = process.env["INFOBROKER_CONFIG"] || join(packageRoot(), "config.json");
  }
  return configPath;
}

export function getUserConfigPath(): string | undefined {
  const explicit = process.env["INFOBROKER_CONFIG_LOCAL"];
  if (explicit) return explicit;
  // Preserve an existing clone-side layer so upgrades do not silently ignore it.
  const legacy = join(dirname(getConfigPath()), "config.local.json");
  if (existsSync(legacy)) return legacy;
  return join(userConfigDir(), "infobroker", "config.local.json");
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

// Deep-merge a user object over a shipped default object. Leaf values in the
// user layer replace the shipped values; arrays are replaced wholesale.
function mergeLayer<T>(base: T, overlay: unknown): T {
  if (!isPlainObject(base) || !isPlainObject(overlay)) {
    return (overlay === undefined ? base : overlay) as T;
  }
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [key, value] of Object.entries(overlay)) {
    if (value === undefined) continue;
    if (isPlainObject(value) && isPlainObject(out[key])) {
      out[key] = mergeLayer(out[key], value);
    } else if (Array.isArray(value) && Array.isArray(out[key])) {
      // Arrays are replaced wholesale (per REQ-010/DECISIONS.md). Warn when a
      // user overlay replaces a non-empty shipped array so the takeover is not
      // silent — an update to the shipped array will not reach this key.
      if (out[key].length > 0 && !sameArray(out[key], value)) {
        console.warn(
          `[infobroker] config overlay replaces shipped array "${key}" wholesale (shipped ${out[key].length} → user ${value.length}). Updates to the shipped default for this key will not apply.`
        );
      }
      out[key] = value;
    } else {
      out[key] = value;
    }
  }
  return out as T;
}

function sameArray(a: unknown[], b: unknown[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((v, i) => v === b[i]);
}

function readJson(path: string): unknown {
  if (!existsSync(path)) {
    throw new Error(`Config file not found: ${path}`);
  }
  return JSON.parse(readFileSync(path, "utf-8"));
}

function loadConfigFromDisk(recoverUserLayer = false): Config {
  const base = readJson(getConfigPath()) as Config;
  shippedTopLevel = Object.keys(base as unknown as Record<string, unknown>);
  startupConfigIssue = null;
  startupMigration = null;
  const userPath = getUserConfigPath();
  let rawUser: unknown = null;
  if (userPath && existsSync(userPath)) {
    try {
      rawUser = readJson(userPath);
    } catch (e) {
      if (!recoverUserLayer) throw e;
      startupConfigIssue = {
        code: "invalid_user_json",
        message: `User configuration layer could not be parsed: ${e instanceof Error ? e.message : String(e)}`,
        remediation: "Fix config.local.json (or INFOBROKER_CONFIG_LOCAL); the server is running on shipped defaults and has not modified the file.",
      };
      rawUser = null;
    }
  }
  userConfigLayer = isPlainObject(rawUser) ? rawUser : null;

  // REQ-105: apply registered migrations at startup only when the user opted
  // in. Apply in memory first and write only after the merged result validates,
  // so an auto-migration can never replace a working layer with an invalid one.
  if (userConfigLayer && (userConfigLayer["state"] as Record<string, unknown> | undefined)?.["auto_migrate_config"] === true) {
    const applied = applyUserLayerMigrations(userConfigLayer);
    if (applied.changes.length > 0 && userPath) {
      const candidate = applyDefaults(mergeLayer(base, applied.layer));
      try {
        validateConfig(candidate);
        try {
          const backup = backupFile(userPath);
          atomicWriteFile(userPath, Buffer.from(`${JSON.stringify(applied.layer, null, 2)}\n`, "utf-8"));
          userConfigLayer = applied.layer;
          startupMigration = { changes: applied.changes, backup, path: userPath };
        } catch (e) {
          startupConfigIssue = {
            code: "auto_migration_failed",
            message: `Automatic user-config migration could not be written: ${e instanceof Error ? e.message : String(e)}`,
            remediation: "The original config.local.json is unchanged. Check write permissions, then run reload_config with migrate=true.",
          };
        }
      } catch (e) {
        startupConfigIssue = {
          code: "auto_migration_invalid",
          message: `Automatic user-config migration would produce an invalid configuration: ${e instanceof Error ? e.message : String(e)}`,
          remediation: "The original config.local.json is unchanged. Fix the reported values, then run reload_config with migrate=true.",
        };
      }
    }
  }

  const merged = userConfigLayer
    ? mergeLayer(base, userConfigLayer)
    : base;
  const result = applyDefaults(merged);
  warnOnConfigDrift();
  return result;
}

// REQ-105: report user-layer drift without modifying user state. Non-blocking —
// the server operates on the merged config regardless.
function warnOnConfigDrift(): void {
  if (!userConfigLayer) return;
  const drift = detectConfigDrift(userConfigLayer, shippedTopLevel);
  if (!drift.hasDrift) return;
  const notes: string[] = [];
  if (drift.outdatedVersion) {
    notes.push(`written for schema v${drift.declaredVersion}, current is v${drift.currentVersion}`);
  }
  for (const r of drift.renames) notes.push(`legacy key "${r.from}" → "${r.to}"`);
  for (const r of drift.removals) notes.push(`obsolete key "${r.path}" — ${r.reason}`);
  for (const d of drift.deprecated) notes.push(`deprecated "${d.path}" — use ${d.replacement}`);
  for (const u of drift.unrecognized) notes.push(`unrecognized key "${u}"`);
  console.warn(
    `[infobroker] user config drift detected (${notes.join("; ")}). No user state was changed. ` +
      `Run reload_config with migrate=true to back up and apply registered migrations.`
  );
}

/** REQ-105: read-only drift assessment for the current user configuration layer. */
export function getUserConfigDrift(): ConfigDrift | null {
  if (!userConfigLayer) return null;
  return detectConfigDrift(userConfigLayer, shippedTopLevel);
}

/** REQ-105: pure in-memory application of registered user-layer migrations. */
export function applyUserLayerMigrations(layer: Record<string, unknown>): {
  layer: Record<string, unknown>;
  changes: string[];
} {
  const drift = detectConfigDrift(layer, shippedTopLevel);
  return applyConfigMigrations(layer, drift);
}

/**
 * REQ-105: opt-in migration of the user configuration layer. Backs up the
 * existing file, applies registered migrations and the current schema stamp,
 * and commits atomically. Returns the applied changes and the backup path, or
 * null when there is no user layer or nothing to change.
 */
export function migrateUserConfigLayer(): {
  changes: string[];
  backup: string | null;
  path: string;
} | null {
  const userPath = getUserConfigPath();
  if (!userPath || !existsSync(userPath)) return null;
  if (!userConfigLayer) return null;

  const { layer, changes } = applyUserLayerMigrations(userConfigLayer);
  if (changes.length === 0) return null;

  const backup = backupFile(userPath);
  atomicWriteFile(userPath, Buffer.from(`${JSON.stringify(layer, null, 2)}\n`, "utf-8"));
  userConfigLayer = layer;
  return { changes, backup, path: userPath };
}

/**
 * REQ-040: apply a caller-supplied configuration patch to the user layer.
 * The patch is deep-merged, the merged configuration is validated before any
 * write, the previous layer is backed up, and the write is atomic. An unknown
 * top-level key or an invalid merged configuration throws before disk is
 * touched, so the caller keeps the previous configuration active.
 */
export function patchUserConfigLayer(patch: Record<string, unknown>): {
  path: string;
  backup: string | null;
  changed: string[];
} {
  const userPath = getUserConfigPath();
  if (!userPath) throw new Error("No user configuration layer path is configured");
  const base = readJson(getConfigPath()) as Config;
  const knownKeys = new Set(Object.keys(base as unknown as Record<string, unknown>));
  for (const key of Object.keys(patch)) {
    if (key !== "config_version" && !knownKeys.has(key)) {
      throw new Error(`Unknown configuration key "${key}" — the patch may only set keys the shipped schema declares`);
    }
  }
  const existing = userConfigLayer ?? {};
  const nextLayer = mergeLayer(existing, patch);
  // Validate the merged result before touching disk (REQ-040).
  const merged = applyDefaults(mergeLayer(base, nextLayer));
  validateConfig(merged);
  const backup = backupFile(userPath);
  atomicWriteFile(userPath, Buffer.from(`${JSON.stringify(nextLayer, null, 2)}\n`, "utf-8"));
  userConfigLayer = nextLayer;
  return { path: userPath, backup, changed: Object.keys(patch) };
}

function applyDefaults(config: Config): Config {
  const defaults = config.defaults;
  if (!defaults) return config;
  for (const provider of Object.values(config.providers)) {
    if (defaults.timeout !== undefined && provider.timeout === undefined) provider.timeout = defaults.timeout;
    if (defaults.retry_count !== undefined && provider.retry_count === undefined) provider.retry_count = defaults.retry_count;
    if (defaults.retry_backoff_ms !== undefined && provider.retry_backoff_ms === undefined) provider.retry_backoff_ms = defaults.retry_backoff_ms;
  }
  return config;
}

export function validateConfig(config: Config): void {
  const errors: string[] = [];

  if (config.config_version !== undefined) {
    if (!Number.isInteger(config.config_version) || config.config_version < 1) {
      errors.push("config_version must be a positive integer");
    } else if (config.config_version > CURRENT_CONFIG_VERSION) {
      errors.push(
        `config_version ${config.config_version} is newer than this server supports (${CURRENT_CONFIG_VERSION}); ` +
          `update the server or remove the field from the user configuration layer`
      );
    }
  }

  if (config.state !== undefined) {
    if (typeof config.state !== "object" || config.state === null || Array.isArray(config.state)) {
      errors.push("state must be an object");
    } else {
      if (config.state.auto_migrate_config !== undefined && typeof config.state.auto_migrate_config !== "boolean") {
        errors.push("state.auto_migrate_config must be a boolean");
      }
      if (config.state.update_check !== undefined && typeof config.state.update_check !== "boolean") {
        errors.push("state.update_check must be a boolean");
      }
    }
  }

  for (const [slug, provider] of Object.entries(config.providers)) {
    if (!provider.tier || !["builtin", "free_http", "keyed_http", "self_hosted_http", "generic_http"].includes(provider.tier)) {
      errors.push(`Provider "${slug}": missing or invalid "tier"`);
    }
    if (!Array.isArray(provider.capabilities)) {
      errors.push(`Provider "${slug}": missing or invalid "capabilities"`);
    }
    if (typeof provider.enabled !== "boolean") {
      errors.push(`Provider "${slug}": missing or invalid "enabled"`);
    }
    if (!isFiniteNumber(provider.priority)) {
      errors.push(`Provider "${slug}": missing or invalid "priority"`);
    }
    if (provider.rate_limit !== undefined) {
      if (typeof provider.rate_limit !== "object" || provider.rate_limit === null || Array.isArray(provider.rate_limit)) {
        errors.push(`Provider "${slug}": rate_limit must be an object`);
      } else {
        for (const [key, value] of Object.entries(provider.rate_limit)) {
          if (!isFiniteNumber(value) || value < 0) {
            errors.push(`Provider "${slug}": rate_limit.${key} must be a non-negative finite number`);
          }
        }
        if (
          provider.rate_limit.jitter_ms !== undefined &&
          isFiniteNumber(provider.rate_limit.jitter_ms) &&
          provider.rate_limit.jitter_ms > MAX_TIMER_MS
        ) {
          errors.push(`Provider "${slug}": rate_limit.jitter_ms must be no greater than ${MAX_TIMER_MS}`);
        }
      }
    }
    if (provider.timeout !== undefined && (!isFiniteNumber(provider.timeout) || provider.timeout < 0 || provider.timeout > MAX_TIMER_MS)) {
      errors.push(`Provider "${slug}": timeout must be a non-negative number no greater than ${MAX_TIMER_MS}`);
    }
    if (
      provider.retry_count !== undefined &&
      (!isFiniteNumber(provider.retry_count) || !Number.isInteger(provider.retry_count) || provider.retry_count < 0 || provider.retry_count > MAX_RETRY_COUNT)
    ) {
      errors.push(`Provider "${slug}": retry_count must be an integer between 0 and ${MAX_RETRY_COUNT}`);
    }
    if (
      provider.retry_backoff_ms !== undefined &&
      (!isFiniteNumber(provider.retry_backoff_ms) || provider.retry_backoff_ms < 0 || provider.retry_backoff_ms > MAX_RETRY_BACKOFF_MS)
    ) {
      errors.push(`Provider "${slug}": retry_backoff_ms must be a non-negative number no greater than ${MAX_RETRY_BACKOFF_MS}`);
    }
    if (provider.degraded_latency_ms !== undefined && (!isFiniteNumber(provider.degraded_latency_ms) || provider.degraded_latency_ms < 0)) {
      errors.push(`Provider "${slug}": degraded_latency_ms must be a non-negative number`);
    }
    if (provider.resells !== undefined && typeof provider.resells !== "boolean") {
      errors.push(`Provider "${slug}": resells must be a boolean`);
    }
    if (provider.languages !== undefined) {
      const ok =
        provider.languages === "*" ||
        (Array.isArray(provider.languages) &&
          provider.languages.every((l) => typeof l === "string" && l.trim().length > 0));
      if (!ok) errors.push(`Provider "${slug}": languages must be "*" or an array of language tags`);
    }
    if (provider.privacy !== undefined) {
      const p = provider.privacy;
      if (typeof p !== "object" || p === null || Array.isArray(p)) {
        errors.push(`Provider "${slug}": privacy must be an object`);
      } else {
        if (p.query_forwarding !== undefined && !["none", "origin", "third_party"].includes(p.query_forwarding)) {
          errors.push(`Provider "${slug}": privacy.query_forwarding must be none, origin, or third_party`);
        }
        if (p.retains_query !== undefined && p.retains_query !== "unknown" && typeof p.retains_query !== "boolean") {
          errors.push(`Provider "${slug}": privacy.retains_query must be a boolean or "unknown"`);
        }
        for (const key of ["requires_account", "resells"] as const) {
          if (p[key] !== undefined && typeof p[key] !== "boolean") {
            errors.push(`Provider "${slug}": privacy.${key} must be a boolean`);
          }
        }
        if (p.notes !== undefined && (typeof p.notes !== "string" || p.notes.trim().length === 0)) {
          errors.push(`Provider "${slug}": privacy.notes must be a non-empty string`);
        }
      }
    }
    if (provider.tier === "generic_http") {
      if (typeof provider.endpoint !== "string" || !/^https?:\/\//i.test(provider.endpoint)) {
        errors.push(`Provider "${slug}": generic_http requires an "endpoint" (http(s) URL)`);
      }
      if (typeof provider.query_param !== "string" || provider.query_param.length === 0) {
        errors.push(`Provider "${slug}": generic_http requires "query_param"`);
      }
      if (provider.results_path !== undefined && (typeof provider.results_path !== "string" || provider.results_path.length === 0)) {
        errors.push(`Provider "${slug}": "results_path" must be a non-empty string when present`);
      }
      if (provider.field_map !== undefined) {
        if (typeof provider.field_map !== "object" || provider.field_map === null || Array.isArray(provider.field_map)) {
          errors.push(`Provider "${slug}": "field_map" must be an object`);
        } else {
          for (const [k, v] of Object.entries(provider.field_map)) {
            if (typeof v !== "string" || v.length === 0) {
              errors.push(`Provider "${slug}": field_map.${k} must be a non-empty string`);
            }
          }
        }
      }
    } else {
      for (const key of ["endpoint", "query_param", "results_path", "field_map"] as const) {
        if (provider[key as keyof ProviderConfig] !== undefined) {
          errors.push(`Provider "${slug}": "${key}" is only valid for generic_http providers`);
        }
      }
    }
  }

  if (config.defaults !== undefined) {
    if (typeof config.defaults !== "object" || config.defaults === null || Array.isArray(config.defaults)) {
      errors.push("defaults must be an object");
    } else {
      const defaults = config.defaults;
      if (defaults.timeout !== undefined && (!isFiniteNumber(defaults.timeout) || defaults.timeout < 0 || defaults.timeout > MAX_TIMER_MS)) {
        errors.push(`defaults.timeout must be a non-negative number no greater than ${MAX_TIMER_MS}`);
      }
      if (
        defaults.retry_count !== undefined &&
        (!isFiniteNumber(defaults.retry_count) || !Number.isInteger(defaults.retry_count) || defaults.retry_count < 0 || defaults.retry_count > MAX_RETRY_COUNT)
      ) {
        errors.push(`defaults.retry_count must be an integer between 0 and ${MAX_RETRY_COUNT}`);
      }
      if (
        defaults.retry_backoff_ms !== undefined &&
        (!isFiniteNumber(defaults.retry_backoff_ms) || defaults.retry_backoff_ms < 0 || defaults.retry_backoff_ms > MAX_RETRY_BACKOFF_MS)
      ) {
        errors.push(`defaults.retry_backoff_ms must be a non-negative number no greater than ${MAX_RETRY_BACKOFF_MS}`);
      }
    }
  }

  for (const [taskType, chain] of Object.entries(config.dispatch)) {
    for (const slug of chain) {
      if (!config.providers[slug]) {
        errors.push(`Dispatch chain "${taskType}" references undeclared provider "${slug}"`);
      }
    }
  }

  if (config.corroboration?.authority_weights) {
    for (const [sourceType, weight] of Object.entries(config.corroboration.authority_weights)) {
      if (!isFiniteNumber(weight) || weight < 0) {
        errors.push(`corroboration.authority_weights.${sourceType} must be a non-negative number`);
      }
    }
  }
  if (config.corroboration?.kb_recall !== undefined && typeof config.corroboration.kb_recall !== "boolean") {
    errors.push("corroboration.kb_recall must be a boolean");
  }
  if (config.corroboration?.max_batch_claims !== undefined) {
    const value = config.corroboration.max_batch_claims;
    if (!isFiniteNumber(value) || !Number.isInteger(value) || value < 1 || value > 25) {
      errors.push("corroboration.max_batch_claims must be an integer between 1 and 25");
    }
  }
  if (config.corroboration?.modality_markers !== undefined) {
    const markers = config.corroboration.modality_markers;
    if (typeof markers !== "object" || markers === null || Array.isArray(markers)) {
      errors.push("corroboration.modality_markers must be an object with reported and speculative arrays");
    } else {
      for (const key of ["reported", "speculative"] as const) {
        const list = markers[key];
        if (list === undefined) continue;
        if (!Array.isArray(list) || list.some((marker) => typeof marker !== "string" || marker.trim().length === 0)) {
          errors.push(`corroboration.modality_markers.${key} must be an array of non-empty strings`);
        }
      }
    }
  }
  if (config.corroboration) {
    const corr = config.corroboration;
    for (const key of ["max_iterations", "max_http_calls", "first_pass_max_results"] as const) {
      if (!isFiniteNumber(corr[key]) || !Number.isInteger(corr[key]) || corr[key] < 1) {
        errors.push(`corroboration.${key} must be a positive integer`);
      }
    }
    for (const key of ["confidence_threshold", "similarity_threshold"] as const) {
      const value = corr[key];
      if (!isFiniteNumber(value) || value < 0 || value > 1) {
        errors.push(`corroboration.${key} must be a number between 0 and 1`);
      }
    }
  }
  if (
    config.corroboration?.family_similarity_threshold !== undefined &&
    (!isFiniteNumber(config.corroboration.family_similarity_threshold) ||
      config.corroboration.family_similarity_threshold < 0 ||
      config.corroboration.family_similarity_threshold > 1)
  ) {
    errors.push("corroboration.family_similarity_threshold must be a number between 0 and 1");
  }
  if (config.corroboration?.calibration) {
    const cal = config.corroboration.calibration;
    if (cal.enabled !== undefined && typeof cal.enabled !== "boolean") {
      errors.push("corroboration.calibration.enabled must be a boolean");
    }
    if (
      cal.secondary_only_cap !== undefined &&
      (!isFiniteNumber(cal.secondary_only_cap) || cal.secondary_only_cap < 0 || cal.secondary_only_cap > 1)
    ) {
      errors.push("corroboration.calibration.secondary_only_cap must be a number between 0 and 1");
    }
  }
  if (config.preservation) {
    const preservation = config.preservation;
    if (preservation.enabled !== undefined && typeof preservation.enabled !== "boolean") {
      errors.push("preservation.enabled must be a boolean");
    }
    if (
      preservation.max_sources_per_finding !== undefined &&
      (!isFiniteNumber(preservation.max_sources_per_finding) || preservation.max_sources_per_finding < 0)
    ) {
      errors.push("preservation.max_sources_per_finding must be a non-negative number");
    }
    if (
      preservation.max_bytes !== undefined &&
      (!isFiniteNumber(preservation.max_bytes) || preservation.max_bytes < 1)
    ) {
      errors.push("preservation.max_bytes must be a positive number");
    }
  }
  if (
    config.corroboration?.first_pass_max_providers !== undefined &&
    (!isFiniteNumber(config.corroboration.first_pass_max_providers) ||
      config.corroboration.first_pass_max_providers < 1)
  ) {
    errors.push("corroboration.first_pass_max_providers must be a positive number");
  }

  if (!isFiniteNumber(config.output.fallback_depth) || config.output.fallback_depth < 1) {
    errors.push("output.fallback_depth must be a positive number");
  }
  if (!isFiniteNumber(config.output.max_redirect_hops) || config.output.max_redirect_hops < 1) {
    errors.push("output.max_redirect_hops must be a positive number");
  }
  if (!isFiniteNumber(config.output.max_chars) || !Number.isInteger(config.output.max_chars) || config.output.max_chars < 1) {
    errors.push("output.max_chars must be a positive integer");
  }
  if (!isFiniteNumber(config.output.latency_window_size) || !Number.isInteger(config.output.latency_window_size) || config.output.latency_window_size < 1) {
    errors.push("output.latency_window_size must be a positive integer");
  }
  if (config.output.degraded_latency_ms !== undefined && (!isFiniteNumber(config.output.degraded_latency_ms) || config.output.degraded_latency_ms < 0)) {
    errors.push("output.degraded_latency_ms must be a non-negative number");
  }
  if (config.output.hedge_enabled !== undefined && typeof config.output.hedge_enabled !== "boolean") {
    errors.push("output.hedge_enabled must be a boolean");
  }
  if (
    config.output.hedge_min_delay_ms !== undefined &&
    (!isFiniteNumber(config.output.hedge_min_delay_ms) || config.output.hedge_min_delay_ms < 0 || config.output.hedge_min_delay_ms > MAX_TIMER_MS)
  ) {
    errors.push(`output.hedge_min_delay_ms must be a non-negative number no greater than ${MAX_TIMER_MS}`);
  }
  if (config.output.hedge_max_delay_ms !== undefined) {
    if (!isFiniteNumber(config.output.hedge_max_delay_ms) || config.output.hedge_max_delay_ms > MAX_TIMER_MS) {
      errors.push(`output.hedge_max_delay_ms must be a number no greater than ${MAX_TIMER_MS}`);
    } else if (isFiniteNumber(config.output.hedge_min_delay_ms) && config.output.hedge_max_delay_ms < config.output.hedge_min_delay_ms) {
      errors.push("output.hedge_max_delay_ms must be a number no less than hedge_min_delay_ms");
    }
  }
  if (
    config.output.hedge_grace_ms !== undefined &&
    (!isFiniteNumber(config.output.hedge_grace_ms) || config.output.hedge_grace_ms < 0 || config.output.hedge_grace_ms > MAX_TIMER_MS)
  ) {
    errors.push(`output.hedge_grace_ms must be a non-negative number no greater than ${MAX_TIMER_MS}`);
  }
  if (
    config.output.rate_limit_cooldown_ms !== undefined &&
    (!isFiniteNumber(config.output.rate_limit_cooldown_ms) || config.output.rate_limit_cooldown_ms < 0 || config.output.rate_limit_cooldown_ms > MAX_TIMER_MS)
  ) {
    errors.push(`output.rate_limit_cooldown_ms must be a non-negative number no greater than ${MAX_TIMER_MS}`);
  }
  if (config.output.audit_log_path !== undefined && typeof config.output.audit_log_path !== "string") {
    errors.push("output.audit_log_path must be a string");
  }
  if (config.output.call_log !== undefined && !["off", "stderr", "file"].includes(config.output.call_log)) {
    errors.push("output.call_log must be one of: off, stderr, file");
  }
  if (config.output.call_log_path !== undefined && typeof config.output.call_log_path !== "string") {
    errors.push("output.call_log_path must be a string");
  }
  if (
    config.output.call_log_max_bytes !== undefined &&
    (!isFiniteNumber(config.output.call_log_max_bytes) ||
      !Number.isInteger(config.output.call_log_max_bytes) ||
      config.output.call_log_max_bytes < 1024 ||
      config.output.call_log_max_bytes > 100_000_000)
  ) {
    errors.push("output.call_log_max_bytes must be an integer between 1024 and 100000000");
  }

  if (config.source_quality !== undefined) {
    if (typeof config.source_quality !== "object" || config.source_quality === null || Array.isArray(config.source_quality)) {
      errors.push("source_quality must be an object");
    } else {
      const sq = config.source_quality;
      if (sq.enabled !== undefined && typeof sq.enabled !== "boolean") {
        errors.push("source_quality.enabled must be a boolean");
      }
      if (sq.weight !== undefined && (!isFiniteNumber(sq.weight) || sq.weight < 0 || sq.weight > 1)) {
        errors.push("source_quality.weight must be a number between 0 and 1");
      }
      for (const key of ["primary_source_suffixes", "trusted_domains", "low_quality_domains", "blocklist"] as const) {
        const value = sq[key];
        if (value !== undefined && (!Array.isArray(value) || value.some((entry) => typeof entry !== "string" || entry.trim() === ""))) {
          errors.push(`source_quality.${key} must be an array of non-empty strings`);
        }
      }
    }
  }

  if (config.content_policy) {
    const cp = config.content_policy;
    if (!["off", "flag", "block"].includes(cp.mode)) {
      errors.push("content_policy.mode must be one of: off, flag, block");
    }
    if (cp.threshold !== undefined && (!isFiniteNumber(cp.threshold) || cp.threshold < 0 || cp.threshold > 1)) {
      errors.push("content_policy.threshold must be a number between 0 and 1");
    }
    if (cp.external_url_env !== undefined && typeof cp.external_url_env !== "string") {
      errors.push("content_policy.external_url_env must be a string");
    }
    if (cp.external_api_key_env !== undefined && typeof cp.external_api_key_env !== "string") {
      errors.push("content_policy.external_api_key_env must be a string");
    }
    if (cp.patterns !== undefined) {
      if (typeof cp.patterns !== "object" || cp.patterns === null || Array.isArray(cp.patterns)) {
        errors.push("content_policy.patterns must be an object");
      } else {
        for (const [cat, pats] of Object.entries(cp.patterns)) {
          if (!Array.isArray(pats) || pats.some((p) => typeof p !== "string")) {
            errors.push(`content_policy.patterns.${cat} must be an array of strings`);
          }
        }
      }
    }
  }

  if (config.fetch) {
    if (config.fetch.passage_size !== undefined && (!isFiniteNumber(config.fetch.passage_size) || config.fetch.passage_size < 1)) {
      errors.push("fetch.passage_size must be a positive number");
    }
    if (config.fetch.max_passages !== undefined && (!isFiniteNumber(config.fetch.max_passages) || config.fetch.max_passages < 1 || config.fetch.max_passages > 20)) {
      errors.push("fetch.max_passages must be a number between 1 and 20");
    }
    if (config.fetch.detect_date !== undefined && typeof config.fetch.detect_date !== "boolean") {
      errors.push("fetch.detect_date must be a boolean");
    }
    if (config.fetch.crawl_max_pages !== undefined && (!isFiniteNumber(config.fetch.crawl_max_pages) || config.fetch.crawl_max_pages < 1)) {
      errors.push("fetch.crawl_max_pages must be a positive number");
    }
    if (config.fetch.crawl_max_depth !== undefined && (!isFiniteNumber(config.fetch.crawl_max_depth) || config.fetch.crawl_max_depth < 0)) {
      errors.push("fetch.crawl_max_depth must be a non-negative number");
    }
    if (config.fetch.cache !== undefined) {
      if (typeof config.fetch.cache !== "object" || config.fetch.cache === null || Array.isArray(config.fetch.cache)) {
        errors.push("fetch.cache must be an object");
      } else if (
        config.fetch.cache.kb_max_age_hours !== undefined &&
        (!isFiniteNumber(config.fetch.cache.kb_max_age_hours) || config.fetch.cache.kb_max_age_hours < 0)
      ) {
        errors.push("fetch.cache.kb_max_age_hours must be a non-negative number");
      }
    }
  }

  if (config.expand) {
    if (config.expand.max_expansions !== undefined && (!isFiniteNumber(config.expand.max_expansions) || config.expand.max_expansions < 1)) {
      errors.push("expand.max_expansions must be a positive number");
    }
  }

  if (config.research) {
    if (config.research.max_variants !== undefined && (!isFiniteNumber(config.research.max_variants) || config.research.max_variants < 1)) {
      errors.push("research.max_variants must be a positive number");
    }
    if (config.research.max_pages_per_variant !== undefined && (!isFiniteNumber(config.research.max_pages_per_variant) || config.research.max_pages_per_variant < 1)) {
      errors.push("research.max_pages_per_variant must be a positive number");
    }
  }

  if (config.deep) {
    if (config.deep.max_pages !== undefined && (!isFiniteNumber(config.deep.max_pages) || config.deep.max_pages < 1)) {
      errors.push("deep.max_pages must be a positive number");
    }
    if (config.deep.max_total_pages !== undefined && (!isFiniteNumber(config.deep.max_total_pages) || config.deep.max_total_pages < 1)) {
      errors.push("deep.max_total_pages must be a positive number");
    }
    if (config.deep.concurrency !== undefined && (!isFiniteNumber(config.deep.concurrency) || config.deep.concurrency < 1)) {
      errors.push("deep.concurrency must be a positive number");
    }
    if (config.deep.early_exit_score !== undefined && (!isFiniteNumber(config.deep.early_exit_score) || config.deep.early_exit_score < 0 || config.deep.early_exit_score > 1)) {
      errors.push("deep.early_exit_score must be a number between 0 and 1");
    }
    if (
      config.deep.max_ms !== undefined &&
      (!isFiniteNumber(config.deep.max_ms) || config.deep.max_ms < 1 || config.deep.max_ms > MAX_TIMER_MS)
    ) {
      errors.push(`deep.max_ms must be a positive number no greater than ${MAX_TIMER_MS}`);
    }
    if (config.deep.detect_date !== undefined && typeof config.deep.detect_date !== "boolean") {
      errors.push("deep.detect_date must be a boolean");
    }
  }

  if (config.analysis) {
    const analysis = config.analysis;
    for (const key of ["max_topics", "max_entities"] as const) {
      if (analysis[key] !== undefined && (!isFiniteNumber(analysis[key]) || analysis[key] < 1)) {
        errors.push(`analysis.${key} must be a positive number`);
      }
    }
    if (analysis.cluster_threshold !== undefined && (!isFiniteNumber(analysis.cluster_threshold) || analysis.cluster_threshold < 0 || analysis.cluster_threshold > 1)) {
      errors.push("analysis.cluster_threshold must be a number between 0 and 1");
    }
    if (analysis.min_cluster_size !== undefined && (!isFiniteNumber(analysis.min_cluster_size) || analysis.min_cluster_size < 2)) {
      errors.push("analysis.min_cluster_size must be a number of at least 2");
    }
    for (const key of ["enabled", "timeline"] as const) {
      if (analysis[key] !== undefined && typeof analysis[key] !== "boolean") {
        errors.push(`analysis.${key} must be a boolean`);
      }
    }
  }

  if (config.kb) {
    const kb = config.kb;
    if (!isFiniteNumber(kb.chunk_size) || kb.chunk_size < 1) {
      errors.push("kb.chunk_size must be a positive number");
    }
    if (!isFiniteNumber(kb.chunk_overlap) || kb.chunk_overlap < 0) {
      errors.push("kb.chunk_overlap must be a non-negative number");
    } else if (isFiniteNumber(kb.chunk_size) && kb.chunk_size >= 1 && kb.chunk_overlap * 2 >= kb.chunk_size) {
      const maxOverlap = Math.ceil(kb.chunk_size / 2) - 1;
      errors.push(
        `kb.chunk_overlap must be less than half of kb.chunk_size (got ${kb.chunk_overlap} with chunk_size ${kb.chunk_size}; set kb.chunk_overlap to ${maxOverlap} or less)`
      );
    }
    if (!isFiniteNumber(kb.max_results) || kb.max_results < 1) {
      errors.push("kb.max_results must be a positive number");
    }
    if (!isFiniteNumber(kb.maintenance_interval_minutes) || kb.maintenance_interval_minutes < 0 || kb.maintenance_interval_minutes > MAX_MAINTENANCE_MINUTES) {
      errors.push(`kb.maintenance_interval_minutes must be a non-negative number no greater than ${MAX_MAINTENANCE_MINUTES}`);
    }
    if (typeof kb.auto_index !== "boolean") {
      errors.push("kb.auto_index must be a boolean");
    }
    if (kb.reports_dir !== undefined && typeof kb.reports_dir !== "string") {
      errors.push("kb.reports_dir must be a string");
    }
    if (kb.default_save_destination !== undefined && !["kb", "disk", "both"].includes(kb.default_save_destination)) {
      errors.push("kb.default_save_destination must be one of: kb, disk, both");
    }
    if (kb.expiry && !kb.freshness) {
      console.error("[infobroker] kb.expiry is deprecated — migrate to kb.freshness tiers");
    }
    if (kb.expiry !== undefined) {
      if (typeof kb.expiry !== "object" || kb.expiry === null || Array.isArray(kb.expiry)) {
        errors.push("kb.expiry must be an object");
      } else {
        for (const [tier, hours] of Object.entries(kb.expiry)) {
          if (!isFiniteNumber(hours) || hours < 0) {
            errors.push(`kb.expiry.${tier} must be a non-negative number`);
          }
        }
      }
    }
    if (!kb.freshness && !kb.expiry) {
      errors.push("kb must define freshness or expiry");
    }
    if (kb.freshness) {
      if (!kb.freshness.tiers || typeof kb.freshness.tiers !== "object") {
        errors.push("kb.freshness.tiers must be an object");
      } else {
        for (const [tier, def] of Object.entries(kb.freshness.tiers)) {
          if (!isFiniteNumber((def as Record<string, unknown>).decay_hours) || (def as Record<string, unknown>).decay_hours === undefined) {
            errors.push(`kb.freshness.tiers.${tier}.decay_hours must be a number`);
          }
          if (!isFiniteNumber((def as Record<string, unknown>).expiry_hours) || (def as Record<string, unknown>).expiry_hours === undefined) {
            errors.push(`kb.freshness.tiers.${tier}.expiry_hours must be a number`);
          }
        }
      }
      if (typeof kb.freshness.auto_classify !== "boolean") {
        errors.push("kb.freshness.auto_classify must be a boolean");
      }
      if (typeof kb.freshness.default_tier !== "string") {
        errors.push("kb.freshness.default_tier must be a string");
      }
    }
    if (kb.kb_first_relevance_threshold !== undefined && !isFiniteNumber(kb.kb_first_relevance_threshold)) {
      errors.push("kb.kb_first_relevance_threshold must be a number");
    }
    if (kb.kb_first_confidence_threshold !== undefined && !isFiniteNumber(kb.kb_first_confidence_threshold)) {
      errors.push("kb.kb_first_confidence_threshold must be a number");
    }
    if (kb.keys_dir !== undefined && (typeof kb.keys_dir !== "string" || kb.keys_dir.length === 0)) {
      errors.push("kb.keys_dir must be a non-empty string when present");
    }
    if (kb.encryption !== undefined) {
      if (typeof kb.encryption !== "object" || kb.encryption === null || Array.isArray(kb.encryption)) {
        errors.push("kb.encryption must be an object");
      } else {
        if (typeof kb.encryption.enabled !== "boolean") {
          errors.push("kb.encryption.enabled must be a boolean");
        }
        if (kb.encryption.key_file !== undefined && (typeof kb.encryption.key_file !== "string" || kb.encryption.key_file.length === 0)) {
          errors.push("kb.encryption.key_file must be a non-empty string when present");
        }
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(`Config validation failed:\n${errors.join("\n")}`);
  }
}

export function loadConfig(): Config {
  const config = loadConfigFromDisk(true);
  try {
    validateConfig(config);
  } catch (e) {
    // REQ-113: a stale user layer must not prevent the server from starting.
    // Recover only when the shipped defaults are valid; never write the layer.
    if (!userConfigLayer) throw e;
    const base = readJson(getConfigPath()) as Config;
    const baseOnly = applyDefaults(structuredClone(base));
    validateConfig(baseOnly);
    if (!startupConfigIssue) {
      startupConfigIssue = {
        code: "invalid_merged_user_layer",
        message: `User configuration is invalid: ${e instanceof Error ? e.message : String(e)}`,
        remediation: `Fix the reported values in ${getUserConfigPath() ?? "the user configuration layer"}, then run reload_config. The server is running on shipped defaults and has not modified the config file.`,
      };
    }
    console.warn(
      `[infobroker] user configuration is invalid; starting on shipped defaults (user layer unchanged). ${startupConfigIssue.message}`
    );
    cachedConfig = baseOnly;
    return baseOnly;
  }
  cachedConfig = config;
  return config;
}

export function reloadConfig(): Config {
  const newConfig = loadConfigFromDisk();
  validateConfig(newConfig);
  cachedConfig = newConfig;
  return newConfig;
}

export function getConfig(): Config {
  if (!cachedConfig) {
    return loadConfig();
  }
  return cachedConfig;
}

export function getEnvVar(providerSlug: string, suffix: "_API_KEY" | "_URL"): string | undefined {
  const key = `INFOBROKER_${providerSlug.toUpperCase()}${suffix}`;
  return process.env[key];
}

export function getActiveProviders(): [string, ProviderConfig][] {
  const config = getConfig();
  return Object.entries(config.providers).filter(([, p]) => p.enabled);
}

export function getDispatchChain(taskType: string): string[] {
  const config = getConfig();
  const chain = config.dispatch[taskType];
  if (!chain) return [];
  return chain.filter((slug) => {
    const provider = config.providers[slug];
    if (!provider || !provider.enabled) return false;
    if (provider.tier === "keyed_http" && provider.auth_env) {
      const many = provider.auth_env.replace(/_API_KEY$/, "_API_KEYS");
      if (!process.env[provider.auth_env] && !process.env[many]) return false;
    }
    if (provider.tier === "self_hosted_http" && provider.url_env && !process.env[provider.url_env]) return false;
    return true;
  });
}
