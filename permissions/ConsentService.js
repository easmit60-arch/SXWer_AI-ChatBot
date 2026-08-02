import { runHumanRightsPipeline } from "../governance/HumanRightsPipeline.js";

export const FEATURE_CONSENT_SCOPE = Object.freeze({
  sherlock: ["sherlock"],
  voice: ["voice", "microphone"],
  "online-ai": ["ai", "internet"],
  blockchain: ["blockchain"],
  "external-api": ["internet"],
  "community-sharing": ["futureIntegrations"],
});

export function getRequiredScopes(feature) {
  return FEATURE_CONSENT_SCOPE[feature] || [];
}

export function evaluateFeatureConsent({
  feature,
  consentScopes = {},
  rights = {},
} = {}) {
  const requiredScopes = getRequiredScopes(feature);
  const missingScopes = requiredScopes.filter(
    (scope) => !Boolean(consentScopes?.[scope]),
  );

  const pipeline = runHumanRightsPipeline({
    feature,
    understand: rights.understand,
    consent: rights.consent,
    refuse: rights.refuse,
    inspect: rights.inspect,
    exportData: rights.export,
    deleteData: rights.delete,
    verify: rights.verify,
    continueOffline: rights.continueOffline,
  });

  return Object.freeze({
    feature,
    requiredScopes: Object.freeze(requiredScopes),
    missingScopes: Object.freeze(missingScopes),
    rights: pipeline.rights,
    failedChecks: pipeline.failedChecks,
    allowed: pipeline.allowed && missingScopes.length === 0,
  });
}
