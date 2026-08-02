/**
 * SXWer AI ChatBot — Message Encryption Service
 *
 * Provides authenticated public-key encryption for chat messages using the
 * TweetNaCl `box` primitive (X25519 key exchange + XSalsa20-Poly1305 AEAD).
 *
 * Security properties:
 * - Confidentiality: only the holder of the recipient's private key can read.
 * - Integrity + Authentication: any tampering or forgery is detected.
 * - Replay protection: handled by replayGuard.js (nonces tracked per session).
 * - Forward secrecy: key pairs are ephemeral (per session); rotating them
 *   renders past ciphertext permanently unreadable.
 *
 * What this module does NOT do:
 * - It does not manage key pairs (see keyManager.js).
 * - It does not track nonces (see replayGuard.js).
 * - It does not log message content (plaintext is never written to logs).
 *
 * Encoding: all binary values are exchanged as standard Base64 strings so
 * they serialise cleanly over JSON without additional transport encoding.
 */

import nacl from "tweetnacl";
import naclUtil from "tweetnacl-util";
const { encodeBase64, decodeBase64 } = naclUtil;
// Use standard TextEncoder/TextDecoder to convert strings to/from Uint8Array.
// (tweetnacl-util's encodeUTF8/decodeUTF8 names are inverted relative to
//  natural expectations, so we avoid them to prevent confusion.)
const _textEncoder = new TextEncoder();
const _textDecoder = new TextDecoder();
import { SCHEMA_VERSION, NONCE_BYTES } from "./cryptoConfig.js";

// ============================================================================
// CORE ENCRYPT / DECRYPT
// ============================================================================

/**
 * Encrypt a plaintext string for a recipient.
 *
 * Uses `nacl.box`: the sender's secret key and the recipient's public key are
 * combined via X25519 Diffie-Hellman to derive a shared secret, which is then
 * used with XSalsa20-Poly1305 to encrypt + authenticate the plaintext.
 *
 * A fresh random nonce is generated for every call. The nonce MUST be
 * transmitted alongside the ciphertext so the recipient can decrypt.
 *
 * @param {string}     plaintext        - UTF-8 message text (never logged).
 * @param {Uint8Array} recipientPubKey  - Recipient's 32-byte public key.
 * @param {Uint8Array} senderSecretKey  - Sender's 32-byte secret key.
 * @returns {{ ciphertext: string, nonce: string, schemaVersion: string }}
 *   All binary values are Base64-encoded for JSON transport.
 */
export function encryptMessage(plaintext, recipientPubKey, senderSecretKey) {
  if (typeof plaintext !== "string") {
    throw new TypeError("plaintext must be a string");
  }
  if (!(recipientPubKey instanceof Uint8Array) || recipientPubKey.length !== 32) {
    throw new TypeError("recipientPubKey must be a 32-byte Uint8Array");
  }
  if (!(senderSecretKey instanceof Uint8Array) || senderSecretKey.length !== 32) {
    throw new TypeError("senderSecretKey must be a 32-byte Uint8Array");
  }

  const nonce = nacl.randomBytes(NONCE_BYTES);
  const messageBytes = _textEncoder.encode(plaintext);
  const ciphertextBytes = nacl.box(messageBytes, nonce, recipientPubKey, senderSecretKey);

  // Zero out the message bytes immediately after use
  messageBytes.fill(0);

  return Object.freeze({
    ciphertext: encodeBase64(ciphertextBytes),
    nonce: encodeBase64(nonce),
    schemaVersion: SCHEMA_VERSION,
  });
}

/**
 * Decrypt a ciphertext produced by `encryptMessage`.
 *
 * Returns the plaintext string on success, or throws on decryption failure
 * (which may indicate tampering, an incorrect key, or a bad nonce).
 *
 * @param {string}     ciphertextB64  - Base64-encoded ciphertext from `encryptMessage`.
 * @param {string}     nonceB64       - Base64-encoded nonce from `encryptMessage`.
 * @param {Uint8Array} senderPubKey   - Sender's 32-byte public key.
 * @param {Uint8Array} recipientSecretKey - Recipient's 32-byte secret key.
 * @returns {string} Decrypted plaintext
 * @throws  {Error}  If decryption fails (authentication tag mismatch or invalid input)
 */
export function decryptMessage(ciphertextB64, nonceB64, senderPubKey, recipientSecretKey) {
  if (typeof ciphertextB64 !== "string" || typeof nonceB64 !== "string") {
    throw new TypeError("ciphertext and nonce must be Base64 strings");
  }
  if (!(senderPubKey instanceof Uint8Array) || senderPubKey.length !== 32) {
    throw new TypeError("senderPubKey must be a 32-byte Uint8Array");
  }
  if (!(recipientSecretKey instanceof Uint8Array) || recipientSecretKey.length !== 32) {
    throw new TypeError("recipientSecretKey must be a 32-byte Uint8Array");
  }

  let ciphertextBytes, nonceBytes;
  try {
    ciphertextBytes = decodeBase64(ciphertextB64);
    nonceBytes = decodeBase64(nonceB64);
  } catch {
    throw new Error("Invalid Base64 encoding in encrypted message");
  }

  const plaintextBytes = nacl.box.open(
    ciphertextBytes,
    nonceBytes,
    senderPubKey,
    recipientSecretKey,
  );

  if (!plaintextBytes) {
    // nacl.box.open returns null on authentication failure
    throw new Error(
      "Decryption failed: message authentication tag did not match. " +
      "The message may have been tampered with, the key is wrong, or the nonce is incorrect.",
    );
  }

  const plaintext = _textDecoder.decode(plaintextBytes);

  // Zero out decrypted bytes immediately after converting to string
  plaintextBytes.fill(0);

  return plaintext;
}

// ============================================================================
// ENVELOPE HELPERS
// ============================================================================

/**
 * Validate that an encrypted envelope object has the expected shape.
 * Does NOT decrypt — just checks structure before attempting decryption.
 *
 * @param {unknown} envelope - Object to validate
 * @returns {boolean}
 */
export function isValidEnvelope(envelope) {
  if (typeof envelope !== "object" || envelope === null) return false;
  if (typeof envelope.ciphertext !== "string") return false;
  if (typeof envelope.nonce !== "string") return false;
  if (typeof envelope.schemaVersion !== "string") return false;
  if (typeof envelope.clientPublicKey !== "string") return false;
  return true;
}

/**
 * Produce a JSON-safe summary of an encrypted envelope for logging.
 * Contains NO plaintext, NO keys — only metadata safe to write to logs.
 *
 * @param {object} envelope
 * @returns {object}
 */
export function envelopeSummary(envelope) {
  return Object.freeze({
    schemaVersion: envelope?.schemaVersion ?? "unknown",
    ciphertextLength: typeof envelope?.ciphertext === "string"
      ? envelope.ciphertext.length
      : 0,
    hasNonce: typeof envelope?.nonce === "string" && envelope.nonce.length > 0,
    hasClientPublicKey: typeof envelope?.clientPublicKey === "string",
  });
}

// ============================================================================
// RE-EXPORT UTILITIES
// ============================================================================

export { encodeBase64, decodeBase64 };
