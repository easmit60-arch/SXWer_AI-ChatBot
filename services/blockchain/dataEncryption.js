/**
 * SXWer AI ChatBot - Data Encryption Service
 *
 * HUMAN RIGHTS DESIGN:
 * - All data stored off-chain (IPFS) is encrypted
 * - Encryption keys are user-controlled
 * - Hybrid encryption: data key + user key + NGO keys
 * - Keys are never stored on-chain
 * - Graceful degradation if encryption fails
 *
 * WHAT THIS DOES:
 * - Generate encryption keys
 * - Encrypt/decrypt data with symmetric keys
 * - Encrypt/decrypt symmetric keys with public keys (hybrid encryption)
 * - Manage key derivation and rotation
 *
 * DEPENDENCIES:
 * - tweetnacl: For X25519 key exchange and XSalsa20-Poly1305 encryption
 * - tweetnacl-util: For Base64 encoding/decoding
 * - crypto: Node.js crypto for hashing and key derivation
 */

import nacl from 'tweetnacl';
import naclUtil from 'tweetnacl-util';
const { encodeBase64, decodeBase64, encodeUTF8, decodeUTF8 } = naclUtil;
import crypto from 'crypto';

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Encryption configuration.
 */
const ENCRYPTION_CONFIG = Object.freeze({
  // Symmetric encryption algorithm
  symmetricAlgorithm: 'xsalsa20-poly1305',
  
  // Key exchange algorithm
  keyExchangeAlgorithm: 'x25519',
  
  // Key sizes
  symmetricKeySize: 32, // 256 bits
  publicKeySize: 32,  // 256 bits (X25519)
  secretKeySize: 32,  // 256 bits
  
  // Nonce size for XSalsa20-Poly1305
  nonceSize: 24,
  
  // Key derivation
  kdfAlgorithm: 'sha256',
  kdfIterations: 100000,
  kdfKeyLength: 32,
  
  // Schema version
  schemaVersion: '1.0.0',
});

// ============================================================================
// KEY MANAGEMENT
// ============================================================================

/**
 * Generate a new symmetric key for data encryption.
 *
 * @returns {Uint8Array} 32-byte symmetric key
 */
function generateSymmetricKey() {
  return nacl.randomBytes(ENCRYPTION_CONFIG.symmetricKeySize);
}

/**
 * Generate a new X25519 key pair.
 *
 * @returns {Object} Key pair with publicKey and secretKey (Uint8Array)
 */
function generateKeyPair() {
  return nacl.box.keyPair();
}

/**
 * Generate a key pair from a seed.
 * Useful for deterministic key generation (e.g., from a user's password).
 *
 * @param {Uint8Array|string} seed - 32-byte seed
 * @returns {Object} Key pair
 */
function generateKeyPairFromSeed(seed) {
  const seedBytes = typeof seed === 'string' 
    ? decodeBase64(seed) 
    : seed;
  return nacl.box.keyPair.fromSeed(seedBytes);
}

/**
 * Derive a key from a password using PBKDF2.
 *
 * @param {string} password - User password
 * @param {string|Uint8Array} salt - Salt value
 * @param {number} [iterations=ENCRYPTION_CONFIG.kdfIterations] - Iteration count
 * @param {number} [keyLength=ENCRYPTION_CONFIG.kdfKeyLength] - Key length
 * @returns {Promise<Uint8Array>} Derived key
 */
async function deriveKeyFromPassword(password, salt, 
  iterations = ENCRYPTION_CONFIG.kdfIterations,
  keyLength = ENCRYPTION_CONFIG.kdfKeyLength) {
  
  const saltBytes = typeof salt === 'string' ? decodeBase64(salt) : salt;
  
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(password, saltBytes, iterations, keyLength, 
      ENCRYPTION_CONFIG.kdfAlgorithm, (error, derivedKey) => {
        if (error) {
          reject(error);
        } else {
          resolve(derivedKey);
        }
      });
  });
}

/**
 * Generate a random salt.
 *
 * @param {number} [length=32] - Salt length in bytes
 * @returns {Uint8Array} Random salt
 */
function generateSalt(length = 32) {
  return nacl.randomBytes(length);
}

// ============================================================================
// SYMMETRIC ENCRYPTION
// ============================================================================

/**
 * Encrypt data using XSalsa20-Poly1305 with a symmetric key.
 *
 * @param {Uint8Array|string} data - Data to encrypt
 * @param {Uint8Array} key - 32-byte symmetric key
 * @returns {Object} Encrypted data with nonce and ciphertext
 */
function encryptSymmetric(data, key) {
  if (!(key instanceof Uint8Array) || key.length !== ENCRYPTION_CONFIG.symmetricKeySize) {
    throw new TypeError(`[ENCRYPTION] Key must be a ${ENCRYPTION_CONFIG.symmetricKeySize}-byte Uint8Array.`);
  }

  const dataBytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  const nonce = nacl.randomBytes(ENCRYPTION_CONFIG.nonceSize);
  
  const ciphertext = nacl.secretbox(dataBytes, nonce, key);
  
  // Clear sensitive data from memory
  dataBytes.fill(0);
  
  return {
    ciphertext: encodeBase64(ciphertext),
    nonce: encodeBase64(nonce),
    algorithm: ENCRYPTION_CONFIG.symmetricAlgorithm,
    schemaVersion: ENCRYPTION_CONFIG.schemaVersion,
  };
}

/**
 * Decrypt data using XSalsa20-Poly1305 with a symmetric key.
 *
 * @param {Object} encrypted - Encrypted data object
 * @param {Uint8Array} key - 32-byte symmetric key
 * @returns {Uint8Array} Decrypted data
 * @throws {Error} If decryption fails
 */
function decryptSymmetric(encrypted, key) {
  if (!(key instanceof Uint8Array) || key.length !== ENCRYPTION_CONFIG.symmetricKeySize) {
    throw new TypeError(`[ENCRYPTION] Key must be a ${ENCRYPTION_CONFIG.symmetricKeySize}-byte Uint8Array.`);
  }

  if (!encrypted || typeof encrypted !== 'object') {
    throw new TypeError('[ENCRYPTION] Encrypted data must be an object.');
  }

  if (!encrypted.ciphertext || !encrypted.nonce) {
    throw new Error('[ENCRYPTION] Encrypted data must have ciphertext and nonce.');
  }

  try {
    const ciphertext = decodeBase64(encrypted.ciphertext);
    const nonce = decodeBase64(encrypted.nonce);
    
    const plaintext = nacl.secretbox.open(ciphertext, nonce, key);
    
    if (!plaintext) {
      throw new Error('[ENCRYPTION] Decryption failed: authentication tag mismatch.');
    }
    
    return plaintext;
  } catch (error) {
    throw new Error(`[ENCRYPTION] Decryption failed: ${error.message}`);
  }
}

/**
 * Encrypt a string using symmetric encryption.
 *
 * @param {string} data - String to encrypt
 * @param {Uint8Array} key - Symmetric key
 * @returns {Object} Encrypted data
 */
function encryptStringSymmetric(data, key) {
  const encrypted = encryptSymmetric(new TextEncoder().encode(data), key);
  return encrypted;
}

/**
 * Decrypt to a string using symmetric encryption.
 *
 * @param {Object} encrypted - Encrypted data
 * @param {Uint8Array} key - Symmetric key
 * @returns {string} Decrypted string
 */
function decryptStringSymmetric(encrypted, key) {
  const decrypted = decryptSymmetric(encrypted, key);
  return new TextDecoder().decode(decrypted);
}

// ============================================================================
// HYBRID ENCRYPTION (Public Key + Symmetric)
// ============================================================================

/**
 * Encrypt a symmetric key with a recipient's public key.
 * Uses X25519 key exchange to derive a shared secret, then encrypts the symmetric key.
 *
 * @param {Uint8Array} symmetricKey - Symmetric key to encrypt
 * @param {Uint8Array} recipientPublicKey - Recipient's 32-byte public key
 * @param {Uint8Array} senderSecretKey - Sender's 32-byte secret key
 * @returns {Object} Encrypted symmetric key
 */
function encryptSymmetricKey(symmetricKey, recipientPublicKey, senderSecretKey) {
  if (!(symmetricKey instanceof Uint8Array) || symmetricKey.length !== ENCRYPTION_CONFIG.symmetricKeySize) {
    throw new TypeError(`[ENCRYPTION] Symmetric key must be a ${ENCRYPTION_CONFIG.symmetricKeySize}-byte Uint8Array.`);
  }

  if (!(recipientPublicKey instanceof Uint8Array) || recipientPublicKey.length !== ENCRYPTION_CONFIG.publicKeySize) {
    throw new TypeError(`[ENCRYPTION] Recipient public key must be a ${ENCRYPTION_CONFIG.publicKeySize}-byte Uint8Array.`);
  }

  if (!(senderSecretKey instanceof Uint8Array) || senderSecretKey.length !== ENCRYPTION_CONFIG.secretKeySize) {
    throw new TypeError(`[ENCRYPTION] Sender secret key must be a ${ENCRYPTION_CONFIG.secretKeySize}-byte Uint8Array.`);
  }

  // Generate a nonce for the box
  const nonce = nacl.randomBytes(ENCRYPTION_CONFIG.nonceSize);
  
  // Encrypt the symmetric key using nacl.box
  const encryptedKey = nacl.box(symmetricKey, nonce, recipientPublicKey, senderSecretKey);
  
  // Clear sensitive data
  symmetricKey.fill(0);
  
  return {
    encryptedKey: encodeBase64(encryptedKey),
    nonce: encodeBase64(nonce),
    algorithm: ENCRYPTION_CONFIG.keyExchangeAlgorithm,
    schemaVersion: ENCRYPTION_CONFIG.schemaVersion,
  };
}

/**
 * Decrypt a symmetric key that was encrypted with a recipient's public key.
 *
 * @param {Object} encryptedKey - Encrypted symmetric key
 * @param {Uint8Array} recipientSecretKey - Recipient's 32-byte secret key
 * @param {Uint8Array} senderPublicKey - Sender's 32-byte public key
 * @returns {Uint8Array} Decrypted symmetric key
 */
function decryptSymmetricKey(encryptedKey, recipientSecretKey, senderPublicKey) {
  if (!encryptedKey || typeof encryptedKey !== 'object') {
    throw new TypeError('[ENCRYPTION] Encrypted key must be an object.');
  }

  if (!encryptedKey.encryptedKey || !encryptedKey.nonce) {
    throw new Error('[ENCRYPTION] Encrypted key must have encryptedKey and nonce.');
  }

  if (!(recipientSecretKey instanceof Uint8Array) || recipientSecretKey.length !== ENCRYPTION_CONFIG.secretKeySize) {
    throw new TypeError(`[ENCRYPTION] Recipient secret key must be a ${ENCRYPTION_CONFIG.secretKeySize}-byte Uint8Array.`);
  }

  if (!(senderPublicKey instanceof Uint8Array) || senderPublicKey.length !== ENCRYPTION_CONFIG.publicKeySize) {
    throw new TypeError(`[ENCRYPTION] Sender public key must be a ${ENCRYPTION_CONFIG.publicKeySize}-byte Uint8Array.`);
  }

  try {
    const encryptedKeyBytes = decodeBase64(encryptedKey.encryptedKey);
    const nonce = decodeBase64(encryptedKey.nonce);
    
    const symmetricKey = nacl.box.open(encryptedKeyBytes, nonce, senderPublicKey, recipientSecretKey);
    
    if (!symmetricKey) {
      throw new Error('[ENCRYPTION] Failed to decrypt symmetric key: authentication tag mismatch.');
    }
    
    return symmetricKey;
  } catch (error) {
    throw new Error(`[ENCRYPTION] Failed to decrypt symmetric key: ${error.message}`);
  }
}

// ============================================================================
// HYBRID ENCRYPTION FOR MULTIPLE RECIPIENTS
// ============================================================================

/**
 * Encrypt data for multiple recipients using hybrid encryption.
 * Each recipient gets their own encrypted copy of the symmetric key.
 *
 * @param {Uint8Array|string} data - Data to encrypt
 * @param {Object} recipients - Map of recipient ID to their public key
 * @param {Uint8Array} senderSecretKey - Sender's secret key
 * @returns {Object} Encrypted package
 */
function encryptForMultipleRecipients(data, recipients, senderSecretKey) {
  if (!recipients || typeof recipients !== 'object') {
    throw new TypeError('[ENCRYPTION] Recipients must be an object.');
  }

  if (!(senderSecretKey instanceof Uint8Array) || senderSecretKey.length !== ENCRYPTION_CONFIG.secretKeySize) {
    throw new TypeError(`[ENCRYPTION] Sender secret key must be a ${ENCRYPTION_CONFIG.secretKeySize}-byte Uint8Array.`);
  }

  // Generate a symmetric key for the data
  const symmetricKey = generateSymmetricKey();
  
  // Encrypt the data with the symmetric key
  const encryptedData = encryptSymmetric(data, symmetricKey);
  
  // Encrypt the symmetric key for each recipient
  const encryptedKeys = {};
  for (const [recipientId, publicKey] of Object.entries(recipients)) {
    encryptedKeys[recipientId] = encryptSymmetricKey(
      symmetricKey, 
      publicKey, 
      senderSecretKey
    );
  }
  
  // Clear the symmetric key from memory (we've encrypted it for all recipients)
  symmetricKey.fill(0);
  
  return {
    encryptedData,
    encryptedKeys,
    senderPublicKey: encodeBase64(nacl.box.keyPair.fromSecretKey(senderSecretKey).publicKey),
    algorithm: 'hybrid',
    schemaVersion: ENCRYPTION_CONFIG.schemaVersion,
  };
}

/**
 * Decrypt data that was encrypted for multiple recipients.
 *
 * @param {Object} encryptedPackage - Encrypted package from encryptForMultipleRecipients
 * @param {string} recipientId - ID of the recipient
 * @param {Uint8Array} recipientSecretKey - Recipient's secret key
 * @returns {Uint8Array} Decrypted data
 */
function decryptFromMultipleRecipients(encryptedPackage, recipientId, recipientSecretKey) {
  if (!encryptedPackage || typeof encryptedPackage !== 'object') {
    throw new TypeError('[ENCRYPTION] Encrypted package must be an object.');
  }

  if (!encryptedPackage.encryptedData || !encryptedPackage.encryptedKeys) {
    throw new Error('[ENCRYPTION] Encrypted package must have encryptedData and encryptedKeys.');
  }

  if (!encryptedPackage.encryptedKeys[recipientId]) {
    throw new Error(`[ENCRYPTION] No encrypted key found for recipient ${recipientId}.`);
  }

  if (!(recipientSecretKey instanceof Uint8Array) || recipientSecretKey.length !== ENCRYPTION_CONFIG.secretKeySize) {
    throw new TypeError(`[ENCRYPTION] Recipient secret key must be a ${ENCRYPTION_CONFIG.secretKeySize}-byte Uint8Array.`);
  }

  // Get the sender's public key
  const senderPublicKey = decodeBase64(encryptedPackage.senderPublicKey);
  
  // Decrypt the symmetric key
  const symmetricKey = decryptSymmetricKey(
    encryptedPackage.encryptedKeys[recipientId],
    recipientSecretKey,
    senderPublicKey
  );
  
  try {
    // Decrypt the data
    const decrypted = decryptSymmetric(encryptedPackage.encryptedData, symmetricKey);
    
    // Clear the symmetric key from memory
    symmetricKey.fill(0);
    
    return decrypted;
  } finally {
    // Always clear the symmetric key
    if (symmetricKey) symmetricKey.fill(0);
  }
}

// ============================================================================
// ENCRYPTION PACKAGE FOR NGO COLLABORATION
// ============================================================================

/**
 * Create an encrypted package for NGO collaboration.
 * This encrypts the data and prepares it for storage on IPFS + Arweave.
 *
 * @param {Object} data - Data to encrypt (will be JSON-stringified)
 * @param {Object} options - Encryption options
 * @param {Object} options.userKeyPair - User's key pair (publicKey, secretKey)
 * @param {Object} options.ngoPublicKeys - Map of NGO ID to their public key
 * @param {string[]} options.tags - Tags for categorization
 * @param {number} [options.expiry] - Optional expiry timestamp
 * @returns {Object} Encrypted package ready for IPFS + Arweave
 */
function createNGOEncryptionPackage(data, options = {}) {
  const {
    userKeyPair = null,
    ngoPublicKeys = {},
    tags = [],
    expiry = null,
  } = options;

  if (!userKeyPair || !userKeyPair.publicKey || !userKeyPair.secretKey) {
    throw new TypeError('[ENCRYPTION] userKeyPair must have publicKey and secretKey.');
  }

  if (!ngoPublicKeys || Object.keys(ngoPublicKeys).length === 0) {
    throw new TypeError('[ENCRYPTION] ngoPublicKeys must be a non-empty object.');
  }

  // Serialize data to JSON
  const dataString = JSON.stringify(data);
  
  // Create recipient map (user + NGOs)
  const recipients = {
    user: userKeyPair.publicKey,
    ...ngoPublicKeys,
  };
  
  // Encrypt for all recipients
  const encryptedPackage = encryptForMultipleRecipients(
    encodeUTF8(dataString),
    recipients,
    userKeyPair.secretKey
  );
  
  // Create metadata for Arweave
  const metadata = {
    schemaVersion: '1.0.0',
    transactionType: 'NGO_COLLABORATION',
    timestamp: Date.now(),
    dataType: 'encrypted_chat',
    tags: ['ngo-collaboration', ...tags],
    expiry,
    accessControl: {
      allowedRecipients: Object.keys(ngoPublicKeys),
      userId: 'user:' + encodeBase64(crypto.createHash('sha256')
        .update(userKeyPair.publicKey)
        .digest()
        .slice(0, 16)),
    },
  };
  
  // Compute content hash
  const contentHash = crypto.createHash('sha256')
    .update(dataString, 'utf8')
    .digest('hex');
  
  return {
    encryptedPackage,
    metadata,
    contentHash: `sha256:${contentHash}`,
    userPublicKey: encodeBase64(userKeyPair.publicKey),
  };
}

/**
 * Decrypt an NGO collaboration package.
 *
 * @param {Object} encryptedPackage - Package from createNGOEncryptionPackage
 * @param {string} recipientId - 'user' or NGO ID
 * @param {Uint8Array} recipientSecretKey - Recipient's secret key
 * @returns {Object} Decrypted data
 */
function decryptNGOEncryptionPackage(encryptedPackage, recipientId, recipientSecretKey) {
  if (!encryptedPackage || typeof encryptedPackage !== 'object') {
    throw new TypeError('[ENCRYPTION] Encrypted package must be an object.');
  }

  if (!encryptedPackage.encryptedPackage) {
    throw new Error('[ENCRYPTION] Encrypted package must have encryptedPackage property.');
  }

  const decryptedBytes = decryptFromMultipleRecipients(
    encryptedPackage.encryptedPackage,
    recipientId,
    recipientSecretKey
  );
  
  const decryptedString = new TextDecoder().decode(decryptedBytes);
  
  try {
    return JSON.parse(decryptedString);
  } catch (error) {
    throw new Error(`[ENCRYPTION] Failed to parse decrypted data as JSON: ${error.message}`);
  }
}

// ============================================================================
// KEY MANAGEMENT UTILITIES
// ============================================================================

/**
 * Generate a key pair and return as exportable object.
 *
 * @returns {Object} Key pair with Base64-encoded keys
 */
function generateExportableKeyPair() {
  const keyPair = generateKeyPair();
  return {
    publicKey: encodeBase64(keyPair.publicKey),
    secretKey: encodeBase64(keyPair.secretKey),
    schemaVersion: ENCRYPTION_CONFIG.schemaVersion,
    algorithm: ENCRYPTION_CONFIG.keyExchangeAlgorithm,
  };
}

/**
 * Import a key pair from Base64-encoded strings.
 *
 * @param {Object} keyPair - Key pair with Base64-encoded keys
 * @returns {Object} Key pair with Uint8Array keys
 */
function importKeyPair(keyPair) {
  if (!keyPair || typeof keyPair !== 'object') {
    throw new TypeError('[ENCRYPTION] Key pair must be an object.');
  }

  if (!keyPair.publicKey || !keyPair.secretKey) {
    throw new Error('[ENCRYPTION] Key pair must have publicKey and secretKey.');
  }

  return {
    publicKey: decodeBase64(keyPair.publicKey),
    secretKey: decodeBase64(keyPair.secretKey),
  };
}

/**
 * Generate a symmetric key and return as exportable object.
 *
 * @returns {Object} Symmetric key with Base64 encoding
 */
function generateExportableSymmetricKey() {
  const key = generateSymmetricKey();
  return {
    key: encodeBase64(key),
    schemaVersion: ENCRYPTION_CONFIG.schemaVersion,
    algorithm: ENCRYPTION_CONFIG.symmetricAlgorithm,
  };
}

/**
 * Import a symmetric key from Base64 string.
 *
 * @param {string} key - Base64-encoded symmetric key
 * @returns {Uint8Array} Symmetric key
 */
function importSymmetricKey(key) {
  if (!key || typeof key !== 'string') {
    throw new TypeError('[ENCRYPTION] Key must be a non-empty string.');
  }

  return decodeBase64(key);
}

// ============================================================================
// SECURE MEMORY CLEARING
// ============================================================================

/**
 * Securely clear a Uint8Array from memory.
 *
 * @param {Uint8Array} array - Array to clear
 */
function secureClear(array) {
  if (array instanceof Uint8Array) {
    array.fill(0);
  }
}

/**
 * Create a secure string that can be cleared from memory.
 * Note: JavaScript strings are immutable, so this is a best-effort approach.
 *
 * @param {string} value - String value
 * @returns {Object} Secure string with clear method
 */
function createSecureString(value) {
  // In Node.js, we can use Buffer which can be cleared
  const buffer = Buffer.from(value, 'utf8');
  
  return {
    get value() {
      return buffer.toString('utf8');
    },
    get bytes() {
      return new Uint8Array(buffer);
    },
    clear() {
      buffer.fill(0);
    },
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  // Configuration
  ENCRYPTION_CONFIG,
  
  // Key management
  generateSymmetricKey,
  generateKeyPair,
  generateKeyPairFromSeed,
  deriveKeyFromPassword,
  generateSalt,
  generateExportableKeyPair,
  importKeyPair,
  generateExportableSymmetricKey,
  importSymmetricKey,
  
  // Symmetric encryption
  encryptSymmetric,
  decryptSymmetric,
  encryptStringSymmetric,
  decryptStringSymmetric,
  
  // Hybrid encryption
  encryptSymmetricKey,
  decryptSymmetricKey,
  encryptForMultipleRecipients,
  decryptFromMultipleRecipients,
  
  // NGO-specific encryption
  createNGOEncryptionPackage,
  decryptNGOEncryptionPackage,
  
  // Secure memory
  secureClear,
  createSecureString,
  
  // Re-exports for convenience
  encodeBase64,
  decodeBase64,
  encodeUTF8,
  decodeUTF8,
};
