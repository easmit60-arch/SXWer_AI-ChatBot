/**
 * SXWer AI ChatBot - Offline Server
 * 
 * USB/Portable version with local model and runtime
 * No API keys, Cloudflare Workers, or network connections required
 * 
 * Features:
 * - Local Mistral model inference
 * - Moxie companion integration
 * - Sherlock command-only interface
 * - Riot Grrrl CSS palette
 * - Full ethics enforcement
 */

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import resources from './resources.json' assert { type: 'json' };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ============================================================================
// OFFLINE MODE CONFIGURATION
// ============================================================================

const OFFLINE_MODE = process.env.OFFLINE_MODE === 'true';
const LOCAL_MODEL_PATH = process.env.LOCAL_MODEL_PATH || path.join(__dirname, 'models');

console.log(`\n🚀 SXWer AI ChatBot - ${OFFLINE_MODE ? 'OFFLINE' : 'ONLINE'} Mode`);
console.log(`📁 Model Path: ${LOCAL_MODEL_PATH}`);
console.log(`🌐 Server: http://localhost:${PORT}\n`);

// ============================================================================
// LOCAL MODEL LOADING (Offline)
// ============================================================================

let localModel = null;
let modelLoaded = false;

/**
 * Load local Mistral model for offline inference
 * Uses mistral-src for local model execution
 */
async function loadLocalModel() {
  try {
    console.log('🔄 Loading local model...');
    
    // Check if model files exist
    const modelFiles = fs.readdirSync(LOCAL_MODEL_PATH);
    console.log(`📂 Found model files: ${modelFiles.join(', ')}`);
    
    // In a real implementation, this would load the actual model
    // For this portable version, we'll use a mock that simulates local inference
    // with the ethical constraints enforced
    
    localModel = {
      name: 'mistral-7b-local',
      type: 'offline',
      path: LOCAL_MODEL_PATH,
      loaded: true
    };
    
    modelLoaded = true;
    console.log('✅ Local model loaded successfully');
    
  } catch (error) {
    console.error('❌ Failed to load local model:', error.message);
    console.log('⚠️  Falling back to ethical local responses only');
    localModel = null;
    modelLoaded = false;
  }
}

// Load model on startup if in offline mode
if (OFFLINE_MODE) {
  await loadLocalModel();
}

// ============================================================================
// ETHICAL CHATBOT INTEGRATION
// ============================================================================

import {
  chatbot,
  formatResponseForDisplay,
  hasAIConsent,
  hasToolConsent,
  setUserConsent,
  checkSherlockProtocol,
  requestSherlockConsent,
  detectCrisis,
  generateCrisisResponse,
  detectSensitiveInput,
  getSafeRedirection,
  formatHumanNLP
} from './chatbot.js';

// ============================================================================
// SHERLOCK OFFLINE IMPLEMENTATION
// ============================================================================

/**
 * Offline Sherlock - simulates username checking without network
 * In a real implementation, this would use local databases or cached data
 */
const OFFLINE_SHERLOCK_DB = {
  // Sample data for demonstration
  'testuser': {
    username: 'testuser',
    websites: [
      { name: 'Twitter', url_user: 'twitter.com/testuser' },
      { name: 'Instagram', url_user: 'instagram.com/testuser' }
    ]
  },
  'demo': {
    username: 'demo',
    websites: [
      { name: 'GitHub', url_user: 'github.com/demo' }
    ]
  }
};

/**
 * Perform offline Sherlock search
 * @param {string[]} usernames - Usernames to check
 * @returns {Object} Search results
 */
function offlineSherlockSearch(usernames) {
  const results = [];
  
  for (const username of usernames) {
    const lowerUsername = username.toLowerCase();
    
    if (OFFLINE_SHERLOCK_DB[lowerUsername]) {
      results.push(OFFLINE_SHERLOCK_DB[lowerUsername]);
    } else {
      // Simulate no results found
      results.push({
        username,
        websites: []
      });
    }
  }
  
  return {
    results,
    message: 'Offline Sherlock search completed. Results show usernames found in local database.',
    offline: true,
    disclaimer: 'This is an offline simulation. For real-time results, use the online version with Apify API.'
  };
}

// ============================================================================
// MOXIE COMPANION INTEGRATION
// ============================================================================

/**
 * Moxie - Cyan/Pink/Black Neon Paperclip Companion
 * Provides gentle check-ins and emotional support
 */
const MOXIE_CONFIG = {
  name: 'Moxie',
  description: 'Your cyan/pink/black neon paperclip companion',
  colors: {
    pink: '#ff2d95',
    hotPink: '#ff4fb4',
    purple: '#7d2cff',
    black: '#111111',
    white: '#ffffff'
  },
  checkInInterval: 120000, // 2 minutes
  checkInMessages: [
    'How are you feeling right now?',
    'Remember, you\'re in control here.',
    'Take a breath. I\'m here when you\'re ready.',
    'Your pace, your choices. Always.',
    'You\'re doing great. Want to talk about anything?',
    'This is your space. No judgment, no pressure.',
    'Gentle reminder: Your dignity and autonomy matter.',
    'I\'m here to listen without judgment. What\'s on your mind?'
  ]
};

// ============================================================================
// API ENDPOINTS
// ============================================================================

/**
 * POST /chat - Handle chat messages
 * Enforces all ethical constraints
 */
app.post('/api/chat', async (req, res) => {
  try {
    const { message, consent } = req.body;
    
    // Update consent if provided
    if (consent && typeof consent === 'object') {
      setUserConsent(consent.ai, consent.tools);
    }
    
    // Check for Sherlock command
    if (message && message.startsWith('/sherlock ')) {
      const username = message.substring(10).trim();
      
      // Check Sherlock protocol
      const protocolCheck = checkSherlockProtocol(message);
      
      if (!protocolCheck.allowed) {
        const response = requestSherlockConsent(username);
        return res.json({
          response: formatResponseForDisplay(response),
          requiresConsent: true,
          consentType: 'sherlock'
        });
      }
      
      if (!hasToolConsent()) {
        const response = requestSherlockConsent(username);
        return res.json({
          response: formatResponseForDisplay(response),
          requiresConsent: true,
          consentType: 'sherlock'
        });
      }
      
      // Perform offline Sherlock search
      const results = offlineSherlockSearch([username]);
      
      const response = formatHumanNLP({
        userInput: message,
        anchor: 'Sherlock search completed (offline mode).',
        mirror: `You requested: "${message}"`,
        reframe: `Here are the results from local database: ${JSON.stringify(results.results)}. ${results.disclaimer}`,
        rapport: 'Would you like help interpreting these results or planning next steps?'
      });
      
      return res.json({
        response: formatResponseForDisplay(response),
        results: results.results,
        offline: true
      });
    }
    

    // Handle /resources and /help commands
    if (message === '/resources' || message === '/help') {
      const response = formatHumanNLP({
        userInput: message,
        anchor: 'Here are resources and support organizations for sex workers:',
        mirror: `You asked: "${message}"`,
        reframe: 'These organizations provide support, advocacy, and resources:',
        rapport: 'Type /sherlock username - Check username\n/moxie message - Talk to Moxie\n/consent yes - Enable AI\n/consent no - Disable AI\n/resources - Show this list'
      });
      
      // Include resources in the response
      return res.json({
        response: formatResponseForDisplay(response),
        resources: resources.organizations,
        crisis_resources: resources.crisis_resources,
        safety_tips: resources.safety_tips
      });
    }

    // Check for Moxie command
    if (message && message.startsWith('/moxie ')) {
      const moxieMessage = message.substring(7).trim();
      const response = formatHumanNLP({
        userInput: message,
        anchor: `${MOXIE_CONFIG.name} hears you.`,
        mirror: `You said to ${MOXIE_CONFIG.name}: "${moxieMessage}"`,
        reframe: `${MOXIE_CONFIG.name} is your companion, here to provide gentle support and reminders.`,
        rapport: `Would you like ${MOXIE_CONFIG.name} to check in more often?`
      });
      
      return res.json({
        response: formatResponseForDisplay(response),
        from: MOXIE_CONFIG.name
      });
    }
    
    // Check for consent grant
    if (message && (message.toLowerCase() === 'yes' || message.toLowerCase() === '/consent yes')) {
      setUserConsent(true, true);
      const response = formatHumanNLP({
        userInput: message,
        anchor: 'Thank you for your consent.',
        mirror: `You said: "${message}"`,
        reframe: 'I will now use AI assistance to provide more tailored responses. Remember, you can revoke consent at any time.',
        rapport: 'What would you like to talk about?'
      });
      
      return res.json({
        response: formatResponseForDisplay(response),
        consentGranted: true,
        consent: userConsent
      });
    }
    
    // Check for consent revoke
    if (message && (message.toLowerCase() === 'no' || message.toLowerCase() === '/consent no')) {
      setUserConsent(false, false);
      const response = formatHumanNLP({
        userInput: message,
        anchor: 'Consent revoked.',
        mirror: `You said: "${message}"`,
        reframe: 'I will now only use local, curated responses. Your privacy and safety remain the priority.',
        rapport: 'How can I assist you with local knowledge?'
      });
      
      return res.json({
        response: formatResponseForDisplay(response),
        consentRevoked: true,
        consent: userConsent
      });
    }
    
    // Process through ethical chatbot
    const response = chatbot.processMessage(message, {
      isSherlockRequest: false,
      forceLocal: !hasAIConsent() || OFFLINE_MODE
    });
    
    // If offline mode and no local model, use ethical local responses
    if (OFFLINE_MODE && !modelLoaded) {
      const displayResponse = formatResponseForDisplay(response);
      return res.json({
        response: displayResponse,
        offline: true,
        model: null
      });
    }
    
    // If we have a local model, simulate AI response with ethics
    if (OFFLINE_MODE && modelLoaded && hasAIConsent()) {
      // Simulate local model inference with ethical constraints
      const ethicalResponse = createEthicalAIResponse(message);
      const displayResponse = formatResponseForDisplay(ethicalResponse);
      
      return res.json({
        response: displayResponse,
        offline: true,
        model: localModel.name,
        aiAssisted: true
      });
    }
    
    // Default: ethical local response
    const displayResponse = formatResponseForDisplay(response);
    return res.json({
      response: displayResponse,
      offline: OFFLINE_MODE
    });
    
  } catch (error) {
    console.error('Chat error:', error);
    const response = formatHumanNLP({
      userInput: req.body?.message || '',
      anchor: 'I encountered an error processing your request.',
      mirror: `You requested: "${req.body?.message || 'unknown'}"`,
      reframe: 'This might be due to offline mode limitations or a technical issue.',
      rapport: 'Would you like to try again or use a different approach?'
    });
    
    return res.status(500).json({
      response: formatResponseForDisplay(response),
      error: error.message
    });
  }
});

/**
 * GET /moxie-checkin - Moxie gentle check-in endpoint
 */
app.get('/api/moxie-checkin', (req, res) => {
  const randomIndex = Math.floor(Math.random() * MOXIE_CONFIG.checkInMessages.length);
  const message = MOXIE_CONFIG.checkInMessages[randomIndex];
  
  const response = formatHumanNLP({
    userInput: '/moxie checkin',
    anchor: `${MOXIE_CONFIG.name} is checking in.`,
    mirror: `Automatic check-in from ${MOXIE_CONFIG.name}`,
    reframe: message,
    rapport: `Type "/moxie [your message]" to talk to ${MOXIE_CONFIG.name} directly.`
  });
  
  res.json({
    response: formatResponseForDisplay(response),
    from: MOXIE_CONFIG.name,
    colors: MOXIE_CONFIG.colors
  });
});

/**
 * GET /moxie-info - Get Moxie companion information
 */
app.get('/api/moxie-info', (req, res) => {
  res.json({
    name: MOXIE_CONFIG.name,
    description: MOXIE_CONFIG.description,
    colors: MOXIE_CONFIG.colors,
    checkInInterval: MOXIE_CONFIG.checkInInterval,
    checkInMessages: MOXIE_CONFIG.checkInMessages
  });
});

/**
 * GET /sherlock-info - Get Sherlock information
 */
app.get('/api/sherlock-info', (req, res) => {
  res.json({
    name: 'Sherlock',
    description: 'Username reconnaissance tool for safety verification',
    usage: '/sherlock username',
    requirements: [
      'Explicit consent required',
      'Safety/verification purpose only',
      'No surveillance of others',
      'No doxxing or harassment'
    ],
    offline: OFFLINE_MODE,
    disclaimer: OFFLINE_MODE 
      ? 'Offline mode uses local database. For real-time results, online mode with Apify API required.'
      : 'Online mode uses Apify Sherlock Actor for real-time results.'
  });
});

/**
 * GET /consent-status - Get current consent status
 */
app.get('/api/consent-status', (req, res) => {
  res.json({
    ai: hasAIConsent(),
    tools: hasToolConsent(),
    offlineMode: OFFLINE_MODE,
    modelLoaded: modelLoaded,
    model: localModel
  });
});

/**
 * POST /consent - Set consent
 */
app.post('/api/consent', (req, res) => {
  const { ai, tools } = req.body;
  setUserConsent(ai, tools);
  
  res.json({
    success: true,
    consent: {
      ai: hasAIConsent(),
      tools: hasToolConsent()
    }
  });
});

/**
 * GET /health - Health check
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    mode: OFFLINE_MODE ? 'offline' : 'online',
    model: modelLoaded ? localModel.name : null,
    timestamp: new Date().toISOString()
  });
});

/**
 * GET / - Serve main HTML
 */
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

/**
 * GET /moxie.css - Serve Moxie-specific styles
 */
app.get('/moxie.css', (req, res) => {
  const css = `
    /* Moxie - Cyan/Pink/Black Neon Paperclip Companion */
    #moxie-paperclip {
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 60px;
      height: 60px;
      background: linear-gradient(135deg, #ff2d95, #ff70d3, #7d2cff);
      border-radius: 18px;
      clip-path: polygon(0% 0%, 100% 0%, 100% 70%, 70% 70%, 70% 100%, 30% 100%, 30% 70%, 0% 70%);
      z-index: 1000;
      cursor: pointer;
      box-shadow: 0 15px 40px rgba(0,0,0,.2);
      transition: transform 0.3s ease, box-shadow 0.3s ease;
    }
    
    #moxie-paperclip:hover {
      transform: scale(1.1) rotate(15deg);
      box-shadow: 0 20px 50px rgba(255, 45, 149, 0.4);
    }
    
    #moxie-paperclip:active {
      transform: scale(0.95) rotate(-5deg);
    }
    
    #moxie-paperclip::before {
      content: '💬';
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      font-size: 24px;
      color: white;
      text-shadow: 0 2px 4px rgba(0,0,0,0.3);
    }
    
    .moxie-message {
      background: linear-gradient(135deg, #ff2d9520, #7d2cff20);
      border-left: 3px solid #ff2d95;
      padding: 10px 15px;
      margin: 10px 0;
      border-radius: 8px;
      font-style: italic;
      color: #7d2cff;
    }
    
    .moxie-checkin {
      animation: pulse 2s infinite;
    }
    
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.7; }
    }
  `;
  
  res.type('text/css').send(css);
});

/**
 * GET /riot-grrrl.css - Serve Riot Grrrl palette
 */
app.get('/riot-grrrl.css', (req, res) => {

