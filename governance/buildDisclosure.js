function normalizeList(value, fallback = []) {
  if (!Array.isArray(value)) return [...fallback];
  return value.filter(Boolean).map((item) => String(item));
}

export function buildDisclosure({
  aiUsed = false,
  model = "unknown",
  provider = "local",
  confidence = "medium",
  limitations = [],
  uncertainty = "AI output can be incomplete or incorrect.",
  externalRequests = [],
  resourcesConsulted = [],
  consentState = "unknown",
  stored = "No",
  shared = "No",
  safetyFilters = [],
} = {}) {
  return Object.freeze({
    aiUsed: Boolean(aiUsed),
    model: String(model || "unknown"),
    provider: String(provider || "local"),
    confidence: String(confidence || "medium"),
    limitations: Object.freeze(
      normalizeList(limitations, ["AI output may be imperfect."]),
    ),
    uncertainty: String(
      uncertainty || "AI output can be incomplete or incorrect.",
    ),
    externalRequests: Object.freeze(normalizeList(externalRequests, ["None"])),
    resourcesConsulted: Object.freeze(
      normalizeList(resourcesConsulted, ["Local policy and safety rules"]),
    ),
    safetyFilters: Object.freeze(
      normalizeList(safetyFilters, [
        "Human rights review",
        "Bias check",
        "Consent check",
      ]),
    ),
    consentState: String(consentState || "unknown"),
    stored: String(stored || "No"),
    shared: String(shared || "No"),
  });
}

export function renderDisclosure(disclosure) {
  return [
    "AI Disclosure",
    `Model: ${disclosure.model}`,
    `Provider: ${disclosure.provider}`,
    `Confidence: ${disclosure.confidence}`,
    `External Requests: ${disclosure.externalRequests.join(", ")}`,
    `Resources Consulted: ${disclosure.resourcesConsulted.join(", ")}`,
    `Safety Filters: ${disclosure.safetyFilters.join(", ")}`,
    `Stored: ${disclosure.stored}`,
    `Shared: ${disclosure.shared}`,
    `Consent: ${disclosure.consentState}`,
    `Limitations: ${disclosure.limitations.join(" ")}`,
    `Uncertainty: ${disclosure.uncertainty}`,
  ].join("\n");
}

export function appendDisclosure(responseText, disclosure) {
  return `${String(responseText || "")}\n\n${renderDisclosure(disclosure)}`.trim();
}
