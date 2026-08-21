import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const PROSE_REPO_ROOT = process.cwd();
const PROSE_README_PATH = resolve(PROSE_REPO_ROOT, "README.md");

// ── Single source of truth: tool surface & provider registry ────────────────
// The README's tool and provider counts must reconcile against these derived
// lists, so the validator never drifts from src/ or config.json.

const SRC_INDEX_PATH = resolve(PROSE_REPO_ROOT, "src/index.ts");
const CONFIG_PATH = resolve(PROSE_REPO_ROOT, "config.json");

// Provider slugs that are infrastructure/fallback renderers rather than
// user-facing providers documented in the README. Excluded from the provider
// count so README parity matches the user-facing surface.
const PROVIDER_EXCLUSIONS = new Set(["native_fetch"]);

export function deriveToolNames(): string[] {
  if (!existsSync(SRC_INDEX_PATH)) return [];
  const src = readFileSync(SRC_INDEX_PATH, "utf-8");
  const names: string[] = [];
  const re = /server\.registerTool\(\s*"([^"]+)"/g;
  let match;
  while ((match = re.exec(src)) !== null) {
    names.push(match[1]);
  }
  return names;
}

export function deriveProviderSlugs(): string[] {
  if (!existsSync(CONFIG_PATH)) return [];
  try {
    const config = JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
    const providers = config.providers || {};
    return Object.keys(providers).filter((slug) => !PROVIDER_EXCLUSIONS.has(slug));
  } catch {
    return [];
  }
}

export interface Heading {
  line: number;
  level: number;
  title: string;
}

export interface Link {
  line: number;
  text: string;
  url: string;
}

export interface Blockquote {
  line: number;
  content: string;
}

export interface BulletList {
  startLine: number;
  items: string[];
}

export function readReadme(): string {
  if (!existsSync(PROSE_README_PATH)) {
    console.error(`README.md not found at ${PROSE_README_PATH}`);
    process.exit(1);
  }
  return readFileSync(PROSE_README_PATH, "utf-8");
}

export function extractHeadings(text: string): Heading[] {
  const headings: Heading[] = [];
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^(#{1,6})\s+(.+)/);
    if (match) {
      headings.push({
        line: i + 1,
        level: match[1].length,
        title: match[2].trim(),
      });
    }
  }
  return headings;
}

export function extractLinks(text: string): Link[] {
  const links: Link[] = [];
  const lines = text.split("\n");
  const linkRe = /\[([^\]]+)\]\(([^)]+)\)/g;
  for (let i = 0; i < lines.length; i++) {
    let match;
    while ((match = linkRe.exec(lines[i])) !== null) {
      links.push({ line: i + 1, text: match[1], url: match[2] });
    }
  }
  return links;
}

export function extractBlockquotes(text: string): Blockquote[] {
  const quotes: Blockquote[] = [];
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed.startsWith(">")) {
      quotes.push({ line: i + 1, content: trimmed.replace(/^>\s*/, "") });
    }
  }
  return quotes;
}

export function extractBulletLists(text: string): BulletList[] {
  const lists: BulletList[] = [];
  const lines = text.split("\n");
  let inList = false;
  let currentList: string[] = [];
  let startLine = 0;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    const isBullet = /^[-*+]\s/.test(trimmed);
    if (isBullet) {
      if (!inList) {
        inList = true;
        currentList = [];
        startLine = i + 1;
      }
      currentList.push(trimmed.replace(/^[-*+]\s+/, ""));
    } else if (trimmed.length === 0 || trimmed.startsWith("#") || trimmed.startsWith("|") || trimmed.startsWith("```")) {
      if (inList && currentList.length > 0) {
        lists.push({ startLine, items: currentList });
      }
      inList = false;
      currentList = [];
    }
  }
  if (inList && currentList.length > 0) {
    lists.push({ startLine, items: currentList });
  }
  return lists;
}

export function proseLines(text: string): { line: number; content: string }[] {
  const lines = text.split("\n");
  const result: { line: number; content: string }[] = [];
  let inCodeBlock = false;
  let inHtmlComment = false;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed.startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (trimmed.startsWith("<!--")) {
      inHtmlComment = true;
      continue;
    }
    if (trimmed.endsWith("-->")) {
      inHtmlComment = false;
      continue;
    }
    if (inCodeBlock || inHtmlComment) continue;
    if (trimmed.startsWith("#") || trimmed.startsWith("|") || trimmed.startsWith(">") ||
        trimmed.startsWith("[!")) {
      continue;
    }
    if (trimmed.length === 0) continue;
    result.push({ line: i + 1, content: lines[i] });
  }
  return result;
}

export function proseOnly(text: string): string {
  return proseLines(text).map((p) => p.content).join("\n");
}

export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
