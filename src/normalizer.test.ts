// @implements REQ-073 REQ-003
import { describe, it, expect } from "vitest";
import { normalize } from "./normalizer.js";

describe("normalize minimum viable result (REQ-073)", () => {
  it("discards results with an empty URL", () => {
    const out = normalize(
      [
        { title: "kept", url: "https://example.com/kept", snippet: "text" },
        { title: "dropped", url: "", snippet: "text" },
        { title: "also dropped" },
      ],
      "test"
    );
    expect(out).toHaveLength(1);
    expect(out[0].url).toBe("https://example.com/kept");
  });

  it("preserves the provider result count for downstream max_results", () => {
    const raw = Array.from({ length: 5 }, (_, i) => ({
      title: `r${i}`,
      url: i < 2 ? `https://example.com/${i}` : "",
    }));
    expect(normalize(raw, "test")).toHaveLength(2);
  });

  it("applies provider-specific field overrides (REQ-003)", () => {
    const out = normalize([{ title: "T", url: "https://example.com/x", extract: "wikipedia body" }], "wikipedia");
    expect(out[0].snippet).toBe("wikipedia body");
  });
});
