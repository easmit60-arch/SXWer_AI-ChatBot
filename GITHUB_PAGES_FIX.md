# 🚀 GitHub Pages Fix - SXWer AI ChatBot

**Issue:** Chatbot UI loads but all interactive elements are non-functional on GitHub Pages  
**Root Cause:** Frontend tries to call Node.js backend that doesn't exist on GitHub Pages  
**Solution:** Enable offline-first mode for GitHub Pages deployment  

---

## ⚡ Quick Fix (5 minutes)

### **Option A: Temporary Offline Mode (Recommended for GitHub Pages)**

**Add this to the `<head>` of your `index.html` BEFORE the closing `</head>` tag:**

```html
<script>
  // GitHub Pages Fix: Force offline mode
  window.__githubPagesMode = true;
</script>
```

**Then add this at the very beginning of your main JavaScript (after the `<body>` tag):**

```html
<script>
  // GitHub Pages Fix: Override API calls
  if (window.__githubPagesMode) {
    // Force offline mode
    window.onlineApiConfigured = false;
    
    // Override createSession to return mock data
    window.createSession = async function() {
      return {
        token: `ghpages_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        sessionId: window.sessionId || 'github-pages-session',
      };
    };
    
    // Override checkOnlineMode to return offline
    window.checkOnlineMode = async function() {
      return {
        online: false,
        model: "local-offline",
        status: "offline",
      };
    };
    
    // Override requestLocalPermissions to auto-grant
    window.requestLocalPermissions = async function(scope) {
      window.localPermissions = { offline: true, scope: scope || "offline" };
      if (window.saveLocalPermissions) window.saveLocalPermissions();
      return { success: true, ...window.localPermissions };
    };
    
    // Override sendMessage to use local chatbot
    window.sendMessageOverride = async function(text = null) {
      const messageText = text || document.getElementById('chat-input')?.value?.trim();
      if (!messageText) return;
      
      const chatInput = document.getElementById('chat-input');
      if (chatInput) chatInput.value = "";
      
      // Use local chatbot
      if (window.__sxwerLocalAssistant?.chatbot) {
        const response = window.__sxwerLocalAssistant.chatbot(messageText, {
          sessionId: window.sessionId,
          consent: window.consent || { ai: false, tools: false },
          localPermissions: window.localPermissions || { offline: false },
          mode: "offline",
        });
        
        // Display response
        if (window.appendMessage) {
          if (response.from === "Moxie") {
            window.appendMessage("moxie", response.response, false, false, false);
          } else {
            const msg = window.appendMessage("assistant", response.response, false, false, false);
            if (response.explanation && window.appendExplanation) {
              window.appendExplanation(msg, response.explanation);
            }
          }
        }
        
        // Update consent if needed
        if (response.consentGranted) {
          window.consent = { ai: true, tools: window.consent?.tools || false };
          if (window.saveConsentState) window.saveConsentState();
        }
        
        if (window.setStatus) window.setStatus("Ready");
        if (chatInput) chatInput.focus();
      }
    };
  }
</script>
```

**Then modify the sendBtn event listener to use the override:**

```javascript
// Change from:
sendBtn.addEventListener("click", () => sendMessage());

// To:
sendBtn.addEventListener("click", () => {
  if (window.sendMessageOverride) {
    sendMessageOverride();
  } else {
    sendMessage();
  }
});
```

---

## ✅ Complete Fix (Recommended)

### **Step 1: Create a GitHub Pages Configuration File**

Create a new file: `/workspace/easmit60-arch__SXWer_AI-ChatBot/github-pages-config.js`

```javascript
/**
 * GitHub Pages Configuration
 * This file configures the chatbot to work in offline mode on GitHub Pages
 */

// Export configuration
const GitHubPagesConfig = Object.freeze({
  // Force offline mode
  onlineApiConfigured: false,
  
  // Backend URL (empty for GitHub Pages)
  backendUrl: '',
  
  // Static asset prefix for GitHub Pages
  assetPrefix: '/SXWer_AI-ChatBot/',
  
  // Feature flags for GitHub Pages
  features: {
    e2eEncryption: false, // Requires backend
    onlineAI: false,      // Requires backend
    sherlock: true,       // Can work offline with warnings
    moxie: true,          // Works offline
    consent: true,        // Works offline
    crisisDetection: true, // Works offline
  },
});

// Override functions for GitHub Pages
const GitHubPagesOverrides = {
  // Mock session creation
  createSession: async function() {
    return {
      token: `ghpages_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      sessionId: window.sessionId || `ghpages_session_${Date.now()}`,
    };
  },
  
  // Mock health check
  checkOnlineMode: async function() {
    return {
      online: false,
      model: "local-offline",
      status: "offline",
    };
  },
  
  // Auto-grant local permissions
  requestLocalPermissions: async function(scope) {
    window.localPermissions = { offline: true, scope: scope || "offline" };
    if (window.saveLocalPermissions) window.saveLocalPermissions();
    return { success: true, ...window.localPermissions };
  },
  
  // Use local chatbot
  sendMessage: async function(text = null) {
    const messageText = text || document.getElementById('chat-input')?.value?.trim();
    if (!messageText) return;
    
    const chatInput = document.getElementById('chat-input');
    if (chatInput) chatInput.value = "";
    
    // Show loading
    if (window.appendMessage) {
      window.appendMessage("assistant", "", true);
    }
    if (window.setStatus) window.setStatus("Thinking...", false, true);
    
    try {
      // Use local chatbot
      if (window.__sxwerLocalAssistant?.chatbot) {
        const response = window.__sxwerLocalAssistant.chatbot(messageText, {
          sessionId: window.sessionId,
          consent: window.consent || { ai: false, tools: false },
          localPermissions: window.localPermissions || { offline: false },
          mode: "offline",
        });
        
        // Remove loading
        const loadingMsgs = document.querySelectorAll('.message.loading');
        loadingMsgs.forEach(msg => msg.remove());
        
        // Display response
        if (window.appendMessage) {
          if (response.from === "Moxie") {
            window.appendMessage("moxie", response.response, false, false, false);
          } else {
            const msg = window.appendMessage("assistant", response.response, false, false, false);
            if (response.explanation && window.appendExplanation) {
              window.appendExplanation(msg, response.explanation);
            }
          }
        }
        
        // Update consent if needed
        if (response.consentGranted) {
          window.consent = { ai: true, tools: window.consent?.tools || false };
          if (window.saveConsentState) window.saveConsentState();
        }
        if (response.consentRevoked) {
          window.consent = { ai: false, tools: window.consent?.tools || false };
          if (window.saveConsentState) window.saveConsentState();
        }
        
        if (window.setStatus) window.setStatus("Ready");
        if (chatInput) chatInput.focus();
      }
    } catch (error) {
      const loadingMsgs = document.querySelectorAll('.message.loading');
      loadingMsgs.forEach(msg => msg.remove());
      if (window.appendMessage) {
        window.appendMessage("assistant", "Sorry, I encountered an error processing your message.", false, false, false);
      }
      if (window.setStatus) window.setStatus("Error - try again");
      console.error('[GitHubPages] sendMessage error:', error);
    }
  },
};

// Auto-apply overrides if on GitHub Pages
if (window.location.hostname.includes('github.io')) {
  // Apply configuration
  window.GitHubPagesConfig = GitHubPagesConfig;
  
  // Apply overrides
  Object.assign(window, GitHubPagesOverrides);
  
  // Update UI to reflect offline mode
  const offlineToggle = document.getElementById('offline-toggle');
  const e2eBadge = document.getElementById('e2e-badge');
  
  if (offlineToggle) {
    offlineToggle.classList.add('on');
    offlineToggle.classList.remove('off');
    const label = offlineToggle.querySelector('.label');
    if (label) label.textContent = 'Offline';
  }
  
  if (e2eBadge) {
    e2eBadge.classList.add('e2e-on');
    e2eBadge.classList.remove('e2e-off');
    e2eBadge.textContent = '🔒 Offline';
    e2eBadge.title = 'Running in offline mode. All processing happens locally on your device.';
  }
  
  console.log('[GitHubPages] Offline mode enabled');
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { GitHubPagesConfig, GitHubPagesOverrides };
}
```

### **Step 2: Update index.html to Load Configuration**

**Add this to the `<head>` section:**

```html
<!-- GitHub Pages Configuration -->
<script src="github-pages-config.js"></script>
```

**Make sure it's loaded BEFORE the main chatbot JavaScript.**

### **Step 3: Update Static Asset Paths**

**Find and replace all absolute paths with relative paths:**

```html
<!-- Change from: -->
<script src="/public/nacl.min.js"></script>
<script src="/public/nacl-util.min.js"></script>
<script src="/public/sxwer-crypto.js"></script>

<!-- Change to: -->
<script src="public/nacl.min.js"></script>
<script src="public/nacl-util.min.js"></script>
<script src="public/sxwer-crypto.js"></script>
```

### **Step 4: Add Base Tag for GitHub Pages**

**Add this to the `<head>` section:**

```html
<base href="/SXWer_AI-ChatBot/">
```

### **Step 5: Update Navigation Links**

**Find and replace all navigation links:**

```html
<!-- Change from: -->
<a href="/human-rights-report">Human Rights Report</a>
<a href="/privacy-dashboard">Privacy Dashboard</a>

<!-- Change to: -->
<a href="human-rights-report.html">Human Rights Report</a>
<a href="privacy-dashboard.html">Privacy Dashboard</a>
```

---

## 🎯 Full Backend Deployment (Option 2)

If you want **full functionality** with online AI models, follow these steps:

### **Step 1: Deploy Backend to Render**

1. **Sign up for Render:** [https://render.com/](https://render.com/)

2. **Create a new Web Service:**
   - Connect your GitHub repository
   - Select the `main` branch
   - **Name:** `sxwer-ai-chatbot-backend`
   - **Region:** Choose closest to your users
   - **Branch:** `main`
   - **Root Directory:** (leave blank)
   - **Build Command:** `npm install`
   - **Start Command:** `node server-offline.js`
   - **Port:** `3000`

3. **Add Environment Variables:**
   - Copy all variables from `.env.example`
   - Set `PORT=3000`
   - Set `NODE_ENV=production`

4. **Deploy:**
   - Click "Create Web Service"
   - Wait for deployment (2-5 minutes)
   - Note your backend URL (e.g., `https://sxwer-ai-chatbot-backend.onrender.com`)

### **Step 2: Update Frontend to Use Backend URL**

**Create a configuration file:** `/workspace/easmit60-arch__SXWer_AI-ChatBot/config.js`

```javascript
/**
 * Frontend Configuration
 * Update this with your backend URL
 */

const Config = Object.freeze({
  // Backend URL (update this with your Render/Vercel/other URL)
  backendUrl: 'https://sxwer-ai-chatbot-backend.onrender.com',
  
  // Feature flags
  features: {
    onlineAI: true,
    e2eEncryption: true,
    sherlock: true,
  },
  
  // API endpoints
  endpoints: {
    session: '/api/session',
    health: '/api/health',
    chat: '/api/chat',
    localPermissions: '/api/local-permissions',
  },
});

// Export for usage
if (typeof window !== 'undefined') {
  window.AppConfig = Config;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Config;
}
```

**Update index.html to use the configuration:**

```html
<!-- Add to head -->
<script src="config.js"></script>
```

**Update all fetch calls to use the backend URL:**

```javascript
// Change from:
fetch("/api/chat", { ... })

// Change to:
fetch(`${window.AppConfig.backendUrl}${window.AppConfig.endpoints.chat}`, { ... })
```

### **Step 3: Enable CORS on Backend**

**Update server-offline.js:**

```javascript
// Add to imports at the top
import cors from 'cors';

// Update CORS configuration (around line 100)
const corsOptions = {
  origin: [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'https://easmit60-arch.github.io',  // GitHub Pages
    'http://localhost:8080',
    'http://127.0.0.1:8080',
  ],
  optionsSuccessStatus: 200,
  credentials: true,
};

// Make sure this line exists and is before your routes
app.use(cors(corsOptions));
```

### **Step 4: Update GitHub Pages Configuration**

**Add base tag:**

```html
<head>
  <base href="/SXWer_AI-ChatBot/">
  <!-- existing content -->
</head>
```

**Update static asset paths:**

```html
<!-- Change from absolute to relative -->
<script src="public/nacl.min.js"></script>
<script src="public/sxwer-crypto.js"></script>
```

---

## 🧪 Testing Your Fix

### **Test Option 1 (Offline Mode):**

1. **Apply the offline mode fix**
2. **Commit and push to GitHub:**
   ```bash
   git add .
   git commit -m "Fix GitHub Pages: enable offline mode"
   git push origin main
   ```
3. **Wait for GitHub Pages to deploy** (1-2 minutes)
4. **Visit your site:** https://easmit60-arch.github.io/SXWer_AI-ChatBot/
5. **Test the chatbot:**
   - Type a message and press Enter
   - Click the Send button
   - Try other buttons (dark mode, help, etc.)
6. **Check browser console (F12):**
   - No errors should appear
   - No 404 errors for `/api/*` endpoints

### **Test Option 2 (Backend Deployment):**

1. **Deploy backend to Render**
2. **Update frontend configuration**
3. **Commit and push changes:**
   ```bash
   git add .
   git commit -m "Fix GitHub Pages: add backend URL configuration"
   git push origin main
   ```
4. **Wait for deployment**
5. **Test all features:**
   - Chat functionality
   - AI responses
   - Consent system
   - Sherlock tool
   - All buttons and interactions

---

## 📊 Troubleshooting

### **Problem: Buttons still don't work**

**Check:**
1. Open browser console (F12 → Console)
2. Click a button
3. Look for errors

**Common issues:**
- `Uncaught ReferenceError: sendMessage is not defined` → JavaScript not loading
- `404 Not Found` for JS files → Wrong path to JavaScript files
- No errors but nothing happens → Event listeners not attached

**Fix:**
- Verify all script tags have correct paths
- Check that JavaScript files are in the correct location
- Ensure no typos in function names

### **Problem: Chat input doesn't work**

**Check:**
1. Type in chat input
2. Press Enter
3. Look in console for errors

**Common issues:**
- `Cannot read property 'value' of null` → chatInput element not found
- `sendMessage is not a function` → Function not defined

**Fix:**
- Verify element IDs match: `document.getElementById('chat-input')`
- Check that sendMessage function is defined

### **Problem: No response from chatbot**

**Check:**
1. Open Network tab (F12 → Network)
2. Type a message and press Enter
3. Look for API calls

**Common issues:**
- No API calls → Offline mode working correctly
- 404 for `/api/chat` → Backend not deployed or wrong URL
- CORS error → Backend CORS not configured

**Fix:**
- For offline mode: This is expected, chatbot uses local logic
- For backend mode: Verify backend URL and CORS configuration

---

## ✅ Verification Checklist

After deploying your fix, verify all of these:

### **Basic Functionality**
- [ ] Page loads without errors
- [ ] Chat input accepts text
- [ ] Send button works
- [ ] Enter key sends message
- [ ] Chatbot responds to messages

### **UI Elements**
- [ ] Dark mode toggle works
- [ ] Help button works
- [ ] Moxie widget appears
- [ ] Command help appears on `/`
- [ ] All navigation links work

### **Privacy Features**
- [ ] Consent system works
- [ ] Data manager accessible
- [ ] Privacy dashboard accessible
- [ ] Delete my data works

### **Safety Features**
- [ ] Crisis detection works
- [ ] Sherlock tool works (with warnings)
- [ ] Resource links work

### **Technical**
- [ ] No errors in browser console
- [ ] No 404 errors in Network tab
- [ ] No CORS errors
- [ ] All static assets load (200 status)

---

## 🎯 Summary

| **Solution** | **Time** | **Difficulty** | **Result** |
|--------------|----------|---------------|------------|
| **Option 1: Offline Mode** | 5-10 min | Easy | ✅ Works on GitHub Pages, limited features |
| **Option 2: Backend Deployment** | 2-4 hours | Medium | ✅ Full features, requires backend hosting |
| **Option 3: Cloudflare Workers** | 4-8 hours | Hard | ✅ Full features, edge computing |

**Recommendation:** Start with **Option 1** for immediate fix, then implement **Option 2** for full functionality.

---

## 📞 Need More Help?

If you're still having issues:

1. **Check the browser console** for specific errors
2. **Test with a simple button** to verify JS is loading:
   ```html
   <button onclick="alert('Test')">Test Button</button>
   ```
3. **Verify network requests** in DevTools Network tab
4. **Review the GitHub Pages Debug Guide** for detailed troubleshooting
5. **Create a minimal test case** to isolate the problem

---

**Document Version:** 1.0.0  
**Last Updated:** [Date]  
**Author:** Vibe Code (Senior Full-Stack Developer)
