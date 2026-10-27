#!/usr/bin/env npx tsx
// generate-provider-privacy.ts — build tool: regenerate
// skills/infobroker/references/provider-privacy.md from config.json.
//
// Exit codes: 0 = reference written; 1 = config unreadable/invalid; 2 = fatal.

import { writeProviderPrivacy, readPrivacyConfig } from "./lib/provider-privacy.js";

try {
  const outPath = writeProviderPrivacy(readPrivacyConfig());
  console.log(`provider-privacy.md written to ${outPath}`);
} catch (error) {
  console.error(`generate-provider-privacy failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
