import { writeProviderAuth, readConfig } from "./lib/provider-auth.js";

const outPath = writeProviderAuth(readConfig());
console.log(`provider-auth.md written to ${outPath}`);
