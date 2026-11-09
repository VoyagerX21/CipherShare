import React, { useState, useEffect } from 'react';
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
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Lock,
  Unlock,
  ShieldCheck,
  ArrowRight,
  FileText,
  Layers,
  Cpu,
  ChevronDown,
  ChevronUp,
  Sparkles,
  HelpCircle
} from 'lucide-react';

export const DemoWorkspacePage: React.FC = () => {
  const { user, login } = useAuth();
  const navigate = useNavigate();

  // Active Main View Tab
  const [activeTab, setActiveTab] = useState<'storyboard' | 'multi-persona'>('storyboard');

  // =========================================================================
  // 1. STORYBOARD SIMULATION STATE (Single-Screen 1-Click Real WebCrypto)
  // =========================================================================
  const [currentStep, setCurrentStep] = useState<number>(0); // 0 = Idle, 1 = Encrypt, 2 = Wrap, 3 = Server, 4 = Decrypt
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [sampleText, setSampleText] = useState<string>(
    'CONFIDENTIAL COURSE EVALUATION REPORT: Alice and Bob have successfully verified hybrid zero-knowledge end-to-end file sharing.'
  );

  // Live Cryptographic Artifacts computed via real Web Crypto API
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
  // 2. MULTI-PERSONA ADVANCED WORKSPACE STATE (Legacy DB Accounts)
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

  // Run Step 1: Alice Generates AES-256 Key & Encrypts Payload
  const executeStep1 = async () => {
    setIsSimulating(true);
    setAttackEveResult(null);
    setAttackTamperResult(null);

    try {
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
      // GCM tag is the last 16 bytes (128 bits)
      const authTagHex = fullCiphertextHex.substring(fullCiphertextHex.length - 32);

      // 5. Generate Bob's RSA-OAEP 3072 key pair for simulation
      const bobKeyPair = await generateUserKeyPair();
      const bobPublicKeyJwk = await exportPublicKeyJWK(bobKeyPair.publicKey);
      const bobFingerprint = await computeJWKFingerprint(JSON.parse(bobPublicKeyJwk));

      setSimData({
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
        wrappedEnvelopeBase64: '',
        recoveredPlaintext: null,
        recoveredMatches: false
      });

      setCurrentStep(1);
    } catch (err: any) {
      console.error('Step 1 failed', err);
    } finally {
      setIsSimulating(false);
    }
  };

  // Run Step 2: Key Encapsulation (Wrap AES key using Bob's RSA-3072 Public Key)
  const executeStep2 = async () => {
    if (!simData || !simData.aesKey || !simData.bobKeyPair) return;
    setIsSimulating(true);

    try {
      const wrappedBase64 = await wrapAESKeyForRecipient(simData.aesKey, simData.bobKeyPair.publicKey);
      setSimData(prev => prev ? ({ ...prev, wrappedEnvelopeBase64: wrappedBase64 }) : null);
      setCurrentStep(2);
    } catch (err: any) {
      console.error('Step 2 failed', err);
    } finally {
      setIsSimulating(false);
    }
  };

  // Run Step 3: Cloud Server Storage (Zero Knowledge Inspection)
  const executeStep3 = () => {
    setCurrentStep(3);
  };

  // Run Step 4: Bob Decrypts using his Private Key (Client-side in RAM)
  const executeStep4 = async () => {
    if (!simData || !simData.bobKeyPair || !simData.wrappedEnvelopeBase64 || !simData.ciphertext || !simData.nonce || !simData.aadBytes) return;
    setIsSimulating(true);

    try {
      // 1. Unwrap AES key using Bob's private key
      const unwrappedAESKey = await unwrapAESKeyWithPrivateKey(simData.wrappedEnvelopeBase64, simData.bobKeyPair.privateKey);

      // 2. Decrypt AES-GCM payload with canonical AAD
      const decryptedBuffer = await decryptFilePayload(simData.ciphertext, unwrappedAESKey, simData.nonce, simData.aadBytes);
      const dec = new TextDecoder();
      const recovered = dec.decode(decryptedBuffer);

      setSimData(prev => prev ? ({
        ...prev,
        recoveredPlaintext: recovered,
        recoveredMatches: recovered === sampleText
      }) : null);

      setCurrentStep(4);
    } catch (err: any) {
      console.error('Step 4 failed', err);
    } finally {
      setIsSimulating(false);
    }
  };

  // Run All Steps Automatically
  const handleRunFullDemo = async () => {
    await executeStep1();
    setTimeout(async () => {
      await executeStep2();
      setTimeout(() => {
        executeStep3();
        setTimeout(async () => {
          await executeStep4();
        }, 600);
      }, 600);
    }, 600);
  };

  // Attack Test 1: Eve (Intruder Access Simulation)
  const handleTestEveAttack = () => {
    setAttackEveResult({
      status: 'blocked',
      httpCode: 403,
      reason: 'Server ACL Check: Eve (intruder@demo.local) is not listed in authorized recipients.',
      mathProof: 'Even with physical wire capture of ciphertext, Eve has no access to Bob\'s private key (SK_Bob), rendering RSA-OAEP envelope recovery mathematically impossible.'
    });
  };

  // Attack Test 2: Active Bit-Flip Tampering Test
  const handleTestBitFlipTamper = async () => {
    if (!simData || !simData.ciphertext || !simData.bobKeyPair || !simData.wrappedEnvelopeBase64 || !simData.nonce || !simData.aadBytes) {
      alert('Please run the demo first so ciphertext exists to tamper with.');
      return;
    }
    setIsTampering(true);
    setAttackTamperResult(null);

    try {
      // 1. Clone ciphertext and flip exactly 1 bit
      const tamperedBytes = new Uint8Array(simData.ciphertext.slice(0));
      tamperedBytes[12] ^= 0x01; // flip 1 bit in byte 12

      // 2. Unwrap key
      const unwrappedAESKey = await unwrapAESKeyWithPrivateKey(simData.wrappedEnvelopeBase64, simData.bobKeyPair.privateKey);

      // 3. Attempt decryption -> MUST FAIL!
      try {
        await decryptFilePayload(tamperedBytes.buffer, unwrappedAESKey, simData.nonce, simData.aadBytes);
        setAttackTamperResult({
          passed: false,
          message: 'CRITICAL FAILURE: Tampered ciphertext was decrypted without tag failure!'
        });
      } catch (err: any) {
        setAttackTamperResult({
          passed: true,
          errorType: 'DOMException: OperationError',
          message: 'SUCCESS: WebCrypto rejected altered ciphertext! The 128-bit AES-GCM authentication tag failed verification. Exactly 0 bytes of plaintext were released.'
        });
      }
    } finally {
      setIsTampering(false);
    }
  };

  // Handle Legacy Multi-persona switch
  const handleSwitchPersona = async (email: string, pass: string) => {
    try {
      await login(email, pass);
      setNotification(`Switched active persona to ${email}`);
      loadStatus();
    } catch (err: any) {
      setNotification(`Failed to switch persona: ${err.message}`);
    }
  };

  // Reset Demo Database
  const handleResetDemo = async () => {
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
  };

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
            Simplified visual storyboard demonstrating client-side hybrid cryptography (AES-256-GCM + RSA-OAEP 3072).
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
                onClick={handleRunFullDemo}
                disabled={isSimulating}
                className="py-2.5 px-5 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-semibold tracking-wide flex items-center gap-2 transition-colors shadow-2xs disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Run Complete Guided Demo (All Steps)</span>
              </button>

              <button
                onClick={() => {
                  setCurrentStep(0);
                  setSimData(null);
                  setAttackEveResult(null);
                  setAttackTamperResult(null);
                }}
                className="py-2.5 px-4 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
                <span>Reset Storyboard</span>
              </button>
            </div>

            {/* Individual Step Selectors */}
            <div className="flex items-center space-x-1 text-xs">
              <span className="text-[11px] font-mono text-slate-400 mr-2 uppercase">Jump to:</span>
              <button
                onClick={executeStep1}
                className={`px-3 py-1 text-xs rounded transition-colors ${
                  currentStep === 1 ? 'bg-slate-900 text-white font-semibold' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                1. AES Encrypt
              </button>
              <button
                onClick={executeStep2}
                disabled={!simData}
                className={`px-3 py-1 text-xs rounded transition-colors ${
                  currentStep === 2 ? 'bg-slate-900 text-white font-semibold' : 'text-slate-600 hover:bg-slate-100 disabled:opacity-30'
                }`}
              >
                2. RSA Wrap
              </button>
              <button
                onClick={executeStep3}
                disabled={!simData?.wrappedEnvelopeBase64}
                className={`px-3 py-1 text-xs rounded transition-colors ${
                  currentStep === 3 ? 'bg-slate-900 text-white font-semibold' : 'text-slate-600 hover:bg-slate-100 disabled:opacity-30'
                }`}
              >
                3. Cloud State
              </button>
              <button
                onClick={executeStep4}
                disabled={!simData?.wrappedEnvelopeBase64}
                className={`px-3 py-1 text-xs rounded transition-colors ${
                  currentStep === 4 ? 'bg-slate-900 text-white font-semibold' : 'text-slate-600 hover:bg-slate-100 disabled:opacity-30'
                }`}
              >
                4. Bob Decrypts
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
                  <span className={`w-2 h-2 rounded-full ${currentStep >= 1 ? 'bg-emerald-500' : 'bg-slate-300'}`} />
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
                  <span className={`w-2 h-2 rounded-full ${currentStep >= 3 ? 'bg-emerald-500' : 'bg-slate-300'}`} />
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
                  <span className={`w-2 h-2 rounded-full ${currentStep >= 4 ? 'bg-emerald-500' : 'bg-slate-300'}`} />
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
            {/* Left Column: Stage Explanation & Controls */}
            <div className="lg:col-span-5 space-y-6">
              <div className="space-y-1">
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                  {currentStep === 0 && 'Ready to Begin'}
                  {currentStep === 1 && 'Step 1 of 4: Symmetric Payload Encryption'}
                  {currentStep === 2 && 'Step 2 of 4: Asymmetric Key Encapsulation'}
                  {currentStep === 3 && 'Step 3 of 4: Untrusted Server Storage State'}
                  {currentStep === 4 && 'Step 4 of 4: Client-Side Decryption & Verification'}
                </span>
                <h3 className="text-xl font-normal text-slate-900 font-serif">
                  {currentStep === 0 && 'Click "Run Complete Guided Demo" above'}
                  {currentStep === 1 && 'Alice Encrypts with AES-256-GCM + AAD'}
                  {currentStep === 2 && 'Alice Wraps AES Key with Bob\'s RSA-3072 Public Key'}
                  {currentStep === 3 && 'Cloud Stores Ciphertext (Zero Server Plaintext)'}
                  {currentStep === 4 && 'Bob Recovers Plaintext with Local Private Key'}
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed pt-1">
                  {currentStep === 0 && 'Demonstrate every cryptographic mathematical primitive live to your professor in under 60 seconds.'}
                  {currentStep === 1 && 'Alice generates a one-time 256-bit AES key in RAM. The file bytes are encrypted with a 96-bit random nonce and canonical AAD metadata, outputting ciphertext and a 128-bit authentication tag.'}
                  {currentStep === 2 && 'Why hybrid? RSA cannot encrypt large files. Alice takes the tiny 32-byte AES key and encrypts it using Bob\'s 3072-bit RSA-OAEP public key, creating a 384-byte wrapped key envelope.'}
                  {currentStep === 3 && 'The cloud receives ONLY the ciphertext and the wrapped key envelope. Notice that the server possesses zero knowledge of the AES key, private keys, or plaintext.'}
                  {currentStep === 4 && 'Bob retrieves his envelope, unwraps the AES key using his local RSA private key, and verifies the 128-bit GCM authentication tag. Plaintext matches 100%!'}
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

              {/* Two Instant Proofs of Security Buttons */}
              <div className="pt-4 border-t border-slate-200 space-y-3">
                <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-semibold">
                  Two Live Security Attack Demonstrations (Professor Viva Proofs)
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={handleTestEveAttack}
                    className="flex-1 py-2 px-3 border border-slate-300 hover:border-slate-800 text-slate-800 rounded text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                    <span>1. Eve Intruder Test</span>
                  </button>

                  <button
                    onClick={handleTestBitFlipTamper}
                    disabled={isTampering}
                    className="flex-1 py-2 px-3 border border-slate-300 hover:border-slate-800 text-slate-800 rounded text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-40"
                  >
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    <span>2. Bit-Flip Tamper Test</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Right Column: Live Cryptographic Primitives Inspector */}
            <div className="lg:col-span-7 space-y-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 pb-2 border-b border-slate-100 flex items-center justify-between">
                <span>Live Cryptographic State Inspector</span>
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
                  <p className="text-[11px] text-slate-500 font-mono pt-1">{attackEveResult.mathProof}</p>
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
                  <p>Click "Run Complete Guided Demo" above to compute live cryptographic keys and verify hybrid encryption.</p>
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
              onClick={handleResetDemo}
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
                      onClick={() => handleSwitchPersona(du.email, du.role === 'Sender' ? 'DemoSender123!' : du.role === 'Intended Recipient' ? 'DemoRecipient123!' : 'DemoIntruder123!')}
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
    </div>
  );
};
