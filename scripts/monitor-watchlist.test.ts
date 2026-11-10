#!/usr/bin/env npx tsx
// monitor-watchlist.test.ts — regression test for the watchlist runner's
// response classification (REQ-125). An `[ERROR]` or unreadable verify_claims
// response must be recorded as a failed topic, not a successful empty run.
//
// Role: test (run by `npm run test`). Exit codes are vitest's.

// @implements REQ-125 error-recording

import { describe, it, expect } from "vitest";
import { parseVerifyEnvelope } from "./monitor-watchlist.js";

describe("monitor-watchlist response classification (REQ-125)", () => {
  it("maps a successful verify_claims envelope to its claims", () => {
    const parsed = parseVerifyEnvelope(
      '[OK] {"status":"ok","findings":[{"claim":"a"},{"topic":"b"}]}',
    );
    expect(parsed).toEqual({ ok: true, claims: ["a", "b"] });
    expect(parseVerifyEnvelope('[OK] {"status":"ok","findings":[]}')).toEqual({ ok: true, claims: [] });
  });

  it("treats an [ERROR] body as a failed run", () => {
    const failed = parseVerifyEnvelope('[ERROR] {"code":"provider_unavailable"}');
    expect(failed.ok).toBe(false);
    expect(failed.error).toContain("provider_unavailable");
  });

  it("treats an unreadable or findings-less response as a failed run", () => {
    expect(parseVerifyEnvelope("not json").ok).toBe(false);
    expect(parseVerifyEnvelope('[OK] {"status":"ok"}').ok).toBe(false);
  });
});
