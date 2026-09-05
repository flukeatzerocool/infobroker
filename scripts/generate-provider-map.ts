#!/usr/bin/env npx tsx
// generate-provider-map.ts — build tool: regenerate
// skills/infobroker/references/provider-map.md from config.json.
//
// Exit codes: 0 = reference written.

import { writeProviderMap, readConfig } from "./lib/provider-map.js";

const outPath = writeProviderMap(readConfig());
console.log(`provider-map.md written to ${outPath}`);
