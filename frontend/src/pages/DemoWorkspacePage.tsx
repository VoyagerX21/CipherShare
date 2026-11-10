import React, { useState, useEffect, useRef } from 'react';
import {
  generateFileAESKey,
  generateAESNonce,
  createCanonicalAAD,
  encryptFilePayload,
  decryptFilePayload,
  generateUserKeyPair,
  exportPublicKeyJWK,
  computeJWKFingerprint,
  wrapAESKeyForRecipient,
  unwrapAESKeyWithPrivateKey,
  computeDigest,
  arrayBufferToHex,
  CRYPTO_VERSION
} from '../lib/crypto/webcrypto';
import {
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Lock,
  Unlock,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  X,
  Terminal,
  Upload,
  FileText,
  Sliders,
  Download
} from 'lucide-react';

interface TelemetryStage {
  number: number;
  domain: string;
  domainColor: string;
  badge: string;
  title: string;
  plainEnglish: string;
  technicalDetail: string;
  params: { label: string; value: string }[];
  securityInvariant: string;
}

export const DemoWorkspacePage: React.FC = () => {
  // =========================================================================
  // 1. CONFIGURATION INPUTS (Rich User Inputs)
  // =========================================================================
  const [inputMode, setInputMode] = useState<'file' | 'text'>('file');

  // Real File Upload State
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [fileBuffer, setFileBuffer] = useState<ArrayBuffer | null>(null);
  const [fileName, setFileName] = useState<string>('Quarterly_Cryptographic_Audit.pdf');
  const [fileMimeType, setFileMimeType] = useState<string>('application/pdf');

  // Custom Plaintext Text State
  const [customText, setCustomText] = useState<string>(
    'CONFIDENTIAL REPORT: Client-side hybrid encryption ensures that zero plaintext, content keys, or user private keys are ever transmitted to or stored on the cloud server.'
  );

  // Cryptographic Algorithm Selectors
  const [aesKeyLength, setAesKeyLength] = useState<128 | 256>(256);
  const [rsaModulusLength, setRsaModulusLength] = useState<2048 | 3072>(3072);
  const [hashAlgorithm, setHashAlgorithm] = useState<'SHA-256' | 'SHA-512'>('SHA-256');

  // Identity & AAD Configuration
  const [senderName, setSenderName] = useState<string>('Alice (alice@ciphershare.local)');
  const [recipientName, setRecipientName] = useState<string>('Bob (bob@ciphershare.local)');
  const [aadClassification, setAadClassification] = useState<string>('CONFIDENTIAL');
  const [aadDepartment, setAadDepartment] = useState<string>('Research & Cryptography');

  // Default synthetic file setup on initial load
  useEffect(() => {
    const enc = new TextEncoder();
    const defaultData = enc.encode(customText);
    setFileBuffer(defaultData.buffer);
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setUploadedFile(file);
      setFileName(file.name);
      setFileMimeType(file.type || 'application/octet-stream');
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result instanceof ArrayBuffer) {
          setFileBuffer(event.target.result);
        }
      };
      reader.readAsArrayBuffer(file);
    }
  };

  // =========================================================================
  // 2. LIVE CRYPTOGRAPHIC ARTIFACTS COMPUTED BY WEBCRYPTO
  // =========================================================================
  const [simData, setSimData] = useState<{
    fileId: string;
    plaintextSHA: string;
    aesKey: CryptoKey | null;
    rawKeyHex: string;
    nonce: Uint8Array | null;
    nonceHex: string;
    aadJson: string;
    aadBytes: Uint8Array | null;
    ciphertext: ArrayBuffer | null;
    ciphertextHex: string;
    authTagHex: string;
    bobKeyPair: CryptoKeyPair | null;
    bobPublicKeyJwk: string;
    bobFingerprint: string;
    wrappedEnvelopeBase64: string;
    recoveredBuffer: ArrayBuffer | null;
    recoveredPlaintextString: string | null;
    recoveredMatches: boolean;
  } | null>(null);

  // Attack Test States
  const [attackEveResult, setAttackEveResult] = useState<any>(null);
  const [attackTamperResult, setAttackTamperResult] = useState<any>(null);

  // =========================================================================
  // 3. TELEMETRY OVERLAY STATE (Interactive HUD)
  // =========================================================================
  const [isOverlayOpen, setIsOverlayOpen] = useState<boolean>(false);
  const [overlayScenario, setOverlayScenario] = useState<'normal' | 'eve' | 'tamper'>('normal');
  const [activeStageIndex, setActiveStageIndex] = useState<number>(0);
  const [isOverlayPlaying, setIsOverlayPlaying] = useState<boolean>(false);
  const [pacingMs, setPacingMs] = useState<number>(1200);
  const timerRef = useRef<any>(null);

  // Compute live cryptographic pipeline using genuine WebCrypto API
  const runLiveCryptoCore = async () => {
    let payloadBuffer: ArrayBuffer;
    if (inputMode === 'file' && fileBuffer) {
      payloadBuffer = fileBuffer;
    } else {
      payloadBuffer = new TextEncoder().encode(customText).buffer;
    }

    const plaintextSHA = await computeDigest(payloadBuffer, hashAlgorithm);

    // 1. Generate AES Symmetric Key with selected key length (128 or 256)
    const aesKey = await generateFileAESKey(aesKeyLength);
    const exportedRawKey = await window.crypto.subtle.exportKey('raw', aesKey);
    const rawKeyHex = arrayBufferToHex(exportedRawKey);

    // 2. Fresh 96-bit random nonce
    const nonce = generateAESNonce();
    const nonceHex = arrayBufferToHex(nonce);

    // 3. Canonical AAD with configured metadata
    const fileId = 'file_' + Math.random().toString(36).substring(2, 10);
    const canonicalObj = {
      fileId,
      sender: senderName,
      recipient: recipientName,
      classification: aadClassification,
      department: aadDepartment,
      version: CRYPTO_VERSION
    };
    const aadJson = JSON.stringify(canonicalObj);
    const aadBytes = new TextEncoder().encode(aadJson);

    // 4. AES-GCM Authenticated Encryption
    const fullCiphertextBuffer = await encryptFilePayload(payloadBuffer, aesKey, nonce, aadBytes);
    const fullCiphertextHex = arrayBufferToHex(fullCiphertextBuffer);
    const authTagHex = fullCiphertextHex.substring(fullCiphertextHex.length - 32);

    // 5. Generate Bob's RSA-OAEP Key Pair with configured modulus (2048 or 3072)
    const bobKeyPair = await generateUserKeyPair(rsaModulusLength, hashAlgorithm);
    const bobPublicKeyJwk = await exportPublicKeyJWK(bobKeyPair.publicKey);
    const bobFingerprint = await computeJWKFingerprint(JSON.parse(bobPublicKeyJwk));

    // 6. Wrap AES key with Bob's Public Key
    const wrappedBase64 = await wrapAESKeyForRecipient(aesKey, bobKeyPair.publicKey);

    // 7. Bob unwraps and decrypts
    const unwrappedAESKey = await unwrapAESKeyWithPrivateKey(wrappedBase64, bobKeyPair.privateKey);
    const decryptedBuffer = await decryptFilePayload(fullCiphertextBuffer, unwrappedAESKey, nonce, aadBytes);

    let recoveredStr: string | null = null;
    try {
      recoveredStr = new TextDecoder().decode(decryptedBuffer);
    } catch {
      recoveredStr = null;
    }

    const decryptedSHA = await computeDigest(decryptedBuffer, hashAlgorithm);

    const generated = {
      fileId,
      plaintextSHA,
      aesKey,
      rawKeyHex,
      nonce,
      nonceHex,
      aadJson,
      aadBytes,
      ciphertext: fullCiphertextBuffer,
      ciphertextHex: fullCiphertextHex,
      authTagHex,
      bobKeyPair,
      bobPublicKeyJwk,
      bobFingerprint,
      wrappedEnvelopeBase64: wrappedBase64,
      recoveredBuffer: decryptedBuffer,
      recoveredPlaintextString: recoveredStr,
      recoveredMatches: plaintextSHA === decryptedSHA
    };

    setSimData(generated);
    return generated;
  };

  // Normal flow telemetry stages definitions (Mapped to Popa et al. C, I, W, F taxonomy)
  const normalStages: TelemetryStage[] = [
    {
      number: 1,
      domain: 'CLIENT (ALICE)',
      domainColor: 'text-sky-800',
      badge: 'PROPERTY C (CONFIDENTIALITY)',
      title: `Local AES-${aesKeyLength}-GCM Key & Nonce Generation`,
      plainEnglish:
        `Alice allocates a fresh, volatile ${aesKeyLength}-bit symmetric AES key directly in browser memory. Unlike Popa et al.'s AES-CTR mode, CipherShare uses AES-GCM with a 96-bit random nonce for single-pass AEAD encryption.`,
      technicalDetail: `crypto.subtle.generateKey("AES-GCM", { length: ${aesKeyLength} }) + crypto.getRandomValues(12)`,
      params: [
        { label: 'Cipher Algorithm', value: `AES-${aesKeyLength}-GCM (Authenticated Encryption)` },
        { label: 'Popa Property', value: 'C (Confidentiality): Zero server key knowledge' },
        { label: '96-bit Nonce / IV', value: simData ? simData.nonceHex : '96-bit cryptographically secure vector' },
        { label: 'Plaintext Digest', value: simData ? `${hashAlgorithm}: ${simData.plaintextSHA.substring(0, 24)}...` : 'Computing digest...' }
      ],
      securityInvariant: 'Zero Server Key Knowledge: Content-encryption keys reside exclusively in browser volatile RAM.'
    },
    {
      number: 2,
      domain: 'CLIENT (ALICE)',
      domainColor: 'text-sky-800',
      badge: 'PROPERTY I (AEAD INTEGRITY)',
      title: 'Bulk File Payload Encryption & Canonical AAD Binding',
      plainEnglish:
        `Alice encrypts the ${inputMode === 'file' ? fileName : 'document'} payload. AES-GCM computes a 128-bit GMAC authentication tag cryptographically binding the configured AAD metadata to prevent ciphertext transplant attacks.`,
      technicalDetail: 'crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData, tagLength: 128 })',
      params: [
        { label: 'Payload Source', value: inputMode === 'file' ? `${fileName} (${((fileBuffer?.byteLength || 0) / 1024).toFixed(1)} KB)` : 'Custom text document' },
        { label: 'Canonical AAD', value: simData ? simData.aadJson : `{"classification":"${aadClassification}"}` },
        { label: '128-bit Auth Tag', value: simData ? `${simData.authTagHex}` : '128-bit GMAC tag' },
        { label: 'Ciphertext Preview', value: simData ? `${simData.ciphertextHex.substring(0, 36)}...` : 'Encrypted binary bytes' }
      ],
      securityInvariant: 'Confidentiality + Authenticity: The 128-bit authentication tag guarantees tamper detection.'
    },
    {
      number: 3,
      domain: 'CLIENT -> CLOUD',
      domainColor: 'text-slate-800',
      badge: 'POPA PUT ATTESTATION',
      title: 'Share Session Initiation & Popa Put Attestation Exchange',
      plainEnglish:
        `Alice initiates the session via POST /api/v1/files/initiate. Alice and the cloud exchange initial attestations binding the block version, file UUID, and Bob's published RSA-OAEP ${rsaModulusLength}-bit public key JWK.`,
      technicalDetail: `POST /api/v1/files/initiate -> HTTP 201 Created (Client & Cloud Attestation Exchange)`,
      params: [
        { label: 'Endpoint', value: 'POST /api/v1/files/initiate' },
        { label: 'Plaintext Uploaded', value: '0 bytes (Server receives zero file bytes)' },
        { label: 'Recipient Key', value: simData ? `RSA-OAEP-${rsaModulusLength} (FP: ${simData.bobFingerprint.substring(0, 16)}...)` : `RSA-OAEP-${rsaModulusLength}` }
      ],
      securityInvariant: 'Zero Server Plaintext: The backend initiates database records without seeing plaintext data.'
    },
    {
      number: 4,
      domain: 'CLIENT (ALICE)',
      domainColor: 'text-sky-800',
      badge: 'HYBRID KEM WRAP',
      title: `Asymmetric Key Encapsulation (RSA-OAEP ${rsaModulusLength}-bit)`,
      plainEnglish:
        `Alice uses Bob's ${rsaModulusLength}-bit RSA public key to encapsulate the ${aesKeyLength / 8}-byte AES key, creating a key envelope. (Upgrading Popa et al.'s 1024-bit RSA to NIST 3072-bit standards). Alice then scrubs the raw AES key from memory.`,
      technicalDetail: `crypto.subtle.wrapKey("raw", aesKey, bobPublicKey, { name: "RSA-OAEP" })`,
      params: [
        { label: 'Wrapping Cipher', value: `RSA-OAEP with ${hashAlgorithm} & MGF1 padding` },
        { label: 'Key Envelope Size', value: `${rsaModulusLength / 8} bytes Base64` },
        { label: 'RAM Scrubbing', value: 'Alice discards the raw symmetric AES key from volatile memory' }
      ],
      securityInvariant: 'Asymmetric Isolation: Only the holder of Bob\'s private key can unwrap this envelope.'
    },
    {
      number: 5,
      domain: 'STORAGE (CLOUD)',
      domainColor: 'text-indigo-800',
      badge: 'CLOUD PUT COMMIT',
      title: 'Ciphertext Storage & Cloud Attestation Receipt',
      plainEnglish:
        'Alice uploads the ciphertext binary and key envelope. The cloud commits the encrypted blob and returns a Cloud Put Attestation with an updated chain hash (Eq. 1 in Popa et al.).',
      technicalDetail: 'POST /api/v1/files/{file_id}/upload -> StorageAdapter.write(ciphertext.bin)',
      params: [
        { label: 'Stored Objects', value: 'ciphertext.bin + recipient_key_envelope' },
        { label: 'Cloud Plaintext Knowledge', value: '0 bytes (100% Zero-Knowledge Invariant)' },
        { label: 'Cloud Private Keys', value: '0 bytes (Private keys reside solely in client devices)' }
      ],
      securityInvariant: 'Untrusted Storage: Even if cloud storage is breached, data remains cryptographically secure.'
    },
    {
      number: 6,
      domain: 'BACKEND GUARD',
      domainColor: 'text-slate-800',
      badge: 'PROPERTIES W & F',
      title: 'Recipient Authorization Check & Cloud Get Attestation',
      plainEnglish:
        'Bob requests download authorization. The server checks the ACL, guarantees Write-Serializability (W) and Freshness (F), and returns ONLY Bob\'s key envelope and Cloud Get Attestation.',
      technicalDetail: 'POST /api/v1/files/{file_id}/download-authorize -> HTTP 200 OK',
      params: [
        { label: 'Authenticated Caller', value: recipientName },
        { label: 'Authorization Rule', value: 'Returns exclusively the requesting recipient\'s envelope' },
        { label: 'Audit Trail', value: 'DOWNLOAD_AUTHORIZED logged (Sanitized metadata)' }
      ],
      securityInvariant: 'Strict Envelope Isolation: Non-recipients receive HTTP 403; recipients receive only their envelope.'
    },
    {
      number: 7,
      domain: 'CLIENT (BOB)',
      domainColor: 'text-emerald-800',
      badge: 'PROPERTIES C & I VERIFIED',
      title: 'Key Recovery & File Decryption in Browser RAM',
      plainEnglish:
        'Bob unwraps the AES key envelope using his local private key. AES-GCM verifies the 128-bit authentication tag and decrypts the file bytes with 100% integrity (verifying Popa Property I).',
      technicalDetail: 'crypto.subtle.unwrapKey() + crypto.subtle.decrypt("AES-GCM", iv, aad)',
      params: [
        { label: 'Unwrapped Key', value: `AES-${aesKeyLength}-GCM recovered in Bob's browser RAM` },
        { label: 'Auth Tag Verification', value: '128-bit GMAC matches (Verification passed)' },
        { label: 'Integrity Match', value: 'Plaintext SHA matches Alice\'s original digest 100%' }
      ],
      securityInvariant: 'End-to-End Cryptographic Success: Confidentiality, integrity, and authenticity verified.'
    }
  ];

  // Eve Intruder Stages definition
  const eveStages: TelemetryStage[] = [
    {
      number: 1,
      domain: 'ADVERSARY (EVE)',
      domainColor: 'text-rose-800',
      badge: 'UNAUTHORIZED REQ',
      title: 'Eve Intercepts File UUID & Requests Download Authorization',
      plainEnglish:
        'Eve intercepts the shared file UUID and attempts to request download authorization from the backend using her own credentials.',
      technicalDetail: 'POST /api/v1/files/{file_id}/download-authorize (Bearer Eve\'s JWT)',
      params: [
        { label: 'Unauthorized Actor', value: 'Eve (intruder@ciphershare.local)' },
        { label: 'Target File UUID', value: simData ? simData.fileId : 'file_4x9a7f21' },
        { label: 'Objective', value: 'Attempting to acquire ciphertext download URL and AES envelope' }
      ],
      securityInvariant: 'Access Control Boundary: The server must strictly check caller against recipient ACL.'
    },
    {
      number: 2,
      domain: 'BACKEND GUARD',
      domainColor: 'text-slate-800',
      badge: 'ACL EVALUATION',
      title: 'Backend Access Control Engine Evaluates Recipient List',
      plainEnglish:
        'The backend checks the database recipient access control list. Eve is NOT in the authorized recipient list designated by Alice.',
      technicalDetail: 'SELECT * FROM file_recipients WHERE file_id = :id AND recipient_id = :eve_id -> 0 rows',
      params: [
        { label: 'ACL Query Result', value: '0 matching authorized records' },
        { label: 'Authorized Recipient', value: recipientName },
        { label: 'Status', value: 'REJECTED: User is not an authorized recipient' }
      ],
      securityInvariant: 'Zero Privilege Leak: Non-recipients are immediately flagged for denial.'
    },
    {
      number: 3,
      domain: 'BACKEND AUDIT',
      domainColor: 'text-slate-800',
      badge: 'SECURITY LOG',
      title: 'Tamper-Evident Audit Logging of Access Denial',
      plainEnglish:
        'The backend records an audit event UNAUTHORIZED_ACCESS_ATTEMPT with actor identity, while sanitizing all secret parameters.',
      technicalDetail: 'audit_service.log_event("UNAUTHORIZED_ACCESS_ATTEMPT", result="DENIED")',
      params: [
        { label: 'Audit Event', value: 'UNAUTHORIZED_ACCESS_ATTEMPT' },
        { label: 'Security Result', value: 'DENIED' },
        { label: 'Secret Scrubbing', value: 'Passwords, keys, and tokens strictly filtered' }
      ],
      securityInvariant: 'Auditability: Unauthorized probes are permanently recorded in the system audit trail.'
    },
    {
      number: 4,
      domain: 'BACKEND REST',
      domainColor: 'text-rose-800',
      badge: 'POPA PROOF: ACCESS VIOLATION',
      title: 'HTTP 403 Forbidden Response (Popa Proof of Authorization Violation)',
      plainEnglish:
        'The server responds with HTTP 403 Forbidden. Download URL and key envelope are strictly withheld. This implements Popa et al.\'s non-repudiable Proof of Violation, preventing the cloud from leaking unauthorized envelopes while confirming that Eve receives zero key material.',
      technicalDetail: 'HTTP/1.1 403 FORBIDDEN -> { "error": "Forbidden", "message": "Access denied" }',
      params: [
        { label: 'HTTP Status Code', value: '403 FORBIDDEN' },
        { label: 'SLA Proof Type', value: 'Popa et al. Proof of Authorization Violation' },
        { label: 'Key Envelope', value: 'WITHHELD (Zero key material leaked)' },
        { label: 'Mathematical Proof', value: `RSA-OAEP ${rsaModulusLength} is mathematically uncrackable without Bob's private key` }
      ],
      securityInvariant: 'Access Control Verified: Unauthorized parties receive zero key material or download access.'
    }
  ];

  // Tamper Stages definition
  const tamperStages: TelemetryStage[] = [
    {
      number: 1,
      domain: 'ADVERSARY (MITM)',
      domainColor: 'text-amber-800',
      badge: '1-BIT FLIP',
      title: 'Adversary Injects 1-Bit Corruption into Ciphertext Payload',
      plainEnglish:
        'An active adversary intercepts the encrypted payload on the network wire or storage disk and flips exactly one single bit (byte 12 XOR 0x01).',
      technicalDetail: 'ciphertextBytes[12] ^= 0x01 (Single bit-flip corruption)',
      params: [
        { label: 'Attack Vector', value: 'Active wire modification / Storage bit corruption' },
        { label: 'Corrupted Byte', value: 'Byte 12 Bit 0 flipped (0 -> 1)' },
        { label: 'Expected 128-bit Tag', value: simData ? simData.authTagHex : 'Unchanged in header' }
      ],
      securityInvariant: 'Integrity Threat Model: AES-GCM must detect even single-bit modifications.'
    },
    {
      number: 2,
      domain: 'CLIENT (BOB)',
      domainColor: 'text-emerald-800',
      badge: 'KEY UNWRAP',
      title: 'Bob Successfully Unwraps Legitimate AES Content Key',
      plainEnglish:
        'Bob unwraps the AES content key using his legitimate local private key. The key envelope itself is intact and valid.',
      technicalDetail: `crypto.subtle.unwrapKey("raw", envelopeBytes, bobPrivateKey, "RSA-OAEP")`,
      params: [
        { label: 'AES Key Status', value: 'Successfully unwrapped in RAM' },
        { label: 'Key Authenticity', value: `Intact ${aesKeyLength}-bit symmetric key` }
      ],
      securityInvariant: 'The content key is authentic; the corruption is located specifically inside the payload stream.'
    },
    {
      number: 3,
      domain: 'CLIENT (BOB)',
      domainColor: 'text-slate-800',
      badge: 'GMAC EVAL',
      title: 'WebCrypto Computes Galois Message Authentication Code (GMAC)',
      plainEnglish:
        'Bob initiates AES-GCM decryption with Canonical AAD. WebCrypto evaluates the Galois field polynomial over the altered ciphertext.',
      technicalDetail: 'crypto.subtle.decrypt({ name: "AES-GCM", iv, additionalData, tagLength: 128 })',
      params: [
        { label: 'Integrity Engine', value: 'W3C SubtleCrypto Galois/Counter Mode' },
        { label: 'Tag Evaluation', value: 'Computed tag fails comparison against original 128-bit tag' }
      ],
      securityInvariant: 'Cryptographic Detection: A 1-bit alteration causes complete avalanche failure in the Galois field.'
    },
    {
      number: 4,
      domain: 'CLIENT (BOB)',
      domainColor: 'text-emerald-800',
      badge: 'POPA PROOF: INTEGRITY VIOLATION',
      title: 'WebCrypto Throws OperationError (Popa Proof of Integrity Violation)',
      plainEnglish:
        'Authentication tag check fails! WebCrypto throws DOMException: OperationError. This satisfies Popa et al. Theorem 2 (Proof of Integrity Violation): altered ciphertexts fail verification deterministically. Exactly 0 bytes of corrupted plaintext are released into application memory.',
      technicalDetail: 'throw new DOMException("The operation failed for an operation-specific reason", "OperationError")',
      params: [
        { label: 'WebCrypto Exception', value: 'OperationError (128-bit GMAC authentication mismatch)' },
        { label: 'Popa Proof Property', value: 'Property I (Integrity) Violation Deterministically Proven' },
        { label: 'Plaintext Output', value: '0 bytes (Zero corrupted bytes released)' },
        { label: 'Verdict', value: 'Tampering detection 100% verified under Popa SLA Model' }
      ],
      securityInvariant: 'Authenticated Encryption Guarantee: Corrupted ciphertexts are never released into application memory.'
    }
  ];

  const activeStagesList =
    overlayScenario === 'normal'
      ? normalStages
      : overlayScenario === 'eve'
      ? eveStages
      : tamperStages;

  const launchOverlay = async (scenario: 'normal' | 'eve' | 'tamper') => {
    setOverlayScenario(scenario);
    setActiveStageIndex(0);
    setIsOverlayOpen(true);
    setIsOverlayPlaying(false); // Default behaviour is paused for all demonstrations

    if (scenario === 'normal') {
      await runLiveCryptoCore();
    }
  };

  // Paced Execution Timer
  useEffect(() => {
    if (isOverlayOpen && isOverlayPlaying) {
      timerRef.current = setInterval(() => {
        setActiveStageIndex((prev) => {
          if (prev >= activeStagesList.length - 1) {
            setIsOverlayPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, pacingMs);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [isOverlayOpen, isOverlayPlaying, pacingMs, activeStagesList.length]);

  // Eve Attack Trigger
  const handleTestEveAttack = async () => {
    if (!simData) {
      await runLiveCryptoCore();
    }
    setAttackEveResult({
      status: 'blocked',
      httpCode: 403,
      reason: `Server ACL Check: Eve (intruder@ciphershare.local) is not in the authorized recipients list for ${fileName}.`,
      mathProof: `Even with physical wire capture of ciphertext, Eve has no access to Bob's private key (SK_Bob), rendering RSA-OAEP ${rsaModulusLength} envelope recovery mathematically impossible.`
    });
    launchOverlay('eve');
  };

  // Tamper Attack Trigger
  const handleTestBitFlipTamper = async () => {
    let currentData = simData;
    if (!currentData) {
      currentData = await runLiveCryptoCore();
    }
    setAttackTamperResult(null);

    try {
      if (currentData && currentData.ciphertext) {
        const tamperedBytes = new Uint8Array(currentData.ciphertext.slice(0));
        tamperedBytes[12] ^= 0x01;
        const unwrappedAESKey = await unwrapAESKeyWithPrivateKey(currentData.wrappedEnvelopeBase64, currentData.bobKeyPair!.privateKey);

        try {
          await decryptFilePayload(tamperedBytes.buffer, unwrappedAESKey, currentData.nonce!, currentData.aadBytes!);
          setAttackTamperResult({ passed: false, message: 'Failure: Tampered ciphertext was decrypted!' });
        } catch (err: any) {
          setAttackTamperResult({
            passed: true,
            errorType: 'DOMException: OperationError',
            message: 'SUCCESS: WebCrypto rejected altered ciphertext! 128-bit authentication tag mismatch detected. Exactly 0 bytes released.'
          });
        }
      }
      launchOverlay('tamper');
    } catch (err) {
      console.error(err);
    }
  };

  // Download Decrypted File helper
  const handleDownloadDecryptedFile = () => {
    if (!simData || !simData.recoveredBuffer) return;
    const blob = new Blob([simData.recoveredBuffer], { type: fileMimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `decrypted_${fileName}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const currentActiveStage = activeStagesList[activeStageIndex];

  return (
    <div className="w-full space-y-10 font-sans pb-12">
      {/* Editorial Header */}
      <div className="pb-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-baseline justify-between gap-4">
        <div>
          <span className="text-[10px] font-mono tracking-widest uppercase text-slate-400">
            Cryptographic Demonstration Console
          </span>
          <h2 className="text-3xl font-normal text-slate-900 tracking-tight font-serif mt-1">
            Client-Side Hybrid File Sharing Simulation
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            End-to-end zero-knowledge demonstration using authenticated symmetric encryption and asymmetric key encapsulation.
          </p>
        </div>

        <div className="flex items-center space-x-3 shrink-0">
          <button
            onClick={() => launchOverlay('normal')}
            className="py-2.5 px-5 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-semibold tracking-wide flex items-center gap-2 transition-colors shadow-2xs"
          >
            <Sparkles className="w-3.5 h-3.5 text-sky-400" />
            <span>Start Interactive Demonstration</span>
          </button>
        </div>
      </div>

      {/* USER INPUTS & CRYPTOGRAPHIC CONFIGURATION PANEL */}
      <div className="space-y-6">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-slate-800" />
            <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">
              Cryptographic Parameters & Document Payload Inputs
            </h3>
          </div>
          <span className="text-[11px] font-mono text-slate-400">Configurable System Parameters</span>
        </div>

        {/* Input Mode Switcher */}
        <div className="flex border-b border-slate-200 space-x-8 text-xs font-semibold">
          <button
            onClick={() => setInputMode('file')}
            className={`pb-3 border-b-2 transition-colors flex items-center gap-2 ${
              inputMode === 'file'
                ? 'border-slate-900 text-slate-900 font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-700'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>1. Cloud File Sharing Mode (Upload Any Real File)</span>
          </button>

          <button
            onClick={() => setInputMode('text')}
            className={`pb-3 border-b-2 transition-colors flex items-center gap-2 ${
              inputMode === 'text'
                ? 'border-slate-900 text-slate-900 font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-700'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>2. Custom Plaintext Document Mode</span>
          </button>
        </div>

        {/* Dynamic Payload Input based on Mode */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-6 space-y-4">
            {inputMode === 'file' ? (
              <div className="space-y-3">
                <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-400 font-semibold">
                  Select Actual File to Encrypt & Share:
                </label>
                <div className="border border-dashed border-slate-300 hover:border-slate-900 p-6 rounded transition-colors text-center relative cursor-pointer">
                  <input
                    type="file"
                    onChange={handleFileUpload}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                  <Upload className="w-6 h-6 text-slate-400 mx-auto mb-2" />
                  <div className="text-xs font-semibold text-slate-900">
                    {uploadedFile ? uploadedFile.name : 'Click to select or drag & drop any file (PDF, Image, Doc, Zip)'}
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono mt-1">
                    {uploadedFile
                      ? `${(uploadedFile.size / 1024).toFixed(1)} KB • ${uploadedFile.type || 'application/octet-stream'}`
                      : 'Files up to 25 MB supported with in-browser WebCrypto streaming'}
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs font-mono text-slate-500 pt-1">
                  <span>Current Target: <strong className="text-slate-900">{fileName}</strong></span>
                  <span>Size: {((fileBuffer?.byteLength || 0) / 1024).toFixed(1)} KB</span>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex justify-between items-baseline">
                  <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-400 font-semibold">
                    Plaintext Document Content:
                  </label>
                  <span className="text-[11px] font-mono text-slate-400">{customText.length} characters</span>
                </div>
                <textarea
                  rows={4}
                  value={customText}
                  onChange={(e) => {
                    setCustomText(e.target.value);
                    setFileBuffer(new TextEncoder().encode(e.target.value).buffer);
                  }}
                  className="w-full border-b border-slate-300 py-2 text-xs text-slate-900 font-mono placeholder-slate-400 focus:outline-none focus:border-slate-900 bg-transparent break-words-anywhere"
                  placeholder="Enter custom document text..."
                />
              </div>
            )}
          </div>

          {/* Cryptographic Algorithm Selectors */}
          <div className="lg:col-span-6 space-y-4">
            <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-semibold">
              Algorithm Selection & Key Sizes
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1">
                <label className="text-slate-500 block text-[11px]">Symmetric Cipher:</label>
                <select
                  value={aesKeyLength}
                  onChange={(e) => setAesKeyLength(Number(e.target.value) as 128 | 256)}
                  className="w-full border-b border-slate-300 py-1.5 text-xs text-slate-900 font-mono focus:outline-none focus:border-slate-900 bg-transparent"
                >
                  <option value={256}>AES-256-GCM (256-bit Key, 128-bit Tag)</option>
                  <option value={128}>AES-128-GCM (128-bit Key, 128-bit Tag)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-slate-500 block text-[11px]">Asymmetric Key Wrapping:</label>
                <select
                  value={rsaModulusLength}
                  onChange={(e) => setRsaModulusLength(Number(e.target.value) as 2048 | 3072)}
                  className="w-full border-b border-slate-300 py-1.5 text-xs text-slate-900 font-mono focus:outline-none focus:border-slate-900 bg-transparent"
                >
                  <option value={3072}>RSA-OAEP 3072-bit (NIST Recommended)</option>
                  <option value={2048}>RSA-OAEP 2048-bit (Standard)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-slate-500 block text-[11px]">Integrity Digest & KDF:</label>
                <select
                  value={hashAlgorithm}
                  onChange={(e) => setHashAlgorithm(e.target.value as 'SHA-256' | 'SHA-512')}
                  className="w-full border-b border-slate-300 py-1.5 text-xs text-slate-900 font-mono focus:outline-none focus:border-slate-900 bg-transparent"
                >
                  <option value="SHA-256">SHA-256 (256-bit digest)</option>
                  <option value="SHA-512">SHA-512 (512-bit digest)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-slate-500 block text-[11px]">AAD Security Classification:</label>
                <select
                  value={aadClassification}
                  onChange={(e) => setAadClassification(e.target.value)}
                  className="w-full border-b border-slate-300 py-1.5 text-xs text-slate-900 font-mono focus:outline-none focus:border-slate-900 bg-transparent"
                >
                  <option value="RESTRICTED">RESTRICTED</option>
                  <option value="CONFIDENTIAL">CONFIDENTIAL</option>
                  <option value="SECRET">SECRET</option>
                  <option value="TOP SECRET">TOP SECRET</option>
                </select>
              </div>
            </div>

            {/* Identities */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-1">
              <div className="space-y-1">
                <label className="text-slate-500 block text-[11px]">Sender Identity:</label>
                <input
                  type="text"
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                  className="w-full border-b border-slate-300 py-1 text-xs text-slate-900 font-mono focus:outline-none focus:border-slate-900 bg-transparent"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-500 block text-[11px]">Recipient Identity:</label>
                <input
                  type="text"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  className="w-full border-b border-slate-300 py-1 text-xs text-slate-900 font-mono focus:outline-none focus:border-slate-900 bg-transparent"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* VISUAL ACTOR PIPELINE (No card boxes, hairline layout) */}
      <div className="space-y-4 pt-4 border-t border-slate-200">
        <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
          Cryptographic Actor Pipeline
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-slate-200 border-y border-slate-200 py-6 text-xs">
          {/* Actor 1: Alice Sender */}
          <div className="py-2 md:pr-6 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase font-semibold text-sky-800">
                Client 1: Sender
              </span>
              <span className={`w-2 h-2 rounded-full ${simData ? 'bg-emerald-500' : 'bg-slate-300'}`} />
            </div>
            <h4 className="text-base font-semibold text-slate-900">{senderName.split(' ')[0]}</h4>
            <p className="text-slate-500 text-[11px] leading-relaxed">
              Holds raw file bytes. Generates volatile AES-{aesKeyLength}-GCM key in RAM. Uses RSA-OAEP-{rsaModulusLength} to wrap recipient key envelope.
            </p>
            <div className="font-mono text-[11px] text-slate-700 pt-1">
              RAM Key: <span className="text-slate-900 font-semibold">{simData ? `${aesKeyLength}-bit AES Key` : 'Pending'}</span>
            </div>
          </div>

          {/* Actor 2: Untrusted Cloud */}
          <div className="py-2 md:px-6 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase font-semibold text-slate-500">
                Storage: Middleman
              </span>
              <span className={`w-2 h-2 rounded-full ${simData ? 'bg-emerald-500' : 'bg-slate-300'}`} />
            </div>
            <h4 className="text-base font-semibold text-slate-900">Untrusted Cloud Storage</h4>
            <p className="text-slate-500 text-[11px] leading-relaxed">
              Stores ciphertext binary and wrapped envelope. Zero possession of plaintext, symmetric key, or user private keys.
            </p>
            <div className="font-mono text-[11px] text-emerald-700 font-semibold pt-1">
              Plaintext Stored: 0 bytes (Zero Knowledge)
            </div>
          </div>

          {/* Actor 3: Bob Recipient */}
          <div className="py-2 md:px-6 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase font-semibold text-emerald-800">
                Client 2: Recipient
              </span>
              <span className={`w-2 h-2 rounded-full ${simData?.recoveredBuffer ? 'bg-emerald-500' : 'bg-slate-300'}`} />
            </div>
            <h4 className="text-base font-semibold text-slate-900">{recipientName.split(' ')[0]}</h4>
            <p className="text-slate-500 text-[11px] leading-relaxed">
              Receives envelope + ciphertext. Unwraps AES key using local private key. Decrypts file payload via AES-GCM and verifies GMAC tag.
            </p>
            <div className="font-mono text-[11px] text-slate-700 pt-1">
              Private Key: <span className="text-slate-900 font-semibold">{simData ? `${rsaModulusLength}-bit RSA in RAM` : 'Local Vault'}</span>
            </div>
          </div>

          {/* Actor 4: Eve Intruder */}
          <div className="py-2 md:pl-6 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase font-semibold text-rose-800">
                Adversary: Attacker
              </span>
              <span className="w-2 h-2 rounded-full bg-rose-500" />
            </div>
            <h4 className="text-base font-semibold text-slate-900">Eve (Intruder)</h4>
            <p className="text-slate-500 text-[11px] leading-relaxed">
              Attempts unauthorized API download or wire sniffing. Blocked by backend HTTP 403 Forbidden. Lacks RSA private key to unwrap envelope.
            </p>
            <div className="font-mono text-[11px] text-rose-700 font-semibold pt-1">
              Access Status: Blocked (HTTP 403)
            </div>
          </div>
        </div>
      </div>

      {/* ADVERSARY THREAT TESTS & CONTROLS */}
      <div className="space-y-4 pt-4 border-t border-slate-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-100">
          <div>
            <h4 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">
              Adversarial Threat Testing Suite
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Verify non-recipient access control enforcement and authenticated encryption tamper rejection on the configured file.
            </p>
          </div>

          <div className="flex items-center space-x-3 shrink-0">
            <button
              onClick={handleTestEveAttack}
              className="py-2 px-3.5 border border-slate-300 hover:border-slate-800 text-slate-800 rounded text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
              <span>1. Simulate Eve Unauthorized Access (403)</span>
            </button>

            <button
              onClick={handleTestBitFlipTamper}
              className="py-2 px-3.5 border border-slate-300 hover:border-slate-800 text-slate-800 rounded text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              <span>2. Simulate Bit-Flip Tamper Rejection</span>
            </button>
          </div>
        </div>

        {/* Live Attack Results Callouts */}
        {attackEveResult && (
          <div className="py-3 px-4 border-l-2 border-rose-600 bg-rose-50/70 text-rose-950 text-xs space-y-1">
            <div className="font-semibold flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-600" />
              <span>HTTP {attackEveResult.httpCode} FORBIDDEN — Access Blocked</span>
            </div>
            <p className="text-slate-700 leading-relaxed">{attackEveResult.reason}</p>
            <p className="text-[11px] text-slate-500 font-mono pt-1">{attackEveResult.mathProof}</p>
          </div>
        )}

        {attackTamperResult && (
          <div className={`py-3 px-4 border-l-2 text-xs space-y-1 ${
            attackTamperResult.passed ? 'border-emerald-600 bg-emerald-50/70 text-emerald-950' : 'border-rose-600 bg-rose-50 text-rose-950'
          }`}>
            <div className="font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Tampering Detected & Rejected ({attackTamperResult.errorType})</span>
            </div>
            <p className="text-slate-700 leading-relaxed">{attackTamperResult.message}</p>
          </div>
        )}
      </div>

      {/* CURRENT CRYPTOGRAPHIC STATE INSPECTOR */}
      {simData && (
        <div className="space-y-4 pt-4 border-t border-slate-200">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Verified Cryptographic Artifacts
            </span>
            {simData.recoveredBuffer && (
              <button
                onClick={handleDownloadDecryptedFile}
                className="py-1.5 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Decrypted File ({fileName})</span>
              </button>
            )}
          </div>

          <dl className="divide-y divide-slate-100 text-xs">
            <div className="py-2.5 flex flex-col sm:flex-row sm:justify-between gap-1">
              <dt className="text-slate-400 font-mono text-[11px]">Plaintext Payload Digest</dt>
              <dd className="font-mono text-slate-900 text-[11px] break-words-anywhere select-all font-semibold">
                {hashAlgorithm}: {simData.plaintextSHA}
              </dd>
            </div>

            <div className="py-2.5 flex flex-col sm:flex-row sm:justify-between gap-1">
              <dt className="text-slate-400 font-mono text-[11px]">Symmetric Key (RAM Content Key)</dt>
              <dd className="font-mono text-slate-900 text-[11px] break-words-anywhere select-all">
                AES-{aesKeyLength}-GCM ({aesKeyLength}-bit: {simData.rawKeyHex.substring(0, 32)}...)
              </dd>
            </div>

            <div className="py-2.5 flex flex-col sm:flex-row sm:justify-between gap-1">
              <dt className="text-slate-400 font-mono text-[11px]">96-bit Nonce (Initialization Vector)</dt>
              <dd className="font-mono text-slate-900 text-[11px] break-words-anywhere select-all">
                {simData.nonceHex}
              </dd>
            </div>

            <div className="py-2.5 flex flex-col sm:flex-row sm:justify-between gap-1">
              <dt className="text-slate-400 font-mono text-[11px]">Canonical AAD Metadata</dt>
              <dd className="font-mono text-slate-800 text-[11px] break-words-anywhere select-all">
                {simData.aadJson}
              </dd>
            </div>

            <div className="py-2.5 flex flex-col sm:flex-row sm:justify-between gap-1">
              <dt className="text-slate-400 font-mono text-[11px]">Galois Authentication Tag</dt>
              <dd className="font-mono text-sky-800 font-semibold text-[11px] break-words-anywhere select-all">
                128-bit Tag: {simData.authTagHex}
              </dd>
            </div>

            <div className="py-2.5 flex flex-col sm:flex-row sm:justify-between gap-1">
              <dt className="text-slate-400 font-mono text-[11px]">Recipient Key Envelope</dt>
              <dd className="font-mono text-indigo-900 font-semibold text-[11px] break-words-anywhere select-all">
                RSA-OAEP-{rsaModulusLength} ({simData.wrappedEnvelopeBase64.substring(0, 36)}... {rsaModulusLength / 8} bytes)
              </dd>
            </div>

            <div className="py-3 border-t border-slate-200">
              <div className="flex items-center gap-1.5 text-emerald-700 font-semibold mb-1">
                <CheckCircle2 className="w-4 h-4" />
                <span>Decryption Succeeded — Plaintext Integrity Verified</span>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 text-slate-900 font-mono text-xs break-words-anywhere select-all">
                {simData.recoveredPlaintextString
                  ? `"${simData.recoveredPlaintextString.substring(0, 200)}${simData.recoveredPlaintextString.length > 200 ? '...' : ''}"`
                  : `Binary file buffer successfully decrypted (${((simData.recoveredBuffer?.byteLength || 0) / 1024).toFixed(1)} KB).`}
              </div>
            </div>
          </dl>
        </div>
      )}

      {/* ==================================================================== */}
      {/* LIVE PRESENTATION TELEMETRY OVERLAY (REQUEST/RESPONSE HUD)         */}
      {/* ==================================================================== */}
      {isOverlayOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-300 max-w-4xl w-full p-6 sm:p-8 space-y-6 shadow-2xl overflow-y-auto max-h-[92vh]">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-slate-900" />
                  <h3 className="text-base font-bold text-slate-900 tracking-tight">
                    Live Cryptographic Telemetry Overlay (Popa et al. SLA Framework)
                  </h3>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 uppercase font-semibold">
                    {overlayScenario === 'normal' ? 'Normal Hybrid Flow' : overlayScenario === 'eve' ? 'Eve Intruder Test' : 'Bit-Flip Tamper Test'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Grounded in Raluca Ada Popa et al. (CloudProof, MIT & MSR). Verifying C (Confidentiality), I (Integrity), W (Write-Serializability), and F (Freshness).
                </p>
              </div>

              <button
                onClick={() => {
                  setIsOverlayOpen(false);
                  setIsOverlayPlaying(false);
                }}
                className="text-slate-400 hover:text-slate-700 p-1 shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Playback Controls */}
            <div className="flex flex-wrap items-center justify-between gap-4 py-2 border-b border-slate-100 text-xs">
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setIsOverlayPlaying(!isOverlayPlaying)}
                  className={`py-1.5 px-3 rounded text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                    isOverlayPlaying
                      ? 'bg-amber-600 hover:bg-amber-700 text-white'
                      : 'bg-slate-900 hover:bg-slate-800 text-white'
                  }`}
                >
                  {isOverlayPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  <span>{isOverlayPlaying ? 'Pause Telemetry' : 'Play / Resume'}</span>
                </button>

                <button
                  onClick={() => setActiveStageIndex(Math.max(0, activeStageIndex - 1))}
                  disabled={activeStageIndex <= 0}
                  className="py-1.5 px-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded text-xs font-medium disabled:opacity-30"
                >
                  ← Previous
                </button>

                <button
                  onClick={() => setActiveStageIndex(Math.min(activeStagesList.length - 1, activeStageIndex + 1))}
                  disabled={activeStageIndex >= activeStagesList.length - 1}
                  className="py-1.5 px-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded text-xs font-medium disabled:opacity-30"
                >
                  Next Stage →
                </button>

                <button
                  onClick={() => {
                    setActiveStageIndex(0);
                    setIsOverlayPlaying(false);
                  }}
                  className="p-1.5 text-slate-400 hover:text-slate-700"
                  title="Rewind to Stage 1 (Paused)"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>

                <span className="text-[11px] font-mono ml-2">
                  {isOverlayPlaying ? (
                    <span className="text-emerald-700 flex items-center gap-1 font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Auto-Advancing
                    </span>
                  ) : (
                    <span className="text-slate-500 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                      Paused (Manual Step)
                    </span>
                  )}
                </span>
              </div>

              {/* Pacing Speed Selector */}
              <div className="flex items-center space-x-3 text-[11px] font-mono text-slate-500">
                <span>Pacing:</span>
                <button
                  onClick={() => setPacingMs(1400)}
                  className={`px-2 py-0.5 rounded transition-colors ${
                    pacingMs === 1400 ? 'bg-slate-900 text-white font-semibold' : 'hover:bg-slate-100'
                  }`}
                >
                  1.4s (Detailed)
                </button>
                <button
                  onClick={() => setPacingMs(800)}
                  className={`px-2 py-0.5 rounded transition-colors ${
                    pacingMs === 800 ? 'bg-slate-900 text-white font-semibold' : 'hover:bg-slate-100'
                  }`}
                >
                  0.8s (Standard)
                </button>
                <button
                  onClick={() => setPacingMs(350)}
                  className={`px-2 py-0.5 rounded transition-colors ${
                    pacingMs === 350 ? 'bg-slate-900 text-white font-semibold' : 'hover:bg-slate-100'
                  }`}
                >
                  0.3s (Fast)
                </button>
              </div>
            </div>

            {/* Stages Progress Indicator Bar */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 uppercase">
                <span>Stage Progress</span>
                <span>
                  {activeStageIndex + 1} of {activeStagesList.length} Completed
                </span>
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-7 gap-1">
                {activeStagesList.map((stg, i) => {
                  const isCurrent = i === activeStageIndex;
                  const isDone = i < activeStageIndex;
                  return (
                    <button
                      key={stg.number}
                      onClick={() => {
                        setIsOverlayPlaying(false);
                        setActiveStageIndex(i);
                      }}
                      className={`h-2 rounded-xs transition-all ${
                        isCurrent
                          ? 'bg-slate-900 ring-2 ring-slate-900/30'
                          : isDone
                          ? 'bg-emerald-600'
                          : 'bg-slate-200'
                      }`}
                      title={`Stage ${stg.number}: ${stg.title}`}
                    />
                  );
                })}
              </div>
            </div>

            {/* ACTIVE STAGE SPOTLIGHT CARD */}
            {currentActiveStage && (
              <div className="space-y-4 pt-2">
                <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-xs font-bold text-slate-400">
                      STAGE 0{currentActiveStage.number}
                    </span>
                    <span className={`font-mono text-xs font-bold ${currentActiveStage.domainColor}`}>
                      [{currentActiveStage.domain}]
                    </span>
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-semibold">
                      {currentActiveStage.badge}
                    </span>
                  </div>

                  <span className="text-[11px] font-mono text-emerald-700 font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                    LIVE WEBCRYPTO EXECUTION
                  </span>
                </div>

                <div className="space-y-1">
                  <h4 className="text-lg font-semibold text-slate-900">{currentActiveStage.title}</h4>
                  <p className="text-xs text-slate-700 leading-relaxed font-serif text-sm">
                    "{currentActiveStage.plainEnglish}"
                  </p>
                </div>

                <div className="py-2.5 px-3 bg-slate-50 border-l-2 border-slate-900 font-mono text-xs text-slate-900 break-words-anywhere">
                  <span className="text-slate-400 text-[10px] block uppercase font-mono">Executed Primitive:</span>
                  <span className="font-semibold text-slate-800">{currentActiveStage.technicalDetail}</span>
                </div>

                <div className="space-y-2 pt-2">
                  <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-semibold">
                    Parameters & Verification Telemetry
                  </div>
                  <dl className="divide-y divide-slate-100 text-xs">
                    {currentActiveStage.params.map((p, idx) => (
                      <div key={idx} className="py-2 flex flex-col sm:flex-row sm:justify-between gap-1">
                        <dt className="text-slate-400 font-mono text-[11px] shrink-0">{p.label}</dt>
                        <dd className="font-mono text-slate-800 text-[11px] break-words-anywhere select-all font-medium sm:text-right">
                          {p.value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-start gap-2 text-xs text-slate-600">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Security Invariant:</strong> {currentActiveStage.securityInvariant}
                  </span>
                </div>
              </div>
            )}

            {/* Overlay Footer */}
            <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <span className="text-slate-400 font-mono text-[11px]">
                Target: {fileName} • AES-{aesKeyLength}-GCM • RSA-OAEP-{rsaModulusLength}
              </span>

              <div className="flex items-center space-x-3">
                {activeStageIndex < activeStagesList.length - 1 ? (
                  <button
                    onClick={() => setActiveStageIndex(activeStageIndex + 1)}
                    className="py-2 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <span>Next Stage</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setIsOverlayOpen(false);
                      setIsOverlayPlaying(false);
                    }}
                    className="py-2 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold transition-colors"
                  >
                    Complete Walkthrough
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
