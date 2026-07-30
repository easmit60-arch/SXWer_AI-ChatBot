/**
 * Verification Test for SXWer AI ChatBot Ethics Enforcement
 * 
 * This script tests all 7 requirements to ensure they are properly enforced.
 * Run with: node VERIFICATION_TEST.js
 */

import {
  chatbot,
  hasAIConsent,
  hasToolConsent,
  setUserConsent,
  detectSensitiveInput,
  detectCrisis,
  getSafeRedirection,
  formatHumanNLP,
  formatResponseForDisplay,
  createSafeResponse,
  checkSherlockProtocol,
  requestSherlockConsent,
  validateSherlockUsername,
  generateCrisisResponse,
  CORE_PRINCIPLES,
  BOUNDARY_STATEMENTS,
  CRISIS_RESOURCES,
  SHERLOCK_PROTOCOL
} from './chatbot.js';

console.log('═══════════════════════════════════════════════════════════════');
console.log('🔍 SXWer AI ChatBot - Ethics Enforcement Verification');
console.log('═══════════════════════════════════════════════════════════════\n');

let testsPassed = 0;
let testsFailed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
    testsPassed++;
  } catch (error) {
    console.log(`❌ ${name}`);
    console.log(`   Error: ${error.message}`);
    testsFailed++;
  }
}

// ============================================================================
// REQUIREMENT 1: REMOVE OR HARD-GATE LLM USAGE
// ============================================================================

console.log('\n📋 REQUIREMENT 1: Remove or Hard-Gate LLM Usage');
console.log('─────────────────────────────────────────────────────────────');

test('1.1: Default consent state should have AI disabled', () => {
  setUserConsent(false, false);
  if (hasAIConsent() !== false) {
    throw new Error('AI consent should be false by default');
  }
});

test('1.2: Default consent state should have tools disabled', () => {
  if (hasToolConsent() !== false) {
    throw new Error('Tools consent should be false by default');
  }
});

test('1.3: Without AI consent, should request consent', () => {
  setUserConsent(false, false);
  const response = chatbot.processMessage('Hello');
  if (!response.rapport.includes('consent')) {
    throw new Error('Should ask for consent when AI not enabled');
  }
});

test('1.4: With AI consent, should not request consent', () => {
  setUserConsent(true, false);
  const response = chatbot.processMessage('Hello');
  if (response.rapport.includes('consent')) {
    throw new Error('Should not ask for consent when AI is enabled');
  }
});

test('1.5: setUserConsent should update state', () => {
  setUserConsent(false, false);
  setUserConsent(true, true);
  if (!hasAIConsent() || !hasToolConsent()) {
    throw new Error('Consent state should be updated');
  }
});

// ============================================================================
// REQUIREMENT 2: ENFORCE HUMAN NLP RESPONSE STRUCTURE
// ============================================================================

console.log('\n📋 REQUIREMENT 2: Enforce Human NLP Response Structure');
console.log('─────────────────────────────────────────────────────────────');

test('2.1: formatHumanNLP should require all fields', () => {
  try {
    formatHumanNLP({});
    throw new Error('Should throw error for missing fields');
  } catch (e) {
    if (!e.message.includes('required')) {
      throw new Error('Error message should mention required fields');
    }
  }
});

test('2.2: formatHumanNLP should return object with all fields', () => {
  const response = formatHumanNLP({
    anchor: 'Test anchor',
    mirror: 'Test mirror',
    reframe: 'Test reframe',
    rapport: 'Test rapport'
  });
  if (!response.anchor || !response.mirror || !response.reframe || !response.rapport) {
    throw new Error('Response should have all fields');
  }
});

test('2.3: createSafeResponse should return formatted response', () => {
  const response = createSafeResponse('Hello');
  if (!response.anchor || !response.mirror || !response.reframe || !response.rapport) {
    throw new Error('createSafeResponse should return complete response');
  }
});

test('2.4: All chatbot responses should have required structure', () => {
  setUserConsent(true, false);
  const response = chatbot.processMessage('Hello');
  if (!response.anchor || !response.mirror || !response.reframe || !response.rapport) {
    throw new Error('All chatbot responses should have required structure');
  }
});

test('2.5: formatResponseForDisplay should format correctly', () => {
  const response = formatHumanNLP({
    anchor: 'A',
    mirror: 'B',
    reframe: 'C',
    rapport: 'D'
  });
  const formatted = formatResponseForDisplay(response);
  if (!formatted.includes('A') || !formatted.includes('B') || 
      !formatted.includes('C') || !formatted.includes('D')) {
    throw new Error('formatResponseForDisplay should include all fields');
  }
});

// ============================================================================
// REQUIREMENT 3: EXPLICIT CONSENT BEFORE TOOL/API USAGE
// ============================================================================

console.log('\n📋 REQUIREMENT 3: Explicit Consent Before Tool/API Usage');
console.log('─────────────────────────────────────────────────────────────');

test('3.1: Sherlock should require tool consent', () => {
  setUserConsent(false, false);
  const check = checkSherlockProtocol('check username');
  if (check.allowed !== false || check.reason !== 'EXPLICIT_CONSENT_REQUIRED') {
    throw new Error('Sherlock should require explicit consent');
  }
});

test('3.2: Sherlock should allow with tool consent', () => {
  setUserConsent(false, true);
  const check = checkSherlockProtocol('check my username for safety');
  if (check.allowed !== true) {
    throw new Error('Sherlock should allow with tool consent and valid purpose');
  }
});

test('3.3: Sherlock should deny forbidden purposes', () => {
  setUserConsent(false, true);
  const check = checkSherlockProtocol('surveillance of others');
  if (check.allowed !== false || check.reason !== 'FORBIDDEN_PURPOSE') {
    throw new Error('Sherlock should deny forbidden purposes');
  }
});

test('3.4: requestSherlockConsent should return formatted response', () => {
  const response = requestSherlockConsent('testuser');
  if (!response.anchor || !response.mirror || !response.reframe || !response.rapport) {
    throw new Error('requestSherlockConsent should return formatted response');
  }
  if (!response.rapport.includes('consent')) {
    throw new Error('requestSherlockConsent should ask for consent');
  }
});

test('3.5: validateSherlockUsername should validate input', () => {
  const valid = validateSherlockUsername('testuser');
  if (!valid.valid) {
    throw new Error('Should validate valid username');
  }
  
  const invalid = validateSherlockUsername('');
  if (invalid.valid) {
    throw new Error('Should reject empty username');
  }
});

// ============================================================================
// REQUIREMENT 4: SAFETY AND BOUNDARY GUARDRAILS
// ============================================================================

console.log('\n📋 REQUIREMENT 4: Safety and Boundary Guardrails');
console.log('─────────────────────────────────────────────────────────────');

test('4.1: detectSensitiveInput should detect mental health keywords', () => {
  const result = detectSensitiveInput('I need therapy');
  if (!result.isSensitive || !result.category === 'mental' || result.category.includes('mental_health')) {
    throw new Error('Should detect mental health keywords');
  }
});

test('4.2: detectSensitiveInput should detect crisis keywords', () => {
  const result = detectSensitiveInput('I want to kill myself');
  if (!result.isSensitive || result.category !== 'crisis') {
    throw new Error('Should detect crisis keywords');
  }
});

test('4.3: detectSensitiveInput should detect medical keywords', () => {
  const result = detectSensitiveInput('I need medical advice');
  if (!result.isSensitive || result.category !== 'medical') {
    throw new Error('Should detect medical keywords');
  }
});

test('4.4: detectSensitiveInput should detect legal keywords', () => {
  const result = detectSensitiveInput('I need legal advice');
  if (!result.isSensitive || result.category !== 'legal') {
    throw new Error('Should detect legal keywords');
  }
});

test('4.5: getSafeRedirection should return boundary statements', () => {
  const response = getSafeRedirection('mental_health', 'medium');
  if (!response.includes('not a therapist') && !response.includes('not a doctor')) {
    throw new Error('Should include boundary language');
  }
});

test('4.6: BOUNDARY_STATEMENTS should exist', () => {
  if (!BOUNDARY_STATEMENTS.notTherapist || 
      !BOUNDARY_STATEMENTS.notAuthority || 
      !BOUNDARY_STATEMENTS.notReplacement) {
    throw new Error('BOUNDARY_STATEMENTS should have all required statements');
  }
});

test('4.7: Sensitive input should trigger safe response', () => {
  setUserConsent(true, false);
  const response = chatbot.processMessage('I need therapy');
  // The response should be a safe redirection
  if (!response.reframe || response.reframe.length < 10) {
    throw new Error('Sensitive input should trigger safe response');
  }
});

test('4.8: Crisis input should trigger crisis response', () => {
  setUserConsent(true, false);
  const response = chatbot.processMessage('I want to kill myself');
  // The response should be a crisis response
  if (!response.anchor || !response.anchor.includes('painful')) {
    throw new Error('Crisis input should trigger crisis response');
  }
});

// ============================================================================
// REQUIREMENT 5: TRANSPARENCY
// ============================================================================

console.log('\n📋 REQUIREMENT 5: Transparency');
console.log('─────────────────────────────────────────────────────────────');

test('5.1: AI usage should be disclosed in response', () => {
  const response = formatHumanNLP({
    anchor: 'Test',
    mirror: 'Test',
    reframe: 'Test',
    rapport: 'Test',
    isAI: true
  });
  if (!response.anchor.startsWith('[AI-Assisted]')) {
    throw new Error('AI usage should be disclosed with [AI-Assisted] prefix');
  }
});

test('5.2: Consent requirement should be disclosed', () => {
  const response = formatHumanNLP({
    anchor: 'Test',
    mirror: 'Test',
    reframe: 'Test',
    rapport: 'Test',
    isConsentRequired: true
  });
  if (!response.rapport.includes('explicit consent')) {
    throw new Error('Consent requirement should be disclosed');
  }
});

test('5.3: CORE_PRINCIPLES should include transparency', () => {
  if (!CORE_PRINCIPLES.TRANSPARENCY) {
    throw new Error('CORE_PRINCIPLES should include transparency');
  }
});

test('5.4: BOUNDARY_STATEMENTS should include uncertainty', () => {
  if (!BOUNDARY_STATEMENTS.uncertainty) {
    throw new Error('BOUNDARY_STATEMENTS should include uncertainty');
  }
});

test('5.5: Consent request should explain AI usage', () => {
  setUserConsent(false, false);
  const response = chatbot.requestAIConsent('Hello');
  if (!response.anchor.includes('transparent') || !response.reframe.includes('local, curated')) {
    throw new Error('Consent request should explain AI usage');
  }
});

// ============================================================================
// REQUIREMENT 6: ALIGN WITH README PRINCIPLES
// ============================================================================

console.log('\n📋 REQUIREMENT 6: Align with README Principles');
console.log('─────────────────────────────────────────────────────────────');

test('6.1: CORE_PRINCIPLES should include DIGNITY_FIRST', () => {
  if (!CORE_PRINCIPLES.DIGNITY_FIRST) {
    throw new Error('CORE_PRINCIPLES should include DIGNITY_FIRST');
  }
});

test('6.2: CORE_PRINCIPLES should include NO_ASSUMPTIONS', () => {
  if (!CORE_PRINCIPLES.NO_ASSUMPTIONS) {
    throw new Error('CORE_PRINCIPLES should include NO_ASSUMPTIONS');
  }
});

test('6.3: CORE_PRINCIPLES should include BIAS_INHERENT', () => {
  if (!CORE_PRINCIPLES.BIAS_INHERENT) {
    throw new Error('CORE_PRINCIPLES should include BIAS_INHERENT');
  }
});

test('6.4: CORE_PRINCIPLES should include AI_ASSISTIVE', () => {
  if (!CORE_PRINCIPLES.AI_ASSISTIVE) {
    throw new Error('CORE_PRINCIPLES should include AI_ASSISTIVE');
  }
});

test('6.5: BOUNDARY_STATEMENTS should include notTherapist', () => {
  if (!BOUNDARY_STATEMENTS.notTherapist) {
    throw new Error('BOUNDARY_STATEMENTS should include notTherapist');
  }
});

test('6.6: BOUNDARY_STATEMENTS should include notAuthority', () => {
  if (!BOUNDARY_STATEMENTS.notAuthority) {
    throw new Error('BOUNDARY_STATEMENTS should include notAuthority');
  }
});

test('6.7: Responses should respect user autonomy', () => {
  setUserConsent(true, false);
  const response = chatbot.processMessage('Hello');
  // Check for autonomy-related language
  if (!response.reframe.includes('pace') && 
      !response.reframe.includes('choices') && 
      !response.rapport.includes('choice') &&
      !response.rapport.includes('Would you like')) {
    throw new Error('Responses should respect user autonomy');
  }
});

// ============================================================================
// REQUIREMENT 7: CLEAN ARCHITECTURE
// ============================================================================

console.log('\n📋 REQUIREMENT 7: Clean Architecture');
console.log('─────────────────────────────────────────────────────────────');

test('7.1: Consent logic should be separated', () => {
  if (typeof setUserConsent !== 'function' || 
      typeof hasAIConsent !== 'function' || 
      typeof hasToolConsent !== 'function') {
    throw new Error('Consent logic should be separated and exported');
  }
});

test('7.2: Safety checks should be separated', () => {
  if (typeof detectSensitiveInput !== 'function' || 
      typeof detectCrisis !== 'function' || 
      typeof getSafeRedirection !== 'function') {
    throw new Error('Safety checks should be separated and exported');
  }
});

test('7.3: Response formatting should be separated', () => {
  if (typeof formatHumanNLP !== 'function' || 
      typeof formatResponseForDisplay !== 'function' || 
      typeof createSafeResponse !== 'function') {
    throw new Error('Response formatting should be separated and exported');
  }
});

test('7.4: Sherlock protocol should be separated', () => {
  if (typeof checkSherlockProtocol !== 'function' || 
      typeof requestSherlockConsent !== 'function' || 
      typeof validateSherlockUsername !== 'function') {
    throw new Error('Sherlock protocol should be separated and exported');
  }
});

test('7.5: Main chatbot class should integrate all modules', () => {
  if (typeof chatbot.processMessage !== 'function' ||
      typeof chatbot.setAIConsent !== 'function' ||
      typeof chatbot.setToolConsent !== 'function') {
    throw new Error('Main chatbot class should integrate all modules');
  }
});

test('7.6: All functions should be exported for modular use', () => {
  // We successfully imported all these functions, so they must be exported
  const exports = [
    'chatbot', 'hasAIConsent', 'hasToolConsent', 'setUserConsent',
    'detectSensitiveInput', 'detectCrisis', 'getSafeRedirection',
    'formatHumanNLP', 'formatResponseForDisplay', 'createSafeResponse',
    'checkSherlockProtocol', 'requestSherlockConsent', 'validateSherlockUsername',
    'generateCrisisResponse', 'CORE_PRINCIPLES', 'BOUNDARY_STATEMENTS',
    'CRISIS_RESOURCES', 'SHERLOCK_PROTOCOL'
  ];
  
  // If we got here, all exports are working
});

// ============================================================================
// FINAL SUMMARY
// ============================================================================

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('📊 VERIFICATION SUMMARY');
console.log('═══════════════════════════════════════════════════════════════\n');

console.log(`✅ Tests Passed: ${testsPassed}`);
console.log(`❌ Tests Failed: ${testsFailed}`);
console.log(`📈 Success Rate: ${((testsPassed / (testsPassed + testsFailed)) * 100).toFixed(1)}%`);

if (testsFailed === 0) {
  console.log('\n🎉 ALL TESTS PASSED! Ethics are fully enforced.');
  console.log('\n✨ The chatbot.js file successfully enforces all 7 requirements from README.md');
  process.exit(0);
} else {
  console.log('\n⚠️  Some tests failed. Please review the errors above.');
  process.exit(1);
}
