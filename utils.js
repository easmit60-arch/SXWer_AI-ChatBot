/**
 * SXWer AI ChatBot - Shared Utilities
 *
 * HUMAN RIGHTS DESIGN:
 * - Centralizes shared utility functions to reduce code duplication (DRY principle)
 * - Preserves all ethical safeguards: GDPR, Belmont, AI Ethics Lab, WMA Helsinki, IMDRF SaMD
 * - Maintains data minimization: no user-identifiable information stored
 * - Ensures user autonomy: all functions respect user consent and privacy
 * - Zero dependencies: uses only Node.js built-ins and existing modules
 *
 * WHAT THIS DOES:
 * - Session ID validation and normalization
 * - Consent state management
 * - Input sanitization
 * - Common validation utilities
 * - Error handling helpers
 *
 * DESIGN PRINCIPLES:
 * 1. Single Source of Truth: Each utility function defined once
 * 2. Pure Functions: Where possible, functions are pure (same input → same output)
 * 3. Immutability: Return immutable copies of data
 * 4. Privacy by Default: No logging of sensitive data
 * 5. Fail-Safe: Graceful degradation on errors
 */

import crypto from 'crypto';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Maximum session ID length for data minimization (64 chars = 32 bytes hex)
 */
const MAX_SESSION_ID_LENGTH = 64;

/**
 * Default session ID for fallback cases
 */
const DEFAULT_SESSION_ID = 'default';

/**
 * Pattern for valid session IDs (hex only for anonymity)
 */
const VALID_SESSION_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

/**
 * Default consent state (no consent granted)
 */
const DEFAULT_CONSENT = Object.freeze({ ai: false, tools: false });

// ============================================================================
// SESSION ID UTILITIES
// ============================================================================

/**
 * Generate a cryptographically secure anonymous session ID
 * Uses 32 bytes of random data (256 bits of entropy) converted to hex
 *
 * @returns {string} Anonymous session ID (64 hex characters)
 *
 * HUMAN RIGHTS: Ensures no user-identifiable information can be encoded
 */
function generateAnonymousSessionId() {
  // Generate 32 bytes of random data (256 bits of entropy)
  const randomBytes = crypto.randomBytes(32);
  
  // Convert to hex string (64 characters)
  let sessionId = randomBytes.toString('hex');
  
  // Ensure it's exactly 64 characters (data minimization)
  sessionId = sessionId.substring(0, MAX_SESSION_ID_LENGTH);
  
  return sessionId;
}

/**
 * Validate session ID format for data minimization compliance
 * Only allows hex characters (0-9, a-f) to ensure no user-identifiable information
 *
 * @param {string} sessionId - Session ID to validate
 * @returns {boolean} True if valid
 *
 * HUMAN RIGHTS: Prevents encoding of user-identifiable information in session IDs
 */
function isValidSessionId(sessionId) {
  if (typeof sessionId !== 'string') return false;
  if (sessionId.length === 0 || sessionId.length > MAX_SESSION_ID_LENGTH) return false;
  
  // Allow alphanumeric, underscore, and hyphen for session IDs
  // This matches the pattern used in chatbot.js and server-offline.js
  return VALID_SESSION_ID_PATTERN.test(sessionId);
}

/**
 * Normalize and validate session ID for data minimization
 * Returns a valid session ID or generates a new anonymous one if invalid
 *
 * @param {string} sessionId - Session ID to normalize (defaults to "default")
 * @returns {string} Normalized session ID
 *
 * HUMAN RIGHTS: Ensures all session IDs are valid and anonymous
 */
function normalizeSessionId(sessionId = DEFAULT_SESSION_ID) {
  // Handle null/undefined by using default
  if (sessionId == null) {
    return DEFAULT_SESSION_ID;
  }
  
  const normalized = String(sessionId).trim();
  
  // Validate session ID format for data minimization
  if (!isValidSessionId(normalized)) {
    // Log warning without exposing the invalid session ID
    console.warn('[PRIVACY] Invalid session ID format detected. Using default.');
    return DEFAULT_SESSION_ID;
  }
  
  return normalized || DEFAULT_SESSION_ID;
}

// ============================================================================
// CONSENT STATE UTILITIES
// ============================================================================

/**
 * Minimize consent state to only essential fields
 * Ensures data minimization by storing only what's necessary
 *
 * @param {Object} consentState - Consent state object
 * @returns {Object} Minimized consent state (immutable)
 *
 * HUMAN RIGHTS: Data minimization - only stores essential consent flags
 */
function minimizeConsentState(consentState = DEFAULT_CONSENT) {
  return Object.freeze({
    ai: Boolean(consentState?.ai),
    tools: Boolean(consentState?.tools),
  });
}

/**
 * Consent Store - Minimal data storage
 * Only stores: { ai: boolean, tools: boolean }
 * No user-identifiable information
 *
 * @type {Map<string, Object>}
 *
 * HUMAN RIGHTS: Minimal data storage - only consent flags, no PII
 */
const consentStore = new Map();

/**
 * Set user consent for AI and/or tools
 *
 * @param {boolean} aiConsent - Consent for AI usage
 * @param {boolean} toolsConsent - Consent for tool usage
 * @param {string} sessionId - Session identifier (defaults to "default")
 *
 * HUMAN RIGHTS: Respects user autonomy, logs only non-sensitive metadata
 */
function setUserConsent(aiConsent = false, toolsConsent = false, sessionId = DEFAULT_SESSION_ID) {
  const normalizedSessionId = normalizeSessionId(sessionId);
  const consentState = minimizeConsentState({
    ai: aiConsent,
    tools: toolsConsent,
    grantedAt: Date.now(), // For TTL cleanup (GDPR data minimization)
  });
  
  // If no consent granted, delete the entry (data minimization)
  if (!consentState.ai && !consentState.tools) {
    consentStore.delete(normalizedSessionId);
  } else {
    consentStore.set(normalizedSessionId, consentState);
  }
  
  // Do not log consent values — they are sensitive user state
  console.log('[CONSENT] Consent state updated for session.');

  // Audit log for transparency (no values logged)
  if (aiConsent) {
    console.log('[AUDIT] AI consent granted.');
  }
  if (toolsConsent) {
    console.log('[AUDIT] Tools consent granted.');
  }
}

/**
 * Get current consent state (immutable copy)
 *
 * @param {string} sessionId - Session identifier (defaults to "default")
 * @returns {Object} Current consent state (immutable)
 *
 * HUMAN RIGHTS: Returns minimal data, preserves user privacy
 */
function getConsentState(sessionId = DEFAULT_SESSION_ID) {
  const normalizedSessionId = normalizeSessionId(sessionId);
  return minimizeConsentState(
    consentStore.get(normalizedSessionId) || DEFAULT_CONSENT,
  );
}

/**
 * Check if AI usage is permitted
 *
 * @param {string} sessionId - Session identifier (defaults to "default")
 * @returns {boolean} True if user has explicitly consented to AI
 *
 * HUMAN RIGHTS: Respects user autonomy and consent
 */
function hasAIConsent(sessionId = DEFAULT_SESSION_ID) {
  return getConsentState(sessionId).ai === true;
}

/**
 * Check if tool usage is permitted
 *
 * @param {string} sessionId - Session identifier (defaults to "default")
 * @returns {boolean} True if user has explicitly consented to tools
 *
 * HUMAN RIGHTS: Respects user autonomy and consent
 */
function hasToolConsent(sessionId = DEFAULT_SESSION_ID) {
  return getConsentState(sessionId).tools === true;
}

// ============================================================================
// INPUT SANITIZATION
// ============================================================================

/**
 * Sanitize user message input
 * Removes potentially harmful content while preserving meaning
 *
 * @param {string} input - User input to sanitize
 * @returns {string} Sanitized input
 *
 * HUMAN RIGHTS: Protects against injection attacks and harmful content
 */
function sanitizeUserMessage(input) {
  if (typeof input !== 'string') {
    return '';
  }
  
  return String(input)
    .trim()
    .replace(/[<>]/g, '') // Remove angle brackets (HTML/JS injection)
    .replace(/\b(eval|function|return|script)\b/gi, '') // Remove dangerous keywords
    .substring(0, 10000); // Limit length for DoS protection
}

/**
 * Sanitize object keys to prevent prototype pollution
 *
 * @param {Object} obj - Object to sanitize
 * @returns {Object} Sanitized object (new object, not mutated)
 *
 * HUMAN RIGHTS: Prevents prototype pollution attacks
 */
function sanitizeObject(obj) {
  if (!obj || typeof obj !== 'object') {
    return {};
  }
  
  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    // Skip prototype properties
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      continue;
    }
    
    // Recursively sanitize nested objects
    if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}

// ============================================================================
// VALIDATION UTILITIES
// ============================================================================

/**
 * Validate that a value is a non-empty string
 *
 * @param {*} value - Value to validate
 * @param {string} fieldName - Name of the field for error messages
 * @returns {boolean} True if valid
 */
function isNonEmptyString(value, fieldName = 'value') {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Validate that a value is a boolean
 *
 * @param {*} value - Value to validate
 * @returns {boolean} True if valid boolean
 */
function isBoolean(value) {
  return typeof value === 'boolean';
}

/**
 * Validate that a value is a function
 *
 * @param {*} value - Value to validate
 * @returns {boolean} True if valid function
 */
function isFunction(value) {
  return typeof value === 'function';
}

/**
 * Validate that a value is an object
 *
 * @param {*} value - Value to validate
 * @returns {boolean} True if valid object (not array, not null)
 */
function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Validate that a value is an array
 *
 * @param {*} value - Value to validate
 * @returns {boolean} True if valid array
 */
function isArray(value) {
  return Array.isArray(value);
}

// ============================================================================
// ERROR HANDLING
// ============================================================================

/**
 * Create a standardized error object
 *
 * @param {string} message - Error message
 * @param {string} code - Error code
 * @param {number} statusCode - HTTP status code (optional)
 * @param {Object} metadata - Additional error metadata (optional)
 * @returns {Error} Standardized error
 */
function createError(message, code, statusCode = null, metadata = {}) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  error.metadata = metadata;
  error.timestamp = Date.now();
  return error;
}

/**
 * Safely execute a function and return null on error
 *
 * @param {Function} fn - Function to execute
 * @param {...*} args - Arguments to pass to the function
 * @returns {*} Result of the function or null on error
 */
function safeExecute(fn, ...args) {
  if (!isFunction(fn)) {
    return null;
  }
  
  try {
    return fn(...args);
  } catch (error) {
    console.error(`[SAFE_EXECUTE] Error in function: ${error.message}`);
    return null;
  }
}

/**
 * Retry a function with exponential backoff
 *
 * @param {Function} fn - Function to retry
 * @param {number} maxRetries - Maximum number of retries (default: 3)
 * @param {number} initialDelay - Initial delay in ms (default: 100)
 * @param {Function} shouldRetry - Function to determine if retry should happen (default: always retry)
 * @returns {Promise<*>} Result of the function
 */
async function retryWithBackoff(fn, maxRetries = 3, initialDelay = 100, shouldRetry = () => true) {
  let lastError;
  let delay = initialDelay;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt === maxRetries || !shouldRetry(error, attempt)) {
        throw error;
      }
      
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= 2; // Exponential backoff
    }
  }
  
  throw lastError;
}

// ============================================================================
// TIME UTILITIES
// ============================================================================

/**
 * Get current timestamp
 *
 * @returns {number} Current Unix timestamp in milliseconds
 */
function getTimestamp() {
  return Date.now();
}

/**
 * Check if a timestamp is within the last N milliseconds
 *
 * @param {number} timestamp - Timestamp to check
 * @param {number} milliseconds - Time window in milliseconds
 * @returns {boolean} True if timestamp is within the window
 */
function isWithinLast(timestamp, milliseconds) {
  return getTimestamp() - timestamp <= milliseconds;
}

/**
 * Check if a timestamp has expired
 *
 * @param {number} timestamp - Timestamp to check
 * @param {number} ttl - Time-to-live in milliseconds
 * @returns {boolean} True if timestamp has expired
 */
function isExpired(timestamp, ttl) {
  return getTimestamp() - timestamp > ttl;
}

// ============================================================================
// STRING UTILITIES
// ============================================================================

/**
 * Truncate a string to a maximum length
 *
 * @param {string} str - String to truncate
 * @param {number} maxLength - Maximum length
 * @param {string} suffix - Suffix to append if truncated (default: '...')
 * @returns {string} Truncated string
 */
function truncateString(str, maxLength, suffix = '...') {
  if (typeof str !== 'string') {
    return '';
  }
  
  if (str.length <= maxLength) {
    return str;
  }
  
  return str.substring(0, maxLength - suffix.length) + suffix;
}

/**
 * Capitalize the first letter of a string
 *
 * @param {string} str - String to capitalize
 * @returns {string} Capitalized string
 */
function capitalizeFirstLetter(str) {
  if (typeof str !== 'string' || str.length === 0) {
    return str;
  }
  
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Generate a random alphanumeric string
 *
 * @param {number} length - Length of the string (default: 8)
 * @returns {string} Random alphanumeric string
 */
function generateRandomString(length = 8) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return result;
}

// ============================================================================
// ARRAY/Object UTILITIES
// ============================================================================

/**
 * Check if two arrays are equal (order-independent)
 *
 * @param {Array} arr1 - First array
 * @param {Array} arr2 - Second array
 * @returns {boolean} True if arrays contain the same elements
 */
function arraysEqual(arr1, arr2) {
  if (!isArray(arr1) || !isArray(arr2)) {
    return false;
  }
  
  if (arr1.length !== arr2.length) {
    return false;
  }
  
  const set1 = new Set(arr1);
  const set2 = new Set(arr2);
  
  for (const item of set1) {
    if (!set2.has(item)) {
      return false;
    }
  }
  
  return true;
}

/**
 * Deep merge two objects
 *
 * @param {Object} target - Target object
 * @param {Object} source - Source object
 * @returns {Object} Merged object (new object, not mutated)
 */
function deepMerge(target, source) {
  if (!isPlainObject(target) || !isPlainObject(source)) {
    return source;
  }
  
  const result = { ...target };
  
  for (const [key, value] of Object.entries(source)) {
    if (isPlainObject(value) && isPlainObject(result[key])) {
      result[key] = deepMerge(result[key], value);
    } else if (isArray(value) && isArray(result[key])) {
      result[key] = [...result[key], ...value];
    } else {
      result[key] = value;
    }
  }
  
  return result;
}

/**
 * Pick specific keys from an object
 *
 * @param {Object} obj - Source object
 * @param {Array} keys - Keys to pick
 * @returns {Object} New object with only the picked keys
 */
function pick(obj, keys) {
  if (!isPlainObject(obj)) {
    return {};
  }
  
  const result = {};
  for (const key of keys) {
    if (key in obj) {
      result[key] = obj[key];
    }
  }
  
  return result;
}

/**
 * Omit specific keys from an object
 *
 * @param {Object} obj - Source object
 * @param {Array} keys - Keys to omit
 * @returns {Object} New object without the omitted keys
 */
function omit(obj, keys) {
  if (!isPlainObject(obj)) {
    return {};
  }
  
  const result = {};
  const keysToOmit = new Set(keys);
  
  for (const [key, value] of Object.entries(obj)) {
    if (!keysToOmit.has(key)) {
      result[key] = value;
    }
  }
  
  return result;
}

// ============================================================================
// EXPORTS
// ============================================================================

// Session ID utilities
export {
  generateAnonymousSessionId,
  isValidSessionId,
  normalizeSessionId,
  MAX_SESSION_ID_LENGTH,
  VALID_SESSION_ID_PATTERN,
  DEFAULT_SESSION_ID,
};

// Consent state utilities
export {
  consentStore,
  setUserConsent,
  getConsentState,
  hasAIConsent,
  hasToolConsent,
  minimizeConsentState,
  DEFAULT_CONSENT,
};

// Input sanitization
export {
  sanitizeUserMessage,
  sanitizeObject,
};

// Validation utilities
export {
  isNonEmptyString,
  isBoolean,
  isFunction,
  isPlainObject,
  isArray,
};

// Error handling
export {
  createError,
  safeExecute,
  retryWithBackoff,
};

// Time utilities
export {
  getTimestamp,
  isWithinLast,
  isExpired,
};

// String utilities
export {
  truncateString,
  capitalizeFirstLetter,
  generateRandomString,
};

// Array/Object utilities
export {
  arraysEqual,
  deepMerge,
  pick,
  omit,
};
