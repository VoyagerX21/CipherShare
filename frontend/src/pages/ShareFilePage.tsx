import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../features/auth/AuthContext';
import { api } from '../lib/api/client';
import { ExecutionMonitor } from '../components/monitor/ExecutionMonitor';
import { ExecutionEvent } from '../types';
import {
  generateFileAESKey,
  generateAESNonce,
  createCanonicalAAD,
  encryptFilePayload,
  wrapAESKeyForRecipient,
  importPublicKeyJWK,
  computeSHA256,
  arrayBufferToBase64,
  CRYPTO_VERSION
} from '../lib/crypto/webcrypto';
import {
  UploadCloud,
  Users,
  CheckCircle2,
  AlertCircle,
  FileText,
  Lock,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

export const ShareFilePage: React.FC = () => {
  const { user } = useAuth();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileHash, setFileHash] = useState<string>('');
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);
  const [selectedRecipientIds, setSelectedRecipientIds] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [events, setEvents] = useState<ExecutionEvent[]>([]);
  const [completedFileId, setCompletedFileId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function loadUsers() {
      setIsSearching(true);
      try {
        const res = await api.keys.searchUsers(searchQuery);
        setAvailableUsers(res.users);
      } catch (err) {
        console.error('Failed to load recipients', err);
      } finally {
        setIsSearching(false);
      }
    }
    loadUsers();
  }, [searchQuery]);

  const addEvent = (event: Omit<ExecutionEvent, 'id' | 'timestamp'>) => {
    const fullEvent: ExecutionEvent = {
      ...event,
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toISOString()
    };
    setEvents(prev => [...prev, fullEvent]);
  };

  const updateLastEvent = (patch: Partial<ExecutionEvent>) => {
    setEvents(prev => {
      if (prev.length === 0) return prev;
      const updated = [...prev];
      updated[updated.length - 1] = { ...updated[updated.length - 1], ...patch };
      return updated;
    });
  };

  const handleFileChange = async (file: File) => {
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setErrorMessage(`File exceeds 25 MB limit (${(file.size / (1024 * 1024)).toFixed(2)} MB).`);
      return;
    }
    setErrorMessage(null);
    setSelectedFile(file);
    setCompletedFileId(null);
    setEvents([]);

    // Compute integrity SHA-256 fingerprint
    const buf = await file.arrayBuffer();
    const hash = await computeSHA256(buf);
    setFileHash(hash);
  };

  const toggleRecipient = (id: string) => {
    setSelectedRecipientIds(prev =>
      prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]
    );
  };

  const handleExecuteShare = async () => {
    if (!selectedFile || selectedRecipientIds.length === 0 || !user) {
      setErrorMessage('Please select a file and at least one recipient with a registered public key.');
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);
    setEvents([]);

    try {
      const overallStart = performance.now();

      // Step 1: File Selected & Verified
      addEvent({
        stageKey: 'file_selected',
        title: 'Step 1: File Pre-processing in Browser',
        description: `Inspected ${selectedFile.name} (${(selectedFile.size / 1024).toFixed(1)} KB). Computing client-side SHA-256 reference hash.`,
        status: 'running',
        metadata: {
          filename: selectedFile.name,
          sizeBytes: selectedFile.size,
          mimeType: selectedFile.type || 'application/octet-stream',
          sha256Digest: fileHash
        }
      });
      const fileBytes = await selectedFile.arrayBuffer();
      updateLastEvent({ status: 'success', durationMs: Math.round(performance.now() - overallStart) });

      // Step 2: Initiate Session with Backend
      const step2Start = performance.now();
      addEvent({
        stageKey: 'initiate_session',
        title: 'Step 2: Backend Upload Initiation & Recipient Key Fetch',
        description: 'Transmitting share intent to Flask backend. Backend validates recipient identities and supplies registered public keys.',
        status: 'running'
      });

      const initResponse = await api.files.initiate({
        original_filename: selectedFile.name,
        file_size: selectedFile.size,
        content_type: selectedFile.type || 'application/octet-stream',
        recipient_ids: selectedRecipientIds,
        crypto_version: CRYPTO_VERSION,
        plaintext_sha256: fileHash
      });

      const { file_id, storage_object_key, recipients } = initResponse;

      updateLastEvent({
        status: 'success',
        durationMs: Math.round(performance.now() - step2Start),
        metadata: {
          fileId: file_id,
          storageObjectKey: storage_object_key,
          recipientCount: recipients.length
        }
      });

      // Step 3: Generate fresh AES-256 symmetric key
      const step3Start = performance.now();
      addEvent({
        stageKey: 'aes_key_generated',
        title: 'Step 3: AES-256 Key Generation (Web Crypto)',
        description: 'Generating fresh random 256-bit symmetric key using crypto.subtle.generateKey.',
        status: 'running',
        metadata: {
          algorithm: 'AES-GCM',
          keyLengthBits: 256,
          entropySource: 'crypto.getRandomValues'
        }
      });
      const aesKey = await generateFileAESKey();
      updateLastEvent({ status: 'success', durationMs: Math.round(performance.now() - step3Start) });

      // Step 4: Generate 96-bit fresh Nonce (IV)
      const step4Start = performance.now();
      const nonce = generateAESNonce();
      const nonceBase64 = arrayBufferToBase64(nonce);
      addEvent({
        stageKey: 'nonce_generated',
        title: 'Step 4: AES-GCM Nonce Generation',
        description: 'Generated 96-bit (12-byte) initialization vector (IV/nonce) for AES-GCM authentication.',
        status: 'success',
        durationMs: Math.round(performance.now() - step4Start),
        metadata: {
          nonceBytes: 12,
          nonceBase64: nonceBase64
        }
      });

      // Step 5: Canonical Additional Authenticated Data (AAD)
      const step5Start = performance.now();
      const aad = createCanonicalAAD(file_id, user.id, CRYPTO_VERSION);
      const aadString = new TextDecoder().decode(aad);
      addEvent({
        stageKey: 'aad_created',
        title: 'Step 5: Canonical Additional Authenticated Data (AAD)',
        description: 'Constructed canonical JSON binding fileId, senderId, and cryptoVersion into AES-GCM authentication tag.',
        status: 'success',
        durationMs: Math.round(performance.now() - step5Start),
        metadata: {
          canonicalAAD: aadString,
          boundFields: ['fileId', 'senderId', 'version']
        }
      });

      // Step 6: Client-Side File Encryption (AES-256-GCM)
      const step6Start = performance.now();
      addEvent({
        stageKey: 'aes_encrypt_file',
        title: 'Step 6: Authenticated Payload Encryption (AES-256-GCM)',
        description: 'Encrypting plaintext bytes in browser with 128-bit authentication tag. Plaintext NEVER leaves browser.',
        status: 'running'
      });

      const ciphertextBuffer = await encryptFilePayload(fileBytes, aesKey, nonce, aad);
      const ciphertextDigest = await computeSHA256(ciphertextBuffer);

      updateLastEvent({
        status: 'success',
        durationMs: Math.round(performance.now() - step6Start),
        metadata: {
          ciphertextSizeBytes: ciphertextBuffer.byteLength,
          authTagLengthBits: 128,
          ciphertextSHA256: ciphertextDigest
        }
      });

      // Step 7: Multi-Recipient RSA-OAEP Key Wrapping
      const step7Start = performance.now();
      addEvent({
        stageKey: 'wrap_aes_key',
        title: 'Step 7: RSA-OAEP Multi-Recipient Key Wrapping',
        description: 'Wrapping raw 256-bit AES key separately for each recipient using their RSA-OAEP 3072 public key.',
        status: 'running'
      });

      const keyEnvelopes = [];
      for (const recip of recipients) {
        const recipPubKey = await importPublicKeyJWK(recip.public_key_jwk);
        const wrappedKeyBase64 = await wrapAESKeyForRecipient(aesKey, recipPubKey);
        keyEnvelopes.push({
          recipient_id: recip.recipient_id,
          recipient_public_key_id: recip.public_key_id,
          encrypted_aes_key: wrappedKeyBase64
        });
      }

      updateLastEvent({
        status: 'success',
        durationMs: Math.round(performance.now() - step7Start),
        metadata: {
          envelopesCount: keyEnvelopes.length,
          keyWrappingAlgorithm: 'RSA-OAEP-SHA256',
          rsaModulusBits: 3072
        }
      });

      // Step 8: Upload Ciphertext to Private Cloud Storage
      const step8Start = performance.now();
      addEvent({
        stageKey: 'upload_ciphertext',
        title: 'Step 8: Upload Ciphertext to Private Storage',
        description: 'Uploading encrypted ciphertext blob to private storage adapter.',
        status: 'running'
      });

      const uploadResult = await api.files.uploadCiphertext(file_id, ciphertextBuffer);

      updateLastEvent({
        status: 'success',
        durationMs: Math.round(performance.now() - step8Start),
        metadata: {
          bytesStored: uploadResult.bytes_stored,
          storageVerifiedSHA256: uploadResult.ciphertext_sha256
        }
      });

      // Step 9: Finalize Share on Backend
      const step9Start = performance.now();
      addEvent({
        stageKey: 'complete_share',
        title: 'Step 9: Finalize Cryptographic Session',
        description: 'Saving encrypted key envelopes and cryptographic metadata in Flask database.',
        status: 'running'
      });

      await api.files.complete(file_id, {
        nonce: nonceBase64,
        ciphertext_sha256: ciphertextDigest,
        plaintext_sha256: fileHash,
        crypto_version: CRYPTO_VERSION,
        aad_version: '1.0',
        key_envelopes: keyEnvelopes
      });

      updateLastEvent({
        status: 'success',
        durationMs: Math.round(performance.now() - step9Start),
        metadata: {
          status: 'completed',
          fileId: file_id,
          totalDurationMs: Math.round(performance.now() - overallStart)
        }
      });

      setCompletedFileId(file_id);
    } catch (err: any) {
      console.error('File share failure', err);
      setErrorMessage(err.message || 'Encryption or file sharing failed.');
      addEvent({
        stageKey: 'error',
        title: 'Operation Failed',
        description: err.message || 'An error occurred during cryptographic processing.',
        status: 'failed'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="w-full space-y-8">
      {/* Title */}
      <div className="pb-6 border-b border-slate-200">
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Share an Encrypted File</h2>
        <p className="text-xs text-slate-500 mt-1">
          Hybrid encryption: File bytes are encrypted in your browser with AES-256-GCM before upload.
        </p>
      </div>

      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <div className="font-bold">Execution Error</div>
            <p className="mt-0.5 break-words-anywhere">{errorMessage}</p>
          </div>
        </div>
      )}

      {completedFileId ? (
        <div className="p-8 bg-white border border-slate-200 rounded-2xl text-center space-y-4 shadow-sm">
          <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto border border-emerald-200">
            <CheckCircle2 className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">File Encrypted and Dispatched!</h3>
            <p className="text-xs text-slate-500 max-w-lg mx-auto mt-1">
              Ciphertext is securely stored in private cloud storage. Intended recipients can now unlock their local keys and decrypt the payload.
            </p>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl max-w-xl mx-auto text-left text-xs space-y-2">
            <div>
              <span className="text-slate-400 font-mono text-[11px] block">FILE ID:</span>
              <span className="font-mono text-slate-900 font-semibold break-words-anywhere select-all">
                {completedFileId}
              </span>
            </div>
            <div>
              <span className="text-slate-400 font-mono text-[11px] block">CIPHERTEXT SHA-256:</span>
              <span className="font-mono text-slate-700 text-[11px] break-words-anywhere select-all">
                {events.find(e => e.stageKey === 'aes_encrypt_file')?.metadata?.ciphertextSHA256}
              </span>
            </div>
          </div>

          <div className="pt-2">
            <button
              onClick={() => {
                setSelectedFile(null);
                setCompletedFileId(null);
                setEvents([]);
              }}
              className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors"
            >
              Share Another File
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Form: File and Recipients */}
          <div className="lg:col-span-5 space-y-6">
            {/* File Dropzone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  handleFileChange(e.dataTransfer.files[0]);
                }
              }}
              className="border-2 border-dashed border-slate-300 hover:border-slate-800 rounded-2xl p-6 text-center cursor-pointer transition-colors bg-white shadow-2xs"
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileChange(e.target.files[0]);
                  }
                }}
              />
              <div className="p-3 bg-slate-100 text-slate-700 rounded-xl w-fit mx-auto mb-3">
                <UploadCloud className="w-6 h-6 text-sky-600" />
              </div>
              <h4 className="text-sm font-bold text-slate-900 break-words-anywhere px-2">
                {selectedFile ? selectedFile.name : 'Choose or drag a file to encrypt'}
              </h4>
              <p className="text-xs text-slate-500 mt-1">
                {selectedFile
                  ? `${(selectedFile.size / 1024).toFixed(1)} KB • ${selectedFile.type || 'application/octet-stream'}`
                  : 'PDF, text, images, or documents up to 25 MB'}
              </p>
              {fileHash && (
                <div className="mt-3 text-[10px] text-slate-600 font-mono break-words-anywhere select-all bg-slate-50 p-2 rounded-lg border border-slate-200">
                  SHA-256: {fileHash}
                </div>
              )}
            </div>

            {/* Recipient Selection */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3 shadow-2xs">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-sky-600" />
                  <span>Authorized Recipients</span>
                </h4>
                <span className="text-xs font-semibold text-slate-500">
                  {selectedRecipientIds.length} selected
                </span>
              </div>

              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search recipient name or email..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800"
              />

              <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                {availableUsers.map((u) => {
                  const isSelected = selectedRecipientIds.includes(u.id);
                  return (
                    <div
                      key={u.id}
                      onClick={() => u.has_public_key && toggleRecipient(u.id)}
                      className={`p-3 rounded-xl border text-xs cursor-pointer transition-all flex items-center justify-between gap-3 ${
                        !u.has_public_key
                          ? 'opacity-40 cursor-not-allowed bg-slate-50 border-slate-200'
                          : isSelected
                          ? 'bg-sky-50/70 border-sky-400 text-sky-950 font-medium'
                          : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 break-words-anywhere">{u.name}</div>
                        <div className="text-[11px] text-slate-500 break-words-anywhere">{u.email}</div>
                        {u.public_key_fingerprint && (
                          <div className="text-[9px] font-mono text-slate-500 mt-0.5 break-words-anywhere">
                            FP: {u.public_key_fingerprint.substring(0, 16)}...
                          </div>
                        )}
                      </div>
                      <div className="shrink-0">
                        {!u.has_public_key ? (
                          <span className="text-[10px] text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                            No key
                          </span>
                        ) : isSelected ? (
                          <span className="w-5 h-5 bg-sky-600 text-white rounded-full flex items-center justify-center font-bold text-xs shadow-2xs">
                            ✓
                          </span>
                        ) : (
                          <span className="w-5 h-5 border border-slate-300 rounded-full block" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Execute Button */}
            <button
              onClick={handleExecuteShare}
              disabled={isProcessing || !selectedFile || selectedRecipientIds.length === 0}
              className="w-full py-3 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white disabled:opacity-40 flex items-center justify-center gap-2 shadow-sm transition-colors"
            >
              {isProcessing ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Encrypting & Dispatching in Browser...</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4 text-sky-400" />
                  <span>Execute Client-Side Encryption & Share</span>
                </>
              )}
            </button>
          </div>

          {/* Right: Live Cryptographic Execution Monitor (Full Width) */}
          <div className="lg:col-span-7">
            <ExecutionMonitor
              events={events}
              activeOperationTitle={
                selectedFile
                  ? `Hybrid Encryption of "${selectedFile.name}"`
                  : 'Select file to begin hybrid encryption sequence'
              }
              onReset={() => setEvents([])}
            />
          </div>
        </div>
      )}
    </div>
  );
};
