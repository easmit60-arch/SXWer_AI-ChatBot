/**
 * SXWer AI ChatBot - Hash Service
 *
 * HUMAN RIGHTS DESIGN:
 * - Only hashes are ever written on-chain, never raw documents.
 * - SHA-256 is used for consent document fingerprinting.
 * - Deterministic: the same document always produces the same hash,
 *   enabling verification without storing the original content.
 * - Salted receipt hashes prevent correlation across sessions.
 *
 * WHAT THIS DOES:
 * - Hash consent documents for on-chain commitment
 * - Hash consent receipt objects for integrity verification
 * - Generate nonces for replay protection
 * - Verify that a stored hash matches a provided document
 */

import crypto from 'crypto';

// ============================================================================
// DOCUMENT HASHING
// ============================================================================

/**
 * Hash a consent document using SHA-256.
 * Only the hash is written on-chain — never the document content.
 *
 * @param {string|Object} document - Consent document text or object
 * @returns {string} Hex-encoded SHA-256 hash prefixed with algorithm identifier
 */
function hashConsentDocument(document) {
  if (document === null || document === undefined) {
    throw new TypeError('[HASH] Document must not be null or undefined.');
  }

  const content = typeof document === 'string'
    ? document
    : JSON.stringify(document, null, 0);

  const hash = crypto.createHash('sha256').update(content, 'utf8').digest('hex');
  return `sha256:${hash}`;
}

/**
 * Hash a consent receipt object.
 * Used to create an integrity fingerprint of the full receipt before signing.
 *
 * @param {Object} receipt - Consent receipt object
 * @returns {string} Hex-encoded SHA-256 hash prefixed with algorithm identifier
 */
function hashConsentReceipt(receipt) {
  if (typeof receipt !== 'object' || receipt === null) {
    throw new TypeError('[HASH] Receipt must be a non-null object.');
  }

  // Deterministic serialisation: sort keys to ensure stable ordering
  const stable = JSON.stringify(receipt, Object.keys(receipt).sort());
  const hash = crypto.createHash('sha256').update(stable, 'utf8').digest('hex');
  return `sha256:${hash}`;
}

// ============================================================================
// NONCE GENERATION
// ============================================================================

/**
 * Generate a cryptographically secure nonce for replay protection.
 * Each consent transaction carries a unique nonce.
 *
 * @returns {string} 32-byte hex nonce
 */
function generateNonce() {
  return crypto.randomBytes(32).toString('hex');
}

// ============================================================================
// VERIFICATION
// ============================================================================

/**
 * Verify that a stored hash matches a document.
 * Use this to confirm that a consent document has not been tampered with.
 *
 * @param {string|Object} document - The document to verify
 * @param {string} storedHash - The stored hash to compare against (e.g. "sha256:abc...")
 * @returns {boolean} True if the document matches the stored hash
 */
function verifyDocumentHash(document, storedHash) {
  if (!storedHash || typeof storedHash !== 'string') return false;

  try {
    const computed = hashConsentDocument(document);
    // Constant-time comparison to prevent timing attacks
    const a = Buffer.from(computed);
    const b = Buffer.from(storedHash);
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Verify that a stored receipt hash matches a receipt object.
 *
 * @param {Object} receipt - The receipt object to verify
 * @param {string} storedHash - The stored receipt hash (e.g. "sha256:abc...")
 * @returns {boolean} True if the receipt matches the stored hash
 */
function verifyReceiptHash(receipt, storedHash) {
  if (!storedHash || typeof storedHash !== 'string') return false;

  try {
    const computed = hashConsentReceipt(receipt);
    const a = Buffer.from(computed);
    const b = Buffer.from(storedHash);
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// ============================================================================
// UTILITY
// ============================================================================

/**
 * Extract the raw hex value from a prefixed hash string.
 *
 * @param {string} prefixedHash - e.g. "sha256:abc123..."
 * @returns {string} Raw hex hash
 */
function extractHashValue(prefixedHash) {
  if (typeof prefixedHash !== 'string') return '';
  const colonIdx = prefixedHash.indexOf(':');
  return colonIdx >= 0 ? prefixedHash.slice(colonIdx + 1) : prefixedHash;
}

/**
 * Return the algorithm portion of a prefixed hash string.
 *
 * @param {string} prefixedHash - e.g. "sha256:abc123..."
 * @returns {string} Algorithm name, e.g. "sha256"
 */
function extractHashAlgorithm(prefixedHash) {
  if (typeof prefixedHash !== 'string') return 'unknown';
  const colonIdx = prefixedHash.indexOf(':');
  return colonIdx >= 0 ? prefixedHash.slice(0, colonIdx) : 'unknown';
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  hashConsentDocument,
  hashConsentReceipt,
  generateNonce,
  verifyDocumentHash,
  verifyReceiptHash,
  extractHashValue,
  extractHashAlgorithm,
};
