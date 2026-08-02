import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const indexHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");
const serverOffline = fs.readFileSync(
  path.join(root, "server-offline.js"),
  "utf8",
);

test("offline permissions UI exposes explicit local access choices", () => {
  assert.match(indexHtml, /Allow local-only access/i);
  assert.match(indexHtml, /No, keep private/i);
  assert.match(indexHtml, /Offline local access needs your permission/i);
});

test("chat UI renders an initial assistant message in the messages container", () => {
  assert.match(
    indexHtml,
    /<div[\s\S]*id="messages"[\s\S]*class="messages"[\s\S]*>\s*<div class="message assistant">\s*<div class="message-content">/i,
  );
  assert.match(indexHtml, /Hello\. I'm here to listen without judgment\./i);
});

test("server exposes a local-permissions endpoint and gating", () => {
  assert.match(serverOffline, /\/api\/local-permissions/i);
  assert.match(serverOffline, /requiresLocalPermission/i);
});

test("sherlock consent flow stores pending usernames and returns consent type", () => {
  assert.match(serverOffline, /pendingSherlockStore\s*=\s*new Map\(\)/i);
  assert.match(serverOffline, /pendingSherlockStore\.set\(sessionId,\s*username\)/i);
  assert.match(serverOffline, /consentType:\s*"sherlock"/i);
});

test("online mode is only active when server policy and API config allow it", () => {
  assert.match(serverOffline, /function shouldUseOnlineApi\(requestedMode\)/i);
  assert.match(serverOffline, /offline:\s*!onlineApiActive/i);
  assert.match(serverOffline, /online:\s*onlineApiActive/i);
});

test("chat log and controls include accessibility attributes", () => {
  assert.match(indexHtml, /id="messages"[\s\S]*role="log"/i);
  assert.match(indexHtml, /aria-relevant="additions text"/i);
  assert.match(indexHtml, /id="moxie-paperclip"[\s\S]*role="button"/i);
  assert.match(indexHtml, /id="moxie-paperclip"[\s\S]*tabindex="0"/i);
});

test("granting AI consent does not auto-resend the prior message", () => {
  assert.doesNotMatch(indexHtml, /sendMessage\(lastUserMessage\)/i);
  assert.match(indexHtml, /AI consent granted\. Send a message when you're ready\./i);
});

test("chat UI includes a browser fallback when the API returns HTTP 405", () => {
  assert.match(indexHtml, /window\.__sxwerLocalAssistant\s*=/i);
  assert.match(indexHtml, /buildBrowserFallbackData\(messageText,\s*`HTTP \$\{response\.status\}`\)/i);
  assert.match(indexHtml, /Browser fallback active - Local responses only/i);
});
