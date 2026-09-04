// @implements REQ-038 rate-limit
// @implements REQ-038 anti-bot
import { describe, it, expect, vi, afterEach } from "vitest";
import { RetryableError, BotChallengeError } from "./retry.js";
import {
  shouldCooldown,
  markCooldown,
  inCooldown,
  cooldownRemainingMs,
  cooldownDurationMs,
} from "./cooldown.js";

describe("cooldown (REQ-038)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("places a provider in cooldown for the configured duration", () => {
    vi.useFakeTimers();
    markCooldown("duckduckgo", 30000);
    expect(inCooldown("duckduckgo")).toBe(true);
    expect(cooldownRemainingMs("duckduckgo")).toBe(30000);
  });

  it("expires automatically without a restart", () => {
    vi.useFakeTimers();
    markCooldown("duckduckgo", 30000);
    vi.advanceTimersByTime(30000);
    expect(inCooldown("duckduckgo")).toBe(false);
    expect(cooldownRemainingMs("duckduckgo")).toBe(0);
  });

  it("cooldowns on a rate-limit response (429)", () => {
    expect(shouldCooldown(new RetryableError("HTTP 429", 429))).toBe(true);
  });

  it("cooldowns on an anti-bot challenge", () => {
    expect(shouldCooldown(new BotChallengeError("anti-bot challenge (HTTP 202)"))).toBe(true);
  });

  it("does not cooldown on a transient 503 or a generic error", () => {
    expect(shouldCooldown(new RetryableError("HTTP 503", 503))).toBe(false);
    expect(shouldCooldown(new Error("boom"))).toBe(false);
  });

  it("treats an absent or negative duration as disabled", () => {
    expect(cooldownDurationMs(undefined)).toBe(0);
    expect(cooldownDurationMs(-1)).toBe(0);
    expect(cooldownDurationMs(30000)).toBe(30000);
  });
});
