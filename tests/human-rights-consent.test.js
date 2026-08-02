import assert from "node:assert/strict";
import test from "node:test";
import {
  getConsentDashboard,
  revokeConsentScopes,
  setConsentState,
  updateConsentFromLegacy,
} from "../services/human-rights/versionedConsentService.js";
import {
  buildDataManagerSnapshot,
  buildExportPackage,
} from "../services/human-rights/dataManagerService.js";
import {
  buildResponseTransparency,
  getLatestTransparencyRecord,
} from "../services/human-rights/transparencyService.js";
import {
  getAuditSummary,
  getAuditTimeline,
  recordAuditEvent,
} from "../services/human-rights/auditService.js";

test("versioned consent tracks policy metadata and granular scopes", () => {
  const sessionId = "human-rights-consent-test";
  const state = setConsentState(sessionId, {
    scopes: {
      ai: true,
      internet: true,
      sherlock: false,
      microphone: false,
    },
    reason: "User explicitly enabled online AI only.",
    aiProvider: "mistral",
    expiry: "2026-12-31T00:00:00.000Z",
  });

  assert.equal(state.policyVersion, "2.0.0");
  assert.equal(state.schemaVersion, "2026-08-human-rights");
  assert.equal(state.scopes.ai, true);
  assert.equal(state.scopes.internet, true);
  assert.equal(state.legacy.ai, true);
  assert.equal(state.legacy.tools, false);
  assert.match(state.hash, /^[a-f0-9]{64}$/i);

  const dashboard = getConsentDashboard(sessionId);
  assert.ok(dashboard.history.length >= 1);
  assert.equal(dashboard.current.aiProvider, "mistral");
});

test("legacy consent updates and revocation keep backward compatibility", () => {
  const sessionId = "human-rights-legacy-test";
  const granted = updateConsentFromLegacy(sessionId, {
    ai: true,
    tools: true,
    reason: "Legacy command flow granted AI and tools.",
    aiProvider: "local",
  });

  assert.equal(granted.legacy.ai, true);
  assert.equal(granted.legacy.tools, true);
  assert.equal(granted.scopes.resources, true);
  assert.equal(granted.scopes.sherlock, true);

  const revoked = revokeConsentScopes(sessionId, [
    "ai",
    "resources",
    "sherlock",
    "internet",
  ]);
  assert.equal(revoked.scopes.ai, false);
  assert.equal(revoked.legacy.ai, false);
  assert.equal(revoked.legacy.tools, false);
});

test("data manager and transparency export stay inspectable", () => {
  const sessionId = "human-rights-export-test";
  recordAuditEvent(
    sessionId,
    "consent.updated",
    "Consent changed for export test.",
  );
  const transparency = buildResponseTransparency({
    sessionId,
    message: "What happened?",
    provider: "ollama",
    model: "ollama-local",
    mode: "offline",
    aiUsed: true,
    sentData: ["Message text kept on device."],
    confidence: "medium",
    limitations: ["AI may be incomplete."],
  });

  const consentDashboard = getConsentDashboard(sessionId);
  const dataManager = buildDataManagerSnapshot(sessionId, {
    consentDashboard,
    auditSummary: getAuditSummary(sessionId),
    localPermissions: { offline: true, scope: "offline" },
    latestTransparency: transparency,
  });
  const exportPackage = buildExportPackage(sessionId, {
    consentDashboard,
    dataManager,
    auditTimeline: getAuditTimeline(sessionId),
    latestTransparency: getLatestTransparencyRecord(sessionId),
  });

  assert.ok(dataManager.categories.length >= 11);
  assert.match(dataManager.categories[0].title, /Identity data/i);
  assert.equal(exportPackage.latestTransparency.disclosure.provider, "ollama");
  assert.ok(exportPackage.auditTimeline.length >= 1);
});
