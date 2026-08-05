# 🎙️ Mistral Audio Service - Integration Guide

**Version:** 1.0.0  
**Last Updated:** 2024  
**Status:** ✅ Production Ready  

---

## 📋 Quick Start Checklist

- [ ] **Set your API key** (environment variable or direct)
- [ ] **Install dependencies** (`npm install node-fetch`)
- [ ] **Grant consent** before using audio features
- [ ] **Test TTS** with a simple text
- [ ] **Test STT** with an audio file
- [ ] **Integrate** into your application

---

## 🚀 Step 1: Set Up Your Environment

### **Option A: Environment Variable (Recommended)**

```bash
# Linux/macOS
mkdir -p ~/.sxwer
 echo "export MISTRAL_API_KEY='your-api-key-here'" >> ~/.sxwer/env.sh
source ~/.sxwer/env.sh

# Windows (PowerShell)
$env:MISTRAL_API_KEY="your-api-key-here"

# Windows (CMD)
setx MISTRAL_API_KEY "your-api-key-here"
```

### **Option B: .env File**

```bash
# Create .env file in your project root
cat > .env << 'EOF'
MISTRAL_API_KEY=your-api-key-here
EOF

# Load in Node.js
npm install dotenv
```

### **Option C: Direct Initialization**

```javascript
import { MistralAudioService } from './services/audio/MistralAudioService.js';

const audioService = new MistralAudioService('your-api-key-here');
```

**💡 Get your API key:** [https://console.mistral.ai/](https://console.mistral.ai/)

---

## 🚀 Step 2: Install Dependencies

```bash
# Navigate to your project
cd /workspace/easmit60-arch__SXWer_AI-ChatBot

# Install audio service dependencies
npm install node-fetch dotenv

# Or for the entire project
npm install
```

---

## 🚀 Step 3: Test the Audio Service

### **Test TTS (Text-to-Speech)**

```bash
# Run the TTS example
node services/audio/examples/tts.js
```

**Expected Output:**
```
======================================================================
🎙️  MISTRAL AUDIO SERVICE - TTS EXAMPLES
======================================================================

🎙️  Example 1: Basic TTS

✅ Consent granted for TTS
🔊 Generating speech...
✅ Speech generated successfully
   Model: voxtral-mini-tts-2603
   Voice: en_esme_neutral
   Format: mp3
✅ Audio saved to: services/audio/examples/output.mp3
   File size: 12.34 KB

======================================================================
✅ Examples complete!
======================================================================

📊 Service Status:
   API Key: ✅ Configured
   TTS Rate Limit: 9/10
   STT Rate Limit: 5/5
   Active Sessions: 1
```

### **Test STT (Speech-to-Text)**

First, generate a test audio file using TTS:
```bash
node services/audio/examples/tts.js
```

Then run the STT example:
```bash
node services/audio/examples/stt.js
```

**Expected Output:**
```
======================================================================
🎤 MISTRAL AUDIO SERVICE - STT EXAMPLES
======================================================================

🎤 Example 1: Basic STT

✅ Consent granted for STT
📁 Transcribing: output.mp3
   Size: 12.34 KB
🔊 Transcribing...
✅ Transcription complete

📄 Transcription:
------------------------------------------------------------
Hello, I am Becky Tahablu, co-founder of Root Support Network.
------------------------------------------------------------

======================================================================
✅ Examples complete!
======================================================================
```

---

## 🚀 Step 4: Integrate into SXWer AI ChatBot

### **Option A: Direct Integration (Recommended)**

**1. Import the audio service in your chatbot:**

```javascript
// In chatbot.js
import { mistralAudioService } from './services/audio/MistralAudioService.js';

// Add audio methods to your chatbot
export const chatbot = {
  // ... existing methods ...
  
  // Audio methods
  async textToSpeech(text, options = {}) {
    const sessionId = options.sessionId || this.sessionId;
    
    // Check consent
    if (!mistralAudioService.hasConsent(sessionId, 'tts')) {
      return { 
        error: 'Audio consent required. Type /audio-consent on to enable.',
        consentRequired: true 
      };
    }
    
    try {
      const result = await mistralAudioService.textToSpeech(text, {
        sessionId,
        ...options
      });
      
      return {
        success: true,
        audioData: result.audioData,
        model: result.model,
        voiceId: result.voiceId,
        format: result.responseFormat
      };
    } catch (error) {
      console.error('[Chatbot] TTS Error:', error.message);
      return { error: error.message };
    }
  },
  
  async speechToText(audio, options = {}) {
    const sessionId = options.sessionId || this.sessionId;
    
    // Check consent
    if (!mistralAudioService.hasConsent(sessionId, 'stt')) {
      return { 
        error: 'Audio consent required. Type /audio-consent on to enable.',
        consentRequired: true 
      };
    }
    
    try {
      const result = await mistralAudioService.speechToText(audio, {
        sessionId,
        ...options
      });
      
      return {
        success: true,
        text: result.text,
        model: result.model,
        diarize: result.diarize,
        segments: result.segments
      };
    } catch (error) {
      console.error('[Chatbot] STT Error:', error.message);
      return { error: error.message };
    }
  },
  
  // Consent management
  grantAudioConsent(type = 'audio') {
    const sessionId = this.sessionId;
    mistralAudioService.grantConsent(sessionId, type);
    return { success: true };
  },
  
  revokeAudioConsent(type = 'audio') {
    const sessionId = this.sessionId;
    mistralAudioService.revokeConsent(sessionId, type);
    return { success: true };
  },
  
  getAudioConsentState() {
    const sessionId = this.sessionId;
    return mistralAudioService.getConsentState(sessionId);
  },
  
  // Audio status
  getAudioStatus() {
    return mistralAudioService.getStatus();
  }
};
```

**2. Add commands to your chatbot:**

```javascript
// In index.html or your command processor
const COMMAND_HELP = {
  // ... existing commands ...
  
  // Audio commands
  '/tts <text>': 'Convert text to speech (requires audio consent)',
  '/stt': 'Transcribe audio file (requires audio consent)',
  '/audio-consent on': 'Grant audio processing consent',
  '/audio-consent off': 'Revoke audio processing consent',
  '/audio-status': 'Check audio service status',
  '/voices': 'List available TTS voices',
  '/audio-help': 'Show audio commands help'
};

// Command handler
async function handleCommand(input, sessionId) {
  const command = input.trim().toLowerCase();
  
  // TTS command
  if (command.startsWith('/tts ')) {
    const text = input.substring(5).trim();
    if (!text) {
      return 'Usage: /tts <text> - Convert text to speech. Example: /tts Hello world';
    }
    
    const result = await chatbot.textToSpeech(text, { sessionId });
    
    if (result.error) {
      if (result.consentRequired) {
        return `⚠️ ${result.error}\n\nTo enable audio features, type: /audio-consent on`;
      }
      return `❌ Error: ${result.error}`;
    }
    
    // Create audio element and play
    const audio = new Audio(`data:audio/mp3;base64,${result.audioData}`);
    audio.play();
    
    return `🔊 Playing audio: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`;
  }
  
  // STT command
  if (command === '/stt') {
    // Trigger file input
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'audio/*';
    fileInput.style.display = 'none';
    
    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      appendMessage('user', `Transcribing: ${file.name}`, false, false, false);
      
      const result = await chatbot.speechToText(file, { sessionId });
      
      if (result.error) {
        if (result.consentRequired) {
          appendMessage('assistant', `⚠️ ${result.error}\n\nTo enable audio features, type: /audio-consent on`, false, false, false);
        } else {
          appendMessage('assistant', `❌ Error: ${result.error}`, false, false, false);
        }
      } else {
        appendMessage('assistant', `🎤 Transcription:\n\n${result.text}`, false, false, false);
      }
    });
    
    document.body.appendChild(fileInput);
    fileInput.click();
    
    return '📁 Please select an audio file to transcribe...';
  }
  
  // Audio consent commands
  if (command === '/audio-consent on') {
    const result = chatbot.grantAudioConsent('audio');
    return result.success ? 
      '✅ Audio consent granted. You can now use /tts and /stt commands.' : 
      '❌ Failed to grant consent.';
  }
  
  if (command === '/audio-consent off') {
    const result = chatbot.revokeAudioConsent('audio');
    return result.success ? 
      '✅ Audio consent revoked. /tts and /stt commands are now disabled.' : 
      '❌ Failed to revoke consent.';
  }
  
  // Audio status
  if (command === '/audio-status') {
    const status = chatbot.getAudioStatus();
    const consent = chatbot.getAudioConsentState();
    
    return `🎙️ Audio Service Status:\n\n` +
           `API Key: ${status.apiKeyConfigured ? '✅ Configured' : '❌ Not configured'}\n` +
           `TTS Rate Limit: ${status.ttsRateLimit.remaining}/${status.ttsRateLimit.limit} requests\n` +
           `STT Rate Limit: ${status.sttRateLimit.remaining}/${status.sttRateLimit.limit} requests\n` +
           `Consent: TTS=${consent.tts ? '✅' : '❌'}, STT=${consent.stt ? '✅' : '❌'}`;
  }
  
  // List voices
  if (command === '/voices') {
    const voices = mistralAudioService.getAvailableVoices();
    const voiceList = Object.entries(voices).map(([id, name]) => `- ${id}: ${name}`).join('\n');
    return `🎤 Available TTS Voices:\n\n${voiceList}`;
  }
  
  // Audio help
  if (command === '/audio-help') {
    const helpText = Object.entries(COMMAND_HELP)
      .filter(([cmd]) => cmd.startsWith('/audio') || cmd.startsWith('/tts') || cmd.startsWith('/stt'))
      .map(([cmd, desc]) => `  ${cmd.padEnd(20)} - ${desc}`)
      .join('\n');
    
    return `🎙️ Audio Commands:\n\n${helpText}\n\n` +
           `Note: Audio features require consent. Type /audio-consent on to enable.`;
  }
  
  // ... existing command handling ...
}
```

### **Option B: Standalone Module (Alternative)**

If you prefer to keep the audio service separate:

```javascript
// In your main application file
import { mistralAudioService } from './services/audio/MistralAudioService.js';

// Initialize with API key
const audioService = new MistralAudioService(process.env.MISTRAL_API_KEY);

// Use directly
audioService.grantConsent('user-session', 'tts');
const ttsResult = await audioService.textToSpeech('Hello world', {
  sessionId: 'user-session'
});

const sttResult = await audioService.speechToText('audio.mp3', {
  sessionId: 'user-session'
});
```

---

## 🚀 Step 5: Add UI Controls

### **Add Audio Controls to Chat Interface**

```html
<!-- Add to your chat interface HTML -->
<div class="audio-controls" style="display: flex; gap: 10px; margin: 10px 0; flex-wrap: wrap;">
  <button 
    id="tts-button" 
    type="button" 
    title="Text to Speech (Ctrl+Shift+T)"
    style="background: #ff2d95; color: white; border: none; padding: 8px 16px; border-radius: 8px; cursor: pointer;"
  >
    🔊 TTS
  </button>
  
  <button 
    id="stt-button" 
    type="button" 
    title="Speech to Text (Ctrl+Shift+S)"
    style="background: #7d2cff; color: white; border: none; padding: 8px 16px; border-radius: 8px; cursor: pointer;"
  >
    🎤 STT
  </button>
  
  <button 
    id="audio-consent-button" 
    type="button" 
    title="Toggle Audio Consent"
    style="background: #ff9eb5; color: #111; border: none; padding: 8px 16px; border-radius: 8px; cursor: pointer;"
  >
    🎙️ Consent
  </button>
  
  <input 
    type="file" 
    id="audio-upload" 
    accept="audio/*" 
    style="display: none;"
  />
</div>

<!-- Add audio status indicator -->
<div 
  id="audio-status" 
  style="font-size: 12px; color: #666; margin: 5px 0; min-height: 18px;"
>
  Audio: Not configured
</div>
```

### **Add Event Listeners**

```javascript
// Audio controls
document.getElementById('tts-button')?.addEventListener('click', () => {
  const text = prompt('Enter text to convert to speech:');
  if (text) {
    sendMessage(`/tts ${text}`);
  }
});

document.getElementById('stt-button')?.addEventListener('click', () => {
  sendMessage('/stt');
});

document.getElementById('audio-consent-button')?.addEventListener('click', () => {
  const consent = chatbot.getAudioConsentState();
  if (consent.tts && consent.stt) {
    sendMessage('/audio-consent off');
  } else {
    sendMessage('/audio-consent on');
  }
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  // Ctrl+Shift+T for TTS
  if (e.ctrlKey && e.shiftKey && e.key === 'T') {
    e.preventDefault();
    const text = prompt('Enter text to convert to speech:');
    if (text) {
      sendMessage(`/tts ${text}`);
    }
  }
  
  // Ctrl+Shift+S for STT
  if (e.ctrlKey && e.shiftKey && e.key === 'S') {
    e.preventDefault();
    sendMessage('/stt');
  }
});

// Update audio status periodically
function updateAudioStatus() {
  const statusEl = document.getElementById('audio-status');
  if (!statusEl) return;
  
  try {
    const status = chatbot.getAudioStatus();
    const consent = chatbot.getAudioConsentState();
    
    const parts = [];
    
    if (!status.apiKeyConfigured) {
      parts.push('⚠️ API Key not set');
    } else {
      parts.push(`✅ TTS: ${status.ttsRateLimit.remaining}/${status.ttsRateLimit.limit}`);
      parts.push(`✅ STT: ${status.sttRateLimit.remaining}/${status.sttRateLimit.limit}`);
    }
    
    parts.push(`Consent: TTS=${consent.tts ? '✅' : '❌'}, STT=${consent.stt ? '✅' : '❌'}`);
    
    statusEl.textContent = `Audio: ${parts.join(' | ')}`;
    
    // Update button states
    const ttsBtn = document.getElementById('tts-button');
    const sttBtn = document.getElementById('stt-button');
    
    if (ttsBtn) {
      ttsBtn.disabled = !status.apiKeyConfigured || !consent.tts;
      ttsBtn.style.opacity = ttsBtn.disabled ? '0.5' : '1';
    }
    
    if (sttBtn) {
      sttBtn.disabled = !status.apiKeyConfigured || !consent.stt;
      sttBtn.style.opacity = sttBtn.disabled ? '0.5' : '1';
    }
  } catch (error) {
    console.error('[Audio] Status update error:', error);
  }
}

// Update status every 30 seconds
setInterval(updateAudioStatus, 30000);
updateAudioStatus();
```

---

## 🚀 Step 6: Add Voice Selection (Optional)

### **Add Voice Selector to UI**

```html
<!-- Add to your chat interface -->
<div class="voice-selector" style="margin: 10px 0;">
  <label for="voice-select" style="margin-right: 10px; font-size: 14px;">
    🎤 Voice:
  </label>
  <select 
    id="voice-select" 
    style="padding: 8px; border-radius: 8px; border: 1px solid #ddd; font-size: 14px;"
  >
    <option value="en_esme_neutral">English - Esme (Neutral)</option>
    <option value="en_oliver_excited">English - Oliver (Excited)</option>
    <option value="fr_marie_excited">French - Marie (Excited)</option>
    <option value="fr_denise_neutral">French - Denise (Neutral)</option>
    <option value="de_klaus_neutral">German - Klaus (Neutral)</option>
    <option value="es_sofia_neutral">Spanish - Sofia (Neutral)</option>
  </select>
</div>
```

### **Update TTS Command to Use Selected Voice**

```javascript
// Update the TTS command handler
if (command.startsWith('/tts ')) {
  const text = input.substring(5).trim();
  if (!text) {
    return 'Usage: /tts <text> - Convert text to speech';
  }
  
  // Get selected voice
  const voiceSelect = document.getElementById('voice-select');
  const voiceId = voiceSelect ? voiceSelect.value : 'en_esme_neutral';
  
  const result = await chatbot.textToSpeech(text, {
    sessionId,
    voiceId
  });
  
  // ... rest of the code ...
}

// Also update the button click handler
document.getElementById('tts-button')?.addEventListener('click', () => {
  const text = prompt('Enter text to convert to speech:');
  if (text) {
    const voiceSelect = document.getElementById('voice-select');
    const voiceId = voiceSelect ? voiceSelect.value : 'en_esme_neutral';
    sendMessage(`/tts ${text} --voice ${voiceId}`);
  }
});

// Update command processor to handle voice parameter
if (command.startsWith('/tts ')) {
  const parts = command.substring(5).trim().split('--voice');
  const text = parts[0].trim();
  const voiceId = parts[1] ? parts[1].trim() : 'en_esme_neutral';
  
  if (!text) {
    return 'Usage: /tts <text> [--voice <voice_id>] - Convert text to speech';
  }
  
  const result = await chatbot.textToSpeech(text, {
    sessionId,
    voiceId
  });
  
  // ... rest of the code ...
}
```

---

## 🚀 Step 7: Add Audio Recording (Optional)

For **real-time audio recording** in the browser:

### **1. Add Recording UI**

```html
<!-- Add to your chat interface -->
<div class="recording-controls" style="display: flex; gap: 10px; margin: 10px 0; align-items: center;">
  <button 
    id="start-recording" 
    type="button" 
    title="Start Recording (Ctrl+Shift+R)"
    style="background: #dc2626; color: white; border: none; padding: 8px 16px; border-radius: 8px; cursor: pointer; display: none;"
    disabled
  >
    ⏺ Start
  </button>
  
  <button 
    id="stop-recording" 
    type="button" 
    title="Stop Recording"
    style="background: #16a34a; color: white; border: none; padding: 8px 16px; border-radius: 8px; cursor: pointer; display: none;"
    disabled
  >
    ⏹ Stop
  </button>
  
  <button 
    id="cancel-recording" 
    type="button" 
    title="Cancel Recording"
    style="background: #6b7280; color: white; border: none; padding: 8px 16px; border-radius: 8px; cursor: pointer; display: none;"
    disabled
  >
    ⏹️ Cancel
  </button>
  
  <div id="recording-status" style="font-size: 12px; color: #666; margin-left: 10px;"></div>
</div>

<!-- Add audio visualization (optional) -->
<canvas 
  id="audio-visualizer" 
  width="300" 
  height="50" 
  style="display: none; margin: 10px 0; background: #f0f0f0; border-radius: 8px;"
></canvas>
```

### **2. Add Recording Logic**

```javascript
// Recording state
let mediaRecorder = null;
let audioChunks = [];
let recordingSessionId = null;

// Check if browser supports recording
const isRecordingSupported = () => {
  return typeof MediaRecorder !== 'undefined' && 
         typeof navigator.mediaDevices !== 'undefined' &&
         typeof navigator.mediaDevices.getUserMedia !== 'function';
};

// Update UI based on recording support
if (isRecordingSupported()) {
  const startBtn = document.getElementById('start-recording');
  const stopBtn = document.getElementById('stop-recording');
  const cancelBtn = document.getElementById('cancel-recording');
  
  if (startBtn) startBtn.style.display = 'inline-block';
  if (stopBtn) stopBtn.style.display = 'inline-block';
  if (cancelBtn) cancelBtn.style.display = 'inline-block';
}

// Start recording
document.getElementById('start-recording')?.addEventListener('click', async () => {
  const startBtn = document.getElementById('start-recording');
  const stopBtn = document.getElementById('stop-recording');
  const cancelBtn = document.getElementById('cancel-recording');
  const statusEl = document.getElementById('recording-status');
  const visualizer = document.getElementById('audio-visualizer');
  
  try {
    // Check consent
    const consent = chatbot.getAudioConsentState();
    if (!consent.stt) {
      alert('Please grant audio consent first. Type /audio-consent on');
      return;
    }
    
    // Request microphone access
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    
    // Create media recorder
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];
    recordingSessionId = `recording-${Date.now()}`;
    
    // Start recording
    mediaRecorder.start();
    
    // Update UI
    if (startBtn) startBtn.disabled = true;
    if (stopBtn) stopBtn.disabled = false;
    if (cancelBtn) cancelBtn.disabled = false;
    if (statusEl) statusEl.textContent = '🎤 Recording...';
    if (visualizer) {
      visualizer.style.display = 'block';
      startAudioVisualization(stream);
    }
    
    // Handle data
    mediaRecorder.ondataavailable = (event) => {
      audioChunks.push(event.data);
    };
    
    // Handle stop
    mediaRecorder.onstop = async () => {
      // Stop all tracks
      stream.getTracks().forEach(track => track.stop());
      
      // Create audio blob
      const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
      
      // Transcribe
      if (statusEl) statusEl.textContent = '🔊 Transcribing...';
      
      const result = await chatbot.speechToText(audioBlob, {
        sessionId: recordingSessionId
      });
      
      if (result.error) {
        if (statusEl) statusEl.textContent = `❌ Error: ${result.error}`;
      } else {
        if (statusEl) statusEl.textContent = '✅ Transcription complete';
        
        // Display transcription
        appendMessage('user', '[Voice Input]', false, false, false);
        appendMessage('assistant', `🎤 You said:\n\n${result.text}`, false, false, false);
        
        // Process as chat input
        setTimeout(() => {
          document.getElementById('chat-input').value = result.text;
          sendMessage();
        }, 500);
      }
      
      // Reset UI
      if (startBtn) startBtn.disabled = false;
      if (stopBtn) stopBtn.disabled = true;
      if (cancelBtn) cancelBtn.disabled = true;
      if (visualizer) {
        visualizer.style.display = 'none';
        stopAudioVisualization();
      }
      
      setTimeout(() => {
        if (statusEl) statusEl.textContent = '';
      }, 3000);
    };
    
    // Handle errors
    mediaRecorder.onerror = (error) => {
      console.error('[Recording] Error:', error);
      if (statusEl) statusEl.textContent = `❌ Error: ${error.message}`;
      
      // Reset UI
      if (startBtn) startBtn.disabled = false;
      if (stopBtn) stopBtn.disabled = true;
      if (cancelBtn) cancelBtn.disabled = true;
      if (visualizer) visualizer.style.display = 'none';
    };
    
  } catch (error) {
    console.error('[Recording] Error:', error);
    if (statusEl) statusEl.textContent = `❌ Error: ${error.message}`;
    
    if (error.name === 'NotAllowedError') {
      alert('Microphone access denied. Please allow microphone access to use voice input.');
    }
  }
});

// Stop recording
document.getElementById('stop-recording')?.addEventListener('click', () => {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
});

// Cancel recording
document.getElementById('cancel-recording')?.addEventListener('click', () => {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
    
    const statusEl = document.getElementById('recording-status');
    const visualizer = document.getElementById('audio-visualizer');
    
    if (statusEl) statusEl.textContent = '❌ Recording cancelled';
    if (visualizer) {
      visualizer.style.display = 'none';
      stopAudioVisualization();
    }
    
    setTimeout(() => {
      if (statusEl) statusEl.textContent = '';
    }, 3000);
  }
});

// Keyboard shortcut for recording
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.shiftKey && e.key === 'R') {
    e.preventDefault();
    document.getElementById('start-recording')?.click();
  }
});

// Audio visualization (optional)
let audioContext = null;
let analyser = null;
let dataArray = null;
let canvasCtx = null;
let animationId = null;

function startAudioVisualization(stream) {
  const canvas = document.getElementById('audio-visualizer');
  if (!canvas) return;
  
  canvasCtx = canvas.getContext('2d');
  
  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  analyser = audioContext.createAnalyser();
  analyser.fftSize = 256;
  
  const source = audioContext.createMediaStreamSource(stream);
  source.connect(analyser);
  analyser.connect(audioContext.destination);
  
  dataArray = new Uint8Array(analyser.frequencyBinCount);
  
  function draw() {
    animationId = requestAnimationFrame(draw);
    
    analyser.getByteFrequencyData(dataArray);
    
    canvasCtx.fillStyle = 'rgb(240, 240, 240)';
    canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
    
    const barWidth = (canvas.width / dataArray.length) * 2.5;
    let x = 0;
    
    for (let i = 0; i < dataArray.length; i++) {
      const barHeight = (dataArray[i] / 255) * canvas.height;
      
      canvasCtx.fillStyle = `rgb(255, ${Math.max(0, 255 - barHeight * 2)}, 0)`;
      canvasCtx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
      
      x += barWidth + 1;
    }
  }
  
  draw();
}

function stopAudioVisualization() {
  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
  
  if (audioContext) {
    audioContext.close();
    audioContext = null;
  }
  
  analyser = null;
  dataArray = null;
  canvasCtx = null;
}
```

---

## 🎯 Complete Integration Example

Here's a **complete example** of integrating the audio service into your chatbot:

### **1. Backend Integration (server-offline.js)**

```javascript
// Add audio API endpoints
import { mistralAudioService } from './services/audio/MistralAudioService.js';

// Audio API routes
app.post('/api/audio/tts', async (req, res) => {
  try {
    const { text, sessionId, voiceId, responseFormat } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }
    
    const result = await mistralAudioService.textToSpeech(text, {
      sessionId,
      voiceId,
      responseFormat
    });
    
    res.json(result);
  } catch (error) {
    console.error('[Audio API] TTS Error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/audio/stt', async (req, res) => {
  try {
    const { sessionId, model, diarize, timestampGranularities } = req.body;
    const audioFile = req.files?.audio;
    
    if (!audioFile) {
      return res.status(400).json({ error: 'Audio file is required' });
    }
    
    const result = await mistralAudioService.speechToText(audioFile.path, {
      sessionId,
      model,
      diarize,
      timestampGranularities
    });
    
    // Clean up temp file
    fs.unlinkSync(audioFile.path);
    
    res.json(result);
  } catch (error) {
    console.error('[Audio API] STT Error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/audio/consent', (req, res) => {
  const { sessionId, action, type } = req.body;
  
  if (action === 'grant') {
    mistralAudioService.grantConsent(sessionId, type);
    res.json({ success: true });
  } else if (action === 'revoke') {
    mistralAudioService.revokeConsent(sessionId, type);
    res.json({ success: true });
  } else {
    res.status(400).json({ error: 'Invalid action' });
  }
});

app.get('/api/audio/status', (req, res) => {
  const status = mistralAudioService.getStatus();
  res.json(status);
});
```

### **2. Frontend Integration (index.html)**

```html
<!-- Add to head -->
<script type="module">
  import { mistralAudioService } from './services/audio/MistralAudioService.js';
  
  // Make available globally
  window.mistralAudioService = mistralAudioService;
</script>

<!-- Add audio controls to chat interface -->
<div class="chat-controls">
  <!-- Existing controls -->
  
  <!-- Audio controls -->
  <div class="audio-section">
    <button id="tts-button" type="button" title="Text to Speech">🔊 TTS</button>
    <button id="stt-button" type="button" title="Speech to Text">🎤 STT</button>
    <button id="audio-consent-button" type="button" title="Audio Consent">🎙️</button>
    <input type="file" id="audio-upload" accept="audio/*" style="display: none;" />
  </div>
  
  <div id="audio-status"></div>
</div>

<script>
  // Audio service integration
  const audioService = window.mistralAudioService;
  
  // TTS button
  document.getElementById('tts-button')?.addEventListener('click', () => {
    const text = prompt('Enter text to convert to speech:');
    if (text) {
      if (!audioService.hasConsent(window.sessionId, 'tts')) {
        alert('Please grant audio consent first. Type /audio-consent on');
        return;
      }
      
      audioService.textToSpeech(text, { sessionId: window.sessionId })
        .then(result => {
          if (result.error) {
            alert(`Error: ${result.error}`);
          } else {
            const audio = new Audio(`data:audio/mp3;base64,${result.audioData}`);
            audio.play();
          }
        })
        .catch(error => {
          alert(`Error: ${error.message}`);
        });
    }
  });
  
  // STT button
  document.getElementById('stt-button')?.addEventListener('click', () => {
    if (!audioService.hasConsent(window.sessionId, 'stt')) {
      alert('Please grant audio consent first. Type /audio-consent on');
      return;
    }
    
    document.getElementById('audio-upload')?.click();
  });
  
  // Audio upload handler
  document.getElementById('audio-upload')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
      const result = await audioService.speechToText(file, {
        sessionId: window.sessionId
      });
      
      if (result.error) {
        alert(`Error: ${result.error}`);
      } else {
        // Display transcription
        appendMessage('user', `[Audio: ${file.name}]`, false, false, false);
        appendMessage('assistant', `🎤 Transcription:\n\n${result.text}`, false, false, false);
      }
    } catch (error) {
      alert(`Error: ${error.message}`);
    }
    
    // Reset file input
    e.target.value = '';
  });
  
  // Audio consent button
  document.getElementById('audio-consent-button')?.addEventListener('click', () => {
    const consent = audioService.getConsentState(window.sessionId);
    if (consent.tts && consent.stt) {
      audioService.revokeConsent(window.sessionId, 'audio');
      updateAudioStatus();
    } else {
      audioService.grantConsent(window.sessionId, 'audio');
      updateAudioStatus();
    }
  });
  
  // Update audio status
  function updateAudioStatus() {
    const statusEl = document.getElementById('audio-status');
    if (!statusEl) return;
    
    const status = audioService.getStatus();
    const consent = audioService.getConsentState(window.sessionId);
    
    const parts = [];
    if (!status.apiKeyConfigured) {
      parts.push('⚠️ API Key not set');
    } else {
      parts.push(`✅ TTS: ${status.ttsRateLimit.remaining}/${status.ttsRateLimit.limit}`);
      parts.push(`✅ STT: ${status.sttRateLimit.remaining}/${status.sttRateLimit.limit}`);
    }
    parts.push(`Consent: TTS=${consent.tts ? '✅' : '❌'}, STT=${consent.stt ? '✅' : '❌'}`);
    
    statusEl.textContent = `Audio: ${parts.join(' | ')}`;
  }
  
  // Update status periodically
  setInterval(updateAudioStatus, 30000);
  updateAudioStatus();
</script>
```

---

## 🎯 Step 8: Test Your Integration

### **Test Checklist**

- [ ] **API Key Configured**
  ```bash
  echo $MISTRAL_API_KEY
  ```

- [ ] **Dependencies Installed**
  ```bash
  npm list node-fetch
  ```

- [ ] **TTS Works**
  ```bash
  node services/audio/examples/tts.js
  ```

- [ ] **STT Works** (after generating test audio)
  ```bash
  node services/audio/examples/stt.js
  ```

- [ ] **Chatbot Integration Works**
  - Open your chatbot in browser
  - Type `/audio-consent on`
  - Type `/tts Hello world`
  - Click STT button and upload audio file

- [ ] **Consent Management Works**
  - Type `/audio-consent on`
  - Verify TTS and STT work
  - Type `/audio-consent off`
  - Verify TTS and STT are blocked

- [ ] **Rate Limiting Works**
  - Make multiple TTS requests quickly
  - Verify rate limiting kicks in

---

## 🐛 Troubleshooting

### **Common Issues & Solutions**

| Issue | Cause | Solution |
|-------|-------|----------|
| `MISTRAL_API_KEY is required` | API key not set | Set `MISTRAL_API_KEY` environment variable |
| `Audio consent not granted` | Missing consent | Call `grantConsent(sessionId, 'tts')` or `grantConsent(sessionId, 'stt')` |
| `Rate limit exceeded` | Too many requests | Wait and retry, or increase rate limit |
| `401 Unauthorized` | Invalid API key | Verify your API key is correct |
| `429 Too Many Requests` | API rate limit | Wait and retry, or upgrade plan |
| `400 Bad Request` | Invalid parameters | Check your input parameters |
| `500 Internal Server Error` | API server issue | Retry later |
| `MediaRecorder not defined` | Browser doesn't support recording | Use Chrome/Firefox/Edge |
| `NotAllowedError` | Microphone access denied | Grant microphone permission |

### **Debugging Tips**

**1. Check API Key:**
```bash
# Verify API key is set
node -e "console.log(process.env.MISTRAL_API_KEY ? '✅ API Key set' : '❌ API Key not set')"
```

**2. Test API Directly:**
```bash
# Test TTS API
curl -X POST "https://api.mistral.ai/v1/audio/speech" \
  -H "Authorization: Bearer $MISTRAL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"input":"Hello world","model":"voxtral-mini-tts-2603","voice_id":"en_esme_neutral","response_format":"mp3"}' \
  | jq -r '.audio_data' | base64 -d > test.mp3

# Test STT API (requires audio file)
curl -X POST "https://api.mistral.ai/v1/audio/transcriptions" \
  -H "Authorization: Bearer $MISTRAL_API_KEY" \
  -F model="voxtral-mini-latest" \
  -F file=@test.mp3
```

**3. Check Browser Console:**
- Open DevTools (F12)
- Check Console tab for errors
- Check Network tab for API requests

**4. Enable Debug Logging:**
```javascript
// Add to your code
import { mistralAudioService } from './services/audio/MistralAudioService.js';

// Enable debug mode
mistralAudioService.debug = true;
```

---

## 📊 Monitoring & Analytics

### **Track Audio Usage**

```javascript
// Add usage tracking
const audioUsage = {
  tts: 0,
  stt: 0,
  errors: 0
};

// Wrap audio methods to track usage
const originalTts = mistralAudioService.textToSpeech;
mistralAudioService.textToSpeech = async function(...args) {
  audioUsage.tts++;
  try {
    return await originalTts.apply(this, args);
  } catch (error) {
    audioUsage.errors++;
    throw error;
  }
};

const originalStt = mistralAudioService.speechToText;
mistralAudioService.speechToText = async function(...args) {
  audioUsage.stt++;
  try {
    return await originalStt.apply(this, args);
  } catch (error) {
    audioUsage.errors++;
    throw error;
  }
};

// Get usage stats
function getAudioUsageStats() {
  return {
    ...audioUsage,
    ...mistralAudioService.getStatus()
  };
}
```

### **Log Audio Events**

```javascript
// Add event logging
const audioEvents = [];

function logAudioEvent(eventType, details = {}) {
  const event = {
    timestamp: new Date().toISOString(),
    eventType,
    ...details
  };
  audioEvents.push(event);
  
  // Keep only last 100 events
  if (audioEvents.length > 100) {
    audioEvents.shift();
  }
  
  console.log('[Audio Event]', event);
}

// Wrap methods to log events
const originalTts = mistralAudioService.textToSpeech;
mistralAudioService.textToSpeech = async function(text, options = {}) {
  logAudioEvent('tts_request', {
    textLength: text.length,
    voiceId: options.voiceId,
    sessionId: options.sessionId
  });
  
  try {
    const result = await originalTts.call(this, text, options);
    logAudioEvent('tts_success', {
      model: result.model,
      voiceId: result.voiceId,
      audioLength: result.audioData.length
    });
    return result;
  } catch (error) {
    logAudioEvent('tts_error', { error: error.message });
    throw error;
  }
};
```

---

## 🔒 Security & Privacy

### **✅ Security Measures**

1. **API Key Protection:**
   - Never commit API keys to version control
   - Use environment variables
   - In browser, use secure backend proxy

2. **Consent Management:**
   - Explicit consent required for all audio processing
   - Consent is session-based
   - Users can revoke consent at any time

3. **Rate Limiting:**
   - Built-in rate limiting prevents abuse
   - Separate limits for TTS and STT
   - Configurable limits

4. **Input Validation:**
   - Text length validation
   - Audio file size validation
   - Parameter validation

5. **Error Handling:**
   - Graceful error handling
   - User-friendly error messages
   - No sensitive data in errors

### **🛡️ Privacy Protections**

1. **No Audio Storage:**
   - Audio data is processed ephemerally
   - No audio files are stored without explicit consent

2. **Session Isolation:**
   - Audio processing is tied to user sessions
   - No cross-session data sharing

3. **Data Minimization:**
   - Only necessary data is processed
   - No unnecessary metadata collection

4. **Ephemeral Processing:**
   - Audio data is discarded after processing
   - No persistent storage

5. **User Control:**
   - Users have full control over audio features
   - Users can enable/disable at any time
   - Users can revoke consent at any time

---

## 📚 Additional Resources

### **Mistral Audio API Documentation**
- [Official Docs](https://docs.mistral.ai/api/#tag/Audio)
- [API Reference](https://docs.mistral.ai/api/)
- [Pricing](https://mistral.ai/pricing/)
- [Status Page](https://status.mistral.ai/)

### **Related Services**
- [Main Chatbot](../README.md)
- [Consent Management](../../consent_manager.js)
- [Ethics Compliance](../../ethics_compliance.js)

---

## 🎉 Summary

You've now **fully integrated** Mistral's audio APIs into your SXWer AI ChatBot! 

### **✅ What You've Accomplished:**

1. **Set up environment** with API key configuration
2. **Installed dependencies** for the audio service
3. **Tested TTS** with text-to-speech examples
4. **Tested STT** with speech-to-text examples
5. **Integrated into chatbot** with commands and UI
6. **Added consent management** for privacy protection
7. **Added rate limiting** to prevent abuse
8. **Added error handling** for robustness

### **🎯 Next Steps:**

1. **Test thoroughly** with different audio files
2. **Monitor usage** and adjust rate limits as needed
3. **Gather feedback** from users
4. **Optimize** based on usage patterns
5. **Consider adding** more advanced features:
   - Voice selection UI
   - Audio recording
   - Batch processing
   - Language detection

---

**Document Version:** 1.0.0  
**Last Updated:** 2024  
**Author:** Vibe Code (Senior Full-Stack Developer)  
**Project:** SXWer AI ChatBot - Mistral Audio Service Integration

---

## 📌 Quick Reference

### **Commands:**
| Command | Description |
|---------|-------------|
| `/tts <text>` | Convert text to speech |
| `/stt` | Transcribe audio file |
| `/audio-consent on` | Grant audio consent |
| `/audio-consent off` | Revoke audio consent |
| `/audio-status` | Check audio service status |
| `/voices` | List available TTS voices |
| `/audio-help` | Show audio commands help |

### **Keyboard Shortcuts:**
| Shortcut | Action |
|----------|--------|
| Ctrl+Shift+T | Text to Speech |
| Ctrl+Shift+S | Speech to Text |
| Ctrl+Shift+R | Start Recording (if supported) |

### **API Methods:**
| Method | Description |
|--------|-------------|
| `textToSpeech(text, options)` | Convert text to speech |
| `speechToText(audio, options)` | Transcribe audio to text |
| `speechToTextFromUrl(url, options)` | Transcribe from URL |
| `grantConsent(sessionId, type)` | Grant audio consent |
| `revokeConsent(sessionId, type)` | Revoke audio consent |
| `hasConsent(sessionId, type)` | Check audio consent |
| `getConsentState(sessionId)` | Get consent state |
| `getStatus()` | Get service status |

---

**🚀 Your SXWer AI ChatBot now has full audio capabilities!**
