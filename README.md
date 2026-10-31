# CipherShare — Secure Cloud File Sharing Using Hybrid Cryptography

CipherShare is a full-stack web application developed for a college Cryptography course project. It demonstrates authenticated, end-to-end client-side file encryption before uploading to cloud storage.

> **Core Security Principle:**
> The cloud stores the encrypted file, but the cloud never possesses the plaintext file, content-encryption key, or recipient's private key.

---

## 1. Key Features

- **Hybrid Encryption**: Combines **AES-256-GCM** (128-bit authentication tag, 96-bit nonce) for high-speed file payload encryption with **RSA-OAEP 3072-bit** asymmetric cryptography for multi-recipient key encapsulation.
- **Client-Side Key Vault**: User RSA private keys are generated in the browser via the standard W3C Web Crypto API, encrypted with a master passphrase using **PBKDF2-SHA-256** (600,000 iterations) + **AES-GCM**, and stored locally in **IndexedDB**. Private keys are **never transmitted** to the server.
- **Canonical Additional Authenticated Data (AAD)**: Cryptographically binds file metadata (`fileId`, `senderId`, `version`) to the AES-GCM authentication tag.
- **Strict Backend Access Control**: Non-recipients attempting to access files receive **HTTP 403 Forbidden**. Download authorizations return **only** the requesting recipient's wrapped key envelope.
- **Live Cryptographic Execution Monitor**: A real-time timeline displaying stage-by-stage cryptographic primitives, timings, parameter inspectors, and educational dummy representations.
- **Interactive Cryptographic Playground**: Hands-on experiments for AES-256-GCM, RSA-OAEP 3072, SHA-256 fingerprinting, and controlled bit-flip tampering tests.
- **Controlled Security Demos**:
  - **Unauthorized Access Demo**: Demonstrates that an attacker receiving the ciphertext cannot decrypt it without the recipient's private key.
  - **Tampering Detection Demo**: In-memory bit-flip test demonstrating that the 128-bit GCM authentication tag rejects altered ciphertext with zero plaintext released.
- **Dual Storage Adapters**: Built-in zero-config **Local Private Storage** for offline development and **Supabase Storage** for production cloud deployment.
- **Tamper-Evident Audit Logging**: Server-side audit log scrubbing all sensitive secrets (passwords, tokens, keys, plaintext).

---

## 2. Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS, Lucide Icons |
| **Cryptography** | Web Crypto API (`crypto.subtle`), IndexedDB (`idb`) |
| **Backend** | Python 3.12, Flask, Flask-SQLAlchemy, Flask-CORS, PyJWT, Argon2id |
| **Database** | SQLite (development default) / PostgreSQL (Supabase) |
| **Cloud Storage** | Local Private Storage Adapter / Supabase Storage |
| **Testing** | `pytest` (backend), `vitest` (frontend cryptographic suite) |

---

## 3. Prerequisites

- **Python 3.10+** (tested with Python 3.12)
- **Node.js 18+** (tested with Node.js v22) & **npm**

---

## 4. Quick Start Setup

### Step 1: Clone and Configure Environment

```bash
# Copy example environment configuration
cp .env.example backend/.env
```

### Step 2: Set Up Backend

```bash
# 1. Create Python virtual environment
python -m venv backend/venv

# 2. Activate virtual environment
# Windows (PowerShell):
backend\venv\Scripts\Activate.ps1
# Linux / macOS:
# source backend/venv/bin/activate

# 3. Install backend dependencies
pip install -r backend/requirements.txt

# 4. Seed demo accounts (Alice, Bob, Eve)
python backend/seed.py
```

### Step 3: Set Up Frontend

```bash
# From repository root:
npm --prefix frontend install
```

---

## 5. Running the Application

### Start Backend API Server (Port 5000)
```bash
# Windows:
backend\venv\Scripts\python backend\run.py
# Linux / macOS:
# python backend/run.py
```
*Backend runs at `http://127.0.0.1:5000`.*

### Start Frontend Dev Server (Port 5173)
```bash
npm --prefix frontend run dev
```
*Frontend runs at `http://localhost:5173`.*

---

## 6. Seeded Demo Accounts (1-Click Switchable)

| Persona | Role | Email | Password | Passphrase |
| :--- | :--- | :--- | :--- | :--- |
| **Alice Sender** | File Sender | `sender@demo.local` | `DemoSender123!` | User-selected (e.g. `passphrase123`) |
| **Bob Recipient** | Intended Recipient | `recipient@demo.local` | `DemoRecipient123!` | User-selected (e.g. `passphrase123`) |
| **Eve Intruder** | Unauthorized User | `intruder@demo.local` | `DemoIntruder123!` | User-selected (e.g. `passphrase123`) |

---

## 7. Professor Demonstration Script (Step-by-Step)

Navigate to **Demo Workspace** (`http://localhost:5173/demo`) for the guided presentation:

1. **Log in as Sender (Alice)**: Click "Alice (Sender)" 1-click button.
2. **Setup Asymmetric Key**: Click "Setup Key Pair" (modulus: 3072 bits, exponent: 65537). Enter unlock passphrase `passphrase123`.
3. **Share a File**:
   - Go to **Share File** (`/share`).
   - Select a sample document or PDF.
   - Choose **Bob Recipient**.
   - Click **Execute Client-Side Encryption & Share**.
   - Review live stages in the **Cryptographic Execution Monitor**:
     1. File inspected & SHA-256 computed.
     2. Session initiated with Flask.
     3. 256-bit AES-GCM key generated in browser.
     4. 96-bit nonce generated.
     5. Canonical AAD created.
     6. File encrypted with AES-256-GCM.
     7. AES key wrapped with Bob's RSA-OAEP public key.
     8. Ciphertext uploaded to private storage.
     9. Metadata & envelope saved.
4. **Test Intruder Access Denial (Eve)**:
   - Switch persona to **Eve Intruder** (`intruder@demo.local`).
   - Verify Eve's inbox is empty.
   - In Demo Workspace, paste the File ID and click **Simulate Unauthorized Request**.
   - Backend enforces recipient check and returns **HTTP 403 Forbidden**. Download URL and AES key envelope are withheld.
5. **Legitimate Decryption by Bob**:
   - Switch persona to **Bob Recipient** (`recipient@demo.local`).
   - Go to **Inbox** (`/inbox`).
   - Click **Download & Decrypt**.
   - Enter Bob's key passphrase.
   - Web Crypto unwraps the AES key and verifies the 128-bit authentication tag.
   - Original file downloads to Bob's computer!
6. **Tampering Detection Test**:
   - Click **Tamper Test** on any inbox file.
   - Web Crypto attempts decryption of an in-memory bit-flipped ciphertext copy.
   - The 128-bit GCM authentication tag fails verification (`OperationError`).
   - Clear tampering alert displayed. **Zero plaintext released**.
7. **Security Center & Audit Log**:
   - Go to **Security Center** (`/security`).
   - Inspect recorded events: `FILE_UPLOAD_COMPLETED`, `DOWNLOAD_AUTHORIZED`, `UNAUTHORIZED_ACCESS_ATTEMPT`, and `TAMPERING_DEMO_TEST`.

---

## 8. Running Automated Tests

### Backend Test Suite (Pytest)
```bash
backend\venv\Scripts\pytest backend/tests
```
*Tests cover registration, password hashing verification, token rejection, upload initiation, download authorization, HTTP 403 enforcement, envelope isolation, and tampering detection.*

### Frontend Cryptographic Test Suite (Vitest)
```bash
npm --prefix frontend test
```
*Tests cover SHA-256 digests, AES-256-GCM round-trip, tampered ciphertext rejection, AAD mismatch rejection, RSA-OAEP 3072 key wrapping/unwrapping, and PBKDF2 passphrase vault encryption.*

---

## 9. Supabase Storage Configuration (Optional)

To switch from the default local private storage to hosted Supabase Storage:
1. In your Supabase dashboard, create a **private** bucket named `ciphershare-encrypted-files`.
2. In `backend/.env`, set:
   ```env
   STORAGE_TYPE=supabase
   SUPABASE_URL=https://your-project-id.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
   SUPABASE_BUCKET=ciphershare-encrypted-files
   ```
3. Restart the Flask backend.

---

## 10. Known Limitations

- **Endpoint Security**: If the user's browser device is compromised (e.g., malware, keylogger), in-memory plaintext can be captured after decryption.
- **Server-Side Metadata**: File names, file sizes, and recipient associations are visible as plaintext database records.
- **Private Key Loss**: If a user clears their browser's IndexedDB without an exported backup, previously shared files become unrecoverable.
- **Academic Scope**: This prototype has not undergone an external commercial security audit.
