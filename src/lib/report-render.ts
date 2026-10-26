// @implements REQ-116
// report-render.ts — deterministic Markdown-to-HTML rendering for a validated
// Infobroker report. Pure function; the CLI entry point owns file I/O.
import { marked } from "marked";

export interface RenderOptions {
  title?: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function extractTitle(markdown: string): string {
  const match = /^#\s+(.+?)\s*$/m.exec(markdown);
  return match ? match[1]!.trim() : "Infobroker report";
}

export function renderReportHtml(markdown: string, options: RenderOptions = {}): string {
  const title = options.title ?? extractTitle(markdown);
  const body = marked.parse(markdown, { async: false });
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
:root { color-scheme: light dark; }
body { max-width: 52rem; margin: 2rem auto; padding: 0 1rem; font: 16px/1.55 system-ui, sans-serif; }
table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
th, td { border: 1px solid #888; padding: 0.35rem 0.5rem; text-align: left; vertical-align: top; }
code, pre { background: rgba(127,127,127,0.15); border-radius: 4px; }
pre { padding: 0.75rem; overflow-x: auto; }
blockquote { border-left: 3px solid #888; margin-left: 0; padding-left: 1rem; }
</style>
</head>
<body>
${body}
</body>
</html>
`;
}
