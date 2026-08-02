/**
 * SXWer AI ChatBot - Consent Ledger
 *
 * HUMAN RIGHTS DESIGN:
 * This module is the single authoritative source of truth for consent events.
 *
 * Eight human-rights questions answered:
 *  1. Can the user understand what is happening? YES — every event is logged
 *     in plain language and returned to the caller for display.
 *  2. Can the user meaningfully consent? YES — consent is only recorded after
 *     the caller has displayed the full INFORMED_CONSENT_DISCLOSURE.
 *  3. Can the user refuse? YES — blockchain is optional; the app works without it.
 *  4. Can they revoke consent? YES — revokeConsent() writes an immutable revocation
 *     receipt and clears the active consent flag.
 *  5. Can they inspect their own data? YES — getConsentHistory() returns everything.
 *  6. Can they export it? YES — exportLedger() returns a portable JSON package.
 *  7. Can they delete local data? YES — clearLocalLedger() wipes the in-memory store.
 *     On-chain records are immutable (by design) and contain no PII.
 *  8. Can they continue using the app without blockchain? YES — every function
 *     degrades gracefully; the rest of the app has no dependency on this module.
 *
 * WHAT IS STORED ON-CHAIN:
 *  - eventType (one of CONSENT_EVENT_TYPES)
 *  - documentHash (SHA-256 of the consent document — never the document itself)
 *  - receiptHash (SHA-256 of this receipt object)
 *  - timestamp (Unix ms)
 *  - policyVersion
 *  - schemaVersion
 *  - appVersion
 *  - nonce (replay protection)
 *  - walletId (optional, pseudonymous)
 *  - signature (optional, if wallet is connected)
 *
 * WHAT IS NEVER STORED:
 *  - Names, emails, phone numbers, or any PII
 *  - Conversation history, messages, prompts, or AI responses
 *  - Safety plans, health records, legal documents
 *  - Location data, device fingerprints
 *  - The consent document text itself
 */

import crypto from 'crypto';
import {
  BLOCKCHAIN_ENABLED,
  CONSENT_EVENT_TYPES,
  LEDGER_SCHEMA_VERSION,
  INFORMED_CONSENT_DISCLOSURE,
} from './ledgerConfig.js';
import { hashConsentDocument, hashConsentReceipt, generateNonce } from './hashService.js';
import { submitTransaction, getAllTransactions } from './blockchainService.js';
import { getWalletId, isWalletConnected, signReceipt } from './walletService.js';

// ============================================================================
// LOCAL LEDGER (in-memory mirror for fast querying without blockchain round-trips)
// ============================================================================

/**
 * Local mirror of all consent receipts written during this session.
 * Keyed by receiptId (a random UUID-style identifier).
 *
 * This store is cleared on process restart. It is not a substitute for
 * the on-chain record — it is a session-scoped audit log for the UI.
 *
 * @type {Map<string, Object>}
 */
const _localLedger = new Map();

// ============================================================================
// RECEIPT BUILDER
// ============================================================================

/**
 * Build and sign a consent receipt, write it to the local ledger, and
 * optionally submit it to the blockchain provider.
 *
 * @param {string} eventType - One of CONSENT_EVENT_TYPES
 * @param {string|Object} consentDocument - The consent document being recorded
 * @param {Object} [meta={}] - Optional metadata (policyVersion, appVersion, etc.)
 * @returns {Promise<Object>} The completed consent receipt
 */
async function _buildAndSubmitReceipt(eventType, consentDocument, meta = {}) {
  if (!Object.values(CONSENT_EVENT_TYPES).includes(eventType)) {
    throw new TypeError(`[LEDGER] Unknown event type: "${eventType}".`);
  }

  const receiptId = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
  const timestamp = Date.now();
  const documentHash = hashConsentDocument(consentDocument);
  const nonce = generateNonce();

  // Assemble the receipt (no PII — see module-level comment)
  const receipt = {
    receiptId,
    schemaVersion: LEDGER_SCHEMA_VERSION,
    appVersion: meta.appVersion || process.env.npm_package_version || 'unknown',
    eventType,
    documentHash,
    policyVersion: meta.policyVersion || INFORMED_CONSENT_DISCLOSURE.policyVersion,
    timestamp,
    nonce,
    walletId: isWalletConnected() ? getWalletId() : null,
    txId: null,       // Filled in after blockchain submission
    signature: null,  // Filled in after signing
    receiptHash: null,// Filled in after building final receipt
  };

  // Compute receipt hash (covers all fields except receiptHash and signature)
  const { receiptHash: _rh, signature: _sig, ...hashable } = receipt;
  receipt.receiptHash = hashConsentReceipt(hashable);

  // Sign if wallet is connected
  if (isWalletConnected()) {
    try {
      receipt.signature = signReceipt(receipt.receiptHash);
    } catch (err) {
      console.warn(`[LEDGER] Wallet signing failed: ${err.message}. Continuing without signature.`);
    }
  }

  // Write to local ledger first (synchronous, always succeeds)
  _localLedger.set(receiptId, { ...receipt, onChain: false });

  // Optionally submit to blockchain (async, may fail without breaking the app)
  if (BLOCKCHAIN_ENABLED) {
    try {
      const txResult = await submitTransaction(receipt);
      if (txResult) {
        receipt.txId = txResult.txId;
        // Update local ledger with transaction result
        _localLedger.set(receiptId, { ...receipt, onChain: true, txResult });
      }
    } catch (err) {
      console.warn(`[LEDGER] Blockchain submission failed: ${err.message}. Receipt retained locally.`);
      _localLedger.set(receiptId, { ...receipt, onChain: false, submissionError: err.message });
    }
  }

  return Object.freeze({ ..._localLedger.get(receiptId) });
}

// ============================================================================
// PUBLIC CONSENT LEDGER FUNCTIONS
// ============================================================================

/**
 * Record that the user has granted consent.
 *
 * @param {Object} [options={}]
 * @param {string} [options.policyVersion] - Policy version being accepted
 * @param {string} [options.appVersion]    - Application version
 * @param {string} [options.consentText]   - The exact text shown to the user (optional)
 * @returns {Promise<Object>} Consent receipt
 */
async function recordConsent(options = {}) {
  const document = {
    action: 'consent_granted',
    policyVersion: options.policyVersion || INFORMED_CONSENT_DISCLOSURE.policyVersion,
    consentTextHash: options.consentText
      ? hashConsentDocument(options.consentText)
      : hashConsentDocument(INFORMED_CONSENT_DISCLOSURE.body),
    timestamp: Date.now(),
  };

  const receipt = await _buildAndSubmitReceipt(
    CONSENT_EVENT_TYPES.CONSENT_GRANTED,
    document,
    options
  );

  console.log(`[LEDGER] Consent granted. receiptId=${receipt.receiptId}`);
  return receipt;
}

/**
 * Record that the user has revoked consent.
 *
 * @param {Object} [options={}]
 * @param {string} [options.reason] - Optional plain-language reason (not stored on-chain)
 * @returns {Promise<Object>} Revocation receipt
 */
async function revokeConsent(options = {}) {
  const document = {
    action: 'consent_revoked',
    policyVersion: options.policyVersion || INFORMED_CONSENT_DISCLOSURE.policyVersion,
    timestamp: Date.now(),
    // reason is NOT included — it may contain sensitive language
  };

  const receipt = await _buildAndSubmitReceipt(
    CONSENT_EVENT_TYPES.CONSENT_REVOKED,
    document,
    options
  );

  console.log(`[LEDGER] Consent revoked. receiptId=${receipt.receiptId}`);
  return receipt;
}

/**
 * Verify the integrity of a consent receipt.
 * Checks that the receipt has not been tampered with since it was created.
 *
 * @param {Object} receipt - A receipt object (from the local ledger or exported)
 * @returns {{ valid: boolean, reason: string }}
 */
function verifyConsent(receipt) {
  if (!receipt || typeof receipt !== 'object') {
    return { valid: false, reason: 'Receipt is missing or not an object.' };
  }

  const required = ['receiptId', 'eventType', 'documentHash', 'receiptHash', 'timestamp', 'nonce'];
  for (const field of required) {
    if (!receipt[field]) {
      return { valid: false, reason: `Required field "${field}" is missing.` };
    }
  }

  // Re-compute the receipt hash and compare
  const { receiptHash, signature, onChain, txResult, submissionError, ...hashable } = receipt;
  const computed = hashConsentReceipt(hashable);

  if (computed !== receiptHash) {
    return {
      valid: false,
      reason: 'Receipt hash does not match. The receipt may have been tampered with.',
    };
  }

  return { valid: true, reason: 'Receipt integrity verified.' };
}

/**
 * Record that the user has accepted a specific policy version.
 *
 * @param {string} policyVersion - The policy version identifier
 * @param {string} [policyDocumentText] - The text of the policy shown to the user
 * @returns {Promise<Object>} Policy acceptance receipt
 */
async function recordPolicyAcceptance(policyVersion, policyDocumentText) {
  if (!policyVersion || typeof policyVersion !== 'string') {
    throw new TypeError('[LEDGER] policyVersion must be a non-empty string.');
  }

  const document = {
    action: 'policy_version_accepted',
    policyVersion,
    policyDocumentHash: policyDocumentText
      ? hashConsentDocument(policyDocumentText)
      : null,
    timestamp: Date.now(),
  };

  const receipt = await _buildAndSubmitReceipt(
    CONSENT_EVENT_TYPES.POLICY_VERSION_ACCEPTED,
    document,
    { policyVersion }
  );

  console.log(`[LEDGER] Policy accepted. version=${policyVersion} receiptId=${receipt.receiptId}`);
  return receipt;
}

/**
 * Record that local data has been deleted.
 * This creates an immutable audit trail that deletion was performed.
 *
 * @param {Object} [options={}]
 * @param {string[]} [options.dataTypes] - Categories of data deleted (no content)
 * @returns {Promise<Object>} Deletion receipt
 */
async function recordDeletion(options = {}) {
  const document = {
    action: 'local_data_deleted',
    // dataTypes contains category labels only (e.g. ['consent', 'settings'])
    // It must NEVER contain actual data content
    dataTypes: Array.isArray(options.dataTypes) ? options.dataTypes : ['all'],
    timestamp: Date.now(),
  };

  const receipt = await _buildAndSubmitReceipt(
    CONSENT_EVENT_TYPES.LOCAL_DATA_DELETED,
    document,
    options
  );

  console.log(`[LEDGER] Data deletion recorded. receiptId=${receipt.receiptId}`);
  return receipt;
}

/**
 * Record that a data export was completed.
 * This creates an immutable audit trail that an export occurred.
 *
 * @param {Object} [options={}]
 * @param {string} [options.exportFormat] - e.g. 'json', 'csv' (no content)
 * @returns {Promise<Object>} Export receipt
 */
async function recordExport(options = {}) {
  const document = {
    action: 'data_export_completed',
    exportFormat: options.exportFormat || 'json',
    timestamp: Date.now(),
  };

  const receipt = await _buildAndSubmitReceipt(
    CONSENT_EVENT_TYPES.DATA_EXPORT_COMPLETED,
    document,
    options
  );

  console.log(`[LEDGER] Data export recorded. receiptId=${receipt.receiptId}`);
  return receipt;
}

/**
 * Record that AI has been enabled.
 *
 * @param {Object} [options={}]
 * @returns {Promise<Object>} AI-enabled receipt
 */
async function recordAIEnabled(options = {}) {
  const document = { action: 'ai_enabled', timestamp: Date.now() };
  return _buildAndSubmitReceipt(CONSENT_EVENT_TYPES.AI_ENABLED, document, options);
}

/**
 * Record that AI has been disabled.
 *
 * @param {Object} [options={}]
 * @returns {Promise<Object>} AI-disabled receipt
 */
async function recordAIDisabled(options = {}) {
  const document = { action: 'ai_disabled', timestamp: Date.now() };
  return _buildAndSubmitReceipt(CONSENT_EVENT_TYPES.AI_DISABLED, document, options);
}

/**
 * Record that a third-party permission has been granted.
 *
 * @param {string} permissionScope - Non-identifying scope label (e.g. 'offline-lookup')
 * @param {Object} [options={}]
 * @returns {Promise<Object>} Permission receipt
 */
async function recordThirdPartyPermissionGranted(permissionScope, options = {}) {
  const document = {
    action: 'third_party_permission_granted',
    permissionScope: permissionScope || 'unknown',
    timestamp: Date.now(),
  };
  return _buildAndSubmitReceipt(CONSENT_EVENT_TYPES.THIRD_PARTY_PERMISSION_GRANTED, document, options);
}

/**
 * Record that a third-party permission has been revoked.
 *
 * @param {string} permissionScope - Non-identifying scope label
 * @param {Object} [options={}]
 * @returns {Promise<Object>} Revocation receipt
 */
async function recordThirdPartyPermissionRevoked(permissionScope, options = {}) {
  const document = {
    action: 'third_party_permission_revoked',
    permissionScope: permissionScope || 'unknown',
    timestamp: Date.now(),
  };
  return _buildAndSubmitReceipt(CONSENT_EVENT_TYPES.THIRD_PARTY_PERMISSION_REVOKED, document, options);
}

// ============================================================================
// LEDGER INSPECTION AND PORTABILITY
// ============================================================================

/**
 * Return all consent receipts from the local in-memory ledger.
 *
 * @returns {Object[]} Array of receipt objects, newest first
 */
function getConsentHistory() {
  return Array.from(_localLedger.values())
    .sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * Return the most recent receipt of a specific event type.
 *
 * @param {string} eventType - One of CONSENT_EVENT_TYPES
 * @returns {Object|null}
 */
function getLatestConsentEvent(eventType) {
  const matching = Array.from(_localLedger.values())
    .filter((r) => r.eventType === eventType)
    .sort((a, b) => b.timestamp - a.timestamp);
  return matching[0] || null;
}

/**
 * Check whether the user has active (not revoked) consent recorded.
 *
 * @returns {boolean}
 */
function hasActiveConsent() {
  const granted = getLatestConsentEvent(CONSENT_EVENT_TYPES.CONSENT_GRANTED);
  const revoked = getLatestConsentEvent(CONSENT_EVENT_TYPES.CONSENT_REVOKED);

  if (!granted) return false;
  if (!revoked) return true;
  return granted.timestamp > revoked.timestamp;
}

/**
 * Export the entire local consent ledger as a portable JSON package.
 * The exported package contains only hashes and event metadata — no PII.
 *
 * @returns {Object} Portable export package
 */
function exportLedger() {
  return Object.freeze({
    exportedAt: Date.now(),
    schemaVersion: LEDGER_SCHEMA_VERSION,
    blockchainEnabled: BLOCKCHAIN_ENABLED,
    totalRecords: _localLedger.size,
    receipts: getConsentHistory(),
    disclaimer: [
      'This export contains cryptographic consent receipts only.',
      'It contains no personally identifiable information.',
      'Hashes are SHA-256 fingerprints of consent documents — not the documents themselves.',
    ].join(' '),
  });
}

/**
 * Clear the local in-memory ledger.
 * On-chain records (if any) are immutable and not affected.
 * Call this as part of a broader "delete my local data" workflow.
 *
 * @returns {number} Number of records cleared
 */
function clearLocalLedger() {
  const count = _localLedger.size;
  _localLedger.clear();
  console.log(`[LEDGER] Local ledger cleared. ${count} record(s) removed.`);
  return count;
}

/**
 * Return a summary of current consent status for UI display.
 *
 * @returns {Object}
 */
function getConsentStatus() {
  const granted = getLatestConsentEvent(CONSENT_EVENT_TYPES.CONSENT_GRANTED);
  const revoked = getLatestConsentEvent(CONSENT_EVENT_TYPES.CONSENT_REVOKED);
  const policy  = getLatestConsentEvent(CONSENT_EVENT_TYPES.POLICY_VERSION_ACCEPTED);
  const exports = Array.from(_localLedger.values())
    .filter((r) => r.eventType === CONSENT_EVENT_TYPES.DATA_EXPORT_COMPLETED);
  const deletions = Array.from(_localLedger.values())
    .filter((r) => r.eventType === CONSENT_EVENT_TYPES.LOCAL_DATA_DELETED);

  return Object.freeze({
    blockchainEnabled: BLOCKCHAIN_ENABLED,
    hasActiveConsent: hasActiveConsent(),
    consentGrantedAt: granted ? granted.timestamp : null,
    consentRevokedAt: revoked ? revoked.timestamp : null,
    policyVersion: policy ? policy.policyVersion : null,
    policyAcceptedAt: policy ? policy.timestamp : null,
    exportCount: exports.length,
    lastExportAt: exports.length > 0
      ? Math.max(...exports.map((r) => r.timestamp))
      : null,
    deletionCount: deletions.length,
    lastDeletionAt: deletions.length > 0
      ? Math.max(...deletions.map((r) => r.timestamp))
      : null,
    totalLedgerRecords: _localLedger.size,
  });
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  // Core consent actions
  recordConsent,
  revokeConsent,
  verifyConsent,
  recordDeletion,
  recordExport,
  recordPolicyAcceptance,

  // Additional governance events
  recordAIEnabled,
  recordAIDisabled,
  recordThirdPartyPermissionGranted,
  recordThirdPartyPermissionRevoked,

  // Ledger inspection and portability
  getConsentHistory,
  getLatestConsentEvent,
  hasActiveConsent,
  exportLedger,
  clearLocalLedger,
  getConsentStatus,

  // Constants re-exported for convenience
  CONSENT_EVENT_TYPES,
};
