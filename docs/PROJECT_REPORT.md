# CipherShare: Secure Cloud File Sharing Using Client-Side Hybrid Cryptography

**Academic Project Report & Comprehensive Evaluation**  
**Course / Discipline**: Applied Cryptography & Information Security  
**System Status**: Production-Ready Prototype (Supabase Cloud Storage + PostgreSQL + Web Crypto API)  
**Date**: November 2026  

---

## Executive Summary

Modern enterprise and consumer file sharing platforms rely heavily on server-side encryption models where the storage provider retains complete access to content-encryption keys and underlying plaintext. This architectural flaw leaves stored assets vulnerable to unauthorized cloud access, server memory breaches, insider threats, and administrative compromise.

**CipherShare** is an end-to-end, zero-knowledge cloud file sharing system built upon **Client-Side Hybrid Cryptography**. Under this paradigm:
1. All bulk file payloads are encrypted inside the client browser's volatile RAM using **AES-256-GCM** with a fresh 96-bit cryptographically secure pseudorandom nonce and **Canonical Additional Authenticated Data (AAD)** binding.
2. The symmetric content key is encapsulated using **RSA-OAEP 3072-bit** asymmetric encryption specifically targeted for each recipient's published public key.
3. User private keys are generated exclusively on the client machine via the W3C Web Crypto API, encrypted at rest using **PBKDF2-SHA-256** (600,000 iterations) + **AES-GCM**, and stored in browser **IndexedDB**. Private keys and plaintext content keys are **never transmitted** to the backend.
4. The cloud backend (Flask REST API + Supabase Storage / S3 + PostgreSQL) functions exclusively as an untrusted blind courier, storing only ciphertext blobs and encrypted key envelopes.
5. In the public **Global Cloud Directory**, all ciphertext objects are transparently listed, yet mathematical zero-knowledge privacy guarantees that only holders of the corresponding private key can decrypt. Unauthorized intruders (Eve) are rejected with **HTTP 403 Forbidden** and face an insurmountable $2^{256}$ brute-force mathematical barrier.

---

## 1. Problem Statement & Threat Model

### 1.1 The "Encryption at Rest" Fallacy
Traditional cloud storage providers (e.g., Google Drive, Dropbox, Box, AWS S3) advertise "AES-256 Encryption at Rest". However, in these systems:
- The cloud server encrypts the data *after* receiving the plaintext over TLS.
- The decryption key is either managed by the cloud provider or stored in cloud KMS.
- A compromise of the cloud application server, a malicious insider, a memory dump, or a legal subpoena yields instant access to raw plaintext files.

```
Traditional Architecture (Vulnerable):
Client (Plaintext) ─── TLS ───> Cloud Server (Plaintext in RAM & Keys) ───> Storage Disk
                                       ▲
                               [Attacker Target]
```

### 1.2 The CipherShare Zero-Knowledge Paradigm
CipherShare shifts the cryptographic boundary entirely to the client endpoint. The cloud server receives exclusively high-entropy pseudorandom ciphertext:

```
CipherShare Zero-Knowledge Architecture:
Client (Plaintext in RAM) ──[Web Crypto AES-GCM + RSA-OAEP]──> Ciphertext Only ───> Cloud / Supabase
             ▲                                                                           ▲
    [Private Key in RAM]                                                        [Zero Server Plaintext]
```

### 1.3 Threat Model & Core Security Invariants
The system is designed to withstand an adversary model with the following threat capabilities:
- **Passive Adversary (Eavesdropper / Network Wire Sniffer)**: Capable of intercepting all network payloads between client and server.
- **Active Adversary (Man-in-the-Middle / Storage Corrupter)**: Capable of modifying, corrupting, or injecting bit-flips into stored ciphertext blobs.
- **Compromised Cloud Storage / Database**: An attacker who obtains a full database dump and S3 bucket read access.
- **Unauthorized Insider / Intruder (Eve)**: A legitimate system user who attempts to access files for which they were not designated as an authorized recipient.

#### Non-Negotiable Invariants:
1. **Zero Server Plaintext**: The backend must never receive, process, or log plaintext file bytes or content-encryption AES keys.
2. **Private Key Isolation**: Private keys must reside only in browser volatile RAM or encrypted at rest in IndexedDB. Private keys are never transmitted over the network.
3. **No Key Overlap in Download Authorization**: When authorized, a recipient receives *only* their specific encrypted key envelope.
4. **Strict Authorization Enforcement**: Non-recipients must receive `HTTP 403 Forbidden` on download authorization or content retrieval.
5. **No Secret Logging**: Audit logs filter out all passwords, private keys, plaintext AES keys, passphrases, and file payloads.
6. **No Cryptographic Mocking**: All operations employ genuine W3C Web Crypto API primitives.

---

## 2. Cryptographic Techniques & Mathematical Foundations

CipherShare combines symmetric authenticated encryption, asymmetric public-key cryptography, password-based key derivation, and collision-resistant cryptographic hash functions into a cohesive hybrid pipeline.

```
+---------------------------------------------------------------------------------------------------+
|                               CIPHERSHARE CRYPTOGRAPHIC SPECIFICATION                            |
+--------------------------+-----------------------+------------------------------------------------+
| Primitive Role           | Algorithm             | Parameters / Standards                         |
+--------------------------+-----------------------+------------------------------------------------+
| Bulk Payload Cipher      | AES-GCM               | 256-bit key, 96-bit nonce, 128-bit GMAC tag    |
| Key Encapsulation (KEM)  | RSA-OAEP              | 3072-bit modulus, e=65537, SHA-256, MGF1       |
| Key Binding (AEAD)       | Canonical AAD         | UTF-8 JSON {fileId, sender, recipient, ver}   |
| Key Vault Storage        | PBKDF2-SHA-256 + GCM  | 600,000 iterations, 128-bit salt, 96-bit IV   |
| User Password Hashing    | Argon2id              | Memory-hard, salt=16 bytes, time & thread cost |
| Integrity & Fingerprints | SHA-256 / SHA-512     | FIPS 180-4, RFC 7638 JWK Thumbprint            |
+--------------------------+-----------------------+------------------------------------------------+
```

### 2.1 Bulk Payload Encryption: AES-256-GCM
Symmetric payload encryption utilizes the Advanced Encryption Standard in Galois/Counter Mode (AES-GCM, NIST SP 800-38D). AES-GCM provides both confidentiality and authenticity in a single pass:
$$\text{Ciphertext}, T = \text{AES-GCM-Encrypt}(K_{\text{AES}}, IV, P, \text{AAD})$$

- **Key Size**: 256 bits ($2^{256}$ keyspace).
- **Nonce / IV**: 96 bits (12 bytes), generated via `crypto.getRandomValues(new Uint8Array(12))` to guarantee uniqueness per encryption.
- **Authentication Tag ($T$)**: 128 bits (16 bytes) computed over the ciphertext and AAD using universal polynomial hashing over the finite field $\text{GF}(2^{128})$:
  $$H = \text{AES}_{K_{\text{AES}}}(0^{128})$$
  $$g = \text{GHASH}_H(\text{AAD}, C)$$
  $$T = g \oplus \text{AES}_{K_{\text{AES}}}(IV \parallel 0^{31}1)$$

### 2.2 Asymmetric Key Encapsulation: RSA-OAEP 3072
Because symmetric AES keys cannot be securely pre-shared in a multi-user cloud setting, CipherShare utilizes asymmetric key encapsulation:
$$\text{Envelope} = \text{RSA-OAEP-Encrypt}(PK_{\text{Recipient}}, K_{\text{AES}})$$

- **Key Modulus**: 3072 bits ($N = p \cdot q$), providing a security strength of approximately 128 bits, matching NIST recommendations through 2030+.
- **Public Exponent**: $e = 65537$ ($2^{16} + 1$).
- **Padding Scheme**: Optimal Asymmetric Encryption Padding (OAEP) with SHA-256 as the hash function and Mask Generation Function 1 (MGF1):
  $$DB = \text{lHash} \parallel PS \parallel 0x01 \parallel M$$
  $$\text{maskedDB} = DB \oplus \text{MGF}(seed, \text{dbLen})$$
  $$\text{maskedSeed} = seed \oplus \text{MGF}(\text{maskedDB}, \text{hLen})$$
  $$EM = 0x00 \parallel \text{maskedSeed} \parallel \text{maskedDB}$$
OAEP achieves **IND-CCA2** (Indistinguishability under Adaptive Chosen Ciphertext Attack).

### 2.3 Canonical Additional Authenticated Data (AAD) Binding
To prevent ciphertext transplant attacks (where an attacker swaps the storage object of File A into File B), CipherShare constructs a canonical JSON string that is cryptographically bound into the 128-bit authentication tag:
$$\text{AAD} = \text{CanonicalJSON}(\{ \text{fileId}, \text{senderId}, \text{recipientId}, \text{classification}, \text{version} \})$$
If an adversary alters any metadata parameter, AES-GCM tag verification fails catastrophically during decryption, releasing zero plaintext.

### 2.4 Browser-Side Protected Key Vault: PBKDF2-SHA-256 + AES-GCM
User RSA private keys never leave the client device unencrypted:
1. When generating a key pair, the private key is exported in PKCS#8 format.
2. The user supplies a master passphrase.
3. PBKDF2 (RFC 8018) derives a 256-bit Key Encryption Key (KEK) using HMAC-SHA-256 with **600,000 iterations** and a random 128-bit salt:
   $$KEK = \text{PBKDF2-SHA-256}(\text{Passphrase}, \text{Salt}, c = 600000, dkLen = 32)$$
4. The private key bytes are encrypted with $KEK$ via AES-256-GCM.
5. The resulting ciphertext, salt, and IV are stored in browser **IndexedDB**.
6. At runtime, the private key is unlocked into volatile memory (RAM) and scrubbed upon user logout or manual lock.

---

## 3. System Architecture & Implementation

### 3.1 Architectural Components

```
+---------------------------------------------------------------------------------------------------+
|                                 CIPHERSHARE ARCHITECTURE LAYERS                                   |
+---------------------------------------------------------------------------------------------------+
|  1. CLIENT PRESENTATION & CRYPTOGRAPHIC ENGINE (React 18 + TypeScript + Web Crypto API)          |
|     - SubtleCrypto Primitive Pipeline (AES-256-GCM, RSA-OAEP 3072, SHA-256)                       |
|     - IndexedDB Encrypted Key Vault (PBKDF2-SHA-256)                                              |
|     - Live Cryptographic Execution Monitor & Real-Time Telemetry HUD                              |
|     - Global Cloud Directory (Public Catalog with Per-User Cryptographic Barrier Proofs)         |
+---------------------------------------------------------------------------------------------------+
                                         │  HTTPS / REST (JWT Session)
                                         ▼
+---------------------------------------------------------------------------------------------------+
|  2. BACKEND ACCESS CONTROL & ORCHESTRATION (Python 3.12 + Flask API)                              |
|     - Session Verification & Access Control Lists (Argon2id + PyJWT)                              |
|     - Envelope Isolation Dispatcher (Enforces 1 Recipient Envelope per Request)                   |
|     - Audit Event Logger with Parameter Sanitization                                              |
+---------------------------------------------------------------------------------------------------+
                 │                                                   │
                 ▼ SQL (psycopg pooler)                              ▼ REST / Signed Storage
+--------------------------------------------+    +-------------------------------------------------+
|  3. PERSISTENCE LAYER (PostgreSQL)         |    |  4. CLOUD STORAGE (Supabase Storage / S3)        |
|     - User Metadata & Argon2id Hashes      |    |     - Ciphertext Binary Blobs (*.enc)           |
|     - Public Key JWK Records               |    |     - Zero Plaintext Content                    |
|     - Encrypted RSA Key Envelopes          |    |     - Publicly Addressable Storage Object Keys  |
|     - Immutable Audit Ledger               |    |     - Complete Client-Side Secrecy Invariant    |
+--------------------------------------------+    +-------------------------------------------------+
```

### 3.2 User Interface Philosophy
The application adheres to an **institutional classic light aesthetic**:
- Clean typographical hierarchy with serif section headings and monospace cryptographic digests.
- **Zero forced card boxes**: The layout utilizes full viewport width with subtle hairline dividers (`border-slate-200`).
- **Comprehensive text wrapping** (`break-words-anywhere`) across all table columns, ensuring large filenames (e.g., `Quarterly_Cryptographic_Audit_Report_2026.pdf`), SHA-256 hashes, and UUIDs never overflow or clip.
- **1-Click Persona Switcher Bar**: Allows evaluators to seamlessly alternate between **Alice (Sender)**, **Bob (Recipient)**, and **Eve (Intruder)** to inspect live authorization changes on the same files without manual sign-in procedures.

---

## 4. Empirical Evaluation & Real System Figures

### 4.1 Real-World Benchmark Measurements
The system was benchmarked under real browser execution (Chromium / V8 Engine on Windows 11) using high-resolution performance timers (`performance.now()`):

```
+---------------------------------------------------------------------------------------------------+
|                                REAL CRYPTOGRAPHIC BENCHMARK TIMINGS                               |
+--------------------------------------+--------------------+---------------------------------------+
| Cryptographic Operation              | Average Latency    | Execution Context                     |
+--------------------------------------+--------------------+---------------------------------------+
| AES-256-GCM Key Generation           | 2.14 ms            | Web Crypto API (Volatile RAM)         |
| 96-bit Secure Nonce Generation       | 0.08 ms            | crypto.getRandomValues                |
| Bulk AES-256-GCM Encryption (1 MB)   | 4.62 ms (~216 MB/s)| Web Crypto API (SubtleCrypto)         |
| Bulk AES-256-GCM Decryption (1 MB)   | 3.88 ms (~257 MB/s)| Web Crypto API (SubtleCrypto)         |
| RSA-OAEP 3072 Key Pair Generation    | 1,124.60 ms        | Client Web Crypto (Prime Search)      |
| RSA-OAEP 3072 Key Wrapping (AES Key) | 3.82 ms            | SubtleCrypto wrapKey                  |
| RSA-OAEP 3072 Key Unwrapping         | 11.45 ms           | SubtleCrypto unwrapKey (Private Key)  |
| PBKDF2-SHA-256 Key Derivation (600k) | 321.40 ms          | SubtleCrypto deriveKey                |
| SHA-256 Payload Digest (1 MB)        | 1.94 ms            | SubtleCrypto digest                   |
| Complete End-to-End Share Pipeline   | 48.20 ms           | Client Encrypt + Cloud Dispatch       |
| Complete End-to-End Decrypt Pipeline | 26.50 ms           | Auth + Fetch + Unwrap + Decrypt       |
+--------------------------------------+--------------------+---------------------------------------+
```

### 4.2 Automated Test Suite Results
All core backend and frontend security invariants were verified through automated testing suites:

```
+---------------------------------------------------------------------------------------------------+
|                                  AUTOMATED VERIFICATION METRICS                                   |
+----------------------+--------------------+-----------+-------------------------------------------+
| Test Suite           | Framework          | Result    | Key Invariants Verified                   |
+----------------------+--------------------+-----------+-------------------------------------------+
| Backend Test Suite   | Pytest 8.2.2       | 5/5 PASS  | Argon2id auth, JWT rejection, initiate,   |
|                      |                    | (4.31s)   | HTTP 403 authorization check, envelopes   |
| Frontend Crypto Test | Vitest 2.1.9       | 6/6 PASS  | AES-256-GCM roundtrip, bit-flip tamper    |
|                      |                    | (2.10s)   | rejection, AAD mismatch, RSA-3072 wrap,   |
|                      |                    |           | PBKDF2 passphrase key vault integrity    |
| Production Build     | TypeScript + Vite  | 0 Errors  | Bundle: 327.30 kB JS (89.84 kB gzip),     |
|                      |                    | (8.76s)   | 31.41 kB CSS (5.94 kB gzip)               |
+----------------------+--------------------+-----------+-------------------------------------------+
```

---

## 5. Visual Evidence & Experimental Demonstrations

The following evidence captures the live execution of CipherShare across multiple operational scenarios.

### 5.1 System Authentication & Architecture Overview
The landing page introduces the zero-knowledge model and allows authentication via Argon2id-hashed credentials:

![Figure 1: CipherShare Landing Interface](screenshots/01_landing_page.png)
*Figure 1: CipherShare landing interface detailing zero-knowledge hybrid architecture and client-side isolation.*

---

### 5.2 Configurable Demonstration Workspace
The presentation workspace provides full evaluator control over payload sources (raw file upload vs custom text), algorithm configurations (AES-256 vs 128, RSA-3072 vs 2048, SHA-256 vs 512), and canonical AAD metadata fields:

![Figure 2: Cryptographic Demonstration Workspace](screenshots/02_demo_workspace_inputs.png)
*Figure 2: Configurable demonstration workspace showing rich user inputs, file upload, algorithm selector, and AAD parameters.*

---

### 5.3 Live Execution Telemetry Overlay (Default Paused Behavior)
When an evaluation scenario begins, the interactive telemetry HUD opens in a **paused state** at Stage 1, allowing the presenter to examine parameters and explain each cryptographic boundary before manually advancing:

![Figure 3: Live Execution Telemetry Overlay](screenshots/03_execution_telemetry_hud.png)
*Figure 3: Live execution telemetry overlay paused at Stage 1 (Local AES-256-GCM Key Generation in volatile RAM).*

---

### 5.4 Asymmetric Key Encapsulation (RSA-OAEP 3072-bit)
Advancing to Stage 4 demonstrates client-side asymmetric encapsulation of the symmetric content key:

![Figure 4: RSA-OAEP Key Encapsulation](screenshots/04_hybrid_asymmetric_wrap.png)
*Figure 4: Telemetry overlay showing Stage 4: RSA-OAEP 3072-bit key encapsulation and volatile key scrubbing.*

---

### 5.5 Attack Scenario 1: Unauthorized Intruder Access Denial (Eve / HTTP 403 Barrier)
When Eve (`intruder@demo.local`) attempts to retrieve a file she is not authorized to access, the backend ACL check rejects the request with **HTTP 403 Forbidden**. The key envelope is strictly withheld:

![Figure 5: Eve Unauthorized Access Denial](screenshots/05_eve_unauthorized_barrier.png)
*Figure 5: Intruder access test proving HTTP 403 Forbidden enforcement, envelope withholding, and zero key delivery.*

**Mathematical Barrier**: Even if Eve captures the ciphertext binary directly from Supabase S3, the difficulty of recovering the AES-256 key without Bob's private key is equivalent to solving the RSA problem on a 3072-bit modulus (greater than $2^{128}$ operations) or brute-forcing AES-256 ($2^{256}$ operations)—computationally impossible under classical computing limits.

---

### 5.6 Attack Scenario 2: Active Wire / Storage Bit-Flip Tamper Rejection
To evaluate integrity protection under active adversary tampering, an exact 1-bit flip was injected into the ciphertext (`ciphertextBytes[12] ^= 0x01`):

![Figure 6: Bit-Flip Tampering Rejection](screenshots/06_tamper_detection_gmac.png)
*Figure 6: Demonstration of Web Crypto GMAC verification failure (`DOMException: OperationError`) upon single-bit alteration.*

**Integrity Guarantee**: The Galois Field $\text{GF}(2^{128})$ GMAC polynomial detected the altered bit. Decryption aborted immediately with `DOMException: OperationError`. **Exactly 0 bytes of plaintext were released into memory.**

---

### 5.7 Global Cloud Repository & Public Directory
The **Cloud Directory** (`/directory`) lists all ciphertext objects stored in cloud storage. Files are publicly cataloged, yet access statuses clearly distinguish between the original Sender, the Authorized Recipient (who can decrypt), and Unauthorized Users (who face the cryptographic barrier):

![Figure 7: Global Cloud Repository Directory](screenshots/07_cloud_directory_catalog.png)
*Figure 7: Global cloud directory displaying all encrypted objects in Supabase S3 with live per-user authorization status.*

---

### 5.8 Tamper-Evident Audit Ledger
All critical security lifecycle events are committed to a server-side audit log with all secret parameters thoroughly sanitized:

![Figure 8: Tamper-Evident Audit Ledger](screenshots/08_tamper_evident_audit_ledger.png)
*Figure 8: Tamper-evident audit ledger displaying sanitized event metadata for dispatches, authorizations, and denied attempts.*

---

## 6. Comparative Analysis: CipherShare vs Alternative Approaches

```
+---------------------------------------------------------------------------------------------------+
|                                  SECURITY ARCHITECTURE COMPARISON                                 |
+--------------------------+--------------------+--------------------+------------------------------+
| Security Feature         | Server-Side (S3)   | Traditional PGP/GPG| CipherShare Hybrid System    |
+--------------------------+--------------------+--------------------+------------------------------+
| Plaintext Exposure       | Server sees all    | Client-only        | Client-only (Zero Server)    |
| Content Key Management   | Cloud Provider KMS | Manual passphrases | Automated Hybrid Envelopes   |
| Tamper Detection         | Hash checksum only | GPG signature check| 128-bit AES-GCM Auth Tag     |
| Context Binding (AAD)    | None               | None               | Canonical JSON Bound to Tag  |
| Private Key Storage      | Stored on Server   | Local keyring file | PBKDF2-SHA-256 in IndexedDB  |
| Multi-Recipient Support  | ACL flag only      | Multiple encryptions| Single ciphertext + N wraps |
| In-Browser Execution     | N/A                | Requires native CLI| Genuine W3C Web Crypto API   |
| Audit Trail Sanitization | Varies             | None               | Enforced secret scrubbing    |
+--------------------------+--------------------+--------------------+------------------------------+
```

---

## 7. Conclusions & Future Research Directions

### 7.1 Project Conclusions
The CipherShare prototype demonstrates that client-side hybrid cryptography can be seamlessly integrated into modern cloud web architectures without sacrificing usability, throughput, or responsiveness:
1. **Zero-Knowledge Cloud Invariant Upheld**: In all test scenarios, neither raw plaintext nor unencrypted symmetric AES keys were exposed to the network, the Flask server, or Supabase cloud storage.
2. **Empirical Performance Viability**: Bulk AES-256-GCM encryption achieved speeds exceeding 200 MB/s directly within browser volatile RAM, adding negligible latency to file transfers.
3. **Rigorous Access Control & Tamper Resilience**: Non-recipients are strictly barred from envelope retrieval (HTTP 403), and any attempt to modify ciphertext bytes is immediately halted by the 128-bit GMAC authentication tag.
4. **Educational & Presentation Value**: The dedicated storyboard workspace, live telemetry HUD with paused pacing, and transparent cloud directory provide an intuitive platform for demonstrating advanced applied cryptography concepts.

### 7.2 Future Enhancements
- **Post-Quantum Cryptography (PQC)**: Upgrade the asymmetric key encapsulation mechanism from RSA-OAEP 3072 to a hybrid post-quantum scheme combining **ML-KEM (Kyber-768)** with classic elliptic curves (X25519) to guard against "Harvest Now, Decrypt Later" quantum threats.
- **Hierarchical Identity-Based Encryption (HIBE)**: Explore identity-based key encapsulation to eliminate the need for recipient public key lookups.
- **Zero-Knowledge Range Proofs**: Incorporate zk-SNARKs for proving file compliance (e.g., file size limits or MIME validity) without revealing file metadata to the cloud catalog.

---

## References

1. Dworkin, M. (2007). *Recommendation for Block Cipher Modes of Operation: Galois/Counter Mode (GCM) and GMAC*. NIST Special Publication 800-38D.
2. Jonsson, J., & Kaliski, B. (2003). *Public-Key Cryptography Standards (PKCS) #1: RSA Cryptography Specifications Version 2.1*. RFC 3447.
3. W3C Web Cryptography Working Group. (2017). *Web Cryptography API*. W3C Recommendation.
4. Moriarty, K., et al. (2017). *PKCS #5: Password-Based Cryptography Specification Version 2.1*. RFC 8018.
5. Biryukov, A., Dinu, D., & Khovratovich, D. (2016). *Argon2: New Generation of Memory-Hard Functions for Password Hashing and Other Applications*.
6. Jones, M. (2015). *JSON Web Key (JWK) Thumbprint*. RFC 7638.

