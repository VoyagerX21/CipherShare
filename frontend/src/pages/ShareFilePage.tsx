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
  arrayBufferToHex,
  CRYPTO_VERSION
} from '../lib/crypto/webcrypto';
import {
  UploadCloud,
  FileCheck2,
  Users,
  CheckCircle2,
  AlertCircle,
  FileText,
  Shield,
  KeyRound,
  Lock,
  ArrowRight
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
        description: 'Generating a fresh cryptographically secure random 256-bit symmetric key using crypto.subtle.generateKey.',
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
        description: 'Uploading encrypted ciphertext blob to private storage adapter (Local Storage / Supabase).',
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
        description: 'Saving encrypted key envelopes and cryptographic metadata in Flask backend database.',
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
          <UploadCloud className="w-8 h-8 text-sky-400" />
          <span>Share a File Securely</span>
        </h2>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Hybrid encryption: File bytes are encrypted in your browser with AES-256-GCM before upload.
        </p>
      </div>

      {errorMessage && (
        <div className="bg-rose-950/30 border border-rose-500/30 rounded-2xl p-4 text-xs text-rose-300 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-rose-200">Execution Error</div>
            <p className="mt-0.5">{errorMessage}</p>
          </div>
        </div>
      )}

      {completedFileId ? (
        <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-3xl p-8 text-center space-y-4">
          <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-3xl flex items-center justify-center mx-auto border border-emerald-500/30">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">File Successfully Encrypted & Shared!</h3>
            <p className="text-xs text-slate-300 max-w-lg mx-auto mt-1">
              The ciphertext blob is stored in private cloud storage. Intended recipients can now retrieve and unwrap their designated key envelopes.
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 max-w-md mx-auto text-left text-xs space-y-1">
            <div className="text-slate-400">File Reference ID:</div>
            <div className="font-mono text-sky-400 select-all break-all">{completedFileId}</div>
            <div className="text-slate-400 pt-2">Ciphertext Integrity SHA-256:</div>
            <div className="font-mono text-slate-300 text-[11px] select-all break-all">
              {events.find(e => e.stageKey === 'aes_encrypt_file')?.metadata?.ciphertextSHA256}
            </div>
          </div>

          <div className="flex justify-center gap-3 pt-2">
            <button
              onClick={() => {
                setSelectedFile(null);
                setCompletedFileId(null);
                setEvents([]);
              }}
              className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
            >
              Share Another File
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
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
              className="border-2 border-dashed border-slate-700 hover:border-sky-500 rounded-3xl p-6 text-center cursor-pointer transition-colors bg-[#111827]/60"
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
              <div className="p-3 bg-sky-500/10 text-sky-400 rounded-2xl w-fit mx-auto mb-3">
                <UploadCloud className="w-8 h-8" />
              </div>
              <h4 className="text-sm font-bold text-slate-200">
                {selectedFile ? selectedFile.name : 'Select or drop a file'}
              </h4>
              <p className="text-xs text-slate-400 mt-1">
                {selectedFile
                  ? `${(selectedFile.size / 1024).toFixed(1)} KB • ${selectedFile.type || 'application/octet-stream'}`
                  : 'PDF, text, images, or documents up to 25 MB'}
              </p>
              {fileHash && (
                <div className="mt-3 text-[10px] text-slate-500 font-mono break-all select-all bg-slate-900/80 p-2 rounded-xl border border-slate-800">
                  SHA-256: {fileHash}
                </div>
              )}
            </div>

            {/* Recipient Selection */}
            <div className="bg-[#111827] border border-slate-800 rounded-3xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-sky-400" />
                  <span>Select Intended Recipients</span>
                </h4>
                <span className="text-xs text-slate-400">
                  {selectedRecipientIds.length} selected
                </span>
              </div>

              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search user name or email..."
                className="w-full bg-[#0b0f19] border border-slate-700 rounded-xl py-2 px-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500"
              />

              <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                {availableUsers.map((u) => {
                  const isSelected = selectedRecipientIds.includes(u.id);
                  return (
                    <div
                      key={u.id}
                      onClick={() => u.has_public_key && toggleRecipient(u.id)}
                      className={`p-3 rounded-xl border text-xs cursor-pointer transition-all flex items-center justify-between ${
                        !u.has_public_key
                          ? 'opacity-40 cursor-not-allowed bg-slate-900/20 border-slate-800'
                          : isSelected
                          ? 'bg-sky-950/40 border-sky-500 text-sky-200'
                          : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div>
                        <div className="font-semibold text-slate-200">{u.name}</div>
                        <div className="text-[11px] text-slate-400">{u.email}</div>
                        {u.public_key_fingerprint && (
                          <div className="text-[9px] font-mono text-sky-400 mt-0.5 truncate max-w-[220px]">
                            Fingerprint: {u.public_key_fingerprint.substring(0, 16)}...
                          </div>
                        )}
                      </div>
                      <div className="shrink-0">
                        {!u.has_public_key ? (
                          <span className="text-[10px] text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                            No key
                          </span>
                        ) : isSelected ? (
                          <span className="w-5 h-5 bg-sky-500 text-slate-950 rounded-full flex items-center justify-center font-bold text-xs">
                            ✓
                          </span>
                        ) : (
                          <span className="w-5 h-5 border border-slate-700 rounded-full block" />
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
              className="w-full py-3 rounded-2xl text-xs font-bold bg-sky-500 hover:bg-sky-400 text-slate-950 disabled:opacity-40 flex items-center justify-center gap-2 shadow-xl shadow-sky-500/20 transition-colors"
            >
              {isProcessing ? (
                <>
                  <span className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  <span>Encrypting & Uploading in Browser...</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Execute Client-Side Encryption & Share</span>
                </>
              )}
            </button>
          </div>

          {/* Right: Live Cryptographic Execution Monitor */}
          <div className="lg:col-span-7 space-y-4">
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
