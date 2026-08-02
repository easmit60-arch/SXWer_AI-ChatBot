import {
  buildDisclosure,
  appendDisclosure,
} from "../governance/buildDisclosure.js";
import { HumanRightsReview } from "../governance/HumanRightsReview.js";

export function applyGovernanceToResponse({
  responseText,
  aiUsed = false,
  provider = "local",
  model = "unknown",
  mode = "offline",
  confidence = "medium",
  limitations = [],
  uncertainty,
  externalRequests = [],
  resourcesConsulted = [],
  consentState = "unknown",
  stored = "No",
  shared = "No",
  safetyFilters = [],
} = {}) {
  const reviewed = HumanRightsReview({
    responseText: String(responseText || ""),
  });

  const disclosure = buildDisclosure({
    aiUsed,
    model,
    provider: `${provider} (${mode})`,
    confidence,
    limitations,
    uncertainty,
    externalRequests,
    resourcesConsulted,
    consentState,
    stored,
    shared,
    safetyFilters,
  });

  const withDisclosure = aiUsed
    ? appendDisclosure(reviewed.response.responseText, disclosure)
    : reviewed.response.responseText;

  return Object.freeze({
    responseText: withDisclosure,
    disclosure,
    humanRightsReview: Object.freeze({
      passed: reviewed.passed,
      flags: reviewed.flags,
    }),
  });
}
