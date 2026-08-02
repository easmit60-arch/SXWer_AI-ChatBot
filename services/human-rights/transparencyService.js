const transparencyStore = new Map();
const ALLOW_PROMPTS =
  String(process.env.ALLOW_PROMPTS || "false").toLowerCase() === "true";

function normalizeSessionId(sessionId = "default") {
  const normalized = String(sessionId || "default").trim();
  return normalized || "default";
}

function buildResponseTransparency({
  sessionId = "default",
  message = "",
  provider = "local-curated",
  model = null,
  mode = "offline",
  aiUsed = false,
  sentData = [],
  why = "Provide a trauma-informed response.",
  confidence = "medium",
  limitations = [],
  safetyChecks = [],
  biasAssessment = { flagged: false, issues: [] },
  explanation = null,
  humanRightsChecks = null,
} = {}) {
  const disclosure = Object.freeze({
    aiUsed,
    provider,
    model,
    mode,
    offline: mode !== "online",
    online: mode === "online",
    sentData: Object.freeze([...(sentData || [])]),
    why,
    confidence,
    limitations: Object.freeze([...(limitations || [])]),
    summary: aiUsed
      ? `AI ${provider}${model ? ` (${model})` : ""} was used in ${mode} mode.`
      : "No online AI was used; the reply came from local-first logic.",
  });

  const explain = Object.freeze({
    question: "Why did I receive this answer?",
    sources: Object.freeze(
      aiUsed
        ? [
            mode === "online"
              ? "Configured online AI provider"
              : "Configured local AI provider",
            "Built-in safety validator",
            "Consent and human-rights gates",
          ]
        : ["Built-in offline rules", "Consent and human-rights gates"],
    ),
    rulesUsed: Object.freeze([
      "Consent check",
      "Human rights validator",
      "Safety check",
      "Bias check",
      "Transparency check",
    ]),
    localModel: mode !== "online" ? model || provider : null,
    onlineModel: mode === "online" ? model || provider : null,
    resourceLookups: Object.freeze([]),
    confidence,
    reasoningSummary:
      explanation?.summary ||
      (aiUsed
        ? "The app used the selected AI path only after consent and then wrapped the reply in transparency and safety disclosures."
        : "The app answered with local-first logic because AI was unavailable, refused, or unnecessary."),
    limitations: Object.freeze(
      [...(limitations || []), explanation?.limitations].filter(Boolean),
    ),
  });

  const rights = Object.freeze(
    humanRightsChecks || {
      understand: true,
      consent: true,
      refuse: true,
      revoke: true,
      inspect: true,
      export: true,
      delete: true,
      continueWithoutAI: true,
    },
  );

  const safety = Object.freeze({
    anchor: true,
    mirror: true,
    reframe: true,
    rapport: true,
    safetyCheck: true,
    biasCheck: true,
    transparencyCheck: true,
    humanRightsCheck: true,
    biasFlagged: Boolean(biasAssessment?.flagged),
    biasIssues: Object.freeze([...(biasAssessment?.issues || [])]),
    safetyChecks: Object.freeze([...(safetyChecks || [])]),
  });

  const record = Object.freeze({
    sessionId: normalizeSessionId(sessionId),
    createdAt: new Date().toISOString(),
    promptPreview: ALLOW_PROMPTS
      ? String(message || "").slice(0, 160)
      : "[redacted: ALLOW_PROMPTS=false]",
    disclosure,
    explain,
    rights,
    safety,
    explanation,
  });

  transparencyStore.set(record.sessionId, record);
  return record;
}

function getLatestTransparencyRecord(sessionId = "default") {
  return transparencyStore.get(normalizeSessionId(sessionId)) || null;
}

function clearLatestTransparencyRecord(sessionId = "default") {
  return transparencyStore.delete(normalizeSessionId(sessionId));
}

export {
  buildResponseTransparency,
  clearLatestTransparencyRecord,
  getLatestTransparencyRecord,
};
