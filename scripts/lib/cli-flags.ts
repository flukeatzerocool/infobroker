#!/usr/bin/env npx tsx
// cli-flags.ts — lib: detect invocations of CLI flags that a tool release
// removed, so a harness cannot silently rot after a CLI upgrade. Pure (no I/O,
// no process access) so the rule is unit-testable without a fixture tree.
//
// Exit codes: n/a (library).

export interface FlagViolation {
  file: string;
  line: number;
  message: string;
}

// Assembled from fragments so this file's own literals are not mistaken for a
// usage by any future text scan.
const REMOVED_FLAG = "--" + "attach";
const OPencodeRUN = new RegExp(`\\bopencode\\s+(?:run|exec)\\b[^\\n]*${REMOVED_FLAG}\\b`);

/**
 * findRemovedFlags — report every non-comment line that invokes a removed CLI
 * flag. Comment lines are skipped so documentation that names the flag (for
 * example "opencode v2 removed --attach") does not trip the rule.
 */
export function findRemovedFlags(files: Array<{ file: string; content: string }>): FlagViolation[] {
  const violations: FlagViolation[] = [];
  for (const { file, content } of files) {
    content.split("\n").forEach((text, i) => {
      const trimmed = text.trim();
      if (trimmed.startsWith("#") || trimmed.startsWith("//")) return;
      if (!OPencodeRUN.test(text)) return;
      violations.push({
        file,
        line: i + 1,
        message: `\`${REMOVED_FLAG}\` was removed in opencode v2 — use \`--server "$SERVER_URL"\``,
      });
    });
  }
  return violations;
}
