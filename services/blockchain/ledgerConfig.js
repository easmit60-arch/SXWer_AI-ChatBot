/**
 * SXWer AI ChatBot - Blockchain Ledger Configuration
 *
 * HUMAN RIGHTS DESIGN:
 * - Blockchain is OPTIONAL. The application works fully without it.
 * - Never activated without explicit informed consent.
 * - Configurable entirely through environment variables.
 * - No hardcoded keys, endpoints, or provider-specific values.
 *
 * WHAT THIS CONFIGURES:
 * - Whether blockchain support is enabled at all
 * - Which abstract provider to use (ethereum, polygon, hyperledger, hedera, consortium, mock)
 * - Arweave configuration for permanent data storage
 * - IPFS configuration for decentralized file storage
 * - Connection settings (never stored in source code)
 * - Consent ledger schema version
 */

// ============================================================================
// BLOCKCHAIN FEATURE FLAG
// ============================================================================

/**
 * Blockchain is DISABLED by default.
 * User must explicitly opt in after reading an informed consent disclosure.
 * This value is read at runtime and never hardcoded to true.
 */
const BLOCKCHAIN_ENABLED = process.env.BLOCKCHAIN_ENABLED === 'true';

/**
 * Supported provider identifiers.
 * The application never hardcodes a single provider.
 * New providers can be added without changing the core ledger interface.
 */
const SUPPORTED_PROVIDERS = Object.freeze([
  'ethereum',
  'polygon',
  'hyperledger',
  'hedera',
  'consortium',
  'arweave', // Arweave for permanent data storage
  'mock', // In-memory provider for testing and offline simulation
]);

/**
 * Active provider — read from environment, defaults to 'mock'.
 * 'mock' is safe: it logs consent receipts locally without any network calls.
 */
const ACTIVE_PROVIDER = (() => {
  const p = (process.env.BLOCKCHAIN_PROVIDER || 'mock').toLowerCase();
  if (!SUPPORTED_PROVIDERS.includes(p)) {
    console.warn(`[LEDGER CONFIG] Unknown provider "${p}". Falling back to "mock".`);
    return 'mock';
  }
  return p;
})();

// ============================================================================
// CONSENT LEDGER SCHEMA
// ============================================================================

/**
 * Current schema version for consent receipts.
 * Increment when the on-chain receipt structure changes.
 * Stored on every consent record so verifiers know how to decode it.
 */
const LEDGER_SCHEMA_VERSION = '1.0.0';

/**
 * Recognised consent event types.
 * Only these types may be written to the ledger.
 * This list defines the complete vocabulary of auditable consent actions.
 */
const CONSENT_EVENT_TYPES = Object.freeze({
  CONSENT_GRANTED:              'CONSENT_GRANTED',
  CONSENT_REVOKED:              'CONSENT_REVOKED',
  POLICY_VERSION_ACCEPTED:      'POLICY_VERSION_ACCEPTED',
  AI_ENABLED:                   'AI_ENABLED',
  AI_DISABLED:                  'AI_DISABLED',
  THIRD_PARTY_PERMISSION_GRANTED: 'THIRD_PARTY_PERMISSION_GRANTED',
  THIRD_PARTY_PERMISSION_REVOKED: 'THIRD_PARTY_PERMISSION_REVOKED',
  LOCAL_DATA_DELETED:           'LOCAL_DATA_DELETED',
  DATA_EXPORT_COMPLETED:        'DATA_EXPORT_COMPLETED',
  BLOCKCHAIN_ENABLED:           'BLOCKCHAIN_ENABLED',
  BLOCKCHAIN_DISABLED:          'BLOCKCHAIN_DISABLED',
  WALLET_CONNECTED:             'WALLET_CONNECTED',
  WALLET_DISCONNECTED:          'WALLET_DISCONNECTED',
});

// ============================================================================
// PROVIDER CONNECTION SETTINGS (from environment only)
// ============================================================================

/**
 * Provider-specific connection config.
 * All values come from environment variables.
 * Private keys are NEVER read here — walletService.js handles signing separately.
 */
const PROVIDER_CONFIG = Object.freeze({
  ethereum: {
    rpcUrl:      process.env.ETHEREUM_RPC_URL      || null,
    chainId:     process.env.ETHEREUM_CHAIN_ID     || null,
    contractAddress: process.env.CONSENT_CONTRACT_ETH || null,
  },
  polygon: {
    rpcUrl:      process.env.POLYGON_RPC_URL       || null,
    chainId:     process.env.POLYGON_CHAIN_ID      || null,
    contractAddress: process.env.CONSENT_CONTRACT_POLY || null,
  },
  hyperledger: {
    gatewayUrl:  process.env.HYPERLEDGER_GATEWAY   || null,
    channelName: process.env.HYPERLEDGER_CHANNEL   || null,
    chaincodeName: process.env.HYPERLEDGER_CHAINCODE || null,
  },
  hedera: {
    network:     process.env.HEDERA_NETWORK        || 'testnet',
    topicId:     process.env.HEDERA_TOPIC_ID       || null,
    operatorId:  process.env.HEDERA_OPERATOR_ID    || null,
    // operatorKey is handled exclusively by walletService, never here
  },
  consortium: {
    rpcUrl:      process.env.CONSORTIUM_RPC_URL    || null,
    chainId:     process.env.CONSORTIUM_CHAIN_ID   || null,
    contractAddress: process.env.CONSENT_CONTRACT_CONSORTIUM || null,
  },
  arweave: {
    host:       process.env.ARWEAVE_HOST          || 'arweave.net',
    port:       parseInt(process.env.ARWEAVE_PORT) || 443,
    protocol:   process.env.ARWEAVE_PROTOCOL      || 'https',
    walletPath: process.env.ARWEAVE_WALLET_PATH    || null,
    // Wallet key is loaded separately, never stored in config
  },
  mock: {
    // No network config required. Mock provider stores receipts in memory only.
    persist:     process.env.MOCK_LEDGER_PERSIST   === 'true',
  },
});

// ============================================================================
// ARWEAVE CONFIGURATION
// ============================================================================

/**
 * Arweave-specific configuration.
 * Arweave is used for permanent, low-cost data storage.
 */
const ARWEAVE_CONFIG = Object.freeze({
  host: PROVIDER_CONFIG.arweave.host,
  port: PROVIDER_CONFIG.arweave.port,
  protocol: PROVIDER_CONFIG.arweave.protocol,
  walletPath: PROVIDER_CONFIG.arweave.walletPath,
});

/**
 * Whether Arweave is enabled.
 * Requires both BLOCKCHAIN_ENABLED and ARWEAVE-specific config.
 */
const ARWEAVE_ENABLED = BLOCKCHAIN_ENABLED && 
  PROVIDER_CONFIG.arweave.host !== null;

// ============================================================================
// IPFS CONFIGURATION
// ============================================================================

/**
 * IPFS-specific configuration.
 * IPFS is used for decentralized file storage.
 */
const IPFS_CONFIG = Object.freeze({
  host: process.env.IPFS_HOST || 'ipfs.infura.io',
  port: parseInt(process.env.IPFS_PORT) || 5001,
  protocol: process.env.IPFS_PROTOCOL || 'https',
  projectId: process.env.IPFS_PROJECT_ID || null,
  projectSecret: process.env.IPFS_PROJECT_SECRET || null,
  authToken: process.env.IPFS_AUTH_TOKEN || null,
});

/**
 * Whether IPFS is enabled.
 * Requires both BLOCKCHAIN_ENABLED and IPFS-specific config.
 */
const IPFS_ENABLED = BLOCKCHAIN_ENABLED && 
  IPFS_CONFIG.host !== null;

// ============================================================================
// HUMAN RIGHTS DISCLOSURE TEXT
// ============================================================================

/**
 * The exact text displayed to the user before blockchain is activated.
 * This must be shown in full before consent is recorded.
 * Changing this text bumps the POLICY_VERSION.
 */
const INFORMED_CONSENT_DISCLOSURE = Object.freeze({
  policyVersion: '1.0.0',
  title: 'Optional Blockchain Consent Ledger — Informed Consent',
  body: [
    'You are about to enable an optional, cryptographic consent ledger.',
    '',
    'WHAT WILL BE STORED ON THE BLOCKCHAIN:',
    '  - A hash (fingerprint) of your consent document — not the document itself.',
    '  - The type of consent action (e.g. "Consent Granted", "Consent Revoked").',
    '  - A timestamp.',
    '  - The application version.',
    '  - An optional wallet address (if you connect one).',
    '  - A digital signature verifying authenticity.',
    '',
    'WHAT WILL NEVER BE STORED ON THE BLOCKCHAIN:',
    '  - Your name, email, phone number, or any identifying information.',
    '  - Conversation history, messages, or chat content.',
    '  - Safety plans, health records, or legal documents.',
    '  - Location data or device identifiers.',
    '  - Prompts, AI responses, or user profiles.',
    '',
    'YOUR RIGHTS:',
    '  - You can refuse to enable blockchain without losing any app features.',
    '  - You can disable blockchain at any time.',
    '  - You can revoke consent at any time.',
    '  - You can inspect every record written on your behalf.',
    '  - You can export the full ledger history.',
    '  - Disabling blockchain does not delete local data.',
    '',
    'The application continues to work fully offline without blockchain.',
  ].join('\n'),
});

// ============================================================================
// EXPORTS
// ============================================================================

export {
  BLOCKCHAIN_ENABLED,
  SUPPORTED_PROVIDERS,
  ACTIVE_PROVIDER,
  LEDGER_SCHEMA_VERSION,
  CONSENT_EVENT_TYPES,
  PROVIDER_CONFIG,
  INFORMED_CONSENT_DISCLOSURE,
  
  // Arweave configuration
  ARWEAVE_ENABLED,
  ARWEAVE_CONFIG,
  
  // IPFS configuration
  IPFS_ENABLED,
  IPFS_CONFIG,
};
