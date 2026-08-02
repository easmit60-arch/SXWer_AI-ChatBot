function buildBooleanStatus(value, grantedLabel, deniedLabel = "Not enabled") {
  return value ? grantedLabel : deniedLabel;
}

function createDataCategory(id, title, values) {
  return Object.freeze({ id, title, ...values });
}

function buildDataManagerSnapshot(sessionId = "default", context = {}) {
  const consentDashboard = context.consentDashboard || {
    current: { scopes: {}, activeScopes: [] },
    history: [],
  };
  const auditSummary = context.auditSummary || { totalEvents: 0 };
  const localPermissions = context.localPermissions || {
    offline: false,
    scope: "offline",
  };
  const latestTransparency = context.latestTransparency || null;
  const sessionIdentifier = String(sessionId || "default");

  const categories = Object.freeze([
    createDataCategory("identity", "Identity data", {
      collected: [
        "Anonymous session identifier",
        "No name, email, or phone by default",
      ],
      why: "Keep the current local session isolated without requiring a profile.",
      whereStored: "In-memory session map on the local server.",
      retention: "Up to 24 hours of inactivity.",
      encryption: "Transport protections and optional E2E chat encryption.",
      access:
        "Only the current local server process and the user in this session.",
      export: "Included in session exports.",
      delete: "Deleted by 'Delete My Data'.",
      revoke: "Session ends automatically or can be cleared manually.",
      currentState: `Current session ID: ${sessionIdentifier}`,
    }),
    createDataCategory("device", "Device data", {
      collected: [
        "Browser-supplied request metadata",
        "Local capability flags when needed",
      ],
      why: "Serve the UI and degrade gracefully across environments.",
      whereStored: "Transient request handling; not persisted by default.",
      retention: "Request lifetime only unless surfaced in an audit event.",
      encryption:
        "Protected in transit when HTTPS is used; not exported externally by default.",
      access: "Local app runtime.",
      export: "Not exported unless it appears in a consent or audit event.",
      delete: "Clears automatically when the request completes.",
      revoke: "Refuse optional device permissions and continue offline.",
      currentState: "Minimal transient handling only.",
    }),
    createDataCategory("location", "Location data", {
      collected: ["No GPS or precise location collection by default"],
      why: "Location is unnecessary for the default support experience.",
      whereStored: "Nowhere by default.",
      retention: "Not retained.",
      encryption: "Not applicable when not collected.",
      access: "No one.",
      export: "Nothing to export by default.",
      delete: "Nothing to delete by default.",
      revoke: "Continue using the app after refusing location access.",
      currentState: "Not collected.",
    }),
    createDataCategory("usage", "Usage data", {
      collected: [
        "Consent updates",
        "Feature selections",
        "Safety/audit milestones",
      ],
      why: "Support transparency, user-controlled auditing, and graceful recovery.",
      whereStored: "In-memory audit timeline.",
      retention: "Current session only.",
      encryption: "Protected by local process isolation; exportable on demand.",
      access: "User via dashboards and local runtime.",
      export: "Included in the human-rights export package.",
      delete: "Deleted by 'Delete My Data'.",
      revoke: "Disable analytics-related scopes and clear data.",
      currentState: `${auditSummary.totalEvents || 0} human-readable audit events in this session.`,
    }),
    createDataCategory("technical-logs", "Technical logs", {
      collected: ["Security events", "Consent events", "Export/delete actions"],
      why: "Provide accountability without storing conversation content by default.",
      whereStored: "In-memory audit timeline.",
      retention: "Current session only.",
      encryption: "Optional encrypted chat transport; no third-party log sink.",
      access: "User and local runtime.",
      export: "Included in export package.",
      delete: "Deleted by 'Delete My Data'.",
      revoke: "Revoke optional scopes and clear local records.",
      currentState: buildBooleanStatus(
        (auditSummary.totalEvents || 0) > 0,
        "Technical events recorded for transparency.",
        "No technical audit events recorded yet.",
      ),
    }),
    createDataCategory("behavioral", "Behavioral data", {
      collected: [
        "No profiling by default",
        "Optional consent scope for future analytics only",
      ],
      why: "Behavioral inference is disabled unless explicitly enabled.",
      whereStored: "Nowhere by default.",
      retention: "Not retained unless future analytics consent is granted.",
      encryption: "Would remain local-first and exportable if enabled.",
      access: "Nobody by default.",
      export: "Nothing to export by default.",
      delete: "Nothing to delete by default.",
      revoke: "Turn off the analytics scope at any time.",
      currentState: buildBooleanStatus(
        consentDashboard.current?.scopes?.analytics,
        "Optional analytics scope enabled.",
        "Behavioral profiling is off.",
      ),
    }),
    createDataCategory("communications", "Communication data", {
      collected: [
        "Messages you send in the current chat session",
        "Assistant replies shown to you",
      ],
      why: "Render the current conversation and explain the latest response.",
      whereStored: "Browser state and limited in-memory runtime state.",
      retention: "Current session; not written to blockchain.",
      encryption: "Optional end-to-end encryption for chat transport.",
      access: "You and the local runtime for the current session.",
      export:
        "Latest explainability record and consent/audit context are exportable.",
      delete: "Deleted by 'Delete My Data'.",
      revoke: "Stop chatting, refuse AI, or clear the session.",
      currentState: latestTransparency
        ? "Latest response transparency record available."
        : "No response transparency record yet.",
    }),
    createDataCategory("ai-history", "AI interaction history", {
      collected: [
        "Latest AI disclosure metadata",
        "Provider/mode/safeguard summary",
      ],
      why: "Explain why a response was shown and what data flow occurred.",
      whereStored: "In-memory transparency record for the current session.",
      retention: "Current session only.",
      encryption: "Same protections as the current chat channel.",
      access: "You via Explain This Response and export tools.",
      export: "Included in session export.",
      delete: "Deleted by 'Delete My Data'.",
      revoke: "Revoke AI consent and continue with local-only support.",
      currentState: latestTransparency
        ? latestTransparency.disclosure?.summary ||
          "AI transparency record available."
        : "No AI interaction history retained yet.",
    }),
    createDataCategory("sensor-permissions", "Sensor permissions", {
      collected: ["Granular consent choices for voice and microphone"],
      why: "Track permission state without silently activating sensors.",
      whereStored: "In-memory consent dashboard.",
      retention: "Current session only.",
      encryption: "Protected as local consent state.",
      access: "You and the local runtime.",
      export: "Included in consent export.",
      delete: "Deleted by 'Delete My Data'.",
      revoke: "Revoke voice or microphone scope at any time.",
      currentState: `Voice: ${buildBooleanStatus(consentDashboard.current?.scopes?.voice, "enabled", "off")}; microphone: ${buildBooleanStatus(consentDashboard.current?.scopes?.microphone, "enabled", "off")}; offline local access: ${buildBooleanStatus(localPermissions.offline, "enabled", "off")}.`,
    }),
    createDataCategory("metadata", "Metadata", {
      collected: [
        "Timestamps",
        "Consent versions",
        "Hash receipts",
        "Session-scoped identifiers",
      ],
      why: "Support versioned consent, auditability, and human-rights reporting.",
      whereStored:
        "In-memory consent and audit services; optional blockchain hashes only.",
      retention:
        "Current session locally; blockchain hashes are immutable if user opts in.",
      encryption: "Hashes for blockchain; local state kept in process memory.",
      access:
        "You, local runtime, and optional blockchain verifiers for hashes only.",
      export: "Included in export package.",
      delete:
        "Local copies deleted by 'Delete My Data'; on-chain hashes remain immutable by design.",
      revoke: "Disable blockchain and revoke consent at any time.",
      currentState: `${consentDashboard.current?.eventCount || 0} consent events tracked in this session.`,
    }),
    createDataCategory("telemetry", "Infrastructure telemetry", {
      collected: [
        "Rate-limit state",
        "Security header policy",
        "Service mode flags",
      ],
      why: "Keep the app secure and resilient without external analytics.",
      whereStored: "Server runtime configuration.",
      retention: "Current process lifetime.",
      encryption: "Not exported to third parties by default.",
      access: "Local operators and the user through Security Status.",
      export: "Policy summaries are exportable.",
      delete: "Resets when the app restarts or data is cleared.",
      revoke:
        "Continue using local-only mode even after refusing AI or online access.",
      currentState: buildBooleanStatus(
        consentDashboard.current?.scopes?.internet,
        "Online network access allowed by consent.",
        "Offline-first mode remains available.",
      ),
    }),
    createDataCategory("conversation-storage", "Conversation Storage", {
      collected: ["Current-session message flow metadata"],
      why: "Provide active conversation continuity during this session.",
      whereStored: "In-memory runtime and browser state.",
      retention: "Current session only.",
      encryption: "Optional end-to-end encryption in transit.",
      access: "User and local process only.",
      export: "Included in transparency export metadata.",
      delete: "Removed by Delete My Data.",
      revoke: "Stop chatting or end session.",
      currentState: "Enabled for current session context only.",
    }),
    createDataCategory("voice-storage", "Voice Storage", {
      collected: ["No voice recordings by default"],
      why: "Voice remains optional and consent-gated.",
      whereStored: "Not stored unless explicitly enabled in future workflows.",
      retention: "Not retained by default.",
      encryption: "N/A when disabled.",
      access: "No one by default.",
      export: "Nothing exported by default.",
      delete: "Nothing to delete by default.",
      revoke: "Keep voice scope disabled.",
      currentState: buildBooleanStatus(
        consentDashboard.current?.scopes?.voice,
        "Voice scope enabled.",
        "Voice scope disabled.",
      ),
    }),
    createDataCategory("prompt-storage", "Prompt Storage", {
      collected: ["Prompt previews only when ALLOW_PROMPTS=true"],
      why: "Improve explainability when explicitly allowed.",
      whereStored: "Transparency service in memory.",
      retention: "Current session only.",
      encryption: "In-memory local process protections.",
      access: "User-visible dashboards only.",
      export: "Included in export package when enabled.",
      delete: "Removed by Delete My Data.",
      revoke: "Set ALLOW_PROMPTS=false and clear session data.",
      currentState: "Prompt capture is disabled unless explicitly enabled.",
    }),
    createDataCategory("consent-storage", "Consent Storage", {
      collected: ["Consent scopes", "Policy version", "Consent timestamps"],
      why: "Enforce consent and revocation logic.",
      whereStored: "Versioned consent service in memory.",
      retention: "Current session.",
      encryption: "Local runtime protections.",
      access: "User and consent services.",
      export: "Included in consent and transparency exports.",
      delete: "Removed by Delete My Data.",
      revoke: "Revoke scopes at any time.",
      currentState: `${consentDashboard.current?.eventCount || 0} consent events in current session.`,
    }),
    createDataCategory("blockchain-storage", "Blockchain Storage", {
      collected: [
        "Hashes",
        "timestamps",
        "policy version",
        "wallet ID",
        "signature",
      ],
      why: "Optional immutable consent receipts.",
      whereStored: "Local ledger mirror and optional blockchain provider.",
      retention: "Local session plus immutable on-chain history when enabled.",
      encryption: "Hash-based records only; no raw conversation data.",
      access: "User and blockchain verifiers for receipts.",
      export: "Ledger export endpoint.",
      delete: "Local mirror can be cleared; on-chain records are immutable.",
      revoke: "Disable blockchain scope and revoke consent.",
      currentState: buildBooleanStatus(
        consentDashboard.current?.scopes?.blockchain,
        "Blockchain scope enabled.",
        "Blockchain scope disabled.",
      ),
    }),
    createDataCategory("cookies", "Cookies", {
      collected: ["Session and CSRF cookies"],
      why: "Secure local authentication and CSRF protection.",
      whereStored: "Browser cookie storage.",
      retention: "Session-scoped.",
      encryption: "HTTP-only/secure handling where supported.",
      access: "Browser and local server.",
      export: "Session export metadata only.",
      delete: "Clear browser session/cookies.",
      revoke: "End session.",
      currentState:
        "Session and CSRF cookie usage enabled for secure API calls.",
    }),
    createDataCategory("browser-storage", "Browser Storage", {
      collected: ["UI state", "session preferences"],
      why: "Maintain current-session usability.",
      whereStored: "Browser storage (session/local as applicable).",
      retention: "Session-scoped where possible.",
      encryption: "Browser-managed storage only.",
      access: "User browser context.",
      export: "Human-rights export metadata.",
      delete: "Delete My Data and browser clear actions.",
      revoke: "Use private mode or clear storage.",
      currentState: "Minimal browser storage used for session continuity.",
    }),
    createDataCategory("indexeddb", "IndexedDB", {
      collected: ["No IndexedDB data by default"],
      why: "IndexedDB is reserved for future offline expansions.",
      whereStored: "Not used by default.",
      retention: "None by default.",
      encryption: "N/A when unused.",
      access: "No one by default.",
      export: "No IndexedDB export by default.",
      delete: "No IndexedDB deletion required by default.",
      revoke: "Continue with IndexedDB disabled.",
      currentState: "Not in active use.",
    }),
    createDataCategory("session-storage", "Session Storage", {
      collected: [
        "Consent snapshot",
        "local permission snapshot",
        "session ID",
      ],
      why: "Preserve settings for current browser session.",
      whereStored: "Browser sessionStorage.",
      retention: "Until tab/session ends.",
      encryption: "Browser-managed.",
      access: "Current browser session only.",
      export: "Represented in export metadata.",
      delete: "Cleared by Delete My Data and tab close.",
      revoke: "Revoke scopes and clear session.",
      currentState: "In use for session-scoped consent defaults.",
    }),
    createDataCategory("api-keys", "API Keys", {
      collected: ["No user API keys collected in chat flows"],
      why: "Server-side environment variables control optional provider access.",
      whereStored: "Server environment only.",
      retention: "Deployment lifecycle.",
      encryption: "Environment secret handling.",
      access: "Server runtime only.",
      export: "Not exportable through user data export.",
      delete: "Unset environment variables.",
      revoke: "Disable online integrations and restart service.",
      currentState: "Managed outside user data stores.",
    }),
    createDataCategory("analytics", "Analytics", {
      collected: ["No analytics by default"],
      why: "Privacy-by-default and data minimization.",
      whereStored: "Not stored unless explicitly enabled.",
      retention: "None by default.",
      encryption: "N/A when disabled.",
      access: "No one by default.",
      export: "No analytics export by default.",
      delete: "No analytics data by default.",
      revoke: "Keep analytics scope disabled.",
      currentState: buildBooleanStatus(
        consentDashboard.current?.scopes?.analytics,
        "Analytics scope enabled.",
        "Analytics disabled by default.",
      ),
    }),
  ]);

  return Object.freeze({
    generatedAt: new Date().toISOString(),
    sessionId: sessionIdentifier,
    categories,
    guarantees: Object.freeze([
      "Understand what is collected and why.",
      "Consent is versioned, granular, and revocable.",
      "Export and deletion controls are available in-session.",
      "Refusing AI still preserves the core local experience.",
    ]),
  });
}

function buildExportPackage(sessionId = "default", context = {}) {
  return Object.freeze({
    exportedAt: new Date().toISOString(),
    sessionId: String(sessionId || "default"),
    consentDashboard: context.consentDashboard,
    dataManager: context.dataManager,
    auditTimeline: context.auditTimeline,
    latestTransparency: context.latestTransparency || null,
    notice:
      "This export contains only current-session, local-first transparency records and consent metadata.",
  });
}

export { buildDataManagerSnapshot, buildExportPackage };
