const BLOCKED_FIELD_PATTERNS = [
  /conversation/i,
  /prompt/i,
  /response/i,
  /gps|location/i,
  /photo|image/i,
  /voice|audio/i,
  /email/i,
  /phone/i,
  /health|medical/i,
  /message/i,
];

const ALLOWED_RECORD_KEYS = Object.freeze([
  "receiptId",
  "schemaVersion",
  "appVersion",
  "eventType",
  "documentHash",
  "policyVersion",
  "timestamp",
  "nonce",
  "walletId",
  "txId",
  "signature",
  "receiptHash",
]);

const ALLOWED_DOCUMENT_KEYS = Object.freeze([
  "action",
  "policyVersion",
  "consentTextHash",
  "policyDocumentHash",
  "permissionScope",
  "dataTypes",
  "exportFormat",
  "timestamp",
]);

function containsBlockedField(name) {
  return BLOCKED_FIELD_PATTERNS.some((pattern) => pattern.test(String(name)));
}

export function sanitizeBlockchainDocument(document = {}) {
  const clean = {};
  for (const [key, value] of Object.entries(document || {})) {
    if (ALLOWED_DOCUMENT_KEYS.includes(key) && !containsBlockedField(key)) {
      clean[key] = value;
    }
  }
  return Object.freeze(clean);
}

export function assertBlockchainPolicyCompliant(record = {}, document = {}) {
  const recordKeys = Object.keys(record || {});
  const documentKeys = Object.keys(document || {});
  const blocked = [...recordKeys, ...documentKeys].filter(containsBlockedField);

  if (blocked.length > 0) {
    throw new Error(
      `Blocked blockchain fields detected: ${blocked.join(", ")}`,
    );
  }

  return true;
}

export function sanitizeBlockchainRecord(record = {}) {
  const clean = {};
  for (const [key, value] of Object.entries(record || {})) {
    if (ALLOWED_RECORD_KEYS.includes(key) && !containsBlockedField(key)) {
      clean[key] = value;
    }
  }
  return Object.freeze(clean);
}
