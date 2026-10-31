# CipherShare REST API Documentation

Base URL: `/api/v1`

All protected endpoints require an HTTP `Authorization` header formatted as:
`Authorization: Bearer <jwt_token>`

---

## 1. Authentication Endpoints

### Register User
- **Method**: `POST /api/v1/auth/register`
- **Body**:
  ```json
  {
    "name": "Alice Smith",
    "email": "alice@example.com",
    "password": "Password123!"
  }
  ```
- **Responses**:
  - `201 Created`: Returns JWT token and User object.
  - `400 Bad Request`: Missing fields or short password (< 8 chars).
  - `409 Conflict`: Email already registered.

### Login
- **Method**: `POST /api/v1/auth/login`
- **Body**:
  ```json
  {
    "email": "alice@example.com",
    "password": "Password123!"
  }
  ```
- **Responses**:
  - `200 OK`: Returns JWT token and User object.
  - `401 Unauthorized`: Invalid credentials.

### Current User Profile
- **Method**: `GET /api/v1/auth/me`
- **Auth Required**: Yes

### Logout
- **Method**: `POST /api/v1/auth/logout`
- **Auth Required**: Yes

---

## 2. Public Key Endpoints

### Register Public Key
- **Method**: `POST /api/v1/keys`
- **Auth Required**: Yes
- **Body**:
  ```json
  {
    "public_key_jwk": "{\"kty\":\"RSA\",\"n\":\"...\",\"e\":\"AQAB\"}",
    "key_type": "RSA-OAEP-3072",
    "algorithm": "RSA-OAEP",
    "fingerprint": "64-character-sha256-hex-digest"
  }
  ```
- **Note**: Submitting private key fields (`d`, `p`, `q`, etc.) returns `400 Bad Request`.

### Get Current User Public Key
- **Method**: `GET /api/v1/keys/me`
- **Auth Required**: Yes

### Search Registered Users
- **Method**: `GET /api/v1/users/search?q=<query>`
- **Auth Required**: Yes

### Get User Public Key by ID
- **Method**: `GET /api/v1/users/{user_id}/public-key`
- **Auth Required**: Yes

---

## 3. Secure File Endpoints

### Initiate Share Session
- **Method**: `POST /api/v1/files/initiate`
- **Auth Required**: Yes
- **Body**:
  ```json
  {
    "original_filename": "secret_document.pdf",
    "file_size": 1048576,
    "content_type": "application/pdf",
    "recipient_ids": ["uuid-1", "uuid-2"],
    "crypto_version": "1.0",
    "plaintext_sha256": "optional-hex-hash"
  }
  ```
- **Response**: `201 Created` with `file_id`, `storage_object_key`, upload URL, and recipients' public keys.

### Upload Ciphertext Blob
- **Method**: `POST /api/v1/files/{file_id}/upload`
- **Auth Required**: Yes (Must be sender)
- **Headers**: `Content-Type: application/octet-stream`
- **Body**: Raw encrypted binary payload.

### Complete Share Session
- **Method**: `POST /api/v1/files/{file_id}/complete`
- **Auth Required**: Yes
- **Body**:
  ```json
  {
    "nonce": "base64-encoded-12-byte-nonce",
    "ciphertext_sha256": "64-char-hex-hash",
    "crypto_version": "1.0",
    "aad_version": "1.0",
    "key_envelopes": [
      {
        "recipient_id": "uuid-1",
        "recipient_public_key_id": "key-uuid-1",
        "encrypted_aes_key": "base64-rsa-wrapped-aes-key"
      }
    ]
  }
  ```

### List Received Files (Inbox)
- **Method**: `GET /api/v1/files/inbox`
- **Auth Required**: Yes

### List Sent Files
- **Method**: `GET /api/v1/files/sent`
- **Auth Required**: Yes

### Authorize File Download
- **Method**: `POST /api/v1/files/{file_id}/download-authorize`
- **Auth Required**: Yes
- **Responses**:
  - `200 OK`: Returns download URL, nonce, and ONLY the requesting user's encrypted key envelope.
  - `403 Forbidden`: User is not an authorized recipient.

### Download Ciphertext Content
- **Method**: `GET /api/v1/files/{file_id}/download-content`
- **Auth Required**: Yes (Must be sender or authorized recipient)

### Decryption Result Event
- **Method**: `POST /api/v1/files/{file_id}/events/decryption-result`
- **Auth Required**: Yes
- **Body**: `{"status": "SUCCESS" | "FAILED", "error_message": "..."}`

### Tampering Demo Content
- **Method**: `GET /api/v1/files/{file_id}/tampered-content`
- **Auth Required**: Yes
- **Returns**: In-memory copy of ciphertext with 1 bit flipped for integrity demonstration.

---

## 4. Audit & Demo Endpoints

### List Audit Events
- **Method**: `GET /api/v1/audit?event_type=...&result=...&limit=50&offset=0`
- **Auth Required**: Yes

### Demo Status
- **Method**: `GET /api/v1/demo/status`

### Seed Demo Accounts
- **Method**: `POST /api/v1/demo/seed`

### Reset Demo Files & Audit Logs
- **Method**: `POST /api/v1/demo/reset`

### System Health
- **Method**: `GET /api/v1/health`

