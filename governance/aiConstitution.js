export const AI_CONSTITUTION = Object.freeze({
  principles: Object.freeze([
    "Human dignity over optimization.",
    "Transparency for every AI-assisted response.",
    "Consent is required before restricted features execute.",
    "Data minimization by default.",
    "Explainability and uncertainty must be explicit.",
    "Resources must be verified before display.",
    "Human-rights review must run on responses.",
    "Data transparency must remain inspectable.",
    "Permission prompts must explain why/what/where/how-long/access/delete.",
    "Every feature follows the Human Rights Pipeline.",
  ]),
  requiredDisclosureFields: Object.freeze([
    "aiUsed",
    "provider",
    "model",
    "confidence",
    "limitations",
    "uncertainty",
    "externalRequests",
    "resourcesConsulted",
    "consentState",
  ]),
});

export const GOVERNANCE_FLAGS = Object.freeze({
  ALLOW_ANALYTICS:
    String(process.env.ALLOW_ANALYTICS || "false").toLowerCase() === "true",
  ALLOW_PROMPTS:
    String(process.env.ALLOW_PROMPTS || "false").toLowerCase() === "true",
  ALLOW_DIAGNOSTICS:
    String(process.env.ALLOW_DIAGNOSTICS || "false").toLowerCase() === "true",
});

export function getGovernanceFlagSnapshot() {
  return Object.freeze({ ...GOVERNANCE_FLAGS });
}
