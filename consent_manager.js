/**
 * SXWer AI ChatBot - Consent Management with Data Minimization
 *
 * ETHICAL COMPLIANCE:
 * - GDPR Article 5: Data minimization principle
 * - Belmont Report: Respect for Persons
 * - Privacy by Design: Minimal data collection
 *
 * IMPLEMENTATION:
 * - Anonymous session IDs (no user-identifiable information)
 * - Minimal consent data storage (only what's necessary)
 * - Automatic data expiration (24-hour TTL)
 * - No persistent storage
 * - No logging of sensitive consent data
 */

import crypto from 'crypto';
import {
  generateAnonymousSessionId,
  isValidSessionId,
  MAX_SESSION_ID_LENGTH,
  consentStore,
  setUserConsent,
  getConsentState,
  hasAIConsent,
  hasToolConsent,
  minimizeConsentState,
  normalizeSessionId,
  DEFAULT_CONSENT,
} from './utils.js';

// ============================================================================
// DATA MINIMIZATION CONSTANTS
// ============================================================================

/**
 * Session TTL in milliseconds (24 hours)
 * GDPR: Data should not be kept longer than necessary
 */
const SESSION_TTL = 24 * 60 * 60 * 1000;

/**
 * Local Permissions Store - Minimal data storage
 * Only stores: { offline: boolean, grantedAt: number, scope: string }
 * No user-identifiable information
 * Automatic cleanup via TTL
 */
const localPermissionStore = new Map();

/**
 * Pending Sherlock Store - Minimal data storage
 * Only stores: { username: string, timestamp: number }
 * No user-identifiable information beyond what user provided
 * Automatic cleanup via TTL
 */
const pendingSherlockStore = new Map();

// ============================================================================
// CONSENT MANAGEMENT FUNCTIONS
// ============================================================================

// Use shared consent and session utilities from utils.js
// All duplicate functions have been removed and centralized in utils.js
// Note: consent_manager.js adds TTL cleanup which is specific to this module

// ============================================================================
// CONSENT REVOCATION (GDPR Article 7 - Right to Withdraw Consent)
// ============================================================================

/**
 * Revoke all consent for a session
 * @param {string} sessionId - Session identifier
 * @returns {boolean} True if consent was revoked
 */
function revokeUserConsent(sessionId = null) {
  const normalizedSessionId = normalizeSessionId(sessionId);
  
  if (consentStore.has(normalizedSessionId)) {
    consentStore.delete(normalizedSessionId);
    console.log(`[CONSENT] Consent revoked for anonymous session.`);
    return true;
  }
  
  return false;
}

/**
 * Revoke specific consent (AI or tools)
 * @param {string} type - 'ai' or 'tools'
 * @param {string} sessionId - Session identifier
 * @returns {boolean} True if consent was revoked
 */
function revokeSpecificConsent(type, sessionId = null) {
  const normalizedSessionId = normalizeSessionId(sessionId);
  const consent = consentStore.get(normalizedSessionId);
  
  if (consent) {
    if (type === 'ai') {
      consent.ai = false;
    } else if (type === 'tools') {
      consent.tools = false;
    }
    consent.grantedAt = Date.now(); // Update timestamp
    
    console.log(`[CONSENT] ${type} consent revoked for anonymous session.`);
    return true;
  }
  
  return false;
}

// ============================================================================
// DATA PORTABILITY (GDPR Article 20 - Right to Data Portability)
// ============================================================================

/**
 * Export all data for a session (minimal data only)
 * @param {string} sessionId - Session identifier
 * @returns {Object} Exported data
 */
function exportSessionData(sessionId = null) {
  const normalizedSessionId = normalizeSessionId(sessionId);
  
  return {
    sessionId: normalizedSessionId, // Anonymous ID only
    consent: getConsentState(normalizedSessionId),
    localPermissions: getLocalPermissions(normalizedSessionId),
    pendingSherlock: getPendingSherlock(normalizedSessionId),
    exportedAt: Date.now(),
    disclaimer: "This export contains minimal, non-identifiable data as per our privacy-by-design principles.",
  };
}

// ============================================================================
// RIGHT TO BE FORGOTTEN (GDPR Article 17 - Right to Erasure)
// ============================================================================

/**
 * Delete all data for a session
 * @param {string} sessionId - Session identifier
 * @returns {boolean} True if data was deleted
 */
function deleteSessionData(sessionId = null) {
  const normalizedSessionId = normalizeSessionId(sessionId);
  
  let deleted = false;
  
  // Delete consent
  if (consentStore.has(normalizedSessionId)) {
    consentStore.delete(normalizedSessionId);
    deleted = true;
  }
  
  // Delete local permissions
  if (localPermissionStore.has(normalizedSessionId)) {
    localPermissionStore.delete(normalizedSessionId);
    deleted = true;
  }
  
  // Delete pending Sherlock
  if (pendingSherlockStore.has(normalizedSessionId)) {
    pendingSherlockStore.delete(normalizedSessionId);
    deleted = true;
  }
  
  if (deleted) {
    console.log(`[PRIVACY] Session data deleted for anonymous session.`);
  }
  
  return deleted;
}

// ============================================================================
// LOCAL PERMISSIONS MANAGEMENT
// ============================================================================

/**
 * Set local permissions
 * @param {string} sessionId - Session identifier
 * @param {Object} permissions - Permission object
 */
function setLocalPermissions(sessionId = null, permissions = {}) {
  const normalizedSessionId = normalizeSessionId(sessionId);
  
  const localPermissionState = {
    offline: Boolean(permissions.offline),
    grantedAt: Date.now(),
    scope: permissions.scope || 'offline',
  };
  
  localPermissionStore.set(normalizedSessionId, localPermissionState);
}

/**
 * Get local permissions
 * @param {string} sessionId - Session identifier
 * @returns {Object} Local permissions
 */
function getLocalPermissions(sessionId = null) {
  const normalizedSessionId = normalizeSessionId(sessionId);
  const permissions = localPermissionStore.get(normalizedSessionId);
  
  return permissions ? Object.freeze({ ...permissions }) : Object.freeze({ offline: false, scope: 'offline' });
}

/**
 * Check if offline local permission is granted
 * @param {string} sessionId - Session identifier
 * @returns {boolean} True if offline permission is granted
 */
function hasOfflineLocalPermission(sessionId = null) {
  return getLocalPermissions(sessionId).offline === true;
}

// ============================================================================
// PENDING SHERLOCK MANAGEMENT
// ============================================================================

/**
 * Set pending Sherlock username
 * @param {string} sessionId - Session identifier
 * @param {string} username - Username to check
 */
function setPendingSherlock(sessionId = null, username) {
  const normalizedSessionId = normalizeSessionId(sessionId);
  pendingSherlockStore.set(normalizedSessionId, {
    username,
    timestamp: Date.now(),
  });
}

/**
 * Get pending Sherlock username
 * @param {string} sessionId - Session identifier
 * @returns {string|null} Pending username or null
 */
function getPendingSherlock(sessionId = null) {
  const normalizedSessionId = normalizeSessionId(sessionId);
  const pending = pendingSherlockStore.get(normalizedSessionId);
  return pending ? pending.username : null;
}

/**
 * Delete pending Sherlock
 * @param {string} sessionId - Session identifier
 */
function deletePendingSherlock(sessionId = null) {
  const normalizedSessionId = normalizeSessionId(sessionId);
  pendingSherlockStore.delete(normalizedSessionId);
}

// ============================================================================
// AUTOMATIC DATA CLEANUP (GDPR - Data Minimization)
// ============================================================================

/**
 * Clean up expired sessions
 * Runs automatically to enforce data minimization
 */
function cleanupExpiredSessions() {
  const now = Date.now();
  
  // Clean up consent store
  for (const [sessionId, consent] of consentStore.entries()) {
    if (now - consent.grantedAt > SESSION_TTL) {
      consentStore.delete(sessionId);
    }
  }
  
  // Clean up local permissions store
  for (const [sessionId, permissions] of localPermissionStore.entries()) {
    if (now - permissions.grantedAt > SESSION_TTL) {
      localPermissionStore.delete(sessionId);
    }
  }
  
  // Clean up pending Sherlock store
  for (const [sessionId, pending] of pendingSherlockStore.entries()) {
    if (now - pending.timestamp > SESSION_TTL) {
      pendingSherlockStore.delete(sessionId);
    }
  }
}

// Set up automatic cleanup every hour
setInterval(cleanupExpiredSessions, 60 * 60 * 1000);

// ============================================================================
// EXPORTS
// ============================================================================

export {
  // Session management
  generateAnonymousSessionId,
  normalizeSessionId,
  isValidSessionId,
  
  // Consent management
  setUserConsent,
  hasAIConsent,
  hasToolConsent,
  getConsentState,
  revokeUserConsent,
  revokeSpecificConsent,
  
  // Data portability
  exportSessionData,
  
  // Right to be forgotten
  deleteSessionData,
  
  // Local permissions
  setLocalPermissions,
  getLocalPermissions,
  hasOfflineLocalPermission,
  
  // Sherlock
  setPendingSherlock,
  getPendingSherlock,
  deletePendingSherlock,
  
  // Constants
  SESSION_TTL,
  MAX_SESSION_ID_LENGTH,
};
