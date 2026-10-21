#!/usr/bin/env node
// event-stream.mjs — shared helpers for reading the opencode JSON event stream
// from agentic test runs. Exports extractAssistantText, extractFinalAssistantText,
// extractAllAssistantText, and extractToolOrder.

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

// Split the stream into assistant text blocks. A block is assistant text only:
// an explicit role "assistant" or a missing role (top-level `.text`) counts;
// an explicit "user"/"system"/"tool" role never does, so loaded skill content
// echoed into the session cannot satisfy a completion token. Message
// boundaries are the part's `messageID` when present, else non-text events and
// role transitions.
function assistantTextBlocks(raw) {
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
  return blocks;
}

// Extract the ASSISTANT's FINAL message text only. A completion token that
// appears in loaded skill content earlier in the stream cannot satisfy it.
// Returns "" when no assistant text is found — an honest failure, never a
// false pass.
export function extractFinalAssistantText(raw) {
  const blocks = assistantTextBlocks(raw);
  for (let i = blocks.length - 1; i >= 0; i--) {
    if (blocks[i].trim()) return blocks[i];
  }
  return "";
}

// Extract every assistant text block in order. Used when a skill emits a
// completion token in an intermediate message (for example a phase gate)
// rather than only in its final reply. User/system/tool text is excluded.
export function extractAllAssistantText(raw) {
  return assistantTextBlocks(raw)
    .filter((block) => block.trim())
    .join("\n");
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

// Extract a bounded digest of the tools a run called — name, truncated input,
// truncated output — for feeding an evidence-aware critic/rubric without the
// full transcript. Caps keep the prompt small and deterministic in shape.
export function extractToolEvidence(raw, { perField = 400, maxTools = 20 } = {}) {
  const lines = [];
  let n = 0;
  for (const line of raw.split("\n")) {
    let ev;
    try { ev = JSON.parse(line); } catch { continue; }
    if (ev?.type !== "tool_use" && ev?.part?.type !== "tool") continue;
    const part = ev?.part ?? ev;
    const tool = part?.tool ?? ev?.tool;
    if (typeof tool !== "string") continue;
    if (n >= maxTools) break;
    n++;
    const state = part?.state ?? {};
    const input = state.input ? JSON.stringify(state.input) : "";
    const output = typeof state.output === "string" ? state.output : state.output ? JSON.stringify(state.output) : "";
    const bits = [`${n}. ${tool}`];
    if (input) bits.push(`input=${input.slice(0, perField)}`);
    if (output) bits.push(`output=${output.slice(0, perField)}`);
    lines.push(bits.join("  "));
  }
  return lines.join("\n");
}
