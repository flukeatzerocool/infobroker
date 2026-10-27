// @implements REQ-128
// Language and script helpers shared by tokenization and provider routing.
// Pure and dependency-free: no network, no filesystem, no hidden state.

export type ScriptName =
  | "latin"
  | "cyrillic"
  | "arabic"
  | "han"
  | "kana"
  | "hangul"
  | "greek"
  | "hebrew"
  | "other";

const SCRIPT_RANGES: Array<{ script: ScriptName; re: RegExp }> = [
  { script: "han", re: /\p{Script=Han}/u },
  { script: "kana", re: /[\p{Script=Hiragana}\p{Script=Katakana}]/u },
  { script: "hangul", re: /\p{Script=Hangul}/u },
  { script: "cyrillic", re: /\p{Script=Cyrillic}/u },
  { script: "arabic", re: /\p{Script=Arabic}/u },
  { script: "greek", re: /\p{Script=Greek}/u },
  { script: "hebrew", re: /\p{Script=Hebrew}/u },
  { script: "latin", re: /\p{Script=Latin}/u },
];

/** Normalize a language tag (BCP-47 or ISO 639-1) to its lowercase primary subtag. */
export function normalizeLanguageTag(language?: string): string | undefined {
  if (!language) return undefined;
  const primary = language.trim().toLowerCase().replace(/_/g, "-").split("-")[0];
  return primary.length >= 2 ? primary : undefined;
}

/** Report the dominant script in a text sample as a coarse bucket. */
export function scriptOf(text: string): ScriptName {
  for (const { script, re } of SCRIPT_RANGES) {
    if (re.test(text ?? "")) return script;
  }
  return "other";
}

/** True when a provider's declared languages include the requested tag. */
export function providerSupportsLanguage(
  languages: string[] | "*" | undefined,
  language?: string,
): boolean {
  const tag = normalizeLanguageTag(language);
  if (!tag) return true;
  if (languages === "*") return true;
  if (!Array.isArray(languages) || languages.length === 0) return false;
  return languages.some((entry) => entry === "*" || normalizeLanguageTag(entry) === tag);
}

/** English display name for a language tag, used by providers that take names. */
export function languageDisplayName(language?: string): string | undefined {
  const tag = normalizeLanguageTag(language);
  if (!tag) return undefined;
  try {
    return new Intl.DisplayNames(["en"], { type: "language" }).of(tag);
  } catch {
    // An unknown/malformed tag is passed through as-is; the provider decides.
    return tag;
  }
}
