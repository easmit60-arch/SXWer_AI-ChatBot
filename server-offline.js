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
import {
  recordConsent,
  revokeConsent,
  verifyConsent,
  recordDeletion,
  recordExport,
  recordPolicyAcceptance,
  getConsentHistory,
  exportLedger,
  clearLocalLedger,
  getConsentStatus,
} from "./services/blockchain/consentLedger.js";
import { disconnectWallet, getWalletInfo, isWalletConnected } from "./services/blockchain/walletService.js";
import { BLOCKCHAIN_ENABLED, INFORMED_CONSENT_DISCLOSURE } from "./services/blockchain/ledgerConfig.js";
import {
  getServerPublicKeyBase64,
  getKeyPairMetadata,
  getServerKeyPair,
  registerClientPublicKey,
  getClientPublicKey,
  removeClientPublicKey,
} from "./services/crypto/keyManager.js";
import {
  encryptMessage,
  decryptMessage,
  isValidEnvelope,
  envelopeSummary,
} from "./services/crypto/messageEncryption.js";
import { acceptNonce, clearSessionNonces } from "./services/crypto/replayGuard.js";
import { ENCRYPTION_DISCLOSURE } from "./services/crypto/cryptoConfig.js";
import {
  clearAuditTimeline,
  getAuditSummary,
  getAuditTimeline,
  recordAuditEvent,
} from "./services/human-rights/auditService.js";
import {
  clearConsentHistory,
  getConsentDashboard,
  revokeConsentScopes,
  setConsentState,
  updateConsentFromLegacy,
} from "./services/human-rights/versionedConsentService.js";
import {
  buildDataManagerSnapshot,
  buildExportPackage,
} from "./services/human-rights/dataManagerService.js";
import {
  buildResponseTransparency,
  clearLatestTransparencyRecord,
  getLatestTransparencyRecord,
} from "./services/human-rights/transparencyService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const MAX_MESSAGE_LENGTH = Number(process.env.MAX_MESSAGE_LENGTH || 4000);
const SESSION_ID_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;
const ALLOWED_ORIGINS = (process.env.CORS_ALLOWED_ORIGINS ||
  "http://localhost:3000,http://127.0.0.1:3000")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const CONTENT_SECURITY_POLICY = Object.freeze({
  directives: {
    defaultSrc: ["'self'"],
    baseUri: ["'self'"],
    connectSrc: ["'self'"],
    fontSrc: ["'self'", "data:"],
    frameAncestors: ["'none'"],
    imgSrc: ["'self'", "data:"],
    objectSrc: ["'none'"],
    scriptSrc: ["'self'", "'unsafe-inline'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
  },
});
const HUMAN_RIGHTS_PAGES = Object.freeze([
  "privacy-dashboard",
  "consent-dashboard",
  "data-manager",
  "export-center",
  "delete-my-data",
  "transparency-center",
  "accessibility-center",
  "ai-disclosure",
  "human-rights-report",
  "security-status",
  "explain-this-response",
]);
const ACCESSIBILITY_GUARANTEES = Object.freeze([
  "Keyboard-accessible navigation and skip links on every dashboard page.",
  "Focus-visible controls and semantic headings.",
  "Reduced-motion support via prefers-reduced-motion.",
  "Status live regions for export and delete actions.",
  "Offline-first controls remain available without AI consent.",
]);

// ============================================================================
// SECURITY MIDDLEWARE CONFIGURATION
// ============================================================================

// Helmet for security headers
app.use(helmet({ contentSecurityPolicy: CONTENT_SECURITY_POLICY }));

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
// Session token management
const sessionTokens = new Map();

function generateSessionToken() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

function createSession() {
  const token = generateSessionToken();
  const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  sessionTokens.set(token, { sessionId, createdAt: Date.now(), lastUsed: Date.now() });
  recordAuditEvent(sessionId, "session.created", "Created a new anonymous local session.", {
    offlineMode: OFFLINE_MODE,
  });
  return { token, sessionId };
}

function validateSessionToken(token) {
  if (!token || typeof token !== "string") return null;
  const session = sessionTokens.get(token);
  if (!session) return null;
  session.lastUsed = Date.now();
  return session.sessionId;
}

function requireAuth(req, res, next) {
  const token = req.headers["x-session-token"] || req.query.token;
  if (!token) {
    return res.status(401).json({ error: "Authentication required", details: "Please provide a valid session token" });
  }
  const sessionId = validateSessionToken(token);
  if (!sessionId) {
    return res.status(401).json({ error: "Invalid session token", details: "The provided session token is invalid or expired" });
  }
  req.sessionId = sessionId;
  next();
}

// Session cleanup every hour
setInterval(() => {
  const now = Date.now();
  const SESSION_TTL = 24 * 60 * 60 * 1000;
  for (const [token, session] of sessionTokens.entries()) {
    if (now - session.lastUsed > SESSION_TTL) {
      sessionTokens.delete(token);
    }
  }
}, 60 * 60 * 1000);

// CSRF protection setup
const csrfProtection = csrf({ cookie: true });

// ============================================================================
// SECURITY MIDDLEWARE
// ============================================================================

// Input validation constants
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
  `Online API: ${ONLINE_API_ENABLED ? "available when configured" : "disabled"}`,
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

function sanitizeUserMessage(input) {
  return String(input ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim();
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
    scope: permissions.scope || "offline",
  };
  if (!localPermissionState.offline) {
    localPermissionStore.delete(normalizedSessionId);
    recordAuditEvent(
      normalizedSessionId,
      "permission.local.revoked",
      "Offline local permission was revoked.",
      { scope: localPermissionState.scope },
    );
    return { ...DEFAULT_LOCAL_PERMISSIONS };
  }
  localPermissionStore.set(normalizedSessionId, localPermissionState);
  recordAuditEvent(
    normalizedSessionId,
    "permission.local.granted",
    "Offline local permission was granted.",
    localPermissionState,
  );
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

function buildHumanRightsReport(sessionId = "default") {
  const consentDashboard = getConsentDashboard(sessionId);
  const auditTimeline = getAuditTimeline(sessionId);
  const auditSummary = getAuditSummary(sessionId);
  const latestTransparency = getLatestTransparencyRecord(sessionId);
  const localPermissions = getLocalPermissions(sessionId);
  const dataManager = buildDataManagerSnapshot(sessionId, {
    consentDashboard,
    auditSummary,
    localPermissions,
    latestTransparency,
  });

  return {
    generatedAt: new Date().toISOString(),
    sessionId,
    consentDashboard,
    dataManager,
    auditTimeline,
    latestTransparency,
    accessibility: ACCESSIBILITY_GUARANTEES,
    security: {
      offlineFirst: true,
      blockchainOptional: BLOCKCHAIN_ENABLED === false,
      contentSecurityPolicy:
        "default-src 'self'; connect-src 'self'; frame-ancestors 'none'; object-src 'none'",
      rateLimit: "100 requests per 15 minutes on /api routes.",
      auditLogging: "Structured in-memory audit events with export and delete controls.",
    },
  };
}

function clearSessionHumanRightsData(sessionId = "default") {
  clearConsentHistory(sessionId);
  clearLatestTransparencyRecord(sessionId);
  setUserConsent(false, false, sessionId);
  setLocalPermissions(sessionId, { offline: false, scope: "offline" });
  pendingSherlockStore.delete(sessionId);
  clearSessionNonces(sessionId);
  clearAuditTimeline(sessionId);
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
  detectBiasInAIResponse,
  createAIExplanation,
  handleToolRequest,
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

function buildBiasMitigatedResponse(message, biasAssessment) {
  const issueSummary = biasAssessment.issues
    .map((issue) => issue.description)
    .join(", ");

  return formatHumanNLP({
    userInput: message,
    anchor: "I adjusted this reply to keep it safer and less biased.",
    mirror: `You asked: "${truncateForMirror(message)}"`,
    reframe:
      `I did not show the raw AI text because it included language that could feel harmful or stigmatizing (${issueSummary}). ` +
      "Instead, I’m keeping the response grounded in dignity, autonomy, and non-judgment.",
    rapport:
      "Would you like a local-only response, a different framing, or support resources instead?",
    isAI: true,
  });
}

function buildExplainedAIResult(message, aiText, provider, mode = "offline") {
  const biasAssessment = detectBiasInAIResponse(aiText);
  const usedFallback = biasAssessment.flagged;
  const response = usedFallback
    ? buildBiasMitigatedResponse(message, biasAssessment)
    : buildOnlineResponse(message, aiText);

  return {
    response,
    explanation: createAIExplanation({
      provider,
      mode,
      biasAssessment,
      usedFallback,
    }),
    biasAssessment,
    aiSafeguarded: usedFallback,
  };
}

function buildTransparentChatPayload({
  sessionId,
  message,
  response,
  provider = "local-curated",
  model = null,
  mode = "offline",
  aiUsed = false,
  explanation = null,
  biasAssessment = { flagged: false, issues: [] },
  extra = {},
} = {}) {
  const transparency = buildResponseTransparency({
    sessionId,
    message,
    provider,
    model,
    mode,
    aiUsed,
    sentData:
      mode === "online" && aiUsed
        ? ["User message text sent to the configured online AI provider."]
        : ["No external transfer recorded."],
    why: aiUsed
      ? "Respond using the consented AI path while preserving transparency and safety checks."
      : "Respond with local-first logic because AI was refused, unavailable, or unnecessary.",
    confidence: aiUsed ? "medium" : "high",
    limitations: aiUsed
      ? ["AI support can be imperfect, incomplete, or shaped by training data."]
      : ["Local rule-based support may be less tailored than an opted-in AI response."],
    safetyChecks: [
      "Anchor",
      "Mirror",
      "Reframe",
      "Rapport",
      "Safety Check",
      "Bias Check",
      "Transparency Check",
      "Human Rights Check",
    ],
    biasAssessment,
    explanation,
  });

  recordAuditEvent(
    sessionId,
    "response.generated",
    aiUsed ? "Generated an AI-disclosed response." : "Generated a local-first response.",
    {
      aiUsed,
      provider,
      mode,
    },
  );

  return {
    response: formatResponseForDisplay(response),
    offline: mode !== "online",
    online: mode === "online",
    provider,
    model,
    aiAssisted: aiUsed,
    transparency,
    ...extra,
  };
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
app.post("/api/chat", validateChatInput, csrfProtection, requireAuth, async (req, res) => {
  try {
    const { message: rawMessage, consent, localPermissions, mode } = req.body;
    const sessionId = getSessionIdFromRequest(req);
    const message = sanitizeUserMessage(rawMessage);
    const requestedMode = getRequestedMode(mode);
    const onlineModeAllowed = shouldAllowOnlineMode(requestedMode);
    const onlineApiActive = shouldUseOnlineApi(requestedMode);

    if (!message) {
      return res.status(400).json({
        error: "Message is required and must be a non-empty string.",
      });
    }
    if (message.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({
        error: `Message exceeds maximum length of ${MAX_MESSAGE_LENGTH} characters.`,
      });
    }

    // Update consent if provided
    if (consent && typeof consent === "object") {
      setUserConsent(consent.ai, consent.tools, sessionId);
      updateConsentFromLegacy(sessionId, {
        ai: consent.ai,
        tools: consent.tools,
        reason: consent.reason || "User updated chat consent preferences.",
        aiProvider: requestedMode === "online" ? "mistral" : "local",
        expiry: consent.expiry || null,
      });
    }

    if (localPermissions && typeof localPermissions === "object") {
      setLocalPermissions(sessionId, localPermissions);
    }

    // Check for Sherlock command
    // Check for tool commands
    const toolResponse = await handleToolRequest(message, {
      sessionId,
      hasToolConsent: hasToolConsent(sessionId),
      formatHumanNLP,
      truncateForMirror,
    });
    if (toolResponse) {
      return res.json(buildTransparentChatPayload({
        sessionId,
        message,
        response: toolResponse,
        provider: "local-tooling",
        extra: {
        isTool: true,
        tool: toolResponse.tool,
        },
      }));
    }
    

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
          "Type /sherlock username - Check username (safety verification only)\n/moxie message - Talk to Moxie\n/consent yes - Enable AI\n/get_time - Get current time\n/translate text to language - Translate text\n/sherlock_ai username - AI-enhanced safety verification\n/consent no - Disable AI\n/resources - Show this list",
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
      updateConsentFromLegacy(sessionId, {
        ai: true,
        tools: true,
        reason: "User granted consent through the chat command flow.",
        aiProvider: requestedMode === "online" ? "mistral" : "local",
      });
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
      revokeConsentScopes(
        sessionId,
        ["ai", "sherlock", "resources", "internet", "voice", "microphone", "analytics", "blockchain", "futureIntegrations"],
        "User revoked consent through the chat command flow.",
      );
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
        ...buildTransparentChatPayload({
          sessionId,
          message,
          response: crisisResponse,
          provider: "local-safety",
        }),
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
        const localLLMResult = buildExplainedAIResult(
          message,
          localLLMText,
          "ollama",
          "offline",
        );
        return res.json({
          ...buildTransparentChatPayload({
            sessionId,
            message,
            response: localLLMResult.response,
            provider: "ollama",
            model: "ollama-local",
            mode: "offline",
            aiUsed: true,
            explanation: localLLMResult.explanation,
            biasAssessment: localLLMResult.biasAssessment,
          }),
          explanation: localLLMResult.explanation,
          biasAssessment: localLLMResult.biasAssessment,
          aiSafeguarded: localLLMResult.aiSafeguarded,
          nlp: pythonNlp,
        });
      }

      // 2. External Mistral API (online mode only)
      if (onlineApiActive) {
        try {
          const aiText = await callOnlineModel(message);
          const onlineResult = buildExplainedAIResult(
            message,
            aiText,
            "mistral",
            "online",
          );
          return res.json({
            ...buildTransparentChatPayload({
              sessionId,
              message,
              response: onlineResult.response,
              provider: "mistral",
              model: MISTRAL_MODEL,
              mode: "online",
              aiUsed: true,
              explanation: onlineResult.explanation,
              biasAssessment: onlineResult.biasAssessment,
            }),
            explanation: onlineResult.explanation,
            biasAssessment: onlineResult.biasAssessment,
            aiSafeguarded: onlineResult.aiSafeguarded,
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
    return res.json({
      ...buildTransparentChatPayload({
        sessionId,
        message,
        response,
        provider: "local-curated",
        model: localModel?.name || null,
        mode: "offline",
      }),
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

// ============================================================================
// E2E ENCRYPTION ENDPOINTS
// ============================================================================

/**
 * POST /api/crypto/handshake
 *
 * Phase 1 of E2E setup. The client sends its ephemeral public key; the server
 * stores it (keyed by session) and responds with its own public key.
 *
 * Both sides can then independently compute the shared secret using
 * X25519 Diffie-Hellman — the secret is NEVER transmitted.
 *
 * Request body: { clientPublicKey: string (Base64), sessionId?: string }
 * Response:     { serverPublicKey: string (Base64), schemaVersion, encryption }
 *
 * No sensitive data is logged.
 */
app.post(
  "/api/crypto/handshake",
  csrfProtection,
  requireAuth,
  (req, res) => {
    try {
      const { clientPublicKey } = req.body;
      const sessionId = getSessionIdFromRequest(req);

      if (typeof clientPublicKey !== "string" || !clientPublicKey) {
        return res.status(400).json({
          error: "clientPublicKey is required and must be a Base64 string",
        });
      }

      // Store the client's public key for this session
      try {
        registerClientPublicKey(sessionId, clientPublicKey);
      } catch (keyErr) {
        return res.status(400).json({
          error: "Invalid clientPublicKey",
          details: keyErr.message,
        });
      }

      // Clear any stale nonces for this session (fresh handshake = fresh session)
      clearSessionNonces(sessionId);

      console.log("[CRYPTO] Handshake complete for session (key material not logged).");

      return res.json({
        serverPublicKey: getServerPublicKeyBase64(),
        schemaVersion: "sxwer-e2e-v1",
        encryption: {
          algorithm: "X25519-XSalsa20-Poly1305",
          keyExchange: "Diffie-Hellman (ephemeral, per-session)",
          forwardSecrecy: true,
          onlineApiNotice: ENCRYPTION_DISCLOSURE.onlineApiNotice,
        },
      });
    } catch (err) {
      console.error("[CRYPTO] Handshake error:", err.message);
      return res.status(500).json({ error: "Handshake failed" });
    }
  },
);

/**
 * GET /api/crypto/server-key
 *
 * Returns the server's current public key without requiring a full handshake.
 * Clients can use this to verify the server key has not changed unexpectedly.
 */
app.get("/api/crypto/server-key", (req, res) => {
  const meta = getKeyPairMetadata();
  return res.json({
    serverPublicKey: meta.publicKey,
    createdAt: meta.createdAt,
    schemaVersion: "sxwer-e2e-v1",
  });
});

/**
 * GET /api/crypto/disclosure
 *
 * Returns the human-readable E2E encryption disclosure document.
 * Shown to users before they enable encryption.
 */
app.get("/api/crypto/disclosure", (req, res) => {
  return res.json({ disclosure: ENCRYPTION_DISCLOSURE });
});

/**
 * POST /api/chat/encrypted
 *
 * Encrypted variant of /api/chat.
 *
 * The client sends a ciphertext encrypted with the server's public key and
 * the client's secret key (nacl.box). The server:
 *   1. Validates the envelope shape.
 *   2. Checks the nonce for replay attacks.
 *   3. Decrypts the message using the shared secret.
 *   4. Processes the plaintext through the existing chatbot pipeline.
 *   5. Encrypts the response and returns the ciphertext to the client.
 *
 * The server NEVER logs the plaintext, the keys, or the nonces.
 *
 * Request body:
 *   {
 *     ciphertext:      string  // Base64
 *     nonce:           string  // Base64
 *     clientPublicKey: string  // Base64 — must match the registered handshake key
 *     schemaVersion:   string  // must be "sxwer-e2e-v1"
 *     sessionId?:      string
 *     consent?:        { ai: boolean, tools: boolean }
 *     localPermissions?: { offline: boolean, scope: string }
 *     mode?:           string  // "online" | "offline"
 *   }
 *
 * Response:
 *   {
 *     ciphertext: string   // Base64 — encrypted response
 *     nonce:      string   // Base64 — per-message nonce
 *     schemaVersion: string
 *     encrypted:  true
 *     ...metadata (offline, aiAssisted, etc.)
 *   }
 */
app.post(
  "/api/chat/encrypted",
  csrfProtection,
  requireAuth,
  async (req, res) => {
    const sessionId = getSessionIdFromRequest(req);

    try {
      const envelope = req.body;

      // 1. Validate envelope structure
      if (!isValidEnvelope(envelope)) {
        console.warn(
          "[CRYPTO] Rejected malformed encrypted envelope:",
          envelopeSummary(envelope),
        );
        return res.status(400).json({
          error: "Invalid encrypted envelope",
          hint: "Send { ciphertext, nonce, clientPublicKey, schemaVersion }",
        });
      }

      if (envelope.schemaVersion !== "sxwer-e2e-v1") {
        return res.status(400).json({
          error: `Unsupported schema version: ${envelope.schemaVersion}`,
          supported: ["sxwer-e2e-v1"],
        });
      }

      // 2. Replay protection — reject if nonce was already used
      if (!acceptNonce(sessionId, envelope.nonce)) {
        console.warn("[CRYPTO] Replay attack detected for session.");
        return res.status(400).json({
          error: "Replay detected: this nonce has already been used",
        });
      }

      // 3. Retrieve stored client public key (registered during handshake)
      const storedClientKey = getClientPublicKey(sessionId);
      if (!storedClientKey) {
        return res.status(401).json({
          error: "No handshake found for this session. Call /api/crypto/handshake first.",
        });
      }

      // 4. Verify the clientPublicKey in the envelope matches the registered key
      const { default: naclUtil } = await import("tweetnacl-util");
      const { encodeBase64: b64enc, decodeBase64: b64dec } = naclUtil;
      if (envelope.clientPublicKey !== b64enc(storedClientKey)) {
        return res.status(401).json({
          error: "clientPublicKey mismatch: key does not match the registered handshake key",
        });
      }

      // 5. Decrypt the message
      const serverKP = getServerKeyPair();
      let plaintext;
      try {
        const { default: naclUtilInner } = await import("tweetnacl-util");
        const clientPubKey = naclUtilInner.decodeBase64(envelope.clientPublicKey);
        plaintext = decryptMessage(
          envelope.ciphertext,
          envelope.nonce,
          clientPubKey,
          serverKP.secretKey,
        );
      } catch (decryptErr) {
        console.warn("[CRYPTO] Decryption failed:", decryptErr.message);
        return res.status(400).json({
          error: "Decryption failed",
          details: "Message authentication tag did not match. The message may have been tampered with.",
        });
      }

      // 6. Process the plaintext through the existing chat pipeline
      //    Build a fake req.body with the decrypted message so we can reuse
      //    the existing handler logic inline.
      const message = sanitizeUserMessage(plaintext);
      plaintext = null; // clear reference immediately after sanitisation

      const { consent, localPermissions, mode } = envelope;
      const requestedMode = getRequestedMode(mode);
      const onlineApiActive = shouldUseOnlineApi(requestedMode);

      if (!message) {
        return res.status(400).json({ error: "Decrypted message is empty" });
      }
      if (message.length > MAX_MESSAGE_LENGTH) {
        return res.status(400).json({ error: "Message exceeds maximum length" });
      }

      if (consent && typeof consent === "object") {
        setUserConsent(consent.ai, consent.tools, sessionId);
      }
      if (localPermissions && typeof localPermissions === "object") {
        setLocalPermissions(sessionId, localPermissions);
      }

      // Delegate to the existing tool/chat pipeline
      // (same logic as /api/chat, but we encrypt the response on the way out)
      const toolResponse = await handleToolRequest(message, {
        sessionId,
        hasToolConsent: hasToolConsent(sessionId),
        formatHumanNLP,
        truncateForMirror,
      });

      let responseText;
      let responseMeta = { encrypted: true };

      if (toolResponse) {
        responseText = formatResponseForDisplay(toolResponse);
        responseMeta.isTool = true;
        responseMeta.tool = toolResponse.tool;
      } else {
        const chatResponse = chatbot.processMessage(message, {
          isSherlockRequest: false,
          forceLocal: !hasAIConsent(sessionId),
          sessionId,
        });
        responseText = formatResponseForDisplay(chatResponse);
        responseMeta.offline = !onlineApiActive;
        responseMeta.online = onlineApiActive;
      }

      // 7. Encrypt the response for the client
      const { default: naclUtilResp } = await import("tweetnacl-util");
      const clientPubKeyBytes = naclUtilResp.decodeBase64(envelope.clientPublicKey);
      const encryptedResponse = encryptMessage(
        responseText,
        clientPubKeyBytes,
        serverKP.secretKey,
      );

      return res.json({
        ...responseMeta,
        ciphertext: encryptedResponse.ciphertext,
        nonce: encryptedResponse.nonce,
        schemaVersion: encryptedResponse.schemaVersion,
      });
    } catch (err) {
      console.error("[CRYPTO] Encrypted chat error:", err.message);

      // Return an encrypted error if possible, otherwise fall back to plaintext
      const clientKey = getClientPublicKey(sessionId);
      if (clientKey) {
        try {
          const serverKP = getServerKeyPair();
          const encryptedErr = encryptMessage(
            "An error occurred processing your encrypted message. Please try again.",
            clientKey,
            serverKP.secretKey,
          );
          return res.status(500).json({
            encrypted: true,
            ciphertext: encryptedErr.ciphertext,
            nonce: encryptedErr.nonce,
            schemaVersion: encryptedErr.schemaVersion,
          });
        } catch {
          // Fall through to plaintext error
        }
      }

      return res.status(500).json({ error: "Encrypted chat processing failed" });
    }
  },
);

/**
 * POST /api/crypto/rotate-client-key
 *
 * Called by the client when it rotates its key pair.
 * Clears the old client key and nonce records for the session so the client
 * can register a new public key via /api/crypto/handshake.
 */
app.post(
  "/api/crypto/rotate-client-key",
  csrfProtection,
  requireAuth,
  (req, res) => {
    const sessionId = getSessionIdFromRequest(req);
    removeClientPublicKey(sessionId);
    clearSessionNonces(sessionId);
    console.log("[CRYPTO] Client key rotation acknowledged for session.");
    return res.json({
      rotated: true,
      message: "Client key cleared. Call /api/crypto/handshake to register your new key.",
    });
  },
);

/**
 * GET /api/crypto/status
 *
 * Returns the server's current encryption status metadata.
 * Never includes private key material.
 */
app.get("/api/crypto/status", requireAuth, (req, res) => {
  const sessionId = getSessionIdFromRequest(req);
  const meta = getKeyPairMetadata();
  const hasClientKey = getClientPublicKey(sessionId) !== null;
  return res.json({
    serverPublicKey: meta.publicKey,
    serverKeyCreatedAt: meta.createdAt,
    serverKeyAgeMs: meta.ageMs,
    sessionHasHandshake: hasClientKey,
    schemaVersion: "sxwer-e2e-v1",
    algorithm: "X25519-XSalsa20-Poly1305",
    forwardSecrecy: true,
  });
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
app.post("/api/local-permissions", csrfProtection, requireAuth, (req, res) => {
  const sessionId = getSessionIdFromRequest(req);
  const { allow, scope } = req.body || {};
  const granted = Boolean(allow);

  const localPermissionState = setLocalPermissions(sessionId, {
    offline: granted,
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
    versionedConsent: getConsentDashboard(sessionId),
  });
});

/**
 * POST /consent - Set consent
 */
app.post("/api/consent", csrfProtection, requireAuth, (req, res) => {
  const sessionId = getSessionIdFromRequest(req);
  const { ai, tools, scopes, reason, aiProvider, expiry } = req.body;
  if (typeof ai !== "boolean" || typeof tools !== "boolean") {
    return res.status(400).json({
      error: "Consent values must be booleans for both ai and tools.",
    });
  }
  setUserConsent(ai, tools, sessionId);
  const versionedConsent = scopes && typeof scopes === "object"
    ? setConsentState(sessionId, {
        scopes,
        reason: reason || "User updated granular consent preferences.",
        aiProvider: aiProvider || (ai ? "local" : "none"),
        expiry: expiry || null,
        status: Object.values(scopes).some(Boolean) ? "granted" : "revoked",
      })
    : updateConsentFromLegacy(sessionId, {
        ai,
        tools,
        reason: reason || "User updated AI/tool consent preferences.",
        aiProvider: aiProvider || (ai ? "local" : "none"),
        expiry: expiry || null,
      });
  recordAuditEvent(sessionId, "consent.updated", "Consent settings were updated.", {
    ai,
    tools,
    activeScopes: versionedConsent.activeScopes,
  });

  res.json({
    success: true,
    consent: getConsentState(sessionId),
    versionedConsent: getConsentDashboard(sessionId),
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
 * GET /api/session
 *
 * Creates an authenticated session and returns the session token together
 * with a CSRF token. The browser should call this once on page load (or when
 * the session has expired) before making any state-mutating API requests,
 * including the E2E encrypted chat endpoint.
 *
 * The CSRF token is derived from a signed cookie set by this response; the
 * browser must include it as the `x-csrf-token` header on all POST requests.
 *
 * Response: { token: string, csrfToken: string }
 */
app.get("/api/session", csrfProtection, (req, res) => {
  const { token, sessionId: newSessionId } = createSession();
  updateConsentFromLegacy(newSessionId, {
    ai: false,
    tools: false,
    reason: "Initialized versioned consent dashboard with all scopes off by default.",
    aiProvider: "none",
  });
  return res.json({
    token,
    sessionId: newSessionId,
    csrfToken: req.csrfToken(),
  });
});

/**
 * GET /encryption-status - Serve Encryption Status UI page
 */
app.get("/encryption-status", limiter, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "encryption-status.html"));
});

/**
 * GET / - Serve main HTML
 */
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

/**
 * GET /consent-ledger - Serve Consent Ledger UI page
 */
app.get("/consent-ledger", limiter, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "consent-ledger.html"));
});

for (const page of HUMAN_RIGHTS_PAGES) {
  app.get(`/${page}`, limiter, (req, res) => {
    res.sendFile(path.join(__dirname, "public", `${page}.html`));
  });
}

app.get("/api/human-rights/report", requireAuth, (req, res) => {
  const sessionId = getSessionIdFromRequest(req);
  res.json(buildHumanRightsReport(sessionId));
});

app.post("/api/data-export", csrfProtection, requireAuth, async (req, res) => {
  const sessionId = getSessionIdFromRequest(req);
  recordAuditEvent(sessionId, "data.exported", "User exported current-session transparency data.", {
    page: req.body?.page || null,
  });
  const exportPackage = buildExportPackage(sessionId, buildHumanRightsReport(sessionId));
  try {
    await recordExport({ context: "human_rights_export", page: req.body?.page || "dashboard" });
  } catch {
    // Export remains available even when the optional ledger is unavailable.
  }
  res.json({ success: true, exportPackage });
});

app.post("/api/data-delete", csrfProtection, requireAuth, (req, res) => {
  const sessionId = getSessionIdFromRequest(req);
  clearSessionHumanRightsData(sessionId);
  res.json({
    success: true,
    message:
      "Current-session consent history, audit records, explainability records, and local permissions were deleted.",
  });
});

// ============================================================================
// CONSENT LEDGER API ROUTES
//
// All routes are read-only except POST routes which require an authenticated
// session.  The ledger API is intentionally available whether or not blockchain
// is enabled — it always reflects local in-memory state.
// ============================================================================

/**
 * GET /api/ledger/status
 * Return the current consent status summary.
 */
app.get("/api/ledger/status", (req, res) => {
  try {
    const status = getConsentStatus();
    const wallet = getWalletInfo();
    res.json({
      ...status,
      walletConnected: isWalletConnected(),
      walletId: wallet ? wallet.walletId : null,
      providerName: BLOCKCHAIN_ENABLED ? "configured" : "none",
      verificationStatus: "not-run",
    });
  } catch (err) {
    res.status(500).json({ error: "Could not read ledger status.", details: err.message });
  }
});

/**
 * GET /api/ledger/history
 * Return all consent receipts from the local in-memory ledger.
 */
app.get("/api/ledger/history", (req, res) => {
  try {
    const receipts = getConsentHistory();
    res.json({ receipts, total: receipts.length });
  } catch (err) {
    res.status(500).json({ error: "Could not read ledger history.", details: err.message });
  }
});

/**
 * GET /api/ledger/disclosure
 * Return the full informed-consent disclosure text for the blockchain feature.
 */
app.get("/api/ledger/disclosure", (req, res) => {
  res.json(INFORMED_CONSENT_DISCLOSURE);
});

/**
 * GET /api/ledger/export
 * Return a portable export package of all local consent records.
 */
app.get("/api/ledger/export", (req, res) => {
  try {
    const pkg = exportLedger();
    res.json(pkg);
  } catch (err) {
    res.status(500).json({ error: "Export failed.", details: err.message });
  }
});

/**
 * GET /api/ledger/verify
 * Verify the integrity of all local consent receipts.
 */
app.get("/api/ledger/verify", (req, res) => {
  try {
    const receipts = getConsentHistory();
    let verified = 0;
    let invalid = 0;

    for (const receipt of receipts) {
      const result = verifyConsent(receipt);
      if (result.valid) { verified++; } else { invalid++; }
    }

    res.json({
      verified,
      invalid,
      total: receipts.length,
      allValid: invalid === 0,
    });
  } catch (err) {
    res.status(500).json({ error: "Verification failed.", details: err.message });
  }
});

/**
 * POST /api/ledger/consent
 * Record a consent-granted event.
 */
app.post("/api/ledger/consent", csrfProtection, requireAuth, async (req, res) => {
  try {
    const { policyVersion, consentText } = req.body || {};
    const receipt = await recordConsent({ policyVersion, consentText });
    res.json({ success: true, receipt });
  } catch (err) {
    res.status(500).json({ error: "Could not record consent.", details: err.message });
  }
});

/**
 * POST /api/ledger/revoke
 * Record a consent-revoked event.
 */
app.post("/api/ledger/revoke", csrfProtection, requireAuth, async (req, res) => {
  try {
    const receipt = await revokeConsent(req.body || {});
    res.json({ success: true, receipt });
  } catch (err) {
    res.status(500).json({ error: "Could not revoke consent.", details: err.message });
  }
});

/**
 * POST /api/ledger/record-export
 * Record that a data export was performed.
 */
app.post("/api/ledger/record-export", csrfProtection, requireAuth, async (req, res) => {
  try {
    const receipt = await recordExport(req.body || {});
    res.json({ success: true, receipt });
  } catch (err) {
    res.status(500).json({ error: "Could not record export.", details: err.message });
  }
});

/**
 * POST /api/ledger/record-deletion
 * Record that local data was deleted.
 */
app.post("/api/ledger/record-deletion", csrfProtection, requireAuth, async (req, res) => {
  try {
    const receipt = await recordDeletion(req.body || {});
    res.json({ success: true, receipt });
  } catch (err) {
    res.status(500).json({ error: "Could not record deletion.", details: err.message });
  }
});

/**
 * POST /api/ledger/policy-acceptance
 * Record that the user accepted a specific policy version.
 */
app.post("/api/ledger/policy-acceptance", csrfProtection, requireAuth, async (req, res) => {
  try {
    const { policyVersion, policyDocumentText } = req.body || {};
    if (!policyVersion) {
      return res.status(400).json({ error: "policyVersion is required." });
    }
    const receipt = await recordPolicyAcceptance(policyVersion, policyDocumentText);
    res.json({ success: true, receipt });
  } catch (err) {
    res.status(500).json({ error: "Could not record policy acceptance.", details: err.message });
  }
});

/**
 * POST /api/ledger/wallet/disconnect
 * Disconnect the current wallet and clear key material from memory.
 */
app.post("/api/ledger/wallet/disconnect", csrfProtection, requireAuth, (req, res) => {
  const disconnected = disconnectWallet();
  res.json({ success: true, disconnected });
});

/**
 * POST /api/ledger/blockchain/disable
 * Disable blockchain support for this session.
 * On-chain records (if any) are immutable and unaffected.
 * Local ledger is cleared.
 */
app.post("/api/ledger/blockchain/disable", csrfProtection, requireAuth, async (req, res) => {
  try {
    // Record a BLOCKCHAIN_DISABLED event before clearing
    await revokeConsent({ context: "blockchain_disabled" });
    disconnectWallet();
    const cleared = clearLocalLedger();
    res.json({
      success: true,
      message: "Blockchain disabled. Local ledger cleared. Wallet disconnected.",
      recordsCleared: cleared,
    });
  } catch (err) {
    res.status(500).json({ error: "Could not disable blockchain.", details: err.message });
  }
});

/**
 * Start server
 */
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
