/**
 * SXWer AI ChatBot - NGO Collaboration Tests
 *
 * Tests for the Arweave + IPFS + Encryption PoC
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';

// Import the services
import {
  registerNGO,
  getNGOPublicKey,
  getRegisteredNGOs,
  requestUserConsent,
  revokeUserConsent,
  checkUserConsent,
  getUserConsentedNGOs,
  storeInteractionForNGO,
  queryNGOData,
  getNGOTransactionData,
  checkNGOAccess,
  getUserAccessLogs,
  getNGOAccessLogs,
  generateUserId,
  isNGOCollaborationAvailable,
  getNGOStats,
  generateKeyPair,
  generateExportableKeyPair,
  createNGOEncryptionPackage,
  decryptNGOEncryptionPackage,
} from '../services/ngo/ngoCollaboration.js';

import {
  uploadToIPFS,
  downloadFromIPFS,
  uploadJSONToIPFS,
  downloadJSONFromIPFS,
  isIPFSAvailable,
} from '../services/blockchain/ipfsService.js';

import {
  createNGOTransaction,
  getTransactionData,
  isArweaveAvailable,
} from '../services/blockchain/arweaveService.js';

import {
  encryptSymmetric,
  decryptSymmetric,
  encryptStringSymmetric,
  decryptStringSymmetric,
  encryptSymmetricKey,
  decryptSymmetricKey,
  generateSymmetricKey,
  importKeyPair,
  importSymmetricKey,
} from '../services/blockchain/dataEncryption.js';

// ============================================================================
// TEST SETUP
// ============================================================================

describe('NGO Collaboration PoC Tests', () => {
  let testNGOKeyPair;
  let testUserKeyPair;
  let testNGOId = 'test_ngo';
  let testUserId = 'test_user';

  before(async () => {
    // Generate test key pairs
    testNGOKeyPair = generateKeyPair();
    testUserKeyPair = generateKeyPair();
    
    // Register test NGO
    await registerNGO(testNGOId, testNGOKeyPair.publicKey, {
      name: 'Test NGO',
      description: 'Test organization for PoC',
    });
  });

  after(() => {
    // Clean up
  });

  // ============================================================================
  // ENCRYPTION TESTS
  // ============================================================================

  describe('Encryption Service', () => {
    it('should generate a symmetric key', () => {
      const key = generateSymmetricKey();
      assert.strictEqual(key.length, 32);
      assert.ok(key instanceof Uint8Array);
    });

    it('should encrypt and decrypt a string with symmetric key', () => {
      const key = generateSymmetricKey();
      const plaintext = 'Test message for encryption';
      
      const encrypted = encryptStringSymmetric(plaintext, key);
      assert.ok(encrypted.ciphertext);
      assert.ok(encrypted.nonce);
      
      const decrypted = decryptStringSymmetric(encrypted, key);
      assert.strictEqual(decrypted, plaintext);
    });

    it('should encrypt and decrypt binary data with symmetric key', () => {
      const key = generateSymmetricKey();
      const plaintext = new TextEncoder().encode('Binary test data');
      
      const encrypted = encryptSymmetric(plaintext, key);
      assert.ok(encrypted.ciphertext);
      assert.ok(encrypted.nonce);
      
      const decrypted = decryptSymmetric(encrypted, key);
      assert.deepStrictEqual(decrypted, plaintext);
    });

    it('should encrypt symmetric key with public key', () => {
      const symmetricKey = generateSymmetricKey();
      const recipientKeyPair = generateKeyPair();
      const senderKeyPair = generateKeyPair();
      
      const encryptedKey = encryptSymmetricKey(
        symmetricKey,
        recipientKeyPair.publicKey,
        senderKeyPair.secretKey
      );
      
      assert.ok(encryptedKey.encryptedKey);
      assert.ok(encryptedKey.nonce);
      
      const decryptedKey = decryptSymmetricKey(
        encryptedKey,
        recipientKeyPair.secretKey,
        senderKeyPair.publicKey
      );
      
      assert.deepStrictEqual(decryptedKey, symmetricKey);
    });

    it('should generate exportable key pairs', () => {
      const keyPair = generateExportableKeyPair();
      assert.ok(keyPair.publicKey);
      assert.ok(keyPair.secretKey);
      assert.ok(typeof keyPair.publicKey === 'string');
      assert.ok(typeof keyPair.secretKey === 'string');
      
      // Should be Base64 encoded
      assert.ok(/^[A-Za-z0-9+/=]+$/.test(keyPair.publicKey));
      assert.ok(/^[A-Za-z0-9+/=]+$/.test(keyPair.secretKey));
    });

    it('should import key pairs from Base64', () => {
      const exported = generateExportableKeyPair();
      const imported = importKeyPair(exported);
      
      assert.ok(imported.publicKey instanceof Uint8Array);
      assert.ok(imported.secretKey instanceof Uint8Array);
      assert.strictEqual(imported.publicKey.length, 32);
      assert.strictEqual(imported.secretKey.length, 32);
    });
  });

  // ============================================================================
  // NGO REGISTRATION TESTS
  // ============================================================================

  describe('NGO Registration', () => {
    it('should register an NGO with public key', () => {
      const newNGOId = 'new_test_ngo';
      const newKeyPair = generateKeyPair();
      
      const result = registerNGO(newNGOId, newKeyPair.publicKey, {
        name: 'New Test NGO',
      });
      
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.ngo.id, newNGOId);
    });

    it('should retrieve registered NGO public key', () => {
      const publicKey = getNGOPublicKey(testNGOId);
      assert.ok(publicKey);
      assert.deepStrictEqual(publicKey, testNGOKeyPair.publicKey);
    });

    it('should return null for unregistered NGO', () => {
      const publicKey = getNGOPublicKey('unregistered_ngo');
      assert.strictEqual(publicKey, null);
    });

    it('should list all registered NGOs', () => {
      const ngos = getRegisteredNGOs();
      assert.ok(Array.isArray(ngos));
      assert.ok(ngos.length >= 1);
      
      const ngoIds = ngos.map(ngo => ngo.id);
      assert.ok(ngoIds.includes(testNGOId));
    });
  });

  // ============================================================================
  // USER CONSENT TESTS
  // ============================================================================

  describe('User Consent Management', () => {
    it('should request user consent for NGO sharing', async () => {
      const result = await requestUserConsent(
        testUserId,
        [testNGOId],
        ['chat_transcripts'],
        ['improve_ai_responses'],
        Date.now() + 86400000 // 1 day from now
      );
      
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.userId, testUserId);
      assert.deepStrictEqual(result.ngoIds, [testNGOId]);
    });

    it('should check user consent status', () => {
      const consentStatus = checkUserConsent(testUserId, [testNGOId]);
      assert.strictEqual(consentStatus[testNGOId], true);
    });

    it('should get all NGOs user has consented to', () => {
      const consentedNGOs = getUserConsentedNGOs(testUserId);
      assert.ok(Array.isArray(consentedNGOs));
      assert.ok(consentedNGOs.includes(testNGOId));
    });

    it('should revoke user consent', async () => {
      const result = await revokeUserConsent(testUserId, [testNGOId]);
      assert.strictEqual(result.success, true);
      assert.deepStrictEqual(result.ngoIds, [testNGOId]);
      
      // Verify consent was revoked
      const consentStatus = checkUserConsent(testUserId, [testNGOId]);
      assert.strictEqual(consentStatus[testNGOId], false);
    });
  });

  // ============================================================================
  // DATA STORAGE TESTS
  // ============================================================================

  describe('Data Storage for NGO Collaboration', () => {
    it('should store interaction for NGO collaboration', async () => {
      // First, re-consent the user
      await requestUserConsent(
        testUserId,
        [testNGOId],
        ['chat_transcripts'],
        ['improve_ai_responses']
      );

      const interactionData = {
        prompt: 'What are my rights as a sex worker?',
        response: 'You have the right to safety and dignity.',
        modelVersion: 'iris-v2.1',
        timestamp: Date.now(),
        metadata: {
          tags: ['legal', 'rights'],
          language: 'en',
        },
      };

      const result = await storeInteractionForNGO(interactionData, {
        userId: testUserId,
        ngoIds: [testNGOId],
        tags: ['legal', 'rights'],
        userSecretKey: testUserKeyPair.secretKey,
      });

      assert.strictEqual(result.success, true);
      assert.ok(result.txId);
      assert.ok(result.ipfsCid);
      assert.ok(result.contentHash);
      assert.deepStrictEqual(result.ngoIds, [testNGOId]);
    });

    it('should fail to store without consent', async () => {
      // Revoke consent first
      await revokeUserConsent(testUserId, [testNGOId]);

      const interactionData = {
        prompt: 'Test prompt',
        response: 'Test response',
      };

      try {
        await storeInteractionForNGO(interactionData, {
          userId: testUserId,
          ngoIds: [testNGOId],
        });
        assert.fail('Should have thrown an error');
      } catch (error) {
        assert.ok(error.message.includes('not consented'));
      }
    });
  });

  // ============================================================================
  // IPFS TESTS (Mock Mode)
  // ============================================================================

  describe('IPFS Service (Mock Mode)', () => {
    it('should check if IPFS is available', () => {
      const available = isIPFSAvailable();
      // In test environment, this might be false
      assert.ok(typeof available === 'boolean');
    });

    it('should upload JSON to IPFS in mock mode', async () => {
      const data = { test: 'data', value: 123 };
      const result = await uploadJSONToIPFS(data);
      
      assert.ok(result.cid);
      assert.ok(result.cid.startsWith('mock-cid-'));
    });

    it('should download JSON from IPFS in mock mode', async () => {
      const cid = 'mock-cid-test123';
      const data = await downloadJSONFromIPFS(cid);
      
      assert.ok(data);
      assert.ok(data.mock);
    });
  });

  // ============================================================================
  // ARWEAVE TESTS (Mock Mode)
  // ============================================================================

  describe('Arweave Service (Mock Mode)', () => {
    it('should check if Arweave is available', () => {
      const available = isArweaveAvailable();
      assert.ok(typeof available === 'boolean');
    });

    it('should create NGO transaction in mock mode', async () => {
      const data = {
        ipfsCid: 'test-cid',
        metadataHash: 'sha256:test',
        accessControl: {
          allowedNGOs: [testNGOId],
        },
      };

      const result = await createNGOTransaction(data);
      assert.ok(result.txId);
      assert.ok(result.txId.startsWith('mock-arweave-'));
    });

    it('should get transaction data in mock mode', async () => {
      const txId = 'mock-arweave-123456';
      const result = await getTransactionData(txId);
      
      // In mock mode, this should return null or mock data
      assert.ok(result === null || result.txId === txId);
    });
  });

  // ============================================================================
  // NGO ENCRYPTION PACKAGE TESTS
  // ============================================================================

  describe('NGO Encryption Package', () => {
    it('should create and decrypt NGO encryption package', () => {
      const data = {
        prompt: 'Test prompt',
        response: 'Test response',
        metadata: { test: true },
      };

      const userKeyPair = generateKeyPair();
      const ngoKeyPair = generateKeyPair();

      const encryptionPackage = createNGOEncryptionPackage(data, {
        userKeyPair,
        ngoPublicKeys: {
          test_ngo: ngoKeyPair.publicKey,
        },
        tags: ['test'],
      });

      assert.ok(encryptionPackage.encryptedPackage);
      assert.ok(encryptionPackage.metadata);
      assert.ok(encryptionPackage.contentHash);

      // Decrypt with NGO key
      const decryptedData = decryptNGOEncryptionPackage(
        encryptionPackage,
        'test_ngo',
        ngoKeyPair.secretKey
      );

      assert.deepStrictEqual(decryptedData, data);
    });

    it('should create user ID from public key', () => {
      const userId = generateUserId(testUserKeyPair.publicKey);
      assert.ok(userId);
      assert.ok(userId.startsWith('user_'));
      assert.strictEqual(userId.length, 21); // 'user_' + 16 hex chars
    });
  });

  // ============================================================================
  // STATISTICS TESTS
  // ============================================================================

  describe('Statistics and Status', () => {
    it('should get NGO collaboration stats', () => {
      const stats = getNGOStats();
      assert.ok(stats);
      assert.ok(typeof stats.available === 'boolean');
      assert.ok(typeof stats.registeredNGOs === 'number');
      assert.ok(typeof stats.userConsentCount === 'number');
      assert.ok(typeof stats.totalAccessLogs === 'number');
    });

    it('should check NGO collaboration availability', () => {
      const available = isNGOCollaborationAvailable();
      assert.ok(typeof available === 'boolean');
    });
  });
});

// ============================================================================
// RUN TESTS
// ============================================================================

// Run the tests
console.log('Running NGO Collaboration PoC Tests...\n');

// Note: In a real test runner, we would use:
// node --test tests/ngoCollaboration.test.js

// For manual testing, we can run individual test functions
async function runTests() {
  try {
    // Run a simple test
    const key = generateSymmetricKey();
    const plaintext = 'Test message';
    const encrypted = encryptStringSymmetric(plaintext, key);
    const decrypted = decryptStringSymmetric(encrypted, key);
    
    if (decrypted === plaintext) {
      console.log('✅ Basic encryption test passed');
    } else {
      console.log('❌ Basic encryption test failed');
    }

    // Test NGO registration
    const ngoId = 'manual_test_ngo';
    const ngoKeyPair = generateKeyPair();
    const ngoResult = registerNGO(ngoId, ngoKeyPair.publicKey);
    
    if (ngoResult.success) {
      console.log('✅ NGO registration test passed');
    } else {
      console.log('❌ NGO registration test failed');
    }

    // Test user consent
    const userId = 'manual_test_user';
    const consentResult = await requestUserConsent(
      userId,
      [ngoId],
      ['chat_transcripts'],
      ['improve_ai_responses']
    );
    
    if (consentResult.success) {
      console.log('✅ User consent test passed');
    } else {
      console.log('❌ User consent test failed');
    }

    // Test data storage
    const interactionData = {
      prompt: 'Test prompt',
      response: 'Test response',
    };
    
    const storageResult = await storeInteractionForNGO(interactionData, {
      userId,
      ngoIds: [ngoId],
      tags: ['test'],
    });
    
    if (storageResult.success) {
      console.log('✅ Data storage test passed');
      console.log(`   TX ID: ${storageResult.txId}`);
      console.log(`   IPFS CID: ${storageResult.ipfsCid}`);
    } else {
      console.log('❌ Data storage test failed');
    }

    console.log('\n✅ All manual tests completed!');
  } catch (error) {
    console.error('❌ Test error:', error);
  }
}

// Uncomment to run manual tests
// runTests();

export default {};
