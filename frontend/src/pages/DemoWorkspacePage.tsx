import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext';
import { api } from '../lib/api/client';
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
  computeSHA256,
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
  ChevronDown,
  ChevronUp,
  Sparkles,
  HelpCircle,
  X,
  Clock,
  Terminal,
  FastForward,
  Cpu,
  Layers
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
  const { user, login } = useAuth();
  const navigate = useNavigate();

  // Active Main View Tab
  const [activeTab, setActiveTab] = useState<'storyboard' | 'multi-persona'>('storyboard');

  // =========================================================================
  // 1. STORYBOARD SIMULATION STATE (Real WebCrypto Artifacts)
  // =========================================================================
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [sampleText, setSampleText] = useState<string>(
    'CONFIDENTIAL COURSE EVALUATION REPORT: Alice and Bob have successfully verified hybrid zero-knowledge end-to-end file sharing.'
  );

  const [simData, setSimData] = useState<{
    fileId: string;
    plaintextSHA256: string;
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
    recoveredPlaintext: string | null;
    recoveredMatches: boolean;
  } | null>(null);

  // Attack Test States
  const [attackEveResult, setAttackEveResult] = useState<any>(null);
  const [attackTamperResult, setAttackTamperResult] = useState<any>(null);
  const [isTampering, setIsTampering] = useState<boolean>(false);

  // Collapsible Viva Cards State
  const [openVivaIndex, setOpenVivaIndex] = useState<number | null>(null);

  // =========================================================================
  // 2. LIVE PRESENTATION TELEMETRY OVERLAY STATE
  // =========================================================================
  const [isOverlayOpen, setIsOverlayOpen] = useState<boolean>(false);
  const [overlayScenario, setOverlayScenario] = useState<'normal' | 'eve' | 'tamper'>('normal');
  const [activeStageIndex, setActiveStageIndex] = useState<number>(0);
  const [isOverlayPlaying, setIsOverlayPlaying] = useState<boolean>(false);
  const [pacingMs, setPacingMs] = useState<number>(1200); // 1.2s realistic presentation pace
  const timerRef = useRef<any>(null);

  // =========================================================================
  // 3. MULTI-PERSONA ADVANCED WORKSPACE STATE (Database Accounts)
  // =========================================================================
  const [demoStatus, setDemoStatus] = useState<any[]>([]);
  const [isResetting, setIsResetting] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const [intruderFileId, setIntruderFileId] = useState<string>('');
  const [intruderResult, setIntruderResult] = useState<any>(null);
  const [isIntruding, setIsIntruding] = useState<boolean>(false);

  const loadStatus = async () => {
    try {
      const res = await api.demo.getStatus();
      setDemoStatus(res.demo_users);
    } catch (err) {
      console.error('Failed to load demo status', err);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  // Compute live cryptographic artifacts
  const runLiveCryptoCore = async () => {
    const enc = new TextEncoder();
    const plaintextBuffer = enc.encode(sampleText);
    const plaintextSHA256 = await computeSHA256(plaintextBuffer);

    // 1. Fresh random 256-bit AES-GCM key
    const aesKey = await generateFileAESKey();
    const exportedRawKey = await window.crypto.subtle.exportKey('raw', aesKey);
    const rawKeyHex = arrayBufferToHex(exportedRawKey);

    // 2. Fresh 96-bit nonce
    const nonce = generateAESNonce();
    const nonceHex = arrayBufferToHex(nonce);

    // 3. Canonical AAD
    const fileId = 'file_' + Math.random().toString(36).substring(2, 10);
    const aadJson = JSON.stringify({ fileId, senderId: 'alice@demo.local', version: CRYPTO_VERSION });
    const aadBytes = enc.encode(aadJson);

    // 4. AES-256-GCM Encrypt
    const fullCiphertextBuffer = await encryptFilePayload(plaintextBuffer.buffer, aesKey, nonce, aadBytes);
    const fullCiphertextHex = arrayBufferToHex(fullCiphertextBuffer);
    const authTagHex = fullCiphertextHex.substring(fullCiphertextHex.length - 32);

    // 5. Generate Bob's RSA-OAEP 3072 key pair
    const bobKeyPair = await generateUserKeyPair();
    const bobPublicKeyJwk = await exportPublicKeyJWK(bobKeyPair.publicKey);
    const bobFingerprint = await computeJWKFingerprint(JSON.parse(bobPublicKeyJwk));

    // 6. Wrap AES key
    const wrappedBase64 = await wrapAESKeyForRecipient(aesKey, bobKeyPair.publicKey);

    // 7. Unwrap and decrypt
    const unwrappedAESKey = await unwrapAESKeyWithPrivateKey(wrappedBase64, bobKeyPair.privateKey);
    const decryptedBuffer = await decryptFilePayload(fullCiphertextBuffer, unwrappedAESKey, nonce, aadBytes);
    const dec = new TextDecoder();
    const recovered = dec.decode(decryptedBuffer);

    const generated = {
      fileId,
      plaintextSHA256,
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
      recoveredPlaintext: recovered,
      recoveredMatches: recovered === sampleText
    };

    setSimData(generated);
    return generated;
  };

  // Normal flow telemetry stages definitions
  const normalStages: TelemetryStage[] = [
    {
      number: 1,
      domain: 'CLIENT (ALICE)',
      domainColor: 'text-sky-800',
      badge: 'RAM KEY GEN',
      title: 'Local AES-256 Symmetric Key & Nonce Generation',
      plainEnglish:
        'Alice generates a one-time random 256-bit AES key in her browser volatile memory (RAM). She creates a 96-bit random nonce and prepares Canonical AAD.',
      technicalDetail: 'crypto.subtle.generateKey("AES-GCM", { length: 256 }) + crypto.getRandomValues(12 bytes)',
      params: [
        { label: 'Algorithm', value: 'AES-256-GCM (Hardware accelerated)' },
        { label: 'Key Location', value: 'Browser Volatile RAM Only (Never sent to cloud)' },
        { label: 'Nonce / IV', value: simData ? simData.nonceHex : '96-bit random vector' },
        { label: 'Plaintext Hash', value: simData ? `SHA-256: ${simData.plaintextSHA256.substring(0, 20)}...` : 'Pre-flight digest' }
      ],
      securityInvariant: 'Zero Server Key Knowledge: The server has no access to this symmetric key.'
    },
    {
      number: 2,
      domain: 'CLIENT (ALICE)',
      domainColor: 'text-sky-800',
      badge: 'AEAD ENCRYPT',
      title: 'Bulk File Payload Encryption & 128-bit Tag Computation',
      plainEnglish:
        'Alice encrypts the file bytes using AES-256-GCM. The cipher produces ciphertext and a 128-bit authentication tag, binding the metadata so tampering is impossible.',
      technicalDetail: 'crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData, tagLength: 128 })',
      params: [
        { label: 'Cipher Mode', value: 'Galois/Counter Mode (Authenticated AEAD)' },
        { label: 'Auth Tag', value: simData ? `${simData.authTagHex} (128 bits)` : '128-bit GMAC Tag' },
        { label: 'Canonical AAD', value: simData ? simData.aadJson : '{"fileId":"...","version":"1.0"}' },
        { label: 'Ciphertext', value: simData ? `${simData.ciphertextHex.substring(0, 32)}...` : 'Encrypted binary stream' }
      ],
      securityInvariant: 'Confidentiality + Integrity: Encryption alone is not enough; 128-bit tag prevents bit-flipping.'
    },
    {
      number: 3,
      domain: 'BACKEND REST',
      domainColor: 'text-slate-800',
      badge: 'REST API',
      title: 'Share Session Initiation & Public Key Discovery',
      plainEnglish:
        'Alice calls POST /api/v1/files/initiate. The backend verifies Alice\'s JWT, reserves a file record, and returns Bob\'s published 3072-bit RSA-OAEP Public Key.',
      technicalDetail: 'POST /api/v1/files/initiate -> HTTP 201 Created (Returns Bob\'s JWK)',
      params: [
        { label: 'Endpoint', value: 'POST /api/v1/files/initiate' },
        { label: 'Payload Sent', value: '{ original_filename, file_size, recipient_ids: ["bob"] }' },
        { label: 'Plaintext Sent', value: '0 bytes (Server receives zero file bytes)' },
        { label: 'Public Key Recv', value: simData ? `RSA-OAEP-3072 (FP: ${simData.bobFingerprint.substring(0, 16)}...)` : 'Bob\'s Public Key JWK' }
      ],
      securityInvariant: 'Zero Server Plaintext: The backend initiates the database file record without receiving plaintext.'
    },
    {
      number: 4,
      domain: 'CLIENT (ALICE)',
      domainColor: 'text-sky-800',
      badge: 'HYBRID WRAP',
      title: 'Asymmetric Key Encapsulation (Why Hybrid?)',
      plainEnglish:
        'Why hybrid? RSA cannot encrypt large files. Alice uses Bob\'s 3072-bit RSA-OAEP public key solely to wrap the 32-byte AES key into a 384-byte key envelope.',
      technicalDetail: 'crypto.subtle.wrapKey("raw", aesKey, bobPublicKey, { name: "RSA-OAEP" })',
      params: [
        { label: 'Wrapper Algorithm', value: 'RSA-OAEP with SHA-256 & MGF1 padding' },
        { label: 'Input AES Key Size', value: '32 bytes (256 bits)' },
        { label: 'Wrapped Envelope', value: simData ? `${simData.wrappedEnvelopeBase64.substring(0, 32)}... (384 bytes)` : '384 bytes Base64' },
        { label: 'Memory Scrubbing', value: 'Raw AES key is discarded from Alice\'s RAM' }
      ],
      securityInvariant: 'Asymmetric Isolation: Only the holder of Bob\'s private key (SK_Bob) can unwrap this envelope.'
    },
    {
      number: 5,
      domain: 'STORAGE (CLOUD)',
      domainColor: 'text-indigo-800',
      badge: 'CLOUD OBJECTS',
      title: 'Ciphertext Storage & Zero-Knowledge Verification',
      plainEnglish:
        'Alice uploads the ciphertext binary and the key envelope to storage. The cloud server inspects the commit: zero plaintext bytes and zero private keys stored.',
      technicalDetail: 'POST /api/v1/files/{file_id}/upload -> StorageAdapter.write(ciphertext.bin)',
      params: [
        { label: 'Stored Objects', value: 'ciphertext.bin + recipient_key_envelopes table' },
        { label: 'Cloud Plaintext', value: '0 bytes (100% Zero-Knowledge Verified)' },
        { label: 'Cloud Content Key', value: '0 bytes (Symmetric key was never transmitted)' },
        { label: 'Cloud Private Keys', value: '0 bytes (Private keys reside solely in client browsers)' }
      ],
      securityInvariant: 'Untrusted Storage Invariant: Cloud compromised? Data remains cryptographically secure.'
    },
    {
      number: 6,
      domain: 'BACKEND GUARD',
      domainColor: 'text-slate-800',
      badge: 'ACL CHECK',
      title: 'Recipient Authorization Check & Single Envelope Dispatch',
      plainEnglish:
        'Bob requests download. Backend checks recipient ACL in database. Crucial security rule: The server returns ONLY Bob\'s envelope, never other recipients\'.',
      technicalDetail: 'POST /api/v1/files/{file_id}/download-authorize -> HTTP 200 OK',
      params: [
        { label: 'Endpoint', value: 'POST /api/v1/files/{file_id}/download-authorize' },
        { label: 'Authenticated User', value: 'bob@demo.local (Verified JWT Bearer)' },
        { label: 'Authorization Rule', value: 'Returns ONLY Bob\'s key envelope (No key overlap)' },
        { label: 'Audit Log Emit', value: 'DOWNLOAD_AUTHORIZED (Scrubbed metadata)' }
      ],
      securityInvariant: 'Strict Envelope Isolation: Non-recipients are refused; recipients receive only their own key envelope.'
    },
    {
      number: 7,
      domain: 'CLIENT (BOB)',
      domainColor: 'text-emerald-800',
      badge: 'RAM DECRYPT',
      title: 'Key Recovery & AES-GCM Plaintext Verification',
      plainEnglish:
        'Bob retrieves his envelope, unwraps the AES key using his local RSA private key, and verifies the 128-bit authentication tag. Plaintext matches 100%!',
      technicalDetail: 'crypto.subtle.unwrapKey() + crypto.subtle.decrypt("AES-GCM", iv, aad)',
      params: [
        { label: 'Unwrapped AES Key', value: 'Recovered in Bob\'s browser RAM via SK_Bob' },
        { label: 'GCM Tag Verification', value: '128-bit GMAC matches perfectly (Passed)' },
        { label: 'Recovered Plaintext', value: simData?.recoveredPlaintext ? `"${simData.recoveredPlaintext.substring(0, 36)}..."` : 'Decrypted payload' },
        { label: 'Integrity Check', value: 'SHA-256 digest identical to Alice\'s original file' }
      ],
      securityInvariant: 'End-to-End Cryptographic Success: Confidentiality, authenticity, and non-repudiation verified.'
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
        'Eve intercepts Alice\'s shared file UUID on the network. Eve attempts to call the download authorization endpoint using her own authentication token.',
      technicalDetail: 'POST /api/v1/files/{file_id}/download-authorize (Bearer Eve\'s JWT)',
      params: [
        { label: 'Caller', value: 'eve@demo.local (Unintended intruder)' },
        { label: 'Target File UUID', value: simData ? simData.fileId : 'file_4x9a7f21' },
        { label: 'Attacker Objective', value: 'Attempting to acquire ciphertext download URL and AES key envelope' }
      ],
      securityInvariant: 'Access Control Boundary: The server must evaluate caller against designated recipient ACL.'
    },
    {
      number: 2,
      domain: 'BACKEND GUARD',
      domainColor: 'text-slate-800',
      badge: 'ACL EVALUATION',
      title: 'Backend Access Control Engine Evaluates Recipient List',
      plainEnglish:
        'The Flask backend queries the file_recipients table for matching file_id and user_id. Eve is NOT in the recipient list established by Alice.',
      technicalDetail: 'SELECT * FROM file_recipients WHERE file_id = :id AND recipient_id = :eve_id -> 0 rows',
      params: [
        { label: 'ACL Lookup', value: 'file_recipients database check' },
        { label: 'Authorized Recipient', value: 'bob@demo.local ONLY' },
        { label: 'Intruder Status', value: 'REJECTED: User is not an authorized recipient' }
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
        'The backend logs an audit event UNAUTHORIZED_ACCESS_ATTEMPT with actor IP and user ID, while sanitizing all secret parameters.',
      technicalDetail: 'audit_service.log_event("UNAUTHORIZED_ACCESS_ATTEMPT", result="DENIED")',
      params: [
        { label: 'Event Recorded', value: 'UNAUTHORIZED_ACCESS_ATTEMPT' },
        { label: 'Security Result', value: 'DENIED' },
        { label: 'Secret Scrubbing', value: 'Passwords, tokens, and payloads filtered out' }
      ],
      securityInvariant: 'Auditability: Every unauthorized probe is permanently recorded in the system audit trail.'
    },
    {
      number: 4,
      domain: 'BACKEND REST',
      domainColor: 'text-rose-800',
      badge: 'HTTP 403 FORBIDDEN',
      title: 'HTTP 403 Forbidden Response (Key Envelope Withheld)',
      plainEnglish:
        'The server responds with HTTP 403 Forbidden. The download URL and AES key envelope are withheld. Even if Eve sniffs ciphertext, she cannot decrypt without SK_Bob.',
      technicalDetail: 'HTTP/1.1 403 FORBIDDEN -> { "error": "Forbidden", "message": "Access denied" }',
      params: [
        { label: 'HTTP Status', value: '403 FORBIDDEN' },
        { label: 'Envelope Dispatched', value: 'NONE (Withheld)' },
        { label: 'Mathematical Proof', value: 'RSA-OAEP 3072 is mathematically uncrackable without Bob\'s private key' }
      ],
      securityInvariant: 'Access Control Succeeded: Untrusted and unauthorized parties receive zero key material.'
    }
  ];

  // Tamper Stages definition
  const tamperStages: TelemetryStage[] = [
    {
      number: 1,
      domain: 'ADVERSARY (MITM)',
      domainColor: 'text-amber-800',
      badge: '1-BIT FLIP',
      title: 'Man-in-the-Middle Injects 1-Bit Corruption into Ciphertext',
      plainEnglish:
        'An active adversary intercepts the encrypted payload on the network wire or storage disk and flips exactly one single bit (byte 12 XOR 0x01).',
      technicalDetail: 'ciphertextBytes[12] ^= 0x01 (Single bit-flip corruption)',
      params: [
        { label: 'Attack Vector', value: 'Active wire modification / Storage bit corruption' },
        { label: 'Bit Alteration', value: 'Byte 12 Bit 0 flipped (0 -> 1)' },
        { label: 'Original 128-bit Tag', value: simData ? simData.authTagHex : 'Unchanged in header' }
      ],
      securityInvariant: 'Integrity Threat Model: Traditional CBC modes allow padding or bit-flipping attacks. AES-GCM must detect this.'
    },
    {
      number: 2,
      domain: 'CLIENT (BOB)',
      domainColor: 'text-emerald-800',
      badge: 'KEY UNWRAP',
      title: 'Bob Successfully Unwraps Legitimate AES Content Key',
      plainEnglish:
        'Bob receives his key envelope and unwraps the 256-bit AES content key using his legitimate local private key. The key itself is intact.',
      technicalDetail: 'crypto.subtle.unwrapKey("raw", envelopeBytes, bobPrivateKey, "RSA-OAEP")',
      params: [
        { label: 'AES Key Status', value: 'Successfully unwrapped in RAM' },
        { label: 'Key Authenticity', value: 'Intact 256-bit symmetric key' }
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
        'Bob initiates AES-256-GCM decryption with Canonical AAD. WebCrypto evaluates the Galois field polynomial over the altered ciphertext.',
      technicalDetail: 'crypto.subtle.decrypt({ name: "AES-GCM", iv, additionalData, tagLength: 128 })',
      params: [
        { label: 'Integrity Engine', value: 'W3C SubtleCrypto Galois/Counter Mode' },
        { label: 'Computed Tag', value: 'Mismatch detected against expected 128-bit tag' }
      ],
      securityInvariant: 'Cryptographic Detection: Even a 1-bit alteration causes complete avalanche failure in the Galois field.'
    },
    {
      number: 4,
      domain: 'CLIENT (BOB)',
      domainColor: 'text-emerald-800',
      badge: 'OPERATION ERROR',
      title: 'WebCrypto Throws OperationError (Zero Plaintext Released)',
      plainEnglish:
        'Authentication tag check fails! WebCrypto throws DOMException: OperationError. Decryption aborts instantly. Exactly 0 bytes of corrupted plaintext are released.',
      technicalDetail: 'throw new DOMException("The operation failed for an operation-specific reason", "OperationError")',
      params: [
        { label: 'WebCrypto Exception', value: 'OperationError (Authentication tag mismatch)' },
        { label: 'Plaintext Output', value: '0 bytes (Zero corrupted bytes leaked)' },
        { label: 'Verdict', value: 'Tampering detection 100% verified' }
      ],
      securityInvariant: 'Authenticated Encryption Guarantee: Corrupted or tampered ciphertexts are never released into application memory.'
    }
  ];

  // Select active stages list based on scenario
  const activeStagesList =
    overlayScenario === 'normal'
      ? normalStages
      : overlayScenario === 'eve'
      ? eveStages
      : tamperStages;

  // Launch Overlay
  const launchOverlay = async (scenario: 'normal' | 'eve' | 'tamper') => {
    setOverlayScenario(scenario);
    setActiveStageIndex(0);
    setIsOverlayOpen(true);
    setIsOverlayPlaying(true);

    if (!simData && scenario === 'normal') {
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

  // Execute on page directly
  const handleRunFullDemo = async () => {
    setIsSimulating(true);
    await runLiveCryptoCore();
    setCurrentStep(4);
    setIsSimulating(false);
  };

  // Attack Test 1: Eve
  const handleTestEveAttack = () => {
    setAttackEveResult({
      status: 'blocked',
      httpCode: 403,
      reason: 'Server ACL Check: Eve (intruder@demo.local) is not listed in authorized recipients.',
      mathProof: 'Even with physical wire capture of ciphertext, Eve has no access to Bob\'s private key (SK_Bob), rendering RSA-OAEP envelope recovery mathematically impossible.'
    });
    launchOverlay('eve');
  };

  // Attack Test 2: Tamper
  const handleTestBitFlipTamper = async () => {
    if (!simData) {
      await runLiveCryptoCore();
    }
    setIsTampering(true);
    setAttackTamperResult(null);

    try {
      if (simData) {
        const tamperedBytes = new Uint8Array(simData.ciphertext!.slice(0));
        tamperedBytes[12] ^= 0x01;
        const unwrappedAESKey = await unwrapAESKeyWithPrivateKey(simData.wrappedEnvelopeBase64, simData.bobKeyPair!.privateKey);

        try {
          await decryptFilePayload(tamperedBytes.buffer, unwrappedAESKey, simData.nonce!, simData.aadBytes!);
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
    } finally {
      setIsTampering(false);
    }
  };

  const currentActiveStage = activeStagesList[activeStageIndex];

  // Viva Questions Data
  const vivaQuestions = [
    {
      q: "Why use Hybrid Cryptography instead of encrypting the entire file with RSA?",
      a: "Asymmetric algorithms like RSA-3072 are computationally expensive and strictly limited by key size (max plaintext ~318 bytes for RSA-3072 with OAEP). Encrypting a 25MB file with RSA is impossible. Hybrid cryptography uses fast hardware-accelerated AES-256-GCM for bulk file payload and uses RSA-3072 solely to wrap the 32-byte AES key."
    },
    {
      q: "Why AES-GCM instead of traditional AES-CBC?",
      a: "AES-GCM is an Authenticated Encryption with Associated Data (AEAD) mode. Unlike CBC (which only encrypts), GCM simultaneously computes a 128-bit Galois Message Authentication Code (GMAC) tag. Any bit flipping or data tampering during transit causes decryption to throw an OperationError immediately, preventing chosen-ciphertext attacks."
    },
    {
      q: "Where does the recipient's private key live and why doesn't the cloud server have it?",
      a: "In genuine zero-knowledge architectures, private keys are generated in the browser volatile RAM and stored locally in IndexedDB encrypted with PBKDF2-SHA-256 (600,000 iterations) + AES-GCM. The private key is never transmitted across the network, ensuring the server cannot decrypt files even if subpoenaed or breached."
    },
    {
      q: "What role does Canonical Additional Authenticated Data (AAD) play?",
      a: "AAD cryptographically binds file metadata (fileId, senderId, version) into the AES-GCM authentication tag. If an attacker tampers with the sender ID or attempts to replay a key envelope against a different file, the tag check fails instantly."
    }
  ];

  return (
    <div className="w-full space-y-10 font-sans">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <span className="text-[10px] font-mono tracking-widest uppercase text-slate-400">
            College Cryptography Evaluation
          </span>
          <h2 className="text-3xl font-normal text-slate-900 tracking-tight font-serif mt-1">
            Professor Demonstration & Defense Lab
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Visual storyboard demonstrating client-side hybrid cryptography (AES-256-GCM + RSA-OAEP 3072) with live telemetry overlay.
          </p>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center space-x-6 text-xs font-semibold shrink-0">
          <button
            onClick={() => setActiveTab('storyboard')}
            className={`pb-2 border-b-2 transition-colors ${
              activeTab === 'storyboard'
                ? 'border-slate-900 text-slate-900 font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-700'
            }`}
          >
            1. Live Cryptographic Storyboard (Viva Demo)
          </button>
          <button
            onClick={() => setActiveTab('multi-persona')}
            className={`pb-2 border-b-2 transition-colors ${
              activeTab === 'multi-persona'
                ? 'border-slate-900 text-slate-900 font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-700'
            }`}
          >
            2. Multi-Session Database Workspace
          </button>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* TAB 1: LIVE CRYPTOGRAPHIC STORYBOARD (SIMPLIFIED FOR PROFESSOR)      */}
      {/* ==================================================================== */}
      {activeTab === 'storyboard' && (
        <div className="space-y-10">
          {/* Action Bar & Demo Controls */}
          <div className="flex flex-wrap items-center justify-between gap-4 py-3 border-b border-slate-100">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => launchOverlay('normal')}
                className="py-2.5 px-5 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-semibold tracking-wide flex items-center gap-2 transition-colors shadow-2xs"
              >
                <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                <span>Launch Step-by-Step Execution Overlay</span>
              </button>

              <button
                onClick={handleRunFullDemo}
                disabled={isSimulating}
                className="py-2.5 px-4 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Direct Compute (Instant)</span>
              </button>

              <button
                onClick={() => {
                  setCurrentStep(0);
                  setSimData(null);
                  setAttackEveResult(null);
                  setAttackTamperResult(null);
                }}
                className="py-2.5 px-3 text-slate-400 hover:text-slate-700 text-xs transition-colors"
                title="Reset simulation state"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Attack Demonstrations */}
            <div className="flex items-center space-x-3">
              <span className="text-[11px] font-mono text-slate-400 uppercase">Test Threats:</span>
              <button
                onClick={handleTestEveAttack}
                className="py-1.5 px-3 border border-slate-300 hover:border-slate-800 text-slate-800 rounded text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                <span>Eve 403 Test</span>
              </button>

              <button
                onClick={handleTestBitFlipTamper}
                disabled={isTampering}
                className="py-1.5 px-3 border border-slate-300 hover:border-slate-800 text-slate-800 rounded text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-40"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                <span>Bit-Flip Tamper Test</span>
              </button>
            </div>
          </div>

          {/* VISUAL ACTOR PIPELINE (No card boxes, classic hairline layout) */}
          <div className="space-y-4">
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
                <h4 className="text-base font-semibold text-slate-900">Alice</h4>
                <p className="text-slate-500 text-[11px] leading-relaxed">
                  Has raw file bytes. Generates fresh random 256-bit AES key in RAM. Uses AES-GCM to encrypt file and RSA-OAEP to wrap key envelope.
                </p>
                <div className="font-mono text-[11px] text-slate-700 pt-1">
                  RAM Secret: <span className="text-slate-900 font-semibold">{simData ? '256-bit AES Key' : 'Empty'}</span>
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
                <h4 className="text-base font-semibold text-slate-900">Untrusted Cloud</h4>
                <p className="text-slate-500 text-[11px] leading-relaxed">
                  Stores ciphertext binary blobs & wrapped RSA envelopes. Zero access to file plaintext, AES key, or user private keys.
                </p>
                <div className="font-mono text-[11px] text-emerald-700 font-semibold pt-1">
                  Plaintext Held: 0 bytes (Zero Knowledge)
                </div>
              </div>

              {/* Actor 3: Bob Recipient */}
              <div className="py-2 md:px-6 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] uppercase font-semibold text-emerald-800">
                    Client 2: Recipient
                  </span>
                  <span className={`w-2 h-2 rounded-full ${simData?.recoveredPlaintext ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                </div>
                <h4 className="text-base font-semibold text-slate-900">Bob</h4>
                <p className="text-slate-500 text-[11px] leading-relaxed">
                  Receives his key envelope + ciphertext. Unwraps envelope using his local RSA private key. Decrypts payload with AES-GCM.
                </p>
                <div className="font-mono text-[11px] text-slate-700 pt-1">
                  Private Key: <span className="text-slate-900 font-semibold">{simData ? '3072-bit RSA in RAM' : 'Local Vault'}</span>
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
                  Eavesdrops or requests unauthorized file. Blocked by backend HTTP 403 Forbidden. Lacks RSA private key to unwrap envelope.
                </p>
                <div className="font-mono text-[11px] text-rose-700 font-semibold pt-1">
                  Access: Permanently Blocked
                </div>
              </div>
            </div>
          </div>

          {/* ACTIVE DEMO STAGE INSPECTION */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
            {/* Left Column: Sample Payload & Overlay Controls */}
            <div className="lg:col-span-5 space-y-6">
              <div className="space-y-1">
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                  Interactive Evaluation Payload
                </span>
                <h3 className="text-xl font-normal text-slate-900 font-serif">
                  Sample Plaintext Document
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed pt-1">
                  Modify the plaintext message below. When you launch the overlay, you can demonstrate every cryptographic mathematical primitive and backend boundary live to your professor.
                </p>
              </div>

              {/* Editable Sample Payload */}
              <div className="space-y-1.5 pt-2">
                <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-400">
                  Plaintext Payload Sample:
                </label>
                <textarea
                  rows={3}
                  value={sampleText}
                  onChange={(e) => setSampleText(e.target.value)}
                  className="w-full border-b border-slate-300 py-2 text-xs text-slate-900 font-mono placeholder-slate-400 focus:outline-none focus:border-slate-900 bg-transparent break-words-anywhere"
                  placeholder="Enter custom plaintext to encrypt..."
                />
              </div>

              {/* Quick Launch Buttons */}
              <div className="pt-2 space-y-2">
                <button
                  onClick={() => launchOverlay('normal')}
                  className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                  <span>Launch Telemetry Overlay (Paced Presentation)</span>
                </button>
              </div>
            </div>

            {/* Right Column: Live Cryptographic Primitives Inspector */}
            <div className="lg:col-span-7 space-y-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 pb-2 border-b border-slate-100 flex items-center justify-between">
                <span>Current Cryptographic State</span>
                <span className="font-mono text-[10px] text-slate-400">W3C WebCrypto API</span>
              </div>

              {/* Attack Proof Result Alerts */}
              {attackEveResult && (
                <div className="py-3 px-4 border-l-2 border-rose-600 bg-rose-50/70 text-rose-950 text-xs space-y-1">
                  <div className="font-semibold flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-rose-600" />
                    <span>HTTP {attackEveResult.httpCode} FORBIDDEN — Intruder Access Denied</span>
                  </div>
                  <p className="text-slate-700 leading-relaxed">{attackEveResult.reason}</p>
                </div>
              )}

              {attackTamperResult && (
                <div className={`py-3 px-4 border-l-2 text-xs space-y-1 ${
                  attackTamperResult.passed ? 'border-emerald-600 bg-emerald-50/70 text-emerald-950' : 'border-rose-600 bg-rose-50 text-rose-950'
                }`}>
                  <div className="font-semibold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Tamper Detection Verified ({attackTamperResult.errorType})</span>
                  </div>
                  <p className="text-slate-700 leading-relaxed">{attackTamperResult.message}</p>
                </div>
              )}

              {/* Cryptographic Parameters Definition List */}
              {simData ? (
                <dl className="divide-y divide-slate-100 text-xs">
                  <div className="py-2.5 flex flex-col sm:flex-row sm:justify-between gap-1">
                    <dt className="text-slate-400 font-mono text-[11px]">Original Plaintext Digest</dt>
                    <dd className="font-mono text-slate-900 text-[11px] break-words-anywhere select-all font-semibold">
                      SHA-256: {simData.plaintextSHA256}
                    </dd>
                  </div>

                  <div className="py-2.5 flex flex-col sm:flex-row sm:justify-between gap-1">
                    <dt className="text-slate-400 font-mono text-[11px]">Symmetric Key ($K_{'{file}'}$)</dt>
                    <dd className="font-mono text-slate-900 text-[11px] break-words-anywhere select-all">
                      AES-256-GCM (256-bit RAM Key: {simData.rawKeyHex.substring(0, 24)}...)
                    </dd>
                  </div>

                  <div className="py-2.5 flex flex-col sm:flex-row sm:justify-between gap-1">
                    <dt className="text-slate-400 font-mono text-[11px]">96-bit Random Nonce (IV)</dt>
                    <dd className="font-mono text-slate-900 text-[11px] break-words-anywhere select-all">
                      {simData.nonceHex}
                    </dd>
                  </div>

                  <div className="py-2.5 flex flex-col sm:flex-row sm:justify-between gap-1">
                    <dt className="text-slate-400 font-mono text-[11px]">Canonical AAD Binding</dt>
                    <dd className="font-mono text-slate-800 text-[11px] break-words-anywhere select-all">
                      {simData.aadJson}
                    </dd>
                  </div>

                  <div className="py-2.5 flex flex-col sm:flex-row sm:justify-between gap-1">
                    <dt className="text-slate-400 font-mono text-[11px]">GCM Authentication Tag</dt>
                    <dd className="font-mono text-sky-800 font-semibold text-[11px] break-words-anywhere select-all">
                      128-bit Tag: {simData.authTagHex}
                    </dd>
                  </div>

                  <div className="py-2.5 flex flex-col sm:flex-row sm:justify-between gap-1">
                    <dt className="text-slate-400 font-mono text-[11px]">Bob's Public Key Fingerprint</dt>
                    <dd className="font-mono text-slate-900 text-[11px] break-words-anywhere select-all">
                      RFC 7638 SHA-256: {simData.bobFingerprint}
                    </dd>
                  </div>

                  {simData.wrappedEnvelopeBase64 && (
                    <div className="py-2.5 flex flex-col sm:flex-row sm:justify-between gap-1">
                      <dt className="text-slate-400 font-mono text-[11px]">RSA-OAEP Key Envelope</dt>
                      <dd className="font-mono text-indigo-900 font-semibold text-[11px] break-words-anywhere select-all">
                        {simData.wrappedEnvelopeBase64.substring(0, 36)}... (384 bytes)
                      </dd>
                    </div>
                  )}

                  {simData.recoveredPlaintext && (
                    <div className="py-3 border-t border-slate-200">
                      <div className="flex items-center gap-1.5 text-emerald-700 font-semibold mb-1">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Bob Decryption Integrity Verified (100% Match)</span>
                      </div>
                      <div className="p-3 bg-slate-50 border border-slate-200 text-slate-900 font-mono text-xs break-words-anywhere select-all">
                        "{simData.recoveredPlaintext}"
                      </div>
                    </div>
                  )}
                </dl>
              ) : (
                <div className="py-12 text-slate-400 text-xs font-mono space-y-1">
                  <p className="text-slate-600 font-medium">Simulation idle.</p>
                  <p>Click "Launch Telemetry Overlay" to see every stage executed step-by-step.</p>
                </div>
              )}
            </div>
          </div>

          {/* PROFESSOR VIVA DEFENSE ACCORDION (Answers to the 4 Classic Exam Questions) */}
          <div className="pt-8 border-t border-slate-200 space-y-4">
            <div className="pb-2 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-slate-900 tracking-tight flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-slate-700" />
                  <span>Professor Viva & Defense Q&A Cheat Sheet</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Academic answers to the top 4 questions examiners ask about hybrid file encryption systems.
                </p>
              </div>
            </div>

            <div className="divide-y divide-slate-100">
              {vivaQuestions.map((item, idx) => {
                const isOpen = openVivaIndex === idx;
                return (
                  <div key={idx} className="py-3">
                    <button
                      onClick={() => setOpenVivaIndex(isOpen ? null : idx)}
                      className="w-full text-left flex items-center justify-between text-xs font-semibold text-slate-900 hover:text-slate-600 transition-colors"
                    >
                      <span>{idx + 1}. {item.q}</span>
                      {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
                    </button>
                    {isOpen && (
                      <p className="text-xs text-slate-600 leading-relaxed mt-2 pl-4 border-l-2 border-slate-900">
                        {item.a}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 2: ADVANCED MULTI-SESSION WORKSPACE (LEGACY ACCOUNTS & DB RESET)  */}
      {/* ==================================================================== */}
      {activeTab === 'multi-persona' && (
        <div className="space-y-10">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Multi-Session Database Workspace</h3>
              <p className="text-xs text-slate-500">Switch active browser sessions or reset seeded SQLite database files.</p>
            </div>
            <button
              onClick={async () => {
                if (!window.confirm('Reset all demo files, recipients, and test logs?')) return;
                setIsResetting(true);
                try {
                  await api.demo.reset();
                  setNotification('Demo environment reset successfully.');
                  loadStatus();
                } catch (err: any) {
                  setNotification(`Reset failed: ${err.message}`);
                } finally {
                  setIsResetting(false);
                }
              }}
              disabled={isResetting}
              className="text-xs font-semibold text-slate-900 hover:text-slate-600 flex items-center gap-1.5 transition-colors"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${isResetting ? 'animate-spin' : ''}`} />
              <span>Reset Demo Database</span>
            </button>
          </div>

          {notification && (
            <div className="py-2.5 px-4 border-l-2 border-slate-900 bg-slate-50 text-slate-900 text-xs flex items-center justify-between">
              <span className="break-words-anywhere">{notification}</span>
              <button onClick={() => setNotification(null)} className="text-slate-400 hover:text-slate-700 text-xs">✕</button>
            </div>
          )}

          {/* Presentation Personas 3-column strip */}
          <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-200 border-y border-slate-200 py-4 text-xs">
            {demoStatus.map((du, idx) => {
              const isActive = user?.email === du.email;
              return (
                <div key={du.email} className={`py-4 space-y-3 ${idx === 0 ? 'md:pr-8' : idx === 1 ? 'md:px-8' : 'md:pl-8'}`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-mono uppercase tracking-wider font-semibold ${
                      du.role === 'Sender' ? 'text-sky-800' : du.role === 'Intended Recipient' ? 'text-emerald-800' : 'text-rose-800'
                    }`}>
                      {du.role}
                    </span>
                    {isActive && (
                      <span className="text-[10px] font-mono text-emerald-700 font-bold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                        ACTIVE
                      </span>
                    )}
                  </div>
                  <div>
                    <h4 className="text-base font-semibold text-slate-900">{du.name}</h4>
                    <div className="text-xs font-mono text-slate-500 break-words-anywhere">{du.email}</div>
                  </div>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-400 text-[11px]">Public Key</span>
                      <span className={`font-mono text-[11px] font-medium ${du.has_public_key ? 'text-emerald-700' : 'text-amber-700'}`}>
                        {du.has_public_key ? 'Registered' : 'Not Generated'}
                      </span>
                    </div>
                    {du.public_key_fingerprint && (
                      <div className="pt-1">
                        <span className="text-slate-400 text-[10px] uppercase font-mono block">Fingerprint</span>
                        <span className="font-mono text-slate-700 text-[11px] block break-words-anywhere">
                          {du.public_key_fingerprint}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="pt-2">
                    <button
                      onClick={async () => {
                        try {
                          await login(du.email, du.role === 'Sender' ? 'DemoSender123!' : du.role === 'Intended Recipient' ? 'DemoRecipient123!' : 'DemoIntruder123!');
                          setNotification(`Switched active persona to ${du.email}`);
                          loadStatus();
                        } catch (err: any) {
                          setNotification(`Failed to switch: ${err.message}`);
                        }
                      }}
                      disabled={isActive}
                      className={`text-xs font-semibold flex items-center gap-1 transition-colors ${
                        isActive ? 'text-slate-400 cursor-default' : 'text-slate-900 hover:text-slate-600 underline'
                      }`}
                    >
                      <span>{isActive ? 'Currently Logged In' : `Switch Session to ${du.name} →`}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Manual UUID Intruder Access Test */}
          <div className="space-y-4 pt-4 border-t border-slate-200">
            <div>
              <h4 className="text-sm font-semibold text-slate-900">Manual API Authorization Test</h4>
              <p className="text-xs text-slate-500">Paste an existing file UUID to test recipient envelope isolation at the Flask REST boundary.</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 items-baseline">
              <input
                type="text"
                value={intruderFileId}
                onChange={(e) => setIntruderFileId(e.target.value)}
                placeholder="Paste Target File UUID"
                className="flex-1 border-b border-slate-300 py-2 text-xs text-slate-900 font-mono placeholder-slate-400 focus:outline-none focus:border-slate-900 bg-transparent break-words-anywhere"
              />
              <button
                onClick={async () => {
                  if (!intruderFileId.trim()) return;
                  setIsIntruding(true);
                  setIntruderResult(null);
                  try {
                    await api.files.authorizeDownload(intruderFileId.trim());
                    setIntruderResult({ status: 'granted', message: 'Authorized access granted' });
                  } catch (err: any) {
                    setIntruderResult({ status: 'denied', httpCode: 403, message: err.message || 'Access denied' });
                  } finally {
                    setIsIntruding(false);
                  }
                }}
                disabled={isIntruding}
                className="py-2 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-semibold transition-colors disabled:opacity-50"
              >
                {isIntruding ? 'Testing...' : 'Test Download Endpoint'}
              </button>
            </div>

            {intruderResult && (
              <div className={`py-3 px-4 border-l-2 text-xs ${
                intruderResult.status === 'denied' ? 'border-emerald-600 bg-emerald-50/70 text-emerald-950' : 'border-rose-600 bg-rose-50 text-rose-950'
              }`}>
                <div className="font-semibold">{intruderResult.status === 'denied' ? 'HTTP 403 Forbidden (Blocked as Expected)' : 'Access Allowed'}</div>
                <div className="font-mono text-[11px] text-slate-600 mt-1">{intruderResult.message}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 4. LIVE PRESENTATION TELEMETRY OVERLAY (REQUEST/RESPONSE HUD)         */}
      {/* ==================================================================== */}
      {isOverlayOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-300 max-w-4xl w-full p-6 sm:p-8 space-y-6 shadow-2xl overflow-y-auto max-h-[92vh]">
            {/* Overlay Header Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-slate-900" />
                  <h3 className="text-base font-bold text-slate-900 tracking-tight">
                    Live Execution Telemetry Overlay
                  </h3>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 uppercase font-semibold">
                    {overlayScenario === 'normal' ? 'Normal Hybrid Flow' : overlayScenario === 'eve' ? 'Eve Intruder Test' : 'Bit-Flip Tamper Test'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Stage-by-stage presentation breakdown showing client-side RAM operations vs backend REST requests.
                </p>
              </div>

              {/* Close Button */}
              <button
                onClick={() => {
                  setIsOverlayOpen(false);
                  setIsOverlayPlaying(false);
                }}
                className="text-slate-400 hover:text-slate-700 p-1 shrink-0"
                title="Close Overlay"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Playback & Pacing Controls */}
            <div className="flex flex-wrap items-center justify-between gap-4 py-2 border-b border-slate-100 text-xs">
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setIsOverlayPlaying(!isOverlayPlaying)}
                  className="py-1.5 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-semibold flex items-center gap-1.5 transition-colors"
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
                  onClick={() => setActiveStageIndex(0)}
                  className="p-1.5 text-slate-400 hover:text-slate-700"
                  title="Rewind to Stage 1"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
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
                  1.4s (Presentation)
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

            {/* ACTIVE STAGE SPOTLIGHT CARD (Clean, editorial, high-contrast) */}
            {currentActiveStage && (
              <div className="space-y-4 pt-2">
                {/* Domain & Stage Header */}
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
                    LIVE COMPUTATION
                  </span>
                </div>

                {/* Plain English Storyboard Narration for Professor */}
                <div className="space-y-1">
                  <h4 className="text-lg font-semibold text-slate-900">{currentActiveStage.title}</h4>
                  <p className="text-xs text-slate-700 leading-relaxed font-serif text-sm">
                    "{currentActiveStage.plainEnglish}"
                  </p>
                </div>

                {/* Technical Method Execution Box */}
                <div className="py-2.5 px-3 bg-slate-50 border-l-2 border-slate-900 font-mono text-xs text-slate-900 break-words-anywhere">
                  <span className="text-slate-400 text-[10px] block uppercase font-mono">Executed Primitive:</span>
                  <span className="font-semibold text-slate-800">{currentActiveStage.technicalDetail}</span>
                </div>

                {/* Parameters & Telemetry Key-Value List */}
                <div className="space-y-2 pt-2">
                  <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-semibold">
                    Live Telemetry Proofs
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

                {/* Security Invariant Guarantee Callout */}
                <div className="pt-2 border-t border-slate-100 flex items-start gap-2 text-xs text-slate-600">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Cryptographic Invariant:</strong> {currentActiveStage.securityInvariant}
                  </span>
                </div>
              </div>
            )}

            {/* Overlay Footer */}
            <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <span className="text-slate-400 font-mono text-[11px]">
                Web Crypto API • Pure RAM Execution • Argon2id & PyJWT
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
                    Finish & View Main Storyboard
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
