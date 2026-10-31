# CLAUDE.md — CipherShare Project Quick Reference

## Commands Quick Reference

### Running the System
- **Backend**: `backend\venv\Scripts\python backend\run.py` (Port 5000)
- **Frontend**: `npm --prefix frontend run dev` (Port 5173)
- **Seed Demo Accounts**: `backend\venv\Scripts\python backend\seed.py`

### Testing
- **Backend Tests**: `backend\venv\Scripts\pytest backend\tests`
- **Frontend Tests**: `npm --prefix frontend test`
- **Frontend Build**: `npm --prefix frontend run build`

---

## Architectural Principles & Cryptographic Rules

1. **Hybrid Cryptography**:
   - AES-256-GCM for files (128-bit tag, 96-bit nonce, canonical AAD).
   - RSA-OAEP 3072-bit for wrapping symmetric AES keys per recipient.
   - PBKDF2-SHA-256 (600,000 iterations) + AES-GCM for local private key vault in IndexedDB.
2. **Zero Server Knowledge**:
   - Plaintext files and raw AES keys are never uploaded.
   - Private keys are generated and kept exclusively in the client browser.
3. **Authorization & Boundaries**:
   - Download authorization checks recipient list and returns HTTP 403 to intruders.
   - Download authorization returns ONLY the requesting user's envelope.
   - Server-side audit logging scrubs all secrets and passphrases.

---

## Code Style & Conventions

- **Frontend**: TypeScript strict mode. React hooks, functional components, Tailwind CSS classic light institutional theme, full-width screen layout, left persistent sidebar, comprehensive text wrapping for large filenames.
- **Backend**: Flask application factory pattern with blueprints under `/api/v1`. SQLAlchemy models with UUID primary keys.
- **Error Responses**: Consistent JSON error format: `{"error": "<Error Type>", "message": "<Detail>"}`.

