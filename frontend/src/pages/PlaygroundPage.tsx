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
  arrayBufferToHex
} from '../lib/crypto/webcrypto';
import {
  Play,
  CheckCircle2,
  AlertTriangle
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

  const handleRunRSA = async () => {
    setRsaStatus('running');
    try {
      const keyPair = await generateUserKeyPair();
      const publicJwk = await exportPublicKeyJWK(keyPair.publicKey);
      const jwkObj = JSON.parse(publicJwk);
      const fingerprint = await computeJWKFingerprint(jwkObj);
      const aesKey = await generateFileAESKey();
      const wrappedKeyBase64 = await wrapAESKeyForRecipient(aesKey, keyPair.publicKey);
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

  const handleRunHash = async (text: string) => {
    setHashInput(text);
    const digest = await computeSHA256(text);
    setHashOutput(digest);
  };

  React.useEffect(() => {
    handleRunHash(hashInput);
  }, []);

  const handleRunTamperTest = async () => {
    setTamperResult(null);
    try {
      const key = await generateFileAESKey();
      const nonce = generateAESNonce();
      const enc = new TextEncoder();
      const plaintextBytes = enc.encode('IMPORTANT FINANCIAL TRANSFER: $1,000,000 to Account #99482');
      const aadBytes = enc.encode(tamperModifiedAad ? 'CORRUPTED_METADATA_HEADER' : 'AUTHENTIC_METADATA_HEADER');

      const originalCiphertext = await encryptFilePayload(plaintextBytes.buffer, key, nonce, enc.encode('AUTHENTIC_METADATA_HEADER'));

      const testBuffer = new Uint8Array(originalCiphertext.slice(0));
      if (tamperFlippedBit) {
        testBuffer[10] ^= 0x01;
      }

      try {
        await decryptFilePayload(testBuffer.buffer, key, nonce, aadBytes);
        setTamperResult({
          passed: false,
          message: 'CRITICAL FAILURE: Tampered data was accepted without authentication tag failure!'
        });
      } catch (err) {
        setTamperResult({
          passed: true,
          message: 'SUCCESS: Web Crypto threw OperationError as expected! The 128-bit authentication tag rejected the altered data. Zero plaintext released.'
        });
      }
    } catch (err: any) {
      setTamperResult({ passed: false, message: err.message });
    }
  };

  return (
    <div className="w-full space-y-10">
      {/* Editorial Header */}
      <div className="pb-6 border-b border-slate-200">
        <span className="text-[10px] font-mono tracking-widest uppercase text-slate-400">
          Cryptographic Laboratory
        </span>
        <h2 className="text-3xl font-normal text-slate-900 tracking-tight font-serif mt-1">
          Algorithm Playground
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Explore individual cryptographic primitives in isolation. Verify mathematics, key sizes, and integrity guarantees.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 space-x-8 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('aes')}
          className={`pb-3 border-b-2 transition-colors ${
            activeTab === 'aes' ? 'border-slate-900 text-slate-900 font-bold' : 'border-transparent text-slate-400 hover:text-slate-700'
          }`}
        >
          1. AES-256-GCM Symmetric
        </button>

        <button
          onClick={() => setActiveTab('rsa')}
          className={`pb-3 border-b-2 transition-colors ${
            activeTab === 'rsa' ? 'border-slate-900 text-slate-900 font-bold' : 'border-transparent text-slate-400 hover:text-slate-700'
          }`}
        >
          2. RSA-OAEP 3072 Key Wrap
        </button>

        <button
          onClick={() => setActiveTab('sha')}
          className={`pb-3 border-b-2 transition-colors ${
            activeTab === 'sha' ? 'border-slate-900 text-slate-900 font-bold' : 'border-transparent text-slate-400 hover:text-slate-700'
          }`}
        >
          3. SHA-256 Fingerprinting
        </button>

        <button
          onClick={() => setActiveTab('tamper')}
          className={`pb-3 border-b-2 transition-colors ${
            activeTab === 'tamper' ? 'border-slate-900 text-slate-900 font-bold' : 'border-transparent text-slate-400 hover:text-slate-700'
          }`}
        >
          4. Bit-Flip Tampering Test
        </button>
      </div>

      {/* Tab 1: AES-GCM (Open canvas, no cards) */}
      {activeTab === 'aes' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          <div className="lg:col-span-6 space-y-6">
            <div className="space-y-1">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">Plaintext Message</label>
              <textarea
                rows={3}
                value={aesPlaintext}
                onChange={(e) => setAesPlaintext(e.target.value)}
                className="w-full border-b border-slate-200 py-2 text-xs text-slate-900 font-mono focus:outline-none focus:border-slate-900 bg-transparent break-words-anywhere"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Additional Authenticated Data (AAD)
              </label>
              <textarea
                rows={2}
                value={aesAad}
                onChange={(e) => setAesAad(e.target.value)}
                className="w-full border-b border-slate-200 py-2 text-xs text-slate-900 font-mono focus:outline-none focus:border-slate-900 bg-transparent break-words-anywhere"
              />
              <p className="text-[11px] text-slate-400 pt-1">
                AAD is not encrypted, but it is cryptographically authenticated by the 128-bit GCM tag.
              </p>
            </div>

            <div>
              <button
                onClick={handleRunAES}
                className="py-2.5 px-5 bg-slate-900 hover:bg-slate-800 text-white rounded-md text-xs font-semibold tracking-wide transition-colors flex items-center gap-2"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Run AES-256-GCM Test</span>
              </button>
            </div>
          </div>

          <div className="lg:col-span-6 space-y-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 pb-2 border-b border-slate-100">
              Output Inspector
            </div>

            {aesResult ? (
              <div className="space-y-4 text-xs font-mono">
                <div>
                  <span className="text-slate-400 text-[10px] block">96-BIT NONCE (HEX):</span>
                  <span className="text-slate-900 break-words-anywhere select-all block mt-0.5">{aesResult.nonceHex}</span>
                </div>

                <div>
                  <span className="text-slate-400 text-[10px] block">CIPHERTEXT + 128-BIT TAG (HEX):</span>
                  <span className="text-slate-700 break-words-anywhere select-all block mt-0.5">{aesResult.ciphertextHex}</span>
                </div>

                {aesDecryptResult && (
                  <div className="pt-3 border-t border-slate-100">
                    <span className="text-emerald-700 font-semibold block text-xs">Decrypted Plaintext Output:</span>
                    <p className="font-mono text-slate-900 mt-1 break-words-anywhere font-sans text-xs">{aesDecryptResult.recoveredText}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-slate-400 text-xs py-10 font-mono">
                Run experiment to inspect live Web Crypto outputs.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: RSA-OAEP */}
      {activeTab === 'rsa' && (
        <div className="space-y-6 max-w-4xl">
          <p className="text-xs text-slate-500 leading-relaxed">
            Demonstrates generating a 3072-bit RSA key pair, wrapping an ephemeral 256-bit AES content key, and unwrapping it with the private key.
          </p>

          <button
            onClick={handleRunRSA}
            disabled={rsaStatus === 'running'}
            className="py-2.5 px-5 bg-slate-900 hover:bg-slate-800 text-white rounded-md text-xs font-semibold tracking-wide disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            {rsaStatus === 'running' ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Generating 3072-bit Key & Wrapping...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" />
                <span>Execute RSA-OAEP Key Wrap Test</span>
              </>
            )}
          </button>

          {rsaDetails && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 border-t border-slate-100 text-xs font-mono">
              <div className="space-y-1.5">
                <span className="text-slate-400 text-[10px] uppercase font-bold block">Public Key Fingerprint (RFC 7638 SHA-256):</span>
                <span className="text-slate-900 break-words-anywhere select-all block">{rsaDetails.fingerprint}</span>
                <span className="text-slate-400 text-[11px] block break-words-anywhere font-sans pt-1">Modulus: {rsaDetails.jwkModulusSnippet}</span>
              </div>

              <div className="space-y-1.5">
                <span className="text-slate-400 text-[10px] uppercase font-bold block">Wrapped AES Key Envelope (Base64):</span>
                <span className="text-slate-700 break-words-anywhere select-all block text-[11px]">
                  {rsaDetails.wrappedKeyBase64.substring(0, 120)}...
                </span>
                <span className="text-emerald-700 font-semibold flex items-center gap-1 font-sans text-xs pt-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Unwrapped 256-bit AES Key successfully!</span>
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: SHA-256 */}
      {activeTab === 'sha' && (
        <div className="space-y-6 max-w-3xl">
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">Input Data</label>
            <input
              type="text"
              value={hashInput}
              onChange={(e) => handleRunHash(e.target.value)}
              className="w-full border-b border-slate-200 py-2 text-xs text-slate-900 font-mono focus:outline-none focus:border-slate-900 bg-transparent break-words-anywhere"
            />
          </div>

          <div className="pt-2 font-mono text-xs">
            <span className="text-slate-400 text-[10px] uppercase font-bold block mb-1">SHA-256 Digest (64 hex characters):</span>
            <span className="text-slate-900 select-all break-words-anywhere font-bold">{hashOutput}</span>
          </div>
        </div>
      )}

      {/* Tab 4: Tampering Lab */}
      {activeTab === 'tamper' && (
        <div className="space-y-6 max-w-3xl">
          <p className="text-xs text-slate-500 leading-relaxed">
            Verify how AES-256-GCM's 128-bit authentication tag guarantees ciphertext and metadata integrity. Any 1-bit alteration causes Web Crypto to reject decryption completely.
          </p>

          <div className="flex flex-wrap items-center gap-8 text-xs">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={tamperFlippedBit}
                onChange={(e) => setTamperFlippedBit(e.target.checked)}
                className="w-4 h-4 rounded text-slate-900 focus:ring-0 border-slate-300"
              />
              <span className="text-slate-900 font-medium">Flip 1 bit in Ciphertext (Byte #10)</span>
            </label>

            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={tamperModifiedAad}
                onChange={(e) => setTamperModifiedAad(e.target.checked)}
                className="w-4 h-4 rounded text-slate-900 focus:ring-0 border-slate-300"
              />
              <span className="text-slate-900 font-medium">Modify AAD (Additional Authenticated Data)</span>
            </label>
          </div>

          <button
            onClick={handleRunTamperTest}
            className="py-2.5 px-5 bg-slate-900 hover:bg-slate-800 text-white rounded-md text-xs font-semibold tracking-wide transition-colors flex items-center gap-2"
          >
            <Play className="w-3.5 h-3.5 text-rose-400" />
            <span>Attempt Decryption of Payload</span>
          </button>

          {tamperResult && (
            <div className={`py-3 px-4 border-l-2 text-xs ${
              tamperResult.passed
                ? 'border-emerald-600 bg-emerald-50/70 text-emerald-950'
                : 'border-rose-600 bg-rose-50/70 text-rose-950'
            }`}>
              <div className="font-bold text-xs mb-0.5">
                {tamperResult.passed ? 'Tampering Detected & Blocked' : 'Tampering Test Failed'}
              </div>
              <p className="break-words-anywhere">{tamperResult.message}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
