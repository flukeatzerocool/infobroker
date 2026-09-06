// @implements REQ-021f
import { describe, it, expect } from "vitest";
import { isBotChallenge } from "./bot-challenge.js";

const CLOUDFLARE_HTML = `<!doctype html>
<html><head><title>Just a moment...</title>
<script src="/cdn-cgi/challenge-platform/h/b/orchestrate/jsch/v1?"></script>
</head><body>
<div class="main-wrapper" role="main"><h1>Checking your browser before accessing starwars.fandom.com.</h1>
<p>This process is automatic. Your browser will redirect to your requested content shortly.</p>
<p>Please allow up to 5 seconds…</p></div>
<script>window._cf_chl_opt={cvId:"2",cType:"managed",cRay:"x",cVer:"c1"}</script>
</body></html>`;

const JINA_MARKDOWN_WALL = `Title: starwars.fandom.com

URL Source: https://starwars.fandom.com/wiki/Bothan_Spynet

Warning: This page maybe requiring CAPTCHA, please make sure you are authorized to access this page.

Markdown Content:

## starwars.fandom.com

## Performing security verification

This website uses a security service to protect against malicious bots. This page is displayed while the website verifies you are not a bot.`;

describe("isBotChallenge", () => {
  it("detects a Cloudflare HTML challenge page", () => {
    expect(isBotChallenge(CLOUDFLARE_HTML)).toBe(true);
  });

  it("detects a Jina-rendered challenge page via body markers", () => {
    expect(isBotChallenge(JINA_MARKDOWN_WALL)).toBe(true);
  });

  it("detects a title-only challenge page", () => {
    expect(isBotChallenge("<html><head><title>Attention Required! | Cloudflare</title></head><body>short</body></html>")).toBe(true);
  });

  it("detects a challenge when the title carries a captcha marker", () => {
    expect(isBotChallenge("Title: Verify you are human\n\nSome verification text.")).toBe(true);
  });

  it("does not flag a normal page that merely mentions captcha in prose", () => {
    const article = `# How the signup flow works
The login form uses a captcha to keep bots out. After solving it, the user is
redirected to their dashboard. This page has plenty of real content, several
paragraphs of documentation, and a normal title that mentions neither
verification nor challenges.`;
    expect(isBotChallenge(article)).toBe(false);
  });

  it("does not flag a normal article page", () => {
    const article = `<html><head><title>Bothan Spynet | Wookieepedia | Fandom</title></head>
<body><article>The Bothan Spynet was a well-organized intelligence network and an
extension of the Bothan Way that developed in the millennia before the Great Sith
War. It collected intelligence on potential political enemies, which to Bothans
included all individuals, species and governments. The network consisted of
thousands of spies, informants and data collection droids feeding a centralized
command structure. It operated as an underground system that bought and sold
information.</article></body></html>`;
    expect(isBotChallenge(article)).toBe(false);
  });

  it("does not flag a Cloudflare-Turnstile page with real content", () => {
    const article = `<html><head><title>Sign in | Example</title>
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
</head><body><h1>Sign in to your account</h1>
<p>Enter your email and password to continue. This documentation page explains
the sign-in flow in detail, covering password resets, two-factor authentication,
account recovery, session management, and troubleshooting common errors that
users encounter when accessing protected resources across the organization.</p>
<div class="cf-turnstile" data-sitekey="0x4AAAAAAABC"></div></body></html>`;
    expect(isBotChallenge(article)).toBe(false);
  });

  it("returns false for empty or tiny content", () => {
    expect(isBotChallenge("")).toBe(false);
    expect(isBotChallenge("short")).toBe(false);
  });
});