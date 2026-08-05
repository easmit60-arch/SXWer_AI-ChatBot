/**
 * Mistral Audio Service - STT Example
 * 
 * This example demonstrates how to use the Speech-to-Text functionality
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
 * Example 1: Basic STT
 * Transcribe a local audio file
 */
async function basicStt() {
  console.log('\n🎤 Example 1: Basic STT\n');
  
  const sessionId = 'example-session-1';
  
  // Check if we have a test audio file
  const testFiles = [
    path.join(__dirname, 'test.mp3'),
    path.join(__dirname, 'test.wav'),
    path.join(__dirname, 'test.ogg'),
    path.join(__dirname, '../test.mp3'),
    path.join(__dirname, '../test.wav'),
  ];
  
  let audioFile = null;
  for (const file of testFiles) {
    try {
      await fs.promises.access(file);
      audioFile = file;
      break;
    } catch {
      // File doesn't exist, try next
    }
  }
  
  if (!audioFile) {
    console.log('⚠️  No test audio file found.');
    console.log('Please add an audio file (test.mp3, test.wav, or test.ogg) to the examples directory.');
    console.log('\nYou can use the TTS example to generate a test file:');
    console.log('  node examples/tts.js');
    return null;
  }
  
  try {
    // Grant consent for STT
    mistralAudioService.grantConsent(sessionId, 'stt');
    console.log('✅ Consent granted for STT');
    
    // Get file info
    const stats = await fs.promises.stat(audioFile);
    console.log(`📁 Transcribing: ${path.basename(audioFile)}`);
    console.log(`   Size: ${(stats.size / 1024).toFixed(2)} KB`);
    
    // Transcribe
    console.log('🔊 Transcribing...');
    const result = await mistralAudioService.speechToText(audioFile, {
      sessionId,
      model: 'voxtral-mini-latest',
      diarize: false
    });
    
    console.log('✅ Transcription complete');
    console.log(`\n📄 Transcription:`);
    console.log('-'.repeat(60));
    console.log(result.text);
    console.log('-'.repeat(60));
    
    return result;
  } catch (error) {
    console.error('❌ Error:', error.message);
    return null;
  }
}

/**
 * Example 2: STT with Diarization
 * Transcribe with speaker diarization
 */
async function diarizationStt() {
  console.log('\n🎤 Example 2: STT with Diarization\n');
  
  const sessionId = 'example-session-2';
  
  // Check if we have a test audio file with multiple speakers
  const testFiles = [
    path.join(__dirname, 'conversation.mp3'),
    path.join(__dirname, 'meeting.wav'),
    path.join(__dirname, '../conversation.mp3'),
  ];
  
  let audioFile = null;
  for (const file of testFiles) {
    try {
      await fs.promises.access(file);
      audioFile = file;
      break;
    } catch {
      // File doesn't exist, try next
    }
  }
  
  if (!audioFile) {
    console.log('⚠️  No multi-speaker test audio file found.');
    console.log('Please add a conversation file (conversation.mp3 or meeting.wav) to test diarization.');
    return null;
  }
  
  try {
    // Grant consent
    mistralAudioService.grantConsent(sessionId, 'stt');
    
    // Get file info
    const stats = await fs.promises.stat(audioFile);
    console.log(`📁 Transcribing: ${path.basename(audioFile)}`);
    console.log(`   Size: ${(stats.size / 1024).toFixed(2)} KB`);
    
    // Transcribe with diarization
    console.log('🔊 Transcribing with diarization...');
    const result = await mistralAudioService.speechToText(audioFile, {
      sessionId,
      model: 'voxtral-mini-latest',
      diarize: true,
      timestampGranularities: ['segment']
    });
    
    console.log('✅ Transcription with diarization complete');
    console.log(`\n📄 Full Transcription:`);
    console.log('-'.repeat(60));
    console.log(result.text);
    console.log('-'.repeat(60));
    
    if (result.segments && result.segments.length > 0) {
      console.log(`\n🎯 Segments (${result.segments.length}):`);
      result.segments.forEach((segment, index) => {
        console.log(`  ${index + 1}. [${segment.start.toFixed(1)}s - ${segment.end.toFixed(1)}s] ` +
                    `Speaker ${segment.speaker_id}: ${segment.text}`);
      });
    }
    
    return result;
  } catch (error) {
    console.error('❌ Error:', error.message);
    return null;
  }
}

/**
 * Example 3: STT with Word-Level Timestamps
 * Get word-level timestamps for precise transcription
 */
async function wordTimestampStt() {
  console.log('\n🎤 Example 3: STT with Word-Level Timestamps\n');
  
  const sessionId = 'example-session-3';
  
  // Use the same test file as basic STT
  const testFiles = [
    path.join(__dirname, 'test.mp3'),
    path.join(__dirname, 'test.wav'),
    path.join(__dirname, '../test.mp3'),
  ];
  
  let audioFile = null;
  for (const file of testFiles) {
    try {
      await fs.promises.access(file);
      audioFile = file;
      break;
    } catch {
      // File doesn't exist, try next
    }
  }
  
  if (!audioFile) {
    console.log('⚠️  No test audio file found. Skipping.');
    return null;
  }
  
  try {
    // Grant consent
    mistralAudioService.grantConsent(sessionId, 'stt');
    
    // Get file info
    const stats = await fs.promises.stat(audioFile);
    console.log(`📁 Transcribing: ${path.basename(audioFile)}`);
    
    // Transcribe with word-level timestamps
    console.log('🔊 Transcribing with word-level timestamps...');
    const result = await mistralAudioService.speechToText(audioFile, {
      sessionId,
      model: 'voxtral-mini-latest',
      diarize: false,
      timestampGranularities: ['word']
    });
    
    console.log('✅ Transcription with word timestamps complete');
    console.log(`\n📄 Transcription:`);
    console.log('-'.repeat(60));
    console.log(result.text);
    console.log('-'.repeat(60));
    
    if (result.segments && result.segments.length > 0) {
      console.log(`\n⏱️  Word-Level Timestamps:`);
      // Note: The actual word-level data structure may vary
      // This is a placeholder for when word-level timestamps are available
      console.log('   (Word-level timestamps would be displayed here)');
    }
    
    return result;
  } catch (error) {
    console.error('❌ Error:', error.message);
    return null;
  }
}

/**
 * Example 4: STT from URL
 * Transcribe audio from a public URL
 */
async function urlStt() {
  console.log('\n🎤 Example 4: STT from URL\n');
  
  const sessionId = 'example-session-4';
  
  // Use a public audio URL (replace with your own)
  // Note: The URL must be publicly accessible
  const audioUrl = 'https://example.com/sample.mp3'; // REPLACE WITH REAL URL
  
  if (audioUrl === 'https://example.com/sample.mp3') {
    console.log('⚠️  Please replace the audioUrl with a real public URL.');
    console.log('Example: https://your-server.com/audio.mp3');
    return null;
  }
  
  try {
    // Grant consent
    mistralAudioService.grantConsent(sessionId, 'stt');
    
    console.log(`📁 Transcribing from URL: ${audioUrl}`);
    
    // Transcribe from URL
    console.log('🔊 Transcribing...');
    const result = await mistralAudioService.speechToTextFromUrl(audioUrl, {
      sessionId,
      model: 'voxtral-mini-latest',
      diarize: false
    });
    
    console.log('✅ Transcription from URL complete');
    console.log(`\n📄 Transcription:`);
    console.log('-'.repeat(60));
    console.log(result.text);
    console.log('-'.repeat(60));
    
    return result;
  } catch (error) {
    console.error('❌ Error:', error.message);
    return null;
  }
}

/**
 * Example 5: Batch STT
 * Transcribe multiple audio files
 */
async function batchStt() {
  console.log('\n🎤 Example 5: Batch STT\n');
  
  const sessionId = 'example-session-5';
  
  // Find all audio files in the directory
  let audioFiles = [];
  try {
    const files = await fs.promises.readdir(__dirname);
    audioFiles = files.filter(file => 
      file.endsWith('.mp3') || file.endsWith('.wav') || file.endsWith('.ogg')
    ).map(file => path.join(__dirname, file));
  } catch (error) {
    console.log('⚠️  Could not read directory:', error.message);
  }
  
  if (audioFiles.length === 0) {
    console.log('⚠️  No audio files found in the examples directory.');
    console.log('Please add some audio files (.mp3, .wav, .ogg) to test batch processing.');
    return;
  }
  
  console.log(`📁 Found ${audioFiles.length} audio files to transcribe`);
  
  // Grant consent
  mistralAudioService.grantConsent(sessionId, 'stt');
  
  // Process each file
  for (let i = 0; i < audioFiles.length; i++) {
    const audioFile = audioFiles[i];
    
    try {
      const stats = await fs.promises.stat(audioFile);
      console.log(`\n🔊 Processing ${i + 1}/${audioFiles.length}: ${path.basename(audioFile)} ` +
                  `(${((stats.size / 1024).toFixed(2))} KB)`);
      
      const result = await mistralAudioService.speechToText(audioFile, {
        sessionId,
        model: 'voxtral-mini-latest'
      });
      
      console.log('✅ Transcription:');
      console.log(result.text.substring(0, 200) + (result.text.length > 200 ? '...' : ''));
      
      // Save transcription to file
      const outputPath = path.join(__dirname, `${path.basename(audioFile, path.extname(audioFile))}.txt`);
      await fs.promises.writeFile(outputPath, result.text);
      console.log(`   Saved to: ${outputPath}`);
      
    } catch (error) {
      console.error(`❌ Error processing ${path.basename(audioFile)}: ${error.message}`);
    }
  }
  
  console.log('\n✅ Batch processing complete');
}

/**
 * Example 6: Consent Management for STT
 * Demonstrate consent management with STT
 */
async function consentStt() {
  console.log('\n🎤 Example 6: Consent Management for STT\n');
  
  const sessionId = 'example-session-6';
  
  // Check initial consent state
  let consent = mistralAudioService.getConsentState(sessionId);
  console.log('Initial consent state:', consent);
  
  // Try STT without consent (should fail)
  try {
    // We need an audio file, so we'll just check the consent
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
  
  // Check if we can proceed
  if (mistralAudioService.hasConsent(sessionId, 'stt')) {
    console.log('✅ STT is now allowed');
  }
  
  // Revoke consent
  mistralAudioService.revokeConsent(sessionId, 'stt');
  consent = mistralAudioService.getConsentState(sessionId);
  console.log('\nAfter revoking STT consent:', consent);
  
  // Check if we can still proceed
  if (!mistralAudioService.hasConsent(sessionId, 'stt')) {
    console.log('✅ STT is now blocked');
  }
}

/**
 * Example 7: Rate Limit Testing for STT
 * Test rate limiting behavior
 */
async function rateLimitStt() {
  console.log('\n🎤 Example 7: Rate Limit Testing for STT\n');
  
  const sessionId = 'example-session-7';
  
  // Check if we have a test audio file
  const testFiles = [
    path.join(__dirname, 'test.mp3'),
    path.join(__dirname, '../test.mp3'),
  ];
  
  let audioFile = null;
  for (const file of testFiles) {
    try {
      await fs.promises.access(file);
      audioFile = file;
      break;
    } catch {
      // File doesn't exist, try next
    }
  }
  
  if (!audioFile) {
    console.log('⚠️  No test audio file found. Skipping rate limit test.');
    return;
  }
  
  // Grant consent
  mistralAudioService.grantConsent(sessionId, 'stt');
  
  // Get initial rate limit status
  const initialStatus = mistralAudioService.getRateLimitStatus('stt');
  console.log(`Initial STT rate limit: ${initialStatus.remaining}/${initialStatus.limit} requests`);
  
  // Make multiple requests
  const numRequests = 10;
  let successCount = 0;
  let errorCount = 0;
  
  for (let i = 0; i < numRequests; i++) {
    try {
      const result = await mistralAudioService.speechToText(audioFile, {
        sessionId,
        model: 'voxtral-mini-latest'
      });
      successCount++;
      console.log(`✅ Request ${i + 1}: Success`);
    } catch (error) {
      errorCount++;
      console.log(`❌ Request ${i + 1}: ${error.message}`);
      
      // If rate limited, wait and continue
      if (error.message.includes('Rate limit')) {
        const status = mistralAudioService.getRateLimitStatus('stt');
        const waitTime = Math.ceil((status.resetAt - Date.now()) / 1000);
        console.log(`   ⏳ Waiting ${waitTime} seconds...`);
        await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
      }
    }
  }
  
  console.log(`\n📊 Results: ${successCount} successful, ${errorCount} failed`);
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('='.repeat(70));
  console.log('🎤 MISTRAL AUDIO SERVICE - STT EXAMPLES');
  console.log('='.repeat(70));
  
  // Run examples
  await basicStt();
  
  // Uncomment to run other examples
  // await diarizationStt();
  // await wordTimestampStt();
  // await urlStt();
  // await batchStt();
  // await consentStt();
  // await rateLimitStt();
  
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
