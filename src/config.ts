// @implements REQ-010 REQ-011 REQ-012 REQ-013 REQ-037 REQ-040
import { readFileSync, existsSync } from "node:fs";
import type { Config, ProviderConfig } from "./types.js";

let configPath: string;
let cachedConfig: Config | null = null;

export function getConfigPath(): string {
  if (!configPath) {
    configPath = process.env["INFOBROKER_CONFIG"] || "./config.json";
  }
  return configPath;
}

function loadConfigFromDisk(): Config {
  const path = getConfigPath();
  if (!existsSync(path)) {
    throw new Error(`Config file not found: ${path}`);
  }
  const raw = readFileSync(path, "utf-8");
  return JSON.parse(raw) as Config;
}

function validateConfig(config: Config): void {
  const errors: string[] = [];

  for (const [slug, provider] of Object.entries(config.providers)) {
    if (!provider.type || typeof provider.type !== "string") {
      errors.push(`Provider "${slug}": missing or invalid "type"`);
    }
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
