/**
 * Mistral Audio Service - TTS Example
 * 
 * This example demonstrates how to use the Text-to-Speech functionality
 * with the SXWer AI ChatBot audio service.
 */

import { mistralAudioService } from '../MistralAudioService.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// CONFIGURATION
// ============================================================================

// Load environment variables
import dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '../.env') });

// Check if API key is configured
if (!process.env.MISTRAL_API_KEY) {
  console.error('❌ MISTRAL_API_KEY is not configured.');
  console.log('Please create a .env file with your API key:');
  console.log('MISTRAL_API_KEY=your-api-key-here');
  console.log('\nYou can get your API key from: https://console.mistral.ai/');
  process.exit(1);
}

// ============================================================================
// EXAMPLES
// ============================================================================

/**
 * Example 1: Basic TTS
 * Convert text to speech and save to file
 */
async function basicTts() {
  console.log('\n🎙️  Example 1: Basic TTS\n');
  
  const sessionId = 'example-session-1';
  const text = 'Hello, I am Becky Tahablu, co-founder of Root Support Network. We work on holistic transformative justice to address systemic harm and bias.';
  const outputPath = path.join(__dirname, 'output.mp3');
  
  try {
    // Grant consent for TTS
    mistralAudioService.grantConsent(sessionId, 'tts');
    console.log('✅ Consent granted for TTS');
    
    // Generate speech
    console.log('🔊 Generating speech...');
    const result = await mistralAudioService.textToSpeech(text, {
      sessionId,
      voiceId: 'en_esme_neutral',
      responseFormat: 'mp3'
    });
    
    console.log('✅ Speech generated successfully');
    console.log(`   Model: ${result.model}`);
    console.log(`   Voice: ${result.voiceId}`);
    console.log(`   Format: ${result.responseFormat}`);
    
    // Save to file
    await fs.promises.writeFile(outputPath, Buffer.from(result.audioData, 'base64'));
    console.log(`✅ Audio saved to: ${outputPath}`);
    
    // Check file size
    const stats = await fs.promises.stat(outputPath);
    console.log(`   File size: ${(stats.size / 1024).toFixed(2)} KB`);
    
    return outputPath;
  } catch (error) {
    console.error('❌ Error:', error.message);
    return null;
  }
}

/**
 * Example 2: TTS with Different Voices
 * Try different voices to find the best one for your use case
 */
async function multiVoiceTts() {
  console.log('\n🎙️  Example 2: TTS with Different Voices\n');
  
  const sessionId = 'example-session-2';
  const text = 'Hello, this is a test of different voices.';
  
  // Grant consent
  mistralAudioService.grantConsent(sessionId, 'tts');
  
  // Get available voices
  const voices = mistralAudioService.getAvailableVoices();
  console.log(`🎤 Available voices: ${Object.keys(voices).length}`);
  
  // Try each voice
  for (const [voiceId, voiceName] of Object.entries(voices)) {
    try {
      console.log(`\n🔊 Testing voice: ${voiceId} (${voiceName})`);
      
      const result = await mistralAudioService.textToSpeech(text, {
        sessionId,
        voiceId,
        responseFormat: 'mp3'
      });
      
      const outputPath = path.join(__dirname, `voice_${voiceId}.mp3`);
      await fs.promises.writeFile(outputPath, Buffer.from(result.audioData, 'base64'));
      
      const stats = await fs.promises.stat(outputPath);
      console.log(`   ✅ Saved to: ${outputPath} (${(stats.size / 1024).toFixed(2)} KB)`);
    } catch (error) {
      console.error(`   ❌ Error with ${voiceId}: ${error.message}`);
    }
  }
}

/**
 * Example 3: Long Text TTS
 * Handle long text by splitting into chunks
 */
async function longTextTts() {
  console.log('\n🎙️  Example 3: Long Text TTS\n');
  
  const sessionId = 'example-session-3';
  const longText = `Hello, I am Becky Tahablu and I am with, I'm a co-founder and the, what is it, 
Holistic Transformative Justice Facilitator in Root Support Network. What is a holistic 
transformative justice facilitator? Well, I'm learning myself. It seems a little like a mouthful. 
But as in relation to the work I do, I identify and call in behaviors of biases or stigma towards 
marginalized identities and ask for accountability and transparency if people implement those tools 
or if communities or businesses implement that and produce harm subconsciously or consciously. 
And how that relates within systemic and systematic, like, abuse. Not just the systems in itself, 
but the abuse that's perpetrated due to those systems that are made. And I like to address the 
harm and conflict forwardly. And holding space for people as they experience what is the experience 
and amplifying the voices of the ones that are harmed and marginalized.`;
  
  // Grant consent
  mistralAudioService.grantConsent(sessionId, 'tts');
  
  // Check if text is too long
  const maxLength = 10000; // Mistral's limit
  if (longText.length > maxLength) {
    console.log(`⚠️  Text is too long (${longText.length} chars). Splitting into chunks...`);
    
    // Split into chunks
    const chunks = [];
    for (let i = 0; i < longText.length; i += maxLength) {
      chunks.push(longText.substring(i, i + maxLength));
    }
    
    console.log(`   Split into ${chunks.length} chunks`);
    
    // Process each chunk
    for (let i = 0; i < chunks.length; i++) {
      console.log(`\n🔊 Processing chunk ${i + 1}/${chunks.length}`);
      
      const result = await mistralAudioService.textToSpeech(chunks[i], {
        sessionId,
        voiceId: 'en_esme_neutral',
        responseFormat: 'mp3'
      });
      
      const outputPath = path.join(__dirname, `long_text_${i + 1}.mp3`);
      await fs.promises.writeFile(outputPath, Buffer.from(result.audioData, 'base64'));
      
      console.log(`   ✅ Saved to: ${outputPath}`);
    }
    
    console.log('\n✅ All chunks processed. You can combine them using an audio editor.');
  } else {
    // Text is short enough, process as single file
    const result = await mistralAudioService.textToSpeech(longText, {
      sessionId,
      voiceId: 'en_esme_neutral',
      responseFormat: 'mp3'
    });
    
    const outputPath = path.join(__dirname, 'long_text.mp3');
    await fs.promises.writeFile(outputPath, Buffer.from(result.audioData, 'base64'));
    
    console.log(`✅ Long text saved to: ${outputPath}`);
  }
}

/**
 * Example 4: TTS with Rate Limit Testing
 * Test rate limiting behavior
 */
async function rateLimitTest() {
  console.log('\n🎙️  Example 4: Rate Limit Testing\n');
  
  const sessionId = 'example-session-4';
  const text = 'Rate limit test.';
  
  // Grant consent
  mistralAudioService.grantConsent(sessionId, 'tts');
  
  // Get initial rate limit status
  const initialStatus = mistralAudioService.getRateLimitStatus('tts');
  console.log(`Initial TTS rate limit: ${initialStatus.remaining}/${initialStatus.limit} requests`);
  
  // Make multiple requests
  const numRequests = 15;
  let successCount = 0;
  let errorCount = 0;
  
  for (let i = 0; i < numRequests; i++) {
    try {
      const result = await mistralAudioService.textToSpeech(text, {
        sessionId,
        voiceId: 'en_esme_neutral'
      });
      successCount++;
      console.log(`✅ Request ${i + 1}: Success`);
    } catch (error) {
      errorCount++;
      console.log(`❌ Request ${i + 1}: ${error.message}`);
      
      // If rate limited, wait and continue
      if (error.message.includes('Rate limit')) {
        const status = mistralAudioService.getRateLimitStatus('tts');
        const waitTime = Math.ceil((status.resetAt - Date.now()) / 1000);
        console.log(`   ⏳ Waiting ${waitTime} seconds...`);
        await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
      }
    }
  }
  
  console.log(`\n📊 Results: ${successCount} successful, ${errorCount} failed`);
}

/**
 * Example 5: Consent Management
 * Demonstrate consent management features
 */
async function consentManagement() {
  console.log('\n🎙️  Example 5: Consent Management\n');
  
  const sessionId = 'example-session-5';
  
  // Check initial consent state
  let consent = mistralAudioService.getConsentState(sessionId);
  console.log('Initial consent state:', consent);
  
  // Try TTS without consent (should fail)
  try {
    await mistralAudioService.textToSpeech('Test', { sessionId });
    console.log('❌ Should have failed without consent!');
  } catch (error) {
    console.log('✅ Correctly blocked without consent:', error.message);
  }
  
  // Grant TTS consent
  mistralAudioService.grantConsent(sessionId, 'tts');
  consent = mistralAudioService.getConsentState(sessionId);
  console.log('\nAfter granting TTS consent:', consent);
  
  // Try TTS with consent (should work)
  try {
    const result = await mistralAudioService.textToSpeech('Test', { sessionId });
    console.log('✅ TTS works with consent');
  } catch (error) {
    console.log('❌ TTS failed:', error.message);
  }
  
  // Try STT without consent (should fail)
  try {
    // We need an audio file for this, so we'll skip the actual call
    // but demonstrate the consent check
    if (!mistralAudioService.hasConsent(sessionId, 'stt')) {
      console.log('✅ STT correctly blocked without consent');
    }
  } catch (error) {
    console.log('Error:', error.message);
  }
  
  // Grant STT consent
  mistralAudioService.grantConsent(sessionId, 'stt');
  consent = mistralAudioService.getConsentState(sessionId);
  console.log('\nAfter granting STT consent:', consent);
  
  // Grant all audio consent
  mistralAudioService.grantConsent(sessionId, 'audio');
  consent = mistralAudioService.getConsentState(sessionId);
  console.log('\nAfter granting all audio consent:', consent);
  
  // Revoke consent
  mistralAudioService.revokeConsent(sessionId, 'tts');
  consent = mistralAudioService.getConsentState(sessionId);
  console.log('\nAfter revoking TTS consent:', consent);
  
  // Clear all consent
  mistralAudioService.revokeConsent(sessionId, 'audio');
  consent = mistralAudioService.getConsentState(sessionId);
  console.log('\nAfter revoking all audio consent:', consent);
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('='.repeat(70));
  console.log('🎙️  MISTRAL AUDIO SERVICE - TTS EXAMPLES');
  console.log('='.repeat(70));
  
  // Run examples
  await basicTts();
  
  // Uncomment to run other examples
  // await multiVoiceTts();
  // await longTextTts();
  // await rateLimitTest();
  // await consentManagement();
  
  console.log('\n' + '='.repeat(70));
  console.log('✅ Examples complete!');
  console.log('='.repeat(70));
  
  // Show service status
  const status = mistralAudioService.getStatus();
  console.log('\n📊 Service Status:');
  console.log(`   API Key: ${status.apiKeyConfigured ? '✅ Configured' : '❌ Not configured'}`);
  console.log(`   TTS Rate Limit: ${status.ttsRateLimit.remaining}/${status.ttsRateLimit.limit}`);
  console.log(`   STT Rate Limit: ${status.sttRateLimit.remaining}/${status.sttRateLimit.limit}`);
  console.log(`   Active Sessions: ${status.activeSessions}`);
}

main().catch(console.error);
