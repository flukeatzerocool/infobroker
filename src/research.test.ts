// @implements REQ-020f REQ-020f variant-no-page
import { describe, it, expect } from "vitest";
import { deriveResearchVariants, parseEnvelope, compileResearchGroups } from "./research.js";

describe("deriveResearchVariants (REQ-020f)", () => {
  it("includes the original query and caps the variant count", () => {
    const variants = deriveResearchVariants("machine learning survey", 3);
    expect(variants[0]).toBe("machine learning survey");
    expect(variants.length).toBeLessThanOrEqual(3);
  });
});

describe("parseEnvelope (REQ-020f)", () => {
  it("parses an [OK] and an [ERROR] envelope", () => {
    expect(parseEnvelope('[OK] {"status":"ok","provider":"x","results":[]}')).toMatchObject({ status: "ok", provider: "x" });
    expect(parseEnvelope('[ERROR] {"status":"error","provider":"y"}')).toMatchObject({ status: "error", provider: "y" });
  });

  it("falls back to an error envelope on unparseable text", () => {
    expect(parseEnvelope("not json")).toEqual({ status: "error", provider: "", results: [] });
  });
});

describe("compileResearchGroups (REQ-020f)", () => {
  it("groups a served variant with its results and pages_read", async () => {
    const groups = await compileResearchGroups(["v1"], async () =>
      '[OK] {"status":"ok","provider":"duckduckgo","results":[{"title":"t","url":"u","snippet":"s"}],"meta":{"pages_read":2}}'
    );
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ variant: "v1", status: "ok", provider: "duckduckgo", pages_read: 2 });
    expect(groups[0].results).toHaveLength(1);
  });

  it("reports a variant with no fetchable page as its search results, not a failure", async () => {
    const groups = await compileResearchGroups(["v1"], async () =>
      '[OK] {"status":"ok","provider":"mojeek","results":[{"title":"t","url":"u","snippet":"s"}]}'
    );
    expect(groups[0].status).toBe("ok");
    expect(groups[0].results).toHaveLength(1);
    expect(groups[0].pages_read).toBeUndefined();
  });

  it("keeps a failed variant in the output rather than throwing", async () => {
    const groups = await compileResearchGroups(["v1", "v2"], async (variant) =>
      variant === "v1" ? '[ERROR] {"status":"error","provider":"x"}' : "garbage"
    );
    expect(groups.map((g) => g.status)).toEqual(["error", "error"]);
    expect(groups.every((g) => g.results.length === 0)).toBe(true);
  });
});
