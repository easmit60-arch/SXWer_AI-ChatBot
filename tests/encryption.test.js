/**
 * tests/encryption.test.js
 *
 * Unit tests for the E2E encryption modules.
 *
 * Tests cover:
 *   - messageEncryption.js   — encrypt/decrypt round-trip, tamper detection
 *   - replayGuard.js         — nonce tracking, replay rejection, TTL pruning
 *   - keyManager.js          — key pair generation, rotation, client key store
 *   - server-offline.js      — presence of encryption endpoints
 *   - index.html             — presence of E2E UI elements and crypto scripts
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");

// ── Read source files once ────────────────────────────────────────────────────
const serverOffline = fs.readFileSync(
  path.join(root, "server-offline.js"),
  "utf8",
);
const indexHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");
const sxwerCrypto = fs.readFileSync(
  path.join(root, "public", "sxwer-crypto.js"),
  "utf8",
);

// ── Load crypto modules ───────────────────────────────────────────────────────
const { encryptMessage, decryptMessage } = await import(
  "../services/crypto/messageEncryption.js"
);
const { acceptNonce, pruneExpiredSessions } = await import(
  "../services/crypto/replayGuard.js"
);
const {
  getServerKeyPair,
  getServerPublicKeyBase64,
  rotateServerKeyPair,
  registerClientPublicKey,
  getClientPublicKey,
  removeClientPublicKey,
} = await import("../services/crypto/keyManager.js");

// ── nacl (used for generating test key pairs) ─────────────────────────────────
import nacl from "tweetnacl";
import naclUtilPkg from "tweetnacl-util";
const { encodeBase64, decodeBase64 } = naclUtilPkg;

// =============================================================================
// messageEncryption.js tests
// =============================================================================

test("encrypt then decrypt returns original plaintext", () => {
  const alice = nacl.box.keyPair();
  const bob = nacl.box.keyPair();

  const envelope = encryptMessage(
    "Hello, Bob!",
    bob.publicKey,
    alice.secretKey,
  );

  assert.ok(envelope.ciphertext, "ciphertext must be present");
  assert.ok(envelope.nonce, "nonce must be present");
  assert.strictEqual(envelope.schemaVersion, "sxwer-e2e-v1", "schema version set");

  const plaintext = decryptMessage(
    envelope.ciphertext,
    envelope.nonce,
    alice.publicKey,
    bob.secretKey,
  );

  assert.strictEqual(plaintext, "Hello, Bob!", "decrypted plaintext matches");
});

test("decrypt throws when message is tampered", () => {
  const alice = nacl.box.keyPair();
  const bob = nacl.box.keyPair();

  const envelope = encryptMessage(
    "Sensitive message",
    bob.publicKey,
    alice.secretKey,
  );

  // Flip a byte in the ciphertext
  const ciphertextBytes = decodeBase64(envelope.ciphertext);
  ciphertextBytes[0] ^= 0xff;
  const tampered = encodeBase64(ciphertextBytes);

  assert.throws(
    () =>
      decryptMessage(
        tampered,
        envelope.nonce,
        alice.publicKey,
        bob.secretKey,
      ),
    /decryption failed/i,
    "tampered ciphertext must throw",
  );
});

test("decrypt throws when wrong sender key is used", () => {
  const alice = nacl.box.keyPair();
  const eve = nacl.box.keyPair();   // impersonator
  const bob = nacl.box.keyPair();

  const envelope = encryptMessage(
    "Message from Alice",
    bob.publicKey,
    alice.secretKey,
  );

  // Bob tries to decrypt claiming the sender was Eve (wrong public key)
  assert.throws(
    () =>
      decryptMessage(
        envelope.ciphertext,
        envelope.nonce,
        eve.publicKey,  // ← wrong sender key
        bob.secretKey,
      ),
    /decryption failed/i,
    "wrong sender key must throw",
  );
});

test("encrypt produces unique nonces for each call", () => {
  const alice = nacl.box.keyPair();
  const bob = nacl.box.keyPair();

  const e1 = encryptMessage("msg1", bob.publicKey, alice.secretKey);
  const e2 = encryptMessage("msg2", bob.publicKey, alice.secretKey);

  assert.notStrictEqual(e1.nonce, e2.nonce, "nonces must be unique across messages");
});

// =============================================================================
// replayGuard.js tests
// =============================================================================

test("replayGuard accepts a new nonce", () => {
  const session = `test-session-${Date.now()}`;
  const nonce = encodeBase64(nacl.randomBytes(24));
  const accepted = acceptNonce(session, nonce);
  assert.ok(accepted, "fresh nonce must be accepted");
});

test("replayGuard rejects a replayed nonce", () => {
  const session = `test-session-replay-${Date.now()}`;
  const nonce = encodeBase64(nacl.randomBytes(24));

  const first = acceptNonce(session, nonce);
  const second = acceptNonce(session, nonce);

  assert.ok(first, "first use must be accepted");
  assert.ok(!second, "replayed nonce must be rejected");
});

test("replayGuard allows same nonce in different sessions", () => {
  const session1 = `session-a-${Date.now()}`;
  const session2 = `session-b-${Date.now()}`;
  const nonce = encodeBase64(nacl.randomBytes(24));

  const r1 = acceptNonce(session1, nonce);
  const r2 = acceptNonce(session2, nonce);

  assert.ok(r1, "accepted in session 1");
  assert.ok(r2, "same nonce accepted in different session");
});

test("pruneExpiredNonces runs without error", () => {
  assert.doesNotThrow(() => pruneExpiredSessions(), "pruning must not throw");
});

// =============================================================================
// keyManager.js tests
// =============================================================================

test("getServerKeyPair returns a valid nacl key pair", () => {
  const kp = getServerKeyPair();
  assert.ok(kp.publicKey instanceof Uint8Array, "publicKey is Uint8Array");
  assert.ok(kp.secretKey instanceof Uint8Array, "secretKey is Uint8Array");
  assert.strictEqual(kp.publicKey.length, 32, "X25519 public key is 32 bytes");
  assert.strictEqual(kp.secretKey.length, 32, "X25519 secret key is 32 bytes");
});

test("getServerPublicKeyBase64 returns a non-empty Base64 string", () => {
  const b64 = getServerPublicKeyBase64();
  assert.ok(typeof b64 === "string" && b64.length > 0, "public key Base64 is non-empty string");
  // Verify it decodes to 32 bytes
  assert.strictEqual(decodeBase64(b64).length, 32, "decoded server public key is 32 bytes");
});

test("rotateServerKeyPair produces a different key pair", () => {
  const before = getServerPublicKeyBase64();
  rotateServerKeyPair();
  const after = getServerPublicKeyBase64();
  assert.notStrictEqual(before, after, "server public key changes after rotation");
});

test("registerClientPublicKey and getClientPublicKey round-trip", () => {
  const sessionId = `kc-test-${Date.now()}`;
  const kp = nacl.box.keyPair();
  const b64 = encodeBase64(kp.publicKey);

  registerClientPublicKey(sessionId, b64);
  const retrieved = getClientPublicKey(sessionId);
  assert.ok(retrieved instanceof Uint8Array, "retrieved key is Uint8Array");
  assert.strictEqual(encodeBase64(retrieved), b64, "retrieved key matches registered key");
});

test("removeClientPublicKey removes registration", () => {
  const sessionId = `kc-remove-${Date.now()}`;
  const kp = nacl.box.keyPair();
  registerClientPublicKey(sessionId, encodeBase64(kp.publicKey));

  removeClientPublicKey(sessionId);
  const retrieved = getClientPublicKey(sessionId);
  assert.strictEqual(retrieved, null, "key removed from store");
});

// =============================================================================
// server-offline.js — presence of E2E endpoints
// =============================================================================

test("server-offline.js exposes GET /api/session endpoint", () => {
  assert.match(
    serverOffline,
    /app\.get\(["']\/api\/session["']/,
    "/api/session GET endpoint must be defined",
  );
});

test("server-offline.js exposes POST /api/crypto/handshake endpoint", () => {
  assert.match(
    serverOffline,
    /\/api\/crypto\/handshake/,
    "/api/crypto/handshake must be defined",
  );
});

test("server-offline.js exposes POST /api/chat/encrypted endpoint", () => {
  assert.match(
    serverOffline,
    /\/api\/chat\/encrypted/,
    "/api/chat/encrypted must be defined",
  );
});

test("server-offline.js exposes GET /api/crypto/status endpoint", () => {
  assert.match(
    serverOffline,
    /\/api\/crypto\/status/,
    "/api/crypto/status must be defined",
  );
});

test("server-offline.js exposes GET /api/crypto/disclosure endpoint", () => {
  assert.match(
    serverOffline,
    /\/api\/crypto\/disclosure/,
    "/api/crypto/disclosure must be defined",
  );
});

// =============================================================================
// index.html — E2E UI presence
// =============================================================================

test("index.html loads TweetNaCl browser library", () => {
  assert.match(indexHtml, /nacl\.min\.js/, "index.html must include nacl.min.js");
});

test("index.html loads sxwer-crypto.js", () => {
  assert.match(indexHtml, /sxwer-crypto\.js/, "index.html must include sxwer-crypto.js");
});

test("index.html includes e2e-badge element", () => {
  assert.match(indexHtml, /id="e2e-badge"/, "e2e-badge element must be present");
});

test("index.html includes link to /encryption-status", () => {
  assert.match(indexHtml, /\/encryption-status/, "link to encryption-status page must be present");
});

test("index.html initialises E2E encryption on load", () => {
  assert.match(
    indexHtml,
    /initE2EEncryption/,
    "initE2EEncryption must be called during initialisation",
  );
});

test("index.html defines getCsrfToken function", () => {
  assert.match(
    indexHtml,
    /function getCsrfToken/,
    "getCsrfToken function must be defined",
  );
});

test("index.html defines createSession function", () => {
  assert.match(
    indexHtml,
    /function createSession/,
    "createSession function must be defined",
  );
});

// =============================================================================
// sxwer-crypto.js — API surface
// =============================================================================

test("sxwer-crypto.js exports init, sendEncrypted, getStatus, clearKeys", () => {
  const requiredExports = ["init", "sendEncrypted", "getStatus", "clearKeys", "exportKeyPair", "importKeyPair", "rotateKeyPair"];
  for (const fn of requiredExports) {
    // The IIFE assigns to global.SXWerCrypto = { init, sendEncrypted, … }
    // using ES shorthand properties; match either `fn,` or `fn:` patterns.
    assert.match(
      sxwerCrypto,
      new RegExp(`\\b${fn}[,:]`),
      `sxwer-crypto.js must export ${fn}`,
    );
  }
});
