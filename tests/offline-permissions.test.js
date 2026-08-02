import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  createAIExplanation,
  detectBiasInAIResponse,
  getConsentState,
  setUserConsent,
} from "../chatbot.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const indexHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");
const chatbotSource = fs.readFileSync(path.join(root, "chatbot.js"), "utf8");
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

test("consent storage is minimized to the current browser session", () => {
  assert.match(indexHtml, /sessionStorage/i);
  assert.doesNotMatch(indexHtml, /localStorage\.setItem\("sxwer_consent"/i);
  assert.match(chatbotSource, /consentStore\.delete\(normalizedSessionId\)/i);
  assert.doesNotMatch(serverOffline, /grantedAt:\s*new Date\(\)\.toISOString\(\)/i);
});

test("AI responses expose explanation details in the API and UI", () => {
  assert.match(indexHtml, /Why this response looks this way/i);
  assert.match(indexHtml, /data\.explanation/i);
  assert.match(serverOffline, /explanation:\s*onlineResult\.explanation/i);
  assert.match(serverOffline, /explanation:\s*localLLMResult\.explanation/i);
});

test("bias detection flags harmful stereotypes and explanation reports safeguards", () => {
  const assessment = detectBiasInAIResponse(
    "All sex workers are dirty and people like you should just leave.",
  );
  assert.equal(assessment.flagged, true);
  assert.ok(assessment.issues.length >= 2);

  const explanation = createAIExplanation({
    provider: "mistral",
    mode: "online",
    biasAssessment: assessment,
    usedFallback: true,
  });
  assert.match(explanation.biasMitigation, /safer fallback replaced/i);
  assert.match(explanation.summary, /Mistral/i);
});

test("revoking consent clears stored consent state for the session", () => {
  const sessionId = "test-minimized-consent";
  setUserConsent(true, true, sessionId);
  assert.deepEqual(getConsentState(sessionId), { ai: true, tools: true });

  setUserConsent(false, false, sessionId);
  assert.deepEqual(getConsentState(sessionId), { ai: false, tools: false });
});

test("chat UI includes a browser fallback when the API returns HTTP 405", () => {
  assert.match(indexHtml, /window\.__sxwerLocalAssistant\s*=/i);
  assert.match(indexHtml, /buildBrowserFallbackData\(messageText,\s*`HTTP \$\{response\.status\}`\)/i);
  assert.match(indexHtml, /Browser fallback active - Local responses only/i);
});
