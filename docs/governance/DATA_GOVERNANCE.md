# Data Governance

## Defaults

- Analytics disabled by default.
- Prompt capture disabled by default.
- Diagnostics capture disabled by default.

## Data Handling Rules

- Minimize collection to required operational metadata.
- Retain local session records only as needed for inspect/export/delete controls.
- Never persist secrets in source control.
- Never write conversations to blockchain.

## Required User Controls

- Inspect data categories.
- Export current-session data.
- Delete current-session data.
- Continue functionality with reduced permissions.
