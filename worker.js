/**
 * SXWer AI ChatBot - Cloudflare Worker Entry Point
 *
 * This worker handles API routes for Cloudflare Workers / wrangler deployments.
 * Without this file the wrangler "assets" config only serves static GET/HEAD
 * requests, which causes HTTP 405 for every POST to /api/chat.
 *
 * All ethical constraints from chatbot.js are enforced here exactly as they
 * are in server-offline.js:
 * - Consent gated before AI or tool usage
 * - All responses follow ANCHOR-MIRROR-REFRAME-RAPPORT structure
 * - Crisis and sensitive input handled with safe redirection
 * - AI usage disclosed when active
 *
 * Environment variables (set via wrangler secret or .dev.vars):
 *   MISTRAL_API_KEY   - Mistral AI API key (optional; online AI disabled without it)
 *   MISTRAL_API_BASE  - Override API endpoint (default: Mistral chat completions)
 *   MISTRAL_MODEL     - Model name (default: mistral-small-latest)
 */

// [REQ 7] Separate imports: ethics logic lives entirely in chatbot.js
import {
  chatbot,
  formatResponseForDisplay,
  hasAIConsent,
  hasToolConsent,
  setUserConsent,
  checkSherlockProtocol,
  requestSherlockConsent,
  formatHumanNLP,
  truncateForMirror,
} from "./chatbot.js";

import resources from "./resources.json" with { type: "json" };

// ============================================================================
// CONSTANTS
// ============================================================================

// [REQ 4] Moxie check-in messages (non-clinical, boundary-respecting)
const MOXIE_CHECK_IN_MESSAGES = Object.freeze([
  "How are you feeling right now?",
  "Remember, you're in control here.",
  "Take a breath. I'm here when you're ready.",
  "Your pace, your choices. Always.",
  "You're doing great. Want to talk about anything?",
  "This is your space. No judgment, no pressure.",
  "Gentle reminder: Your dignity and autonomy matter.",
  "I'm here to listen without judgment. What's on your mind?",
]);

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Return a JSON Response with the correct Content-Type header.
 * @param {unknown} data
 * @param {number} [status]
 * @returns {Response}
 */
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Call the Mistral online model.
 * [REQ 1] Only reached when userConsent.ai === true AND the API key is present.
 * [REQ 5] AI use is disclosed in the response via isAI flag in buildOnlineResponse.
 *
 * @param {string} message - User message
 * @param {object} env - Cloudflare Worker environment bindings
 * @returns {Promise<string>} Raw AI response text
 */
async function callOnlineModel(message, env) {
  const apiKey = env.MISTRAL_API_KEY || "";
  if (!apiKey) {
    throw new Error("Online API is not configured — MISTRAL_API_KEY is missing");
  }

  const apiBase =
    env.MISTRAL_API_BASE || "https://api.mistral.ai/v1/chat/completions";
  const model = env.MISTRAL_MODEL || "mistral-small-latest";

  // Ensure the endpoint ends with /chat/completions
  const endpoint = apiBase.includes("/chat/completions")
    ? apiBase
    : `${apiBase.replace(/\/$/, "")}/chat/completions`;

  const payload = {
    model,
    messages: [
      {
        role: "system",
        content:
          "You are SXWer AI ChatBot, a trauma-informed, privacy-first assistant. " +
          "Be supportive, non-judgmental, and transparent about limitations. " +
          "Avoid diagnosis, never claim authority, and respond with care.",
      },
      { role: "user", content: message },
    ],
    temperature: 0.7,
    max_tokens: 320,
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
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

/**
 * Wrap raw AI text in the required HumanNLP structure.
 * [REQ 2] Ensures AI text always passes through formatHumanNLP.
 * [REQ 5] isAI: true triggers the [AI-Assisted] disclosure prefix.
 */
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
// ROUTE HANDLERS
// ============================================================================

/**
 * POST /api/chat
 * [REQ 1] AI gated by consent.  [REQ 3] Tool gated by consent.
 * [REQ 2] All paths return formatHumanNLP output.
 */
async function handleChat(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const { message, consent, localPermissions } = body;

  // [REQ 3] Apply per-request consent before any processing
  if (consent && typeof consent === "object") {
    setUserConsent(Boolean(consent.ai), Boolean(consent.tools));
  }

  // Validate message
  if (!message || typeof message !== "string") {
    return jsonResponse(
      {
        response: formatResponseForDisplay(
          formatHumanNLP({
            userInput: "",
            anchor: "I need a valid message to respond.",
            mirror: "You provided an empty or invalid message.",
            reframe:
              "Please type something in the chat box and try again.",
            rapport: "What would you like to talk about?",
          }),
        ),
      },
      400,
    );
  }

  try {
    // /sherlock command
    if (message.startsWith("/sherlock ")) {
      const username = message.substring(10).trim();
      const protocolCheck = checkSherlockProtocol(message);

      if (!protocolCheck.allowed || !hasToolConsent()) {
        return jsonResponse({
          response: formatResponseForDisplay(requestSherlockConsent(username)),
          requiresConsent: true,
          consentType: "sherlock",
        });
      }

      // Workers are online-only; Sherlock is not available without the Apify token.
      // Return a transparent "not available in cloud mode" response.
      const sherockUnavailable = formatHumanNLP({
        userInput: message,
        anchor: "Sherlock is not available in the cloud deployment.",
        mirror: `You requested: "${message}"`,
        reframe:
          "The online (Cloudflare Workers) version does not include the Sherlock " +
          "username search tool. Run the app locally with `npm start` to use it.",
        rapport:
          "Would you like help with something else, or a list of support resources?",
      });

      return jsonResponse({
        response: formatResponseForDisplay(sherockUnavailable),
        offline: false,
      });
    }

    // /resources and /help
    if (message === "/resources" || message === "/help") {
      const response = formatHumanNLP({
        userInput: message,
        anchor: "Here are resources and support organizations for sex workers:",
        mirror: `You asked: "${message}"`,
        reframe:
          "These organizations provide support, advocacy, and resources:",
        rapport:
          "Type /moxie message to talk to Moxie, /consent yes to enable AI, " +
          "/consent no to use local responses only, or /resources to see this list again.",
      });

      return jsonResponse({
        response: formatResponseForDisplay(response),
        resources: resources.organizations,
        crisis_resources: resources.crisis_resources,
        safety_tips: resources.safety_tips,
      });
    }

    // /moxie command
    if (message.startsWith("/moxie ")) {
      const moxieMessage = message.substring(7).trim();
      const response = formatHumanNLP({
        userInput: message,
        anchor: "Moxie hears you.",
        mirror: `You said to Moxie: "${moxieMessage}"`,
        reframe:
          "Moxie is your companion, here to provide gentle support and reminders.",
        rapport: "Would you like Moxie to check in more often?",
      });

      return jsonResponse({
        response: formatResponseForDisplay(response),
        from: "Moxie",
      });
    }

    // /consent yes
    if (
      message.toLowerCase() === "yes" ||
      message.toLowerCase() === "/consent yes"
    ) {
      setUserConsent(true, true);
      const response = formatHumanNLP({
        userInput: message,
        anchor: "Thank you for your consent.",
        mirror: `You said: "${message}"`,
        reframe:
          "I will now use AI assistance to provide more tailored responses. " +
          "You can revoke consent at any time.",
        rapport: "What would you like to talk about?",
      });

      return jsonResponse({
        response: formatResponseForDisplay(response),
        consentGranted: true,
        consent: { ai: true, tools: true },
      });
    }

    // /consent no
    if (
      message.toLowerCase() === "no" ||
      message.toLowerCase() === "/consent no"
    ) {
      setUserConsent(false, false);
      const response = formatHumanNLP({
        userInput: message,
        anchor: "Consent revoked.",
        mirror: `You said: "${message}"`,
        reframe:
          "I will now only use local, curated responses. Your privacy and safety remain the priority.",
        rapport: "How can I assist you with local knowledge?",
      });

      return jsonResponse({
        response: formatResponseForDisplay(response),
        consentRevoked: true,
        consent: { ai: false, tools: false },
      });
    }

    // General message — process through ethical chatbot
    const localResponse = chatbot.processMessage(message, {
      isSherlockRequest: false,
      forceLocal: !hasAIConsent(),
    });

    // [REQ 1] Only call online AI when the user has explicitly consented
    // [REQ 3] Check consent before any external API call
    if (hasAIConsent() && (env.MISTRAL_API_KEY || "")) {
      try {
        const aiText = await callOnlineModel(message, env);
        const onlineResponse = buildOnlineResponse(message, aiText);
        return jsonResponse({
          response: formatResponseForDisplay(onlineResponse),
          offline: false,
          online: true,
          provider: "mistral",
          model: env.MISTRAL_MODEL || "mistral-small-latest",
          aiAssisted: true,
        });
      } catch (err) {
        // Fail gracefully: log and fall back to local response
        console.warn(
          "[WORKER] Online API call failed, using local response:",
          err.message,
        );
      }
    }

    return jsonResponse({
      response: formatResponseForDisplay(localResponse),
      offline: true,
      online: false,
    });
  } catch (error) {
    console.error("[WORKER] Chat error:", error);
    const errResponse = formatHumanNLP({
      userInput: message,
      anchor: "I encountered an error processing your request.",
      mirror: `You requested: "${truncateForMirror(message)}"`,
      reframe:
        "This might be a temporary issue. Please try again in a moment.",
      rapport: "Would you like to try again or use a different approach?",
    });

    return jsonResponse(
      { response: formatResponseForDisplay(errResponse), error: error.message },
      500,
    );
  }
}

/** GET /api/health */
function handleHealth(env) {
  return jsonResponse({
    status: "ok",
    mode: "online",
    model: null,
    onlineApiConfigured: Boolean(env.MISTRAL_API_KEY),
    onlineModel: env.MISTRAL_MODEL || "mistral-small-latest",
    timestamp: new Date().toISOString(),
  });
}

/** GET /api/consent-status */
function handleConsentStatus() {
  return jsonResponse({
    ai: hasAIConsent(),
    tools: hasToolConsent(),
    offlineMode: false,
    modelLoaded: false,
    model: null,
  });
}

/** POST /api/consent */
async function handleSetConsent(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }
  const { ai, tools } = body;
  setUserConsent(ai, tools);
  return jsonResponse({
    success: true,
    consent: { ai: hasAIConsent(), tools: hasToolConsent() },
  });
}

/** GET /api/moxie-checkin */
function handleMoxieCheckin() {
  const message =
    MOXIE_CHECK_IN_MESSAGES[
      Math.floor(Math.random() * MOXIE_CHECK_IN_MESSAGES.length)
    ];

  const response = formatHumanNLP({
    userInput: "/moxie checkin",
    anchor: "Moxie is checking in.",
    mirror: "Automatic check-in from Moxie",
    reframe: message,
    rapport: 'Type "/moxie [your message]" to talk to Moxie directly.',
  });

  return jsonResponse({
    response: formatResponseForDisplay(response),
    from: "Moxie",
  });
}

/** GET /api/moxie-info */
function handleMoxieInfo() {
  return jsonResponse({
    name: "Moxie",
    description:
      "Your desktop companion that can work inside this chat or outside it",
    checkInInterval: 120000,
    checkInMessages: [...MOXIE_CHECK_IN_MESSAGES],
  });
}

/** GET /api/sherlock-info */
function handleSherlockInfo() {
  return jsonResponse({
    name: "Sherlock",
    description: "Username reconnaissance tool for safety verification",
    usage: "/sherlock username",
    requirements: [
      "Explicit consent required",
      "Safety/verification purpose only",
      "No surveillance of others",
      "No doxxing or harassment",
    ],
    offline: false,
    disclaimer:
      "Cloud deployments do not include Sherlock. Run `npm start` locally to use it.",
  });
}

/** POST /api/local-permissions — acknowledged but no-op in cloud */
function handleLocalPermissions() {
  return jsonResponse({
    allowed: false,
    scope: "offline",
    note: "Local permissions are only relevant when running the app locally with npm start.",
  });
}

// ============================================================================
// WORKER EXPORT
// ============================================================================

export default {
  /**
   * Main fetch handler — routes API requests and falls back to static assets.
   * [REQ 7] Clean architecture: routing is separate from ethics logic.
   *
   * @param {Request} request
   * @param {object} env  - Cloudflare Worker bindings (secrets, ASSETS)
   * @param {object} ctx  - ExecutionContext
   * @returns {Promise<Response>}
   */
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const { pathname } = url;
    const method = request.method;

    // API routing
    if (pathname === "/api/chat" && method === "POST") {
      return handleChat(request, env);
    }
    if (pathname === "/api/health" && method === "GET") {
      return handleHealth(env);
    }
    if (pathname === "/api/consent-status" && method === "GET") {
      return handleConsentStatus();
    }
    if (pathname === "/api/consent" && method === "POST") {
      return handleSetConsent(request);
    }
    if (pathname === "/api/moxie-checkin" && method === "GET") {
      return handleMoxieCheckin();
    }
    if (pathname === "/api/moxie-info" && method === "GET") {
      return handleMoxieInfo();
    }
    if (pathname === "/api/sherlock-info" && method === "GET") {
      return handleSherlockInfo();
    }
    if (pathname === "/api/local-permissions" && method === "POST") {
      return handleLocalPermissions();
    }

    // Return 405 only for unknown /api/* paths with wrong methods
    if (pathname.startsWith("/api/")) {
      return new Response("Method Not Allowed", {
        status: 405,
        headers: { Allow: "GET, POST" },
      });
    }

    // Fall back to static asset serving for everything else
    return env.ASSETS.fetch(request);
  },
};
