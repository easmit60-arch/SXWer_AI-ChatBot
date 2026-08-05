/**
 * SXWer AI ChatBot - Arweave Service
 *
 * HUMAN RIGHTS DESIGN:
 * - Arweave provides permanent, low-cost, decentralized storage
 * - Only hashes and metadata are stored on-chain (no PII)
 * - All operations are optional and require explicit user consent
 * - Graceful degradation if Arweave is unavailable
 *
 * WHAT THIS DOES:
 * - Submit transactions to Arweave
 * - Query Arweave for transaction data
 * - Verify transaction integrity
 * - Bundle multiple records for cost efficiency
 *
 * DEPENDENCIES:
 * - arweave: Arweave JavaScript SDK
 * - crypto: Node.js crypto module for hashing
 */

import Arweave from 'arweave';
import crypto from 'crypto';
import {
  ARWEAVE_ENABLED,
  ARWEAVE_CONFIG,
  BLOCKCHAIN_ENABLED,
} from './ledgerConfig.js';

// ============================================================================
// ARWEAVE CLIENT SETUP
// ============================================================================

/**
 * Arweave client instance.
 * Lazy-initialized to avoid loading the SDK unless needed.
 *
 * @type {Arweave|null}
 */
let _arweaveClient = null;

/**
 * Wallet instance for signing transactions.
 * Held in memory only during active operations.
 *
 * @type {Object|null}
 */
let _wallet = null;

/**
 * Initialize the Arweave client.
 *
 * @returns {Arweave} Arweave client instance
 */
function _getArweaveClient() {
  if (_arweaveClient) return _arweaveClient;
  
  if (!ARWEAVE_ENABLED || !BLOCKCHAIN_ENABLED) {
    throw new Error('[ARWEAVE] Arweave is not enabled. Check ARWEAVE_ENABLED and BLOCKCHAIN_ENABLED.');
  }
  
  _arweaveClient = Arweave.init(ARWEAVE_CONFIG);
  return _arweaveClient;
}

/**
 * Load wallet from configuration.
 * The wallet file should contain a JSON object with the wallet key.
 *
 * @param {string} [walletPath] - Optional path to wallet file
 * @returns {Promise<Object>} Wallet object
 */
async function _getWallet(walletPath = null) {
  if (_wallet) return _wallet;
  
  const path = walletPath || ARWEAVE_CONFIG.walletPath;
  
  if (!path) {
    throw new Error('[ARWEAVE] No wallet path configured. Set ARWEAVE_WALLET_PATH.');
  }
  
  try {
    // In Node.js, we need to use fs to read the wallet file
    // For browser environments, this would need to be adapted
    const fs = await import('fs');
    const walletData = JSON.parse(await fs.promises.readFile(path, 'utf8'));
    _wallet = walletData;
    return _wallet;
  } catch (error) {
    console.error(`[ARWEAVE] Failed to load wallet from ${path}: ${error.message}`);
    throw new Error(`[ARWEAVE] Wallet load failed: ${error.message}`);
  }
}

/**
 * Clear the wallet from memory.
 * Should be called after signing operations to minimize exposure.
 */
function _clearWallet() {
  if (_wallet) {
    // Overwrite wallet data before clearing reference
    if (_wallet.key) {
      // For string keys
      _wallet.key = '0'.repeat(_wallet.key.length);
    }
    if (_wallet.kty && _wallet.n) {
      // For JWK format
      _wallet.n = '0';
      _wallet.e = '0';
      _wallet.d = '0';
    }
    _wallet = null;
  }
}

// ============================================================================
// TRANSACTION HELPERS
// ============================================================================

/**
 * Create a transaction for storing NGO collaboration data.
 *
 * @param {Object} data - The data to store on Arweave
 * @param {Object} [options={}] - Transaction options
 * @param {string} [options.walletPath] - Path to wallet file
 * @returns {Promise<Object>} Transaction result with txId
 */
async function createNGOTransaction(data, options = {}) {
  if (!ARWEAVE_ENABLED || !BLOCKCHAIN_ENABLED) {
    console.log('[ARWEAVE] Arweave disabled. Returning mock transaction.');
    return {
      txId: `mock-arweave-${Date.now()}`,
      status: 'mock',
      data,
      timestamp: Date.now(),
    };
  }

  try {
    const arweave = _getArweaveClient();
    const wallet = await _getWallet(options.walletPath);
    
    // Validate data
    if (!data || typeof data !== 'object') {
      throw new TypeError('[ARWEAVE] Data must be a non-null object.');
    }
    
    // Add schema version and timestamp if not present
    const transactionData = {
      schemaVersion: '1.0.0',
      transactionType: 'NGO_COLLABORATION',
      timestamp: Date.now(),
      ...data,
    };
    
    // Create transaction
    const transaction = await arweave.createTransaction({
      data: JSON.stringify(transactionData),
    }, wallet);
    
    // Sign transaction
    await arweave.transactions.sign(transaction, wallet);
    
    // Submit transaction
    const response = await arweave.transactions.post(transaction);
    
    // Clear wallet from memory after use
    _clearWallet();
    
    if (!response.status || response.status !== 200) {
      throw new Error(`[ARWEAVE] Transaction submission failed: ${response.statusText}`);
    }
    
    console.log(`[ARWEAVE] Transaction submitted. TX ID: ${transaction.id}`);
    
    return {
      txId: transaction.id,
      status: 'submitted',
      data: transactionData,
      timestamp: Date.now(),
      blockNumber: null, // Will be set when confirmed
      size: transaction.data_size,
      reward: transaction.reward,
    };
  } catch (error) {
    console.error(`[ARWEAVE] Transaction creation failed: ${error.message}`);
    throw error;
  }
}

/**
 * Submit a batch of NGO collaboration records in a single transaction.
 * This reduces costs by bundling multiple records together.
 *
 * @param {Object[]} records - Array of data records to store
 * @param {Object} [options={}] - Transaction options
 * @returns {Promise<Object>} Transaction result
 */
async function createNGOTransactionBatch(records, options = {}) {
  if (!Array.isArray(records) || records.length === 0) {
    throw new TypeError('[ARWEAVE] Records must be a non-empty array.');
  }

  // Create batch wrapper
  const batchData = {
    schemaVersion: '1.0.0',
    batchType: 'NGO_COLLABORATION_BATCH',
    timestamp: Date.now(),
    recordCount: records.length,
    records: records.map((record, index) => ({
      index,
      timestamp: Date.now(),
      ...record,
    })),
  };

  return createNGOTransaction(batchData, options);
}

// ============================================================================
// QUERY FUNCTIONS
// ============================================================================

/**
 * Get transaction data by TX ID.
 *
 * @param {string} txId - Arweave transaction ID
 * @returns {Promise<Object|null>} Transaction data or null if not found
 */
async function getTransactionData(txId) {
  if (!ARWEAVE_ENABLED || !BLOCKCHAIN_ENABLED) {
    // In mock mode, check if we have a mock transaction
    if (txId && txId.startsWith('mock-arweave-')) {
      return {
        txId,
        data: JSON.parse(txId.replace('mock-arweave-', '')),
        status: 'mock',
      };
    }
    return null;
  }

  try {
    const arweave = _getArweaveClient();
    const transaction = await arweave.transactions.get(txId);
    
    if (!transaction) {
      return null;
    }
    
    // Parse the data
    let data;
    try {
      data = JSON.parse(transaction.get('data', { decode: true, string: true }));
    } catch (parseError) {
      console.warn(`[ARWEAVE] Failed to parse transaction data: ${parseError.message}`);
      data = transaction.get('data', { decode: true });
    }
    
    return {
      txId: transaction.id,
      data,
      timestamp: parseInt(transaction.get('timestamp', { decode: true, string: true })),
      blockNumber: parseInt(transaction.get('block_height', { decode: true, string: true })),
      status: 'confirmed',
    };
  } catch (error) {
    console.error(`[ARWEAVE] Failed to get transaction ${txId}: ${error.message}`);
    return null;
  }
}

/**
 * Query transactions by tags.
 * Arweave supports tag-based querying.
 *
 * @param {Object} query - Query parameters
 * @param {string[]} query.tags - Array of tags to match (AND logic)
 * @param {string} [query.appName] - Filter by app name
 * @param {number} [query.limit] - Maximum number of results
 * @param {string} [query.cursor] - Pagination cursor
 * @returns {Promise<Object>} Query results
 */
async function queryTransactionsByTags(query) {
  if (!ARWEAVE_ENABLED || !BLOCKCHAIN_ENABLED) {
    // Mock implementation for testing
    return {
      transactions: [],
      cursor: null,
      total: 0,
    };
  }

  try {
    const arweave = _getArweaveClient();
    const { tags = [], appName, limit = 100, cursor } = query;
    
    // Build query object
    const queryObj = {
      op: 'and',
      expr1: {
        op: 'equals',
        expr1: 'App-Name',
        expr2: appName || 'SXWer-AI-ChatBot',
      },
    };
    
    // Add tag filters
    if (tags.length > 0) {
      const tagFilters = tags.map(tag => ({
        op: 'equals',
        expr1: 'Tag',
        expr2: tag,
      }));
      
      if (tagFilters.length === 1) {
        queryObj.expr2 = tagFilters[0];
      } else {
        queryObj.expr2 = {
          op: 'and',
          ...tagFilters.reduce((acc, filter, index) => {
            acc[`expr${index + 1}`] = filter;
            return acc;
          }, {}),
        };
      }
    }
    
    // Execute query
    const result = await arweave.arql(queryObj, { limit, cursor });
    
    return {
      transactions: result,
      cursor: result.cursor || null,
      total: result.total || result.length || 0,
    };
  } catch (error) {
    console.error(`[ARWEAVE] Query failed: ${error.message}`);
    return {
      transactions: [],
      cursor: null,
      total: 0,
    };
  }
}

/**
 * Query transactions by NGO ID.
 *
 * @param {string} ngoId - NGO identifier
 * @param {Object} [options={}] - Query options
 * @returns {Promise<Object[]>} Array of matching transactions
 */
async function queryTransactionsByNGO(ngoId, options = {}) {
  if (!ngoId || typeof ngoId !== 'string') {
    throw new TypeError('[ARWEAVE] ngoId must be a non-empty string.');
  }

  const result = await queryTransactionsByTags({
    tags: [`ngo:${ngoId}`],
    ...options,
  });

  return result.transactions;
}

/**
 * Query transactions by data type.
 *
 * @param {string} dataType - Type of data (e.g., 'chat', 'feedback', 'consent')
 * @param {Object} [options={}] - Query options
 * @returns {Promise<Object[]>} Array of matching transactions
 */
async function queryTransactionsByDataType(dataType, options = {}) {
  if (!dataType || typeof dataType !== 'string') {
    throw new TypeError('[ARWEAVE] dataType must be a non-empty string.');
  }

  const result = await queryTransactionsByTags({
    tags: [`dataType:${dataType}`],
    ...options,
  });

  return result.transactions;
}

/**
 * Query transactions by date range.
 *
 * @param {Object} dateRange - Date range filter
 * @param {number|Date} dateRange.start - Start timestamp
 * @param {number|Date} dateRange.end - End timestamp
 * @param {Object} [options={}] - Query options
 * @returns {Promise<Object[]>} Array of matching transactions
 */
async function queryTransactionsByDateRange(dateRange, options = {}) {
  if (!dateRange || !dateRange.start || !dateRange.end) {
    throw new TypeError('[ARWEAVE] dateRange must have start and end properties.');
  }

  const startTimestamp = typeof dateRange.start === 'number' 
    ? dateRange.start 
    : dateRange.start.getTime();
  const endTimestamp = typeof dateRange.end === 'number' 
    ? dateRange.end 
    : dateRange.end.getTime();

  try {
    const arweave = _getArweaveClient();
    
    // Arweave ARQL doesn't directly support date range queries,
    // so we need to fetch and filter
    const allTransactions = await queryTransactionsByTags({
      tags: ['SXWer-AI-ChatBot'],
      limit: 1000, // Max limit
      ...options,
    });
    
    // Filter by timestamp
    const filtered = allTransactions.transactions.filter(tx => {
      const txData = tx.get('data', { decode: true, string: true });
      try {
        const parsed = JSON.parse(txData);
        const txTimestamp = parsed.timestamp || parseInt(tx.get('timestamp', { decode: true, string: true }));
        return txTimestamp >= startTimestamp && txTimestamp <= endTimestamp;
      } catch {
        return false;
      }
    });
    
    return filtered;
  } catch (error) {
    console.error(`[ARWEAVE] Date range query failed: ${error.message}`);
    return [];
  }
}

// ============================================================================
// VERIFICATION FUNCTIONS
// ============================================================================

/**
 * Verify the integrity of a transaction's data.
 *
 * @param {string} txId - Transaction ID
 * @param {string} expectedHash - Expected hash of the data
 * @returns {Promise<Object>} Verification result
 */
async function verifyTransactionIntegrity(txId, expectedHash) {
  const transaction = await getTransactionData(txId);
  
  if (!transaction) {
    return {
      valid: false,
      reason: 'Transaction not found',
      txId,
    };
  }

  if (!expectedHash) {
    return {
      valid: false,
      reason: 'No expected hash provided',
      txId,
    };
  }

  // Compute hash of the transaction data
  const dataString = typeof transaction.data === 'string' 
    ? transaction.data 
    : JSON.stringify(transaction.data);
  const computedHash = crypto.createHash('sha256').update(dataString, 'utf8').digest('hex');
  
  // Compare with expected hash
  const expectedHashValue = expectedHash.startsWith('sha256:') 
    ? expectedHash.slice(7) 
    : expectedHash;
  
  const isValid = computedHash === expectedHashValue;
  
  return {
    valid: isValid,
    reason: isValid ? 'Hash matches' : 'Hash mismatch',
    txId,
    expectedHash,
    computedHash,
  };
}

/**
 * Verify that a transaction was signed by a specific wallet.
 *
 * @param {string} txId - Transaction ID
 * @param {string} walletAddress - Expected wallet address
 * @returns {Promise<Object>} Verification result
 */
async function verifyTransactionSigner(txId, walletAddress) {
  if (!ARWEAVE_ENABLED || !BLOCKCHAIN_ENABLED) {
    return {
      valid: false,
      reason: 'Arweave disabled',
      txId,
      walletAddress,
    };
  }

  try {
    const arweave = _getArweaveClient();
    const transaction = await arweave.transactions.get(txId);
    
    if (!transaction) {
      return {
        valid: false,
        reason: 'Transaction not found',
        txId,
        walletAddress,
      };
    }
    
    const owner = transaction.get('owner', { decode: true, string: true });
    const isValid = owner === walletAddress;
    
    return {
      valid: isValid,
      reason: isValid ? 'Signer matches' : 'Signer mismatch',
      txId,
      walletAddress,
      actualSigner: owner,
    };
  } catch (error) {
    return {
      valid: false,
      reason: error.message,
      txId,
      walletAddress,
    };
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Generate a content hash for data to be stored.
 *
 * @param {Object} data - Data to hash
 * @returns {string} SHA-256 hash with algorithm prefix
 */
function generateContentHash(data) {
  const dataString = typeof data === 'string' ? data : JSON.stringify(data);
  const hash = crypto.createHash('sha256').update(dataString, 'utf8').digest('hex');
  return `sha256:${hash}`;
}

/**
 * Check if Arweave is available and enabled.
 *
 * @returns {boolean} True if Arweave can be used
 */
function isArweaveAvailable() {
  return ARWEAVE_ENABLED && BLOCKCHAIN_ENABLED;
}

/**
 * Get Arweave network information.
 *
 * @returns {Promise<Object>} Network info
 */
async function getNetworkInfo() {
  if (!isArweaveAvailable()) {
    return {
      available: false,
      reason: 'Arweave disabled',
    };
  }

  try {
    const arweave = _getArweaveClient();
    const networkInfo = await arweave.network.getInfo();
    
    return {
      available: true,
      network: networkInfo.network,
      height: networkInfo.height,
      currentBlock: networkInfo.current,
      nodes: networkInfo.nodes,
    };
  } catch (error) {
    return {
      available: false,
      reason: error.message,
    };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  // Transaction creation
  createNGOTransaction,
  createNGOTransactionBatch,
  
  // Query functions
  getTransactionData,
  queryTransactionsByTags,
  queryTransactionsByNGO,
  queryTransactionsByDataType,
  queryTransactionsByDateRange,
  
  // Verification
  verifyTransactionIntegrity,
  verifyTransactionSigner,
  
  // Utilities
  generateContentHash,
  isArweaveAvailable,
  getNetworkInfo,
  
  // Internal (for testing)
  _getArweaveClient,
  _getWallet,
  _clearWallet,
};
