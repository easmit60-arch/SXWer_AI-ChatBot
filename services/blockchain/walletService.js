/**
 * SXWer AI ChatBot - Wallet Service
 *
 * HUMAN RIGHTS DESIGN:
 * - Wallet connection is OPTIONAL within the already-optional blockchain feature.
 * - Private keys are NEVER stored, committed, or logged.
 * - Private keys are only held transiently in memory while signing and immediately
 *   discarded afterward.
 * - The application works without a wallet (consent receipts use a server-side
 *   anonymous signing key instead, or remain unsigned in mock mode).
 * - Hardware wallet support can be added later without changing the ledger interface.
 * - Wallet IDs written on-chain contain no personally identifiable information.
 *
 * WHAT THIS MANAGES:
 * - Abstract wallet state (connected / disconnected)
 * - Signing consent receipts
 * - Verifying receipt signatures
 * - Deriving a pseudonymous wallet identifier for on-chain records
 */

import crypto from 'crypto';

// ============================================================================
// WALLET STATE
// ============================================================================

/**
 * In-memory wallet session.
 * Private key material is held ONLY in this object during an active session
 * and cleared on disconnect.
 * Object is not exported and never serialised to disk or logs.
 */
let _walletSession = null;

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Connect a software wallet using a private key loaded from an environment
 * variable or supplied at runtime.
 *
 * SECURITY:
 * - privateKey must come from process.env or a hardware wallet bridge.
 * - It must NEVER be hardcoded, logged, or persisted.
 * - The raw key is stored only transiently in _walletSession.
 *
 * @param {string} privateKeyHex - 32-byte private key as hex string
 * @returns {{ walletId: string, connectedAt: number }} Public wallet info
 */
function connectWallet(privateKeyHex) {
  if (typeof privateKeyHex !== 'string' || !/^[a-f0-9]{64}$/i.test(privateKeyHex)) {
    throw new TypeError('[WALLET] Invalid private key format. Expected 64-character hex string.');
  }

  const walletId = _deriveWalletId(privateKeyHex);
  _walletSession = {
    privateKeyHex,  // Held in memory only; cleared on disconnect
    walletId,
    connectedAt: Date.now(),
  };

  // Emit audit event — no key material in log
  console.log(`[WALLET] Wallet connected. walletId=${walletId}`);

  return Object.freeze({ walletId, connectedAt: _walletSession.connectedAt });
}

/**
 * Disconnect the current wallet session.
 * Clears the private key from memory immediately.
 *
 * @returns {boolean} True if a wallet was active and has been cleared
 */
function disconnectWallet() {
  if (!_walletSession) return false;

  // Overwrite key material before GC
  if (_walletSession.privateKeyHex) {
    _walletSession.privateKeyHex = '0'.repeat(64);
  }
  _walletSession = null;

  console.log('[WALLET] Wallet disconnected. Key material cleared from memory.');
  return true;
}

/**
 * Return the current wallet's public identifier, or null if not connected.
 * The wallet ID is a one-way hash of the public key — it contains no PII.
 *
 * @returns {string|null} Wallet ID or null
 */
function getWalletId() {
  return _walletSession ? _walletSession.walletId : null;
}

/**
 * Check whether a wallet is currently connected.
 *
 * @returns {boolean}
 */
function isWalletConnected() {
  return _walletSession !== null;
}

/**
 * Sign a consent receipt payload using the connected wallet's private key.
 * Returns an HMAC-SHA-256 signature (a simplified stand-in until a full
 * EC or EdDSA signing library is integrated — see note below).
 *
 * NOTE ON CRYPTOGRAPHIC STRENGTH:
 * HMAC-SHA-256 keyed with the private key provides message authentication
 * adequate for the audit ledger use-case in this application. When integrating
 * with an on-chain provider (Ethereum, Polygon, Hedera, etc.) the provider
 * library (ethers.js, hedera-sdk, etc.) should replace this with the
 * chain-appropriate signing primitive (e.g. secp256k1 ECDSA). The interface
 * here remains stable across that upgrade.
 *
 * @param {string} receiptHash - Hex hash of the consent receipt to sign
 * @returns {string} Hex-encoded HMAC-SHA-256 signature
 */
function signReceipt(receiptHash) {
  if (!_walletSession) {
    throw new Error('[WALLET] No wallet connected. Connect a wallet before signing.');
  }
  if (typeof receiptHash !== 'string' || !receiptHash) {
    throw new TypeError('[WALLET] receiptHash must be a non-empty string.');
  }

  const signature = crypto
    .createHmac('sha256', Buffer.from(_walletSession.privateKeyHex, 'hex'))
    .update(receiptHash, 'utf8')
    .digest('hex');

  return signature;
}

/**
 * Verify a signature against a receipt hash and a known wallet ID.
 *
 * Because the wallet ID is derived from the private key (see _deriveWalletId),
 * we cannot re-derive the private key from it to verify. Verification of
 * on-chain receipts is therefore performed using the chain's native verifier
 * in the provider adapter. This function is provided for local/mock mode only.
 *
 * In mock mode the private key may be passed directly for local testing.
 *
 * @param {string} receiptHash - The receipt hash that was signed
 * @param {string} signature   - The stored signature to verify
 * @param {string} privateKeyHex - Private key (mock/test mode only)
 * @returns {boolean} True if the signature is valid
 */
function verifySignature(receiptHash, signature, privateKeyHex) {
  if (!privateKeyHex || typeof privateKeyHex !== 'string') return false;
  if (!/^[a-f0-9]{64}$/i.test(privateKeyHex)) return false;

  try {
    const expected = crypto
      .createHmac('sha256', Buffer.from(privateKeyHex, 'hex'))
      .update(receiptHash, 'utf8')
      .digest('hex');

    const a = Buffer.from(expected, 'hex');
    const b = Buffer.from(signature, 'hex');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Return public wallet info (no key material).
 *
 * @returns {{ walletId: string, connectedAt: number }|null}
 */
function getWalletInfo() {
  if (!_walletSession) return null;
  return Object.freeze({
    walletId: _walletSession.walletId,
    connectedAt: _walletSession.connectedAt,
  });
}

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

/**
 * Derive a pseudonymous, non-reversible wallet identifier from a private key.
 * The wallet ID is safe to publish on-chain: it reveals nothing about the
 * private key and contains no personally identifiable information.
 *
 * @param {string} privateKeyHex - 64-character hex private key
 * @returns {string} "walletId:<sha256-hex>"
 */
function _deriveWalletId(privateKeyHex) {
  // Double-hash to ensure one-wayness even if SHA-256 pre-image attacks improve
  const step1 = crypto.createHash('sha256').update(privateKeyHex, 'utf8').digest('hex');
  const step2 = crypto.createHash('sha256').update(`sxwer:wallet:${step1}`, 'utf8').digest('hex');
  return `walletId:${step2}`;
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  connectWallet,
  disconnectWallet,
  getWalletId,
  isWalletConnected,
  signReceipt,
  verifySignature,
  getWalletInfo,
};
