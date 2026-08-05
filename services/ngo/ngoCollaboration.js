/**
 * SXWer AI ChatBot - NGO Collaboration Service
 *
 * HUMAN RIGHTS DESIGN:
 * - All NGO collaboration is OPTIONAL and requires EXPLICIT user consent
 * - Users control which NGOs can access their data
 * - Users can revoke consent at any time
 * - All data is encrypted before storage
 * - Only hashes and metadata are stored on-chain (Arweave)
 * - Full data is stored encrypted on IPFS
 * - Graceful degradation if blockchain services are unavailable
 *
 * WHAT THIS DOES:
 * - Manages the full lifecycle of NGO data sharing
 * - Handles user consent for NGO collaboration
 * - Encrypts and stores data on IPFS + Arweave
 * - Manages access control for NGOs
 * - Provides querying capabilities for authorized NGOs
 *
 * DEPENDENCIES:
 * - ./arweaveService.js: Arweave transaction handling
 * - ./ipfsService.js: IPFS upload/download
 * - ./dataEncryption.js: Encryption utilities
 * - ../blockchain/consentLedger.js: Existing consent ledger
 */

import {
  createNGOTransaction,
  createNGOTransactionBatch,
  getTransactionData,
  queryTransactionsByNGO,
  queryTransactionsByTags,
  queryTransactionsByDateRange,
  verifyTransactionIntegrity,
  generateContentHash,
  isArweaveAvailable,
} from '../blockchain/arweaveService.js';

import {
  uploadToIPFS,
  uploadJSONToIPFS,
  downloadFromIPFS,
  downloadJSONFromIPFS,
  verifyCID,
  cidExists,
  isIPFSAvailable,
} from '../blockchain/ipfsService.js';

import {
  createNGOEncryptionPackage,
  decryptNGOEncryptionPackage,
  generateKeyPair,
  generateSymmetricKey,
  encryptSymmetric,
  decryptSymmetric,
  encryptSymmetricKey,
  decryptSymmetricKey,
  generateExportableKeyPair,
  importKeyPair,
  ENCRYPTION_CONFIG,
} from '../blockchain/dataEncryption.js';

import {
  recordConsent,
  revokeConsent,
  recordPolicyAcceptance,
  getConsentHistory,
  hasActiveConsent,
  CONSENT_EVENT_TYPES,
} from '../blockchain/consentLedger.js';

import crypto from 'crypto';

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * NGO Collaboration Configuration
 */
const NGO_CONFIG = Object.freeze({
  // Default NGOs
  defaultNGOs: Object.freeze({
    aair: {
      id: 'aair',
      name: 'AAIR (Arizona Advocacy & Resource)',
      description: 'Sex worker advocacy and resource organization',
      publicKey: null, // Set via environment or configuration
    },
    swop: {
      id: 'swop',
      name: 'SWOP (Sex Workers Outreach Project)',
      description: 'National sex worker advocacy organization',
      publicKey: null,
    },
  }),
  
  // Data types that can be shared
  dataTypes: Object.freeze([
    'chat_transcripts',
    'feedback',
    'safety_plans',
    'resource_usage',
    'model_outputs',
  ]),
  
  // Purposes for data sharing
  purposes: Object.freeze([
    'improve_ai_responses',
    'audit_advice_quality',
    'identify_resource_gaps',
    'train_models',
    'legal_compliance',
    'research',
  ]),
  
  // Default expiry options (in days)
  expiryOptions: Object.freeze([
    { value: 30, label: '1 month' },
    { value: 90, label: '3 months' },
    { value: 180, label: '6 months' },
    { value: 365, label: '1 year' },
    { value: null, label: 'Indefinitely (until I revoke)' },
  ]),
  
  // Schema version
  schemaVersion: '1.0.0',
});

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

/**
 * In-memory store for NGO public keys.
 * In production, these would be fetched from a secure source or smart contract.
 *
 * @type {Map<string, Uint8Array>}
 */
const _ngoPublicKeys = new Map();

/**
 * In-memory store for user-NGO consent mappings.
 * Maps userId to set of NGO IDs they've consented to share with.
 *
 * @type {Map<string, Set<string>>}
 */
const _userNGOConsent = new Map();

/**
 * In-memory store for NGO data access logs.
 * Maps transaction ID to access records.
 *
 * @type {Map<string, Object[]>}
 */
const _accessLogs = new Map();

// ============================================================================
// NGO REGISTRATION
// ============================================================================

/**
 * Register an NGO with its public key.
 *
 * @param {string} ngoId - NGO identifier
 * @param {string|Uint8Array} publicKey - NGO's public key (Base64 or Uint8Array)
 * @param {Object} [metadata={}] - Additional NGO metadata
 * @returns {Object} Registration result
 */
function registerNGO(ngoId, publicKey, metadata = {}) {
  if (!ngoId || typeof ngoId !== 'string') {
    throw new TypeError('[NGO] ngoId must be a non-empty string.');
  }

  if (!publicKey) {
    throw new TypeError('[NGO] publicKey must be provided.');
  }

  // Convert publicKey to Uint8Array if it's a Base64 string
  const publicKeyBytes = typeof publicKey === 'string' 
    ? Uint8Array.from(Buffer.from(publicKey, 'base64')) 
    : publicKey;

  if (!(publicKeyBytes instanceof Uint8Array) || publicKeyBytes.length !== 32) {
    throw new TypeError('[NGO] publicKey must be a 32-byte Uint8Array or Base64 string.');
  }

  // Store the public key
  _ngoPublicKeys.set(ngoId, publicKeyBytes);

  // Merge with default metadata
  const ngoMetadata = {
    id: ngoId,
    registeredAt: Date.now(),
    ...NGO_CONFIG.defaultNGOs[ngoId],
    ...metadata,
    publicKey: publicKeyBytes,
  };

  console.log(`[NGO] Registered NGO: ${ngoId}`);

  return Object.freeze({
    success: true,
    ngo: ngoMetadata,
  });
}

/**
 * Get an NGO's public key.
 *
 * @param {string} ngoId - NGO identifier
 * @returns {Uint8Array|null} Public key or null if not found
 */
function getNGOPublicKey(ngoId) {
  return _ngoPublicKeys.get(ngoId) || null;
}

/**
 * Get all registered NGOs.
 *
 * @returns {Object[]} Array of registered NGOs
 */
function getRegisteredNGOs() {
  return Array.from(_ngoPublicKeys.entries()).map(([ngoId, publicKey]) => ({
    id: ngoId,
    publicKey: publicKey,
    ...NGO_CONFIG.defaultNGOs[ngoId],
  }));
}

/**
 * Remove an NGO from the registry.
 *
 * @param {string} ngoId - NGO identifier
 * @returns {boolean} True if NGO was removed
 */
function removeNGO(ngoId) {
  if (_ngoPublicKeys.has(ngoId)) {
    _ngoPublicKeys.delete(ngoId);
    console.log(`[NGO] Removed NGO: ${ngoId}`);
    return true;
  }
  return false;
}

// ============================================================================
// USER CONSENT MANAGEMENT
// ============================================================================

/**
 * Request user consent for NGO data sharing.
 *
 * @param {string} userId - User identifier
 * @param {string[]} ngoIds - Array of NGO IDs to share with
 * @param {string[]} dataTypes - Array of data types to share
 * @param {string[]} purposes - Array of purposes for sharing
 * @param {number|null} expiry - Expiry timestamp or null for no expiry
 * @returns {Promise<Object>} Consent result
 */
async function requestUserConsent(userId, ngoIds, dataTypes, purposes, expiry = null) {
  if (!userId || typeof userId !== 'string') {
    throw new TypeError('[NGO] userId must be a non-empty string.');
  }

  if (!Array.isArray(ngoIds) || ngoIds.length === 0) {
    throw new TypeError('[NGO] ngoIds must be a non-empty array.');
  }

  if (!Array.isArray(dataTypes) || dataTypes.length === 0) {
    throw new TypeError('[NGO] dataTypes must be a non-empty array.');
  }

  if (!Array.isArray(purposes) || purposes.length === 0) {
    throw new TypeError('[NGO] purposes must be a non-empty array.');
  }

  // Validate NGOs are registered
  for (const ngoId of ngoIds) {
    if (!getNGOPublicKey(ngoId)) {
      throw new Error(`[NGO] NGO ${ngoId} is not registered.`);
    }
  }

  // Validate data types
  for (const dataType of dataTypes) {
    if (!NGO_CONFIG.dataTypes.includes(dataType)) {
      throw new Error(`[NGO] Invalid data type: ${dataType}`);
    }
  }

  // Validate purposes
  for (const purpose of purposes) {
    if (!NGO_CONFIG.purposes.includes(purpose)) {
      throw new Error(`[NGO] Invalid purpose: ${purpose}`);
    }
  }

  // Create consent document
  const consentDocument = {
    userId,
    ngoIds,
    dataTypes,
    purposes,
    expiry,
    timestamp: Date.now(),
    schemaVersion: NGO_CONFIG.schemaVersion,
  };

  // Record consent on the existing ledger
  const consentReceipt = await recordConsent({
    policyVersion: '2.0.0', // NGO collaboration policy
    consentText: JSON.stringify(consentDocument),
  });

  // Store consent mapping
  if (!_userNGOConsent.has(userId)) {
    _userNGOConsent.set(userId, new Set());
  }
  const userConsent = _userNGOConsent.get(userId);
  for (const ngoId of ngoIds) {
    userConsent.add(ngoId);
  }

  console.log(`[NGO] User ${userId} consented to share with NGOs: ${ngoIds.join(', ')}`);

  return Object.freeze({
    success: true,
    consentReceipt,
    consentDocument,
    userId,
    ngoIds,
    dataTypes,
    purposes,
    expiry,
  });
}

/**
 * Revoke user consent for NGO data sharing.
 *
 * @param {string} userId - User identifier
 * @param {string[]} [ngoIds] - Optional: specific NGOs to revoke (revokes all if not provided)
 * @returns {Promise<Object>} Revocation result
 */
async function revokeUserConsent(userId, ngoIds = null) {
  if (!userId || typeof userId !== 'string') {
    throw new TypeError('[NGO] userId must be a non-empty string.');
  }

  // If no specific NGOs, revoke all
  if (!ngoIds) {
    ngoIds = Array.from(_userNGOConsent.get(userId) || []);
  }

  // Record revocation on the existing ledger
  const revocationReceipt = await revokeConsent({
    reason: `User ${userId} revoked consent for NGOs: ${ngoIds.join(', ')}`,
  });

  // Remove from consent mapping
  if (_userNGOConsent.has(userId)) {
    const userConsent = _userNGOConsent.get(userId);
    for (const ngoId of ngoIds) {
      userConsent.delete(ngoId);
    }
    console.log(`[NGO] User ${userId} revoked consent for NGOs: ${ngoIds.join(', ')}`);
  }

  return Object.freeze({
    success: true,
    revocationReceipt,
    userId,
    ngoIds,
  });
}

/**
 * Check if a user has consented to share with specific NGOs.
 *
 * @param {string} userId - User identifier
 * @param {string[]} ngoIds - Array of NGO IDs to check
 * @returns {Object} Consent status for each NGO
 */
function checkUserConsent(userId, ngoIds) {
  if (!userId || typeof userId !== 'string') {
    throw new TypeError('[NGO] userId must be a non-empty string.');
  }

  if (!Array.isArray(ngoIds) || ngoIds.length === 0) {
    throw new TypeError('[NGO] ngoIds must be a non-empty array.');
  }

  const userConsent = _userNGOConsent.get(userId) || new Set();
  const result = {};

  for (const ngoId of ngoIds) {
    result[ngoId] = userConsent.has(ngoId);
  }

  return Object.freeze(result);
}

/**
 * Get all NGOs a user has consented to share with.
 *
 * @param {string} userId - User identifier
 * @returns {string[]} Array of NGO IDs
 */
function getUserConsentedNGOs(userId) {
  if (!userId || typeof userId !== 'string') {
    throw new TypeError('[NGO] userId must be a non-empty string.');
  }

  return Array.from(_userNGOConsent.get(userId) || []);
}

// ============================================================================
// DATA STORAGE
// ============================================================================

/**
 * Store AI interaction data for NGO collaboration.
 *
 * @param {Object} interactionData - Interaction data to store
 * @param {Object} options - Storage options
 * @param {string} options.userId - User identifier
 * @param {string[]} options.ngoIds - NGOs to share with
 * @param {string[]} options.tags - Tags for categorization
 * @param {number} [options.expiry] - Optional expiry timestamp
 * @param {Uint8Array} [options.userSecretKey] - User's secret key for encryption
 * @returns {Promise<Object>} Storage result
 */
async function storeInteractionForNGO(interactionData, options = {}) {
  const {
    userId,
    ngoIds = [],
    tags = [],
    expiry = null,
    userSecretKey = null,
  } = options;

  if (!userId || typeof userId !== 'string') {
    throw new TypeError('[NGO] userId must be a non-empty string.');
  }

  if (!interactionData || typeof interactionData !== 'object') {
    throw new TypeError('[NGO] interactionData must be a non-null object.');
  }

  // Check if user has consented to share with these NGOs
  const consentStatus = checkUserConsent(userId, ngoIds);
  const authorizedNGOs = ngoIds.filter(ngoId => consentStatus[ngoId]);

  if (authorizedNGOs.length === 0) {
    throw new Error('[NGO] User has not consented to share with any of the specified NGOs.');
  }

  // Generate or use provided user key pair
  let userKeyPair;
  if (userSecretKey) {
    // If secret key provided, derive the key pair
    userKeyPair = {
      publicKey: null, // Will be derived
      secretKey: userSecretKey,
    };
    // In a real implementation, we'd derive the public key from the secret key
    // For now, we'll generate a new key pair
    const tempKeyPair = importKeyPair({
      publicKey: '',
      secretKey: encodeBase64(userSecretKey),
    });
    userKeyPair = tempKeyPair;
  } else {
    // Generate a new key pair for this session
    userKeyPair = generateKeyPair();
  }

  // Get NGO public keys
  const ngoPublicKeys = {};
  for (const ngoId of authorizedNGOs) {
    const publicKey = getNGOPublicKey(ngoId);
    if (publicKey) {
      ngoPublicKeys[ngoId] = publicKey;
    }
  }

  if (Object.keys(ngoPublicKeys).length === 0) {
    throw new Error('[NGO] No valid public keys for authorized NGOs.');
  }

  // Create encryption package
  const encryptionPackage = createNGOEncryptionPackage(interactionData, {
    userKeyPair,
    ngoPublicKeys,
    tags,
    expiry,
  });

  // Upload encrypted data to IPFS
  const ipfsResult = await uploadJSONToIPFS(
    encryptionPackage.encryptedPackage,
    null, // No additional encryption (already encrypted)
    { retries: 3 }
  );

  // Create metadata for Arweave
  const metadata = {
    schemaVersion: NGO_CONFIG.schemaVersion,
    transactionType: 'NGO_COLLABORATION',
    userId: userId,
    ngoIds: authorizedNGOs,
    tags: ['ngo-collaboration', ...tags],
    dataType: 'ai_interaction',
    ipfsCid: ipfsResult.cid,
    contentHash: encryptionPackage.contentHash,
    accessControl: {
      allowedNGOs: authorizedNGOs,
      requiredTags: tags,
      expiry,
      encryptionScheme: ENCRYPTION_CONFIG.symmetricAlgorithm,
    },
    consent: {
      userConsentGiven: true,
      userConsentTimestamp: Date.now(),
      consentVersion: '2.0.0',
    },
    timestamp: Date.now(),
  };

  // Store metadata on Arweave
  const arweaveResult = await createNGOTransaction(metadata);

  // Log the access (user shared data with NGOs)
  const accessLogEntry = {
    userId,
    ngoIds: authorizedNGOs,
    txId: arweaveResult.txId,
    ipfsCid: ipfsResult.cid,
    timestamp: Date.now(),
    action: 'data_shared',
  };
  _accessLogs.set(arweaveResult.txId, [accessLogEntry]);

  console.log(`[NGO] Stored interaction for user ${userId} with NGOs: ${authorizedNGOs.join(', ')}`);
  console.log(`[NGO] Arweave TX: ${arweaveResult.txId}, IPFS CID: ${ipfsResult.cid}`);

  return Object.freeze({
    success: true,
    txId: arweaveResult.txId,
    ipfsCid: ipfsResult.cid,
    contentHash: encryptionPackage.contentHash,
    userId,
    ngoIds: authorizedNGOs,
    tags,
    expiry,
    userPublicKey: encryptionPackage.userPublicKey,
    metadata,
  });
}

/**
 * Store a batch of interactions for NGO collaboration.
 *
 * @param {Object[]} interactions - Array of interaction data
 * @param {Object} options - Storage options (same as storeInteractionForNGO)
 * @returns {Promise<Object>} Batch storage result
 */
async function storeInteractionBatchForNGO(interactions, options = {}) {
  if (!Array.isArray(interactions) || interactions.length === 0) {
    throw new TypeError('[NGO] interactions must be a non-empty array.');
  }

  const results = [];
  for (const interaction of interactions) {
    try {
      const result = await storeInteractionForNGO(interaction, options);
      results.push(result);
    } catch (error) {
      console.error(`[NGO] Failed to store interaction: ${error.message}`);
      // Continue with other interactions
    }
  }

  return Object.freeze({
    success: results.length > 0,
    total: interactions.length,
    successful: results.length,
    failed: interactions.length - results.length,
    results,
  });
}

// ============================================================================
// DATA QUERYING
// ============================================================================

/**
 * Query NGO collaboration data.
 *
 * @param {Object} query - Query parameters
 * @param {string} query.ngoId - NGO identifier (required)
 * @param {string[]} [query.tags] - Tags to filter by
 * @param {Object} [query.dateRange] - Date range filter
 * @param {number} [query.limit] - Maximum number of results
 * @param {string} [query.cursor] - Pagination cursor
 * @returns {Promise<Object>} Query results
 */
async function queryNGOData(query) {
  const { ngoId, tags = [], dateRange, limit = 100, cursor } = query;

  if (!ngoId || typeof ngoId !== 'string') {
    throw new TypeError('[NGO] ngoId must be a non-empty string.');
  }

  // Verify NGO is registered
  const publicKey = getNGOPublicKey(ngoId);
  if (!publicKey) {
    throw new Error(`[NGO] NGO ${ngoId} is not registered.`);
  }

  // Query Arweave for transactions matching the criteria
  const arweaveQuery = {
    tags: ['ngo-collaboration', `ngo:${ngoId}`, ...tags],
    limit,
    cursor,
  };

  const arweaveResults = await queryTransactionsByTags(arweaveQuery);

  // Filter by date range if provided
  let filteredResults = arweaveResults.transactions;
  if (dateRange) {
    const start = typeof dateRange.start === 'number' 
      ? dateRange.start 
      : dateRange.start.getTime();
    const end = typeof dateRange.end === 'number' 
      ? dateRange.end 
      : dateRange.end.getTime();

    filteredResults = filteredResults.filter(tx => {
      const txData = tx.get('data', { decode: true, string: true });
      try {
        const parsed = JSON.parse(txData);
        return parsed.timestamp >= start && parsed.timestamp <= end;
      } catch {
        return false;
      }
    });
  }

  // Get full transaction data for each result
  const results = [];
  for (const tx of filteredResults.slice(0, limit)) {
    try {
      const txData = await getTransactionData(tx.id);
      if (txData) {
        results.push({
          txId: tx.id,
          data: txData.data,
          timestamp: txData.timestamp,
        });
      }
    } catch (error) {
      console.error(`[NGO] Failed to get transaction data for ${tx.id}: ${error.message}`);
    }
  }

  return Object.freeze({
    success: true,
    ngoId,
    results,
    total: results.length,
    hasMore: filteredResults.length > limit,
    cursor: results.length < filteredResults.length ? cursor : null,
  });
}

/**
 * Get data for a specific transaction.
 *
 * @param {string} txId - Transaction ID
 * @param {string} ngoId - NGO identifier
 * @param {Uint8Array} ngoSecretKey - NGO's secret key for decryption
 * @returns {Promise<Object>} Transaction data with decrypted content
 */
async function getNGOTransactionData(txId, ngoId, ngoSecretKey) {
  if (!txId || typeof txId !== 'string') {
    throw new TypeError('[NGO] txId must be a non-empty string.');
  }

  if (!ngoId || typeof ngoId !== 'string') {
    throw new TypeError('[NGO] ngoId must be a non-empty string.');
  }

  if (!(ngoSecretKey instanceof Uint8Array) || ngoSecretKey.length !== 32) {
    throw new TypeError('[NGO] ngoSecretKey must be a 32-byte Uint8Array.');
  }

  // Get transaction data from Arweave
  const txData = await getTransactionData(txId);
  if (!txData) {
    throw new Error(`[NGO] Transaction ${txId} not found.`);
  }

  // Verify the NGO is authorized for this transaction
  if (!txData.data.accessControl.allowedNGOs.includes(ngoId)) {
    throw new Error(`[NGO] NGO ${ngoId} is not authorized for transaction ${txId}.`);
  }

  // Check if data has expired
  if (txData.data.accessControl.expiry && 
      txData.data.accessControl.expiry < Date.now()) {
    throw new Error('[NGO] Data access has expired.');
  }

  // Download encrypted data from IPFS
  const encryptedData = await downloadFromIPFS(txData.data.ipfsCid);

  // Get the user's public key from the transaction
  const userPublicKey = txData.data.userPublicKey;

  // Create the encryption package structure expected by decryptNGOEncryptionPackage
  const encryptionPackage = {
    encryptedPackage: JSON.parse(new TextDecoder().decode(encryptedData)),
    userPublicKey,
  };

  // Decrypt the data
  let decryptedData;
  try {
    decryptedData = decryptNGOEncryptionPackage(
      encryptionPackage,
      ngoId,
      ngoSecretKey
    );
  } catch (error) {
    console.error(`[NGO] Failed to decrypt data for transaction ${txId}: ${error.message}`);
    throw new Error(`[NGO] Decryption failed: ${error.message}`);
  }

  // Log the access
  const accessLogEntry = {
    ngoId,
    txId,
    timestamp: Date.now(),
    action: 'data_accessed',
  };
  
  if (_accessLogs.has(txId)) {
    _accessLogs.get(txId).push(accessLogEntry);
  } else {
    _accessLogs.set(txId, [accessLogEntry]);
  }

  return Object.freeze({
    success: true,
    txId,
    data: decryptedData,
    metadata: txData.data,
    timestamp: txData.timestamp,
  });
}

// ============================================================================
// ACCESS CONTROL
// ============================================================================

/**
 * Check if an NGO has access to a specific transaction.
 *
 * @param {string} txId - Transaction ID
 * @param {string} ngoId - NGO identifier
 * @returns {Promise<Object>} Access check result
 */
async function checkNGOAccess(txId, ngoId) {
  if (!txId || typeof txId !== 'string') {
    throw new TypeError('[NGO] txId must be a non-empty string.');
  }

  if (!ngoId || typeof ngoId !== 'string') {
    throw new TypeError('[NGO] ngoId must be a non-empty string.');
  }

  // Get transaction data
  const txData = await getTransactionData(txId);
  if (!txData) {
    return Object.freeze({
      allowed: false,
      reason: 'Transaction not found',
      txId,
      ngoId,
    });
  }

  // Check if NGO is in allowed list
  if (!txData.data.accessControl.allowedNGOs.includes(ngoId)) {
    return Object.freeze({
      allowed: false,
      reason: 'NGO not in allowed list',
      txId,
      ngoId,
    });
  }

  // Check if data has expired
  if (txData.data.accessControl.expiry && 
      txData.data.accessControl.expiry < Date.now()) {
    return Object.freeze({
      allowed: false,
      reason: 'Data access has expired',
      txId,
      ngoId,
    });
  }

  // Check if user has revoked consent
  const userId = txData.data.userId;
  const consentStatus = checkUserConsent(userId, [ngoId]);
  if (!consentStatus[ngoId]) {
    return Object.freeze({
      allowed: false,
      reason: 'User has revoked consent',
      txId,
      ngoId,
    });
  }

  return Object.freeze({
    allowed: true,
    reason: 'Access granted',
    txId,
    ngoId,
  });
}

/**
 * Get access logs for a user.
 *
 * @param {string} userId - User identifier
 * @returns {Object[]} Array of access log entries
 */
function getUserAccessLogs(userId) {
  if (!userId || typeof userId !== 'string') {
    throw new TypeError('[NGO] userId must be a non-empty string.');
  }

  const logs = [];
  for (const [txId, entries] of _accessLogs.entries()) {
    for (const entry of entries) {
      if (entry.userId === userId) {
        logs.push({ ...entry, txId });
      }
    }
  }

  return logs.sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * Get access logs for an NGO.
 *
 * @param {string} ngoId - NGO identifier
 * @returns {Object[]} Array of access log entries
 */
function getNGOAccessLogs(ngoId) {
  if (!ngoId || typeof ngoId !== 'string') {
    throw new TypeError('[NGO] ngoId must be a non-empty string.');
  }

  const logs = [];
  for (const [txId, entries] of _accessLogs.entries()) {
    for (const entry of entries) {
      if (entry.ngoId === ngoId) {
        logs.push({ ...entry, txId });
      }
    }
  }

  return logs.sort((a, b) => b.timestamp - a.timestamp);
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Generate a user ID from a public key.
 *
 * @param {Uint8Array|string} publicKey - Public key
 * @returns {string} User ID
 */
function generateUserId(publicKey) {
  const publicKeyBytes = typeof publicKey === 'string' 
    ? Uint8Array.from(Buffer.from(publicKey, 'base64')) 
    : publicKey;
  
  const hash = crypto.createHash('sha256')
    .update(publicKeyBytes)
    .digest('hex')
    .slice(0, 16);
  
  return `user_${hash}`;
}

/**
 * Check if NGO collaboration is available.
 *
 * @returns {boolean} True if NGO collaboration can be used
 */
function isNGOCollaborationAvailable() {
  return isArweaveAvailable() && isIPFSAvailable();
}

/**
 * Get NGO collaboration statistics.
 *
 * @returns {Object} Statistics
 */
function getNGOStats() {
  return Object.freeze({
    available: isNGOCollaborationAvailable(),
    registeredNGOs: _ngoPublicKeys.size,
    userConsentCount: _userNGOConsent.size,
    totalAccessLogs: Array.from(_accessLogs.values()).reduce(
      (sum, entries) => sum + entries.length, 0
    ),
  });
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  // Configuration
  NGO_CONFIG,
  
  // NGO registration
  registerNGO,
  getNGOPublicKey,
  getRegisteredNGOs,
  removeNGO,
  
  // User consent
  requestUserConsent,
  revokeUserConsent,
  checkUserConsent,
  getUserConsentedNGOs,
  
  // Data storage
  storeInteractionForNGO,
  storeInteractionBatchForNGO,
  
  // Data querying
  queryNGOData,
  getNGOTransactionData,
  
  // Access control
  checkNGOAccess,
  getUserAccessLogs,
  getNGOAccessLogs,
  
  // Utilities
  generateUserId,
  isNGOCollaborationAvailable,
  getNGOStats,
  
  // Re-exports for convenience
  createNGOEncryptionPackage,
  decryptNGOEncryptionPackage,
  generateKeyPair,
  generateExportableKeyPair,
};
