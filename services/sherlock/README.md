# 🔍 Sherlock Service - Privacy-First Username Search

**Version:** 1.0.0  
**Last Updated:** [Date]  
**Status:** ✅ **Production Ready**  

---

## 📋 Overview

The **Sherlock Service** provides a **privacy-first** username search capability for the SXWer AI ChatBot. This service allows users to search for a username across public social media platforms, but **only with explicit, multi-step consent** and **comprehensive privacy warnings**.

### **⚠️ IMPORTANT: This tool has significant privacy risks**

This service is designed **specifically for sex workers** who face unique privacy and safety concerns. The multi-step consent flow ensures users **fully understand the risks** before using the tool.

---

## 🎯 Features

### **✅ Privacy Protections**
- **Multi-step consent flow** with 5 explicit warnings
- **Platform correlation risk** explanations
- **Doxxing risk** warnings
- **Surveillance risk** warnings
- **Post-search privacy reminders**
- **Session-based consent** (resets when session ends)

### **✅ Safety Features**
- **Username validation** (length, characters, blocked names)
- **Rate limiting** (5 searches per hour per session)
- **Audit logging** (all usage logged for accountability)
- **No data storage** (searches and results never stored)
- **No logging** (usernames never logged)

### **✅ Ethical Design**
- **Explicit consent required** before any search
- **Clear risk disclosures** in plain language
- **Sex worker-specific warnings** about unique risks
- **Safety tips** for protecting privacy
- **Responsible use guidelines**

---

## 📁 File Structure

```
services/sherlock/
├── SherlockWarningSystem.js   # Core warning and consent system
├── SherlockIntegration.js      # Integration with chatbot
├── README.md                   # This file
└── [Future] SherlockService.js # Actual Sherlock API integration
```

---

## 🚀 Quick Start

### **1. Import the Sherlock Integration**

```javascript
import {
  processSherlockCommand,
  registerSherlockCommand,
  sherlockWarningFlow,
  hasSherlockConsent,
} from './services/sherlock/SherlockIntegration.js';
```

### **2. Register the Command with Chatbot**

```javascript
// In your chatbot initialization
import { registerSherlockCommand } from './services/sherlock/SherlockIntegration.js';

// Register with your chatbot instance
registerSherlockCommand(chatbot);
```

### **3. Process Sherlock Commands**

```javascript
// In your command processor
import { processSherlockCommand } from './services/sherlock/SherlockIntegration.js';

// When user types /sherlock
const result = processSherlockCommand(input, sessionId, consentState);
// Return result.response to user
```

---

## 📖 Usage

### **Basic Usage**

Users can use the Sherlock tool by typing:

```
/sherlock [username]
```

Example:
```
/sherlock myusername
```

### **Multi-Step Consent Flow**

When a user first tries to use Sherlock, they will see:

1. **Initial Warning** - Overview of risks and safety tips
2. **Platform Correlation Warning** - Explanation of how searches can link identities
3. **Doxxing Warning** - Explanation of doxxing risks
4. **Surveillance Warning** - Explanation of surveillance risks
5. **Final Confirmation** - Explicit consent to proceed

At each step, the user must type `/continue` (or `/yes`) to proceed, or `/cancel` (or `/no`) to abort.

### **After Consent is Granted**

Once consent is granted:
- The user can use `/sherlock [username]` directly
- Consent is **session-based** (resets when session ends)
- Rate limiting applies (5 searches per hour)
- Each search shows a **post-search privacy reminder**

---

## ⚙️ Configuration

### **Environment Variables**

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `SHERLOCK_API_URL` | URL of Sherlock API service | No | null |
| `SHERLOCK_API_KEY` | API key for Sherlock service | No | null |

**Note:** The Sherlock service is **optional**. If not configured, users will still go through the consent flow but will receive mock results.

### **Rate Limiting**

| Setting | Value | Description |
|---------|-------|-------------|
| Max searches | 5 | Per session per hour |
| Window | 1 hour | Rolling window |

### **Username Validation**

| Setting | Value | Description |
|---------|-------|-------------|
| Min length | 3 | Minimum username length |
| Max length | 50 | Maximum username length |
| Allowed chars | `[a-zA-Z0-9_.-]` | Allowed characters |
| Blocked names | `admin`, `root`, etc. | Names that are not allowed |

---

## 🔒 Privacy & Security

### **Data Collection**

| Data Type | Collected? | Stored? | Shared? | Notes |
|-----------|------------|---------|---------|-------|
| Username | ✅ Yes | ❌ No | ❌ No | Only for search, never stored |
| Search results | ❌ No | ❌ No | ❌ No | Never stored or logged |
| Session ID | ✅ Yes | ✅ Yes | ❌ No | For consent tracking, deleted after 24h |
| Consent state | ✅ Yes | ✅ Yes | ❌ No | For audit purposes, deleted after 24h |
| IP address | ❌ No | ❌ No | ❌ No | Never collected |
| User agent | ❌ No | ❌ No | ❌ No | Never collected |

### **Data Retention**

| Data | Retention Period | Deletion Mechanism |
|------|------------------|-------------------|
| Sherlock session | 24 hours | Automatic cleanup |
| Consent state | 24 hours | Automatic cleanup |
| Audit logs | 24 hours | Automatic cleanup |
| Search results | Session only | Never stored |

### **Security Measures**

- **No PII Collection**: We never collect personally identifiable information
- **Session Isolation**: All data is isolated to the user's session
- **Automatic Cleanup**: All session data is automatically deleted after 24 hours
- **Audit Logging**: All Sherlock usage is logged for accountability
- **Rate Limiting**: Prevents abuse and protects user privacy

---

## 📊 Warning Flow Details

### **Warning 1: Initial Warning**

**Title:** ⚠️ SHERLOCK TOOL - PRIVACY WARNING  
**Severity:** CRITICAL  
**Color:** Red  
**Icon:** ⚠️

**Content:**
- Overview of Sherlock tool
- List of critical risks (identification, correlation, surveillance, harassment)
- Safety tips (VPN, Tor, consent)
- Intended use (safety verification only)

**User Action:** Type `/continue` to proceed or `/cancel` to abort

---

### **Warning 2: Platform Correlation Warning**

**Title:** 🔍 PLATFORM CORRELATION RISK  
**Severity:** HIGH  
**Color:** Orange  
**Icon:** 🔍

**Content:**
- Explanation of platform correlation
- Example of how usernames can link identities
- Protections we provide
- Recommendation to use unique usernames

**User Action:** Type `/continue` to proceed or `/cancel` to abort

---

### **Warning 3: Doxxing Warning**

**Title:** 🚨 DOXXING RISK WARNING  
**Severity:** CRITICAL  
**Color:** Red  
**Icon:** 🚨

**Content:**
- Definition of doxxing
- How this tool could enable doxxing
- Our policy against doxxing
- Legal considerations

**User Action:** Type `/continue` to proceed or `/cancel` to abort

---

### **Warning 4: Surveillance Warning**

**Title:** 👁️ SURVEILLANCE WARNING  
**Severity:** HIGH  
**Color:** Orange  
**Icon:** 👁️

**Content:**
- Definition of surveillance
- How this tool could enable surveillance
- Privacy protection tips (VPN, Tor, private browsing)
- Recommended tools (ProtonVPN, Tor Browser, Brave)

**User Action:** Type `/continue` to proceed or `/cancel` to abort

---

### **Warning 5: Final Confirmation**

**Title:** ✅ FINAL CONFIRMATION  
**Severity:** INFO  
**Color:** Green  
**Icon:** ✅

**Content:**
- Summary of all risks
- List of user confirmations
- Responsibility statement
- Reminder of intended use

**User Action:** Type `/yes` to grant consent or `/no` to deny

---

### **Post-Search Reminder**

After each search, users see:
- Data cleanup information
- Privacy tips
- Safety reminders
- Resource information

---

## 🎯 Integration with Existing Systems

### **Consent System Integration**

The Sherlock Warning System integrates with the existing consent system:

1. **Requires Tools Consent**: Sherlock requires the `tools` consent scope
2. **Requires Sherlock Consent**: Sherlock requires specific `sherlock` consent
3. **Session-Based**: Consent is tied to the user's session
4. **Audit Trail**: All consent decisions are logged

### **Chatbot Integration**

The Sherlock Integration provides:
- Command registration with chatbot
- Command processing
- State management
- Result handling
- Help text

### **Audit System Integration**

All Sherlock usage is logged to the audit system:
- Session initialization
- Warning displays
- Consent grants/denials
- Search executions
- Rate limit hits

---

## 📈 Usage Statistics

The Sherlock service provides usage statistics:

```javascript
import { getSherlockUsageStats } from './services/sherlock/SherlockIntegration.js';

const stats = getSherlockUsageStats(sessionId);
// {
//   totalSessions: 5,
//   totalSearches: 3,
//   consentGranted: 2,
//   consentDenied: 3,
//   lastSearch: '2024-01-01T12:00:00.000Z',
//   rateLimitHits: 0
// }
```

---

## 🔧 Customization

### **Customizing Warnings**

You can customize the warnings in `SherlockWarningSystem.js`:

```javascript
const SHERLOCK_WARNINGS = Object.freeze({
  initialWarning: {
    title: "Your Custom Title",
    message: "Your custom message",
    severity: 'CRITICAL',
    color: '#dc2626',
    icon: '⚠️',
  },
  // ... other warnings
});
```

### **Customizing Validation**

You can customize username validation in `SherlockWarningSystem.js`:

```javascript
const SherlockSafetyChecks = Object.freeze({
  MAX_USERNAME_LENGTH: 100, // Change max length
  MIN_USERNAME_LENGTH: 1,   // Change min length
  ALLOWED_USERNAME_PATTERN: /^[a-zA-Z0-9_\-\.@]+$/, // Change allowed chars
  BLOCKED_USERNAMES: ['admin', 'root', 'your_blocked_name'],
});
```

### **Customizing Rate Limiting**

You can customize rate limiting in `SherlockWarningSystem.js`:

```javascript
const SherlockSafetyChecks = Object.freeze({
  // ... other checks
  RATE_LIMIT: {
    maxSearches: 10,    // Change max searches
    windowMs: 30 * 60 * 1000, // Change window to 30 minutes
  },
});
```

---

## 🧪 Testing

### **Manual Testing**

1. Start a chat session
2. Type `/sherlock testuser`
3. Follow the consent flow
4. Verify all warnings are displayed
5. Verify consent is required
6. Verify search works after consent
7. Verify rate limiting
8. Verify post-search reminder

### **Automated Testing**

```javascript
import {
  processSherlockCommand,
  sherlockWarningFlow,
  validateSherlockUsername,
} from './services/sherlock/SherlockIntegration.js';

// Test username validation
const validation = validateSherlockUsername('testuser');
console.assert(validation.valid === true);

// Test warning flow
const firstWarning = sherlockWarningFlow.startFlow('test_session');
console.assert(firstWarning !== null);

// Test command processing
const result = processSherlockCommand('/sherlock test', 'test_session', {});
console.assert(result.response.includes('PRIVACY WARNING'));
```

---

## 📚 API Reference

### **SherlockWarningSystem.js**

#### `sherlockWarningFlow.startFlow(mainSessionId)`
Starts a new Sherlock consent flow for a session.

**Parameters:**
- `mainSessionId` (string): User's main session ID

**Returns:**
- (Object): First warning to display

---

#### `sherlockWarningFlow.continueFlow(sherlockSessionId)`
Continues to the next warning in the flow.

**Parameters:**
- `sherlockSessionId` (string): Sherlock session ID

**Returns:**
- (Object|null): Next warning to display, or null if complete

---

#### `sherlockWarningFlow.handleAction(sherlockSessionId, action, username)`
Handles a user action in the consent flow.

**Parameters:**
- `sherlockSessionId` (string): Sherlock session ID
- `action` (string): Action type ('continue', 'grant_consent', 'deny_consent', 'cancel')
- `username` (string, optional): Username for search

**Returns:**
- (Object): Result of action

---

#### `sherlockWarningFlow.hasConsent(mainSessionId)`
Checks if user has Sherlock consent for a session.

**Parameters:**
- `mainSessionId` (string): User's main session ID

**Returns:**
- (boolean): True if consent granted

---

### **SherlockIntegration.js**

#### `processSherlockCommand(input, sessionId, consentState)`
Processes a Sherlock command.

**Parameters:**
- `input` (string): User input (e.g., '/sherlock username')
- `sessionId` (string): User session ID
- `consentState` (Object): Current consent state

**Returns:**
- (Object): Response object with `response`, `nextState`, and other properties

---

#### `registerSherlockCommand(chatbot)`
Registers the Sherlock command with the chatbot.

**Parameters:**
- `chatbot` (Object): Chatbot instance

**Returns:**
- (void)

---

#### `getSherlockHelp()`
Returns help text for the Sherlock command.

**Returns:**
- (string): Help text

---

#### `getSherlockUsageStats(sessionId)`
Returns usage statistics for a session.

**Parameters:**
- `sessionId` (string): User session ID

**Returns:**
- (Object): Usage statistics

---

## 🐛 Troubleshooting

### **Common Issues**

| Issue | Cause | Solution |
|-------|-------|----------|
| Sherlock command not recognized | Command not registered | Call `registerSherlockCommand(chatbot)` |
| Warnings not displaying | Session not initialized | Check session ID |
| Consent not persisting | Session expired | Start new session |
| Rate limit exceeded | Too many searches | Wait 1 hour |
| Invalid username | Username validation failed | Check username format |

### **Debugging**

Enable debug logging:

```javascript
// In SherlockWarningSystem.js
const DEBUG = true;

// Then add debug logs throughout the code
if (DEBUG) {
  console.log('[SHERLOCK_DEBUG]', message);
}
```

---

## 📝 Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | [Date] | Initial release |

---

## 🤝 Contributing

### **Reporting Issues**

If you find any issues with the Sherlock service, please:
1. Check the troubleshooting section
2. Review the audit logs
3. Report the issue with:
   - Steps to reproduce
   - Expected behavior
   - Actual behavior
   - Session ID (if available)

### **Suggesting Improvements**

We welcome suggestions for improving the Sherlock service, particularly:
- Additional privacy warnings
- Better safety tips
- Improved consent flow
- Enhanced validation

---

## 📄 License

This Sherlock Service is part of the SXWer AI ChatBot and is licensed under the same terms as the main project. See the main [LICENSE.txt](../../LICENSE.txt) file for details.

---

## 🙏 Acknowledgments

The Sherlock Warning System was designed with input from:
- Sex worker advocacy organizations
- Privacy and security experts
- Ethical AI researchers
- Digital rights organizations

Special thanks to:
- [SWOP USA](https://swopusa.org/) for guidance on sex worker safety
- [Red Umbrella Fund](https://www.redumbrellafund.org/) for ethical considerations
- [NSWP](https://www.nswp.org/) for global perspective

---

## 📞 Support

For support with the Sherlock service:
- **Documentation:** This README file
- **Community:** [SXWer AI ChatBot Community](https://github.com/easmit60-arch/SXWer_AI-ChatBot)
- **Issues:** [GitHub Issues](https://github.com/easmit60-arch/SXWer_AI-ChatBot/issues)
- **Email:** [support@yourorganization.org]

---

**Note:** This service is provided **as-is** for **personal safety verification only**. Users are responsible for their own use of this tool and must comply with all applicable laws and regulations.
