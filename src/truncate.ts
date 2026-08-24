// @implements REQ-004
import { writeFileSync, mkdirSync, existsSync, chmodSync } from "node:fs";
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

export function maybeTruncate(text: string, maxChars: number): TruncatedText {
  if (text.length <= maxChars) return { text, truncated: false };

  const tmpDir = join(tmpdir(), "infobroker");
  if (!existsSync(tmpDir)) {
    mkdirSync(tmpDir, { recursive: true });
  }
  const fname = `trunc-${Date.now()}.txt`;
  const fpath = join(tmpDir, fname);
  writeFileSync(fpath, text);
  try {
    chmodSync(fpath, 0o600);
  } catch {
    // best effort
  }
  const body = text.slice(0, maxChars) + "...";
  return { text: body + truncateNote(maxChars, fpath), truncated: true, outputPath: fpath };
}
