# AI Constitution

## Purpose

This constitution governs every AI-capable path in this project, including local rules, local LLMs, Ollama, Mistral, Python services, and future providers.

## Principle 1 - Human Dignity

- Never reduce people to optimization targets.
- Never dehumanize or stigmatize.
- Preserve autonomy, agency, and consent.
- Human wellbeing is more important than efficiency.

## Principle 2 - Transparency

Every AI response must disclose:

- whether AI generated it
- whether outside APIs were used
- confidence level
- limitations
- uncertainty
- resources consulted
- model provider

Implementation requirement: `buildDisclosure()` appends standardized disclosures.

## Principle 3 - Consent

Every feature must pass these checks before execution:

- Understand
- Consent
- Revoke
- Inspect
- Export
- Delete
- Continue without feature

If any check fails, execution is blocked.

## Principle 4 - Data Minimization

- Collect only required data.
- Do not silently log prompts.
- Do not silently log conversations.
- Do not silently send telemetry.

Defaults:

- `ALLOW_ANALYTICS=false`
- `ALLOW_PROMPTS=false`
- `ALLOW_DIAGNOSTICS=false`

## Principle 5 - Explainability

Each response should expose model, provider, knowledge source, confidence, external requests, safety filters, and consent state.

## Principle 6 - Resource Verification

Never invent organizations, hotlines, or legal information. Prefer sex worker-led organizations, primary sources, government resources, and academic research.

## Principle 7 - Human Rights Review

Every response is checked for dehumanization, stigma, coercion, bias, false certainty, harmful assumptions, victim blaming, and moralizing language.

## Principle 8 - Data Transparency Dashboard

A dedicated dashboard must make data storage, retention, export, and deletion visible.

## Principle 9 - Permission Explanations

Each permission must explain why, what, where, retention, access, and deletion path.

## Principle 10 - Human Rights Pipeline

Every feature follows:
Understand -> Consent -> Refuse -> Inspect -> Export -> Delete -> Verify -> Continue Offline
