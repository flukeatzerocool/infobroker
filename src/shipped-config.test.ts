// @implements REQ-084 REQ-085
// Gate: the shipped default config must never enable KB encryption, so a
// future update cannot silently encrypt (and thereby lock) user stores.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

describe("shipped config default (REQ-084/085)", () => {
  it("ships with KB encryption disabled or absent", () => {
    const pkgPath = join(fileURLToPath(import.meta.url), "..", "..", "config.json");
    const config = JSON.parse(readFileSync(pkgPath, "utf-8")) as {
      kb?: { encryption?: { enabled?: boolean } };
    };
    const enabled = config.kb?.encryption?.enabled;
    expect(enabled).not.toBe(true);
  });
});
