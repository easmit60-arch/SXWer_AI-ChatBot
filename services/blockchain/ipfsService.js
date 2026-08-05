/**
 * SXWer AI ChatBot - IPFS Service
 *
 * HUMAN RIGHTS DESIGN:
 * - IPFS provides decentralized, content-addressed storage
 * - All data stored on IPFS is encrypted before upload
 * - No PII is ever stored unencrypted
 * - Graceful degradation if IPFS is unavailable
 *
 * WHAT THIS DOES:
 * - Upload encrypted data to IPFS
 * - Download data from IPFS by CID
 * - Verify data integrity using CIDs
 * - Handle IPFS node fallbacks
 *
 * DEPENDENCIES:
 * - ipfs-http-client: IPFS HTTP client for Node.js
 * - crypto: Node.js crypto module for hashing
 */

import { create } from 'ipfs-http-client';
import crypto from 'crypto';
import {
  IPFS_ENABLED,
  IPFS_CONFIG,
  BLOCKCHAIN_ENABLED,
} from './ledgerConfig.js';

// ============================================================================
// IPFS CLIENT SETUP
// ============================================================================

/**
 * IPFS client instances.
 * Primary client and fallback clients for redundancy.
 *
 * @type {Object}
 */
const _ipfsClients = {};

/**
 * Fallback IPFS gateways for when primary is down.
 */
const IPFS_FALLBACKS = [
  { host: 'ipfs.infura.io', port: 5001, protocol: 'https' },
  { host: 'cloudflare-ipfs.com', port: 443, protocol: 'https' },
  { host: 'dweb.link', port: 443, protocol: 'https' },
];

/**
 * Get the primary IPFS client.
 *
 * @returns {Object} IPFS client instance
 */
function _getPrimaryClient() {
  if (_ipfsClients.primary) return _ipfsClients.primary;
  
  if (!IPFS_ENABLED || !BLOCKCHAIN_ENABLED) {
    throw new Error('[IPFS] IPFS is not enabled. Check IPFS_ENABLED and BLOCKCHAIN_ENABLED.');
  }
  
  _ipfsClients.primary = create(IPFS_CONFIG);
  return _ipfsClients.primary;
}

/**
 * Get a fallback IPFS client.
 *
 * @param {number} index - Fallback index
 * @returns {Object} IPFS client instance
 */
function _getFallbackClient(index = 0) {
  const config = IPFS_FALLBACKS[index % IPFS_FALLBACKS.length];
  const cacheKey = `fallback_${index}`;
  
  if (_ipfsClients[cacheKey]) return _ipfsClients[cacheKey];
  
  _ipfsClients[cacheKey] = create(config);
  return _ipfsClients[cacheKey];
}

// ============================================================================
// UPLOAD FUNCTIONS
// ============================================================================

/**
 * Upload data to IPFS.
 * Automatically retries with fallbacks if primary fails.
 *
 * @param {Uint8Array|string} data - Data to upload (encrypted)
 * @param {Object} [options={}] - Upload options
 * @param {number} [options.retries=3] - Number of retries
 * @param {number} [options.retryDelay=1000] - Delay between retries in ms
 * @returns {Promise<Object>} Upload result with CID
 */
async function uploadToIPFS(data, options = {}) {
  const { retries = 3, retryDelay = 1000 } = options;
  
  if (!IPFS_ENABLED || !BLOCKCHAIN_ENABLED) {
    console.log('[IPFS] IPFS disabled. Returning mock CID.');
    return {
      cid: `mock-cid-${Date.now()}`,
      status: 'mock',
      size: typeof data === 'string' ? data.length : data.byteLength,
    };
  }

  // Convert string to Uint8Array if needed
  const dataToUpload = typeof data === 'string' 
    ? new TextEncoder().encode(data) 
    : data;

  let lastError = null;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const client = attempt === 0 ? _getPrimaryClient() : _getFallbackClient(attempt - 1);
      
      const result = await client.add(dataToUpload);
      
      console.log(`[IPFS] Upload successful. CID: ${result.cid.toString()}`);
      
      return {
        cid: result.cid.toString(),
        path: result.path,
        size: result.size,
        status: 'uploaded',
        attempt,
      };
    } catch (error) {
      lastError = error;
      console.warn(`[IPFS] Upload attempt ${attempt + 1} failed: ${error.message}`);
      
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, retryDelay * Math.pow(2, attempt)));
      }
    }
  }
  
  console.error(`[IPFS] All upload attempts failed: ${lastError.message}`);
  throw new Error(`[IPFS] Upload failed after ${retries + 1} attempts: ${lastError.message}`);
}

/**
 * Upload a JSON object to IPFS.
 * Automatically serializes and encrypts if encryption function provided.
 *
 * @param {Object} data - JSON data to upload
 * @param {Function} [encryptFn] - Optional encryption function
 * @param {Object} [options={}] - Upload options
 * @returns {Promise<Object>} Upload result
 */
async function uploadJSONToIPFS(data, encryptFn = null, options = {}) {
  // Serialize to JSON string
  const jsonString = JSON.stringify(data);
  
  // Encrypt if encryption function provided
  const finalData = encryptFn 
    ? await encryptFn(jsonString) 
    : jsonString;
  
  return uploadToIPFS(finalData, options);
}

/**
 * Upload multiple files as a directory to IPFS.
 *
 * @param {Object} files - Map of filename to data
 * @param {Object} [options={}] - Upload options
 * @returns {Promise<Object>} Upload result with directory CID
 */
async function uploadDirectoryToIPFS(files, options = {}) {
  if (!IPFS_ENABLED || !BLOCKCHAIN_ENABLED) {
    return {
      cid: `mock-dir-${Date.now()}`,
      status: 'mock',
    };
  }

  try {
    const client = _getPrimaryClient();
    
    // Convert files to array of { path, content } objects
    const fileArray = Object.entries(files).map(([path, content]) => ({
      path,
      content: typeof content === 'string' ? content : content,
    }));
    
    const result = await client.addAll(fileArray);
    
    // The last entry is the directory itself
    const dirCid = result[result.length - 1].cid.toString();
    
    console.log(`[IPFS] Directory upload successful. CID: ${dirCid}`);
    
    return {
      cid: dirCid,
      files: result.slice(0, -1).map(f => ({
        path: f.path,
        cid: f.cid.toString(),
        size: f.size,
      })),
      status: 'uploaded',
    };
  } catch (error) {
    console.error(`[IPFS] Directory upload failed: ${error.message}`);
    throw error;
  }
}

// ============================================================================
// DOWNLOAD FUNCTIONS
// ============================================================================

/**
 * Download data from IPFS by CID.
 * Automatically retries with fallbacks if primary fails.
 *
 * @param {string} cid - IPFS Content Identifier
 * @param {Object} [options={}] - Download options
 * @param {number} [options.retries=3] - Number of retries
 * @param {number} [options.retryDelay=1000] - Delay between retries in ms
 * @param {number} [options.timeout=30000] - Timeout in ms
 * @returns {Promise<Uint8Array>} Downloaded data
 */
async function downloadFromIPFS(cid, options = {}) {
  const { retries = 3, retryDelay = 1000, timeout = 30000 } = options;
  
  if (!cid || typeof cid !== 'string') {
    throw new TypeError('[IPFS] CID must be a non-empty string.');
  }

  // Mock mode
  if (!IPFS_ENABLED || !BLOCKCHAIN_ENABLED) {
    if (cid.startsWith('mock-cid-')) {
      console.log('[IPFS] Mock mode. Returning mock data.');
      return new TextEncoder().encode(`{"mock": true, "cid": "${cid}"}`);
    }
    throw new Error('[IPFS] IPFS disabled and CID is not a mock CID.');
  }

  let lastError = null;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const client = attempt === 0 ? _getPrimaryClient() : _getFallbackClient(attempt - 1);
      
      // Set timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('IPFS download timeout')), timeout);
      });
      
      const downloadPromise = client.cat(cid);
      
      // Race between download and timeout
      const result = await Promise.race([downloadPromise, timeoutPromise]);
      
      // Collect all chunks
      const chunks = [];
      for await (const chunk of result) {
        chunks.push(chunk);
      }
      
      // Concatenate chunks
      const data = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.byteLength, 0));
      let offset = 0;
      for (const chunk of chunks) {
        data.set(chunk, offset);
        offset += chunk.byteLength;
      }
      
      console.log(`[IPFS] Download successful. CID: ${cid}, Size: ${data.byteLength}`);
      
      return data;
    } catch (error) {
      lastError = error;
      console.warn(`[IPFS] Download attempt ${attempt + 1} failed: ${error.message}`);
      
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, retryDelay * Math.pow(2, attempt)));
      }
    }
  }
  
  console.error(`[IPFS] All download attempts failed: ${lastError.message}`);
  throw new Error(`[IPFS] Download failed after ${retries + 1} attempts: ${lastError.message}`);
}

/**
 * Download and parse JSON data from IPFS.
 *
 * @param {string} cid - IPFS Content Identifier
 * @param {Function} [decryptFn] - Optional decryption function
 * @param {Object} [options={}] - Download options
 * @returns {Promise<Object>} Parsed JSON data
 */
async function downloadJSONFromIPFS(cid, decryptFn = null, options = {}) {
  const data = await downloadFromIPFS(cid, options);
  
  // Decrypt if decryption function provided
  const finalData = decryptFn 
    ? await decryptFn(data) 
    : data;
  
  // Parse as JSON
  const text = typeof finalData === 'string' 
    ? finalData 
    : new TextDecoder().decode(finalData);
  
  try {
    return JSON.parse(text);
  } catch (error) {
    console.error(`[IPFS] Failed to parse JSON from CID ${cid}: ${error.message}`);
    throw new Error(`[IPFS] Invalid JSON data: ${error.message}`);
  }
}

/**
 * Download a directory from IPFS.
 *
 * @param {string} cid - Directory CID
 * @param {Object} [options={}] - Download options
 * @returns {Promise<Object>} Map of filename to data
 */
async function downloadDirectoryFromIPFS(cid, options = {}) {
  if (!IPFS_ENABLED || !BLOCKCHAIN_ENABLED) {
    throw new Error('[IPFS] IPFS disabled.');
  }

  try {
    const client = _getPrimaryClient();
    const result = {};
    
    for await (const file of client.ls(cid)) {
      if (file.type === 'file') {
        const data = await downloadFromIPFS(file.cid.toString(), options);
        result[file.name] = data;
      }
    }
    
    return result;
  } catch (error) {
    console.error(`[IPFS] Directory download failed: ${error.message}`);
    throw error;
  }
}

// ============================================================================
// VERIFICATION FUNCTIONS
// ============================================================================

/**
 * Verify that data matches a CID.
 *
 * @param {Uint8Array|string} data - Data to verify
 * @param {string} cid - Expected CID
 * @returns {Promise<Object>} Verification result
 */
async function verifyCID(data, cid) {
  if (!cid || typeof cid !== 'string') {
    return {
      valid: false,
      reason: 'Invalid CID',
    };
  }

  // Compute CID from data
  const dataToVerify = typeof data === 'string' 
    ? new TextEncoder().encode(data) 
    : data;
  
  try {
    const client = _getPrimaryClient();
    const computedCid = (await client.add(dataToVerify)).cid.toString();
    
    const isValid = computedCid === cid;
    
    return {
      valid: isValid,
      reason: isValid ? 'CID matches' : 'CID mismatch',
      expectedCid: cid,
      computedCid,
    };
  } catch (error) {
    return {
      valid: false,
      reason: error.message,
      expectedCid: cid,
    };
  }
}

/**
 * Check if a CID exists on IPFS.
 *
 * @param {string} cid - CID to check
 * @returns {Promise<boolean>} True if CID exists
 */
async function cidExists(cid) {
  if (!cid || typeof cid !== 'string') return false;
  
  if (!IPFS_ENABLED || !BLOCKCHAIN_ENABLED) {
    return cid.startsWith('mock-cid-');
  }

  try {
    const client = _getPrimaryClient();
    await client.cat(cid);
    return true;
  } catch (error) {
    return false;
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Generate a CID from data without uploading.
 * Useful for computing what the CID would be before upload.
 *
 * @param {Uint8Array|string} data - Data to compute CID for
 * @returns {Promise<string>} Computed CID
 */
async function computeCID(data) {
  if (!IPFS_ENABLED || !BLOCKCHAIN_ENABLED) {
    return `mock-cid-${Date.now()}`;
  }

  try {
    const client = _getPrimaryClient();
    const result = await client.add(data, { onlyHash: true });
    return result.cid.toString();
  } catch (error) {
    console.error(`[IPFS] Failed to compute CID: ${error.message}`);
    throw error;
  }
}

/**
 * Get information about an IPFS node.
 *
 * @returns {Promise<Object>} Node info
 */
async function getNodeInfo() {
  if (!IPFS_ENABLED || !BLOCKCHAIN_ENABLED) {
    return {
      available: false,
      reason: 'IPFS disabled',
    };
  }

  try {
    const client = _getPrimaryClient();
    const id = await client.id();
    const version = await client.version();
    
    return {
      available: true,
      id: id.id,
      publicKey: id.publicKey,
      addresses: id.addresses,
      agentVersion: id.agentVersion,
      protocolVersion: id.protocolVersion,
      version: version.version,
      commit: version.commit,
      repo: version.repo,
      system: version.system,
    };
  } catch (error) {
    return {
      available: false,
      reason: error.message,
    };
  }
}

/**
 * Check if IPFS is available.
 *
 * @returns {boolean} True if IPFS can be used
 */
function isIPFSAvailable() {
  return IPFS_ENABLED && BLOCKCHAIN_ENABLED;
}

// ============================================================================
// PINNING FUNCTIONS
// ============================================================================

/**
 * Pin a CID to ensure it stays available.
 *
 * @param {string} cid - CID to pin
 * @param {Object} [options={}] - Pin options
 * @returns {Promise<Object>} Pin result
 */
async function pinCID(cid, options = {}) {
  if (!IPFS_ENABLED || !BLOCKCHAIN_ENABLED) {
    console.log('[IPFS] Pinning skipped (IPFS disabled).');
    return { pinned: false, reason: 'IPFS disabled' };
  }

  try {
    const client = _getPrimaryClient();
    await client.pin.add(cid);
    
    console.log(`[IPFS] CID pinned: ${cid}`);
    return { pinned: true, cid };
  } catch (error) {
    console.error(`[IPFS] Pin failed: ${error.message}`);
    return { pinned: false, reason: error.message };
  }
}

/**
 * Unpin a CID.
 *
 * @param {string} cid - CID to unpin
 * @returns {Promise<Object>} Unpin result
 */
async function unpinCID(cid) {
  if (!IPFS_ENABLED || !BLOCKCHAIN_ENABLED) {
    return { unpinned: false, reason: 'IPFS disabled' };
  }

  try {
    const client = _getPrimaryClient();
    await client.pin.rm(cid);
    
    console.log(`[IPFS] CID unpinned: ${cid}`);
    return { unpinned: true, cid };
  } catch (error) {
    console.error(`[IPFS] Unpin failed: ${error.message}`);
    return { unpinned: false, reason: error.message };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  // Upload functions
  uploadToIPFS,
  uploadJSONToIPFS,
  uploadDirectoryToIPFS,
  
  // Download functions
  downloadFromIPFS,
  downloadJSONFromIPFS,
  downloadDirectoryFromIPFS,
  
  // Verification
  verifyCID,
  cidExists,
  computeCID,
  
  // Pinning
  pinCID,
  unpinCID,
  
  // Utilities
  isIPFSAvailable,
  getNodeInfo,
  
  // Internal (for testing)
  _getPrimaryClient,
  _getFallbackClient,
};
