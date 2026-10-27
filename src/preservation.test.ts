// @implements REQ-122
import { describe, it, expect } from "vitest";
import { snapshotSource, sha256Text } from "./preservation.js";

describe("citation-grade snapshots (REQ-122)", () => {
  it("hashes deterministically", () => {
    expect(sha256Text("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("rejects non-http targets and empty text", () => {
    expect(snapshotSource({ url: "file:///etc/passwd", title: "x", text: "body" })).toBeNull();
    expect(snapshotSource({ url: "https://example.com/a", title: "x", text: "   " })).toBeNull();
  });
});
