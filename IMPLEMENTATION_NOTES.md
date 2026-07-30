# Salvaged implementation notes

This file preserves the most important requirements and implementation details from the earlier design, feature, security, and integration documents that were removed from the workspace.

## 1. Core product intent

The app is a trauma-informed, privacy-first support tool for sex workers and other users who may need a safe, low-pressure, locally usable interface.

The core goals are:

- protect dignity, autonomy, and consent
- avoid diagnosis, assumptions, or overreach
- keep the experience simple and non-judgmental
- support offline use and portable deployment
- provide gentle support tools without pressure

## 2. Ethical framework preserved in the app

The current implementation continues to enforce these principles:

- Dignity first: the user remains in control of pace, choices, and consent.
- No assumptions: the app avoids diagnosis, authority claims, or overstepping.
- Transparency: the app explains limits and uncertainty clearly.
- Autonomy: the app offers options rather than directives.
- Safety: sensitive topics and crisis language are handled carefully and redirected to support resources when appropriate.
- Consent gating: AI assistance and tool use stay off by default until the user explicitly enables them.

## 3. Conversation and response structure

User-facing replies are formatted using a human-centered structure:

- Anchor: acknowledge the user’s message and context
- Mirror: reflect the request back in a respectful way
- Reframe: provide a safe, supportive interpretation
- Rapport: offer a next step or gentle option

This structure is used in the chatbot logic and in the server responses for commands such as Sherlock, Moxie, and resources.

## 4. Command and tool support

The app preserves the key support tools from the earlier implementation notes:

- /sherlock username: optional safety verification flow that requires explicit tool consent
- /moxie message: a companion-style support interaction
- /consent yes and /consent no: manage AI and tool consent
- /resources and /help: provide support resources and command guidance

## 5. Sherlock-specific requirements

The Sherlock feature is intentionally constrained to avoid misuse:

- it is framed as a safety-verification tool for the user’s own accounts or safety planning
- it requires explicit consent before use
- it should not be used for surveillance, harassment, or non-consensual monitoring
- it is presented with a clear disclaimer and safe next-step language

## 6. Moxie companion requirements

Moxie remains a gentle companion experience rather than a replacement for professional support:

- it offers low-pressure check-ins and reminders
- it is styled as a supportive presence rather than an authority figure
- it is designed to feel calm, non-judgmental, and optional

## 7. Offline-first and portable deployment

The app is designed to work without relying on cloud services by default:

- the offline server can run locally with no required API key
- the experience supports a portable USB-style workflow
- the system can fall back to local-only responses when network-connected services are not available
- the default experience is intended to be privacy-preserving and local-first

## 8. Privacy and security notes

The earlier security and privacy work emphasized these expectations:

- never commit real secrets or API keys
- keep secrets in local environment variables or local configuration
- avoid hard-coded external service dependencies by default
- keep the app’s core experience local-first and low-risk
- avoid making the experience feel authoritative or invasive

## 9. UI and accessibility notes

The current UI preserves the earlier visual direction:

- a calm, supportive palette with strong contrast and readable spacing
- separate styling for safety and companion features
- a dark-mode option for comfort and accessibility
- clear status and consent messaging so the user always understands what is happening

## 10. Verification and operational notes

The app’s current implementation should be verified by checking:

- server startup and health responses
- chatbot syntax and runtime behavior
- command handling for Sherlock, Moxie, consent, and resources
- safe response formatting for crisis or sensitive input
