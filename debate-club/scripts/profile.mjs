#!/usr/bin/env node
// profile.mjs — resolve a named Lab configuration profile into a
// `config.local.json` layer. Each profile is a small, reviewable delta over
// the shipped defaults; the Lab records the name and the layer hash so a
// result is attributable to the configuration it exercised.
//
// Exit codes: 0 = resolved/listed; 1 = unknown profile; 2 = usage.

import { createHash } from "node:crypto";

export const PROFILES = {
  // Shipped defaults, no user layer. The "new user" path.
  fresh: {},
  // One knob changed, the smallest realistic override.
  "solo-override": { output: { fallback_depth: 2 } },
  // No knowledge base and a shallow fallback: the degraded-but-usable path.
  constrained: {
    kb: null,
    corroboration: { kb_recall: false },
    output: { fallback_depth: 1 },
  },
  // Every optional local capability on; keys still come from the environment.
  power: {
    preservation: { archive: true },
    kb: { auto_index: true },
  },
};

export function resolveProfile(name) {
  if (!Object.prototype.hasOwnProperty.call(PROFILES, name)) {
    throw new Error(`unknown profile: ${name} (known: ${Object.keys(PROFILES).join(", ")})`);
  }
  return PROFILES[name];
}

export function profileLayer(name) {
  return JSON.stringify(resolveProfile(name), null, 2) + "\n";
}

export function profileHash(name) {
  return createHash("sha256").update(profileLayer(name)).digest("hex").slice(0, 12);
}

function main(argv) {
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log("usage: profile.mjs --print <name> | --list");
    return 0;
  }
  if (argv.includes("--list")) {
    console.log(Object.keys(PROFILES).join("\n"));
    return 0;
  }
  const idx = argv.indexOf("--print");
  if (idx === -1 || !argv[idx + 1]) {
    console.error("usage: profile.mjs --print <name> | --list");
    return 2;
  }
  try {
    process.stdout.write(profileLayer(argv[idx + 1]));
    return 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exitCode = main(process.argv.slice(2));
}
