/**
 * SXWer AI ChatBot - Offline Server
 *
 * USB/Portable version with local model and runtime
 * No API keys, Cloudflare Workers, or network connections required
 *
 * Features:
 * - Offline-first local responses with optional Python/Ollama inference
 * - Moxie companion integration
 * - Sherlock command-only interface
 * - Riot Grrrl CSS palette
 * - Full ethics enforcement
 *
 * Design coverage preserved from the earlier analysis:
 * - trauma-informed and privacy-first behavior
 * - consent-gated AI and tool use
 * - offline-first local operation with local fallback
 * - safe support flows for crisis and sensitive contexts
 */

import "dotenv/config";
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import csrf from "csrf";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import resources from "./resources.json" with { type: "json" };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================================================
// SECURITY MIDDLEWARE CONFIGURATION
// ============================================================================

// Helmet for security headers
app.use(helmet());

// CORS configuration - restrict to localhost origins for development
const corsOptions = {
  origin: [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8080",
    "http://127.0.0.1:8080",
  ],
  optionsSuccessStatus: 200,
  credentials: true,
};
app.use(cors(corsOptions));

// Rate limiting - 100 requests per 15 minutes per IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: "Too many requests",
    details: "Please try again later. If you believe this is an error, contact support.",
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Apply rate limiting to all API routes
app.use("/api/", limiter);

// Cookie parser for CSRF token handling
app.use(cookieParser());

// CSRF protection setup
const csrfProtection = csrf({ cookie: true });

// ============================================================================
// SECURITY MIDDLEWARE
// ============================================================================

// Input validation constants
const MAX_MESSAGE_LENGTH = 10000; // 10,000 characters max
const MAX_SESSION_ID_LENGTH = 64;
const ALLOWED_SESSION_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

/**
 * Validate chat message input
 * @param {string} message - User message to validate
 * @returns {boolean} True if valid
 */
function isValidMessage(message) {
  if (typeof message !== "string") {
    return false;
  }
  if (message.length === 0) {
    return false;
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return false;
  }
  return true;
}

/**
 * Validate session ID format
 * @param {string} sessionId - Session ID to validate
 * @returns {boolean} True if valid
 */
function isValidSessionId(sessionId) {
  if (typeof sessionId !== "string") {
    return false;
  }
  if (sessionId.length === 0 || sessionId.length > MAX_SESSION_ID_LENGTH) {
    return false;
  }
  return ALLOWED_SESSION_ID_PATTERN.test(sessionId);
}

/**
 * Validate consent object structure
 * @param {Object} consent - Consent object to validate
 * @returns {boolean} True if valid
 */
function isValidConsent(consent) {
  if (typeof consent !== "object" || consent === null) {
    return false;
  }
  if ("ai" in consent && typeof consent.ai !== "boolean") {
    return false;
  }
  if ("tools" in consent && typeof consent.tools !== "boolean") {
    return false;
  }
  return true;
}

/**
 * Validate local permissions object structure
 * @param {Object} permissions - Permissions object to validate
 * @returns {boolean} True if valid
 */
function isValidLocalPermissions(permissions) {
  if (typeof permissions !== "object" || permissions === null) {
    return false;
  }
  if ("offline" in permissions && typeof permissions.offline !== "boolean") {
    return false;
  }
  if ("scope" in permissions && typeof permissions.scope !== "string") {
    return false;
  }
  return true;
}

/**
 * Input validation middleware for chat requests
 */
function validateChatInput(req, res, next) {
  const { message, consent, localPermissions, mode } = req.body;

  // Validate message
  if (message !== undefined && !isValidMessage(message)) {
    return res.status(400).json({
      error: "Invalid message",
      details: "Message must be a non-empty string with maximum 10,000 characters",
    });
  }

  // Validate consent
  if (consent !== undefined && !isValidConsent(consent)) {
    return res.status(400).json({
      error: "Invalid consent",
      details: "Consent must be an object with boolean 'ai' and 'tools' properties",
    });
  }

  // Validate localPermissions
  if (localPermissions !== undefined && !isValidLocalPermissions(localPermissions)) {
    return res.status(400).json({
      error: "Invalid local permissions",
      details: "Local permissions must be an object with boolean 'offline' and string 'scope' properties",
    });
  }

  // Validate mode
  if (mode !== undefined && typeof mode !== "string") {
    return res.status(400).json({
      error: "Invalid mode",
      details: "Mode must be a string ('online' or 'offline')",
    });
  }

  next();
}

// Middleware
app.use(express.json({ limit: "1mb" })); // Reduced from 10mb for security
app.use("/public", express.static(path.join(__dirname, "public"), { index: false }));

// ============================================================================
// OFFLINE MODE CONFIGURATION
// ============================================================================

const OFFLINE_MODE = process.env.OFFLINE_MODE === "true";
const LOCAL_MODEL_PATH =
  process.env.LOCAL_MODEL_PATH || path.join(__dirname, "models");
const ONLINE_API_ENABLED =
  process.env.ONLINE_API_ENABLED === "true" ||
  Boolean(process.env.MISTRAL_API_KEY);
const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY || "";
const MISTRAL_API_BASE =
  process.env.MISTRAL_API_BASE || "https://api.mistral.ai/v1/chat/completions";
const MISTRAL_MODEL = process.env.MISTRAL_MODEL || "mistral-small-latest";

// Optional Python microservice (NLP, local LLM, voice, resource management)
const PYTHON_API_URL = process.env.PYTHON_API_URL || "";

console.log(`\nSXWer AI ChatBot - ${OFFLINE_MODE ? "OFFLINE" : "ONLINE"} Mode`);
console.log(`Model Path: ${LOCAL_MODEL_PATH}`);
console.log(
  `Online API: ${ONLINE_API_ENABLED && MISTRAL_API_KEY ? "configured" : "disabled"}`,
);
console.log(
  `Python service: ${PYTHON_API_URL ? PYTHON_API_URL : "not configured (optional)"}`,
);
console.log(`Server: http://localhost:${PORT}\n`);

// ============================================================================
// LOCAL MODEL LOADING (Offline)
// ============================================================================

let localModel = null;
let modelLoaded = false;
const DEFAULT_LOCAL_PERMISSIONS = Object.freeze({
  offline: false,
  grantedAt: null,
  scope: "offline",
});
const localPermissionStore = new Map();
const pendingSherlockStore = new Map();

function resolveSessionId(sessionId = "default") {
  const normalized = String(sessionId || "default").trim();
  // Validate session ID format for security
  if (!isValidSessionId(normalized)) {
    console.warn(`Invalid session ID format: ${sessionId}, defaulting to "default"`);
    return "default";
  }
  return normalized || "default";
}

function getSessionIdFromRequest(req) {
  return resolveSessionId(
    req.body?.sessionId ||
      req.get("x-session-id") ||
      req.query?.sessionId ||
      "default",
  );
}

function setLocalPermissions(sessionId = "default", permissions = {}) {
  const normalizedSessionId = resolveSessionId(sessionId);
  const localPermissionState = {
    offline: Boolean(permissions.offline),
    grantedAt: permissions.grantedAt || null,
    scope: permissions.scope || "offline",
  };
  localPermissionStore.set(normalizedSessionId, localPermissionState);
  return localPermissionState;
}

function getLocalPermissions(sessionId = "default") {
  return {
    ...(localPermissionStore.get(resolveSessionId(sessionId)) ||
      DEFAULT_LOCAL_PERMISSIONS),
  };
}

function hasOfflineLocalPermission(sessionId = "default") {
  return getLocalPermissions(sessionId).offline === true;
}

function getRequestedMode(mode = "offline") {
  return String(mode).toLowerCase() === "online" ? "online" : "offline";
}

function shouldAllowOnlineMode(requestedMode) {
  return !OFFLINE_MODE && requestedMode === "online";
}

function shouldUseOnlineApi(requestedMode) {
  return (
    shouldAllowOnlineMode(requestedMode) &&
    ONLINE_API_ENABLED &&
    Boolean(MISTRAL_API_KEY)
  );
}

/**
 * Inspect local model assets for optional offline inference
 * Real inference is delegated to the Python/Ollama path when available.
 */
async function loadLocalModel() {
  try {
    console.log("Inspecting local model assets...");

    // Check if model files exist
    const modelFiles = fs.readdirSync(LOCAL_MODEL_PATH);
    console.log(` Found model files: ${modelFiles.join(", ")}`);
    const runnableModelFile = modelFiles.find((file) =>
      /\.(gguf|bin|onnx|safetensors)$/i.test(file),
    );
    if (!runnableModelFile) {
      throw new Error("No runnable local model assets were found");
    }

    localModel = {
      name: runnableModelFile,
      type: "offline-assets",
      path: path.join(LOCAL_MODEL_PATH, runnableModelFile),
      loaded: false,
    };

    modelLoaded = false;
    console.log(
      "Local model assets detected. Use the Python/Ollama path for real local inference.",
    );
  } catch (error) {
    console.warn("No runnable local model assets detected:", error.message);
    console.log("Falling back to ethical local responses only");
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
  getConsentState,
  checkSherlockProtocol,
  requestSherlockConsent,
  formatHumanNLP,
  truncateForMirror,
} from "./chatbot.js";

// ============================================================================
// SHERLOCK OFFLINE IMPLEMENTATION
// ============================================================================

/**
 * Offline Sherlock - simulates username checking without network
 * In a real implementation, this would use local databases or cached data
 */
const OFFLINE_SHERLOCK_DB = {
  // Sample data for demonstration
  testuser: {
    username: "testuser",
    websites: [
      { name: "Twitter", url_user: "twitter.com/testuser" },
      { name: "Instagram", url_user: "instagram.com/testuser" },
    ],
  },
  demo: {
    username: "demo",
    websites: [{ name: "GitHub", url_user: "github.com/demo" }],
  },
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
        websites: [],
      });
    }
  }

  return {
    results,
    message:
      "Offline Sherlock search completed. Results show usernames found in local database.",
    offline: true,
    disclaimer:
      "This is a local demonstration dataset for safety-oriented checks.",
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
  name: "Moxie",
  description:
    "Your desktop companion that can work inside this chat or outside it",
  colors: {
    pink: "#ff2d95",
    hotPink: "#ff4fb4",
    purple: "#7d2cff",
    black: "#111111",
    white: "#ffffff",
  },
  checkInInterval: 120000, // 2 minutes
  checkInMessages: [
    "How are you feeling right now?",
    "Remember, you're in control here.",
    "Take a breath. I'm here when you're ready.",
    "Your pace, your choices. Always.",
    "You're doing great. Want to talk about anything?",
    "This is your space. No judgment, no pressure.",
    "Gentle reminder: Your dignity and autonomy matter.",
    "I'm here to listen without judgment. What's on your mind?",
  ],
};

function createEthicalAIResponse(message) {
  return formatHumanNLP({
    userInput: message,
    anchor: "I’m responding with the built-in ethical local guidance.",
    mirror: `You asked: "${truncateForMirror(message)}"`,
    reframe:
      "I can offer a supportive, privacy-conscious reply without requiring external services. Your safety, dignity, and autonomy remain the priority.",
    rapport:
      "Would you like to continue with this local response, or would you prefer a different approach?",
    isAI: true,
  });
}

async function callOnlineModel(message) {
  if (!ONLINE_API_ENABLED || !MISTRAL_API_KEY) {
    throw new Error("Online API is not configured");
  }

  const endpoint = MISTRAL_API_BASE.includes("/chat/completions")
    ? MISTRAL_API_BASE
    : `${MISTRAL_API_BASE.replace(/\/$/, "")}/chat/completions`;

  const payload = {
    model: MISTRAL_MODEL,
    messages: [
      {
        role: "system",
        content:
          "You are SXWer AI ChatBot, a trauma-informed, privacy-first assistant. Be supportive, non-judgmental, and transparent about limitations. Avoid diagnosis, never claim authority, and respond with care.",
      },
      {
        role: "user",
        content: message,
      },
    ],
    temperature: 0.7,
    max_tokens: 320,
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${MISTRAL_API_KEY}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Online API request failed (${response.status}): ${errorText}`,
    );
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content?.trim();

  if (!content) {
    throw new Error("Online API returned no usable reply");
  }

  return content;
}

function buildOnlineResponse(message, aiText) {
  return formatHumanNLP({
    userInput: message,
    anchor: "Here is an AI-assisted response.",
    mirror: `You asked: "${truncateForMirror(message)}"`,
    reframe: aiText,
    rapport:
      "Would you like to continue exploring this, or would you prefer a local-only response?",
    isAI: true,
  });
}

// ============================================================================
// PYTHON MICROSERVICE INTEGRATION (Optional — degrades gracefully)
// ============================================================================

/**
 * Check whether the Python microservice is reachable.
 * Returns false silently when the service is not configured or not running.
 */
async function isPythonServiceAvailable() {
  if (!PYTHON_API_URL) return false;
  try {
    const response = await fetch(`${PYTHON_API_URL}/health`, {
      signal: AbortSignal.timeout(2000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Classify text for safety/crisis signals using the Python ML classifier.
 * Falls back to the built-in chatbot.js keyword detection on any failure.
 *
 * @param {string} text - User input to classify
 * @returns {Promise<Object|null>} Safety result or null if unavailable
 */
async function callPythonSafetyClassifier(text) {
  if (!PYTHON_API_URL) return null;
  try {
    const response = await fetch(`${PYTHON_API_URL}/nlp/classify-safety`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

/**
 * Generate a response using the local Ollama LLM via the Python service.
 * Requires user AI consent. Returns null if unavailable.
 *
 * @param {string} message - User message
 * @returns {Promise<string|null>} AI response text or null if unavailable
 */
async function callPythonLocalLLM(message, sessionId = "default") {
  if (!PYTHON_API_URL || !hasAIConsent(sessionId)) return null;
  try {
    const response = await fetch(`${PYTHON_API_URL}/llm/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, consent: true, max_tokens: 320 }),
      signal: AbortSignal.timeout(60000),
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data.response || null;
  } catch {
    return null;
  }
}

/**
 * Analyze intent and sentiment via the Python NLP service.
 * Requires user AI consent. Returns null if unavailable.
 *
 * @param {string} text - User input
 * @returns {Promise<Object|null>} NLP analysis result or null if unavailable
 */
async function callPythonNLP(text, sessionId = "default") {
  if (!PYTHON_API_URL || !hasAIConsent(sessionId)) return null;
  try {
    const response = await fetch(`${PYTHON_API_URL}/nlp/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, consent: true }),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

// ============================================================================
// API ENDPOINTS
// ============================================================================

/**
 * POST /chat - Handle chat messages
 * Enforces all ethical constraints
 */
app.post("/api/chat", validateChatInput, csrfProtection, async (req, res) => {
  try {
    const { message, consent, localPermissions, mode } = req.body;
    const sessionId = getSessionIdFromRequest(req);
    const requestedMode = getRequestedMode(mode);
    const onlineModeAllowed = shouldAllowOnlineMode(requestedMode);
    const onlineApiActive = shouldUseOnlineApi(requestedMode);

    // Update consent if provided
    if (consent && typeof consent === "object") {
      setUserConsent(consent.ai, consent.tools, sessionId);
    }

    if (localPermissions && typeof localPermissions === "object") {
      setLocalPermissions(sessionId, localPermissions);
    }

    // Check for Sherlock command
    if (message && message.startsWith("/sherlock ")) {
      const username = message.substring(10).trim();

      if (requestedMode === "offline" && !hasOfflineLocalPermission(sessionId)) {
        return res.json({
          response: formatResponseForDisplay(
            formatHumanNLP({
              userInput: message,
              anchor: "Offline local access requires your permission.",
              mirror: `You requested: "${message}"`,
              reframe:
                "This app can use local-only data for safety checks only after you explicitly allow it.",
              rapport:
                "Would you like to allow local-only access for this offline session?",
            }),
          ),
          requiresLocalPermission: true,
          localPermissionScope: "offline",
        });
      }

      // Check Sherlock protocol
      const protocolCheck = checkSherlockProtocol(message, { sessionId });

      if (!protocolCheck.allowed && protocolCheck.reason !== "EXPLICIT_CONSENT_REQUIRED") {
        return res.json({
          response: formatResponseForDisplay(
            formatHumanNLP({
              userInput: message,
              anchor: "I need to ensure Sherlock is used appropriately.",
              mirror: `You requested: "${message}"`,
              reframe: protocolCheck.message,
              rapport:
                "Would you like to rephrase this as a safety check for your own username?",
            }),
          ),
          requiresConsent: false,
        });
      }

      if (!protocolCheck.allowed || !hasToolConsent(sessionId)) {
        pendingSherlockStore.set(sessionId, username);
        const response = requestSherlockConsent(username);
        return res.json({
          response: formatResponseForDisplay(response),
          requiresConsent: true,
          consentType: "sherlock",
        });
      }

      // Perform offline Sherlock search
      const results = offlineSherlockSearch([username]);

      const response = formatHumanNLP({
        userInput: message,
        anchor: "Sherlock search completed (offline mode).",
        mirror: `You requested: "${message}"`,
        reframe: `Here are the results from local database: ${JSON.stringify(results.results)}. ${results.disclaimer}`,
        rapport:
          "Would you like help interpreting these results or planning next steps?",
      });

      return res.json({
        response: formatResponseForDisplay(response),
        results: results.results,
        offline: true,
      });
    }

    // Handle /resources and /help commands
    if (message === "/resources" || message === "/help") {
      const response = formatHumanNLP({
        userInput: message,
        anchor: "Here are resources and support organizations for sex workers:",
        mirror: `You asked: "${message}"`,
        reframe:
          "These organizations provide support, advocacy, and resources:",
        rapport:
          "Type /sherlock username - Check username\n/moxie message - Talk to Moxie\n/consent yes - Enable AI\n/consent no - Disable AI\n/resources - Show this list",
      });

      // Include resources in the response
      return res.json({
        response: formatResponseForDisplay(response),
        resources: resources.organizations,
        crisis_resources: resources.crisis_resources,
        safety_tips: resources.safety_tips,
      });
    }

    // Check for Moxie command
    if (message && message.startsWith("/moxie ")) {
      const moxieMessage = message.substring(7).trim();
      const response = formatHumanNLP({
        userInput: message,
        anchor: `${MOXIE_CONFIG.name} hears you.`,
        mirror: `You said to ${MOXIE_CONFIG.name}: "${moxieMessage}"`,
        reframe: `${MOXIE_CONFIG.name} is your companion, here to provide gentle support and reminders.`,
        rapport: `Would you like ${MOXIE_CONFIG.name} to check in more often?`,
      });

      return res.json({
        response: formatResponseForDisplay(response),
        from: MOXIE_CONFIG.name,
      });
    }

    // Check for consent grant
    if (
      message &&
      (message.toLowerCase() === "yes" ||
        message.toLowerCase() === "/consent yes")
    ) {
      const pendingSherlockUsername = pendingSherlockStore.get(sessionId) || null;
      if (pendingSherlockUsername) {
        setUserConsent(hasAIConsent(sessionId), true, sessionId);
        pendingSherlockStore.delete(sessionId);

        if (requestedMode === "offline" && !hasOfflineLocalPermission(sessionId)) {
          return res.json({
            response: formatResponseForDisplay(
              formatHumanNLP({
                userInput: message,
                anchor: "Sherlock consent saved.",
                mirror: `You said: "${message}"`,
                reframe:
                  "I still need local-only permission before running the offline Sherlock check.",
                rapport:
                  "Would you like to allow local-only access for this offline session?",
              }),
            ),
            requiresLocalPermission: true,
            localPermissionScope: "offline",
            consentGranted: true,
            consent: getConsentState(sessionId),
            consentType: "sherlock",
          });
        }

        const results = offlineSherlockSearch([pendingSherlockUsername]);
        const sherlockResponse = formatHumanNLP({
          userInput: `/sherlock ${pendingSherlockUsername}`,
          anchor: "Consent confirmed and Sherlock search completed (offline mode).",
          mirror: `You confirmed consent for: "${pendingSherlockUsername}"`,
          reframe: `Here are the results from local database: ${JSON.stringify(results.results)}. ${results.disclaimer}`,
          rapport:
            "Would you like help interpreting these results or planning next steps?",
        });

        return res.json({
          response: formatResponseForDisplay(sherlockResponse),
          results: results.results,
          offline: true,
          consentGranted: true,
          consent: getConsentState(sessionId),
          consentType: "sherlock",
        });
      } else {
        setUserConsent(true, true, sessionId);
      }
      const response = formatHumanNLP({
        userInput: message,
        anchor: "Thank you for your consent.",
        mirror: `You said: "${message}"`,
        reframe:
          "I will now use AI assistance to provide more tailored responses. Remember, you can revoke consent at any time.",
        rapport: "What would you like to talk about?",
      });

      return res.json({
        response: formatResponseForDisplay(response),
        consentGranted: true,
        consent: getConsentState(sessionId),
        consentType: pendingSherlockUsername ? "sherlock" : "ai",
      });
    }

    // Check for consent revoke
    if (
      message &&
      (message.toLowerCase() === "no" ||
        message.toLowerCase() === "/consent no")
    ) {
      setUserConsent(false, false, sessionId);
      pendingSherlockStore.delete(sessionId);
      const response = formatHumanNLP({
        userInput: message,
        anchor: "Consent revoked.",
        mirror: `You said: "${message}"`,
        reframe:
          "I will now only use local, curated responses. Your privacy and safety remain the priority.",
        rapport: "How can I assist you with local knowledge?",
      });

      return res.json({
        response: formatResponseForDisplay(response),
        consentRevoked: true,
        consent: getConsentState(sessionId),
      });
    }

    // Process through ethical chatbot
    const response = chatbot.processMessage(message, {
      isSherlockRequest: false,
      forceLocal: !hasAIConsent(sessionId),
      sessionId,
    });

    // Enhanced safety check: use Python ML classifier when available,
    // in addition to the built-in keyword detection already run above.
    const pythonSafety = await callPythonSafetyClassifier(message);
    if (
      pythonSafety &&
      pythonSafety.is_sensitive &&
      pythonSafety.label === "crisis"
    ) {
      // Python classifier found a crisis signal not caught by keywords
      const crisisResponse = formatHumanNLP({
        userInput: message,
        anchor: "That sounds really painful. You're not alone.",
        mirror: `You shared: "${truncateForMirror(message, 50)}"`,
        reframe: `I'm not a therapist or replacement for human connection. Your feelings are valid, and your safety matters.`,
        rapport: `Are you safe right now? Crisis Text Line is available 24/7: Text HOME to 741741. Would you like more resources?`,
        isCrisis: true,
      });
      return res.json({
        response: formatResponseForDisplay(crisisResponse),
        safetyFlag: pythonSafety,
        isCrisis: true,
      });
    }

    // AI-assisted response: try Python local LLM first (fully on-device),
    // then fall back to external Mistral API, then to local ethical response.
    const pythonNlp = await callPythonNLP(message, sessionId);

    if (hasAIConsent(sessionId)) {
      // 1. Python local LLM (Ollama — no external API, highest privacy)
      const localLLMText = await callPythonLocalLLM(message, sessionId);
      if (localLLMText) {
        const localLLMResponse = buildOnlineResponse(message, localLLMText);
        return res.json({
          response: formatResponseForDisplay(localLLMResponse),
          offline: true,
          provider: "ollama",
          aiAssisted: true,
          nlp: pythonNlp,
        });
      }

      // 2. External Mistral API (online mode only)
      if (onlineApiActive) {
        try {
          const aiText = await callOnlineModel(message);
          const onlineResponse = buildOnlineResponse(message, aiText);
          return res.json({
            response: formatResponseForDisplay(onlineResponse),
            offline: false,
            online: true,
            provider: "mistral",
            model: MISTRAL_MODEL,
            aiAssisted: true,
            nlp: pythonNlp,
          });
        } catch (error) {
          console.warn(
            "Online API call failed, falling back to local response:",
            error.message,
          );
        }
      }
    }

    // Default: ethical local response
    const displayResponse = formatResponseForDisplay(response);
    return res.json({
      response: displayResponse,
      offline: !onlineApiActive,
      online: onlineApiActive,
      model: localModel?.name || null,
      nlp: pythonNlp,
    });
  } catch (error) {
    console.error("Chat error:", error);
    const response = formatHumanNLP({
      userInput: req.body?.message || "",
      anchor: "I encountered an error processing your request.",
      mirror: `You requested: "${req.body?.message || "unknown"}"`,
      reframe:
        "This might be due to offline mode limitations or a technical issue.",
      rapport: "Would you like to try again or use a different approach?",
    });

    return res.status(500).json({
      response: formatResponseForDisplay(response),
      error: error.message,
    });
  }
});

/**
 * GET /api/python-status - Python microservice availability and features
 */
app.get("/api/python-status", async (req, res) => {
  const available = await isPythonServiceAvailable();

  if (!available) {
    return res.json({
      available: false,
      url: PYTHON_API_URL || null,
      message: PYTHON_API_URL
        ? "Python service is configured but not reachable. Start it with: cd python && uvicorn app:app --host 127.0.0.1 --port 8000"
        : "Python service is not configured. Set PYTHON_API_URL in .env to enable enhanced NLP, local LLM, and voice features.",
    });
  }

  try {
    const response = await fetch(`${PYTHON_API_URL}/health`, {
      signal: AbortSignal.timeout(3000),
    });
    const health = await response.json();
    return res.json({ available: true, url: PYTHON_API_URL, health });
  } catch {
    return res.json({ available: true, url: PYTHON_API_URL });
  }
});

/**
 * GET /moxie-checkin - Moxie gentle check-in endpoint
 */
app.post("/api/local-permissions", csrfProtection, (req, res) => {
  const sessionId = getSessionIdFromRequest(req);
  const { allow, scope } = req.body || {};
  const granted = Boolean(allow);

  const localPermissionState = setLocalPermissions(sessionId, {
    offline: granted,
    grantedAt: granted ? new Date().toISOString() : null,
    scope: scope || "offline",
  });

  res.json({
    allowed: granted,
    scope: scope || "offline",
    localPermissions: localPermissionState,
  });
});

app.get("/api/moxie-checkin", (req, res) => {
  const randomIndex = Math.floor(
    Math.random() * MOXIE_CONFIG.checkInMessages.length,
  );
  const message = MOXIE_CONFIG.checkInMessages[randomIndex];

  const response = formatHumanNLP({
    userInput: "/moxie checkin",
    anchor: `${MOXIE_CONFIG.name} is checking in.`,
    mirror: `Automatic check-in from ${MOXIE_CONFIG.name}`,
    reframe: message,
    rapport: `Type "/moxie [your message]" to talk to ${MOXIE_CONFIG.name} directly.`,
  });

  res.json({
    response: formatResponseForDisplay(response),
    from: MOXIE_CONFIG.name,
    colors: MOXIE_CONFIG.colors,
  });
});

/**
 * GET /moxie-info - Get Moxie companion information
 */
app.get("/api/moxie-info", (req, res) => {
  res.json({
    name: MOXIE_CONFIG.name,
    description: MOXIE_CONFIG.description,
    colors: MOXIE_CONFIG.colors,
    checkInInterval: MOXIE_CONFIG.checkInInterval,
    checkInMessages: MOXIE_CONFIG.checkInMessages,
  });
});

/**
 * GET /sherlock-info - Get Sherlock information
 */
app.get("/api/sherlock-info", (req, res) => {
  res.json({
    name: "Sherlock",
    description: "Username reconnaissance tool for safety verification",
    usage: "/sherlock username",
    requirements: [
      "Explicit consent required",
      "Safety/verification purpose only",
      "No surveillance of others",
      "No doxxing or harassment",
    ],
    offline: OFFLINE_MODE,
    disclaimer: OFFLINE_MODE
      ? "Offline mode uses the local demonstration database only."
      : "This server currently supports the local demonstration database only. The online path still keeps Sherlock limited to safety-oriented use.",
  });
});

/**
 * GET /consent-status - Get current consent status
 */
app.get("/api/consent-status", (req, res) => {
  const sessionId = getSessionIdFromRequest(req);
  res.json({
    ai: hasAIConsent(sessionId),
    tools: hasToolConsent(sessionId),
    offlineMode: OFFLINE_MODE,
    modelLoaded: modelLoaded,
    model: localModel,
    localPermissions: getLocalPermissions(sessionId),
  });
});

/**
 * POST /consent - Set consent
 */
app.post("/api/consent", csrfProtection, (req, res) => {
  const sessionId = getSessionIdFromRequest(req);
  const { ai, tools } = req.body;
  setUserConsent(ai, tools, sessionId);

  res.json({
    success: true,
    consent: getConsentState(sessionId),
  });
});

/**
 * GET /health - Health check
 */
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    mode: OFFLINE_MODE ? "offline" : "online",
    model: localModel?.name || null,
    modelLoaded: modelLoaded,
    localInference: "python-ollama",
    onlineApiConfigured: Boolean(MISTRAL_API_KEY),
    onlineModel: MISTRAL_MODEL,
    supportsRequestedOnlineMode: !OFFLINE_MODE,
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET / - Serve main HTML
 */
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

/**
 * Start server
 */
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
