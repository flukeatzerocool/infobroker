#!/usr/bin/env npx tsx
// generate-provider-auth.ts — build tool: regenerate
// skills/infobroker/references/provider-auth.md from config.json.
//
// Exit codes: 0 = reference written.

import { writeProviderAuth, readConfig } from "./lib/provider-auth.js";

const outPath = writeProviderAuth(readConfig());
console.log(`provider-auth.md written to ${outPath}`);
