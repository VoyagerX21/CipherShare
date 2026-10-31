# Agent Architecture & Operational Guidelines (AGENTS.md)

This file provides architectural context, safety rules, and implementation patterns for autonomous agents and AI assistants collaborating on the **CipherShare** codebase.

---

## 1. Core Cryptographic Invariants (NEVER VIOLATE)

When modifying or extending this codebase, adhere strictly to these security invariants:

1. **Zero Server Plaintext**:
   The server backend must **never** receive plaintext file bytes, content-encryption keys (AES), or user private keys.
2. **Private Key Isolation**:
   Private keys must reside **only** in the client browser's volatile RAM or encrypted at rest in IndexedDB via PBKDF2-SHA-256 + AES-GCM. Never add routes or mechanisms that transmit private keys.
3. **No Key Overlap in Download Authorization**:
   `POST /api/v1/files/{file_id}/download-authorize` must return **only** the requesting recipient's key envelope. Never return all recipient envelopes in a single payload.
4. **Enforce Recipient Authorization**:
   Non-recipients must receive `HTTP 403 Forbidden` on download authorization or content retrieval.
5. **No Secret Logging**:
   Audit logs and application logs must strictly filter out passwords, private keys, plaintext AES keys, passphrases, and file payloads. Use `backend/app/services/audit_service.py:sanitize_metadata`.
6. **No Mocking of Cryptography in Production Code**:
   Cryptographic operations must use genuine SubtleCrypto (Web Crypto API) primitives (AES-256-GCM, RSA-OAEP 3072, SHA-256).

---

## 2. Codebase Organization

```
CipherShare/
├── backend/
│   ├── app/
│   │   ├── models/            # SQLAlchemy database models (User, Key, File, Recipient, Audit)
│   │   ├── routes/            # Blueprint routes (auth, keys, files, audit, demo, health)
│   │   ├── services/          # Business logic & abstractions (storage, auth, crypto, audit, file)
│   │   ├── config.py          # Environment & SQLite/Postgres configuration
│   │   └── extensions.py      # Flask extensions (db, migrate, cors)
│   ├── tests/                 # Pytest backend test suite
│   ├── seed.py                # Demo account seeding script
│   └── run.py                 # Backend entrypoint (Port 5000)
├── frontend/
│   ├── src/
│   │   ├── components/        # Reusable UI components & ExecutionMonitor
│   │   ├── features/auth/     # React AuthContext & session management
│   │   ├── lib/api/           # REST API client
│   │   ├── lib/crypto/        # Web Crypto API primitives & IndexedDB KeyStore
│   │   ├── pages/             # Dashboard, Share, Inbox, Sent, Security, Playground, Demo
│   │   └── types/             # TypeScript interfaces
│   ├── package.json           # Frontend dependencies & scripts
│   └── vite.config.ts         # Vite bundler configuration & API proxy
└── docs/                      # Technical specifications (Architecture, Cryptography, API)
```

---

## 3. Standard Verification Commands

Before concluding any implementation turn, run the following verification commands:

```bash
# 1. Run backend pytest suite
backend\venv\Scripts\pytest backend/tests

# 2. Run frontend cryptographic vitest suite
npm --prefix frontend test

# 3. Verify frontend TypeScript type-checking and bundling
npm --prefix frontend run build
```

---

## 4. Persona Reference

For manual or automated end-to-end verification, use the seeded accounts:

- **Sender**: `sender@demo.local` / `DemoSender123!`
- **Recipient**: `recipient@demo.local` / `DemoRecipient123!`
- **Intruder**: `intruder@demo.local` / `DemoIntruder123!`
