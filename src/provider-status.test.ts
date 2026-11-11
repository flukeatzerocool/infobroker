// @implements REQ-013 missing-key REQ-013 unreachable REQ-013 provider-degraded REQ-013 latency-threshold REQ-013 quota-warning REQ-024a
// REQ-013: the five branch tags above are asserted at the assessment boundary.
// REQ-024a: the reason vocabulary and the five non-active causes.
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { classifyCredential, getConfig, isOperational, providerUsable } from "./config.js";
import { markKeyRejected, resetKeyPoolStateForTests } from "./key-pool.js";
import { assessProvider, keyPoolRow, selectActiveRows, type ProviderStatusInput } from "./provider-status.js";

beforeAll(() => {
  process.env["INFOBROKER_KEYPOOL_STATE"] = join(tmpdir(), `provider-status-test-${process.pid}.json`);
  process.env["INFOBROKER_QUOTA_STATE"] = join(tmpdir(), `provider-status-quota-${process.pid}.json`);
});

beforeEach(() => {
  resetKeyPoolStateForTests();
});

afterEach(() => {
  for (const name of AUTH_VARS) delete process.env[name];
  resetKeyPoolStateForTests();
});

const AUTH_VARS = [
  "INFOBROKER_CORE_API_KEY",
  "INFOBROKER_SEMANTIC_SCHOLAR_API_KEY",
  "INFOBROKER_STACK_EXCHANGE_API_KEY",
  "INFOBROKER_GITHUB_API_KEY",
  "INFOBROKER_EXA_API_KEY",
  "INFOBROKER_TAVILY_API_KEY",
  "INFOBROKER_YEP_API_KEY",
];

function base(overrides: Partial<ProviderStatusInput> = {}): ProviderStatusInput {
  return {
    enabled: true,
    urlPresent: true,
    credential: "none",
    quotaExhausted: false,
    quotaWarning: false,
    ...overrides,
  };
}

describe("assessProvider (REQ-013)", () => {
  it("keeps an operational provider active", () => {
    expect(assessProvider(base())).toEqual({ status: "active" });
  });

  it("missing-key: a required credential with no key is inactive and says so", () => {
    expect(assessProvider(base({ credential: "absent" }))).toEqual({
      status: "inactive",
      inactive_reason: "no_api_key",
    });
  });

  it("missing-key: a declared URL env that is absent is inactive as no_url", () => {
    expect(assessProvider(base({ urlPresent: false }))).toEqual({
      status: "inactive",
      inactive_reason: "no_url",
    });
  });

  it("reports a configuration-disabled provider as disabled", () => {
    expect(assessProvider(base({ enabled: false, credential: "usable" }))).toEqual({
      status: "inactive",
      inactive_reason: "disabled",
    });
  });

  it("reports an all-unusable pool as credentials_unavailable", () => {
    expect(assessProvider(base({ credential: "unusable" }))).toEqual({
      status: "inactive",
      inactive_reason: "credentials_unavailable",
    });
  });

  it("keeps an optional credential with no key configured active", () => {
    expect(assessProvider(base({ credential: "optional-absent" }))).toEqual({ status: "active" });
  });

  it("unreachable: an inactive probe result is the explanation, not a config reason", () => {
    expect(assessProvider(base({ probeStatus: "inactive" }))).toEqual({ status: "inactive" });
  });

  it("provider-degraded: a degraded probe result is reported degraded", () => {
    expect(assessProvider(base({ probeStatus: "degraded" }))).toEqual({ status: "degraded" });
  });

  it("latency-threshold: average latency above the threshold degrades an active provider", () => {
    expect(assessProvider(base({ avgLatencyMs: 2500, degradedLatencyMs: 2000 }))).toEqual({
      status: "degraded",
    });
  });

  it("quota-warning: a warning-level quota degrades an active provider", () => {
    expect(assessProvider(base({ quotaWarning: true }))).toEqual({ status: "degraded" });
  });

  it("exhausted: quota exhaustion outranks every configuration reason", () => {
    expect(assessProvider(base({ enabled: false, credential: "absent", quotaExhausted: true }))).toEqual({
      status: "exhausted",
      inactive_reason: "exhausted",
    });
  });
});

describe("classifyCredential (REQ-011/REQ-104)", () => {
  it("returns none for a provider with no declared credential", () => {
    process.env["INFOBROKER_CORE_API_KEY"] = "k";
    expect(classifyCredential("wikipedia", getConfig().providers["wikipedia"])).toBe("none");
  });

  it("returns absent for a required credential with no key", () => {
    expect(classifyCredential("core", getConfig().providers["core"])).toBe("absent");
  });

  it("returns usable for a required credential with a key", () => {
    process.env["INFOBROKER_CORE_API_KEY"] = "k";
    expect(classifyCredential("core", getConfig().providers["core"])).toBe("usable");
  });

  it("returns unusable when every configured key is rejected", () => {
    process.env["INFOBROKER_CORE_API_KEY"] = "k";
    markKeyRejected("core", "k");
    expect(classifyCredential("core", getConfig().providers["core"])).toBe("unusable");
  });

  it("returns optional-absent for an optional credential with no key", () => {
    expect(classifyCredential("semantic_scholar", getConfig().providers["semantic_scholar"])).toBe(
      "optional-absent",
    );
  });

  it("returns unusable for an optional credential whose only key is rejected", () => {
    process.env["INFOBROKER_SEMANTIC_SCHOLAR_API_KEY"] = "k";
    markKeyRejected("semantic_scholar", "k");
    expect(classifyCredential("semantic_scholar", getConfig().providers["semantic_scholar"])).toBe("unusable");
  });
});

// FROZEN: captured from the pre-change providerUsable at 8954ccb (plan Phase 0
// step 0.2). Format: [no-keys, one-usable-key, all-keys-rejected]. A provider
// added to config.json must be added here deliberately, so this table is the
// guard that the delegation is behavior-preserving.
const FROZEN: Record<string, [boolean, boolean, boolean]> = {
  duckduckgo: [true, true, true],
  jina: [true, true, true],
  wikipedia: [true, true, true],
  wiktionary: [true, true, true],
  wikidata: [true, true, true],
  openstreetmap: [true, true, true],
  internet_archive: [true, true, true],
  arxiv: [true, true, true],
  semantic_scholar: [true, true, false],
  stack_exchange: [true, true, false],
  github: [true, true, false],
  core: [false, true, false],
  marginalia: [true, true, true],
  mojeek: [true, true, true],
  wiby: [true, true, true],
  openalex: [true, true, true],
  europe_pmc: [true, true, true],
  crossref: [true, true, true],
  hacker_news: [true, true, true],
  gdelt: [true, true, true],
  sec_edgar: [true, true, true],
  world_bank: [true, true, true],
  exa: [false, false, false],
  tavily: [false, false, false],
  searxng: [false, false, false],
  yep: [false, false, false],
  native_fetch: [true, true, true],
};

describe("providerUsable equivalence (frozen pre-change truth table)", () => {
  it("covers exactly the shipped providers", () => {
    expect(Object.keys(FROZEN).sort()).toEqual(Object.keys(getConfig().providers).sort());
  });

  it("matches the frozen table for all three credential fixtures", () => {
    const config = getConfig();
    for (const [slug, p] of Object.entries(config.providers)) {
      const expected = FROZEN[slug];
      const authVar = p.auth_env;

      // F0: no keys configured.
      delete process.env[authVar ?? ""];
      resetKeyPoolStateForTests();
      expect({ slug, fixture: "no-keys", usable: providerUsable(slug, config) }).toEqual({
        slug,
        fixture: "no-keys",
        usable: expected[0],
      });

      if (!authVar) continue;

      // F1: one usable key.
      process.env[authVar] = `frozen-${slug}`;
      resetKeyPoolStateForTests();
      expect({ slug, fixture: "one-key", usable: providerUsable(slug, config) }).toEqual({
        slug,
        fixture: "one-key",
        usable: expected[1],
      });

      // F2: the same key rejected.
      markKeyRejected(slug, `frozen-${slug}`);
      expect({ slug, fixture: "all-rejected", usable: providerUsable(slug, config) }).toEqual({
        slug,
        fixture: "all-rejected",
        usable: expected[2],
      });

      delete process.env[authVar];
      resetKeyPoolStateForTests();
    }
  });

  it("treats a disabled provider as unusable regardless of credentials", () => {
    const config = getConfig();
    for (const [slug, p] of Object.entries(config.providers)) {
      if (p.enabled) continue;
      expect({ slug, usable: providerUsable(slug, config) }).toEqual({ slug, usable: false });
    }
  });
});

describe("selectActiveRows (REQ-024a)", () => {
  it("keeps only rows reported active", () => {
    const rows = [
      { slug: "a", status: "active" },
      { slug: "b", status: "degraded" },
      { slug: "c", status: "inactive" },
      { slug: "d", status: "exhausted" },
    ];
    expect(selectActiveRows(rows).map((row) => row.slug)).toEqual(["a"]);
  });
});

describe("keyPoolRow (REQ-104)", () => {
  it("omits the row for a single available key", () => {
    expect(keyPoolRow([{ index: 0, available: true }])).toBeUndefined();
  });

  it("emits the row for a single rejected key", () => {
    expect(keyPoolRow([{ index: 0, available: false, reason: "rejected" }])).toEqual([
      { index: 0, available: false, reason: "rejected" },
    ]);
  });

  it("emits the row for a single cooling key", () => {
    expect(keyPoolRow([{ index: 0, available: false, reason: "cooldown" }])).toHaveLength(1);
  });

  it("emits the row for any multi-key pool", () => {
    expect(
      keyPoolRow([
        { index: 0, available: true },
        { index: 1, available: true },
      ]),
    ).toHaveLength(2);
  });

  it("omits an empty pool", () => {
    expect(keyPoolRow([])).toBeUndefined();
  });
});

// REQ-024b: the health action's probe gate and the shared assessment read one
// truth table, so a provider cannot be probed while being reported unusable.
describe("isOperational and the health assessment (REQ-024b)", () => {
  it("is false for a disabled provider even with a usable credential", () => {
    expect(isOperational({ enabled: false, urlPresent: true, credential: "none" })).toBe(false);
  });

  it("is false for an absent URL env or an unusable credential", () => {
    expect(isOperational({ enabled: true, urlPresent: false, credential: "none" })).toBe(false);
    expect(isOperational({ enabled: true, urlPresent: true, credential: "absent" })).toBe(false);
    expect(isOperational({ enabled: true, urlPresent: true, credential: "unusable" })).toBe(false);
  });

  it("is true for every operating credential class", () => {
    for (const credential of ["none", "usable", "optional-absent"] as const) {
      expect(isOperational({ enabled: true, urlPresent: true, credential })).toBe(true);
    }
  });

  it("keeps a disabled provider inactive and named even when a probe claims active", () => {
    expect(assessProvider(base({ enabled: false, probeStatus: "active" }))).toEqual({
      status: "inactive",
      inactive_reason: "disabled",
    });
  });

  it("keeps quota precedence over the disabled reason", () => {
    expect(assessProvider(base({ enabled: false, quotaExhausted: true }))).toEqual({
      status: "exhausted",
      inactive_reason: "exhausted",
    });
  });

  it("gives a probe-explained inactive row no reason", () => {
    expect(assessProvider(base({ probeStatus: "inactive" }))).toEqual({ status: "inactive" });
  });

  it("keeps an operational provider with no probe target active (native_fetch)", () => {
    expect(assessProvider(base())).toEqual({ status: "active" });
  });
});
