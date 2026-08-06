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

export function loadConfig(): Config {
  const path = getConfigPath();
  if (!existsSync(path)) {
    throw new Error(`Config file not found: ${path}`);
  }
  const raw = readFileSync(path, "utf-8");
  const config = JSON.parse(raw) as Config;
  cachedConfig = config;
  return config;
}

export function reloadConfig(): Config {
  cachedConfig = null;
  return loadConfig();
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
