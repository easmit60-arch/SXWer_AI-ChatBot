# NGO Collaboration Blockchain PoC - README

## Overview

This **Proof of Concept (PoC)** demonstrates **blockchain-based NGO collaboration** for the SXWer AI ChatBot, enabling **secure, auditable, and consent-based data sharing** between sex worker advocacy organizations (e.g., AAIR, SWOP) using:

- **Arweave**: Permanent, low-cost on-chain storage for metadata and hashes
- **IPFS**: Decentralized off-chain storage for encrypted data
- **Hybrid Encryption**: Client-side encryption with user-controlled keys

---

## 🚀 Quick Start

### Prerequisites

1. **Node.js 18+** (required for ES modules)
2. **npm** (for package management)
3. **Git** (for version control)

### Installation

```bash
# Clone the repository (if not already cloned)
git clone https://github.com/easmit60-arch/SXWer_AI-ChatBot.git
cd SXWer_AI-ChatBot

# Install dependencies
npm install

# Install new dependencies for the PoC
npm install arweave ipfs-http-client
```

### Configuration

Copy the example environment file and update with your settings:

```bash
cp .env.example .env
```

Edit `.env` to enable blockchain and configure Arweave/IPFS:

```env
# Enable blockchain features
BLOCKCHAIN_ENABLED=true
BLOCKCHAIN_PROVIDER=arweave

# Arweave configuration
ARWEAVE_HOST=arweave.net
ARWEAVE_PORT=443
ARWEAVE_PROTOCOL=https
ARWEAVE_WALLET_PATH=./arweave-wallet.json

# IPFS configuration (Infura)
IPFS_HOST=ipfs.infura.io
IPFS_PORT=5001
IPFS_PROTOCOL=https
```

### Generate an Arweave Wallet

1. **Option A: Use Arweave CLI**
   ```bash
   npm install -g arweave
   arweave wallet generate
   ```
   Save the wallet file to `./arweave-wallet.json`

2. **Option B: Use Arweave Web App**
   - Visit [https://arweave.app](https://arweave.app)
   - Create a wallet
   - Export the wallet JSON file
   - Save to `./arweave-wallet.json`

3. **Option C: Use Mock Mode (for testing)**
   ```env
   BLOCKCHAIN_PROVIDER=mock
   ```
   No wallet needed for mock mode.

---

## 📁 Project Structure

```
services/
├── blockchain/
│   ├── arweaveService.js       # Arweave transaction handling
│   ├── ipfsService.js          # IPFS upload/download with encryption
│   ├── dataEncryption.js       # Client-side encryption utilities
│   └── ledgerConfig.js         # Configuration (updated with Arweave/IPFS)
│
├── ngo/
│   └── ngoCollaboration.js     # Main NGO collaboration service
│
├── blockchain/
│   └── consentLedger.js        # Existing consent ledger (extended)
│
public/
└── (UI files for NGO dashboard)

tests/
└── ngoCollaboration.test.js   # PoC tests

docs/
├── NGO_COLLABORATION_BLOCKCHAIN_SPEC.md  # Technical specification
├── USE_CASE_NGO_COLLABORATION.md        # Use case deep dive
└── POC_README.md                        # This file
```

---

## 🎯 Key Features

### 1. NGO Registration

Register NGOs with their public keys for secure data sharing:

```javascript
import { registerNGO, getNGOPublicKey } from './services/ngo/ngoCollaboration.js';

// Register an NGO
const ngoKeyPair = generateKeyPair(); // From dataEncryption.js
await registerNGO('aair', ngoKeyPair.publicKey, {
  name: 'AAIR (Arizona Advocacy & Resource)',
  description: 'Sex worker advocacy organization',
});

// Get NGO's public key
const publicKey = getNGOPublicKey('aair');
```

### 2. User Consent Management

Request and manage user consent for NGO data sharing:

```javascript
import { requestUserConsent, revokeUserConsent } from './services/ngo/ngoCollaboration.js';

// Request consent
const consentResult = await requestUserConsent(
  'user_123',
  ['aair', 'swop'], // NGOs to share with
  ['chat_transcripts', 'feedback'], // Data types
  ['improve_ai_responses', 'audit_advice_quality'], // Purposes
  Date.now() + 365 * 24 * 60 * 60 * 1000 // 1 year expiry
);

// Revoke consent
const revokeResult = await revokeUserConsent('user_123', ['aair']);
```

### 3. Data Storage

Store AI interactions for NGO collaboration:

```javascript
import { storeInteractionForNGO } from './services/ngo/ngoCollaboration.js';

const interactionData = {
  prompt: "What are my rights as a sex worker in California?",
  response: "In California, you have the right to...",
  modelVersion: "iris-v2.1",
  timestamp: Date.now(),
  metadata: {
    tags: ["legal", "california", "rights"],
    language: "en",
    confidence: 0.95,
  },
};

const storageResult = await storeInteractionForNGO(interactionData, {
  userId: 'user_123',
  ngoIds: ['aair', 'swop'],
  tags: ['legal', 'california', 'rights'],
  expiry: Date.now() + 365 * 24 * 60 * 60 * 1000, // 1 year
});

console.log(`Stored! TX ID: ${storageResult.txId}, IPFS CID: ${storageResult.ipfsCid}`);
```

### 4. Data Querying

Query and retrieve data as an authorized NGO:

```javascript
import { queryNGOData, getNGOTransactionData } from './services/ngo/ngoCollaboration.js';

// Query for legal advice chats
const queryResult = await queryNGOData({
  ngoId: 'aair',
  tags: ['legal', 'california'],
  dateRange: {
    start: Date.now() - 30 * 24 * 60 * 60 * 1000, // Last 30 days
    end: Date.now(),
  },
  limit: 100,
});

// Get specific transaction data
for (const result of queryResult.results) {
  const txData = await getNGOTransactionData(
    result.txId,
    'aair',
    ngoSecretKey // NGO's secret key for decryption
  );
  
  console.log('Decrypted data:', txData.data);
}
```

### 5. Encryption

Client-side encryption with hybrid approach:

```javascript
import {
  createNGOEncryptionPackage,
  decryptNGOEncryptionPackage,
  generateKeyPair,
} from './services/blockchain/dataEncryption.js';

// User generates key pair
const userKeyPair = generateKeyPair();

// Create encrypted package
const encryptionPackage = createNGOEncryptionPackage(
  { prompt: "...", response: "..." },
  {
    userKeyPair,
    ngoPublicKeys: {
      aair: aairPublicKey,
      swop: swopPublicKey,
    },
    tags: ['legal', 'california'],
  }
);

// NGO decrypts with their secret key
aairDecryptedData = decryptNGOEncryptionPackage(
  encryptionPackage,
  'aair',
  aairSecretKey
);
```

---

## 🔧 Configuration Options

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `BLOCKCHAIN_ENABLED` | Enable blockchain features | `false` | No |
| `BLOCKCHAIN_PROVIDER` | Blockchain provider to use | `mock` | No |
| `ARWEAVE_HOST` | Arweave network host | `arweave.net` | No |
| `ARWEAVE_PORT` | Arweave network port | `443` | No |
| `ARWEAVE_PROTOCOL` | Arweave protocol | `https` | No |
| `ARWEAVE_WALLET_PATH` | Path to Arweave wallet JSON | `null` | Yes (for Arweave) |
| `IPFS_HOST` | IPFS gateway host | `ipfs.infura.io` | No |
| `IPFS_PORT` | IPFS gateway port | `5001` | No |
| `IPFS_PROTOCOL` | IPFS protocol | `https` | No |

### Supported Providers

- **`mock`**: In-memory testing (no network calls)
- **`arweave`**: Arweave for permanent storage
- **`ethereum`**: Ethereum-compatible chains (stub)
- **`polygon`**: Polygon network (stub)
- **`hyperledger`**: Hyperledger Fabric (stub)
- **`hedera`**: Hedera Hashgraph (stub)
- **`consortium`**: Generic consortium chain (stub)

---

## 🧪 Testing

### Run the Tests

```bash
# Run all tests
npm test

# Run specific test file
node --test tests/ngoCollaboration.test.js

# Run with coverage (requires additional setup)
npx nyc --reporter=text node --test tests/ngoCollaboration.test.js
```

### Mock Mode Testing

For testing without Arweave/IPFS:

```env
BLOCKCHAIN_ENABLED=true
BLOCKCHAIN_PROVIDER=mock
```

All operations will use in-memory mocks instead of real network calls.

---

## 📊 Data Flow

### Storing Data

```
1. User chats with Iris
   ↓
2. User consents to share with NGOs
   ↓
3. Data encrypted with hybrid encryption
   ↓
4. Encrypted data uploaded to IPFS → Returns CID
   ↓
5. Metadata + CID + hashes stored on Arweave → Returns TX ID
   ↓
6. Consent receipt stored on existing ledger
   ↓
7. User receives confirmation with TX ID and CID
```

### Querying Data

```
1. NGO queries Arweave for TXs matching tags/NGO ID
   ↓
2. Arweave returns matching TX IDs
   ↓
3. For each TX ID:
   a. Get TX data from Arweave
   b. Check access control (NGO is authorized)
   c. Download encrypted data from IPFS using CID
   d. Decrypt data with NGO's secret key
   ↓
4. NGO receives decrypted data
```

---

## 🔐 Security Features

### Encryption

- **Hybrid Encryption**: Data encrypted with symmetric key, symmetric key encrypted with each recipient's public key
- **X25519 Key Exchange**: Modern, secure key exchange algorithm
- **XSalsa20-Poly1305**: Authenticated encryption for data confidentiality and integrity
- **Client-Side Encryption**: All encryption happens in the browser/Node.js before upload

### Access Control

- **Explicit Consent**: Users must explicitly consent to share with each NGO
- **Granular Permissions**: Consent can be per-NGO, per-data-type, per-purpose
- **Time-Limited**: Consent can have expiry dates
- **Revocable**: Users can revoke consent at any time

### Data Minimization

- **On-Chain**: Only hashes, metadata, and access control rules (no PII)
- **Off-Chain**: Full data encrypted on IPFS
- **No Raw Data**: Never store unencrypted sensitive data

---

## 📈 Performance

### Cost Estimates

| Operation | Arweave Cost | IPFS Cost | Total |
|-----------|--------------|-----------|-------|
| Store 1 KB metadata | ~$0.0001 | Free | ~$0.0001 |
| Store 10 KB metadata | ~$0.001 | Free | ~$0.001 |
| IPFS upload (5 KB) | - | ~$0 | ~$0 |
| IPFS download (5 KB) | - | ~$0 | ~$0 |

**Monthly cost for 10,000 interactions**: ~$2.00

### Latency

| Operation | Expected Latency |
|-----------|-----------------|
| IPFS upload | 100-500 ms |
| IPFS download | 50-200 ms |
| Arweave TX submission | 5-30 seconds |
| Arweave TX confirmation | 1-2 minutes |
| Data decryption | < 10 ms |

---

## 🎓 Use Cases

### 1. Quality Assurance

NGOs can audit AI responses for:
- Accuracy of legal advice
- Trauma-informed care principles
- Bias and fairness
- Safety and harm reduction

### 2. Resource Improvement

NGOs can collaborate to:
- Identify common questions and gaps
- Create better resources
- Share insights across organizations
- Improve training data

### 3. Legal Compliance

Provide immutable audit trails for:
- Advice given to users
- Model versions and updates
- User consent history
- Data access logs

### 4. Research

Enable research on:
- Sex worker needs and concerns
- AI interaction patterns
- Resource effectiveness
- Community trends

---

## 🚨 Error Handling

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `NGO_NOT_REGISTERED` | NGO not registered | Register NGO with `registerNGO()` |
| `CONSENT_REQUIRED` | User hasn't consented | Request consent with `requestUserConsent()` |
| `CONSENT_REVOKED` | User revoked consent | Check consent status with `checkUserConsent()` |
| `ACCESS_DENIED` | NGO not authorized | Verify NGO is in allowed list |
| `DECRYPTION_FAILED` | Wrong key or corrupted data | Verify encryption keys |
| `IPFS_UNAVAILABLE` | IPFS node down | Use fallback or retry |
| `ARWEAVE_UNAVAILABLE` | Arweave node down | Use fallback or retry |

### Retry Logic

The system automatically retries failed operations:
- IPFS: 3 retries with exponential backoff
- Arweave: 5 retries with exponential backoff
- Fallback gateways for both IPFS and Arweave

---

## 📚 Documentation

- **[Technical Specification](NGO_COLLABORATION_BLOCKCHAIN_SPEC.md)**: Detailed architecture, data models, and implementation
- **[Use Case Deep Dive](USE_CASE_NGO_COLLABORATION.md)**: Explores specific use cases and scenarios
- **[This README](POC_README.md)**: Quick start and usage guide

---

## 🤝 Contributing

### Development Workflow

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/ngo-collaboration`
3. **Make your changes**
4. **Run tests**: `npm test`
5. **Commit changes**: `git commit -m 'Add NGO collaboration feature'`
6. **Push to branch**: `git push origin feature/ngo-collaboration`
7. **Open a Pull Request**

### Code Style

- Use **ES Modules** (`import`/`export`)
- Follow **existing code patterns** in the repository
- Add **JSDoc comments** for all functions
- Include **human rights design notes** in module headers
- Write **tests** for new functionality

### Security Considerations

- **Never commit secrets** (keys, passwords, etc.)
- **Use environment variables** for configuration
- **Validate all inputs**
- **Handle errors gracefully**
- **Clear sensitive data from memory** after use

---

## 📄 License

This project is licensed under the **MIT License** - see [LICENSE.txt](../LICENSE.txt) for details.

---

## 🙏 Acknowledgments

- **Arweave Team**: For permanent, low-cost data storage
- **IPFS Team**: For decentralized file storage
- **TweetNaCl Authors**: For secure cryptographic primitives
- **Sex Worker Advocacy Organizations**: For inspiration and requirements

---

## 📞 Support

For questions or issues:

1. **Check the documentation** in the `/docs` directory
2. **Review the tests** in `/tests` for usage examples
3. **Open an issue** on GitHub with details about your problem
4. **Join the community** discussions (link to be added)

---

## 🔮 Future Enhancements

### Short-Term (0-3 months)
- [ ] Add Arweave SmartWeave contracts for complex access control
- [ ] Implement proxy re-encryption for GDPR-compliant "right to be forgotten"
- [ ] Add zero-knowledge proofs for selective data disclosure
- [ ] Support multiple encryption schemes (AES-256-GCM, ChaCha20-Poly1305)

### Medium-Term (3-6 months)
- [ ] Add reputation system for NGOs
- [ ] Implement automated anomaly detection
- [ ] Add geographic restrictions for data access
- [ ] Support time-based access (e.g., "30 days after creation")

### Long-Term (6-12 months)
- [ ] Add cross-chain interoperability
- [ ] Implement decentralized identity (DID)
- [ ] Add token-based incentives for NGOs
- [ ] Support federated learning

---

## ✅ Checklist for Production

- [ ] Security audit of encryption implementation
- [ ] Performance testing with large datasets
- [ ] Cost analysis and optimization
- [ ] GDPR compliance review
- [ ] User testing and feedback
- [ ] Documentation updates
- [ ] Monitoring and alerting setup
- [ ] Backup and recovery procedures

---

**Built with ❤️ for sex worker advocacy and digital rights.**
