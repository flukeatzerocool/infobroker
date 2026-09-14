// @implements REQ-010 REQ-011 REQ-013 REQ-014 REQ-015 REQ-026a REQ-037 REQ-040 REQ-042 REQ-043 REQ-067 REQ-074 REQ-084 REQ-105
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Config, ProviderConfig } from "./types.js";
import {
  detectConfigDrift,
  applyConfigMigrations,
  CURRENT_CONFIG_VERSION,
  type ConfigDrift,
} from "./config-migrations.js";
import { atomicWriteFile, backupFile } from "./lib/atomic-write.js";

let configPath: string;
let cachedConfig: Config | null = null;
// The parsed user configuration layer and the shipped top-level key set, kept
// so REQ-105 drift detection can run without re-reading the files.
let userConfigLayer: Record<string, unknown> | null = null;
let shippedTopLevel: string[] = [];

export function getConfigPath(): string {
  if (!configPath) {
    configPath = process.env["INFOBROKER_CONFIG"] || "./config.json";
  }
  return configPath;
}

export function getUserConfigPath(): string | undefined {
  return process.env["INFOBROKER_CONFIG_LOCAL"] || join(dirname(getConfigPath()), "config.local.json");
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

function loadConfigFromDisk(): Config {
  const base = readJson(getConfigPath()) as Config;
  shippedTopLevel = Object.keys(base as unknown as Record<string, unknown>);
  const userPath = getUserConfigPath();
  const rawUser = userPath && existsSync(userPath) ? readJson(userPath) : null;
  userConfigLayer = isPlainObject(rawUser) ? rawUser : null;
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

  const drift = detectConfigDrift(userConfigLayer, shippedTopLevel);
  const { layer, changes } = applyConfigMigrations(userConfigLayer, drift);
  if (changes.length === 0) return null;

  const backup = backupFile(userPath);
  atomicWriteFile(userPath, Buffer.from(`${JSON.stringify(layer, null, 2)}\n`, "utf-8"));
  userConfigLayer = layer;
  return { changes, backup, path: userPath };
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

function validateConfig(config: Config): void {
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
    if (typeof provider.priority !== "number") {
      errors.push(`Provider "${slug}": missing or invalid "priority"`);
    }
    if (provider.rate_limit) {
      for (const [key, value] of Object.entries(provider.rate_limit)) {
        if (typeof value === "number" && value < 0) {
          errors.push(`Provider "${slug}": rate_limit.${key} must be non-negative`);
        }
      }
    }
    if (provider.timeout !== undefined && (typeof provider.timeout !== "number" || provider.timeout < 0)) {
      errors.push(`Provider "${slug}": timeout must be a non-negative number`);
    }
    if (provider.degraded_latency_ms !== undefined && (typeof provider.degraded_latency_ms !== "number" || provider.degraded_latency_ms < 0)) {
      errors.push(`Provider "${slug}": degraded_latency_ms must be a non-negative number`);
    }
    if (provider.resells !== undefined && typeof provider.resells !== "boolean") {
      errors.push(`Provider "${slug}": resells must be a boolean`);
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

  for (const [taskType, chain] of Object.entries(config.dispatch)) {
    for (const slug of chain) {
      if (!config.providers[slug]) {
        errors.push(`Dispatch chain "${taskType}" references undeclared provider "${slug}"`);
      }
    }
  }

  if (config.corroboration?.authority_weights) {
    for (const [sourceType, weight] of Object.entries(config.corroboration.authority_weights)) {
      if (typeof weight !== "number" || weight < 0) {
        errors.push(`corroboration.authority_weights.${sourceType} must be a non-negative number`);
      }
    }
  }
  if (config.corroboration?.kb_recall !== undefined && typeof config.corroboration.kb_recall !== "boolean") {
    errors.push("corroboration.kb_recall must be a boolean");
  }
  if (
    config.corroboration?.first_pass_max_providers !== undefined &&
    (typeof config.corroboration.first_pass_max_providers !== "number" ||
      config.corroboration.first_pass_max_providers < 1)
  ) {
    errors.push("corroboration.first_pass_max_providers must be a positive number");
  }

  if (typeof config.output.fallback_depth !== "number" || config.output.fallback_depth < 1) {
    errors.push("output.fallback_depth must be a positive number");
  }
  if (typeof config.output.max_redirect_hops !== "number" || config.output.max_redirect_hops < 1) {
    errors.push("output.max_redirect_hops must be a positive number");
  }
  if (config.output.degraded_latency_ms !== undefined && (typeof config.output.degraded_latency_ms !== "number" || config.output.degraded_latency_ms < 0)) {
    errors.push("output.degraded_latency_ms must be a non-negative number");
  }
  if (config.output.hedge_enabled !== undefined && typeof config.output.hedge_enabled !== "boolean") {
    errors.push("output.hedge_enabled must be a boolean");
  }
  if (config.output.hedge_min_delay_ms !== undefined && (typeof config.output.hedge_min_delay_ms !== "number" || config.output.hedge_min_delay_ms < 0)) {
    errors.push("output.hedge_min_delay_ms must be a non-negative number");
  }
  if (config.output.hedge_max_delay_ms !== undefined && (typeof config.output.hedge_max_delay_ms !== "number" || config.output.hedge_max_delay_ms < config.output.hedge_min_delay_ms!)) {
    errors.push("output.hedge_max_delay_ms must be a number no less than hedge_min_delay_ms");
  }
  if (config.output.hedge_grace_ms !== undefined && (typeof config.output.hedge_grace_ms !== "number" || config.output.hedge_grace_ms < 0)) {
    errors.push("output.hedge_grace_ms must be a non-negative number");
  }
  if (config.output.rate_limit_cooldown_ms !== undefined && (typeof config.output.rate_limit_cooldown_ms !== "number" || config.output.rate_limit_cooldown_ms < 0)) {
    errors.push("output.rate_limit_cooldown_ms must be a non-negative number");
  }
  if (config.output.audit_log_path !== undefined && typeof config.output.audit_log_path !== "string") {
    errors.push("output.audit_log_path must be a string");
  }

  if (config.content_policy) {
    const cp = config.content_policy;
    if (!["off", "flag", "block"].includes(cp.mode)) {
      errors.push("content_policy.mode must be one of: off, flag, block");
    }
    if (cp.threshold !== undefined && (typeof cp.threshold !== "number" || cp.threshold < 0 || cp.threshold > 1)) {
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
    if (config.fetch.passage_size !== undefined && (typeof config.fetch.passage_size !== "number" || config.fetch.passage_size < 1)) {
      errors.push("fetch.passage_size must be a positive number");
    }
    if (config.fetch.max_passages !== undefined && (typeof config.fetch.max_passages !== "number" || config.fetch.max_passages < 1)) {
      errors.push("fetch.max_passages must be a positive number");
    }
    if (config.fetch.detect_date !== undefined && typeof config.fetch.detect_date !== "boolean") {
      errors.push("fetch.detect_date must be a boolean");
    }
    if (config.fetch.crawl_max_pages !== undefined && (typeof config.fetch.crawl_max_pages !== "number" || config.fetch.crawl_max_pages < 1)) {
      errors.push("fetch.crawl_max_pages must be a positive number");
    }
    if (config.fetch.crawl_max_depth !== undefined && (typeof config.fetch.crawl_max_depth !== "number" || config.fetch.crawl_max_depth < 0)) {
      errors.push("fetch.crawl_max_depth must be a non-negative number");
    }
  }

  if (config.expand) {
    if (config.expand.max_expansions !== undefined && (typeof config.expand.max_expansions !== "number" || config.expand.max_expansions < 1)) {
      errors.push("expand.max_expansions must be a positive number");
    }
  }

  if (config.research) {
    if (config.research.max_variants !== undefined && (typeof config.research.max_variants !== "number" || config.research.max_variants < 1)) {
      errors.push("research.max_variants must be a positive number");
    }
    if (config.research.max_pages_per_variant !== undefined && (typeof config.research.max_pages_per_variant !== "number" || config.research.max_pages_per_variant < 1)) {
      errors.push("research.max_pages_per_variant must be a positive number");
    }
  }

  if (config.deep) {
    if (config.deep.max_pages !== undefined && (typeof config.deep.max_pages !== "number" || config.deep.max_pages < 1)) {
      errors.push("deep.max_pages must be a positive number");
    }
    if (config.deep.max_total_pages !== undefined && (typeof config.deep.max_total_pages !== "number" || config.deep.max_total_pages < 1)) {
      errors.push("deep.max_total_pages must be a positive number");
    }
    if (config.deep.concurrency !== undefined && (typeof config.deep.concurrency !== "number" || config.deep.concurrency < 1)) {
      errors.push("deep.concurrency must be a positive number");
    }
    if (config.deep.early_exit_score !== undefined && (typeof config.deep.early_exit_score !== "number" || config.deep.early_exit_score < 0 || config.deep.early_exit_score > 1)) {
      errors.push("deep.early_exit_score must be a number between 0 and 1");
    }
    if (config.deep.max_ms !== undefined && (typeof config.deep.max_ms !== "number" || config.deep.max_ms < 1)) {
      errors.push("deep.max_ms must be a positive number");
    }
    if (config.deep.detect_date !== undefined && typeof config.deep.detect_date !== "boolean") {
      errors.push("deep.detect_date must be a boolean");
    }
  }

  if (config.kb) {
    const kb = config.kb;
    if (typeof kb.chunk_size !== "number" || kb.chunk_size < 1) {
      errors.push("kb.chunk_size must be a positive number");
    }
    if (typeof kb.chunk_overlap !== "number" || kb.chunk_overlap < 0) {
      errors.push("kb.chunk_overlap must be a non-negative number");
    }
    if (typeof kb.max_results !== "number" || kb.max_results < 1) {
      errors.push("kb.max_results must be a positive number");
    }
    if (typeof kb.maintenance_interval_minutes !== "number" || kb.maintenance_interval_minutes < 0) {
      errors.push("kb.maintenance_interval_minutes must be a non-negative number");
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
    if (!kb.freshness && !kb.expiry) {
      errors.push("kb must define freshness or expiry");
    }
    if (kb.freshness) {
      if (!kb.freshness.tiers || typeof kb.freshness.tiers !== "object") {
        errors.push("kb.freshness.tiers must be an object");
      } else {
        for (const [tier, def] of Object.entries(kb.freshness.tiers)) {
          if (typeof (def as Record<string, unknown>).decay_hours !== "number" || (def as Record<string, unknown>).decay_hours === undefined) {
            errors.push(`kb.freshness.tiers.${tier}.decay_hours must be a number`);
          }
          if (typeof (def as Record<string, unknown>).expiry_hours !== "number" || (def as Record<string, unknown>).expiry_hours === undefined) {
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
    if (kb.kb_first_relevance_threshold !== undefined && typeof kb.kb_first_relevance_threshold !== "number") {
      errors.push("kb.kb_first_relevance_threshold must be a number");
    }
    if (kb.kb_first_confidence_threshold !== undefined && typeof kb.kb_first_confidence_threshold !== "number") {
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
  const config = loadConfigFromDisk();
  validateConfig(config);
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
