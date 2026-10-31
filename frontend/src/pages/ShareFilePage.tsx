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
  CheckCircle2,
  AlertCircle,
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
  const [searchQuery, setSearchQuery] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [events, setEvents] = useState<ExecutionEvent[]>([]);
  const [completedFileId, setCompletedFileId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function loadUsers() {
      try {
        const res = await api.keys.searchUsers(searchQuery);
        setAvailableUsers(res.users);
      } catch (err) {
        console.error('Failed to load recipients', err);
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

      // Step 1: File pre-processing
      addEvent({
        stageKey: 'file_selected',
        title: 'Step 1: Client-Side Inspection & Digest',
        description: `Read ${selectedFile.name} (${(selectedFile.size / 1024).toFixed(1)} KB). Calculated client-side SHA-256 fingerprint.`,
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

      // Step 2: Initiate session with backend
      const step2Start = performance.now();
      addEvent({
        stageKey: 'initiate_session',
        title: 'Step 2: Upload Authorization & Public Key Retrieval',
        description: 'Initiating file record on backend. Server returns recipients registered RSA-OAEP public keys.',
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
        title: 'Step 3: Web Crypto AES-256 Symmetric Key Generation',
        description: 'Generated fresh 256-bit symmetric key in browser volatile memory (crypto.subtle.generateKey).',
        status: 'running',
        metadata: {
          cipher: 'AES-GCM',
          keyLengthBits: 256
        }
      });
      const aesKey = await generateFileAESKey();
      updateLastEvent({ status: 'success', durationMs: Math.round(performance.now() - step3Start) });

      // Step 4: Generate Nonce
      const step4Start = performance.now();
      const nonce = generateAESNonce();
      const nonceBase64 = arrayBufferToBase64(nonce);
      addEvent({
        stageKey: 'nonce_generated',
        title: 'Step 4: Nonce Generation (96-bit IV)',
        description: 'Generated 96-bit fresh random initialization vector for authenticated GCM encryption.',
        status: 'success',
        durationMs: Math.round(performance.now() - step4Start),
        metadata: {
          nonceBytes: 12,
          nonceBase64: nonceBase64
        }
      });

      // Step 5: Canonical AAD
      const step5Start = performance.now();
      const aad = createCanonicalAAD(file_id, user.id, CRYPTO_VERSION);
      const aadString = new TextDecoder().decode(aad);
      addEvent({
        stageKey: 'aad_created',
        title: 'Step 5: Canonical Additional Authenticated Data Binding',
        description: 'Constructed canonical JSON binding fileId, senderId, and version into the GCM tag.',
        status: 'success',
        durationMs: Math.round(performance.now() - step5Start),
        metadata: {
          canonicalAAD: aadString
        }
      });

      // Step 6: Client-Side AES-256-GCM Encryption
      const step6Start = performance.now();
      addEvent({
        stageKey: 'aes_encrypt_file',
        title: 'Step 6: Authenticated Payload Encryption (AES-256-GCM)',
        description: 'Encrypting plaintext in browser. Plaintext file bytes NEVER leave the browser.',
        status: 'running'
      });

      const ciphertextBuffer = await encryptFilePayload(fileBytes, aesKey, nonce, aad);
      const ciphertextDigest = await computeSHA256(ciphertextBuffer);

      updateLastEvent({
        status: 'success',
        durationMs: Math.round(performance.now() - step6Start),
        metadata: {
          ciphertextSizeBytes: ciphertextBuffer.byteLength,
          tagLengthBits: 128,
          ciphertextSHA256: ciphertextDigest
        }
      });

      // Step 7: Multi-Recipient RSA-OAEP Wrapping
      const step7Start = performance.now();
      addEvent({
        stageKey: 'wrap_aes_key',
        title: 'Step 7: RSA-OAEP 3072 Key Wrapping',
        description: 'Wrapping raw 256-bit AES key separately for each recipient with their RSA-OAEP public key.',
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

      // Step 8: Upload Ciphertext to Storage
      const step8Start = performance.now();
      addEvent({
        stageKey: 'upload_ciphertext',
        title: 'Step 8: Upload Ciphertext to Cloud Object Storage',
        description: 'Transmitting encrypted ciphertext blob to private storage.',
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

      // Step 9: Finalize Share
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
        description: err.message || 'Cryptographic processing error.',
        status: 'failed'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="w-full space-y-10">
      {/* Editorial Header */}
      <div className="pb-6 border-b border-slate-200">
        <span className="text-[10px] font-mono tracking-widest uppercase text-slate-400">
          Outbound Transmission
        </span>
        <h2 className="text-3xl font-normal text-slate-900 tracking-tight font-serif mt-1">
          Share an Encrypted File
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Hybrid encryption: File bytes are encrypted client-side with AES-256-GCM before upload.
        </p>
      </div>

      {errorMessage && (
        <div className="py-3 px-4 border-l-2 border-rose-600 bg-rose-50/60 text-xs text-rose-900 flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <span className="font-semibold">Execution Error: </span>
            <span className="break-words-anywhere">{errorMessage}</span>
          </div>
        </div>
      )}

      {completedFileId ? (
        <div className="py-8 space-y-6">
          <div className="flex items-center space-x-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
            <div>
              <h3 className="text-lg font-semibold text-slate-900">File Encrypted and Dispatched</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Ciphertext blob uploaded to private cloud storage. Intended recipients can now retrieve their envelopes.
              </p>
            </div>
          </div>

          <div className="py-4 border-y border-slate-100 font-mono text-xs space-y-2">
            <div>
              <span className="text-slate-400 text-[11px] block">FILE ID:</span>
              <span className="text-slate-900 font-medium break-words-anywhere select-all">
                {completedFileId}
              </span>
            </div>
            <div>
              <span className="text-slate-400 text-[11px] block">CIPHERTEXT SHA-256:</span>
              <span className="text-slate-600 text-[11px] break-words-anywhere select-all">
                {events.find(e => e.stageKey === 'aes_encrypt_file')?.metadata?.ciphertextSHA256}
              </span>
            </div>
          </div>

          <div>
            <button
              onClick={() => {
                setSelectedFile(null);
                setCompletedFileId(null);
                setEvents([]);
              }}
              className="text-xs font-semibold text-slate-900 hover:text-slate-600 flex items-center gap-1.5"
            >
              <span>Share Another File</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          {/* Left Column: Form (Open, non-boxy) */}
          <div className="lg:col-span-5 space-y-8">
            {/* File Selector */}
            <div className="space-y-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                1. Select File
              </div>
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-b border-dashed border-slate-300 hover:border-slate-800 py-6 cursor-pointer transition-colors"
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
                <div className="space-y-1">
                  <div className="text-sm font-semibold text-slate-900 break-words-anywhere">
                    {selectedFile ? selectedFile.name : 'Click to browse or drop file here'}
                  </div>
                  <div className="text-xs text-slate-500">
                    {selectedFile
                      ? `${(selectedFile.size / 1024).toFixed(1)} KB • ${selectedFile.type || 'application/octet-stream'}`
                      : 'Documents, images, or archives up to 25 MB'}
                  </div>
                </div>
                {fileHash && (
                  <div className="mt-3 text-[10px] text-slate-500 font-mono break-words-anywhere select-all">
                    SHA-256: {fileHash}
                  </div>
                )}
              </div>
            </div>

            {/* Recipient Selector (Open checklist) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-400">
                <span>2. Authorized Recipients</span>
                <span className="font-mono text-slate-500 font-normal">
                  {selectedRecipientIds.length} selected
                </span>
              </div>

              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search recipient by name or email..."
                className="w-full border-b border-slate-200 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-900 bg-transparent"
              />

              <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 pr-1">
                {availableUsers.map((u) => {
                  const isSelected = selectedRecipientIds.includes(u.id);
                  return (
                    <div
                      key={u.id}
                      onClick={() => u.has_public_key && toggleRecipient(u.id)}
                      className={`py-2.5 flex items-start justify-between gap-3 text-xs cursor-pointer transition-colors ${
                        !u.has_public_key
                          ? 'opacity-40 cursor-not-allowed'
                          : isSelected
                          ? 'text-slate-900 font-semibold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="break-words-anywhere font-medium text-slate-900">{u.name}</div>
                        <div className="text-[11px] text-slate-400 break-words-anywhere font-mono">{u.email}</div>
                        {u.public_key_fingerprint && (
                          <div className="text-[10px] font-mono text-slate-400 mt-0.5 break-words-anywhere">
                            FP: {u.public_key_fingerprint.substring(0, 16)}...
                          </div>
                        )}
                      </div>
                      <div className="shrink-0 pt-0.5">
                        {!u.has_public_key ? (
                          <span className="text-[10px] text-slate-400 font-mono">No Key</span>
                        ) : isSelected ? (
                          <span className="text-xs font-bold text-slate-900 font-mono">✓ Added</span>
                        ) : (
                          <span className="text-xs text-slate-400 font-mono">+ Select</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Execute Button */}
            <div className="pt-2">
              <button
                onClick={handleExecuteShare}
                disabled={isProcessing || !selectedFile || selectedRecipientIds.length === 0}
                className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-md text-xs font-semibold tracking-wide disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Encrypting in Browser...</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-3.5 h-3.5" />
                    <span>Encrypt & Dispatch to Cloud Storage</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Right Column: Execution Monitor (Open, seamless, non-boxy) */}
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
