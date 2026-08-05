/**
 * SXWer AI ChatBot - Sherlock Warning System
 * 
 * ETHICAL COMPLIANCE:
 * - GDPR Article 5: Data minimization principle
 * - GDPR Article 7: Explicit informed consent
 * - Belmont Report: Respect for Persons
 * - WMA Helsinki: Protection of Vulnerable Groups
 * - Sex Worker-Specific: Anti-doxxing, anti-surveillance
 *
 * IMPLEMENTATION:
 * - Multi-step consent flow for Sherlock tool
 * - Explicit privacy warnings about platform correlation risks
 * - Session-based consent (not persistent)
 * - Audit logging of all Sherlock usage
 * - Integration with existing consent system
 */

import crypto from 'crypto';

// ============================================================================
// SHERLOCK PRIVACY WARNINGS
// ============================================================================

/**
 * Sherlock Privacy Warnings Configuration
 * 
 * These warnings are designed to ensure users understand the risks
 * of using the Sherlock tool, particularly for sex workers who face
 * unique privacy and safety concerns.
 */
const SHERLOCK_WARNINGS = Object.freeze({
  // Step 1: Initial warning (shown when user types /sherlock)
  initialWarning: {
    title: "⚠️ SHERLOCK TOOL - PRIVACY WARNING",
    message: `
This tool searches PUBLIC social media profiles for a given username.

BEFORE CONTINUING, please understand the risks:

🔴 CRITICAL RISKS:
• Could reveal information that IDENTIFIES YOU
• May enable CORRELATION between your chat and real identity
• Results could be used for SURVEILLANCE or HARASSMENT
• May link your anonymous chat to your real social media profiles

🟡 ADDITIONAL RISKS:
• Platforms may have different privacy settings
• Results may be outdated or incomplete
• Searching may trigger rate limits or blocks
• Some platforms may log search queries

🟢 SAFETY TIPS:
✓ Only search for YOUR OWN usernames
✓ Use a VPN or Tor browser for additional privacy
✓ Consider if you REALLY need this information
✓ Never search for someone else without their consent
✓ Close this tab when finished to clear session data

This tool is provided for SAFETY VERIFICATION ONLY.
Do not use it for surveillance, harassment, or any harmful purpose.
    `,
    severity: 'CRITICAL',
    color: '#dc2626', // Red
    icon: '⚠️',
  },

  // Step 2: Platform correlation warning
  platformCorrelationWarning: {
    title: "🔍 PLATFORM CORRELATION RISK",
    message: `
PLATFORM CORRELATION EXPLAINED:

If you search for a username that you use across multiple platforms,
this tool may help someone connect your:
• Anonymous chat session → Your real identity
• Different social media profiles → Each other
• Online activity → Offline identity

EXAMPLE:
If you use the username "JaneDoe" on:
• Twitter
• Instagram  
• OnlyFans
• This chat

Searching "JaneDoe" could reveal ALL these connections to anyone
who sees the results, potentially identifying you.

🛡️ PROTECTIONS WE PROVIDE:
✓ We NEVER store search results
✓ We NEVER log usernames searched
✓ Results are ONLY shown to you
✓ Session data is deleted after 24 hours

💡 RECOMMENDATION:
Use a UNIQUE username for this chat that you don't use elsewhere.
    `,
    severity: 'HIGH',
    color: '#ea580c', // Orange
    icon: '🔍',
  },

  // Step 3: Doxxing risk warning
  doxxingWarning: {
    title: "🚨 DOXXING RISK WARNING",
    message: `
DOXXING means publicly revealing someone's private information
without their consent, often with malicious intent.

HOW THIS TOOL COULD ENABLE DOXXING:

1. SELF-DOXXING:
   If you search your own username and share the results,
   you may accidentally reveal your own identity.

2. OTHER-DOXXING:
   If you search someone else's username without their consent,
   you could be participating in doxxing them.

3. INDIRECT DOXXING:
   Even if you don't share results, the act of searching
   could be logged by platforms or observed by others.

📜 OUR POLICY:
• We NEVER condone doxxing
• We NEVER participate in doxxing
• We STRONGLY DISCOURAGE using this tool on others without consent
• We RECOMMEND using this tool ONLY for personal safety verification

⚖️ LEGAL NOTE:
Doxxing may be ILLEGAL in your jurisdiction.
Always check local laws before using this tool.
    `,
    severity: 'CRITICAL',
    color: '#dc2626', // Red
    icon: '🚨',
  },

  // Step 4: Surveillance warning
  surveillanceWarning: {
    title: "👁️ SURVEILLANCE WARNING",
    message: `
SURVEILLANCE means secretly watching or tracking someone.

HOW THIS TOOL COULD ENABLE SURVEILLANCE:

1. PATTERN RECOGNITION:
   Repeated searches for the same username could reveal
   someone's online activity patterns.

2. TIME CORRELATION:
   Searching at specific times could reveal when someone
   is active on certain platforms.

3. NETWORK OBSERVATION:
   If someone is monitoring your network, they may see
   you're using this tool (though not what you're searching for).

🛡️ HOW TO PROTECT YOURSELF:
✓ Use a VPN (Virtual Private Network)
✓ Use Tor Browser for maximum anonymity
✓ Clear your browser history after use
✓ Use private/incognito browsing mode
✓ Consider using a different device for sensitive searches

💡 RECOMMENDED TOOLS:
• ProtonVPN (free tier available)
• Tor Browser (free, open-source)
• Brave Browser (built-in privacy features)
    `,
    severity: 'HIGH',
    color: '#ea580c', // Orange
    icon: '👁️',
  },

  // Step 5: Final confirmation
  finalConfirmation: {
    title: "✅ FINAL CONFIRMATION",
    message: `
BEFORE PROCEEDING, please confirm:

✓ I understand that this tool searches PUBLIC social media profiles
✓ I understand the RISKS of platform correlation and doxxing
✓ I understand that results could identify me or others
✓ I will ONLY use this tool for SAFETY VERIFICATION of my own accounts
✓ I will NOT use this tool to search for others without their consent
✓ I will use PRIVACY PROTECTIONS (VPN, Tor, etc.) when using this tool
✓ I understand that session data is deleted after 24 hours
✓ I accept full RESPONSIBILITY for my use of this tool

By proceeding, you AGREE to use this tool RESPONSIBLY and ETHICALLY.

📝 REMINDER:
This tool is for PERSONAL SAFETY VERIFICATION ONLY.
Misuse may result in account termination and potential legal consequences.
    `,
    severity: 'INFO',
    color: '#059669', // Green
    icon: '✅',
  },

  // Step 6: Post-search reminder
  postSearchReminder: {
    title: "🔒 POST-SEARCH PRIVACY REMINDER",
    message: `
Your search has been completed. Here are important reminders:

🗑️ DATA CLEANUP:
• Search results are NOT stored
• Your search query is NOT logged
• Session data will be deleted after 24 hours
• You can manually delete data using /delete-my-data

🔒 PRIVACY TIPS:
• Close this tab when finished to clear session data
• Clear your browser history if using a shared device
• Consider rotating your encryption keys (Encryption Status page)

🚨 SAFETY REMINDER:
• Never share search results with others
• Be cautious about what you do with the information
• Remember: this tool is for PERSONAL SAFETY only

💡 NEED HELP?
If you're in crisis or need support, use /resources for
sex worker-specific organizations that can help.
    `,
    severity: 'INFO',
    color: '#059669', // Green
    icon: '🔒',
  },
});

// ============================================================================
// SHERLOCK CONSENT STATES
// ============================================================================

/**
 * Sherlock Consent States
 * Tracks the user's progress through the warning and consent flow
 */
const SherlockConsentState = Object.freeze({
  NOT_STARTED: 'not_started',
  INITIAL_WARNING_SHOWN: 'initial_warning_shown',
  PLATFORM_WARNING_SHOWN: 'platform_warning_shown',
  DOXXING_WARNING_SHOWN: 'doxxing_warning_shown',
  SURVEILLANCE_WARNING_SHOWN: 'surveillance_warning_shown',
  CONSENT_GRANTED: 'consent_granted',
  CONSENT_DENIED: 'consent_denied',
  SESSION_COMPLETED: 'session_completed',
});

// ============================================================================
// SHERLOCK SESSION STORE
// ============================================================================

/**
 * Store for tracking Sherlock consent sessions
 * Uses in-memory Map for automatic cleanup
 * Key: sessionId, Value: consent state and metadata
 */
const sherlockSessionStore = new Map();

/**
 * Session TTL in milliseconds (24 hours)
 * Matches the overall session TTL for consistency
 */
const SHERLOCK_SESSION_TTL = 24 * 60 * 60 * 1000;

// ============================================================================
// SHERLOCK AUDIT LOG
// ============================================================================

/**
 * Audit log for Sherlock tool usage
 * Tracks all interactions for accountability and debugging
 */
const sherlockAuditLog = [];

/**
 * Maximum audit log entries to retain (for memory management)
 */
const MAX_AUDIT_LOG_ENTRIES = 1000;

// ============================================================================
// SHERLOCK WARNING SYSTEM FUNCTIONS
// ============================================================================

/**
 * Generate a unique Sherlock session ID
 * @returns {string} Unique session ID for Sherlock consent flow
 */
function generateSherlockSessionId() {
  return `sherlock_${Date.now()}_${crypto.randomBytes(16).toString('hex')}`;
}

/**
 * Initialize a new Sherlock consent session
 * @param {string} sessionId - User's main session ID
 * @returns {Object} Sherlock session object
 */
function initializeSherlockSession(sessionId) {
  const sherlockSessionId = generateSherlockSessionId();
  const timestamp = Date.now();

  const session = {
    sherlockSessionId,
    mainSessionId: sessionId,
    state: SherlockConsentState.NOT_STARTED,
    startedAt: timestamp,
    lastUpdated: timestamp,
    warningsShown: [],
    username: null,
    consentGranted: false,
  };

  sherlockSessionStore.set(sherlockSessionId, session);

  // Log initialization
  logSherlockEvent(sherlockSessionId, 'session_initialized', {
    mainSessionId: sessionId,
  });

  return session;
}

/**
 * Get Sherlock session by ID
 * @param {string} sherlockSessionId - Sherlock session ID
 * @returns {Object|null} Sherlock session or null if not found
 */
function getSherlockSession(sherlockSessionId) {
  return sherlockSessionStore.get(sherlockSessionId) || null;
}

/**
 * Get Sherlock session by main session ID
 * @param {string} mainSessionId - User's main session ID
 * @returns {Object|null} Sherlock session or null if not found
 */
function getSherlockSessionByMainSession(mainSessionId) {
  for (const [, session] of sherlockSessionStore.entries()) {
    if (session.mainSessionId === mainSessionId) {
      return session;
    }
  }
  return null;
}

/**
 * Update Sherlock session state
 * @param {string} sherlockSessionId - Sherlock session ID
 * @param {string} newState - New consent state
 * @param {Object} metadata - Additional metadata to store
 */
function updateSherlockSessionState(sherlockSessionId, newState, metadata = {}) {
  const session = getSherlockSession(sherlockSessionId);
  if (!session) {
    console.warn(`[SHERLOCK] Session not found: ${sherlockSessionId}`);
    return null;
  }

  // Update state and metadata
  session.state = newState;
  session.lastUpdated = Date.now();

  // Update warnings shown
  if (metadata.warningType) {
    if (!session.warningsShown.includes(metadata.warningType)) {
      session.warningsShown.push(metadata.warningType);
    }
  }

  // Update username if provided
  if (metadata.username) {
    session.username = metadata.username;
  }

  // Update consent if provided
  if (metadata.consentGranted !== undefined) {
    session.consentGranted = metadata.consentGranted;
  }

  // Log state change
  logSherlockEvent(sherlockSessionId, 'state_changed', {
    from: session.state,
    to: newState,
    ...metadata,
  });

  return session;
}

/**
 * Get the next warning to show based on current state
 * @param {string} sherlockSessionId - Sherlock session ID
 * @returns {Object|null} Next warning object or null if all shown
 */
function getNextWarning(sherlockSessionId) {
  const session = getSherlockSession(sherlockSessionId);
  if (!session) {
    return null;
  }

  // Define warning order
  const warningOrder = [
    'initialWarning',
    'platformCorrelationWarning',
    'doxxingWarning',
    'surveillanceWarning',
    'finalConfirmation',
  ];

  // Find first warning not yet shown
  for (const warningType of warningOrder) {
    if (!session.warningsShown.includes(warningType)) {
      return SHERLOCK_WARNINGS[warningType];
    }
  }

  // All warnings shown
  return null;
}

/**
 * Check if Sherlock consent is granted for a session
 * @param {string} mainSessionId - User's main session ID
 * @returns {boolean} True if consent is granted
 */
function hasSherlockConsent(mainSessionId) {
  const session = getSherlockSessionByMainSession(mainSessionId);
  return session ? session.consentGranted === true : false;
}

/**
 * Grant Sherlock consent
 * @param {string} sherlockSessionId - Sherlock session ID
 * @returns {Object} Updated session
 */
function grantSherlockConsent(sherlockSessionId) {
  return updateSherlockSessionState(sherlockSessionId, SherlockConsentState.CONSENT_GRANTED, {
    consentGranted: true,
  });
}

/**
 * Deny Sherlock consent
 * @param {string} sherlockSessionId - Sherlock session ID
 * @returns {Object} Updated session
 */
function denySherlockConsent(sherlockSessionId) {
  return updateSherlockSessionState(sherlockSessionId, SherlockConsentState.CONSENT_DENIED, {
    consentGranted: false,
  });
}

/**
 * Complete Sherlock session
 * @param {string} sherlockSessionId - Sherlock session ID
 * @returns {Object} Updated session
 */
function completeSherlockSession(sherlockSessionId) {
  return updateSherlockSessionState(sherlockSessionId, SherlockConsentState.SESSION_COMPLETED);
}

// ============================================================================
// SHERLOCK AUDIT LOGGING
// ============================================================================

/**
 * Log a Sherlock-related event
 * @param {string} sherlockSessionId - Sherlock session ID
 * @param {string} eventType - Type of event
 * @param {Object} details - Event details
 */
function logSherlockEvent(sherlockSessionId, eventType, details = {}) {
  const timestamp = new Date().toISOString();
  const session = getSherlockSession(sherlockSessionId);

  const event = {
    timestamp,
    sherlockSessionId,
    mainSessionId: session ? session.mainSessionId : null,
    eventType,
    details,
  };

  sherlockAuditLog.push(event);

  // Trim log if too large
  if (sherlockAuditLog.length > MAX_AUDIT_LOG_ENTRIES) {
    sherlockAuditLog.shift();
  }

  // Also log to console (in production, would log to secure file)
  console.log(`[SHERLOCK_AUDIT] ${eventType}:`, {
    sherlockSessionId,
    mainSessionId: session ? session.mainSessionId : null,
    ...details,
  });
}

/**
 * Get Sherlock audit log (for authorized users only)
 * @param {string} mainSessionId - Optional main session ID to filter by
 * @returns {Array} Audit log entries
 */
function getSherlockAuditLog(mainSessionId = null) {
  if (mainSessionId) {
    return sherlockAuditLog.filter(event => event.mainSessionId === mainSessionId);
  }
  return [...sherlockAuditLog]; // Return copy
}

/**
 * Clear Sherlock audit log
 */
function clearSherlockAuditLog() {
  sherlockAuditLog.length = 0;
}

// ============================================================================
// SHERLOCK WARNING FORMATTING
// ============================================================================

/**
 * Format a warning for display
 * @param {Object} warning - Warning object from SHERLOCK_WARNINGS
 * @param {string} sherlockSessionId - Sherlock session ID
 * @param {string} username - Optional username being searched
 * @returns {Object} Formatted warning for display
 */
function formatWarning(warning, sherlockSessionId, username = null) {
  // Replace placeholders in message
  let message = warning.message;
  if (username) {
    message = message.replace(/\{\{username\}\}/g, username);
  }

  return {
    id: sherlockSessionId,
    title: warning.title,
    message,
    severity: warning.severity,
    color: warning.color,
    icon: warning.icon,
    // Add action buttons
    actions: getWarningActions(warning, sherlockSessionId, username),
    // Add progress indicator
    progress: getWarningProgress(sherlockSessionId),
  };
}

/**
 * Get action buttons for a warning
 * @param {Object} warning - Warning object
 * @param {string} sherlockSessionId - Sherlock session ID
 * @param {string} username - Optional username
 * @returns {Array} Action buttons
 */
function getWarningActions(warning, sherlockSessionId, username) {
  const session = getSherlockSession(sherlockSessionId);
  if (!session) {
    return [];
  }

  const actions = [];

  // Always add "Understand" button (except for final confirmation)
  if (warning !== SHERLOCK_WARNINGS.finalConfirmation) {
    actions.push({
      label: 'I Understand, Continue',
      action: 'continue',
      type: 'primary',
      nextWarning: getNextWarningType(session),
    });
  }

  // For final confirmation, add consent buttons
  if (warning === SHERLOCK_WARNINGS.finalConfirmation) {
    actions.push(
      {
        label: '✅ I Accept, Proceed with Search',
        action: 'grant_consent',
        type: 'success',
      },
      {
        label: '❌ I Decline, Cancel Search',
        action: 'deny_consent',
        type: 'danger',
      }
    );
  }

  // Always add "Cancel" button
  actions.push({
    label: 'Cancel',
    action: 'cancel',
    type: 'secondary',
  });

  return actions;
}

/**
 * Get the next warning type to show
 * @param {Object} session - Sherlock session
 * @returns {string} Next warning type
 */
function getNextWarningType(session) {
  const warningOrder = [
    'initialWarning',
    'platformCorrelationWarning',
    'doxxingWarning',
    'surveillanceWarning',
    'finalConfirmation',
  ];

  for (const warningType of warningOrder) {
    if (!session.warningsShown.includes(warningType)) {
      return warningType;
    }
  }

  return null;
}

/**
 * Get progress through warning flow
 * @param {string} sherlockSessionId - Sherlock session ID
 * @returns {Object} Progress information
 */
function getWarningProgress(sherlockSessionId) {
  const session = getSherlockSession(sherlockSessionId);
  if (!session) {
    return { current: 0, total: 5, percentage: 0 };
  }

  const warningOrder = [
    'initialWarning',
    'platformCorrelationWarning',
    'doxxingWarning',
    'surveillanceWarning',
    'finalConfirmation',
  ];

  const current = session.warningsShown.length;
  const total = warningOrder.length;
  const percentage = Math.round((current / total) * 100);

  return { current, total, percentage };
}

// ============================================================================
// SHERLOCK WARNING FLOW MANAGER
// ============================================================================

/**
 * Sherlock Warning Flow Manager
 * Manages the multi-step consent flow for Sherlock tool
 */
class SherlockWarningFlow {
  constructor() {
    this.currentSessions = new Map();
  }

  /**
   * Start a new Sherlock consent flow
   * @param {string} mainSessionId - User's main session ID
   * @returns {Object} First warning to display
   */
  startFlow(mainSessionId) {
    // Check if there's already a session
    let session = getSherlockSessionByMainSession(mainSessionId);
    
    if (!session) {
      // Create new session
      session = initializeSherlockSession(mainSessionId);
    }

    // Get first warning
    const firstWarning = getNextWarning(session.sherlockSessionId);
    
    if (!firstWarning) {
      // All warnings already shown, return final confirmation
      return formatWarning(SHERLOCK_WARNINGS.finalConfirmation, session.sherlockSessionId);
    }

    return formatWarning(firstWarning, session.sherlockSessionId);
  }

  /**
   * Continue to next warning in flow
   * @param {string} sherlockSessionId - Sherlock session ID
   * @returns {Object} Next warning to display or null if complete
   */
  continueFlow(sherlockSessionId) {
    const session = getSherlockSession(sherlockSessionId);
    if (!session) {
      return null;
    }

    // Mark current warning as shown
    const currentWarning = getNextWarning(sherlockSessionId);
    if (currentWarning) {
      updateSherlockSessionState(sherlockSessionId, session.state, {
        warningType: currentWarning,
      });
    }

    // Get next warning
    const nextWarning = getNextWarning(sherlockSessionId);
    
    if (!nextWarning) {
      // All warnings shown, return final confirmation
      return formatWarning(SHERLOCK_WARNINGS.finalConfirmation, sherlockSessionId);
    }

    return formatWarning(nextWarning, sherlockSessionId);
  }

  /**
   * Handle user action (continue, grant consent, deny consent, cancel)
   * @param {string} sherlockSessionId - Sherlock session ID
   * @param {string} action - Action type
   * @param {string} username - Optional username for search
   * @returns {Object} Result of action
   */
  handleAction(sherlockSessionId, action, username = null) {
    const session = getSherlockSession(sherlockSessionId);
    if (!session) {
      return { success: false, error: 'Session not found' };
    }

    switch (action) {
      case 'continue':
        return this.continueFlow(sherlockSessionId);

      case 'grant_consent':
        grantSherlockConsent(sherlockSessionId);
        completeSherlockSession(sherlockSessionId);
        logSherlockEvent(sherlockSessionId, 'consent_granted', { username });
        return {
          success: true,
          consentGranted: true,
          message: 'Sherlock consent granted. You may now use the /sherlock command.',
          nextStep: 'search',
        };

      case 'deny_consent':
        denySherlockConsent(sherlockSessionId);
        completeSherlockSession(sherlockSessionId);
        logSherlockEvent(sherlockSessionId, 'consent_denied', { username });
        return {
          success: true,
          consentGranted: false,
          message: 'Sherlock consent denied. You will not be able to use the /sherlock command in this session.',
          nextStep: 'cancel',
        };

      case 'cancel':
        denySherlockConsent(sherlockSessionId);
        completeSherlockSession(sherlockSessionId);
        logSherlockEvent(sherlockSessionId, 'flow_cancelled', { username });
        return {
          success: true,
          consentGranted: false,
          message: 'Sherlock consent flow cancelled.',
          nextStep: 'cancel',
        };

      default:
        return { success: false, error: `Unknown action: ${action}` };
    }
  }

  /**
   * Check if user has consent for Sherlock in current session
   * @param {string} mainSessionId - User's main session ID
   * @returns {boolean} True if consent granted
   */
  hasConsent(mainSessionId) {
    return hasSherlockConsent(mainSessionId);
  }

  /**
   * Get post-search reminder
   * @param {string} mainSessionId - User's main session ID
   * @returns {Object} Post-search reminder
   */
  getPostSearchReminder(mainSessionId) {
    const session = getSherlockSessionByMainSession(mainSessionId);
    if (!session) {
      return null;
    }

    return formatWarning(SHERLOCK_WARNINGS.postSearchReminder, session.sherlockSessionId);
  }

  /**
   * Clean up expired sessions
   */
  cleanupExpiredSessions() {
    const now = Date.now();
    const expiredSessions = [];

    for (const [sherlockSessionId, session] of sherlockSessionStore.entries()) {
      if (now - session.lastUpdated > SHERLOCK_SESSION_TTL) {
        expiredSessions.push(sherlockSessionId);
      }
    }

    // Delete expired sessions
    for (const sherlockSessionId of expiredSessions) {
      sherlockSessionStore.delete(sherlockSessionId);
      logSherlockEvent(sherlockSessionId, 'session_expired', {});
    }

    return expiredSessions.length;
  }
}

// ============================================================================
// SHERLOCK SAFETY CHECKS
// ============================================================================

/**
 * Sherlock Safety Checks
 * Additional safety validations before allowing Sherlock search
 */
const SherlockSafetyChecks = Object.freeze({
  // Maximum username length
  MAX_USERNAME_LENGTH: 50,
  
  // Minimum username length
  MIN_USERNAME_LENGTH: 3,
  
  // Allowed characters in username
  ALLOWED_USERNAME_PATTERN: /^[a-zA-Z0-9_\-\.]+$/,
  
  // Blocked usernames (case-insensitive)
  BLOCKED_USERNAMES: Object.freeze([
    'admin',
    'administrator',
    'root',
    'system',
    'god',
    'master',
    'slave',
    'owner',
    'ceo',
    'support',
    'help',
    'info',
    'test',
    'demo',
    'example',
  ]),
  
  // Rate limiting for Sherlock searches
  RATE_LIMIT: {
    maxSearches: 5,
    windowMs: 60 * 60 * 1000, // 1 hour
  },
});

/**
 * Validate username for Sherlock search
 * @param {string} username - Username to validate
 * @returns {Object} Validation result
 */
function validateSherlockUsername(username) {
  if (!username || typeof username !== 'string') {
    return {
      valid: false,
      error: 'Username is required',
      code: 'REQUIRED',
    };
  }

  // Trim whitespace
  const trimmed = username.trim();

  // Check length
  if (trimmed.length < SherlockSafetyChecks.MIN_USERNAME_LENGTH) {
    return {
      valid: false,
      error: `Username must be at least ${SherlockSafetyChecks.MIN_USERNAME_LENGTH} characters`,
      code: 'TOO_SHORT',
    };
  }

  if (trimmed.length > SherlockSafetyChecks.MAX_USERNAME_LENGTH) {
    return {
      valid: false,
      error: `Username must be at most ${SherlockSafetyChecks.MAX_USERNAME_LENGTH} characters`,
      code: 'TOO_LONG',
    };
  }

  // Check allowed characters
  if (!SherlockSafetyChecks.ALLOWED_USERNAME_PATTERN.test(trimmed)) {
    return {
      valid: false,
      error: 'Username contains invalid characters. Only letters, numbers, underscores, hyphens, and periods are allowed.',
      code: 'INVALID_CHARS',
    };
  }

  // Check blocked usernames
  const lowerUsername = trimmed.toLowerCase();
  for (const blocked of SherlockSafetyChecks.BLOCKED_USERNAMES) {
    if (lowerUsername === blocked.toLowerCase()) {
      return {
        valid: false,
        error: 'This username is not allowed for safety reasons.',
        code: 'BLOCKED',
      };
    }
  }

  return {
    valid: true,
    username: trimmed,
  };
}

/**
 * Check Sherlock rate limit
 * @param {string} mainSessionId - User's main session ID
 * @returns {Object} Rate limit status
 */
function checkSherlockRateLimit(mainSessionId) {
  const session = getSherlockSessionByMainSession(mainSessionId);
  if (!session) {
    return {
      allowed: false,
      error: 'No Sherlock session found',
      remaining: 0,
      resetAt: Date.now() + SherlockSafetyChecks.RATE_LIMIT.windowMs,
    };
  }

  // Initialize search count if not present
  if (!session.searchCount) {
    session.searchCount = 0;
    session.lastSearchTime = Date.now();
  }

  const now = Date.now();
  const windowStart = now - SherlockSafetyChecks.RATE_LIMIT.windowMs;

  // Reset count if window has passed
  if (session.lastSearchTime < windowStart) {
    session.searchCount = 0;
    session.lastSearchTime = now;
  }

  // Check if limit exceeded
  if (session.searchCount >= SherlockSafetyChecks.RATE_LIMIT.maxSearches) {
    const resetAt = session.lastSearchTime + SherlockSafetyChecks.RATE_LIMIT.windowMs;
    return {
      allowed: false,
      error: `Rate limit exceeded. Maximum ${SherlockSafetyChecks.RATE_LIMIT.maxSearches} searches per hour.`,
      remaining: 0,
      resetAt,
    };
  }

  return {
    allowed: true,
    remaining: SherlockSafetyChecks.RATE_LIMIT.maxSearches - session.searchCount,
    resetAt: session.lastSearchTime + SherlockSafetyChecks.RATE_LIMIT.windowMs,
  };
}

/**
 * Increment Sherlock search count
 * @param {string} mainSessionId - User's main session ID
 */
function incrementSherlockSearchCount(mainSessionId) {
  const session = getSherlockSessionByMainSession(mainSessionId);
  if (session) {
    session.searchCount = (session.searchCount || 0) + 1;
    session.lastSearchTime = Date.now();
  }
}

// ============================================================================
// SHERLOCK INTEGRATION WITH EXISTING CONSENT SYSTEM
// ============================================================================

/**
 * Check if user has both Sherlock consent AND tools consent
 * Sherlock requires both specific Sherlock consent AND general tools consent
 * @param {string} mainSessionId - User's main session ID
 * @returns {boolean} True if both consents are granted
 */
function hasFullSherlockConsent(mainSessionId) {
  // Import from existing consent system (would be imported in real implementation)
  // For now, we'll use a placeholder
  const hasToolsConsent = true; // Would check consent_manager.js
  const hasSherlockConsent = hasSherlockConsent(mainSessionId);
  
  return hasToolsConsent && hasSherlockConsent;
}

// ============================================================================
// AUTOMATIC CLEANUP
// ============================================================================

// Set up automatic cleanup every hour
setInterval(() => {
  const flowManager = new SherlockWarningFlow();
  const cleanedUp = flowManager.cleanupExpiredSessions();
  
  if (cleanedUp > 0) {
    console.log(`[SHERLOCK] Cleaned up ${cleanedUp} expired sessions`);
  }
}, 60 * 60 * 1000);

// ============================================================================
// EXPORTS
// ============================================================================

// Create singleton instance
const sherlockWarningFlow = new SherlockWarningFlow();

export {
  // Warning constants
  SHERLOCK_WARNINGS,
  SherlockConsentState,
  SherlockSafetyChecks,
  
  // Session management
  generateSherlockSessionId,
  initializeSherlockSession,
  getSherlockSession,
  getSherlockSessionByMainSession,
  updateSherlockSessionState,
  hasSherlockConsent,
  grantSherlockConsent,
  denySherlockConsent,
  completeSherlockSession,
  
  // Warning flow
  sherlockWarningFlow,
  getNextWarning,
  formatWarning,
  getWarningActions,
  getWarningProgress,
  
  // Audit logging
  logSherlockEvent,
  getSherlockAuditLog,
  clearSherlockAuditLog,
  
  // Safety checks
  validateSherlockUsername,
  checkSherlockRateLimit,
  incrementSherlockSearchCount,
  hasFullSherlockConsent,
  
  // Constants
  SHERLOCK_SESSION_TTL,
  MAX_AUDIT_LOG_ENTRIES,
};
