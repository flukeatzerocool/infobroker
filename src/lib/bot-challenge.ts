// @implements REQ-021f
// Anti-bot challenge detection for the content_fetch renderer chain.
// A renderer that returns an anti-bot verification page rather than the
// target page is treated as a failed render so the chain can fall through
// to the next renderer (REQ-021f). Detection has three tiers: long,
// distinctive title markers are decisive on their own; distinctive body
// markers are decisive; and weak markers (a topic word in the title, or a
// challenge script) count only when the page has almost no textual content.

const STRONG_TITLE_MARKERS: RegExp[] = [
  /just a moment/i,
  /attention required/i,
  /performing security verification/i,
  /verify you(?: are|'re)(?: a)? human/i,
  /checking your browser/i,
  /access denied/i,
  /sorry, you have been blocked/i,
];

// "CAPTCHA" is also an ordinary topic word ("How CAPTCHA works"), so it names a
// challenge only when the page carries almost no text. MIN_TEXT_FOR_SCRIPT_SIGNAL
// gates both weak families.
const WEAK_TITLE_MARKERS: RegExp[] = [/captcha/i];

const DISTINCTIVE_BODY_MARKERS: RegExp[] = [
  /performing security verification/i,
  /security service to protect against malicious bots/i,
  /checking your browser before accessing/i,
  /verifying you are human/i,
  /enable javascript and cookies to continue/i,
  /waiting for [a-z0-9-]+\.cloudflare\.com/i,
];

const CHALLENGE_SCRIPT_MARKERS: RegExp[] = [
  /challenge-platform/i,
  /cf-chl/i,
];

const MIN_TEXT_FOR_SCRIPT_SIGNAL = 400;

function extractTitle(content: string): string {
  const html = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(content);
  if (html) return stripTags(html[1]).trim();
  const jina = /^Title:\s*(.+)$/m.exec(content);
  if (jina) return jina[1].trim();
  const heading = /^#+\s+(.+)$/m.exec(content);
  if (heading) return heading[1].trim();
  return "";
}

function stripTags(text: string): string {
  return text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function visibleTextLength(content: string): number {
  return stripTags(
    content.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, ""),
  ).length;
}

export function isBotChallenge(content: string): boolean {
  if (!content || content.length < 20) return false;
  const title = extractTitle(content);
  if (STRONG_TITLE_MARKERS.some((re) => re.test(title))) return true;
  if (DISTINCTIVE_BODY_MARKERS.some((re) => re.test(content))) return true;

  // Weak markers need a page that is almost entirely chrome: a topic word in
  // the title or a challenge script proves nothing on a page with real prose.
  if (visibleTextLength(content) >= MIN_TEXT_FOR_SCRIPT_SIGNAL) return false;
  if (WEAK_TITLE_MARKERS.some((re) => re.test(title))) return true;
  if (CHALLENGE_SCRIPT_MARKERS.some((re) => re.test(content))) return true;
  return false;
}