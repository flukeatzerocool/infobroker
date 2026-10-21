// event-stream.test.mjs — Deterministic tests for the shared opencode event
// stream helpers. Run via `npm run check-skill-harness` (node --test).

import test from "node:test";
import assert from "node:assert/strict";
import {
  extractAllAssistantText,
  extractFinalAssistantText,
} from "../lib/event-stream.mjs";

const STREAM = [
  { part: { type: "text", text: "research-scoping passed.", role: "assistant", messageID: "m1" } },
  { type: "tool_use", tool: "infobroker_search_web" },
  { part: { type: "text", text: "research-analysis complete.", role: "assistant", messageID: "m2" } },
  { type: "tool_use", tool: "infobroker_fetch_page" },
  { part: { type: "text", text: "analysis-loop complete.", role: "assistant", messageID: "m3" } },
].map((event) => JSON.stringify(event)).join("\n");

test("all-assistant text includes intermediate phase tokens", () => {
  const text = extractAllAssistantText(STREAM);
  assert.match(text, /research-scoping passed\./);
  assert.match(text, /research-analysis complete\./);
  assert.match(text, /analysis-loop complete\./);
});

test("final-message text omits intermediate phase tokens", () => {
  const text = extractFinalAssistantText(STREAM);
  assert.match(text, /analysis-loop complete\./);
  assert.doesNotMatch(text, /research-scoping passed\./);
});

test("user-role skill echo cannot satisfy either extractor", () => {
  const stream = [
    { part: { type: "text", text: "TOKEN-FROM-SKILL", role: "user", messageID: "u1" } },
    { part: { type: "text", text: "final answer", role: "assistant", messageID: "m1" } },
  ].map((event) => JSON.stringify(event)).join("\n");
  assert.doesNotMatch(extractAllAssistantText(stream), /TOKEN-FROM-SKILL/);
  assert.doesNotMatch(extractFinalAssistantText(stream), /TOKEN-FROM-SKILL/);
});

test("a top-level text event with no role still counts as assistant", () => {
  const stream = [JSON.stringify({ text: "no-role final" })].join("\n");
  assert.equal(extractFinalAssistantText(stream), "no-role final");
  assert.equal(extractAllAssistantText(stream), "no-role final");
});
