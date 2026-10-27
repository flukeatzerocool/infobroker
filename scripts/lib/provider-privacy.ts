// provider-privacy.ts — read config.json and generate the provider privacy
// reference Markdown (skills/infobroker/references/provider-privacy.md).
// Deterministic: provider order is sorted by slug and the posture is derived
// from configuration only.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";

import { derivePrivacy } from "../../src/privacy.js";
import type { ProviderConfig } from "../../src/types.js";

const __dirname = import.meta.dirname;
const ROOT = join(__dirname, "..", "..");

export interface PrivacyConfig {
  providers: Record<string, ProviderConfig>;
}

export function readPrivacyConfig(): PrivacyConfig {
  const configPath = join(ROOT, "config.json");
  return JSON.parse(readFileSync(configPath, "utf-8")) as PrivacyConfig;
}

function labelForwarding(value: string): string {
  if (value === "none") return "none (stays on your instance)";
  if (value === "origin") return "origin provider";
  return "third party";
}

export function renderProviderPrivacy(config: PrivacyConfig): string {
  const lines: string[] = [];
  lines.push("# Provider Privacy Reference");
  lines.push("");
  lines.push("Generated from `config.json`. Do not edit manually.");
  lines.push("");
  lines.push(
    "Posture is derived from each provider's tier and resale flag, with explicit per-provider overrides taking precedence. `unknown` means configuration does not establish the answer; it is not a privacy claim.",
  );
  lines.push("");
  lines.push("| Provider | Tier | Query forwarding | Retains query | Account/key | Resells | Notes |");
  lines.push("|----------|------|------------------|---------------|-------------|---------|-------|");
  for (const slug of Object.keys(config.providers).sort((a, b) => a.localeCompare(b))) {
    const provider = config.providers[slug];
    const posture = derivePrivacy(provider);
    const retention = posture.retains_query === "unknown" ? "unknown" : posture.retains_query ? "yes" : "no";
    lines.push(
      `| ${slug} | ${provider.tier} | ${labelForwarding(posture.query_forwarding)} | ${retention} | ${posture.requires_account ? "required" : "none"} | ${posture.resells ? "yes" : "no"} | ${posture.notes ?? ""} |`,
    );
  }
  lines.push("");
  return lines.join("\n");
}

/** Write the generated reference. Returns the absolute path written. */
export function writeProviderPrivacy(config: PrivacyConfig): string {
  const outPath = join(ROOT, "skills", "infobroker", "references", "provider-privacy.md");
  const outDir = dirname(outPath);
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  writeFileSync(outPath, renderProviderPrivacy(config));
  return outPath;
}
