/**
 * SXWer AI ChatBot — Crypto Configuration
 *
 * Centralises algorithm choices, key-size constants, and schema versioning.
 * All crypto code imports its constants from here so that a single change
 * propagates consistently.
 *
 * Algorithm: X25519 key exchange + XSalsa20-Poly1305 authenticated encryption
 * (TweetNaCl box primitive — well-audited, widely deployed, constant-time)
 *
 * Nothing sensitive is stored in this file.
 */

/**
 * Schema version written into every encrypted envelope.
 * Increment when the envelope format changes to allow forward compatibility.
 */
export const SCHEMA_VERSION = "sxwer-e2e-v1";

/**
 * Display name for the encryption algorithm used in disclosures.
 * Value mirrors the TweetNaCl primitive in use.
 */
export const KEY_EXCHANGE_ALGORITHM = "X25519";
export const ENCRYPTION_ALGORITHM = "XSalsa20-Poly1305";
export const SIGNING_ALGORITHM = "Ed25519";

/**
 * Byte lengths defined by the TweetNaCl spec.
 * Exposed here so callers can validate without importing nacl directly.
 */
export const PUBLIC_KEY_BYTES = 32;
export const SECRET_KEY_BYTES = 32;
export const NONCE_BYTES = 24;     // nacl.box.nonceLength
export const MAC_BYTES = 16;       // nacl.box overhead (Poly1305 tag)

/**
 * Server rotates its ephemeral key pair after this many milliseconds.
 * Limits the window of exposure if the server key is ever compromised.
 * Default: 24 hours.
 */
export const SERVER_KEY_ROTATION_MS = 24 * 60 * 60 * 1000;

/**
 * Nonces are tracked per session for replay-attack prevention.
 * Entries older than this TTL are pruned to limit memory growth.
 * Must be longer than the longest plausible message delivery delay.
 */
export const NONCE_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

/**
 * Human-readable disclosure shown to users before enabling E2E encryption.
 * Covers: what is encrypted, what is NOT stored, user rights.
 */
export const ENCRYPTION_DISCLOSURE = Object.freeze({
  title: "End-to-End Encryption — How It Works",
  summary:
    "When you enable E2E encryption, every message is scrambled on your device " +
    "before it travels to the server. Only your device and the intended recipient " +
    "can read the plaintext. The server stores and relays ciphertext only.",
  whatIsEncrypted: [
    "Message text",
    "Attachment contents",
    "File metadata",
  ],
  whatServerStores: [
    "Ciphertext only — never plaintext messages",
    "Your ephemeral public key (for the current session)",
    "Encrypted response ciphertext",
  ],
  whatBlockchainNeverStores: [
    "Messages or chat history",
    "Prompts or AI responses",
    "Names, usernames, or identifiers",
    "Files, images, or attachments",
    "IP addresses",
  ],
  whatBlockchainMayStore: [
    "SHA-256 hash of consent document (never the document itself)",
    "Consent-granted / consent-revoked timestamps",
    "Moderation-decision hashes (never the decision text)",
    "Policy-version identifier",
  ],
  userRights: [
    "You can view your current encryption status at any time.",
    "You can export your key pair (encrypted with a passphrase you choose).",
    "You can rotate your key pair — old messages become unreadable by design.",
    "You can delete your local message history.",
    "You can disable encryption and continue chatting in plaintext.",
    "None of these actions require the blockchain.",
  ],
  keyRotationNotice:
    "Key rotation is forward-secret: new messages use new keys. " +
    "Messages encrypted with rotated keys cannot be decrypted after rotation, " +
    "which protects past conversations if a future key is ever compromised.",
  onlineApiNotice:
    "If you enable an external AI provider (e.g. Mistral), the local server must " +
    "decrypt your message to forward it. This is disclosed before you enable online AI. " +
    "The server never logs the decrypted text.",
  isOptional: true,
  isRevocable: true,
  blockchainNotRequired: true,
});
