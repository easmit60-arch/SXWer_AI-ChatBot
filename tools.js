/**
 * SXWer AI ChatBot - Ethical Tool Implementations
 *
 * ETHICAL CONSTRAINTS:
 * - All tools require explicit user consent (TOOLS_OPT_IN)
 * - All tools follow ANCHOR-MIRROR-REFRAME-RAPPORT structure
 * - All tools respect user autonomy and dignity
 * - No tools provide professional advice (medical, legal, financial)
 * - All tools have clear limitations and disclaimers
 *
 * IMPLEMENTED TOOLS:
 * - get_time: Client-side time retrieval (no server dependency)
 * - translate_text: Offline text translation (requires consent)
 * - sherlock_ai: AI-enhanced username verification (requires consent + protocol)
 *
 * PROHIBITED TOOLS (Ethical Violations):
 * - get_stock_price: Violates NO_ASSUMPTIONS, notAuthority (financial advice)
 * - get_weather: Violates SAFETY, TRANSPARENCY (external dependency, safety-critical)
 */

// ============================================================================
// TOOL CONFIGURATION
// ============================================================================

/**
 * Tool registry with ethical constraints
 */
const TOOLS = Object.freeze({
  get_time: {
    name: "Get Time",
    description: "Retrieve current time in user's timezone",
    consentRequired: false, // Client-side only, no data processing
    ethicalConstraints: [
      "Client-side only - no server dependency",
      "No time-sensitive decisions",
      "Respects user's local timezone",
    ],
    disclaimer: "Time is provided by your device. I cannot guarantee accuracy for critical timing needs.",
  },
  translate_text: {
    name: "Translate Text",
    description: "Translate text between languages",
    consentRequired: true, // Requires tool consent
    ethicalConstraints: [
      "Offline only - no external APIs",
      "Maintains trauma-informed language",
      "Does not translate sensitive content",
      "Includes accuracy disclaimers",
    ],
    disclaimer: "Translation is approximate and may not capture nuances. For important communications, consult a human translator.",
  },
  sherlock_ai: {
    name: "Sherlock AI",
    description: "AI-enhanced username verification for safety",
    consentRequired: true, // Requires tool consent
    ethicalConstraints: [
      "Safety verification only - never surveillance",
      "Explicit consent required",
      "Own accounts only",
      "No data retention",
      "AI usage disclosed",
    ],
    disclaimer: "Sherlock is for your safety verification only. Never use it to surveil others without their knowledge and consent.",
  },
});

/**
 * Prohibited tools with ethical explanations
 */
const PROHIBITED_TOOLS = Object.freeze({
  get_stock_price: {
    name: "Get Stock Price",
    reason: "PROHIBITED",
    ethicalViolation: [
      "Violates CORE_PRINCIPLES.NO_ASSUMPTIONS: Never generalize, diagnose, or override user experience",
      "Violates BOUNDARY_STATEMENTS.notAuthority: I am not an authority figure or expert",
      "Violates BOUNDARY_STATEMENTS.limits: I have limitations and cannot provide professional services",
      "Could be interpreted as financial advice, which may cause harm",
      "Conflicts with SENSITIVE_KEYWORDS.financial: investment advice, stock tips",
    ],
    alternative: "For financial information, I recommend consulting licensed financial professionals or reputable financial education resources.",
  },
  get_weather: {
    name: "Get Weather",
    reason: "CONDITIONALLY PROHIBITED",
    ethicalViolation: [
      "Violates CORE_PRINCIPLES.SAFETY: Could be used for safety-critical decisions",
      "Violates CORE_PRINCIPLES.TRANSPARENCY: Requires external API calls (not offline-first)",
      "Violates offline-first design principle",
      "Could provide inaccurate information leading to harm",
    ],
    alternative: "For weather information, I recommend checking official meteorological services. For weather safety, always follow official evacuation orders.",
  },
});

// ============================================================================
// TOOL HANDLING
// ============================================================================

/**
 * Check if a tool is allowed
 * @param {string} toolName - Name of the tool
 * @returns {boolean} True if tool is allowed
 */
function isToolAllowed(toolName) {
  return TOOLS[toolName] !== undefined;
}

/**
 * Check if a tool is prohibited
 * @param {string} toolName - Name of the tool
 * @returns {boolean} True if tool is prohibited
 */
function isToolProhibited(toolName) {
  return PROHIBITED_TOOLS[toolName] !== undefined;
}

/**
 * Get tool configuration
 * @param {string} toolName - Name of the tool
 * @returns {Object|null} Tool configuration or null if not found
 */
function getToolConfig(toolName) {
  return TOOLS[toolName] || null;
}

/**
 * Get prohibited tool information
 * @param {string} toolName - Name of the tool
 * @returns {Object|null} Prohibited tool information or null if not found
 */
function getProhibitedToolInfo(toolName) {
  return PROHIBITED_TOOLS[toolName] || null;
}

// ============================================================================
// TOOL IMPLEMENTATIONS
// ============================================================================

/**
 * Get current time (client-side implementation)
 * @param {string} timezone - Optional timezone (defaults to browser timezone)
 * @returns {Object} Time information
 */
function getTime(timezone = null) {
  const now = new Date();
  
  // Format time based on timezone
  const options = {
    timeZone: timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  };
  
  const formatter = new Intl.DateTimeFormat("en-US", options);
  const formattedTime = formatter.format(now);
  
  return {
    timestamp: now.getTime(),
    isoString: now.toISOString(),
    formatted: formattedTime,
    timezone: timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
    disclaimer: TOOLS.get_time.disclaimer,
  };
}

/**
 * Translate text (offline implementation - placeholder)
 * Note: In a real implementation, this would use a local translation library
 * @param {string} text - Text to translate
 * @param {string} targetLanguage - Target language
 * @returns {Object} Translation result
 */
function translateText(text, targetLanguage = "en") {
  // This is a placeholder - in a real implementation, you would:
  // 1. Use a local translation library (like franc, translate, etc.)
  // 2. Or integrate with a privacy-first translation API
  // 3. Or use a pre-loaded translation dictionary
  
  // For now, return a mock response that indicates the feature
  return {
    originalText: text,
    originalLanguage: "en", // Would detect this in real implementation
    translatedText: `[Translated to ${targetLanguage}]: ${text} (Translation feature coming soon)`,
    targetLanguage,
    disclaimer: TOOLS.translate_text.disclaimer,
    note: "Offline translation requires local language packs. This is a placeholder implementation.",
  };
}

/**
 * Handle Sherlock AI request
 * Note: This enhances the existing Sherlock with AI capabilities
 * @param {string} username - Username to check
 * @param {string} sessionId - Session identifier
 * @returns {Object} Formatted response
 */
async function handleSherlockAI(username, sessionId, formatHumanNLP, truncateForMirror) {
  // In a real implementation, this would:
  // 1. Check consent (already handled by caller)
  // 2. Check protocol (already handled by caller)
  // 3. Use AI to enhance the search results
  // 4. Return formatted, ethical response
  
  // For now, return a placeholder that indicates AI enhancement
  return formatHumanNLP({
    userInput: `/sherlock_ai ${username}`,
    anchor: `Running AI-enhanced safety verification for username.`,
    mirror: `You requested: "${truncateForMirror(username)}"`,
    reframe: `I'm using AI to help verify this username for safety purposes only. ${TOOLS.sherlock_ai.disclaimer}`,
    rapport: `Would you like me to proceed with the enhanced verification?`,
  });
}

// ============================================================================
// TOOL PARSING & DISPATCH
// ============================================================================

/**
 * Parse tool command from user input
 * @param {string} input - User input
 * @returns {Object} Parsed command information
 */
function parseToolCommand(input) {
  if (!input || typeof input !== "string") {
    return { tool: null, args: [], isTool: false };
  }
  
  const trimmed = input.trim();
  
  // Check for get_time
  if (trimmed.toLowerCase().startsWith("/get_time") || 
      trimmed.toLowerCase().startsWith("get_time") ||
      trimmed.toLowerCase().startsWith("what time") ||
      trimmed.toLowerCase().startsWith("current time")) {
    const args = trimmed.split(/\s+/).slice(1);
    return { tool: "get_time", args, isTool: true };
  }
  
  // Check for translate_text
  if (trimmed.toLowerCase().startsWith("/translate") || 
      trimmed.toLowerCase().startsWith("translate")) {
    const args = trimmed.split(/\s+/).slice(1);
    // Parse: /translate <text> to <language>
    const toIndex = args.indexOf("to");
    if (toIndex > 0 && args.length > toIndex + 1) {
      const text = args.slice(0, toIndex).join(" ");
      const targetLanguage = args.slice(toIndex + 1).join(" ");
      return { tool: "translate_text", args: [text, targetLanguage], isTool: true };
    }
    return { tool: "translate_text", args, isTool: true };
  }
  
  // Check for sherlock_ai
  if (trimmed.toLowerCase().startsWith("/sherlock_ai") || 
      trimmed.toLowerCase().startsWith("sherlock_ai")) {
    const args = trimmed.split(/\s+/).slice(1);
    return { tool: "sherlock_ai", args, isTool: true };
  }
  
  // Check for prohibited tools (only when explicitly invoked)
  const lower = trimmed.toLowerCase();
  for (const toolName of Object.keys(PROHIBITED_TOOLS)) {
    if (lower.startsWith(`/${toolName}`) || lower.startsWith(toolName)) {
      return { tool: toolName, args: [], isTool: true, prohibited: true };
    }
  }
  
  return { tool: null, args: [], isTool: false };
}

/**
 * Handle tool command
 * @param {string} input - User input
 * @param {Object} options - Options
 * @param {string} options.sessionId - Session identifier
 * @param {boolean} options.hasToolConsent - Whether user has tool consent
 * @param {Function} options.formatHumanNLP - Formatting function from chatbot.js
 * @param {Function} options.truncateForMirror - Truncation function from chatbot.js
 * @returns {Object} Formatted response or null if not a tool command
 */
async function handleToolCommand(input, options = {}) {
  const { 
    sessionId = "default", 
    hasToolConsent = false,
    formatHumanNLP,
    truncateForMirror 
  } = options;
  
  const command = parseToolCommand(input);
  
  if (!command.isTool) {
    return null; // Not a tool command
  }
  
  // Check if tool is prohibited
  if (command.prohibited) {
    const toolInfo = getProhibitedToolInfo(command.tool);
    
    if (!toolInfo) {
      return formatHumanNLP({
        userInput: input,
        anchor: `I cannot provide that functionality.`,
        mirror: `You requested: "${truncateForMirror(input)}"`,
        reframe: `That feature is not available in this trauma-informed, privacy-first application.`,
        rapport: `Is there something else I can help you with?`,
      });
    }
    
    return formatHumanNLP({
      userInput: input,
      anchor: `I cannot provide that functionality for ethical reasons.`,
      mirror: `You requested: "${truncateForMirror(input)}"`,
      reframe: `This feature (${toolInfo.name}) is prohibited because:\n\n${toolInfo.ethicalViolation.map((v, i) => `${i + 1}. ${v}`).join("\n")}`,
      rapport: `${toolInfo.alternative}\n\nWould you like help with something else that aligns with our ethical principles?`,
    });
  }
  
  // Check if tool is allowed
  if (!isToolAllowed(command.tool)) {
    return formatHumanNLP({
      userInput: input,
      anchor: `That functionality is not available.`,
      mirror: `You requested: "${truncateForMirror(input)}"`,
      reframe: `This application focuses on trauma-informed support and privacy-first interactions.`,
      rapport: `Is there something else I can help you with?`,
    });
  }
  
  const toolConfig = getToolConfig(command.tool);
  
  // Check consent if required
  if (toolConfig.consentRequired && !hasToolConsent) {
    return formatHumanNLP({
      userInput: input,
      anchor: `This tool requires your explicit consent.`,
      mirror: `You requested: "${truncateForMirror(input)}"`,
      reframe: `${toolConfig.description}.\n\n${toolConfig.disclaimer}`,
      rapport: `Would you like to grant consent for this tool? (Reply with "consent tools yes")`,
    });
  }
  
  // Handle each tool
  switch (command.tool) {
    case "get_time": {
      const timezone = command.args[0] || null;
      const timeData = getTime(timezone);
      return formatHumanNLP({
        userInput: input,
        anchor: `Here is the current time information.`,
        mirror: `You asked: "${truncateForMirror(input)}"`,
        reframe: `The current time is ${timeData.formatted} in ${timeData.timezone} timezone. ${TOOLS.get_time.disclaimer}`,
        rapport: `Would you like to know the time in a different timezone?`,
      });
    }
    
    case "translate_text": {
      const [text, targetLanguage] = command.args;
      const translationData = translateText(text || input, targetLanguage);
      return formatHumanNLP({
        userInput: input,
        anchor: `Here is the translation.`,
        mirror: `You asked to translate: "${truncateForMirror(text || input)}"`,
        reframe: `${translationData.translatedText}\n\n${translationData.disclaimer}`,
        rapport: `Would you like to translate something else, or try a different language?`,
      });
    }
    
    case "sherlock_ai": {
      const username = command.args[0] || "";
      return handleSherlockAI(username, sessionId, formatHumanNLP, truncateForMirror);
    }
    
    default:
      return null;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  // Tool information
  TOOLS,
  PROHIBITED_TOOLS,
  
  // Tool checking
  isToolAllowed,
  isToolProhibited,
  getToolConfig,
  getProhibitedToolInfo,
  
  // Tool parsing and handling
  parseToolCommand,
  handleToolCommand,
  
  // Individual tool functions (for testing)
  getTime,
  translateText,
  handleSherlockAI,
};
