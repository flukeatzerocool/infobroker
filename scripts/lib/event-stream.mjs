#!/usr/bin/env node
// event-stream.mjs — shared helpers for reading the opencode JSON event stream
// from agentic test runs. Exports extractAssistantText, extractFinalAssistantText,
// and extractToolOrder.

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

// Extract the ASSISTANT's FINAL message text only. Unlike extractAssistantText
// (which concatenates every text part in the stream, including skill content a
// harness echoes into the session), this returns only the text of the last
// assistant message — the agent's own final reply. A completion token that
// appears in loaded skill content earlier in the stream cannot satisfy it.
//
// Message boundaries are detected by the part's `messageID` when present,
// falling back to `role` transitions: a non-assistant text part (role "system",
// "tool", or "user") closes any open assistant block. Returns "" when no
// assistant text is found — an honest failure, never a false pass.
export function extractFinalAssistantText(raw) {
  const blocks = [];
  let current = [];
  let lastKey = "";

  for (const line of raw.split("\n")) {
    let ev;
    try { ev = JSON.parse(line); } catch { continue; }
    const part = ev?.part;

    const isPartText = part?.type === "text" && typeof part.text === "string";
    const isTopText = part == null && typeof ev?.text === "string";

    if (!isPartText && !isTopText) {
      // Any non-text event (tool_use, tool result, user/system message)
      // closes the current assistant text run — assistant text blocks are
      // separated by tool calls and other messages in a real stream.
      if (current.length) { blocks.push(current.join("\n")); current = []; }
      lastKey = "";
      continue;
    }

    const role = part?.role ?? (isTopText ? "assistant" : undefined);
    const key = part?.messageID ?? ev?.messageID ?? "";

    const isAssistant = role === undefined || role === "assistant";
    const newBlock = !isAssistant || (key && current.length > 0 && key !== lastKey);

    if (newBlock && current.length) { blocks.push(current.join("\n")); current = []; }

    if (isAssistant) {
      if (key) lastKey = key;
      current.push(isPartText ? part.text : ev.text);
    }
  }
  if (current.length) blocks.push(current.join("\n"));

  for (let i = blocks.length - 1; i >= 0; i--) {
    if (blocks[i].trim()) return blocks[i];
  }
  return "";
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
