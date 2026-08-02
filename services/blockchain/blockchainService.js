/**
 * SXWer AI ChatBot - Blockchain Service (Abstract Provider Interface)
 *
 * HUMAN RIGHTS DESIGN:
 * - This file is the ONLY place that communicates with an external blockchain.
 * - The rest of the application calls this abstraction — never a provider directly.
 * - Swapping providers requires only updating this file and ledgerConfig.js.
 * - The mock provider (default) runs entirely in memory with no network calls.
 * - All providers share an identical interface so the consent ledger is
 *   provider-agnostic.
 *
 * SUPPORTED PROVIDERS (configured via BLOCKCHAIN_PROVIDER env var):
 *   mock        — In-memory, no network (default)
 *   ethereum    — Ethereum-compatible EVM chains
 *   polygon     — Polygon (EVM)
 *   hyperledger — Hyperledger Fabric (permissioned)
 *   hedera      — Hedera Hashgraph (HCS topics)
 *   consortium  — Generic permissioned EVM consortium
 *
 * INTERFACE CONTRACT:
 * Every provider implements:
 *   submitTransaction(receipt)  → { txId, timestamp, blockNumber }
 *   queryTransaction(txId)      → receipt object or null
 *   isAvailable()               → boolean
 *   getProviderName()           → string
 */

import { ACTIVE_PROVIDER, BLOCKCHAIN_ENABLED, PROVIDER_CONFIG } from './ledgerConfig.js';

// ============================================================================
// MOCK PROVIDER (default — no network, safe for offline use)
// ============================================================================

/**
 * In-memory consent ledger used when BLOCKCHAIN_PROVIDER=mock (or unset).
 * Receipts are stored in this Map for the lifetime of the process.
 * Nothing is written to disk or transmitted to any network.
 *
 * @type {Map<string, Object>}
 */
const _mockStore = new Map();
let _mockTxCounter = 0;

const mockProvider = {
  getProviderName: () => 'mock',

  isAvailable: () => true,

  /**
   * Store a consent receipt in memory.
   *
   * @param {Object} receipt - Validated consent receipt object
   * @returns {Promise<{ txId: string, timestamp: number, blockNumber: number }>}
   */
  submitTransaction: async (receipt) => {
    _mockTxCounter += 1;
    const txId = `mock-tx-${Date.now()}-${_mockTxCounter}`;
    const timestamp = Date.now();
    const blockNumber = _mockTxCounter; // Simulates sequential blocks

    _mockStore.set(txId, { ...receipt, txId, timestamp, blockNumber });

    console.log(`[BLOCKCHAIN:mock] Transaction submitted. txId=${txId} event=${receipt.eventType}`);
    return { txId, timestamp, blockNumber };
  },

  /**
   * Retrieve a stored consent receipt by transaction ID.
   *
   * @param {string} txId
   * @returns {Promise<Object|null>}
   */
  queryTransaction: async (txId) => {
    return _mockStore.get(txId) || null;
  },

  /**
   * Return all stored receipts (mock-only utility for UI display).
   *
   * @returns {Promise<Object[]>}
   */
  getAllTransactions: async () => {
    return Array.from(_mockStore.values());
  },
};

// ============================================================================
// STUB PROVIDERS (placeholders for future integration)
// ============================================================================

/**
 * Create a stub provider that logs a clear message when used.
 * Real implementation requires the appropriate SDK (ethers.js, hedera-sdk, etc.).
 *
 * @param {string} name - Provider name for logging
 * @returns {Object} Stub provider conforming to the provider interface
 */
function createStubProvider(name) {
  const config = PROVIDER_CONFIG[name] || {};

  return {
    getProviderName: () => name,

    isAvailable: () => {
      // A stub is "available" only if the minimum required config is present
      const hasConfig = Object.values(config).some((v) => v !== null && v !== undefined);
      return hasConfig;
    },

    submitTransaction: async (receipt) => {
      const missing = Object.entries(config)
        .filter(([, v]) => v === null)
        .map(([k]) => k);

      if (missing.length > 0) {
        throw new Error(
          `[BLOCKCHAIN:${name}] Provider not configured. ` +
          `Missing environment variables: ${missing.join(', ')}. ` +
          `See .env.example for required settings.`
        );
      }

      // Stub: log intent, return simulated result
      // Replace this block with real SDK calls when integrating a live provider.
      console.warn(
        `[BLOCKCHAIN:${name}] STUB — real SDK integration not yet installed. ` +
        `Receipt eventType=${receipt.eventType} was NOT submitted to the chain.`
      );

      return {
        txId: `stub-${name}-${Date.now()}`,
        timestamp: Date.now(),
        blockNumber: 0,
        warning: 'stub_provider_not_integrated',
      };
    },

    queryTransaction: async (_txId) => {
      console.warn(`[BLOCKCHAIN:${name}] STUB — queryTransaction not implemented.`);
      return null;
    },

    getAllTransactions: async () => [],
  };
}

// ============================================================================
// PROVIDER REGISTRY
// ============================================================================

const _providers = {
  mock:         mockProvider,
  ethereum:     createStubProvider('ethereum'),
  polygon:      createStubProvider('polygon'),
  hyperledger:  createStubProvider('hyperledger'),
  hedera:       createStubProvider('hedera'),
  consortium:   createStubProvider('consortium'),
};

/**
 * Resolve the active provider instance.
 * Returns null if blockchain is disabled.
 *
 * @returns {Object|null} Provider instance or null
 */
function getProvider() {
  if (!BLOCKCHAIN_ENABLED) return null;
  return _providers[ACTIVE_PROVIDER] || _providers.mock;
}

// ============================================================================
// PUBLIC INTERFACE
// ============================================================================

/**
 * Submit a consent receipt to the blockchain.
 * Returns null if blockchain is disabled (application continues normally).
 *
 * @param {Object} receipt - Validated consent receipt from consentLedger.js
 * @returns {Promise<{ txId: string, timestamp: number, blockNumber: number }|null>}
 */
async function submitTransaction(receipt) {
  const provider = getProvider();
  if (!provider) {
    // Blockchain disabled — silently return null; caller handles gracefully
    return null;
  }

  if (!provider.isAvailable()) {
    throw new Error(
      `[BLOCKCHAIN] Provider "${ACTIVE_PROVIDER}" is not available. ` +
      `Check provider configuration in .env.`
    );
  }

  return provider.submitTransaction(receipt);
}

/**
 * Query a specific transaction by its ID.
 * Returns null if blockchain is disabled or transaction not found.
 *
 * @param {string} txId
 * @returns {Promise<Object|null>}
 */
async function queryTransaction(txId) {
  const provider = getProvider();
  if (!provider) return null;
  return provider.queryTransaction(txId);
}

/**
 * Retrieve all submitted consent receipts (where supported by the provider).
 * Returns empty array if blockchain is disabled.
 *
 * @returns {Promise<Object[]>}
 */
async function getAllTransactions() {
  const provider = getProvider();
  if (!provider) return [];
  if (typeof provider.getAllTransactions !== 'function') return [];
  return provider.getAllTransactions();
}

/**
 * Check whether the active blockchain provider is reachable.
 *
 * @returns {boolean}
 */
function isProviderAvailable() {
  const provider = getProvider();
  return provider ? provider.isAvailable() : false;
}

/**
 * Return the name of the active provider, or 'none' if blockchain is disabled.
 *
 * @returns {string}
 */
function getProviderName() {
  if (!BLOCKCHAIN_ENABLED) return 'none';
  const provider = getProvider();
  return provider ? provider.getProviderName() : 'none';
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  submitTransaction,
  queryTransaction,
  getAllTransactions,
  isProviderAvailable,
  getProviderName,
  getProvider,
};
