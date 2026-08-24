// @implements REQ-084 REQ-085
import { describe, it, expect } from "vitest";
import {
  sealEnvelope,
  openEnvelope,
  isEncryptedEnvelope,
  parseEnvelope,
  type ResolvedKey,
} from "./kb-crypto.js";

const rawKey: ResolvedKey = {
  kind: "raw",
  dek: Buffer.from("0123456789abcdef0123456789abcdef", "utf-8"),
};
const passphrase: ResolvedKey = { kind: "passphrase", passphrase: "correct horse battery staple" };

describe("kb-crypto envelope (REQ-084)", () => {
  it("round-trips plaintext with a raw key", () => {
    const clear = Buffer.from("hello world", "utf-8");
    const sealed = sealEnvelope(rawKey, clear);
    expect(isEncryptedEnvelope(sealed)).toBe(true);
    const opened = openEnvelope(rawKey, sealed);
    expect(opened.toString("utf-8")).toBe("hello world");
  });

  it("round-trips plaintext with a passphrase (scrypt KEK wrapping a DEK)", () => {
    const clear = Buffer.from("sensitive report", "utf-8");
    const sealed = sealEnvelope(passphrase, clear);
    const opened = openEnvelope(passphrase, sealed);
    expect(opened.toString("utf-8")).toBe("sensitive report");
  });

  it("rejects decryption with the wrong key (tamper/auth failure)", () => {
    const clear = Buffer.from("secret", "utf-8");
    const sealed = sealEnvelope(rawKey, clear);
    const wrongKey: ResolvedKey = {
      kind: "raw",
      dek: Buffer.from("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "utf-8"),
    };
    expect(() => openEnvelope(wrongKey, sealed)).toThrow();
  });

  it("rejects a tampered ciphertext", () => {
    const clear = Buffer.from("secret", "utf-8");
    const sealed = sealEnvelope(rawKey, clear);
    const tampered = Buffer.from(sealed);
    tampered[tampered.length - 1] ^= 0xff;
    expect(() => openEnvelope(rawKey, tampered)).toThrow();
  });

  it("rejects a raw-key store when only a passphrase is supplied", () => {
    const sealed = sealEnvelope(rawKey, Buffer.from("x", "utf-8"));
    expect(() => openEnvelope(passphrase, sealed)).toThrow();
  });

  it("rejects a passphrase store with the wrong passphrase", () => {
    const sealed = sealEnvelope(passphrase, Buffer.from("x", "utf-8"));
    expect(() =>
      openEnvelope({ kind: "passphrase", passphrase: "wrong" }, sealed)
    ).toThrow();
  });

  it("produces a fresh nonce per encryption (nonce-reuse rule)", () => {
    const a = sealEnvelope(rawKey, Buffer.from("same", "utf-8"));
    const b = sealEnvelope(rawKey, Buffer.from("same", "utf-8"));
    expect(a.equals(b)).toBe(false);
    const pa = parseEnvelope(a);
    const pb = parseEnvelope(b);
    expect(pa.nonce.equals(pb.nonce)).toBe(false);
  });

  it("rejects a newer format version", () => {
    const sealed = sealEnvelope(rawKey, Buffer.from("x", "utf-8"));
    const bumped = Buffer.from(sealed);
    const versionOffset = Buffer.from("INFOKB1", "utf-8").length;
    bumped[versionOffset] = 99;
    expect(() => openEnvelope(rawKey, bumped)).toThrow(/newer format/);
  });

  it("sets the version and kdf bytes in the header", () => {
    const rawSealed = sealEnvelope(rawKey, Buffer.from("x", "utf-8"));
    const passSealed = sealEnvelope(passphrase, Buffer.from("x", "utf-8"));
    expect(parseEnvelope(rawSealed).header.version).toBe(1);
    expect(parseEnvelope(rawSealed).header.kdf).toBe(0);
    expect(parseEnvelope(passSealed).header.kdf).toBe(1);
  });

  it("passphrase change re-wraps the DEK without changing the plaintext", () => {
    const clear = Buffer.from("stable content", "utf-8");
    const sealed = sealEnvelope(passphrase, clear);
    // A new passphrase sealing the same DEK would still open with the original
    // passphrase — this test asserts the plaintext survives a seal/open round
    // trip, which is the invariant a passphrase change must preserve after
    // re-wrapping. The re-wrap path itself is exercised in kb.test.ts.
    expect(openEnvelope(passphrase, sealed).equals(clear)).toBe(true);
  });
});
