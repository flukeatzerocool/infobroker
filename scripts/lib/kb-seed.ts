// scripts/lib/kb-seed.ts — informational: select the legacy-JSON corpus seed
// for the KB benchmark (REQ-108). Sealed migration artifacts (`*.enc`) are
// ciphertext and must never be chosen: the plaintext lane copies the seed in
// as `vector-store.json` and would migrate garbage.
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { LEGACY_JSON_STORE } from "../../src/kb-store.js";

/** The prefix every migration archive of the legacy store carries. */
export const SEED_ARCHIVE_PREFIX = `${LEGACY_JSON_STORE}.migrated-`;

/** True for a plaintext migration archive that can seed the benchmark. */
export function isLegacySeedName(name: string): boolean {
  return name.startsWith(SEED_ARCHIVE_PREFIX) && !name.endsWith(".enc");
}

/**
 * Returns the path of the legacy store to seed from, or null when the
 * directory holds no usable plaintext store.
 */
export function selectLegacySeed(storeDir: string): string | null {
  const direct = join(storeDir, LEGACY_JSON_STORE);
  if (existsSync(direct)) return direct;
  const archives = readdirSync(storeDir).filter(isLegacySeedName).sort();
  const newest = archives.at(-1);
  return newest ? join(storeDir, newest) : null;
}
