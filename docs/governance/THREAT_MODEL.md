# Threat Model

## Primary Risks

- Non-consensual data flow to external APIs.
- Prompt and conversation over-collection.
- Stigmatizing or coercive model outputs.
- PII leakage into immutable ledgers.
- Permission dark patterns.

## Mitigations

- Consent and human-rights gating before execution.
- Default-off analytics/prompt/diagnostics flags.
- Response review middleware for harmful language patterns.
- Blockchain policy sanitizer and verifier.
- Dashboard visibility for inspect/export/delete.
