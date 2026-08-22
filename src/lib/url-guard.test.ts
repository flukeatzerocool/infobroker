// @implements REQ-021a
import { describe, it, expect } from "vitest";
import { assertPublicUrl, isPrivateHostname } from "./url-guard.js";

describe("url-guard", () => {
  it("rejects loopback, private, link-local, and metadata hosts", () => {
    for (const host of ["localhost", "127.0.0.1", "::1", "10.0.0.1", "172.16.1.1", "192.168.0.1", "169.254.169.254", "fe80::1", "fc00::1"]) {
      expect(isPrivateHostname(host)).toBe(true);
    }
  });

  it("accepts public hosts", () => {
    for (const host of ["example.com", "1.1.1.1", "2606:4700:4700::1111"]) {
      expect(isPrivateHostname(host)).toBe(false);
    }
  });

  it("refuses a private URL when the guard is not opted out", () => {
    expect(() => assertPublicUrl("http://169.254.169.254/latest", false)).toThrow(/private\/internal/);
    expect(() => assertPublicUrl("http://localhost:8080/x", false)).toThrow(/private\/internal/);
  });

  it("allows a private URL when opted out", () => {
    expect(() => assertPublicUrl("http://localhost:8080/x", true)).not.toThrow();
  });

  it("refuses non-http(s) protocols", () => {
    expect(() => assertPublicUrl("file:///etc/passwd", false)).toThrow(/non-HTTP protocol/);
    expect(() => assertPublicUrl("ftp://example.com/x", false)).toThrow(/non-HTTP protocol/);
  });
});
