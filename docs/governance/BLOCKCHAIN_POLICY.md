# Blockchain Policy

## Never Store

- conversation
- prompt
- response
- GPS
- photos
- voice
- email
- phone
- health data

## Allowed

- hashes
- timestamps
- policy version
- consent receipt
- wallet ID
- signature

## Enforcement

- Blockchain records are sanitized to an allowlist.
- Verification rejects payloads that contain PII-like fields.
- Local deletion controls remove local copies only; on-chain records remain immutable.
