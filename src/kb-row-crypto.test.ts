// @implements REQ-084
import { describe, it, expect } from "vitest";
import { randomBytes } from "node:crypto";
import { deriveRowKey, openRow, sealRow, newRowSalt } from "./kb-row-crypto.js";

describe("row encryption (REQ-084)", () => {
  it("uses a raw key directly and round-trips a row", () => {
    const key = randomBytes(32);
    const salt = newRowSalt();
    const derived = deriveRowKey({ kind: "raw", dek: key }, salt);
    expect(derived.equals(key)).toBe(true);
    const sealed = sealRow(derived, Buffer.from("hello knowledge base"));
    expect(sealed.equals(Buffer.from("hello knowledge base"))).toBe(false);
    expect(openRow(derived, sealed).toString("utf-8")).toBe("hello knowledge base");
  });

  it("derives the same key from a passphrase and salt every time", () => {
    const salt = newRowSalt();
    const a = deriveRowKey({ kind: "passphrase", passphrase: "correct horse" }, salt);
    const b = deriveRowKey({ kind: "passphrase", passphrase: "correct horse" }, salt);
    expect(a.equals(b)).toBe(true);
    const c = deriveRowKey({ kind: "passphrase", passphrase: "correct horse" }, newRowSalt());
    expect(a.equals(c)).toBe(false);
  });

  it("fails to open a row under the wrong key", () => {
    const salt = newRowSalt();
    const key = deriveRowKey({ kind: "passphrase", passphrase: "one" }, salt);
    const wrong = deriveRowKey({ kind: "passphrase", passphrase: "two" }, salt);
    const sealed = sealRow(key, Buffer.from("secret"));
    expect(() => openRow(wrong, sealed)).toThrow();
  });
});
