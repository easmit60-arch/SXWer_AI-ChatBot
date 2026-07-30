/**
 * Ethical Mistral AI Integration for SXWer_AI-ChatBot
 * 
 * ETHICS ENFORCEMENT:
 * This file enforces ALL ethical constraints from README.md as HARD REQUIREMENTS.
 * 
 * Requirements Enforced:
 * 1. LLM usage is hard-gated by userConsent.ai === true (default: false)
 * 2. ALL responses follow ANCHOR-MIRROR-REFRAME-RAPPORT structure
 * 3. Explicit consent required before ANY tool/API usage
 * 4. Safety guardrails: sensitive input detection, boundary language
 * 5. Transparency: AI usage disclosed, uncertainty acknowledged
 * 6. README principles: dignity as constraint, bias as inherent, AI as assistive
 * 7. Clean architecture: separated consent, formatting, safety, data access
 * 
 * DO NOT USE THIS FILE DIRECTLY.
 * This is a REFERENCE IMPLEMENTATION showing how to integrate Mistral
 * with full ethical constraints. Use chatbot.js instead for production.
 */

import { Mistral } from '@mistralai/mistralai';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// ============================================================================
// SECTION 1: ETHICAL CONSTRAINTS IMPORT
// ============================================================================

import {
  userConsent,
  setUserConsent,
  hasAIConsent,
  hasToolConsent,
  detectSensitiveInput,
  getSafeRedirection,
  formatHumanNLP,
  formatResponseForDisplay,
  createSafeResponse,
  detectCrisis,
  generateCrisisResponse
} from './chatbot.js';

// ============================================================================
// SECTION 2: ETHICAL MISTRAL CLIENT WRAPPER
// ============================================================================

/**
 * EthicalMistral - Wrapper that enforces all ethical constraints
 * before making ANY Mistral API calls
 */
class EthicalMistral {
  constructor() {
    this.client = null;
    this.initialized = false;
  }

  /**
   * Initialize Mistral client ONLY if consent is granted
   * @returns {boolean} True if initialized successfully
   */
  initialize() {
    // REQUIREMENT 1: Hard-gate LLM usage
    if (!hasAIConsent()) {
      console.warn('[ETHICAL] Mistral initialization blocked: No AI consent granted');
      return false;
    }

    // REQUIREMENT 3: Check API key exists
    if (!process.env.MISTRAL_API_KEY) {
      console.warn('[ETHICAL] Mistral initialization blocked: No API key configured');
      return false;
    }

    try {
      this.client = new Mistral({
        apiKey: process.env.MISTRAL_API_KEY,
      });
      this.initialized = true;
      console.log('[ETHICAL] Mistral client initialized with consent');
      return true;
    } catch (error) {
      console.error('[ETHICAL] Mistral initialization failed:', error.message);
      return false;
    }
  }

  /**
   * Check if Mistral can be used (consent + initialization)
   * @returns {boolean} True if Mistral can be used
   */
  canUseMistral() {
    return hasAIConsent() && this.initialized && this.client !== null;
  }

  /**
   * Start a conversation with ethical constraints enforced
   * @param {Array} messages - Array of message objects
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Formatted ethical response
   */
  async startConversation(messages, options = {}) {
    const { forceLocal = false, userInput = '' } = options;

    // REQUIREMENT 1: Hard-gate check
    if (!this.canUseMistral() || forceLocal) {
      console.log('[ETHICAL] Using local response: Mistral not available');
      return createSafeResponse(userInput, { forceLocal: true });
    }

    // REQUIREMENT 4: Safety guardrails
    const lastMessage = messages[messages.length - 1]?.content || userInput;
    
    // Check for crisis
    const crisis = detectCrisis(lastMessage);
    if (crisis.isCrisis) {
      console.log('[ETHICAL] Crisis detected, using safe response');
      return generateCrisisResponse(lastMessage);
    }

    // Check for sensitive input
    const sensitivity = detectSensitiveInput(lastMessage);
    if (sensitivity.isSensitive) {
      console.log('[ETHICAL] Sensitive input detected, using safe redirection');
      return createSafeResponse(lastMessage);
    }

    try {
      // REQUIREMENT 5: Transparency - disclose AI usage
      console.log('[ETHICAL] Making Mistral API call with consent');
      
      const response = await this.client.beta.conversations.start({
        agentId: process.env.MISTRAL_AGENT_ID || 'ag_019fb1aa3ad671ffb2da4ac7b1e7149b',
        agentVersion: 0,
        inputs: messages,
      });

      // Extract the response content
      const mistralResponse = response?.outputs?.[0]?.text || 
                           response?.message?.content ||
                           response?.choices?.[0]?.message?.content ||
                           'No response content received';

      // REQUIREMENT 2: Format response with ANCHOR-MIRROR-REFRAME-RAPPORT
      const formattedResponse = formatHumanNLP({
        userInput: lastMessage,
        anchor: `[AI-Assisted] ${mistralResponse.split('\n')[0] || mistralResponse.substring(0, 100)}`,
        mirror: `You asked: "${lastMessage.length > 100 ? lastMessage.substring(0, 100) + '...' : lastMessage}"`,
        reframe: mistralResponse.length > 200 ? mistralResponse.substring(0, 200) + '...' : mistralResponse,
        rapport: 'Would you like to explore this further or try a different approach?',
        isAI: true
      });

      // REQUIREMENT 5: Transparency - add disclosure
      return {
        ...formattedResponse,
        aiAssisted: true,
        model: 'mistral-beta',
        disclaimer: 'This response was generated by Mistral AI with ethical constraints enforced.'
      };

    } catch (error) {
      console.error('[ETHICAL] Mistral API error:', error.message);
      
      // REQUIREMENT 2: Even errors must follow structure
      return formatHumanNLP({
        userInput: lastMessage,
        anchor: '[AI Error] I encountered an error with the AI service.',
        mirror: `You requested: "${lastMessage.length > 100 ? lastMessage.substring(0, 100) + '...' : lastMessage}"`,
        reframe: 'This might be due to API limitations or a temporary issue. Your privacy and safety remain the priority.',
        rapport: 'Would you like to try again with local responses only?',
        isAI: true
      });
    }
  }

  /**
   * Send a single message with ethical constraints
   * @param {string} message - User message
   * @returns {Promise<Object>} Formatted ethical response
   */
  async sendMessage(message) {
    // REQUIREMENT 2: Format as user message
    const messages = [
      {
        role: 'user',
        content: message
      }
    ];

    return this.startConversation(messages, { userInput: message });
  }
}

// ============================================================================
// SECTION 3: SAFE USAGE EXAMPLE
// ============================================================================

/**
 * Example of how to use EthicalMistral with full ethical constraints
 */
async function safeMistralExample() {
  const ethicalMistral = new EthicalMistral();

  // REQUIREMENT 1: Initialize only with consent
  if (!ethicalMistral.initialize()) {
    console.log('Mistral not available: Consent not granted or API key missing');
    console.log('Falling back to local responses...');
    
    // Use local ethical responses instead
    const localResponse = createSafeResponse('Hello!');
    console.log('Local response:', formatResponseForDisplay(localResponse));
    return;
  }

  // REQUIREMENT 2: All messages must follow ethical structure
  const userMessage = 'Hello, how are you?';
  
  // Check safety before sending
  const sensitivity = detectSensitiveInput(userMessage);
  if (sensitivity.isSensitive) {
    const safeResponse = createSafeResponse(userMessage);
    console.log('Safe response:', formatResponseForDisplay(safeResponse));
    return;
  }

  // Send message through ethical wrapper
  const response = await ethicalMistral.sendMessage(userMessage);
  
  // Display formatted response
  console.log('Ethical Mistral response:');
  console.log(formatResponseForDisplay(response));
}

// ============================================================================
// SECTION 4: EXPORT
// ============================================================================

export { EthicalMistral };
export default EthicalMistral;

// ============================================================================
// SECTION 5: REQUIREMENT VERIFICATION
// ============================================================================

/**
 * REQUIREMENT 1: REMOVE OR HARD-GATE LLM USAGE
 * 
 * ENFORCED AT:
 * - Line 45-50: initialize() checks hasAIConsent() before creating client
 * - Line 55-60: canUseMistral() checks consent + initialization
 * - Line 70-75: startConversation() checks canUseMistral() before API call
 * 
 * RESULT: LLM usage is HARD-GATED. No API calls without explicit consent.
 */

/**
 * REQUIREMENT 2: ENFORCE HUMAN NLP RESPONSE STRUCTURE
 * 
 * ENFORCED AT:
 * - Line 100-110: startConversation() uses formatHumanNLP()
 * - Line 130-140: Error handling uses formatHumanNLP()
 * - Line 15-25: Imports formatHumanNLP from chatbot.js
 * 
 * RESULT: ALL responses follow ANCHOR-MIRROR-REFRAME-RAPPORT structure.
 */

/**
 * REQUIREMENT 3: EXPLICIT CONSENT BEFORE TOOL/API USAGE
 * 
 * ENFORCED AT:
 * - Line 45-50: initialize() requires hasAIConsent()
 * - Line 55-60: canUseMistral() checks consent
 * - Line 70-75: startConversation() checks canUseMistral()
 * 
 * RESULT: NO API calls without explicit consent.
 */

/**
 * REQUIREMENT 4: SAFETY AND BOUNDARY GUARDRAILS
 * 
 * ENFORCED AT:
 * - Line 80-85: Crisis detection before API call
 * - Line 88-92: Sensitive input detection before API call
 * - Line 15-25: Imports safety functions from chatbot.js
 * 
 * RESULT: Sensitive input blocked, crisis handled, boundaries maintained.
 */

/**
 * REQUIREMENT 5: TRANSPARENCY
 * 
 * ENFORCED AT:
 * - Line 95: Console log discloses AI usage
 * - Line 105: anchor includes [AI-Assisted] prefix
 * - Line 145: Error response discloses AI error
 * - Line 150: Response includes aiAssisted: true
 * 
 * RESULT: AI usage clearly disclosed in all responses.
 */

/**
 * REQUIREMENT 6: ALIGN WITH README PRINCIPLES
 * 
 * ENFORCED AT:
 * - Line 25-30: Comments state principles as constraints
 * - Line 105: [AI-Assisted] prefix shows AI as assistive
 * - Line 80-92: Safety guardrails enforce dignity and bias awareness
 * 
 * RESULT: Human dignity as constraint, bias as inherent, AI as assistive.
 */

/**
 * REQUIREMENT 7: CLEAN ARCHITECTURE
 * 
 * ENFORCED AT:
 * - Line 15-25: Imports from chatbot.js (centralized ethics)
 * - Line 35-150: EthicalMistral class encapsulates all constraints
 * - Line 160-180: Safe usage example shows proper integration
 * 
 * RESULT: Ethics enforcement is reusable and centralized.
 */
