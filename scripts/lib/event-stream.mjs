#!/usr/bin/env node
// event-stream.mjs — shared helpers for reading the opencode JSON event stream
// from agentic test runs. Exports extractAssistantText and extractToolOrder.

// Extract assistant text from the JSON event stream (opencode --format json).
// The stream is newline-delimited JSON; assistant text parts carry type "text"
// and a `.text` field on `ev.part` (with a fallback to a top-level `.text`).
export function extractAssistantText(raw) {
  const parts = [];
  for (const line of raw.split("\n")) {
    let ev;
    try { ev = JSON.parse(line); } catch { continue; }
    const part = ev?.part;
    if (part?.type === "text" && typeof part.text === "string") parts.push(part.text);
    else if (typeof ev?.text === "string") parts.push(ev.text);
  }
  return parts.join("\n");
}

// Extract the ordered list of tool names a run called. Tool names sit on
// either `ev.tool` (a "tool_use" event) or `ev.part.tool` (a "tool" part).
export function extractToolOrder(raw) {
  const tools = [];
  for (const line of raw.split("\n")) {
    let ev;
    try { ev = JSON.parse(line); } catch { continue; }
    if (ev?.type === "tool_use" || ev?.part?.type === "tool") {
      const t = ev?.tool ?? ev?.part?.tool;
      if (typeof t === "string") tools.push(t);
    }
  }
  return tools;
}
