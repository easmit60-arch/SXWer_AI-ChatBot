# Consent Model

## Consent Requirements

A feature can execute only if all answers are YES:

- Can the user understand?
- Can they consent?
- Can they revoke?
- Can they inspect?
- Can they export?
- Can they delete?
- Can they continue without it?

## Feature Scopes

- `online-ai`
- `voice`
- `sherlock`
- `blockchain`
- `external-api`
- `community-sharing`

## Enforcement

- `ConsentService` resolves required scopes and rights.
- `ConsentGuard` blocks execution and returns actionable denial reasons.
