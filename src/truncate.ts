// @implements REQ-004 REQ-100
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { join } from "node:path";
import { tmpdir } from "node:os";

export interface TruncatedText {
  text: string;
  truncated: boolean;
  outputPath?: string;
}

export function truncateNote(maxChars: number, outputPath: string): string {
  return `\n\n[truncated at ${maxChars} chars — full content written to ${outputPath}]`;
}

/** `wx` + a random suffix: a predictable path must not be pre-creatable. */
function writeSpill(dir: string, text: string): string {
  for (let attempt = 0; attempt < 3; attempt++) {
    const fpath = join(dir, `trunc-${Date.now()}-${randomBytes(4).toString("hex")}.txt`);
    try {
      writeFileSync(fpath, text, { mode: 0o600, flag: "wx" });
      return fpath;
    } catch (error) {
      if ((error as { code?: string }).code === "EEXIST") continue;
      throw error;
    }
  }
  throw new Error("Could not allocate a unique truncation spill file");
}

export function maybeTruncate(text: string, maxChars: number): TruncatedText {
  if (text.length <= maxChars) return { text, truncated: false };

  const tmpDir = join(tmpdir(), "infobroker");
  if (!existsSync(tmpDir)) {
    mkdirSync(tmpDir, { recursive: true, mode: 0o700 });
  }
  const fpath = writeSpill(tmpDir, text);
  const body = text.slice(0, maxChars) + "...";
  return { text: body + truncateNote(maxChars, fpath), truncated: true, outputPath: fpath };
}
