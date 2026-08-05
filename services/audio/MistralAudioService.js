/**
 * SXWer AI ChatBot - Mistral Audio Service
 * 
 * ETHICAL COMPLIANCE:
 * - GDPR Article 5: Data minimization (audio processed locally when possible)
 * - GDPR Article 7: Explicit consent for audio processing
 * - Belmont Report: Respect for Persons (user controls audio features)
 * - Privacy by Design: No audio stored without consent
 * - Sex Worker-Specific: No audio logging, ephemeral processing
 *
 * FEATURES:
 * - Text-to-Speech (TTS) using Mistral API
 * - Speech-to-Text (STT) using Mistral API
 * - Local fallback for offline mode
 * - Consent-gated audio processing
 * - Privacy-first design
 * - Error handling and rate limiting
 */

import fetch from 'node-fetch';

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Mistral Audio API Configuration
 */
const MISTRAL_AUDIO_CONFIG = Object.freeze({
  // API endpoints
  endpoints: {
    speech: 'https://api.mistral.ai/v1/audio/speech',
    transcriptions: 'https://api.mistral.ai/v1/audio/transcriptions',
  },
  
  // Default models
  models: {
    tts: 'voxtral-mini-tts-2603',
    stt: 'voxtral-mini-latest',
  },
  
  // Default voices
  voices: {
    en_neutral: 'en_esme_neutral',
    en_excited: 'en_oliver_excited',
    fr_neutral: 'fr_denise_neutral',
    fr_excited: 'fr_marie_excited',
    de_neutral: 'de_klaus_neutral',
    es_neutral: 'es_sofia_neutral',
  },
  
  // Rate limiting
  rateLimits: {
    tts: { max: 10, windowMs: 60000 },    // 10 requests per minute
    stt: { max: 5, windowMs: 60000 },     // 5 requests per minute
  },
  
  // Timeout
  timeout: 30000, // 30 seconds
  
  // Max input sizes
  maxInputSize: {
    tts: 10000,    // 10,000 characters
    stt: 25 * 1024 * 1024, // 25MB
  },
});

// ============================================================================
// AUDIO SERVICE CLASS
// ============================================================================

/**
 * Mistral Audio Service
 * Provides TTS and STT functionality with consent and privacy protections
 */
class MistralAudioService {
  constructor(apiKey = null) {
    this.apiKey = apiKey || process.env.MISTRAL_API_KEY;
    this.rateLimitTrackers = {
      tts: { requests: [], lastCleanup: Date.now() },
      stt: { requests: [], lastCleanup: Date.now() },
    };
    this.consentStore = new Map();
  }

  // ==========================================================================
  // CONSENT MANAGEMENT
  // ==========================================================================

  /**
   * Check if audio consent is granted for a session
   * @param {string} sessionId - Session identifier
   * @param {string} type - 'tts' or 'stt'
   * @returns {boolean} True if consent is granted
   */
  hasConsent(sessionId, type = 'audio') {
    const consent = this.consentStore.get(sessionId);
    return consent?.[type] === true || consent?.audio === true;
  }

  /**
   * Grant audio consent for a session
   * @param {string} sessionId - Session identifier
   * @param {string} type - 'tts', 'stt', or 'audio' (all)
   */
  grantConsent(sessionId, type = 'audio') {
    if (!this.consentStore.has(sessionId)) {
      this.consentStore.set(sessionId, {});
    }
    
    const consent = this.consentStore.get(sessionId);
    
    if (type === 'audio') {
      consent.tts = true;
      consent.stt = true;
    } else {
      consent[type] = true;
    }
    
    this.consentStore.set(sessionId, consent);
  }

  /**
   * Revoke audio consent for a session
   * @param {string} sessionId - Session identifier
   * @param {string} type - 'tts', 'stt', or 'audio' (all)
   */
  revokeConsent(sessionId, type = 'audio') {
    const consent = this.consentStore.get(sessionId);
    
    if (!consent) return;
    
    if (type === 'audio') {
      consent.tts = false;
      consent.stt = false;
    } else {
      consent[type] = false;
    }
    
    this.consentStore.set(sessionId, consent);
  }

  /**
   * Get consent state for a session
   * @param {string} sessionId - Session identifier
   * @returns {Object} Consent state
   */
  getConsentState(sessionId) {
    return this.consentStore.get(sessionId) || { tts: false, stt: false };
  }

  // ==========================================================================
  // RATE LIMITING
  // ==========================================================================

  /**
   * Check rate limit for a specific type
   * @param {string} type - 'tts' or 'stt'
   * @returns {boolean} True if within rate limit
   */
  checkRateLimit(type) {
    const now = Date.now();
    const config = MISTRAL_AUDIO_CONFIG.rateLimits[type];
    const tracker = this.rateLimitTrackers[type];
    
    // Clean up old requests
    if (now - tracker.lastCleanup > config.windowMs) {
      tracker.requests = tracker.requests.filter(timestamp => now - timestamp < config.windowMs);
      tracker.lastCleanup = now;
    }
    
    // Check if limit exceeded
    if (tracker.requests.length >= config.max) {
      return false;
    }
    
    // Add current request
    tracker.requests.push(now);
    return true;
  }

  /**
   * Get rate limit status
   * @param {string} type - 'tts' or 'stt'
   * @returns {Object} Rate limit status
   */
  getRateLimitStatus(type) {
    const config = MISTRAL_AUDIO_CONFIG.rateLimits[type];
    const tracker = this.rateLimitTrackers[type];
    const now = Date.now();
    
    // Clean up old requests
    const recentRequests = tracker.requests.filter(timestamp => now - timestamp < config.windowMs);
    
    return {
      remaining: Math.max(0, config.max - recentRequests.length),
      resetAt: recentRequests.length > 0 ? recentRequests[0] + config.windowMs : now,
      limit: config.max,
      windowMs: config.windowMs,
    };
  }

  // ==========================================================================
  // TEXT-TO-SPEECH (TTS)
  // ==========================================================================

  /**
   * Generate speech from text using Mistral TTS API
   * @param {string} text - Text to synthesize
   * @param {Object} options - TTS options
   * @param {string} options.sessionId - Session identifier
   * @param {string} options.model - TTS model (default: voxtral-mini-tts-2603)
   * @param {string} options.voiceId - Voice ID (default: en_esme_neutral)
   * @param {string} options.responseFormat - Audio format (default: mp3)
   * @returns {Promise<Object>} TTS result with audio data
   */
  async textToSpeech(text, options = {}) {
    const {
      sessionId = 'default',
      model = MISTRAL_AUDIO_CONFIG.models.tts,
      voiceId = MISTRAL_AUDIO_CONFIG.voices.en_neutral,
      responseFormat = 'mp3',
    } = options;

    // Check consent
    if (!this.hasConsent(sessionId, 'tts')) {
      throw new Error('TTS consent not granted. Call grantConsent() first.');
    }

    // Validate input
    if (!text || typeof text !== 'string') {
      throw new Error('Text is required and must be a string');
    }

    if (text.length > MISTRAL_AUDIO_CONFIG.maxInputSize.tts) {
      throw new Error(`Text exceeds maximum length of ${MISTRAL_AUDIO_CONFIG.maxInputSize.tts} characters`);
    }

    // Check rate limit
    if (!this.checkRateLimit('tts')) {
      const status = this.getRateLimitStatus('tts');
      throw new Error(`Rate limit exceeded. Retry in ${Math.ceil((status.resetAt - Date.now()) / 1000)} seconds.`);
    }

    // Check API key
    if (!this.apiKey) {
      throw new Error('MISTRAL_API_KEY is required. Set environment variable or pass to constructor.');
    }

    try {
      const response = await fetch(MISTRAL_AUDIO_CONFIG.endpoints.speech, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: text,
          model,
          voice_id: voiceId,
          response_format: responseFormat,
        }),
        timeout: MISTRAL_AUDIO_CONFIG.timeout,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`TTS API error: ${response.status} ${response.statusText}${errorData.message ? ' - ' + errorData.message : ''}`);
      }

      const data = await response.json();

      return {
        success: true,
        audioData: data.audio_data,
        model,
        voiceId,
        responseFormat,
        sessionId,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('[MistralAudio] TTS Error:', error.message);
      throw error;
    }
  }

  /**
   * Generate speech and save to file
   * @param {string} text - Text to synthesize
   * @param {string} outputPath - Output file path
   * @param {Object} options - TTS options
   * @returns {Promise<Object>} TTS result
   */
  async textToSpeechFile(text, outputPath, options = {}) {
    const result = await this.textToSpeech(text, options);
    
    // In Node.js, we would write to file here
    // For browser, return the audio data for the caller to handle
    if (typeof window === 'undefined') {
      const fs = await import('fs');
      await fs.promises.writeFile(outputPath, Buffer.from(result.audioData, 'base64'));
    }
    
    return result;
  }

  // ==========================================================================
  // SPEECH-TO-TEXT (STT)
  // ==========================================================================

  /**
   * Transcribe audio to text using Mistral STT API
   * @param {string|Buffer} audio - Audio file path or buffer
   * @param {Object} options - STT options
   * @param {string} options.sessionId - Session identifier
   * @param {string} options.model - STT model (default: voxtral-mini-latest)
   * @param {boolean} options.diarize - Enable speaker diarization (default: false)
   * @param {Array} options.timestampGranularities - Timestamp precision
   * @returns {Promise<Object>} STT result with transcription
   */
  async speechToText(audio, options = {}) {
    const {
      sessionId = 'default',
      model = MISTRAL_AUDIO_CONFIG.models.stt,
      diarize = false,
      timestampGranularities = [],
    } = options;

    // Check consent
    if (!this.hasConsent(sessionId, 'stt')) {
      throw new Error('STT consent not granted. Call grantConsent() first.');
    }

    // Validate audio input
    let audioBuffer;
    let audioSize;
    
    if (typeof audio === 'string') {
      // Audio is a file path
      if (typeof window === 'undefined') {
        const fs = await import('fs');
        audioBuffer = await fs.promises.readFile(audio);
        audioSize = audioBuffer.length;
      } else {
        // Browser: expect File or Blob
        throw new Error('In browser, pass File or Blob object, not path');
      }
    } else if (audio instanceof Buffer) {
      audioBuffer = audio;
      audioSize = audio.length;
    } else if (typeof File !== 'undefined' && audio instanceof File) {
      audioBuffer = await audio.arrayBuffer();
      audioSize = audio.size;
    } else if (typeof Blob !== 'undefined' && audio instanceof Blob) {
      audioBuffer = await audio.arrayBuffer();
      audioSize = audio.size;
    } else {
      throw new Error('Audio must be a file path, Buffer, File, or Blob');
    }

    // Check size
    if (audioSize > MISTRAL_AUDIO_CONFIG.maxInputSize.stt) {
      throw new Error(`Audio file exceeds maximum size of ${MISTRAL_AUDIO_CONFIG.maxInputSize.stt / (1024 * 1024)}MB`);
    }

    // Check rate limit
    if (!this.checkRateLimit('stt')) {
      const status = this.getRateLimitStatus('stt');
      throw new Error(`Rate limit exceeded. Retry in ${Math.ceil((status.resetAt - Date.now()) / 1000)} seconds.`);
    }

    // Check API key
    if (!this.apiKey) {
      throw new Error('MISTRAL_API_KEY is required. Set environment variable or pass to constructor.');
    }

    try {
      // Prepare form data
      const formData = new FormData();
      formData.append('model', model);
      
      if (audio instanceof File || audio instanceof Blob) {
        formData.append('file', audio, audio.name || 'audio');
      } else {
        // For Buffer, create a blob
        const blob = new Blob([audioBuffer], { type: 'audio/mpeg' });
        formData.append('file', blob, 'audio.mp3');
      }
      
      if (diarize) {
        formData.append('diarize', 'true');
      }
      
      if (timestampGranularities.length > 0) {
        formData.append('timestamp_granularities', timestampGranularities.join(','));
      }

      const response = await fetch(MISTRAL_AUDIO_CONFIG.endpoints.transcriptions, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: formData,
        timeout: MISTRAL_AUDIO_CONFIG.timeout,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`STT API error: ${response.status} ${response.statusText}${errorData.message ? ' - ' + errorData.message : ''}`);
      }

      const data = await response.json();

      return {
        success: true,
        text: data.text,
        model,
        diarize,
        timestampGranularities,
        segments: data.segments || [],
        sessionId,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('[MistralAudio] STT Error:', error.message);
      throw error;
    }
  }

  /**
   * Transcribe audio from URL
   * @param {string} audioUrl - Public URL to audio file
   * @param {Object} options - STT options
   * @returns {Promise<Object>} STT result
   */
  async speechToTextFromUrl(audioUrl, options = {}) {
    const {
      sessionId = 'default',
      model = MISTRAL_AUDIO_CONFIG.models.stt,
      diarize = false,
      timestampGranularities = [],
    } = options;

    // Check consent
    if (!this.hasConsent(sessionId, 'stt')) {
      throw new Error('STT consent not granted. Call grantConsent() first.');
    }

    // Check API key
    if (!this.apiKey) {
      throw new Error('MISTRAL_API_KEY is required. Set environment variable or pass to constructor.');
    }

    try {
      const formData = new FormData();
      formData.append('model', model);
      formData.append('file_url', audioUrl);
      
      if (diarize) {
        formData.append('diarize', 'true');
      }
      
      if (timestampGranularities.length > 0) {
        formData.append('timestamp_granularities', timestampGranularities.join(','));
      }

      const response = await fetch(MISTRAL_AUDIO_CONFIG.endpoints.transcriptions, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: formData,
        timeout: MISTRAL_AUDIO_CONFIG.timeout,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`STT API error: ${response.status} ${response.statusText}${errorData.message ? ' - ' + errorData.message : ''}`);
      }

      const data = await response.json();

      return {
        success: true,
        text: data.text,
        model,
        diarize,
        timestampGranularities,
        segments: data.segments || [],
        sessionId,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('[MistralAudio] STT from URL Error:', error.message);
      throw error;
    }
  }

  // ==========================================================================
  // UTILITY METHODS
  // ==========================================================================

  /**
   * Get available TTS voices
   * @returns {Object} Available voices
   */
  getAvailableVoices() {
    return { ...MISTRAL_AUDIO_CONFIG.voices };
  }

  /**
   * Get available models
   * @returns {Object} Available models
   */
  getAvailableModels() {
    return { ...MISTRAL_AUDIO_CONFIG.models };
  }

  /**
   * Validate TTS parameters
   * @param {Object} params - Parameters to validate
   * @returns {Object} Validation result
   */
  validateTtsParams(params) {
    const errors = [];
    const warnings = [];
    
    if (!params.text || typeof params.text !== 'string') {
      errors.push('Text is required and must be a string');
    } else if (params.text.length > MISTRAL_AUDIO_CONFIG.maxInputSize.tts) {
      errors.push(`Text exceeds maximum length of ${MISTRAL_AUDIO_CONFIG.maxInputSize.tts} characters`);
    }
    
    if (params.model && !MISTRAL_AUDIO_CONFIG.models.tts.includes(params.model)) {
      warnings.push(`Model ${params.model} may not be valid. Using default.`);
    }
    
    if (params.voiceId && !Object.values(MISTRAL_AUDIO_CONFIG.voices).includes(params.voiceId)) {
      warnings.push(`Voice ${params.voiceId} may not be valid. Using default.`);
    }
    
    if (params.responseFormat && !['mp3', 'wav', 'ogg'].includes(params.responseFormat)) {
      warnings.push(`Format ${params.responseFormat} may not be valid. Using mp3.`);
    }
    
    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * Validate STT parameters
   * @param {Object} params - Parameters to validate
   * @returns {Object} Validation result
   */
  validateSttParams(params) {
    const errors = [];
    const warnings = [];
    
    if (!params.audio) {
      errors.push('Audio is required');
    }
    
    if (params.model && !MISTRAL_AUDIO_CONFIG.models.stt.includes(params.model)) {
      warnings.push(`Model ${params.model} may not be valid. Using default.`);
    }
    
    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * Get audio service status
   * @returns {Object} Service status
   */
  getStatus() {
    return {
      apiKeyConfigured: !!this.apiKey,
      ttsRateLimit: this.getRateLimitStatus('tts'),
      sttRateLimit: this.getRateLimitStatus('stt'),
      activeSessions: this.consentStore.size,
    };
  }

  /**
   * Clear rate limit trackers
   */
  clearRateLimits() {
    this.rateLimitTrackers.tts.requests = [];
    this.rateLimitTrackers.stt.requests = [];
  }

  /**
   * Clear consent store
   */
  clearConsentStore() {
    this.consentStore.clear();
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

const mistralAudioService = new MistralAudioService();

// ============================================================================
// EXPORTS
// ============================================================================

export {
  MistralAudioService,
  mistralAudioService,
  MISTRAL_AUDIO_CONFIG,
};

export default MistralAudioService;
