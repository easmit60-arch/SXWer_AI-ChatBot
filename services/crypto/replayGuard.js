/**
 * SXWer AI ChatBot — Replay Guard
 *
 * Tracks per-session nonces to prevent replay attacks.
 * A replayed message carries a nonce that was already accepted in the same
 * session; the guard rejects it before the payload reaches the chatbot.
 *
 * Design decisions:
 * - Nonces are stored in memory only (no disk persistence).
 * - Entries are pruned after NONCE_TTL_MS to bound memory growth.
 * - One registry per session ID; sessions are independent.
 * - The module is stateless from the caller's perspective — just call
 *   `acceptNonce()` and check the return value.
 */

import { NONCE_TTL_MS } from "./cryptoConfig.js";

/**
 * Map<sessionId, Map<nonce, timestamp>>
 * Outer map: one entry per active session.
 * Inner map: nonce string → time it was first seen (Unix ms).
 */
const nonceRegistry = new Map();

/**
 * Accept a nonce for a given session.
 *
 * Returns `true` if the nonce is new (safe to proceed).
 * Returns `false` if the nonce has already been seen — replay detected.
 *
 * Also prunes nonces older than NONCE_TTL_MS from the session's registry
 * to prevent unbounded memory growth.
 *
 * @param {string} sessionId - Session identifier
 * @param {string} nonce     - Base64-encoded 24-byte nonce
 * @returns {boolean} true = first use; false = replay
 */
export function acceptNonce(sessionId, nonce) {
  if (typeof sessionId !== "string" || !sessionId) return false;
  if (typeof nonce !== "string" || !nonce) return false;

  if (!nonceRegistry.has(sessionId)) {
    nonceRegistry.set(sessionId, new Map());
  }

  const sessionNonces = nonceRegistry.get(sessionId);
  const now = Date.now();

  // Prune expired nonces for this session
  for (const [n, ts] of sessionNonces.entries()) {
    if (now - ts > NONCE_TTL_MS) {
      sessionNonces.delete(n);
    }
  }

  if (sessionNonces.has(nonce)) {
    // Nonce already seen — replay attack or duplicate delivery
    console.warn("[CRYPTO] Replay detected: nonce already used for session.");
    return false;
  }

  sessionNonces.set(nonce, now);
  return true;
}

/**
 * Remove all nonce records for a session.
 * Call when a session ends or when the client rotates its key pair.
 *
 * @param {string} sessionId
 */
export function clearSessionNonces(sessionId) {
  nonceRegistry.delete(sessionId);
}

/**
 * Purge all nonce registries that have no entries, or all entries of which
 * have expired. Exposed for periodic maintenance (e.g. via setInterval).
 */
export function pruneExpiredSessions() {
  const now = Date.now();
  for (const [sessionId, sessionNonces] of nonceRegistry.entries()) {
    for (const [nonce, ts] of sessionNonces.entries()) {
      if (now - ts > NONCE_TTL_MS) sessionNonces.delete(nonce);
    }
    if (sessionNonces.size === 0) nonceRegistry.delete(sessionId);
  }
}

// Automatically prune expired sessions every hour
setInterval(pruneExpiredSessions, 60 * 60 * 1000).unref();
