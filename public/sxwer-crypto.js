/**
 * SXWer AI ChatBot — Browser-side E2E Encryption Helper
 * public/sxwer-crypto.js
 *
 * Provides the client-side half of the E2E encrypted chat protocol.
 *
 * Depends on:
 *   /public/nacl.min.js       (TweetNaCl, loaded before this script)
 *   /public/nacl-util.min.js  (TweetNaCl encoding utils, loaded before this script)
 *
 * Algorithm: X25519 key exchange + XSalsa20-Poly1305 authenticated encryption.
 * Key material is held only in memory (sessionStorage is used only for the
 * Base64 public key, NEVER for the secret key).
 *
 * Privacy guarantees:
 *   - Secret key is held only in the JavaScript memory of this page.
 *   - The key is lost when the tab closes (ephemeral, per-session).
 *   - Plaintext is never sent over the network.
 *   - No key material is ever written to localStorage, IndexedDB, or cookies.
 *
 * Usage:
 *   await SXWerCrypto.init();            // generates key pair, performs handshake
 *   const reply = await SXWerCrypto.sendEncrypted(sessionToken, csrfToken, message);
 *   // reply.plaintext contains the decrypted bot response
 */

/* global nacl, naclUtil */

(function (global) {
  "use strict";

  const SCHEMA_VERSION = "sxwer-e2e-v1";

  // ============================================================================
  // STATE (in-memory only; cleared on page unload)
  // ============================================================================

  let _keyPair = null;          // { publicKey: Uint8Array, secretKey: Uint8Array }
  let _serverPublicKey = null;  // Uint8Array — received from server during handshake
  let _handshakeComplete = false;

  // ============================================================================
  // BASE64 HELPERS (using built-in Web APIs)
  // ============================================================================

  function toBase64(uint8Array) {
    let binary = "";
    for (let i = 0; i < uint8Array.length; i++) {
      binary += String.fromCharCode(uint8Array[i]);
    }
    return btoa(binary);
  }

  function fromBase64(b64) {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  // ============================================================================
  // KEY PAIR MANAGEMENT
  // ============================================================================

  /**
   * Generate a fresh ephemeral key pair for this session.
   * The secret key is stored only in memory.
   * The public key Base64 is stored in sessionStorage so it survives
   * soft navigations within the same tab, but is cleared on tab close.
   */
  function generateKeyPair() {
    _keyPair = nacl.box.keyPair();
    // Store only the public key in sessionStorage (not the secret key)
    try {
      sessionStorage.setItem(
        "sxwer_e2e_pubkey",
        toBase64(_keyPair.publicKey),
      );
    } catch {
      // sessionStorage may be unavailable in some browsers/modes — that's OK
    }
    return _keyPair;
  }

  /**
   * Rotate the key pair. Old messages become permanently unreadable.
   * If sessionToken and csrfToken are provided, also notifies the server
   * to clear the old client key registration.
   *
   * @param {string} [sessionToken]
   * @param {string} [csrfToken]
   * @returns {Promise<{ publicKey: string }>}
   */
  async function rotateKeyPair(sessionToken, csrfToken) {
    // Optionally notify server to clear the old client key
    if (sessionToken && csrfToken) {
      try {
        await fetch("/api/crypto/rotate-client-key", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-session-token": sessionToken,
            "x-csrf-token": csrfToken,
          },
          body: JSON.stringify({}),
        });
      } catch {
        // Server notification is best-effort; key rotation still proceeds locally
      }
    }

    // Generate new key pair locally
    const oldKeyPair = _keyPair;
    _keyPair = nacl.box.keyPair();
    _serverPublicKey = null;
    _handshakeComplete = false;

    // Zero the old secret key
    if (oldKeyPair) oldKeyPair.secretKey.fill(0);

    try {
      sessionStorage.setItem("sxwer_e2e_pubkey", toBase64(_keyPair.publicKey));
    } catch { /* ignore */ }

    return { publicKey: toBase64(_keyPair.publicKey) };
  }

  /**
   * Export the current key pair encrypted with a user-supplied passphrase.
   * The exported bundle can be imported later with `importKeyPair()`.
   *
   * The passphrase is hashed to derive a symmetric key using SubtleCrypto
   * (SHA-256 → PBKDF2 → AES-GCM). The result is safe to store or transmit.
   *
   * @param {string} passphrase - User-chosen passphrase
   * @returns {Promise<string>} JSON string of the encrypted key bundle
   */
  async function exportKeyPair(passphrase) {
    if (!_keyPair) throw new Error("No key pair to export");

    const encoder = new TextEncoder();
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // Derive AES-GCM key from passphrase using PBKDF2
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      encoder.encode(passphrase),
      "PBKDF2",
      false,
      ["deriveKey"],
    );
    const aesKey = await crypto.subtle.deriveKey(
      { name: "PBKDF2", salt, iterations: 310000, hash: "SHA-256" },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt"],
    );

    // Encrypt the secret key bytes
    const secretKeyData = new Uint8Array(
      await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        aesKey,
        _keyPair.secretKey,
      ),
    );

    const bundle = {
      schemaVersion: SCHEMA_VERSION,
      algorithm: "PBKDF2-AES-GCM",
      pbkdf2Iterations: 310000,
      salt: toBase64(salt),
      iv: toBase64(iv),
      encryptedSecretKey: toBase64(secretKeyData),
      publicKey: toBase64(_keyPair.publicKey),
      exportedAt: Date.now(),
    };

    // Return a Blob so callers can create an Object URL for download
    return new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
  }

  /**
   * Import a key pair from an encrypted bundle created by `exportKeyPair()`.
   *
   * @param {string|object} bundleOrJson - JSON string or parsed object from `exportKeyPair()`
   * @param {string} passphrase - The passphrase used during export
   * @returns {Promise<{ publicKey: string }>}
   */
  async function importKeyPair(bundleOrJson, passphrase) {
    const bundle = typeof bundleOrJson === "string" ? JSON.parse(bundleOrJson) : bundleOrJson;
    const encoder = new TextEncoder();

    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      encoder.encode(passphrase),
      "PBKDF2",
      false,
      ["deriveKey"],
    );
    const aesKey = await crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: fromBase64(bundle.salt),
        iterations: bundle.pbkdf2Iterations || 310000,
        hash: "SHA-256",
      },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      false,
      ["decrypt"],
    );

    const secretKeyBytes = new Uint8Array(
      await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: fromBase64(bundle.iv) },
        aesKey,
        fromBase64(bundle.encryptedSecretKey),
      ),
    );

    const publicKeyBytes = fromBase64(bundle.publicKey);

    // Zero old secret key before replacing
    if (_keyPair) _keyPair.secretKey.fill(0);

    _keyPair = { publicKey: publicKeyBytes, secretKey: secretKeyBytes };
    _serverPublicKey = null;
    _handshakeComplete = false;

    try {
      sessionStorage.setItem("sxwer_e2e_pubkey", bundle.publicKey);
    } catch { /* ignore */ }

    return { publicKey: bundle.publicKey };
  }

  // ============================================================================
  // HANDSHAKE
  // ============================================================================

  /**
   * Perform the key-exchange handshake with the server.
   * Sends the client's public key; receives the server's public key.
   * Both sides derive the shared secret locally — it is never transmitted.
   *
   * Must be called before `sendEncrypted()`.
   *
   * @param {string} sessionToken
   * @param {string} csrfToken
   * @returns {Promise<void>}
   */
  async function handshake(sessionToken, csrfToken) {
    if (!_keyPair) generateKeyPair();

    const resp = await fetch("/api/crypto/handshake", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-session-token": sessionToken,
        "x-csrf-token": csrfToken,
      },
      body: JSON.stringify({
        clientPublicKey: toBase64(_keyPair.publicKey),
      }),
    });

    if (!resp.ok) {
      throw new Error(`Handshake failed (HTTP ${resp.status})`);
    }

    const data = await resp.json();
    if (typeof data.serverPublicKey !== "string") {
      throw new Error("Handshake response missing serverPublicKey");
    }

    _serverPublicKey = fromBase64(data.serverPublicKey);
    _handshakeComplete = true;

    return data;
  }

  // ============================================================================
  // ENCRYPT / DECRYPT
  // ============================================================================

  /**
   * Encrypt a plaintext string for the server using the shared secret derived
   * from our private key and the server's public key (nacl.box).
   *
   * @param {string} plaintext
   * @returns {{ ciphertext: string, nonce: string, clientPublicKey: string, schemaVersion: string }}
   */
  function encrypt(plaintext) {
    if (!_keyPair || !_serverPublicKey) {
      throw new Error("Handshake not complete. Call SXWerCrypto.init() first.");
    }

    const nonce = nacl.randomBytes(24);
    const messageBytes = naclUtil.decodeUTF8(plaintext);
    const ciphertextBytes = nacl.box(
      messageBytes,
      nonce,
      _serverPublicKey,
      _keyPair.secretKey,
    );

    // Zero the message bytes immediately
    messageBytes.fill(0);

    return {
      ciphertext: toBase64(ciphertextBytes),
      nonce: toBase64(nonce),
      clientPublicKey: toBase64(_keyPair.publicKey),
      schemaVersion: SCHEMA_VERSION,
    };
  }

  /**
   * Decrypt a ciphertext produced by the server using the shared secret.
   *
   * @param {string} ciphertextB64
   * @param {string} nonceB64
   * @returns {string} Plaintext
   */
  function decrypt(ciphertextB64, nonceB64) {
    if (!_keyPair || !_serverPublicKey) {
      throw new Error("Handshake not complete. Call SXWerCrypto.init() first.");
    }

    const plaintextBytes = nacl.box.open(
      fromBase64(ciphertextB64),
      fromBase64(nonceB64),
      _serverPublicKey,
      _keyPair.secretKey,
    );

    if (!plaintextBytes) {
      throw new Error(
        "Decryption failed: authentication tag mismatch. " +
        "The response may have been tampered with.",
      );
    }

    const plaintext = naclUtil.encodeUTF8(plaintextBytes);
    plaintextBytes.fill(0);
    return plaintext;
  }

  // ============================================================================
  // HIGH-LEVEL SEND HELPER
  // ============================================================================

  /**
   * Encrypt a message and send it to /api/chat/encrypted; decrypt the response.
   *
   * @param {string} message       - Plaintext message
   * @param {object} options       - { sessionToken, csrfToken, sessionId, consent, localPermissions, mode }
   * @returns {Promise<object>}    - Decrypted response data (same shape as /api/chat response)
   */
  async function sendEncrypted(message, options = {}) {
    const { sessionToken, csrfToken, sessionId, consent, localPermissions, mode } = options;

    if (!_handshakeComplete) {
      await handshake(sessionToken, csrfToken);
    }

    const envelope = encrypt(message);

    const resp = await fetch("/api/chat/encrypted", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-session-token": sessionToken,
        "x-csrf-token": csrfToken,
        ...(sessionId ? { "x-session-id": sessionId } : {}),
      },
      body: JSON.stringify({
        ...envelope,
        consent,
        localPermissions,
        mode: mode || "offline",
      }),
    });

    if (!resp.ok) {
      const errData = await resp.json().catch(() => ({}));
      throw new Error(errData.error || `Encrypted chat request failed (HTTP ${resp.status})`);
    }

    const data = await resp.json();

    if (!data.ciphertext || !data.nonce) {
      throw new Error("Server response is missing encrypted payload");
    }

    const plaintext = decrypt(data.ciphertext, data.nonce);

    // Return the same shape as /api/chat — callers need not know about encryption
    return {
      ...data,
      response: plaintext,
      ciphertext: undefined,
      nonce: undefined,
      encrypted: true,
    };
  }

  // ============================================================================
  // STATUS
  // ============================================================================

  /**
   * Return public status information about the current E2E session.
   * Never includes secret key material.
   *
   * @returns {object}
   */
  function getStatus() {
    return {
      e2eEnabled: _handshakeComplete,
      handshakeComplete: _handshakeComplete,
      hasKeyPair: _keyPair !== null,
      hasServerPublicKey: _serverPublicKey !== null,
      clientPublicKey: _keyPair ? toBase64(_keyPair.publicKey) : null,
      serverPublicKey: _serverPublicKey ? toBase64(_serverPublicKey) : null,
      // Legacy alias
      publicKey: _keyPair ? toBase64(_keyPair.publicKey) : null,
      schemaVersion: SCHEMA_VERSION,
    };
  }

  /**
   * Clear all in-memory key material.
   * Called when the user deletes their local data or disables encryption.
   */
  function clearKeys() {
    if (_keyPair) {
      _keyPair.secretKey.fill(0);
      _keyPair = null;
    }
    _serverPublicKey = null;
    _handshakeComplete = false;
    try {
      sessionStorage.removeItem("sxwer_e2e_pubkey");
    } catch { /* ignore */ }
  }

  // ============================================================================
  // INIT
  // ============================================================================

  /**
   * Initialise the E2E crypto layer.
   * Generates a key pair (or reuses one from this session) and performs the
   * server handshake.
   *
   * Call once on page load, before sending any messages.
   *
   * @param {string} sessionToken
   * @param {string} csrfToken
   * @returns {Promise<object>} Handshake result from server
   */
  async function init(sessionToken, csrfToken) {
    generateKeyPair();
    return handshake(sessionToken, csrfToken);
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  global.SXWerCrypto = {
    init,
    handshake,
    sendEncrypted,
    rotateKeyPair,
    exportKeyPair,
    importKeyPair,
    getStatus,
    clearKeys,
    // Low-level (for advanced use / testing)
    _encrypt: encrypt,
    _decrypt: decrypt,
  };
})(window);
