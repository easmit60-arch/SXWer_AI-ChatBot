import { evaluateFeatureConsent } from "./ConsentService.js";

export function requireConsentForFeature({
  feature,
  sessionId = "default",
  consentState = {},
  rights = {},
} = {}) {
  const evaluation = evaluateFeatureConsent({
    feature,
    consentScopes: consentState.scopes || {},
    rights,
  });

  if (evaluation.allowed) {
    return Object.freeze({
      allowed: true,
      sessionId,
      feature,
      evaluation,
    });
  }

  const reasons = [];
  if (evaluation.missingScopes.length > 0) {
    reasons.push(
      `Missing consent scopes: ${evaluation.missingScopes.join(", ")}`,
    );
  }
  if (evaluation.failedChecks.length > 0) {
    reasons.push(
      `Human-rights checks failed: ${evaluation.failedChecks.join(", ")}`,
    );
  }

  return Object.freeze({
    allowed: false,
    sessionId,
    feature,
    reason: reasons.join("; ") || "Consent guard blocked feature execution.",
    evaluation,
  });
}
