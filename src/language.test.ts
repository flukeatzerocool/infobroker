// @implements REQ-128
import { describe, it, expect } from "vitest";
import {
  normalizeLanguageTag,
  scriptOf,
  providerSupportsLanguage,
  languageDisplayName,
} from "./language.js";

describe("language helpers (REQ-128)", () => {
  it("normalizes BCP-47 and locale tags to a primary subtag", () => {
    expect(normalizeLanguageTag("DE-de")).toBe("de");
    expect(normalizeLanguageTag("pt_BR")).toBe("pt");
    expect(normalizeLanguageTag(" zh-Hans ")).toBe("zh");
    expect(normalizeLanguageTag("x")).toBeUndefined();
    expect(normalizeLanguageTag(undefined)).toBeUndefined();
  });

  it("classifies the dominant script", () => {
    expect(scriptOf("hello world")).toBe("latin");
    expect(scriptOf("привет мир")).toBe("cyrillic");
    expect(scriptOf("مرحبا بالعالم")).toBe("arabic");
    expect(scriptOf("日本語")).toBe("han");
    expect(scriptOf("한국어")).toBe("hangul");
    expect(scriptOf("Ελληνικά")).toBe("greek");
    expect(scriptOf("")).toBe("other");
  });

  it("matches provider language declarations", () => {
    expect(providerSupportsLanguage("*", "de")).toBe(true);
    expect(providerSupportsLanguage(["en", "de"], "de-DE")).toBe(true);
    expect(providerSupportsLanguage(["en"], "de")).toBe(false);
    expect(providerSupportsLanguage(undefined, "de")).toBe(false);
    expect(providerSupportsLanguage(["en"], undefined)).toBe(true);
  });

  it("renders a language display name for providers that take names", () => {
    expect(languageDisplayName("de")?.toLowerCase()).toBe("german");
    expect(languageDisplayName("en-US")?.toLowerCase()).toBe("english");
    expect(languageDisplayName(undefined)).toBeUndefined();
  });
});
