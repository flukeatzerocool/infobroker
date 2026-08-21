// @implements REQ-010 REQ-011 REQ-012 REQ-013 REQ-037 REQ-040 REQ-042 REQ-043 REQ-067 REQ-074
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Config, ProviderConfig } from "./types.js";

let configPath: string;
let cachedConfig: Config | null = null;

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
  const userPath = getUserConfigPath();
  if (userPath && existsSync(userPath)) {
    const user = readJson(userPath);
    return mergeLayer(base, user);
  }
  return base;
}

function validateConfig(config: Config): void {
  const errors: string[] = [];

  for (const [slug, provider] of Object.entries(config.providers)) {
    if (!provider.tier || !["builtin", "free_http", "keyed_http", "self_hosted_http"].includes(provider.tier)) {
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
  }

  for (const [taskType, chain] of Object.entries(config.dispatch)) {
    for (const slug of chain) {
      if (!config.providers[slug]) {
        errors.push(`Dispatch chain "${taskType}" references undeclared provider "${slug}"`);
      }
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
    return provider && provider.enabled;
  });
}
