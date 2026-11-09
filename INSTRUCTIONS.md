# CipherShare — Developer & Evaluator Instructions

This document provides concise operational instructions for running, testing, demonstrating, and evaluating CipherShare.

---

## 1. Environment Setup

### 1.1 Python Virtual Environment
```bash
# From repository root:
python -m venv backend/venv

# Activate environment:
# Windows (PowerShell):
backend\venv\Scripts\Activate.ps1
# Linux / macOS:
# source backend/venv/bin/activate

# Install dependencies:
pip install -r backend/requirements.txt
```

### 1.2 Frontend Node Dependencies
```bash
# Install dependencies:
npm --prefix frontend install
```

### 1.3 Database Initialization & Seed Data
```bash
# Initialize SQLite database and seed demo personas (Alice, Bob, Eve):
python backend/seed.py
```

---

## 2. Launching the Application

### 2.1 Start Backend (Flask)
```bash
backend\venv\Scripts\python backend\run.py
```
- Listens at `http://127.0.0.1:5000`.
- Health check available at `http://127.0.0.1:5000/api/v1/health`.

### 2.2 Start Frontend (Vite)
```bash
npm --prefix frontend run dev
```
- Available at `http://localhost:5173`.
- Proxies `/api` requests automatically to `http://127.0.0.1:5000`.
- Features classic light theme with persistent left sidebar, live key vault widget, 1-click persona switcher, full-width screen utilization, and large filename text wrapping.
- **Professor Presentation Storyboard**: Available directly at `http://localhost:5173/demo`. Allows presenting the complete hybrid encryption lifecycle (AES-256-GCM + RSA-OAEP 3072), Eve 403 access blocking, and bit-flip tamper rejection on a single screen without logging in and out.

---

## 3. Running Automated Tests

### 3.1 Backend Test Suite (Pytest)
```bash
backend\venv\Scripts\pytest backend/tests -v
```
Verifies:
- Password hashing using Argon2id (no plaintext stored).
- Route protection against missing or invalid JWT tokens.
- Private key rejection when attempting to submit private key material to the server.
- End-to-end share initiation, upload, and finalization.
- Recipient authorization check (HTTP 403 for unauthorized users).
- Envelope isolation (each recipient only gets their designated key envelope).
- In-memory tampering copy integrity check.

### 3.2 Frontend Cryptographic Test Suite (Vitest)
```bash
npm --prefix frontend test
```
Verifies:
- Deterministic SHA-256 digests.
- AES-256-GCM authenticated encryption and decryption.
- Rejection of tampered ciphertexts via 128-bit authentication tag.
- Rejection of mismatched Additional Authenticated Data (AAD).
- RSA-OAEP 3072-bit key encapsulation and per-recipient key isolation.
- Passphrase-based private key vault encryption with PBKDF2-SHA-256 + AES-GCM.

### 3.3 Frontend Production Build Check
```bash
npm --prefix frontend run build
```
Executes TypeScript typecheck (`tsc`) and Vite bundling.

---

## 4. Resetting Demonstration State

To clear all shared files, uploaded ciphertext blobs, and non-system audit events for a clean demonstration:
```bash
# Option A: From UI
Navigate to http://localhost:5173/demo and click "Reset Demo Data"

# Option B: Via API call
curl -X POST http://127.0.0.1:5000/api/v1/demo/reset
```

---

## 5. Troubleshooting & FAQ

- **Port 5000 already in use**:
  Set `PORT=5001` in `backend/.env` and update the proxy target in `frontend/vite.config.ts`.
- **"Private key not found on this device" alert**:
  Each browser session stores private keys in its own local IndexedDB. Click "Setup Key Pair" to generate a 3072-bit key pair in that specific browser.
- **Node.js EPERM errors on Windows**:
  Run `npm install` directly inside `frontend` using administrative privileges or ensure no file locks are held on `node_modules`.

