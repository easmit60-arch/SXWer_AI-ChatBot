# 🎙️ Mistral Audio Service - SXWer AI ChatBot

**Version:** 1.0.0  
**Status:** ✅ Production Ready  
**Last Updated:** 2024  

---

## 📋 Overview

The **Mistral Audio Service** provides **Text-to-Speech (TTS)** and **Speech-to-Text (STT)** functionality for the SXWer AI ChatBot using Mistral's audio APIs. This service is designed with **privacy-first** principles and **explicit consent** requirements to protect sex worker users.

### **✅ Features**

- **Text-to-Speech (TTS):** Convert text to natural-sounding audio
- **Speech-to-Text (STT):** Transcribe audio files to text
- **Consent Management:** Explicit consent required for all audio processing
- **Rate Limiting:** Built-in rate limiting to prevent abuse
- **Privacy Protections:** No audio stored without consent
- **Error Handling:** Robust error handling and validation
- **Offline Support:** Graceful degradation when API unavailable

### **🔒 Ethical Compliance**

| Framework | Compliance | Implementation |
|-----------|------------|----------------|
| GDPR Article 5 | ✅ Data Minimization | Audio processed ephemerally |
| GDPR Article 7 | ✅ Explicit Consent | Consent required for all audio |
| Belmont Report | ✅ Respect for Persons | User controls audio features |
| Privacy by Design | ✅ Built-in | No storage without consent |
| Sex Worker-Specific | ✅ Protected | No audio logging |

---

## 🚀 Quick Start

### **1. Set Your API Key**

**Option A: Environment Variable (Recommended)**
```bash
# Linux/macOS
export MISTRAL_API_KEY="your-api-key-here"

# Windows (PowerShell)
$env:MISTRAL_API_KEY="your-api-key-here"

# Windows (CMD)
set MISTRAL_API_KEY=your-api-key-here
```

**Option B: .env File**
```bash
# Create .env file in project root
echo "MISTRAL_API_KEY=your-api-key-here" > .env

# Load in Node.js
require('dotenv').config();
```

**Option C: Direct Initialization**
```javascript
import { MistralAudioService } from './services/audio/MistralAudioService.js';

const audioService = new MistralAudioService('your-api-key-here');
```

---

### **2. Try TTS Example**

**Node.js:**
```javascript
import { mistralAudioService } from './services/audio/MistralAudioService.js';

// Grant consent for session
mistralAudioService.grantConsent('user-session-123', 'tts');

// Generate speech
const result = await mistralAudioService.textToSpeech(
  "Hello, I am Becky Tahablu, co-founder of Root Support Network.",
  {
    sessionId: 'user-session-123',
    voiceId: 'en_esme_neutral',
    responseFormat: 'mp3'
  }
);

// Save audio to file
import fs from 'fs';
fs.writeFileSync('output.mp3', Buffer.from(result.audioData, 'base64'));

console.log('Audio saved to output.mp3');
```

**Browser:**
```javascript
import { mistralAudioService } from './services/audio/MistralAudioService.js';

// Set API key (in production, use secure method)
const audioService = new MistralAudioService('your-api-key');

// Grant consent
audioService.grantConsent('browser-session-1', 'tts');

// Generate speech
const result = await audioService.textToSpeech(
  "Hello, this is a test of text-to-speech.",
  {
    sessionId: 'browser-session-1',
    voiceId: 'en_esme_neutral'
  }
);

// Create audio element and play
const audio = new Audio(`data:audio/mp3;base64,${result.audioData}`);
audio.play();
```

---

### **3. Try STT Example**

**Node.js:**
```javascript
import { mistralAudioService } from './services/audio/MistralAudioService.js';

// Grant consent for session
mistralAudioService.grantConsent('user-session-123', 'stt');

// Transcribe audio file
const result = await mistralAudioService.speechToText('audio.mp3', {
  sessionId: 'user-session-123',
  diarize: true,
  timestampGranularities: ['segment']
});

console.log('Transcription:', result.text);
console.log('Segments:', result.segments);
```

**Browser:**
```javascript
import { mistralAudioService } from './services/audio/MistralAudioService.js';

// Set API key
const audioService = new MistralAudioService('your-api-key');

// Grant consent
audioService.grantConsent('browser-session-1', 'stt');

// Get audio file from input
const audioFile = document.getElementById('audio-input').files[0];

// Transcribe
const result = await audioService.speechToText(audioFile, {
  sessionId: 'browser-session-1',
  diarize: true
});

console.log('Transcription:', result.text);
```

---

## 📚 API Reference

---

### **MistralAudioService Class**

#### **Constructor**
```javascript
new MistralAudioService(apiKey = null)
```
- `apiKey` (string, optional): Mistral API key. If not provided, uses `process.env.MISTRAL_API_KEY`

---

### **Consent Management**

#### **grantConsent(sessionId, type)**
Grant audio processing consent for a session.

**Parameters:**
- `sessionId` (string): Session identifier
- `type` (string): `'tts'`, `'stt'`, or `'audio'` (grants both)

**Example:**
```javascript
audioService.grantConsent('session-123', 'tts');
audioService.grantConsent('session-123', 'audio'); // Grants both TTS and STT
```

#### **revokeConsent(sessionId, type)**
Revoke audio processing consent for a session.

**Parameters:**
- `sessionId` (string): Session identifier
- `type` (string): `'tts'`, `'stt'`, or `'audio'` (revokes both)

**Example:**
```javascript
audioService.revokeConsent('session-123', 'tts');
```

#### **hasConsent(sessionId, type)**
Check if consent is granted for a session.

**Parameters:**
- `sessionId` (string): Session identifier
- `type` (string): `'tts'`, `'stt'`, or `'audio'`

**Returns:** `boolean`

**Example:**
```javascript
if (audioService.hasConsent('session-123', 'tts')) {
  // Proceed with TTS
}
```

#### **getConsentState(sessionId)**
Get the consent state for a session.

**Parameters:**
- `sessionId` (string): Session identifier

**Returns:** `Object` with `tts` and `stt` boolean properties

---

### **Text-to-Speech (TTS)**

#### **textToSpeech(text, options)**
Generate speech from text.

**Parameters:**
- `text` (string, required): Text to synthesize (max 10,000 characters)
- `options` (Object, optional):
  - `sessionId` (string): Session identifier (default: 'default')
  - `model` (string): TTS model (default: 'voxtral-mini-tts-2603')
  - `voiceId` (string): Voice ID (default: 'en_esme_neutral')
  - `responseFormat` (string): Audio format ('mp3', 'wav', 'ogg') (default: 'mp3')

**Returns:** `Promise<Object>` with:
- `success` (boolean): Whether the request succeeded
- `audioData` (string): Base64-encoded audio data
- `model` (string): Model used
- `voiceId` (string): Voice used
- `responseFormat` (string): Audio format
- `sessionId` (string): Session identifier
- `timestamp` (string): ISO timestamp

**Example:**
```javascript
const result = await audioService.textToSpeech(
  "Hello world",
  {
    sessionId: 'session-123',
    voiceId: 'fr_marie_excited',
    responseFormat: 'wav'
  }
);

// Play audio in browser
const audio = new Audio(`data:audio/wav;base64,${result.audioData}`);
audio.play();

// Save to file in Node.js
import fs from 'fs';
fs.writeFileSync('output.wav', Buffer.from(result.audioData, 'base64'));
```

#### **textToSpeechFile(text, outputPath, options)**
Generate speech and save to file (Node.js only).

**Parameters:**
- `text` (string, required): Text to synthesize
- `outputPath` (string, required): Path to save audio file
- `options` (Object, optional): Same as `textToSpeech`

**Returns:** `Promise<Object>` same as `textToSpeech`

---

### **Speech-to-Text (STT)**

#### **speechToText(audio, options)**
Transcribe audio to text.

**Parameters:**
- `audio` (string|Buffer|File|Blob, required): Audio to transcribe
  - String: File path (Node.js only)
  - Buffer: Audio data buffer
  - File: Browser File object
  - Blob: Browser Blob object
- `options` (Object, optional):
  - `sessionId` (string): Session identifier (default: 'default')
  - `model` (string): STT model (default: 'voxtral-mini-latest')
  - `diarize` (boolean): Enable speaker diarization (default: false)
  - `timestampGranularities` (Array): Timestamp precision (default: [])
    - Options: `'word'`, `'segment'`

**Returns:** `Promise<Object>` with:
- `success` (boolean): Whether the request succeeded
- `text` (string): Transcribed text
- `model` (string): Model used
- `diarize` (boolean): Whether diarization was enabled
- `timestampGranularities` (Array): Timestamp granularities used
- `segments` (Array): Transcription segments (if diarize=true)
- `sessionId` (string): Session identifier
- `timestamp` (string): ISO timestamp

**Example:**
```javascript
// From file path (Node.js)
const result = await audioService.speechToText('audio.mp3', {
  sessionId: 'session-123',
  diarize: true,
  timestampGranularities: ['segment']
});

console.log('Transcription:', result.text);
console.log('Segments:', result.segments);

// From File object (Browser)
const audioFile = document.getElementById('audio-input').files[0];
const result = await audioService.speechToText(audioFile, {
  sessionId: 'session-123'
});
```

#### **speechToTextFromUrl(audioUrl, options)**
Transcribe audio from a public URL.

**Parameters:**
- `audioUrl` (string, required): Public URL to audio file
- `options` (Object, optional): Same as `speechToText` (without audio parameter)

**Returns:** `Promise<Object>` same as `speechToText`

**Example:**
```javascript
const result = await audioService.speechToTextFromUrl(
  'https://example.com/audio.mp3',
  {
    sessionId: 'session-123',
    diarize: true
  }
);
```

---

### **Utility Methods**

#### **getAvailableVoices()**
Get available TTS voices.

**Returns:** `Object` with voice IDs as keys and descriptions as values

**Example:**
```javascript
const voices = audioService.getAvailableVoices();
console.log('Available voices:', Object.keys(voices));
// ['en_esme_neutral', 'en_oliver_excited', 'fr_marie_excited', ...]
```

#### **getAvailableModels()**
Get available models.

**Returns:** `Object` with model types as keys

**Example:**
```javascript
const models = audioService.getAvailableModels();
console.log('TTS Model:', models.tts);  // 'voxtral-mini-tts-2603'
console.log('STT Model:', models.stt);  // 'voxtral-mini-latest'
```

#### **validateTtsParams(params)**
Validate TTS parameters.

**Parameters:**
- `params` (Object): Parameters to validate

**Returns:** `Object` with `valid`, `errors`, and `warnings` properties

#### **validateSttParams(params)**
Validate STT parameters.

**Parameters:**
- `params` (Object): Parameters to validate

**Returns:** `Object` with `valid`, `errors`, and `warnings` properties

#### **getStatus()**
Get service status.

**Returns:** `Object` with:
- `apiKeyConfigured` (boolean): Whether API key is set
- `ttsRateLimit` (Object): TTS rate limit status
- `sttRateLimit` (Object): STT rate limit status
- `activeSessions` (number): Number of active sessions

#### **clearRateLimits()**
Clear rate limit trackers.

#### **clearConsentStore()**
Clear all consent data.

---

## 🎯 Integration with SXWer AI ChatBot

### **1. Add Audio Service to Chatbot**

**Update `chatbot.js`:**
```javascript
import { mistralAudioService } from './services/audio/MistralAudioService.js';

// Add to chatbot initialization
const chatbot = {
  // ... existing code ...
  
  // Add audio methods
  async textToSpeech(text, options = {}) {
    // Check if user has consent for audio
    if (!mistralAudioService.hasConsent(options.sessionId || this.sessionId, 'tts')) {
      return { error: 'Audio consent required. Please grant audio permissions.' };
    }
    
    try {
      const result = await mistralAudioService.textToSpeech(text, {
        sessionId: options.sessionId || this.sessionId,
        ...options
      });
      return result;
    } catch (error) {
      console.error('[Chatbot] TTS Error:', error.message);
      return { error: error.message };
    }
  },
  
  async speechToText(audio, options = {}) {
    // Check if user has consent for audio
    if (!mistralAudioService.hasConsent(options.sessionId || this.sessionId, 'stt')) {
      return { error: 'Audio consent required. Please grant audio permissions.' };
    }
    
    try {
      const result = await mistralAudioService.speechToText(audio, {
        sessionId: options.sessionId || this.sessionId,
        ...options
      });
      return result;
    } catch (error) {
      console.error('[Chatbot] STT Error:', error.message);
      return { error: error.message };
    }
  },
  
  // Grant audio consent
  grantAudioConsent(type = 'audio') {
    mistralAudioService.grantConsent(this.sessionId, type);
    return { success: true };
  },
  
  // Revoke audio consent
  revokeAudioConsent(type = 'audio') {
    mistralAudioService.revokeConsent(this.sessionId, type);
    return { success: true };
  },
  
  // Get audio consent state
  getAudioConsentState() {
    return mistralAudioService.getConsentState(this.sessionId);
  },
};

export { chatbot, mistralAudioService };
```

### **2. Add Audio Commands to Chatbot**

**Update command processor in `index.html`:**
```javascript
// Add to command help
const COMMAND_HELP = {
  // ... existing commands ...
  
  '/tts <text>': 'Convert text to speech (requires audio consent)',
  '/stt': 'Transcribe audio file (requires audio consent)',
  '/audio-consent on': 'Grant audio processing consent',
  '/audio-consent off': 'Revoke audio processing consent',
  '/audio-status': 'Check audio service status',
  '/voices': 'List available TTS voices',
};

// Add command handlers
async function handleCommand(input, sessionId) {
  const command = input.trim().toLowerCase();
  
  if (command.startsWith('/tts ')) {
    const text = input.substring(5).trim();
    if (!text) {
      return 'Usage: /tts <text> - Convert text to speech';
    }
    
    const result = await chatbot.textToSpeech(text, { sessionId });
    
    if (result.error) {
      return `Error: ${result.error}`;
    }
    
    // Create audio element and play
    const audio = new Audio(`data:audio/mp3;base64,${result.audioData}`);
    audio.play();
    
    return `🔊 Playing audio: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`;
  }
  
  if (command === '/stt') {
    // Trigger file input for audio upload
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
        appendMessage('assistant', `Error: ${result.error}`, false, false, false);
      } else {
        appendMessage('assistant', `🎤 Transcription:\n\n${result.text}`, false, false, false);
      }
    });
    
    document.body.appendChild(fileInput);
    fileInput.click();
    
    return '📁 Please select an audio file to transcribe...';
  }
  
  if (command === '/audio-consent on') {
    const result = chatbot.grantAudioConsent('audio');
    return result.success ? '✅ Audio consent granted. You can now use /tts and /stt commands.' : '❌ Failed to grant consent.';
  }
  
  if (command === '/audio-consent off') {
    const result = chatbot.revokeAudioConsent('audio');
    return result.success ? '✅ Audio consent revoked. /tts and /stt commands are now disabled.' : '❌ Failed to revoke consent.';
  }
  
  if (command === '/audio-status') {
    const status = mistralAudioService.getStatus();
    const consent = chatbot.getAudioConsentState();
    
    return `🎙️ Audio Service Status:\n\n` +
           `API Key: ${status.apiKeyConfigured ? '✅ Configured' : '❌ Not configured'}\n` +
           `TTS Rate Limit: ${status.ttsRateLimit.remaining}/${status.ttsRateLimit.limit} requests\n` +
           `STT Rate Limit: ${status.sttRateLimit.remaining}/${status.sttRateLimit.limit} requests\n` +
           `Consent: TTS=${consent.tts ? '✅' : '❌'}, STT=${consent.stt ? '✅' : '❌'}`;
  }
  
  if (command === '/voices') {
    const voices = mistralAudioService.getAvailableVoices();
    const voiceList = Object.entries(voices).map(([id, name]) => `- ${id}: ${name}`).join('\n');
    return `🎤 Available TTS Voices:\n\n${voiceList}`;
  }
  
  // ... existing command handling ...
}
```

### **3. Add UI for Audio Features**

**Add to `index.html`:**
```html
<!-- Add audio controls to the chat interface -->
<div class="audio-controls" style="display: flex; gap: 10px; margin: 10px 0; flex-wrap: wrap;">
  <button id="tts-button" type="button" title="Text to Speech">
    🔊 TTS
  </button>
  <button id="stt-button" type="button" title="Speech to Text">
    🎤 STT
  </button>
  <button id="audio-consent-button" type="button" title="Toggle Audio Consent">
    🎙️ Audio Consent
  </button>
  <input type="file" id="audio-upload" accept="audio/*" style="display: none;" />
</div>

<!-- Add audio status indicator -->
<div id="audio-status" style="font-size: 12px; color: #666; margin: 5px 0;">
  Audio: Not configured
</div>
```

**Add event listeners:**
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

// Update audio status periodically
function updateAudioStatus() {
  const status = mistralAudioService.getStatus();
  const consent = chatbot.getAudioConsentState();
  const statusEl = document.getElementById('audio-status');
  
  if (statusEl) {
    const statusText = [];
    
    if (!status.apiKeyConfigured) {
      statusText.push('⚠️ API Key not configured');
    } else {
      statusText.push(`✅ API: ${status.ttsRateLimit.remaining}/${status.ttsRateLimit.limit} TTS`);
      statusText.push(`✅ API: ${status.sttRateLimit.remaining}/${status.sttRateLimit.limit} STT`);
    }
    
    statusText.push(`Consent: TTS=${consent.tts ? '✅' : '❌'}, STT=${consent.stt ? '✅' : '❌'}`);
    
    statusEl.textContent = `Audio: ${statusText.join(' | ')}`;
  }
}

// Update status every 30 seconds
setInterval(updateAudioStatus, 30000);
updateAudioStatus();
```

---

## 🔒 Privacy & Ethical Considerations

### **✅ Consent Requirements**

The audio service **requires explicit consent** before processing any audio:

1. **TTS Consent:** Required before generating speech
2. **STT Consent:** Required before transcribing audio
3. **Session-Based:** Consent is tied to user sessions
4. **Revocable:** Users can revoke consent at any time

### **🛡️ Privacy Protections**

| Protection | Implementation |
|------------|----------------|
| **No Audio Storage** | Audio data is processed ephemerally |
| **Session Isolation** | Audio processing tied to user sessions |
| **Consent Required** | Explicit consent for all audio operations |
| **Rate Limiting** | Prevents abuse and API overuse |
| **Data Minimization** | Only necessary data processed |
| **Ephemeral Processing** | Audio data not stored after processing |

### **⚠️ Sex Worker-Specific Considerations**

1. **No Audio Logging:** Audio is never logged or stored
2. **Ephemeral Processing:** Audio data is processed and discarded
3. **Consent Control:** Users have full control over audio features
4. **Privacy by Default:** Audio features disabled without consent
5. **Secure Transmission:** All API calls use HTTPS

---

## 📊 Rate Limiting

The service includes **built-in rate limiting** to prevent abuse:

| Feature | Limit | Window | Purpose |
|---------|-------|--------|---------|
| TTS | 10 requests | 1 minute | Prevent API abuse |
| STT | 5 requests | 1 minute | Prevent API abuse |

**Rate limit status can be checked:**
```javascript
const status = mistralAudioService.getStatus();
console.log('TTS remaining:', status.ttsRateLimit.remaining);
console.log('STT remaining:', status.sttRateLimit.remaining);
```

---

## 🐛 Error Handling

The service includes **comprehensive error handling**:

### **Common Errors & Solutions**

| Error | Cause | Solution |
|-------|-------|----------|
| `TTS consent not granted` | Missing consent | Call `grantConsent(sessionId, 'tts')` |
| `STT consent not granted` | Missing consent | Call `grantConsent(sessionId, 'stt')` |
| `MISTRAL_API_KEY is required` | No API key | Set `MISTRAL_API_KEY` environment variable |
| `Text exceeds maximum length` | Text too long | Split text into chunks (< 10,000 chars) |
| `Audio file exceeds maximum size` | File too large | Compress or split file (< 25MB) |
| `Rate limit exceeded` | Too many requests | Wait and retry |
| `TTS API error: 401` | Invalid API key | Verify your API key |
| `TTS API error: 429` | Rate limited | Wait and retry |

### **Error Handling Example**

```javascript
try {
  const result = await audioService.textToSpeech('Hello world', {
    sessionId: 'session-123'
  });
  
  // Handle success
  console.log('Success:', result);
} catch (error) {
  // Handle error
  console.error('Error:', error.message);
  
  if (error.message.includes('consent')) {
    // Prompt user to grant consent
    const grant = confirm('Audio consent required. Grant consent?');
    if (grant) {
      audioService.grantConsent('session-123', 'tts');
      // Retry...
    }
  } else if (error.message.includes('API_KEY')) {
    // Prompt user to configure API key
    alert('Please configure your Mistral API key');
  } else if (error.message.includes('Rate limit')) {
    // Show retry timer
    const match = error.message.match(/(\d+) seconds/);
    const seconds = match ? parseInt(match[1]) : 60;
    alert(`Rate limit exceeded. Please wait ${seconds} seconds.`);
  }
}
```

---

## 📁 File Structure

```
services/
└── audio/
    ├── MistralAudioService.js    # Main audio service
    ├── README.md                 # This documentation
    └── package.json              # Dependencies (if needed)
```

---

## 📦 Dependencies

The audio service requires:

### **Node.js:**
```bash
npm install node-fetch
```

### **Browser:**
- Modern browser with `fetch` support
- `FormData` support for file uploads

---

## 🧪 Testing

### **Test TTS**

```javascript
import { mistralAudioService } from './services/audio/MistralAudioService.js';

// Set API key
process.env.MISTRAL_API_KEY = 'your-api-key';

// Grant consent
mistralAudioService.grantConsent('test-session', 'tts');

// Test TTS
const result = await mistralAudioService.textToSpeech(
  'Hello, this is a test of the Mistral TTS API.',
  { sessionId: 'test-session' }
);

console.assert(result.success === true, 'TTS should succeed');
console.assert(result.audioData, 'Should return audio data');
```

### **Test STT**

```javascript
import { mistralAudioService } from './services/audio/MistralAudioService.js';
import fs from 'fs';

// Set API key
process.env.MISTRAL_API_KEY = 'your-api-key';

// Create test audio file (or use existing)
// For testing, you can use a small MP3 file

// Grant consent
mistralAudioService.grantConsent('test-session', 'stt');

// Test STT
const result = await mistralAudioService.speechToText('test.mp3', {
  sessionId: 'test-session'
});

console.assert(result.success === true, 'STT should succeed');
console.assert(result.text, 'Should return transcription');
```

---

## 📚 Examples

### **Example 1: Simple TTS**

```javascript
import { mistralAudioService } from './services/audio/MistralAudioService.js';

// Configure
process.env.MISTRAL_API_KEY = 'your-api-key';
mistralAudioService.grantConsent('session-1', 'tts');

// Generate speech
const result = await mistralAudioService.textToSpeech(
  'Hello, I am Becky Tahablu, co-founder of Root Support Network.',
  {
    sessionId: 'session-1',
    voiceId: 'en_esme_neutral'
  }
);

// Save to file
import fs from 'fs';
fs.writeFileSync('becky_intro.mp3', Buffer.from(result.audioData, 'base64'));
```

### **Example 2: TTS with Different Voices**

```javascript
import { mistralAudioService } from './services/audio/MistralAudioService.js';

process.env.MISTRAL_API_KEY = 'your-api-key';
mistralAudioService.grantConsent('session-1', 'tts');

const voices = mistralAudioService.getAvailableVoices();

for (const [voiceId, voiceName] of Object.entries(voices)) {
  const result = await mistralAudioService.textToSpeech(
    `Hello, this is ${voiceName}.`,
    { sessionId: 'session-1', voiceId }
  );
  
  const audio = new Audio(`data:audio/mp3;base64,${result.audioData}`);
  audio.play();
  
  // Wait for audio to finish
  await new Promise(resolve => audio.addEventListener('ended', resolve));
}
```

### **Example 3: STT with Diarization**

```javascript
import { mistralAudioService } from './services/audio/MistralAudioService.js';

process.env.MISTRAL_API_KEY = 'your-api-key';
mistralAudioService.grantConsent('session-1', 'stt');

const result = await mistralAudioService.speechToText('conversation.mp3', {
  sessionId: 'session-1',
  diarize: true,
  timestampGranularities: ['segment']
});

console.log('Full transcription:', result.text);
console.log('\nSegments:');
result.segments.forEach(segment => {
  console.log(`[${segment.start.toFixed(1)}s] Speaker ${segment.speaker_id}: ${segment.text}`);
});
```

### **Example 4: Browser Integration**

```html
<!DOCTYPE html>
<html>
<head>
  <title>Audio Test</title>
  <script type="module">
    import { mistralAudioService } from './services/audio/MistralAudioService.js';
    
    // Initialize with API key (in production, use secure method)
    const audioService = new MistralAudioService('your-api-key');
    
    // Grant consent
    audioService.grantConsent('browser-session', 'audio');
    
    // TTS function
    async function textToSpeech() {
      const text = document.getElementById('tts-text').value;
      if (!text) return;
      
      try {
        const result = await audioService.textToSpeech(text, {
          sessionId: 'browser-session'
        });
        
        const audio = new Audio(`data:audio/mp3;base64,${result.audioData}`);
        audio.play();
        
        document.getElementById('tts-status').textContent = 'Playing...';
        audio.addEventListener('ended', () => {
          document.getElementById('tts-status').textContent = 'Ready';
        });
      } catch (error) {
        document.getElementById('tts-status').textContent = `Error: ${error.message}`;
      }
    }
    
    // STT function
    async function speechToText(event) {
      const file = event.target.files[0];
      if (!file) return;
      
      try {
        document.getElementById('stt-status').textContent = 'Transcribing...';
        
        const result = await audioService.speechToText(file, {
          sessionId: 'browser-session',
          diarize: true
        });
        
        document.getElementById('stt-result').textContent = result.text;
        document.getElementById('stt-status').textContent = 'Ready';
      } catch (error) {
        document.getElementById('stt-status').textContent = `Error: ${error.message}`;
      }
    }
  </script>
</head>
<body>
  <h1>Mistral Audio Test</h1>
  
  <h2>Text to Speech</h2>
  <textarea id="tts-text" rows="4" cols="50">Hello, this is a test.</textarea>
  <br>
  <button onclick="textToSpeech()">Generate Speech</button>
  <span id="tts-status">Ready</span>
  <br><br>
  
  <h2>Speech to Text</h2>
  <input type="file" id="stt-file" accept="audio/*" onchange="speechToText(event)" />
  <br>
  <button onclick="document.getElementById('stt-file').click()">Select Audio File</button>
  <span id="stt-status">Ready</span>
  <br><br>
  <h3>Transcription Result:</h3>
  <div id="stt-result" style="white-space: pre-wrap; max-width: 600px;"></div>
</body>
</html>
```

---

## 🎯 Best Practices

### **1. Always Check Consent**

```javascript
// Before any audio processing
if (!audioService.hasConsent(sessionId, 'tts')) {
  // Prompt user for consent
  return { error: 'Audio consent required' };
}
```

### **2. Handle Rate Limits Gracefully**

```javascript
try {
  const result = await audioService.textToSpeech(text, { sessionId });
} catch (error) {
  if (error.message.includes('Rate limit')) {
    // Show user-friendly message
    const status = audioService.getRateLimitStatus('tts');
    const waitTime = Math.ceil((status.resetAt - Date.now()) / 1000);
    showMessage(`Please wait ${waitTime} seconds before using TTS again.`);
  }
}
```

### **3. Validate Inputs**

```javascript
const validation = audioService.validateTtsParams({ text, voiceId });
if (!validation.valid) {
  validation.errors.forEach(error => showMessage(error));
  return;
}
```

### **4. Use Appropriate Voices**

```javascript
// Match voice to content language
const voiceMap = {
  en: 'en_esme_neutral',
  fr: 'fr_marie_excited',
  de: 'de_klaus_neutral',
  es: 'es_sofia_neutral',
};

const voiceId = voiceMap[detectLanguage(text)] || 'en_esme_neutral';
```

### **5. Clean Up Resources**

```javascript
// Clear rate limits periodically
audioService.clearRateLimits();

// Clear consent when session ends
audioService.clearConsentStore();
```

---

## 📞 Support

### **Mistral API Documentation**
- [Audio API Docs](https://docs.mistral.ai/api/#tag/Audio)
- [API Status](https://status.mistral.ai/)
- [Pricing](https://mistral.ai/pricing/)

### **Common Issues**

| Issue | Solution |
|-------|----------|
| API key not working | Verify key is correct and has credits |
| Rate limited | Wait and retry, or upgrade plan |
| Audio quality poor | Use higher quality input audio |
| Transcription inaccurate | Ensure clear speech, minimal noise |
| File too large | Compress or split audio file |

---

## 📝 Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2024 | Initial release |

---

## 🤝 Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

---

## 📄 License

This service is part of the SXWer AI ChatBot and is licensed under the same terms as the main project. See the main [LICENSE.txt](../../LICENSE.txt) file for details.

---

**Document Version:** 1.0.0  
**Last Updated:** 2024  
**Author:** Vibe Code (Senior Full-Stack Developer)  
**Project:** SXWer AI ChatBot - Mistral Audio Service
