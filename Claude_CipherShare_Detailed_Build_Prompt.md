# Claude Build Prompt --- Secure Cloud File Sharing Using Hybrid Cryptography

You are a senior full-stack engineer and application security engineer.
Build a complete, working **web application** for a college Cryptography
course project titled:

**Secure Cloud File Sharing Using Hybrid Cryptography**

The application must be a functional prototype that can be demonstrated
live to a professor and multiple users. Prioritize a correct,
explainable cryptographic implementation, clear security boundaries, and
a polished user experience. Do not build a mobile application. The
deliverable is a web application only.

Do not stop after producing a plan, scaffold, mock UI, or pseudocode.
Inspect the repository, make sensible decisions, implement the
application end-to-end, run available checks, fix errors, and document
how to run and demonstrate it. If the repository already contains code,
inspect it and preserve useful existing work rather than blindly
replacing it.

------------------------------------------------------------------------

## 1. Product goal

Build a multi-user file-sharing system in which:

1.  A sender selects a file and one or more intended recipients.
2.  The sender's browser encrypts the file **before it leaves the
    browser**.
3.  The encrypted file is uploaded to private cloud object storage.
4.  The server stores metadata and encrypted recipient-specific copies
    of the file-encryption key.
5.  Only an intended recipient with the matching private key can recover
    the file-encryption key and decrypt the file.
6.  Other authenticated users must be denied by the backend and must
    also be cryptographically unable to decrypt a ciphertext they manage
    to obtain.
7.  The app records meaningful audit events and provides an educational,
    step-by-step cryptographic execution monitor.

The core security principle is:

> The cloud stores the encrypted file, but the cloud does not possess
> the plaintext file or the recipient's private key and cannot decrypt
> the file.

This is a course prototype, not a claim of production-grade security.
Clearly document limitations and assumptions.

------------------------------------------------------------------------

## 2. Required technology stack

Use the following stack unless a genuine compatibility issue requires a
documented alternative:

### Frontend

-   React
-   TypeScript
-   Vite
-   React Router
-   Tailwind CSS (or a similarly consistent component styling approach)
-   Web Crypto API for cryptographic operations
-   IndexedDB for locally stored encrypted private-key material and
    relevant client-side state
-   Socket.IO client only if useful for live notifications; polling or
    refresh is acceptable for the first working version.

### Backend

-   Python Flask (primary backend; do not use Django)
-   Flask blueprints with a clean modular structure
-   SQLAlchemy
-   Flask-Migrate/Alembic
-   PostgreSQL in deployed configuration
-   SQLite may be supported for local development if it materially
    simplifies setup
-   JWT-based authentication, with secure handling and short-lived
    access tokens
-   Argon2id or bcrypt for password hashing
-   Input validation and consistent JSON error responses

### Cloud storage

Use Supabase as the preferred hosted service: - Supabase PostgreSQL for
application data - Supabase Storage for encrypted file blobs - A private
storage bucket - Supabase service-role credentials must exist **only on
the Flask server**, never in frontend code or browser bundles.

The Flask backend should create short-lived, narrowly scoped
upload/download access or proxy the storage operation. The backend must
authorize the user before issuing a download URL. Do not expose a
permanent public bucket or unrestricted object URLs.

If Supabase cannot be configured immediately, implement a local
private-storage adapter for development, behind the same storage
interface. The application must still be runnable locally without cloud
credentials, with clear setup instructions. Do not pretend local storage
is cloud storage in the UI.

### Development and quality

-   Environment variables via `.env`; include `.env.example` with
    placeholders only.
-   Never commit secrets, API keys, private keys, or real user data.
-   Include clear README setup instructions.
-   Include backend tests and frontend checks where practical.

------------------------------------------------------------------------

## 3. Cryptographic design --- implement this correctly

Use **hybrid encryption**. Do not encrypt large files directly with RSA.

### 3.1 User key pairs

Each user should have an asymmetric key pair generated in their browser
using the Web Crypto API:

-   RSA-OAEP
-   3072-bit modulus
-   Public exponent 65537
-   SHA-256
-   Key usages appropriate for wrapping/encrypting and
    unwrapping/decrypting a content-encryption key.

The public key is uploaded to the backend and associated with the user's
account. The private key must never be uploaded to the backend.

For the prototype, export the private key as PKCS#8 in the browser,
encrypt that exported private-key material locally using a key derived
from a user-chosen key-unlock passphrase, and store only the encrypted
private-key blob plus required salt/nonce/parameters in IndexedDB.
Use: - PBKDF2 with SHA-256 and a suitably high iteration count (at least
600,000 where browser performance permits), or prefer Argon2id if a
reliable browser implementation is already available. - AES-GCM for
encrypting the private-key backup. - A fresh random salt and nonce. - A
clear unlock flow when the user needs to decrypt a received file.

Do not use the account login password as the private-key encryption key
by default. Do not store plaintext private keys in localStorage,
sessionStorage, backend database, logs, analytics, or browser console.

Explain in the UI and README that if the user loses the browser's local
encrypted private-key backup and has no separately implemented recovery
mechanism, they may lose the ability to decrypt files shared with them.
Do not silently regenerate a new key pair and imply it can decrypt old
files.

If a user signs in on another browser/device without the local private
key, show a clear "Private key not available on this browser" state and
explain the limitation. Do not transmit private keys to the server to
solve this.

### 3.2 File encryption

When a sender selects a file:

1.  Generate a fresh cryptographically secure random 256-bit AES key
    using `crypto.getRandomValues` or Web Crypto key generation.
2.  Generate a fresh 96-bit (12-byte) nonce for AES-GCM.
3.  Encrypt the file bytes in the browser using AES-256-GCM with a
    128-bit authentication tag.
4.  The plaintext file must not be uploaded to the backend or object
    storage.
5.  Compute a SHA-256 fingerprint of the original file in the browser
    for display and audit/debug purposes. Treat this as an integrity
    reference, not as a substitute for AES-GCM authentication.
6.  Store the encrypted file blob and required cryptographic metadata.

Use authenticated encryption. On decryption, AES-GCM authentication must
be checked by Web Crypto. If ciphertext, nonce, tag, or associated
authenticated data is modified, decryption must fail and the UI must
show a clear integrity/authentication failure. Never output a partially
decrypted file after authentication failure.

For an initial prototype, define and enforce a configurable file-size
limit (default 25 MB or another sensible limit) to avoid browser memory
problems. Display the limit and file size before encryption. Do not
claim arbitrary large-file support. If streaming/chunked encryption is
added, design it carefully with unique nonces per chunk and
authenticated chunk ordering; do not improvise a weak scheme.

### 3.3 Protecting the AES key for recipients

For every intended recipient:

1.  Obtain that recipient's registered public key from the backend.
2.  Verify that a public key exists and show the recipient's key
    fingerprint in the sharing confirmation UI.
3.  Export or otherwise obtain the raw AES content-encryption key in
    memory.
4.  Encrypt/wrap that AES key using the recipient's RSA-OAEP public key
    with SHA-256.
5.  Store one recipient-specific encrypted AES key (key envelope) per
    recipient.

The backend stores encrypted key envelopes, not the plaintext AES key.

When a recipient downloads: 1. The backend verifies that the
authenticated user is an authorized recipient. 2. The backend returns
the encrypted file and only that user's encrypted key envelope. 3. The
browser unlocks the user's local private key. 4. The browser uses
RSA-OAEP private-key decryption to recover the AES key. 5. The browser
decrypts the ciphertext using AES-GCM. 6. Only after successful GCM
authentication does the browser create a download for the original file.

Support multiple recipients by creating a separate RSA-OAEP encrypted
AES-key envelope for each recipient. The file itself should be encrypted
only once.

### 3.4 Associated authenticated data and metadata

Use AES-GCM additional authenticated data (AAD) to bind important
immutable metadata where practical, such as: - file record ID (created
before encryption or a client-generated UUID), - sender user ID, -
format/version identifier.

The exact same canonical AAD bytes must be used for encryption and
decryption. Version the crypto envelope format so future changes can be
handled safely. Do not include mutable fields such as display status or
download count in AAD unless the design accounts for them.

### 3.5 Optional digital signatures

If time permits after the core system works, add sender authenticity
using a separate signing key pair and RSA-PSS with SHA-256. Do not reuse
an RSA-OAEP key pair for signing unless the implementation and key
usages explicitly support that safely; preferably maintain separate key
pairs.

A signature should cover a canonical manifest containing the file ID,
ciphertext digest, crypto version, sender identity/key identifier, and
relevant immutable metadata. The recipient verifies the signature using
the sender's registered signing public key.

Clearly distinguish: - AES-GCM authentication: detects ciphertext
tampering and authenticates the encrypted payload under the symmetric
key. - SHA-256 digest: produces a fingerprint. - Digital signature: can
provide evidence that a sender possessing a signing private key signed
the manifest.

Do not claim a plain SHA-256 hash proves who sent a file.

------------------------------------------------------------------------

## 4. Core user journeys

### 4.1 Registration and first-time setup

-   User registers with name, email, and password.
-   Backend securely hashes the password.
-   Browser creates the user's RSA-OAEP key pair.
-   Browser sends only the public key to Flask.
-   Browser encrypts and stores the private key locally in IndexedDB,
    protected by a separate unlock passphrase.
-   User sees a successful setup screen and a warning to preserve their
    local key backup.
-   Prevent duplicate or accidental key-pair creation.
-   Show the public-key fingerprint in account/security settings.

### 4.2 Login

-   User logs in.
-   Backend returns an authenticated session/token.
-   The UI checks whether a local encrypted private-key backup exists.
-   User can unlock the private key when a cryptographic operation
    requires it.
-   If the local key is missing, clearly explain that the account can
    still be used but old recipient files cannot be decrypted in this
    browser.

### 4.3 Send a file

-   Select a file using a file picker or drag-and-drop.
-   Display file name, size, MIME type, and configured maximum size.
-   Search/select one or more registered recipients.
-   Show recipient public-key fingerprints and a confirmation before
    encryption.
-   Generate AES key and nonce.
-   Encrypt file client-side with AES-256-GCM.
-   Wrap the AES key separately for every recipient using RSA-OAEP.
-   Upload ciphertext to private storage.
-   Send metadata and key envelopes to Flask.
-   Show a clear success state with file ID and recipients.
-   Do not send plaintext file bytes or raw AES key to Flask.

### 4.4 Receive and decrypt a file

-   Recipient sees files shared with them.
-   Display sender, file name, size, timestamp, and status.
-   Recipient selects Download & Decrypt.
-   Backend checks authorization.
-   Browser downloads ciphertext and the recipient's own encrypted key
    envelope.
-   Recipient unlocks the local private key if necessary.
-   Browser unwraps AES key and decrypts using AES-GCM.
-   If successful, create a browser download for the original file.
-   Record a successful decryption event only after client-side
    decryption succeeds and the client reports it. Label this event
    accurately as a client-reported event, not independently verified
    proof by the server.
-   If decryption fails, show a useful error without exposing secrets.

### 4.5 Unauthorized access demonstration

Support a compelling demo with three users: - Sender - Intended
recipient - Unauthorized user

The unauthorized user must: - Not see the file in their normal inbox. -
Receive HTTP 403 if they try to access another user's file through a
manipulated API request. - Not receive the intended recipient's key
envelope. - Be unable to decrypt the ciphertext even if a demo mode
deliberately makes the ciphertext available to them, because they do not
have the intended recipient's private key.

Build a safe "Security Demo" action that can demonstrate this without
weakening the normal access-control implementation. It may expose a test
ciphertext to an unauthorized demo user, but it must never expose
another user's private key or plaintext AES key. Clearly label the
demonstration as simulated/controlled if it bypasses normal file
visibility.

### 4.6 Tampering demonstration

Provide a controlled demo action that flips or changes a byte in a copy
of the ciphertext, not the stored original. Attempt decryption of the
altered copy. AES-GCM must reject it. Show: - Original ciphertext
authentication: passed. - Modified ciphertext authentication: failed. -
File released to user: no.

Do not mutate the real stored file as part of the demo.

------------------------------------------------------------------------

## 5. Application pages and interface

Create a polished, modern security-themed interface. It should look like
a credible security product, not a generic unstyled CRUD admin panel.
Use consistent typography, spacing, colors, icons, loading states, empty
states, error states, and responsive layouts.

Suggested visual direction: - Dark navy/charcoal base or a clean light
security dashboard; choose one coherent theme. - Clear accent color for
primary actions. - Green for verified/success, amber for
in-progress/warnings, red for denied/failed. - Avoid excessive
animations and decorative clutter. - Make the UI usable on laptop
screens and common mobile browser widths, but this remains a web
application.

### Required pages

1.  **Landing / Login / Registration**
    -   Product name: CipherShare (working name; keep it easy to
        rename).
    -   Brief explanation of end-to-end/client-side encryption.
    -   Login and registration forms.
    -   Do not claim the server can decrypt files.
2.  **Main Dashboard**
    -   Summary cards: files sent, files received, pending/unopened,
        recent security events.
    -   Recent activity.
    -   Quick actions: Share a File, View Inbox, Open Crypto Playground.
    -   Current key status.
3.  **Share File**
    -   File picker/drag-and-drop.
    -   Recipient search and multi-select.
    -   Recipient public-key fingerprint.
    -   File details and size validation.
    -   Encryption progress and clear stages.
    -   Upload progress.
    -   Final confirmation.
4.  **Received Files / Inbox**
    -   List files shared with current user.
    -   Search/filter by sender, date, and status.
    -   Download & Decrypt action.
    -   Clear state for missing local private key.
    -   Decryption progress and success/failure.
5.  **Sent Files**
    -   Files shared by current user.
    -   Recipients and timestamps.
    -   Status and available metadata.
    -   Do not provide a plaintext preview from the server.
6.  **Cryptographic Execution Monitor**
    -   Live event timeline for the current operation.
    -   Step-by-step mode with Next Step, Previous Step, Auto Play,
        Pause, and Reset.
    -   Normal mode should run real cryptographic operations and report
        actual stage completion.
    -   Educational mode can pause between stages and animate
        explanatory steps, but must not fake cryptographic results.
    -   Show sanitized inputs/outputs and metadata only. Never display
        raw private keys or plaintext AES keys in production logs or
        normal UI.
    -   Provide an explicit educational-only "show sample values" mode
        using generated dummy values, clearly separated from real
        secrets.
7.  **Security Center / Audit Logs**
    -   Successful uploads.
    -   Authorized download attempts.
    -   Client-reported successful decryptions.
    -   Unauthorized access denials.
    -   Tampering test results.
    -   Key setup and public-key registration events.
    -   Timestamp, actor, event type, file reference, result, and safe
        metadata.
    -   Never log passwords, tokens, private keys, plaintext AES keys,
        plaintext file contents, or secret passphrases.
8.  **Cryptographic Playground**
    -   Educational experiments for AES-256-GCM, RSA-OAEP, SHA-256, and
        optionally RSA-PSS.
    -   Allow a user to select a sample file or generated sample text.
    -   Show the purpose, inputs, safe metadata, output preview, and
        explanation for each stage.
    -   Include a guided hybrid-encryption experiment.
    -   Clearly distinguish sample/dummy data from real file-sharing
        operations.
9.  **Account / Key Management**
    -   Public-key fingerprint.
    -   Local private-key backup status (present/missing/locked).
    -   Unlock/change local key passphrase workflow where feasible.
    -   Explain key-loss limitations.
    -   Logout.
    -   Do not add a feature that sends private keys to the backend.

------------------------------------------------------------------------

## 6. Cryptographic execution monitor: event model

Implement a structured event model rather than scattering arbitrary
console messages.

Each event should contain safe fields such as: - event ID - operation
ID - timestamp - stage key - human-readable title - explanatory
description - status (`pending`, `running`, `success`, `failed`) -
duration in milliseconds where measurable - safe metadata (algorithm,
key size, nonce length, file size, recipient count, etc.)

Example send sequence: 1. File selected. 2. Recipient public keys
retrieved. 3. AES-256 key generated. 4. AES-GCM nonce generated. 5. File
encrypted in browser. 6. SHA-256 fingerprint calculated. 7. AES key
wrapped for recipient 1. 8. AES key wrapped for recipient 2 (if
applicable). 9. Ciphertext uploaded to private storage. 10. File
metadata and encrypted key envelopes saved. 11. Share operation
completed.

Example receive sequence: 1. Recipient requests file. 2. Backend
authorization succeeds. 3. Ciphertext retrieved. 4. Recipient key
envelope retrieved. 5. Local private key unlocked. 6. AES key unwrapped
with RSA-OAEP. 7. AES-GCM authentication/decryption executed. 8.
Original file download created. 9. Client-reported decryption event
submitted.

The monitor must reflect real application events. Do not merely display
a prewritten animation that claims encryption occurred when it did not.

For manual step mode, it is acceptable to execute the cryptographic
pipeline and queue the actual event records, then reveal the queued
records one at a time. Do not delay or weaken cryptographic primitives
to make them appear slower.

------------------------------------------------------------------------

## 7. Backend data model

Design normalized SQLAlchemy models and migrations. At minimum consider:

### User

-   id (UUID)
-   name
-   email (unique)
-   password_hash
-   created_at
-   is_active

### UserPublicKey

-   id
-   user_id
-   key_type
-   algorithm
-   public_key_jwk or public_key_pem
-   fingerprint
-   key_version
-   created_at
-   revoked_at (nullable)

### SharedFile

-   id (UUID)
-   sender_id
-   original_filename
-   content_type
-   file_size
-   storage_object_key
-   crypto_version
-   encryption_algorithm
-   key_wrapping_algorithm
-   nonce (base64)
-   ciphertext_sha256 (hex)
-   plaintext_sha256 (hex, optional; consider privacy implications)
-   aad_version
-   created_at
-   status

Do not store plaintext file content or plaintext AES key.

### FileRecipient

-   id
-   file_id
-   recipient_id
-   recipient_public_key_id
-   encrypted_aes_key (base64)
-   created_at
-   access_status

### AuditEvent

-   id
-   actor_user_id (nullable for system events)
-   file_id (nullable)
-   event_type
-   result
-   safe_metadata (JSON)
-   created_at

Add indexes and foreign-key constraints where appropriate. Prevent
duplicate recipient rows for the same file. Use UUIDs and avoid
predictable sequential object names.

Do not store sensitive values in audit metadata.

------------------------------------------------------------------------

## 8. Backend API requirements

Use versioned routes under `/api/v1`. Implement consistent response
shapes and error handling.

Suggested endpoints (adjust as needed, but document the final API):

### Authentication

-   `POST /api/v1/auth/register`
-   `POST /api/v1/auth/login`
-   `POST /api/v1/auth/logout` if using revocable sessions
-   `GET /api/v1/auth/me`

### Public keys

-   `POST /api/v1/keys`
-   `GET /api/v1/keys/me`
-   `GET /api/v1/users/search`
-   `GET /api/v1/users/{user_id}/public-key`
-   `GET /api/v1/keys/fingerprint/{user_id}`

### Files

-   `POST /api/v1/files/initiate`
    -   Validate sender, recipients, file metadata, and registered
        recipient keys.
    -   Create a pending file record and return an upload authorization
        mechanism.
-   `POST /api/v1/files/{file_id}/complete`
    -   Validate that ciphertext upload completed and persist the
        encrypted key envelopes and metadata.
-   `GET /api/v1/files/inbox`
-   `GET /api/v1/files/sent`
-   `GET /api/v1/files/{file_id}`
-   `POST /api/v1/files/{file_id}/download-authorize`
    -   Check authenticated user is an intended recipient.
    -   Return a short-lived authorized download URL or proxy response,
        plus only that user's encrypted AES-key envelope and required
        crypto metadata.
-   `POST /api/v1/files/{file_id}/events/decryption-result`
    -   Record a client-reported success/failure without treating it as
        independently proven by the server.
-   `POST /api/v1/files/{file_id}/report-tampering-demo` if a
    server-side audit event is required.

### Audit

-   `GET /api/v1/audit`
-   `GET /api/v1/audit/recent`

### Health

-   `GET /api/v1/health`

Security requirements: - Validate all input on the backend. - Derive
user identity from the authenticated token, never trust a user ID
supplied by the frontend for authorization. - Enforce sender/recipient
permissions on every relevant route. - Rate-limit login and sensitive
endpoints. - Use safe error messages. - Configure CORS only for the
actual frontend origins. - Use HTTPS in deployment. - Never put secrets
in frontend environment variables. Vite variables are public. - Never
return all recipients' key envelopes to a single recipient. - Do not
trust client-supplied `sender_id` as proof of identity. - Do not let a
user overwrite another user's object. - Make upload initiation and
completion safe against replay, duplicate completion, and orphaned
objects.

------------------------------------------------------------------------

## 9. Storage design

Create a storage abstraction with methods such as: -
`create_upload_authorization(...)` -
`create_download_authorization(...)` - `delete_object(...)` -
`object_exists(...)`

Implement: 1. Local private filesystem storage for development. 2.
Supabase Storage adapter for deployment.

The storage bucket must be private. Object keys should be random
UUID-based paths, not user-provided filenames. Keep the original
filename only as database metadata.

Only ciphertext should reach storage. The backend must not receive
plaintext file bytes in the normal upload flow.

For the Supabase adapter: - Keep the service-role key on the server
only. - Use short-lived signed upload/download URLs or a backend
proxy. - Authorize before issuing a download URL. - Ensure signed URLs
expire quickly and are scoped to a single object. - Do not expose bucket
listing to ordinary users.

------------------------------------------------------------------------

## 10. Frontend architecture and code quality

Use a maintainable structure, for example:

``` text
frontend/
  src/
    app/
    components/
    pages/
    features/
      auth/
      files/
      crypto/
      audit/
      users/
    lib/
      api/
      crypto/
      storage/
      validation/
    hooks/
    types/
    styles/

backend/
  app/
    __init__.py
    config.py
    extensions.py
    models/
    routes/
    services/
      auth_service.py
      crypto_metadata_service.py
      file_service.py
      storage_service.py
      audit_service.py
    utils/
    schemas/
  migrations/
  tests/
  run.py
```

Separate: - UI components - API client - cryptographic functions -
IndexedDB key storage - file-sharing orchestration - backend services -
persistence models

Use TypeScript types for API payloads and cryptographic envelope
formats. Avoid `any` except where unavoidable and documented.

Create reusable components for: - status badges - progress timeline -
file cards - recipient selector - confirmation dialogs - toast
notifications - empty states - error panels

Do not put the entire application in one giant component.

------------------------------------------------------------------------

## 11. Security requirements and threat model

Document a concise threat model covering:

### Protected assets

-   Plaintext files
-   AES content-encryption keys
-   User private keys
-   Account credentials
-   File metadata and sharing relationships

### Threats to address

-   Unauthorized authenticated user attempting to download another
    user's file.
-   Attacker obtaining ciphertext from object storage.
-   Ciphertext tampering.
-   Network interception.
-   Accidental secret exposure through logs or frontend bundles.
-   Malicious or malformed API requests.
-   Brute-force login attempts.
-   Missing or unavailable local private key.

### Security controls

-   Client-side AES-GCM encryption.
-   RSA-OAEP wrapping of AES key for each recipient.
-   Private key never sent to server.
-   Private object storage.
-   Backend authorization checks.
-   HTTPS.
-   Password hashing.
-   Short-lived signed URLs.
-   Safe audit logging.
-   Input validation and rate limiting.
-   Key fingerprints for recipient-key visibility.

### Limitations to state honestly

-   A compromised sender or recipient device can expose plaintext or
    keys.
-   A malicious server could potentially substitute a recipient public
    key unless users verify key fingerprints through a trusted channel.
    Include fingerprint display and explain this trust limitation.
-   Server-side metadata (sender, recipient, file size, timestamps) is
    not encrypted unless separately designed.
-   The server cannot independently prove that a recipient actually
    viewed or saved a decrypted file. It can record a client-reported
    decryption event.
-   Local private-key loss can make old files unrecoverable.
-   This prototype has not undergone a professional security audit.

Do not claim "zero knowledge" or "unhackable." Use precise language.

------------------------------------------------------------------------

## 12. Testing requirements

Implement tests for at least:

### Backend

-   Registration and login.
-   Password hash is not stored as plaintext.
-   Authenticated route rejects missing/invalid token.
-   Sender can initiate a share.
-   Intended recipient can request download authorization.
-   Non-recipient receives 403.
-   One recipient cannot retrieve another recipient's encrypted AES-key
    envelope.
-   Invalid file metadata is rejected.
-   Duplicate or replayed completion is rejected safely.
-   Audit events are created for important operations.
-   Storage object names cannot be controlled to overwrite another
    user's files.

### Frontend / cryptography

-   AES-GCM encrypt/decrypt round trip.
-   AES-GCM decryption fails if ciphertext is modified.
-   AES-GCM decryption fails with wrong key.
-   RSA-OAEP wrap/unwrap round trip.
-   RSA-OAEP unwrap fails with the wrong private key.
-   Multiple recipients receive distinct encrypted key envelopes for the
    same AES key.
-   Private key is stored only as encrypted local material.
-   Missing local key produces a clear error state.
-   AAD mismatch causes decryption failure.
-   No plaintext file upload is made during the share workflow.

If browser automation is practical, add one end-to-end test for sender →
recipient → successful decryption and another for unauthorized access
denial.

------------------------------------------------------------------------

## 13. Demonstration mode for the professor

Build a clearly visible **Demo Workspace** with three seeded demo users,
for example: - `sender@demo.local` - `recipient@demo.local` -
`intruder@demo.local`

Use documented demo passwords generated for local development only. Do
not hard-code production credentials or ship demo accounts enabled in
production.

Provide a setup command or seed script that creates the demo users and
their public-key records. Private keys should be generated in the
respective browser sessions and remain local; document how the demo
devices/browsers establish their local keys. If a local-only demo seed
mechanism is used, keep it clearly separated from production behavior.

The demo should guide the presenter through:

1.  Log in as Sender.
2.  Select a sample PDF or text file.
3.  Select Recipient.
4.  Start hybrid encryption.
5.  Show AES-256-GCM file encryption.
6.  Show RSA-OAEP wrapping of the AES key.
7.  Upload ciphertext.
8.  Log in as Intruder and attempt access.
9.  Show backend 403 denial.
10. Optionally run controlled ciphertext-only demo and show that
    Intruder cannot decrypt.
11. Log in as Recipient.
12. Unlock recipient's local private key.
13. Download and decrypt successfully.
14. Run tampering demo and show AES-GCM authentication failure.
15. Open audit log and explain the recorded events.

Provide a reset-demo-data command or documented reset process.

------------------------------------------------------------------------

## 14. Documentation and final deliverables

Create or update:

1.  `README.md`

    -   Project overview
    -   Features
    -   Architecture
    -   Prerequisites
    -   Local setup
    -   Environment variables
    -   Database migrations
    -   Frontend and backend run commands
    -   Supabase setup
    -   Demo users and demo walkthrough
    -   Testing commands
    -   Known limitations

2.  `docs/ARCHITECTURE.md`

    -   Component architecture
    -   Data flow
    -   Sequence diagrams (Mermaid) for send, receive, unauthorized
        access, and tampering
    -   Storage design

3.  `docs/CRYPTOGRAPHY.md`

    -   Hybrid cryptography explanation
    -   AES-256-GCM
    -   RSA-OAEP
    -   SHA-256
    -   Key generation and lifecycle
    -   Key wrapping and unwrapping
    -   Nonce and authentication tag
    -   AAD
    -   Threat model and limitations

4.  `docs/API.md`

    -   Endpoint list
    -   Authentication requirements
    -   Request/response examples
    -   Error codes

5.  `.env.example`

    -   Placeholder values only.

6.  Database migrations and seed scripts.

7.  Tests and a concise manual test checklist.

------------------------------------------------------------------------

## 15. Implementation order

Implement in milestones and keep the application runnable after each
milestone.

### Milestone 1 --- Foundation

-   Inspect repository.
-   Set up frontend and Flask backend.
-   Configure environment variables.
-   Set up database and migrations.
-   Create initial polished layout and routing.
-   Add health check.

### Milestone 2 --- Authentication and keys

-   Registration/login.
-   Password hashing and JWT.
-   Browser key-pair generation.
-   Public-key registration.
-   Local encrypted private-key storage and unlock.

### Milestone 3 --- Cryptographic core

-   AES-256-GCM encryption/decryption.
-   RSA-OAEP key wrapping/unwrapping.
-   SHA-256 fingerprint.
-   Versioned crypto envelope.
-   AAD.
-   Unit tests.

### Milestone 4 --- Secure file sharing

-   Recipient selection.
-   Initiate share.
-   Client-side encryption.
-   Private storage upload.
-   Persist metadata and recipient envelopes.
-   Inbox and sent files.
-   Authorized download and client-side decryption.

### Milestone 5 --- Security demonstrations

-   Unauthorized access denial.
-   Ciphertext-only unauthorized decryption attempt.
-   Tampering simulation.
-   Audit events.

### Milestone 6 --- Educational experience

-   Cryptographic Execution Monitor.
-   Step-by-step playback.
-   Cryptographic Playground.
-   Explanations and safe sample values.

### Milestone 7 --- Polish and deployment

-   Responsive UI.
-   Error/loading/empty states.
-   Supabase configuration.
-   Production environment documentation.
-   Tests, linting, type checks, and README.
-   Final end-to-end demo walkthrough.

Do not spend too much time on decorative UI before the cryptographic
flow works.

------------------------------------------------------------------------

## 16. Acceptance criteria

The project is not complete until all of the following are true:

-   A user can register and log in.
-   Each user can establish a public/private key pair.
-   The backend stores public keys but never private keys.
-   The sender's browser encrypts the original file before upload.
-   The stored object is ciphertext, not plaintext.
-   The AES key is wrapped separately for each intended recipient.
-   An intended recipient can unlock their local private key and decrypt
    the file.
-   A non-recipient receives a backend 403 response.
-   A non-recipient who obtains ciphertext still cannot decrypt it.
-   Altered ciphertext fails AES-GCM authentication.
-   The UI shows real cryptographic stages and meaningful sanitized
    logs.
-   Audit logs do not expose secrets.
-   The app works with local development storage and can be configured
    for Supabase Storage.
-   Setup and demo instructions are complete.
-   Tests for the core cryptographic and authorization flows pass.

------------------------------------------------------------------------

## 17. Working instructions for you, Claude

Before coding: 1. Inspect the current repository and report its
structure briefly. 2. Identify existing code worth preserving. 3. State
any assumptions and any required credentials that are not available. 4.
Propose a concise implementation plan, then proceed without waiting for
approval unless a genuinely blocking decision or missing secret prevents
progress.

During coding: - Implement real functionality, not placeholder
buttons. - Do not fake successful encryption, uploads, authorization, or
decryption. - Do not use server-side encryption as a substitute for
client-side encryption. - Do not send plaintext files or raw AES keys to
Flask. - Do not send private keys to Flask or cloud storage. - Do not
expose Supabase service-role credentials to the frontend. - Do not log
secrets. - Keep the project runnable after each milestone. - Run tests,
linting, and type checks where available; fix failures. - If a
third-party service credential is unavailable, implement the local
adapter and clearly document what remains to be configured. - Do not
claim a feature is complete unless it is implemented and tested.

At the end, provide: 1. Summary of what was implemented. 2. Exact
commands to run frontend and backend. 3. Environment variables that must
be configured. 4. Database migration and seed commands. 5. Test results.
6. A step-by-step professor demonstration script. 7. Any remaining
limitations or incomplete items.

**Primary priority:** deliver a working, demonstrable,
security-conscious web application whose central feature is genuine
client-side hybrid cryptography for secure cloud file sharing.
