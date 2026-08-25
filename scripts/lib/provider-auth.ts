import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");

interface ProviderEntry {
  tier: string;
  capabilities: string[];
  auth_env?: string;
  url_env?: string;
  enabled: boolean;
}

export interface Config {
  providers: Record<string, ProviderEntry>;
}

export function readConfig(): Config {
  const configPath = join(ROOT, "config.json");
  return JSON.parse(readFileSync(configPath, "utf-8")) as Config;
}

// Generate the provider-auth reference Markdown from config.json. Returns the
// absolute path written (skills/infobroker/references/provider-auth.md).
export function writeProviderAuth(config: Config): string {
  const outPath = join(ROOT, "skills", "infobroker", "references", "provider-auth.md");
  const outDir = dirname(outPath);
  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true });
  }

  const lines: string[] = [];
  lines.push("# Provider Auth Reference");
  lines.push("");
  lines.push("Generated from `config.json`. Do not edit manually.");
  lines.push("");
  lines.push("| Provider | Tier | Auth | Env Variable |");
  lines.push("|----------|------|------|-------------|");

  const entries = Object.entries(config.providers).sort((a, b) => a[1].tier.localeCompare(b[1].tier));

  for (const [slug, provider] of entries) {
    const tier = provider.tier;
    let auth = "None";
    let envVar = "—";

    if (provider.auth_env) {
      auth = "API key";
      envVar = `\`${provider.auth_env}\``;
    } else if (provider.url_env) {
      auth = "Instance URL";
      envVar = `\`${provider.url_env}\``;
    }

    lines.push(`| ${slug} | ${tier} | ${auth} | ${envVar} |`);
  }

  writeFileSync(outPath, lines.join("\n") + "\n");
  return outPath;
}
