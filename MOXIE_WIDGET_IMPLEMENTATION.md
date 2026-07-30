# Moxie Widget Implementation Guide (Clippy-Style Pop-Out)

## 🎯 OVERVIEW

This guide provides the code to enhance Moxie from a simple paperclip companion to a **full Clippy-style pop-out widget** with media controls and direct functionality access.

---

## 📋 CURRENT STATE

**What's Already Implemented:**
- ✅ Moxie as cyan/pink/black neon paperclip
- ✅ Click to chat (opens prompt)
- ✅ Gentle check-ins (every 2 minutes)
- ✅ Special message styling
- ✅ Hover and click animations

**What's Missing (for Clippy-style widget):**
- ❌ Pop-out widget interface
- ❌ Media controls (sound, animation, dance)
- ❌ Direct functionality access
- ❌ Notifications display

---

## 🚀 IMPLEMENTATION STEPS

### Step 1: Add Widget HTML to index.html

**Find:** `</body>` tag (end of file)

**Add BEFORE it:**
```html
<!-- Moxie Widget (Pop-out) -->
<div id="moxie-widget" class="moxie-widget hidden">
  <div class="moxie-widget-header">
    <span class="moxie-widget-title">Moxie Companion</span>
    <button class="moxie-widget-close" onclick="document.getElementById('moxie-widget').classList.add('hidden')">×</button>
  </div>
  <div class="moxie-widget-body">
    <div class="moxie-widget-section">
      <h4>Quick Actions</h4>
      <div class="moxie-widget-buttons">
        <button onclick="chatWithMoxie()">Chat with Moxie</button>
        <button onclick="triggerCheckIn()">Gentle Check-In</button>
      </div>
    </div>
    <div class="moxie-widget-section">
      <h4>Media Controls</h4>
      <div class="moxie-widget-media">
        <button onclick="playSound()">🔊 Sound</button>
        <button onclick="playAnimation()">🎭 Animate</button>
        <button onclick="playDance()">💃 Dance</button>
      </div>
    </div>
    <div class="moxie-widget-section">
      <h4>Notifications</h4>
      <div class="moxie-notifications" id="moxie-notifications">
        <p>Moxie is ready to help!</p>
      </div>
    </div>
  </div>
</div>
```

---

### Step 2: Add Widget CSS to riot-grrrl.css

**Add to END of file:**
```css
/* Moxie Widget (Pop-out) */
.moxie-widget {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: var(--cream);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  width: 320px;
  max-width: 90vw;
  z-index: 3000;
  border: 2px solid var(--pink);
}

.moxie-widget.hidden {
  display: none;
}

.moxie-widget-header {
  background: var(--pink);
  color: var(--white);
  padding: 12px 16px;
  border-top-left-radius: var(--radius);
  border-top-right-radius: var(--radius);
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: bold;
}

.moxie-widget-title {
  font-size: 14px;
}

.moxie-widget-close {
  background: none;
  border: none;
  color: var(--white);
  font-size: 20px;
  cursor: pointer;
  padding: 0;
  line-height: 1;
}

.moxie-widget-close:hover {
  opacity: 0.8;
}

.moxie-widget-body {
  padding: 16px;
}

.moxie-widget-section {
  margin-bottom: 16px;
}

.moxie-widget-section h4 {
  color: var(--purple);
  margin: 0 0 8px 0;
  font-size: 13px;
}

.moxie-widget-buttons {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.moxie-widget-buttons button {
  padding: 8px 12px;
  font-size: 12px;
  background: var(--white);
  color: var(--black);
  border: 1px solid var(--silver);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.moxie-widget-buttons button:hover {
  background: var(--pink);
  color: var(--white);
  border-color: var(--pink);
}

.moxie-widget-media {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.moxie-widget-media button {
  padding: 8px 12px;
  font-size: 14px;
  background: var(--white);
  color: var(--black);
  border: 1px solid var(--silver);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.moxie-widget-media button:hover {
  background: var(--purple);
  color: var(--white);
  border-color: var(--purple);
}

.moxie-notifications {
  max-height: 100px;
  overflow-y: auto;
  padding: 8px;
  background: rgba(255, 45, 149, 0.1);
  border-radius: 6px;
  font-size: 12px;
}

/* Dark mode widget */
.dark-mode .moxie-widget {
  background: var(--cream);
  border-color: var(--pink);
}

.dark-mode .moxie-widget-header {
  background: var(--pink);
  color: var(--black);
}

.dark-mode .moxie-widget-buttons button {
  background: var(--white);
  color: var(--black);
  border-color: var(--silver);
}

.dark-mode .moxie-notifications {
  background: rgba(255, 79, 190, 0.2);
  color: var(--white);
}

/* Dance animation */
@keyframes moxieDance {
  0%, 100% { transform: rotate(0deg); }
  25% { transform: rotate(10deg); }
  50% { transform: rotate(-10deg); }
  75% { transform: rotate(5deg); }
}

.moxie-dancing {
  animation: moxieDance 2s infinite ease-in-out;
}
```

---

### Step 3: Add Widget JavaScript to index.html

**Find:** `// Initialize on load` section

**Add AFTER it:**
```javascript
// Moxie Widget Functions
function showMoxieWidget() {
  const widget = document.getElementById('moxie-widget');
  widget.classList.remove('hidden');
  const notifications = document.getElementById('moxie-notifications');
  notifications.innerHTML = '<p>Moxie is ready to help!</p>';
}

function chatWithMoxie() {
  document.getElementById('chat-input').focus();
  document.getElementById('chat-input').value = '/moxie ';
  sendMessage('/moxie ');
  document.getElementById('moxie-widget').classList.add('hidden');
}

function triggerCheckIn() {
  const randomIndex = Math.floor(Math.random() * MOXIE_CONFIG.checkInMessages.length);
  const message = MOXIE_CONFIG.checkInMessages[randomIndex];
  appendMessage('moxie', message, false, true);
  document.getElementById('moxie-widget').classList.add('hidden');
}

function playSound() {
  appendMessage('moxie', '🔊 I wish I could play a sound for you! (Sound feature coming soon)');
  document.getElementById('moxie-widget').classList.add('hidden');
}

function playAnimation() {
  const moxie = document.getElementById('moxie-paperclip');
  moxie.style.animation = 'moxieDance 0.5s ease';
  setTimeout(() => {
    moxie.style.animation = '';
  }, 500);
  appendMessage('moxie', '💃 Look at me dance!');
  document.getElementById('moxie-widget').classList.add('hidden');
}

function playDance() {
  const moxie = document.getElementById('moxie-paperclip');
  moxie.classList.add('moxie-dancing');
  appendMessage('moxie', '🕺 Dancing for you! Click me to stop.');
  document.getElementById('moxie-widget').classList.add('hidden');
  
  // Stop dancing after 5 seconds
  setTimeout(() => {
    moxie.classList.remove('moxie-dancing');
    appendMessage('moxie', '😊 Dance complete!');
  }, 5000);
}

// Update Moxie click to show widget
const moxieElement = document.getElementById('moxie-paperclip');
if (moxieElement) {
  moxieElement.onclick = function() {
    showMoxieWidget();
  };
}

// Stop dancing when clicked
moxieElement.addEventListener('click', function() {
  if (this.classList.contains('moxie-dancing')) {
    this.classList.remove('moxie-dancing');
    appendMessage('moxie', '😊 Dance stopped!');
  }
});
```

---

### Step 4: Update Moxie Click Handler

**Find:** The existing Moxie click handler (around line 500)

**Replace:**
```javascript
// OLD:
moxieElement.addEventListener('click', () => {
  const message = prompt(`Talk to ${MOXIE_CONFIG.name}:`);
  if (message) {
    sendMessage(`/moxie ${message}`);
  }
});

// NEW:
// (Already handled in Step 3 - the onclick is set to showMoxieWidget)
```

---

## 🎯 WHAT THIS ADDS

### 1. **Pop-Out Widget**
- Floating window appears when Moxie is clicked
- Centered on screen
- Can be closed with × button
- Responsive (works on mobile)

### 2. **Quick Actions**
- **Chat with Moxie**: Opens chat input with /moxie prefix
- **Gentle Check-In**: Triggers random check-in message

### 3. **Media Controls**
- **🔊 Sound**: Placeholder for sound functionality
- **🎭 Animate**: Plays short dance animation
- **💃 Dance**: Plays continuous dance (click Moxie to stop)

### 4. **Notifications**
- Shows current status
- Can be extended for actual notifications

---

## 📊 COMPARISON: CURRENT vs. ENHANCED

| Feature | Current | Enhanced (With Widget) |
|---------|---------|------------------------|
| Moxie Companion | ✅ Yes | ✅ Yes |
| Click to Chat | ✅ Yes | ✅ Yes (via widget) |
| Gentle Check-ins | ✅ Yes | ✅ Yes |
| Pop-out Widget | ❌ No | ✅ Yes |
| Media Controls | ❌ No | ✅ Yes |
| Direct Access | ❌ No | ✅ Yes |
| Notifications | ❌ No | ✅ Yes |
| Clippy-like | ❌ No | ✅ Yes |

---

## 🎨 VISUAL DESIGN

### Widget Layout:
```
┌─────────────────────────────────┐
│ Moxie Companion                    × │
├─────────────────────────────────┤
│                                     │
│ Quick Actions                      │
│ ┌─────────────────────────────┐   │
│ │ Chat with Moxie             │   │
│ ├─────────────────────────────┤   │
│ │ Gentle Check-In             │   │
│ └─────────────────────────────┘   │
│                                     │
│ Media Controls                    │
│ ┌─────┐ ┌─────┐ ┌─────┐           │
│ │ 🔊  │ │ 🎭  │ │ 💃  │           │
│ │Sound│ │Animate│ │Dance│          │
│ └─────┘ └─────┘ └─────┘           │
│                                     │
│ Notifications                     │
│ ┌─────────────────────────────┐   │
│ │ Moxie is ready to help!      │   │
│ └─────────────────────────────┘   │
│                                     │
└─────────────────────────────────┘
```

---

## 🚀 HOW TO TEST

After implementing the above changes:

1. **Click Moxie paperclip** → Widget appears
2. **Try Quick Actions**:
   - Click "Chat with Moxie" → Chat input focuses with /moxie prefix
   - Click "Gentle Check-In" → Random check-in message appears
3. **Try Media Controls**:
   - Click "🔊 Sound" → Message about sound appears
   - Click "🎭 Animate" → Moxie does short dance
   - Click "💃 Dance" → Moxie dances continuously
4. **Stop Dancing**: Click Moxie again to stop
5. **Close Widget**: Click × button

---

## 📝 NOTES

### Sound Feature
The sound button currently shows a message. To implement actual sound:
```javascript
function playSound() {
  const audio = new Audio('/path/to/sound.mp3');
  audio.play();
  appendMessage('moxie', '🔊 Playing sound!');
  document.getElementById('moxie-widget').classList.add('hidden');
}
```

### Customization
- Change widget size by modifying `width: 320px`
- Change colors in the CSS variables
- Add more media controls as needed
- Extend notifications for actual alerts

---

## ✅ VERIFICATION CHECKLIST

After implementation, verify:
- [ ] Widget appears when Moxie is clicked
- [ ] Widget can be closed with × button
- [ ] Quick Actions buttons work
- [ ] Media Controls buttons work
- [ ] Dance animation plays and can be stopped
- [ ] Widget is responsive on mobile
- [ ] Dark mode styling works
- [ ] All existing functionality still works

---

## 🎉 RESULT

After implementing this guide, Moxie will have **full Clippy-style pop-out widget functionality** with:
- Direct access to all features
- Media controls
- Notifications
- Professional widget interface

**The system will match and exceed Clippy's functionality while maintaining the trauma-informed, privacy-first design.**
