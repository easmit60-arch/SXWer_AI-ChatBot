# Contributing to SXWer AI ChatBot

Thank you for contributing. This project exists to protect and empower a community that faces real harm. Every pull request is a statement about what we value.

Read this document before opening an issue or submitting code. These are not suggestions — they are hard requirements.

---

## Mission

This project maximises:

- Human dignity
- Human autonomy
- Privacy
- Accessibility
- Transparency
- Community consent
- Informed decision-making
- Data sovereignty
- Offline-first operation

Technology is a tool — not the decision maker.

Every change must increase user autonomy rather than platform control.

---

## Human Rights Decision Framework

Before implementing **any** feature, verify all of the following:

| Question | Required answer |
|---|---|
| Can the user understand what is happening? | Yes |
| Can they provide informed consent? | Yes |
| Can they refuse without losing core functionality? | Yes |
| Can they inspect their own data? | Yes |
| Can they export it? | Yes |
| Can they delete it? | Yes |
| Can they revoke consent? | Yes |
| Can they continue using the application offline? | Yes |
| Does this reduce power imbalance? | Yes |

If any answer is **No**, redesign the implementation before submitting.

---

## Core Principle

Never ask: *"Can we collect this?"*

Always ask: *"Does the user need this to accomplish their goal?"*

If the answer is no, **do not collect it**.

---

## Privacy Architecture

The data flow must always follow this direction — never reversed:

```
User
  ↓
Local Device
  ↓
Encrypted Storage
  ↓
Optional Services
  ↓
Optional Blockchain Consent Ledger
```

Cloud services are optional. Offline mode is the default.

---

## AI Principles

AI must never pretend to:

- know everything
- be human
- be a therapist
- replace community
- replace informed consent

Every AI response must disclose:

- model limitations
- uncertainty
- confidence
- when external APIs are used

Never fabricate facts. Never fabricate citations. Never hide uncertainty.

---

## Data Minimization

Collect the minimum information necessary. Do not collect names, addresses, birthdays, phone numbers, precise locations, or unnecessary identifiers unless absolutely required for the user's stated goal.

---

## Consent

Consent must always be:

- **Explicit** — never implied
- **Specific** — never bundled
- **Revocable** — never permanent
- **Documented** — with an inspectable, portable receipt
- **Never hidden** in terms of service or onboarding flows

---

## Blockchain

Blockchain is **optional** and **opt-in only**.

Blockchain stores **only**:

- consent receipts
- policy acceptance
- revocation receipts
- deletion receipts
- document hashes
- timestamps

Blockchain **never** stores prompts, conversations, AI outputs, personal data, images, voice, safety plans, or health information. The blockchain exists only as a verification ledger.

---

## Security

**Never commit:**

- API keys
- Secrets
- Passwords
- Tokens
- Certificates
- Private keys

**Always use:**

- environment variables (`.env`, not committed)
- encrypted storage

Scan changed files for secrets before every commit. Run `npm run secret-scan` if available.

---

## Accessibility

Every UI change must meet **WCAG 2.2 AA**. Run `npm run test:a11y` before submitting.

Required support:

- keyboard navigation
- screen readers
- visible focus indicators
- high contrast
- reduced motion
- semantic HTML
- ARIA attributes only when native semantics are insufficient

Accessibility is a human right — not an enhancement.

---

## Architecture

Prefer small, single-responsibility modules:

```
routes/
controllers/
services/
middleware/
repositories/
models/
configuration/
utilities/
rights/
consent/
```

Avoid large monolithic files, global mutable state, magic strings, hardcoded secrets, tight coupling, and hidden side effects.

---

## Logging

**Never log:**

- prompts or message content
- personal identifiers
- tokens or API keys
- consent values

**Log only:**

- event IDs
- timestamps
- status codes
- error codes (no stack traces containing user data)

---

## Documentation

Every new feature must include:

1. **Purpose** — what it does and why it exists
2. **Data collected** — what is collected and why it is needed
3. **Storage** — where it is stored and for how long
4. **Deletion** — how the user can delete it
5. **Export** — how the user can export it
6. **Consent** — what consent is required and how it is obtained
7. **Security implications** — known risks
8. **Threat model** — adversarial scenarios considered

---

## Human Rights Impact Check

Before submitting, evaluate your changes against these questions:

- Does this increase autonomy?
- Does it reduce surveillance?
- Does it reduce coercion?
- Does it reduce unnecessary data collection?
- Does it improve accessibility?
- Does it improve transparency?
- Does it preserve offline functionality?
- Does it protect vulnerable users?
- Would this design still respect the user if the organisation became unethical?

If any answer is **No**, redesign.

---

## Submitting a Pull Request

1. Fork the repository and create a feature branch.
2. Run `npm test` — all tests must pass.
3. Run `npm run test:a11y` — no WCAG 2.2 AA violations.
4. Work through the Human Rights Impact Check above.
5. Write or update tests that cover your change.
6. Document the change following the Documentation requirements above.
7. Open a pull request. Describe what changed, why, and what the human rights impact is.

Pull requests that introduce surveillance, remove consent gates, collect unnecessary data, or reduce offline functionality will not be merged.

---

## Code of Conduct

All contributors are expected to treat community members — especially those from marginalised and at-risk groups — with dignity and respect. This project serves sex workers, survivors, and other vulnerable people. Design and discuss accordingly.

---

## Questions

If you are unsure whether a change aligns with these principles, open an issue and ask before writing code.
