import crypto from "node:crypto";

const CONSENT_POLICY_VERSION = "2.0.0";
const CONSENT_SCHEMA_VERSION = "2026-08-human-rights";
const APPLICATION_VERSION = process.env.npm_package_version || "1.0.0";
const DEFAULT_AI_PROVIDER = "none";

const CONSENT_SCOPES = Object.freeze({
  ai: "ai",
  voice: "voice",
  microphone: "microphone",
  internet: "internet",
  sherlock: "sherlock",
  resources: "resources",
  analytics: "analytics",
  blockchain: "blockchain",
  futureIntegrations: "futureIntegrations",
});

const DEFAULT_SCOPES = Object.freeze(
  Object.values(CONSENT_SCOPES).reduce((accumulator, scope) => {
    accumulator[scope] = false;
    return accumulator;
  }, {}),
);

const consentStateStore = new Map();
const consentHistoryStore = new Map();

function normalizeSessionId(sessionId = "default") {
  const normalized = String(sessionId || "default").trim();
  return normalized || "default";
}

function normalizeScopes(partialScopes = {}) {
  const scopes = { ...DEFAULT_SCOPES };

  for (const [scope, value] of Object.entries(partialScopes || {})) {
    if (scope in scopes) {
      scopes[scope] = Boolean(value);
    }
  }

  return Object.freeze(scopes);
}

function buildConsentHash(payload) {
  return crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function getConsentState(sessionId = "default") {
  return Object.freeze({
    ...(consentStateStore.get(normalizeSessionId(sessionId)) || {
      scopes: { ...DEFAULT_SCOPES },
      status: "not-set",
      lastUpdatedAt: null,
      expiresAt: null,
      policyVersion: CONSENT_POLICY_VERSION,
      schemaVersion: CONSENT_SCHEMA_VERSION,
      applicationVersion: APPLICATION_VERSION,
      aiProvider: DEFAULT_AI_PROVIDER,
      legacy: Object.freeze({ ai: false, tools: false }),
      activeScopes: Object.freeze([]),
      eventCount: 0,
    }),
  });
}

function getConsentHistory(sessionId = "default") {
  return Object.freeze([...(consentHistoryStore.get(normalizeSessionId(sessionId)) || [])]);
}

function buildLegacyConsent(scopes) {
  return Object.freeze({
    ai: Boolean(scopes.ai),
    tools: Boolean(scopes.sherlock || scopes.resources),
  });
}

function buildConsentEvent(sessionId, {
  scopes = {},
  reason = "User updated consent choices.",
  aiProvider = DEFAULT_AI_PROVIDER,
  permissionScope = "session",
  expiry = null,
  signature = "unsigned-local-session",
  status = "granted",
} = {}) {
  const normalizedSessionId = normalizeSessionId(sessionId);
  const normalizedScopes = normalizeScopes(scopes);
  const timestamp = new Date().toISOString();
  const eventPayload = {
    sessionId: normalizedSessionId,
    timestamp,
    policyVersion: CONSENT_POLICY_VERSION,
    schemaVersion: CONSENT_SCHEMA_VERSION,
    applicationVersion: APPLICATION_VERSION,
    reason,
    aiProvider,
    permissionScope,
    expiry,
    signature,
    status,
    scopes: normalizedScopes,
  };

  return Object.freeze({
    ...eventPayload,
    hash: buildConsentHash(eventPayload),
  });
}

function setConsentState(sessionId = "default", options = {}) {
  const event = buildConsentEvent(sessionId, options);
  const normalizedSessionId = normalizeSessionId(sessionId);
  const history = consentHistoryStore.get(normalizedSessionId) || [];
  history.push(event);
  consentHistoryStore.set(normalizedSessionId, history);

  const activeScopes = Object.keys(event.scopes).filter((scope) => event.scopes[scope]);
  const consentState = Object.freeze({
    scopes: event.scopes,
    status: event.status,
    lastUpdatedAt: event.timestamp,
    expiresAt: event.expiry,
    policyVersion: event.policyVersion,
    schemaVersion: event.schemaVersion,
    applicationVersion: event.applicationVersion,
    aiProvider: event.aiProvider,
    reason: event.reason,
    permissionScope: event.permissionScope,
    signature: event.signature,
    hash: event.hash,
    legacy: buildLegacyConsent(event.scopes),
    activeScopes: Object.freeze(activeScopes),
    eventCount: history.length,
  });

  consentStateStore.set(normalizedSessionId, consentState);
  return consentState;
}

function updateConsentFromLegacy(sessionId = "default", { ai = false, tools = false, reason, aiProvider, expiry } = {}) {
  return setConsentState(sessionId, {
    scopes: {
      ai,
      sherlock: tools,
      resources: tools,
      internet: aiProvider && aiProvider !== DEFAULT_AI_PROVIDER,
    },
    reason: reason || (ai || tools ? "Legacy consent command granted access." : "Legacy consent command revoked access."),
    aiProvider: aiProvider || DEFAULT_AI_PROVIDER,
    expiry: expiry || null,
    status: ai || tools ? "granted" : "revoked",
  });
}

function revokeConsentScopes(sessionId = "default", scopes = Object.keys(DEFAULT_SCOPES), reason = "User revoked consent.") {
  const currentState = getConsentState(sessionId);
  const nextScopes = { ...DEFAULT_SCOPES, ...(currentState.scopes || {}) };
  for (const scope of scopes) {
    if (scope in nextScopes) {
      nextScopes[scope] = false;
    }
  }

  return setConsentState(sessionId, {
    scopes: nextScopes,
    reason,
    aiProvider: currentState.aiProvider || DEFAULT_AI_PROVIDER,
    status: Object.values(nextScopes).some(Boolean) ? "updated" : "revoked",
  });
}

function clearConsentHistory(sessionId = "default") {
  const normalizedSessionId = normalizeSessionId(sessionId);
  consentHistoryStore.delete(normalizedSessionId);
  consentStateStore.delete(normalizedSessionId);
  return true;
}

function getConsentDashboard(sessionId = "default") {
  const current = getConsentState(sessionId);
  const history = getConsentHistory(sessionId);
  return Object.freeze({
    current,
    history,
    defaults: Object.freeze({
      blockchain: false,
      internet: false,
      ai: false,
    }),
    scopeDefinitions: Object.freeze({
      ai: "Allow AI-assisted replies.",
      voice: "Allow voice output and voice-adjacent features.",
      microphone: "Allow microphone access when explicitly requested.",
      internet: "Allow online network requests for AI or resource lookups.",
      sherlock: "Allow the Sherlock safety verification workflow.",
      resources: "Allow resource lookup and support-directory retrieval.",
      analytics: "Allow analytics and usage measurement.",
      blockchain: "Allow optional consent-hash recording on a blockchain provider.",
      futureIntegrations: "Allow future opt-in integrations after review.",
    }),
  });
}

export {
  APPLICATION_VERSION,
  CONSENT_POLICY_VERSION,
  CONSENT_SCHEMA_VERSION,
  CONSENT_SCOPES,
  DEFAULT_SCOPES,
  clearConsentHistory,
  getConsentDashboard,
  getConsentHistory,
  getConsentState,
  revokeConsentScopes,
  setConsentState,
  updateConsentFromLegacy,
};
