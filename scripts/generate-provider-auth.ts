import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

interface ProviderEntry {
  tier: string;
  capabilities: string[];
  auth_env?: string;
  url_env?: string;
  enabled: boolean;
}

interface Config {
  providers: Record<string, ProviderEntry>;
}

const configPath = join(ROOT, "config.json");
const outPath = join(ROOT, "skills", "infobroker", "references", "provider-auth.md");

function main(): void {
  if (!existsSync(configPath)) {
    console.error(`config.json not found at ${configPath}`);
    process.exit(1);
  }

  const raw = readFileSync(configPath, "utf-8");
  const config = JSON.parse(raw) as Config;

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
  console.log(`provider-auth.md written to ${outPath}`);
}

main();
