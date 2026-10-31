# CipherShare Architecture Specification

## 1. High-Level Component Architecture

CipherShare is designed with strict client-server separation to enforce the zero-knowledge security principle: **the cloud stores ciphertext, but never possesses plaintext or private keys**.

```mermaid
graph TD
    subgraph ClientBrowser ["Browser Client (Web Crypto API)"]
        UI["React + TypeScript UI"]
        SubtleCrypto["crypto.subtle (W3C Web Crypto)"]
        IndexedDB["IndexedDB (PBKDF2-Encrypted Private Key Vault)"]
        RAM["Volatile RAM (Ephemeral AES Key)"]
    end

    subgraph BackendGateway ["Flask Application Backend (Python 3.12)"]
        API["REST API Router (/api/v1)"]
        AuthSvc["Auth Service (Argon2id + JWT)"]
        AuditSvc["Audit Service (Scrubbed Metadata)"]
        StorageAdapter["Storage Service Abstraction"]
    end

    subgraph Persistence ["Persistence Layer"]
        DB[("PostgreSQL / SQLite Database")]
        Storage[("Private Object Storage (Local / Supabase)")]
    end

    UI --> SubtleCrypto
    SubtleCrypto --> IndexedDB
    SubtleCrypto --> RAM
    UI -->|JSON API (JWT Auth)| API
    API --> AuthSvc
    API --> AuditSvc
    API --> StorageAdapter
    API --> DB
    StorageAdapter --> Storage
    UI -->|Ciphertext Binary Upload/Download| StorageAdapter
```

---

## 2. Sequence Diagrams

### 2.1 Sender File Upload & Multi-Recipient Hybrid Encryption

```mermaid
sequenceDiagram
    autonumber
    actor Alice as Sender (Alice)
    participant Browser as Alice's Browser (WebCrypto)
    participant Flask as Flask Backend API
    participant Storage as Private Object Storage
    participant DB as Database (SQLAlchemy)

    Alice->>Browser: Selects file & recipient(s)
    Browser->>Flask: POST /api/v1/files/initiate (filename, size, recipient_ids)
    Flask->>DB: Verify recipients & retrieve registered RSA public keys
    Flask-->>Browser: Session created (file_id, recipient public keys, upload URL)
    
    Browser->>Browser: Generate fresh 256-bit AES key (crypto.subtle.generateKey)
    Browser->>Browser: Generate fresh 96-bit random Nonce (IV)
    Browser->>Browser: Construct canonical AAD: {"fileId":..., "senderId":..., "version":"1.0"}
    Browser->>Browser: Encrypt file with AES-256-GCM + 128-bit tag
    Browser->>Browser: Compute SHA-256 digest of original file & ciphertext
    
    loop For each recipient
        Browser->>Browser: Wrap AES key with recipient's RSA-OAEP 3072 public key
    end
    
    Browser->>Flask: POST /api/v1/files/{file_id}/upload (Binary Ciphertext)
    Flask->>Storage: Store ciphertext blob under random UUID key
    Flask-->>Browser: Storage confirmation & verified ciphertext SHA-256
    
    Browser->>Flask: POST /api/v1/files/{file_id}/complete (Nonce, AAD version, Envelopes)
    Flask->>DB: Save metadata, hash, and per-recipient encrypted key envelopes
    Flask->>DB: Record FILE_UPLOAD_COMPLETED audit event
    Flask-->>Browser: 200 OK (Share complete)
```

### 2.2 Recipient Download & Client-Side Decryption

```mermaid
sequenceDiagram
    autonumber
    actor Bob as Recipient (Bob)
    participant Browser as Bob's Browser (WebCrypto)
    participant Flask as Flask Backend API
    participant Storage as Private Object Storage

    Bob->>Browser: Clicks "Download & Decrypt"
    Browser->>Flask: POST /api/v1/files/{file_id}/download-authorize (Bearer Token)
    Flask->>Flask: Check authenticated user is an authorized recipient
    Flask-->>Browser: 200 OK (download_url, nonce, ONLY Bob's wrapped AES envelope, AAD metadata)
    
    Browser->>Storage: GET /api/v1/files/{file_id}/download-content
    Storage-->>Browser: Ciphertext binary blob
    
    Browser->>Browser: Prompt for local key passphrase (if locked)
    Browser->>Browser: Decrypt local PKCS#8 private key via PBKDF2-SHA-256 + AES-GCM
    Browser->>Browser: Unwrap AES key using RSA-OAEP 3072 private key
    Browser->>Browser: Assemble canonical AAD
    Browser->>Browser: Decrypt ciphertext using AES-256-GCM
    Browser->>Browser: Verify 128-bit authentication tag
    
    alt Tag verification succeeds
        Browser->>Bob: Trigger browser download for decrypted original file
        Browser->>Flask: POST /api/v1/files/{file_id}/events/decryption-result (status: SUCCESS)
    else Tag verification fails
        Browser->>Bob: Display Integrity / Decryption Failure (Zero plaintext released)
        Browser->>Flask: POST /api/v1/files/{file_id}/events/decryption-result (status: FAILED)
    end
```

### 2.3 Unauthorized Intruder Attempt (Eve)

```mermaid
sequenceDiagram
    autonumber
    actor Eve as Intruder (Eve)
    participant Browser as Eve's Browser
    participant Flask as Flask Backend API
    participant DB as Database

    Eve->>Flask: POST /api/v1/files/{file_id}/download-authorize (Eve's JWT)
    Flask->>DB: Check if Eve is in authorized recipients list for file_id
    DB-->>Flask: Not found in recipients
    Flask->>DB: Record UNAUTHORIZED_ACCESS_ATTEMPT audit event (result: DENIED)
    Flask-->>Eve: HTTP 403 Forbidden ("Access denied: You are not an authorized recipient")
    
    Note over Eve,Flask: Eve receives neither download URL nor wrapped AES key envelope.
    
    opt Security Demo: Eve obtains raw ciphertext blob
        Eve->>Browser: Attempts decryption of ciphertext
        Note over Browser: Eve has only her own private key. Unwrapping Bob's envelope (or missing envelope) fails mathematically.
    end
```

### 2.4 Controlled Tampering Detection Demo

```mermaid
sequenceDiagram
    autonumber
    actor Bob as Recipient (Bob)
    participant Browser as Bob's Browser
    participant Flask as Flask Backend API

    Bob->>Browser: Clicks "Tamper Test"
    Browser->>Flask: GET /api/v1/files/{file_id}/tampered-content
    Flask-->>Browser: Returns in-memory copy with 1 bit flipped (Storage unmodified)
    
    Browser->>Browser: Unwraps legitimate AES key using Bob's private key
    Browser->>Browser: Executes crypto.subtle.decrypt(AES-GCM, tamperedCiphertext, AAD)
    Note over Browser: Web Crypto validates 128-bit GCM authentication tag against bytes
    Browser-->>Browser: Throws OperationError (Tag mismatch detected)
    
    Browser->>Bob: Shows "Tampering Detected & Blocked" alert (Zero plaintext released)
    Browser->>Flask: POST /api/v1/files/{file_id}/report-tampering-demo (result: TAMPER_DETECTED)
```

---

## 3. Storage Design

The backend uses a uniform `BaseStorageService` interface:

- `LocalStorageService`: Stores encrypted binary blobs in `backend/storage/encrypted_blobs/`. Filenames are assigned random UUIDs (e.g. `f47ac10b...enc`). Path traversal is strictly prevented through canonical resolution checks.
- `SupabaseStorageService`: Stores encrypted blobs in private Supabase Storage buckets. Authenticated via `SUPABASE_SERVICE_ROLE_KEY` held exclusively on the Flask backend.

Plaintext file names are never used as storage keys; they remain stored only as metadata in the database.

