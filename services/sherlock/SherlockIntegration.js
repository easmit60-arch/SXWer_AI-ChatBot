/**
 * SXWer AI ChatBot - Sherlock Integration
 * 
 * ETHICAL COMPLIANCE:
 * - Integrates SherlockWarningSystem with existing chatbot
 * - Enforces multi-step consent flow before Sherlock usage
 * - Provides safe, responsible access to Sherlock tool
 * - Maintains audit trail for accountability
 *
 * DEPENDENCIES:
 * - SherlockWarningSystem.js
 * - consent_manager.js
 * - chatbot.js
 */

import {
  sherlockWarningFlow,
  hasSherlockConsent,
  hasFullSherlockConsent,
  validateSherlockUsername,
  checkSherlockRateLimit,
  incrementSherlockSearchCount,
  getSherlockAuditLog,
  clearSherlockAuditLog,
} from './SherlockWarningSystem.js';

// ============================================================================
// SHERLOCK COMMAND HANDLER
// ============================================================================

/**
 * Sherlock Command State
 * Tracks the state of Sherlock command processing
 */
const SherlockCommandState = Object.freeze({
  IDLE: 'idle',
  WAITING_FOR_CONSENT: 'waiting_for_consent',
  WAITING_FOR_USERNAME: 'waiting_for_username',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  ERROR: 'error',
});

/**
 * Store for tracking Sherlock command state per session
 */
const sherlockCommandStateStore = new Map();

/**
 * Get Sherlock command state for a session
 * @param {string} sessionId - User session ID
 * @returns {Object} Command state
 */
function getSherlockCommandState(sessionId) {
  return sherlockCommandStateStore.get(sessionId) || {
    state: SherlockCommandState.IDLE,
    warningSessionId: null,
    username: null,
    error: null,
  };
}

/**
 * Set Sherlock command state for a session
 * @param {string} sessionId - User session ID
 * @param {Object} state - New state
 */
function setSherlockCommandState(sessionId, state) {
  sherlockCommandStateStore.set(sessionId, state);
}

/**
 * Clear Sherlock command state for a session
 * @param {string} sessionId - User session ID
 */
function clearSherlockCommandState(sessionId) {
  sherlockCommandStateStore.delete(sessionId);
}

// ============================================================================
// SHERLOCK COMMAND PROCESSOR
// ============================================================================

/**
 * Process Sherlock command
 * @param {string} input - User input (e.g., "/sherlock username")
 * @param {string} sessionId - User session ID
 * @param {Object} consentState - Current consent state
 * @returns {Object} Response object
 */
function processSherlockCommand(input, sessionId, consentState = {}) {
  // Extract username from command
  const match = input.match(/^\/sherlock\s+(.+)$/i);
  const username = match ? match[1].trim() : null;

  // Get current command state
  const currentState = getSherlockCommandState(sessionId);

  // Handle different states
  switch (currentState.state) {
    case SherlockCommandState.IDLE:
      return handleIdleState(input, sessionId, username, consentState);

    case SherlockCommandState.WAITING_FOR_CONSENT:
      return handleWaitingForConsentState(input, sessionId, currentState);

    case SherlockCommandState.WAITING_FOR_USERNAME:
      return handleWaitingForUsernameState(input, sessionId, username);

    case SherlockCommandState.PROCESSING:
      return {
        response: "⏳ Please wait, your search is processing...",
        nextState: SherlockCommandState.PROCESSING,
      };

    case SherlockCommandState.COMPLETED:
      return {
        response: "✅ Your previous Sherlock search is complete. Type /sherlock [username] to start a new search.",
        nextState: SherlockCommandState.IDLE,
      };

    case SherlockCommandState.ERROR:
      return {
        response: `❌ Error: ${currentState.error}\n\nType /sherlock [username] to start over.`,
        nextState: SherlockCommandState.IDLE,
      };

    default:
      return {
        response: "❌ Invalid Sherlock command state. Type /sherlock [username] to start over.",
        nextState: SherlockCommandState.IDLE,
      };
  }
}

/**
 * Handle IDLE state (initial command)
 * @param {string} input - User input
 * @param {string} sessionId - User session ID
 * @param {string} username - Extracted username
 * @param {Object} consentState - Current consent state
 * @returns {Object} Response object
 */
function handleIdleState(input, sessionId, username, consentState) {
  // Check if user has full Sherlock consent
  const hasConsent = hasFullSherlockConsent(sessionId);

  if (!hasConsent) {
    // Start warning flow
    const firstWarning = sherlockWarningFlow.startFlow(sessionId);

    // Store warning session ID
    const warningSessionId = firstWarning.id;

    // Update command state
    setSherlockCommandState(sessionId, {
      state: SherlockCommandState.WAITING_FOR_CONSENT,
      warningSessionId,
      username: username || null,
      error: null,
    });

    // Format warning for display
    return {
      response: formatSherlockWarning(firstWarning),
      nextState: SherlockCommandState.WAITING_FOR_CONSENT,
      warning: firstWarning,
    };
  }

  // User already has consent, process username
  if (username) {
    // Validate username
    const validation = validateSherlockUsername(username);
    
    if (!validation.valid) {
      return {
        response: `❌ Invalid username: ${validation.error}`,
        nextState: SherlockCommandState.ERROR,
        error: validation.error,
      };
    }

    // Check rate limit
    const rateLimit = checkSherlockRateLimit(sessionId);
    
    if (!rateLimit.allowed) {
      return {
        response: `❌ ${rateLimit.error}\n\nYou can search again in ${Math.ceil((rateLimit.resetAt - Date.now()) / 60000)} minutes.`,
        nextState: SherlockCommandState.ERROR,
        error: rateLimit.error,
      };
    }

    // Start Sherlock search (would integrate with actual Sherlock service)
    return {
      response: `🔍 Starting Sherlock search for "${validation.username}"...\n\n⚠️ Remember: This searches PUBLIC profiles only. Results may reveal information that could identify you.`,
      nextState: SherlockCommandState.PROCESSING,
      username: validation.username,
    };
  }

  // No username provided, prompt for it
  return {
    response: "🔍 Sherlock Tool\n\nUsage: /sherlock [username]\n\nExample: /sherlock myusername\n\n⚠️ This tool requires explicit consent due to privacy risks. Type /sherlock [username] to start the consent flow.",
    nextState: SherlockCommandState.WAITING_FOR_USERNAME,
  };
}

/**
 * Handle WAITING_FOR_CONSENT state
 * @param {string} input - User input
 * @param {string} sessionId - User session ID
 * @param {Object} currentState - Current command state
 * @returns {Object} Response object
 */
function handleWaitingForConsentState(input, sessionId, currentState) {
  // Check for action commands
  const actionMatch = input.match(/^\/(continue|accept|yes|no|deny|cancel)$/i);
  const action = actionMatch ? actionMatch[1].toLowerCase() : null;

  if (!action) {
    // Not an action command, show current warning again
    const session = sherlockWarningFlow.getSherlockSessionByMainSession(sessionId);
    if (!session) {
      return {
        response: "❌ Sherlock session expired. Type /sherlock [username] to start over.",
        nextState: SherlockCommandState.IDLE,
      };
    }

    const currentWarning = sherlockWarningFlow.continueFlow(session.sherlockSessionId);
    return {
      response: formatSherlockWarning(currentWarning),
      nextState: SherlockCommandState.WAITING_FOR_CONSENT,
      warning: currentWarning,
    };
  }

  // Handle action
  const warningSessionId = currentState.warningSessionId;
  
  switch (action) {
    case 'continue':
    case 'yes':
    case 'accept':
      // Continue to next warning
      const nextWarning = sherlockWarningFlow.continueFlow(warningSessionId);
      
      if (!nextWarning) {
        // All warnings shown, check if user wants to proceed
        return {
          response: "✅ All warnings have been shown. Do you want to proceed with Sherlock?\n\nType /yes to grant consent or /no to cancel.",
          nextState: SherlockCommandState.WAITING_FOR_CONSENT,
        };
      }

      return {
        response: formatSherlockWarning(nextWarning),
        nextState: SherlockCommandState.WAITING_FOR_CONSENT,
        warning: nextWarning,
      };

    case 'no':
    case 'deny':
    case 'cancel':
      // Deny consent
      sherlockWarningFlow.handleAction(warningSessionId, 'deny_consent');
      clearSherlockCommandState(sessionId);
      
      return {
        response: "❌ Sherlock consent denied. You will not be able to use the /sherlock command in this session.\n\nYour privacy and safety are our priority.",
        nextState: SherlockCommandState.IDLE,
      };

    default:
      return {
        response: "❌ Invalid response. Please type /yes to continue or /no to cancel.",
        nextState: SherlockCommandState.WAITING_FOR_CONSENT,
      };
  }
}

/**
 * Handle WAITING_FOR_USERNAME state
 * @param {string} input - User input
 * @param {string} sessionId - User session ID
 * @param {string} username - Extracted username
 * @returns {Object} Response object
 */
function handleWaitingForUsernameState(input, sessionId, username) {
  if (!username) {
    return {
      response: "❌ Please provide a username. Usage: /sherlock [username]",
      nextState: SherlockCommandState.WAITING_FOR_USERNAME,
    };
  }

  // Validate username
  const validation = validateSherlockUsername(username);
  
  if (!validation.valid) {
    return {
      response: `❌ Invalid username: ${validation.error}`,
      nextState: SherlockCommandState.ERROR,
      error: validation.error,
    };
  }

  // Check if user has consent
  const hasConsent = hasFullSherlockConsent(sessionId);
  
  if (!hasConsent) {
    // Start warning flow
    const firstWarning = sherlockWarningFlow.startFlow(sessionId);
    
    setSherlockCommandState(sessionId, {
      state: SherlockCommandState.WAITING_FOR_CONSENT,
      warningSessionId: firstWarning.id,
      username: validation.username,
      error: null,
    });

    return {
      response: formatSherlockWarning(firstWarning),
      nextState: SherlockCommandState.WAITING_FOR_CONSENT,
      warning: firstWarning,
    };
  }

  // User has consent, check rate limit
  const rateLimit = checkSherlockRateLimit(sessionId);
  
  if (!rateLimit.allowed) {
    return {
      response: `❌ ${rateLimit.error}\n\nYou can search again in ${Math.ceil((rateLimit.resetAt - Date.now()) / 60000)} minutes.`,
      nextState: SherlockCommandState.ERROR,
      error: rateLimit.error,
    };
  }

  // Start Sherlock search
  return {
    response: `🔍 Starting Sherlock search for "${validation.username}"...\n\n⚠️ Remember: This searches PUBLIC profiles only. Results may reveal information that could identify you.`,
    nextState: SherlockCommandState.PROCESSING,
    username: validation.username,
  };
}

// ============================================================================
// SHERLOCK RESULT HANDLER
// ============================================================================

/**
 * Handle Sherlock search results
 * @param {Object} results - Search results from Sherlock service
 * @param {string} sessionId - User session ID
 * @param {string} username - Searched username
 * @returns {Object} Response object with results and reminders
 */
function handleSherlockResults(results, sessionId, username) {
  // Increment search count
  incrementSherlockSearchCount(sessionId);

  // Get post-search reminder
  const reminder = sherlockWarningFlow.getPostSearchReminder(sessionId);

  // Format results with reminder
  const formattedResults = formatSherlockResults(results, username);

  // Update command state
  setSherlockCommandState(sessionId, {
    state: SherlockCommandState.COMPLETED,
    warningSessionId: null,
    username,
    error: null,
  });

  return {
    response: `${formattedResults}\n\n${formatSherlockWarning(reminder)}`,
    nextState: SherlockCommandState.COMPLETED,
    results,
  };
}

/**
 * Format Sherlock results for display
 * @param {Object} results - Raw search results
 * @param {string} username - Searched username
 * @returns {string} Formatted results
 */
function formatSherlockResults(results, username) {
  if (!results || !results.profiles || results.profiles.length === 0) {
    return `🔍 Sherlock Search Results for "${username}"\n\n❌ No public profiles found for this username.`;
  }

  let output = `🔍 Sherlock Search Results for "${username}"\n\n`;
  output += `Found ${results.profiles.length} public profile(s):\n\n`;

  results.profiles.forEach((profile, index) => {
    output += `${index + 1}. ${profile.platform} - ${profile.url}\n`;
    if (profile.bio) {
      output += `   Bio: ${profile.bio}\n`;
    }
    if (profile.followers) {
      output += `   Followers: ${profile.followers}\n`;
    }
    output += `\n`;
  });

  output += `⚠️ REMINDER: These are PUBLIC profiles. Anyone can see this information.\n`;
  output += `Be cautious about what you do with these results.\n`;

  return output;
}

// ============================================================================
// SHERLOCK HELP COMMAND
// ============================================================================

/**
 * Get Sherlock help information
 * @returns {string} Help text
 */
function getSherlockHelp() {
  return `
🔍 SHERLOCK TOOL - Help

DESCRIPTION:
The Sherlock tool searches PUBLIC social media profiles for a given username.
This is provided for PERSONAL SAFETY VERIFICATION ONLY.

USAGE:
/sherlock [username] - Search for a username

EXAMPLES:
/sherlock myusername
/sherlock jane_doe
/sherlock user123

⚠️ PRIVACY WARNINGS:
This tool has SIGNIFICANT privacy risks:
• Could reveal information that identifies you
• May enable correlation between your chat and real identity
• Results could be used for surveillance or harassment

🛡️ SAFETY TIPS:
• Only search for YOUR OWN usernames
• Use a VPN or Tor browser for additional privacy
• Consider if you REALLY need this information
• Never search for someone else without their consent

📋 REQUIREMENTS:
• Requires explicit consent (multi-step warning flow)
• Requires tools consent (/consent tools)
• Rate limited to 5 searches per hour
• Session-based (consent resets when session ends)

🔒 PRIVACY PROTECTIONS:
• We NEVER store search results
• We NEVER log usernames searched
• Results are ONLY shown to you
• Session data is deleted after 24 hours

💡 NEED HELP?
If you're in crisis or need support, use /resources for
sex worker-specific organizations that can help.
`;
}

// ============================================================================
// SHERLOCK AUDIT FUNCTIONS
// ============================================================================

/**
 * Get Sherlock usage statistics for a session
 * @param {string} sessionId - User session ID
 * @returns {Object} Usage statistics
 */
function getSherlockUsageStats(sessionId) {
  const auditLog = getSherlockAuditLog(sessionId);
  
  const stats = {
    totalSessions: 0,
    totalSearches: 0,
    consentGranted: 0,
    consentDenied: 0,
    lastSearch: null,
    rateLimitHits: 0,
  };

  for (const event of auditLog) {
    switch (event.eventType) {
      case 'session_initialized':
        stats.totalSessions++;
        break;
      case 'consent_granted':
        stats.consentGranted++;
        stats.totalSearches++;
        stats.lastSearch = event.timestamp;
        break;
      case 'consent_denied':
        stats.consentDenied++;
        break;
      case 'rate_limit_exceeded':
        stats.rateLimitHits++;
        break;
    }
  }

  return stats;
}

/**
 * Get Sherlock consent status for a session
 * @param {string} sessionId - User session ID
 * @returns {Object} Consent status
 */
function getSherlockConsentStatus(sessionId) {
  const hasConsent = hasSherlockConsent(sessionId);
  const hasFullConsent = hasFullSherlockConsent(sessionId);

  return {
    hasSherlockConsent: hasConsent,
    hasToolsConsent: hasFullConsent, // Simplified for this example
    hasFullConsent: hasFullConsent,
    consentRequired: !hasFullConsent,
  };
}

// ============================================================================
// SHERLOCK WARNING FORMATTER
// ============================================================================

/**
 * Format a Sherlock warning for display in chat
 * @param {Object} warning - Warning object
 * @returns {string} Formatted warning
 */
function formatSherlockWarning(warning) {
  if (!warning) {
    return "";
  }

  const border = '═'.repeat(60);
  const thinBorder = '─'.repeat(60);

  let output = `\n${warning.icon} ${border}\n`;
  output += `  ${warning.title}\n`;
  output += `${thinBorder}\n`;
  output += `${warning.message}\n`;
  output += `${thinBorder}\n`;

  // Add progress bar if available
  if (warning.progress) {
    const progressBar = getProgressBar(warning.progress);
    output += `\n${progressBar}\n`;
  }

  // Add action buttons if available
  if (warning.actions && warning.actions.length > 0) {
    output += `\n${thinBorder}\n`;
    output += "  Actions:\n";
    warning.actions.forEach(action => {
      output += `  [/${action.label}]\n`;
    });
    output += `${thinBorder}\n`;
  }

  output += `\n`;

  return output;
}

/**
 * Generate a progress bar
 * @param {Object} progress - Progress object
 * @returns {string} Progress bar
 */
function getProgressBar(progress) {
  const filled = Math.round((progress.current / progress.total) * 20);
  const empty = 20 - filled;
  const bar = '█'.repeat(filled) + '░'.repeat(empty);
  
  return `  Progress: [${bar}] ${progress.current}/${progress.total} (${progress.percentage}%)`;
}

// ============================================================================
// SHERLOCK COMMAND REGISTRATION
// ============================================================================

/**
 * Sherlock Command Configuration
 * Configuration for integrating Sherlock with chatbot command system
 */
const SherlockCommandConfig = Object.freeze({
  // Command name
  name: 'sherlock',
  
  // Command aliases
  aliases: ['sherlock', 'search', 'lookup', 'find'],
  
  // Command description
  description: 'Search public social media profiles for a username (requires explicit consent)',
  
  // Command usage
  usage: '/sherlock [username]',
  
  // Command examples
  examples: ['/sherlock myusername', '/sherlock jane_doe'],
  
  // Required consent scopes
  requiredScopes: ['tools', 'sherlock'],
  
  // Command category
  category: 'tools',
  
  // Command priority (higher = more important)
  priority: 10,
  
  // Command enabled by default
  enabled: true,
  
  // Command requires consent
  requiresConsent: true,
  
  // Command has multi-step flow
  hasFlow: true,
});

/**
 * Register Sherlock command with chatbot
 * @param {Object} chatbot - Chatbot instance
 */
function registerSherlockCommand(chatbot) {
  if (!chatbot || !chatbot.registerCommand) {
    console.warn('[SHERLOCK] Chatbot instance not provided for registration');
    return;
  }

  // Register main command
  chatbot.registerCommand({
    name: SherlockCommandConfig.name,
    aliases: SherlockCommandConfig.aliases,
    description: SherlockCommandConfig.description,
    usage: SherlockCommandConfig.usage,
    examples: SherlockCommandConfig.examples,
    category: SherlockCommandConfig.category,
    priority: SherlockCommandConfig.priority,
    enabled: SherlockCommandConfig.enabled,
    requiresConsent: SherlockCommandConfig.requiresConsent,
    requiredScopes: SherlockCommandConfig.requiredScopes,
    hasFlow: SherlockCommandConfig.hasFlow,
    
    // Command handler
    handler: (input, sessionId, consentState) => {
      return processSherlockCommand(input, sessionId, consentState);
    },
    
    // Help handler
    helpHandler: () => getSherlockHelp(),
    
    // Consent check
    consentCheck: (sessionId) => hasFullSherlockConsent(sessionId),
  });

  console.log('[SHERLOCK] Command registered with chatbot');
}

// ============================================================================
// SHERLOCK SERVICE INTEGRATION
// ============================================================================

/**
 * Sherlock Service Interface
 * Interface for integrating with actual Sherlock service
 */
class SherlockService {
  constructor() {
    this.apiUrl = process.env.SHERLOCK_API_URL || null;
    this.apiKey = process.env.SHERLOCK_API_KEY || null;
    this.enabled = this.apiUrl && this.apiKey;
  }

  /**
   * Check if Sherlock service is available
   * @returns {boolean} True if service is available
   */
  isAvailable() {
    return this.enabled;
  }

  /**
   * Search for a username
   * @param {string} username - Username to search
   * @param {Object} options - Search options
   * @returns {Promise<Object>} Search results
   */
  async search(username, options = {}) {
    if (!this.enabled) {
      return {
        success: false,
        error: 'Sherlock service is not configured',
        profiles: [],
      };
    }

    try {
      // In a real implementation, this would call the Sherlock API
      // For now, return mock results
      const mockResults = this.generateMockResults(username);
      
      return {
        success: true,
        username,
        profiles: mockResults,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('[SHERLOCK] Search error:', error);
      return {
        success: false,
        error: 'Search failed. Please try again later.',
        profiles: [],
      };
    }
  }

  /**
   * Generate mock results for demonstration
   * @param {string} username - Username to search
   * @returns {Array} Mock profile results
   */
  generateMockResults(username) {
    // Generate 0-3 mock profiles
    const count = Math.floor(Math.random() * 4);
    const platforms = ['Twitter', 'Instagram', 'TikTok', 'Reddit', 'GitHub', 'LinkedIn'];
    const results = [];

    for (let i = 0; i < count; i++) {
      const platform = platforms[Math.floor(Math.random() * platforms.length)];
      results.push({
        platform,
        username,
        url: `https://${platform.toLowerCase()}.com/${username}`,
        bio: `This is a mock bio for ${username} on ${platform}`,
        followers: Math.floor(Math.random() * 10000),
        verified: Math.random() > 0.8,
        lastActive: new Date(Date.now() - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000)).toISOString(),
      });
    }

    return results;
  }
}

// Create singleton instance
const sherlockService = new SherlockService();

// ============================================================================
// EXPORTS
// ============================================================================

export {
  // Command processing
  processSherlockCommand,
  handleIdleState,
  handleWaitingForConsentState,
  handleWaitingForUsernameState,
  handleSherlockResults,
  
  // State management
  SherlockCommandState,
  getSherlockCommandState,
  setSherlockCommandState,
  clearSherlockCommandState,
  
  // Warning flow integration
  sherlockWarningFlow,
  
  // Result handling
  formatSherlockResults,
  
  // Help and information
  getSherlockHelp,
  SherlockCommandConfig,
  
  // Audit and statistics
  getSherlockUsageStats,
  getSherlockConsentStatus,
  getSherlockAuditLog,
  clearSherlockAuditLog,
  
  // Service integration
  SherlockService,
  sherlockService,
  registerSherlockCommand,
  
  // Validation and safety
  validateSherlockUsername,
  checkSherlockRateLimit,
  incrementSherlockSearchCount,
  hasSherlockConsent,
  hasFullSherlockConsent,
};
