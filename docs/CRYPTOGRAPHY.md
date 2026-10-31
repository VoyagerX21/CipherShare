# CipherShare Cryptographic Specification & Threat Model

## 1. Hybrid Cryptography Model

CipherShare implements **hybrid encryption**, combining the efficiency of symmetric ciphers with the key distribution strengths of asymmetric cryptography:

1. **Payload Encryption (AES-256-GCM)**: High-performance authenticated symmetric encryption encrypts the bulk file once.
2. **Key Encapsulation (RSA-OAEP 3072)**: The 256-bit symmetric AES key is wrapped separately for each intended recipient using that recipient's 3072-bit RSA public key.

---

## 2. Primitives and Parameters

| Component | Primitive | Parameters / Standard | Purpose |
| :--- | :--- | :--- | :--- |
| **Payload Encryption** | AES-GCM | 256-bit key, 128-bit authentication tag | Authenticated file confidentiality & integrity |
| **Symmetric Nonce** | Random IV | 96 bits (12 bytes), fresh per file | Guarantees uniqueness for AES-GCM counter mode |
| **Asymmetric Keys** | RSA-OAEP | 3072-bit modulus, $e = 65537$, SHA-256 | Multi-recipient key encapsulation |
| **Key Derivation (KDF)** | PBKDF2 | SHA-256, 600,000 iterations, 16-byte salt | Protects private key backup in IndexedDB |
| **Local Key Vault** | AES-GCM | 256-bit derived key, 12-byte IV, 128-bit tag | Encrypts exported PKCS#8 private key at rest |
| **Integrity / Fingerprint** | SHA-256 | RFC 7638 JWK Thumbprint & 256-bit digest | Public key fingerprinting and audit verification |
| **Password Hashing** | Argon2id | RFC 9106 recommended parameters | Backend account credential hashing |

---

## 3. Additional Authenticated Data (AAD)

AES-256-GCM accepts Additional Authenticated Data (AAD) that is authenticated by the 128-bit GCM tag without being encrypted. CipherShare constructs canonical JSON byte sequences:

```json
{"fileId":"uuid-string","senderId":"uuid-string","version":"1.0"}
```

### Security Benefits
- **Ciphertext Rebinding Prevention**: An attacker cannot take valid ciphertext from one file record and reassign it to another file or sender.
- **Protocol Downgrade Defense**: The version string prevents protocol downgrade attacks.

---

## 4. Key Lifecycle & Browser Isolation

1. **Generation**: Generated client-side via `crypto.subtle.generateKey`.
2. **Public Key Publication**: Exported as JSON Web Key (JWK) and sent to Flask backend.
3. **Private Key Protection**:
   - Exported as PKCS#8 `ArrayBuffer`.
   - Encrypted with AES-256-GCM under a key derived from a user passphrase using PBKDF2-SHA-256 (600,000 iterations).
   - Stored in browser `IndexedDB`.
   - **Never sent to the server or cloud storage**.
4. **Session RAM Retention**: Unlocked in volatile JavaScript memory only upon entering the passphrase, cleared upon browser refresh, logout, or explicit locking.

---

## 5. Threat Model

### Protected Assets
- Plaintext file contents.
- Content-encryption symmetric keys (AES-256).
- User private keys.
- User account authentication credentials.
- File recipient association privacy.

### Mitigated Threats
- **Compromised Storage / Snooping Cloud Provider**: Cloud sees only encrypted blobs. Cannot decrypt without recipient private key.
- **Unauthorized Authenticated User (Intruder)**: Backend enforces strict recipient checks (HTTP 403). Even if ciphertext is obtained, decryption fails mathematically.
- **Ciphertext Tampering in Transit or at Rest**: AES-GCM 128-bit authentication tag detects any single bit modification and halts decryption.
- **Metadata Rebinding**: Canonical AAD binds immutable metadata to the ciphertext.
- **Stolen Database Credentials**: Passwords hashed with Argon2id; database holds only wrapped key envelopes, not plaintext keys.

### Known Limitations & Assumptions
- **Endpoint Security**: A compromised recipient computer (e.g. keylogger, browser malware) can capture plaintext in memory after decryption.
- **Metadata Visibility**: File sizes, upload timestamps, and sender/recipient identity IDs are visible to the server database.
- **Private Key Loss**: If a user clears their browser's IndexedDB without an exported backup, they cannot recover files sent to them.
- **Trust-on-First-Use (TOFU) for Public Keys**: A compromised server could attempt to substitute a public key. Users should verify public key fingerprints out-of-band.
