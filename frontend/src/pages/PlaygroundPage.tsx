import React, { useState } from 'react';
import {
  generateFileAESKey,
  generateAESNonce,
  encryptFilePayload,
  decryptFilePayload,
  generateUserKeyPair,
  exportPublicKeyJWK,
  computeJWKFingerprint,
  wrapAESKeyForRecipient,
  unwrapAESKeyWithPrivateKey,
  computeSHA256,
  arrayBufferToHex,
  arrayBufferToBase64,
  hexToArrayBuffer
} from '../lib/crypto/webcrypto';
import {
  Sparkles,
  Cpu,
  KeyRound,
  Hash,
  AlertTriangle,
  Play,
  RotateCcw,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  Layers
} from 'lucide-react';

export const PlaygroundPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'aes' | 'rsa' | 'sha' | 'tamper'>('aes');

  // Tab 1: AES-GCM State
  const [aesPlaintext, setAesPlaintext] = useState('Confidential course message for Cryptography lab demo.');
  const [aesAad, setAesAad] = useState('{"sender":"Alice","recipient":"Bob","classification":"SECRET"}');
  const [aesResult, setAesResult] = useState<any>(null);
  const [aesDecryptResult, setAesDecryptResult] = useState<any>(null);
  const [aesError, setAesError] = useState<string | null>(null);

  // Tab 2: RSA-OAEP State
  const [rsaStatus, setRsaStatus] = useState<string>('idle');
  const [rsaDetails, setRsaDetails] = useState<any>(null);

  // Tab 3: SHA-256 State
  const [hashInput, setHashInput] = useState('Cryptography project: Secure Cloud File Sharing Using Hybrid Cryptography');
  const [hashOutput, setHashOutput] = useState('');

  // Tab 4: Tampering Lab State
  const [tamperModifiedAad, setTamperModifiedAad] = useState(false);
  const [tamperFlippedBit, setTamperFlippedBit] = useState(false);
  const [tamperResult, setTamperResult] = useState<any>(null);

  // Execute AES-256-GCM Experiment
  const handleRunAES = async () => {
    setAesError(null);
    setAesDecryptResult(null);
    try {
      const key = await generateFileAESKey();
      const nonce = generateAESNonce();
      const enc = new TextEncoder();
      const plaintextBytes = enc.encode(aesPlaintext);
      const aadBytes = enc.encode(aesAad);

      const ciphertextBuffer = await encryptFilePayload(plaintextBytes.buffer, key, nonce, aadBytes);
      const ciphertextHex = arrayBufferToHex(ciphertextBuffer);

      setAesResult({
        key,
        nonce,
        nonceHex: arrayBufferToHex(nonce),
        aadBytes,
        ciphertextBuffer,
        ciphertextHex,
        tagLengthBits: 128
      });

      // Test immediate decryption
      const decryptedBuffer = await decryptFilePayload(ciphertextBuffer, key, nonce, aadBytes);
      const dec = new TextDecoder();
      setAesDecryptResult({
        success: true,
        recoveredText: dec.decode(decryptedBuffer)
      });
    } catch (err: any) {
      setAesError(err.message || 'AES encryption failed');
    }
  };

  // Execute RSA-OAEP Experiment
  const handleRunRSA = async () => {
    setRsaStatus('running');
    try {
      // 1. Generate 3072-bit pair
      const keyPair = await generateUserKeyPair();
      const publicJwk = await exportPublicKeyJWK(keyPair.publicKey);
      const jwkObj = JSON.parse(publicJwk);
      const fingerprint = await computeJWKFingerprint(jwkObj);

      // 2. Generate sample AES-256 key
      const aesKey = await generateFileAESKey();

      // 3. Wrap AES key with RSA-OAEP
      const wrappedKeyBase64 = await wrapAESKeyForRecipient(aesKey, keyPair.publicKey);

      // 4. Unwrap AES key with RSA-OAEP private key
      const recoveredKey = await unwrapAESKeyWithPrivateKey(wrappedKeyBase64, keyPair.privateKey);

      setRsaDetails({
        fingerprint,
        jwkModulusSnippet: jwkObj.n.substring(0, 40) + '...',
        wrappedEnvelopeLength: wrappedKeyBase64.length,
        wrappedKeyBase64,
        keyRecovered: true
      });
      setRsaStatus('success');
    } catch (err: any) {
      console.error(err);
      setRsaStatus('error');
    }
  };

  // Execute SHA-256 Digest
  const handleRunHash = async (text: string) => {
    setHashInput(text);
    const digest = await computeSHA256(text);
    setHashOutput(digest);
  };

  React.useEffect(() => {
    handleRunHash(hashInput);
  }, []);

  // Execute Tampering Bit-Flip Lab
  const handleRunTamperTest = async () => {
    setTamperResult(null);
    try {
      const key = await generateFileAESKey();
      const nonce = generateAESNonce();
      const enc = new TextEncoder();
      const plaintextBytes = enc.encode('IMPORTANT FINANCIAL TRANSFER: $1,000,000 to Account #99482');
      const aadBytes = enc.encode(tamperModifiedAad ? 'CORRUPTED_METADATA_HEADER' : 'AUTHENTIC_METADATA_HEADER');

      const originalCiphertext = await encryptFilePayload(plaintextBytes.buffer, key, nonce, enc.encode('AUTHENTIC_METADATA_HEADER'));

      // If bit flip is chosen, mutate a byte
      const testBuffer = new Uint8Array(originalCiphertext.slice(0));
      if (tamperFlippedBit) {
        testBuffer[10] ^= 0x01; // flip 1 bit in byte 10
      }

      try {
        const decrypted = await decryptFilePayload(testBuffer.buffer, key, nonce, aadBytes);
        setTamperResult({
          passed: false,
          message: 'CRITICAL FAILURE: Tampered data was accepted without authentication tag failure!'
        });
      } catch (err) {
        setTamperResult({
          passed: true,
          message: 'SUCCESS: Web Crypto threw OperationError! AES-GCM 128-bit authentication tag rejected the tampered ciphertext/AAD. Zero plaintext was released.'
        });
      }
    } catch (err: any) {
      setTamperResult({ passed: false, message: err.message });
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-mono mb-2">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Interactive Cryptographic Laboratory</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          Cryptographic Playground
        </h2>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Explore individual cryptographic primitives in isolation. Verify mathematics, key sizes, and integrity guarantees.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 space-x-4 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('aes')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'aes' ? 'border-sky-500 text-sky-400' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Cpu className="w-4 h-4" />
          <span>1. AES-256-GCM Symmetric</span>
        </button>

        <button
          onClick={() => setActiveTab('rsa')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'rsa' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <KeyRound className="w-4 h-4" />
          <span>2. RSA-OAEP 3072-bit Key Wrap</span>
        </button>

        <button
          onClick={() => setActiveTab('sha')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'sha' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Hash className="w-4 h-4" />
          <span>3. SHA-256 Fingerprinting</span>
        </button>

        <button
          onClick={() => setActiveTab('tamper')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'tamper' ? 'border-rose-500 text-rose-400' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          <span>4. Bit-Flip Tampering Test</span>
        </button>
      </div>

      {/* Tab 1: AES-GCM */}
      {activeTab === 'aes' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-6 bg-[#111827] border border-slate-800 rounded-3xl p-6 space-y-4">
            <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
              <Cpu className="w-4 h-4 text-sky-400" />
              <span>AES-256-GCM Configuration</span>
            </h3>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Plaintext Message</label>
              <textarea
                rows={3}
                value={aesPlaintext}
                onChange={(e) => setAesPlaintext(e.target.value)}
                className="w-full bg-[#0b0f19] border border-slate-700 rounded-xl p-3 text-xs text-slate-100 font-mono focus:outline-none focus:border-sky-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Additional Authenticated Data (AAD)
              </label>
              <textarea
                rows={2}
                value={aesAad}
                onChange={(e) => setAesAad(e.target.value)}
                className="w-full bg-[#0b0f19] border border-slate-700 rounded-xl p-3 text-xs text-slate-100 font-mono focus:outline-none focus:border-sky-500"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                AAD is not encrypted, but it is cryptographically authenticated by the 128-bit GCM tag.
              </p>
            </div>

            <button
              onClick={handleRunAES}
              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-sky-500 hover:bg-sky-400 text-slate-950 flex items-center gap-2"
            >
              <Play className="w-4 h-4" />
              <span>Run AES-256-GCM Test</span>
            </button>
          </div>

          <div className="lg:col-span-6 bg-[#111827] border border-slate-800 rounded-3xl p-6 space-y-4">
            <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Cryptographic Output Inspector</span>
            </h3>

            {aesResult ? (
              <div className="space-y-3 text-xs">
                <div className="bg-slate-900 p-3 rounded-xl border border-slate-800">
                  <span className="text-slate-400 block font-mono text-[10px]">96-BIT NONCE (HEX):</span>
                  <span className="font-mono text-sky-400 select-all break-all">{aesResult.nonceHex}</span>
                </div>

                <div className="bg-slate-900 p-3 rounded-xl border border-slate-800">
                  <span className="text-slate-400 block font-mono text-[10px]">CIPHERTEXT + 128-BIT AUTH TAG (HEX):</span>
                  <span className="font-mono text-slate-300 select-all break-all">{aesResult.ciphertextHex}</span>
                </div>

                {aesDecryptResult && (
                  <div className="bg-emerald-950/20 border border-emerald-500/30 p-3 rounded-xl">
                    <span className="text-emerald-400 font-semibold block mb-1">Authenticated Decryption Result:</span>
                    <p className="font-mono text-slate-200">{aesDecryptResult.recoveredText}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-slate-500 text-xs py-10 text-center">
                Click "Run AES-256-GCM Test" to inspect live Web Crypto outputs.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: RSA-OAEP */}
      {activeTab === 'rsa' && (
        <div className="bg-[#111827] border border-slate-800 rounded-3xl p-6 space-y-6">
          <div className="max-w-2xl">
            <h3 className="font-bold text-slate-100 text-base flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-indigo-400" />
              <span>RSA-OAEP 3072-bit Key Encapsulation Mechanism</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Demonstrates generating a 3072-bit RSA key pair, wrapping a random 256-bit AES content key, and unwrapping it with the private key.
            </p>
          </div>

          <button
            onClick={handleRunRSA}
            disabled={rsaStatus === 'running'}
            className="px-5 py-2.5 rounded-xl text-xs font-bold bg-indigo-500 hover:bg-indigo-400 text-white flex items-center gap-2 disabled:opacity-50"
          >
            {rsaStatus === 'running' ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Generating 3072-bit Key & Wrapping...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                <span>Execute RSA-OAEP Key Wrap Test</span>
              </>
            )}
          </button>

          {rsaDetails && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 space-y-2">
                <span className="text-slate-400 font-semibold block">Public Key Fingerprint (RFC 7638 SHA-256):</span>
                <span className="font-mono text-sky-400 break-all select-all block">{rsaDetails.fingerprint}</span>
                <span className="text-slate-500 text-[11px] block">Public Modulus: {rsaDetails.jwkModulusSnippet}</span>
              </div>

              <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 space-y-2">
                <span className="text-slate-400 font-semibold block">Wrapped AES Key Envelope (Base64):</span>
                <span className="font-mono text-indigo-300 break-all select-all block text-[11px]">
                  {rsaDetails.wrappedKeyBase64.substring(0, 100)}...
                </span>
                <span className="text-emerald-400 text-[11px] font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Unwrapped & Recovered 256-bit AES Key successfully!</span>
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: SHA-256 */}
      {activeTab === 'sha' && (
        <div className="bg-[#111827] border border-slate-800 rounded-3xl p-6 space-y-4 max-w-2xl">
          <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
            <Hash className="w-4 h-4 text-emerald-400" />
            <span>SHA-256 Digest Calculator</span>
          </h3>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Input Data</label>
            <input
              type="text"
              value={hashInput}
              onChange={(e) => handleRunHash(e.target.value)}
              className="w-full bg-[#0b0f19] border border-slate-700 rounded-xl p-3 text-xs text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800">
            <span className="text-slate-400 font-semibold text-xs block mb-1">SHA-256 Digest (64 hex characters):</span>
            <span className="font-mono text-emerald-400 text-xs select-all break-all">{hashOutput}</span>
          </div>
        </div>
      )}

      {/* Tab 4: Tampering Lab */}
      {activeTab === 'tamper' && (
        <div className="bg-[#111827] border border-slate-800 rounded-3xl p-6 space-y-6">
          <div className="max-w-2xl">
            <h3 className="font-bold text-slate-100 text-base flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-400" />
              <span>Controlled Tampering Simulation</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Test how AES-256-GCM's 128-bit authentication tag guarantees ciphertext and metadata integrity. Any 1-bit modification will cause Web Crypto to reject decryption completely.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-xs">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={tamperFlippedBit}
                onChange={(e) => setTamperFlippedBit(e.target.checked)}
                className="w-4 h-4 rounded text-rose-500 focus:ring-0 bg-slate-900 border-slate-700"
              />
              <span className="text-slate-200">Flip 1 bit in Ciphertext (Byte #10)</span>
            </label>

            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={tamperModifiedAad}
                onChange={(e) => setTamperModifiedAad(e.target.checked)}
                className="w-4 h-4 rounded text-rose-500 focus:ring-0 bg-slate-900 border-slate-700"
              />
              <span className="text-slate-200">Modify AAD (Additional Authenticated Data)</span>
            </label>
          </div>

          <button
            onClick={handleRunTamperTest}
            className="px-5 py-2.5 rounded-xl text-xs font-bold bg-rose-500 hover:bg-rose-400 text-slate-950 flex items-center gap-2"
          >
            <Play className="w-4 h-4" />
            <span>Attempt Decryption of Payload</span>
          </button>

          {tamperResult && (
            <div className={`p-4 rounded-2xl text-xs border ${
              tamperResult.passed
                ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-950/20 border-rose-500/30 text-rose-300'
            }`}>
              <div className="font-bold text-sm mb-1">
                {tamperResult.passed ? 'Tampering Detected & Blocked' : 'Tampering Test Failed'}
              </div>
              <p>{tamperResult.message}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
