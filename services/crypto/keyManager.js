/**
 * SXWer AI ChatBot — Server Key Manager
 *
 * Manages the server's ephemeral key pair.
 *
 * Design decisions:
 * - The server key pair is ephemeral: generated on startup, rotated
 *   every SERVER_KEY_ROTATION_MS milliseconds (default 24 h).
 * - The secret key is held only in memory; it is never written to disk,
 *   logged, or transmitted.
 * - When the key pair rotates, all existing encrypted sessions become invalid
 *   (clients must re-handshake). This is intentional: it limits the exposure
 *   window if a server key is ever compromised.
 * - Client public keys are stored per-session in memory only, with a 24-hour
 *   TTL aligned with the consent manager's session TTL.
 *
 * Nothing in this module ever logs key material.
 */

import nacl from "tweetnacl";
import naclUtil from "tweetnacl-util";
const { encodeBase64, decodeBase64 } = naclUtil;
import { PUBLIC_KEY_BYTES, SERVER_KEY_ROTATION_MS } from "./cryptoConfig.js";

// ============================================================================
// SERVER KEY PAIR
// ============================================================================

let serverKeyPair = nacl.box.keyPair();
let keyPairCreatedAt = Date.now();

/**
 * Return the server's current key pair (object with publicKey and secretKey
 * Uint8Arrays). The secret key is never base64-encoded or transmitted.
 *
 * @returns {{ publicKey: Uint8Array, secretKey: Uint8Array }}
 */
export function getServerKeyPair() {
  return serverKeyPair;
}

/**
 * Return the server's public key as a Base64 string suitable for JSON
 * transport to clients during the handshake.
 *
 * @returns {string} Base64-encoded 32-byte public key
 */
export function getServerPublicKeyBase64() {
  return encodeBase64(serverKeyPair.publicKey);
}

/**
 * Rotate the server key pair immediately.
 *
 * After rotation, any client that has completed a handshake with the old
 * public key must re-handshake. Existing sessions are invalidated.
 * The old secret key is zeroed from memory before the reference is dropped.
 *
 * @returns {{ publicKey: string, rotatedAt: number }}
 */
export function rotateServerKeyPair() {
  // Zero the old secret key immediately to minimise exposure window
  serverKeyPair.secretKey.fill(0);

  serverKeyPair = nacl.box.keyPair();
  keyPairCreatedAt = Date.now();

  // Log rotation event — no key material, just metadata
  console.log("[CRYPTO] Server key pair rotated.");

  return Object.freeze({
    publicKey: encodeBase64(serverKeyPair.publicKey),
    rotatedAt: keyPairCreatedAt,
  });
}

/**
 * Return key pair metadata (for status endpoints and logging).
 * Never includes the secret key.
 *
 * @returns {{ publicKey: string, createdAt: number, ageMs: number }}
 */
export function getKeyPairMetadata() {
  return Object.freeze({
    publicKey: encodeBase64(serverKeyPair.publicKey),
    createdAt: keyPairCreatedAt,
    ageMs: Date.now() - keyPairCreatedAt,
  });
}

// Automatically rotate the server key pair on schedule
setInterval(() => {
  rotateServerKeyPair();
  // Inform active sessions that they need to re-handshake
  invalidateAllSessions();
}, SERVER_KEY_ROTATION_MS).unref();

// ============================================================================
// SESSION CLIENT-KEY STORE
// ============================================================================

/**
 * @typedef {Object} ClientKeyRecord
 * @property {Uint8Array} publicKey  - Client's 32-byte public key
 * @property {number}     createdAt  - Unix ms timestamp
 */

/** @type {Map<string, ClientKeyRecord>} */
const clientKeyStore = new Map();

const CLIENT_KEY_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Register a client's public key for a session, obtained during the handshake.
 * Only the public key is stored — private keys never leave the client.
 *
 * @param {string} sessionId
 * @param {string} clientPublicKeyB64 - Base64-encoded 32-byte client public key
 * @throws {Error} if the key is not a valid 32-byte key
 */
export function registerClientPublicKey(sessionId, clientPublicKeyB64) {
  if (typeof sessionId !== "string" || !sessionId) {
    throw new TypeError("sessionId must be a non-empty string");
  }
  if (typeof clientPublicKeyB64 !== "string") {
    throw new TypeError("clientPublicKeyB64 must be a string");
  }

  let keyBytes;
  try {
    keyBytes = decodeBase64(clientPublicKeyB64);
  } catch {
    throw new Error("clientPublicKey is not valid Base64");
  }

  if (keyBytes.length !== PUBLIC_KEY_BYTES) {
    throw new Error(
      `clientPublicKey must be exactly ${PUBLIC_KEY_BYTES} bytes (got ${keyBytes.length})`,
    );
  }

  clientKeyStore.set(sessionId, {
    publicKey: keyBytes,
    createdAt: Date.now(),
  });
}

/**
 * Retrieve the stored client public key for a session.
 * Returns `null` if no key is registered or the record has expired.
 *
 * @param {string} sessionId
 * @returns {Uint8Array|null}
 */
export function getClientPublicKey(sessionId) {
  const record = clientKeyStore.get(sessionId);
  if (!record) return null;

  if (Date.now() - record.createdAt > CLIENT_KEY_TTL_MS) {
    clientKeyStore.delete(sessionId);
    return null;
  }

  return record.publicKey;
}

/**
 * Remove the stored client key for a session (e.g. on key rotation or logout).
 *
 * @param {string} sessionId
 */
export function removeClientPublicKey(sessionId) {
  clientKeyStore.delete(sessionId);
}

/**
 * Invalidate all stored client sessions (called when the server key pair
 * rotates, since the shared secret is no longer valid).
 */
export function invalidateAllSessions() {
  clientKeyStore.clear();
  console.log("[CRYPTO] All client sessions invalidated after server key rotation.");
}

// Prune expired client key records every hour
setInterval(() => {
  const now = Date.now();
  for (const [sid, record] of clientKeyStore.entries()) {
    if (now - record.createdAt > CLIENT_KEY_TTL_MS) {
      clientKeyStore.delete(sid);
    }
  }
}, 60 * 60 * 1000).unref();
