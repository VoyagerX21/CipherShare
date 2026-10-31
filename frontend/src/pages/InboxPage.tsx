import React, { useState, useEffect } from 'react';
import { useAuth } from '../features/auth/AuthContext';
import { api } from '../lib/api/client';
import { SharedFile, ExecutionEvent } from '../types';
import { ExecutionMonitor } from '../components/monitor/ExecutionMonitor';
import { PassphraseModal } from '../components/common/PassphraseModal';
import {
  unwrapAESKeyWithPrivateKey,
  decryptFilePayload,
  createCanonicalAAD,
  base64ToArrayBuffer,
  computeSHA256
} from '../lib/crypto/webcrypto';
import {
  Download,
  AlertTriangle,
  CheckCircle2,
  AlertOctagon,
  RefreshCw
} from 'lucide-react';

export const InboxPage: React.FC = () => {
  const { user, hasLocalKey, isKeyUnlocked, unlockedKey } = useAuth();
  const [files, setFiles] = useState<SharedFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeFile, setActiveFile] = useState<SharedFile | null>(null);
  const [events, setEvents] = useState<ExecutionEvent[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPassphraseModalOpen, setIsPassphraseModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<'decrypt' | 'tamper' | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadInbox = async () => {
    setIsLoading(true);
    try {
      const res = await api.files.getInbox();
      setFiles(res.files);
    } catch (err) {
      console.error('Failed to load inbox', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadInbox();
  }, []);

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

  const triggerDownloadAndDecrypt = (file: SharedFile) => {
    setActiveFile(file);
    setFeedback(null);
    if (!isKeyUnlocked) {
      setPendingAction('decrypt');
      setIsPassphraseModalOpen(true);
    } else {
      executeDecryption(file, unlockedKey!);
    }
  };

  const triggerTamperingDemo = (file: SharedFile) => {
    setActiveFile(file);
    setFeedback(null);
    if (!isKeyUnlocked) {
      setPendingAction('tamper');
      setIsPassphraseModalOpen(true);
    } else {
      executeTamperingDemo(file, unlockedKey!);
    }
  };

  const handlePassphraseSuccess = () => {
    setIsPassphraseModalOpen(false);
    if (activeFile) {
      setTimeout(() => {
        window.location.reload();
      }, 100);
    }
  };

  const executeDecryption = async (file: SharedFile, privateKey: CryptoKey) => {
    setIsProcessing(true);
    setEvents([]);
    const overallStart = performance.now();

    try {
      // Step 1: Authorization
      const step1Start = performance.now();
      addEvent({
        stageKey: 'auth_download',
        title: 'Step 1: Backend Recipient Authorization Check',
        description: 'Verifying authenticated JWT session against recipient access control list.',
        status: 'running'
      });

      const authData = await api.files.authorizeDownload(file.id);

      updateLastEvent({
        status: 'success',
        durationMs: Math.round(performance.now() - step1Start),
        metadata: {
          fileId: authData.file_id,
          recipientId: authData.recipient_envelope.recipient_id,
          cryptoVersion: authData.crypto_version
        }
      });

      // Step 2: Download Ciphertext Blob
      const step2Start = performance.now();
      addEvent({
        stageKey: 'fetch_ciphertext',
        title: 'Step 2: Download Ciphertext Payload',
        description: 'Downloading raw encrypted binary payload from cloud object storage.',
        status: 'running'
      });

      const ciphertextBuffer = await api.files.downloadCiphertextBlob(file.id);
      const downloadedHash = await computeSHA256(ciphertextBuffer);

      updateLastEvent({
        status: 'success',
        durationMs: Math.round(performance.now() - step2Start),
        metadata: {
          bytesReceived: ciphertextBuffer.byteLength,
          ciphertextSHA256: downloadedHash
        }
      });

      // Step 3: Unwrap AES Key
      const step3Start = performance.now();
      addEvent({
        stageKey: 'unwrap_aes_key',
        title: 'Step 3: RSA-OAEP Key Unwrapping',
        description: 'Unwrapping recipient key envelope using local RSA-OAEP 3072 private key in Web Crypto.',
        status: 'running'
      });

      const aesKey = await unwrapAESKeyWithPrivateKey(
        authData.recipient_envelope.encrypted_aes_key,
        privateKey
      );

      updateLastEvent({
        status: 'success',
        durationMs: Math.round(performance.now() - step3Start),
        metadata: {
          recoveredKeyType: 'AES-256-GCM'
        }
      });

      // Step 4: Reconstruct AAD & Nonce
      const step4Start = performance.now();
      const nonce = new Uint8Array(base64ToArrayBuffer(authData.nonce));
      const aad = createCanonicalAAD(authData.file_id, authData.sender_id, authData.crypto_version);

      addEvent({
        stageKey: 'prepare_aad',
        title: 'Step 4: Canonical AAD Verification',
        description: 'Assembled canonical Additional Authenticated Data binding for tag verification.',
        status: 'success',
        durationMs: Math.round(performance.now() - step4Start),
        metadata: {
          nonceBytes: nonce.length,
          canonicalAADString: new TextDecoder().decode(aad)
        }
      });

      // Step 5: AES-256-GCM Decryption
      const step5Start = performance.now();
      addEvent({
        stageKey: 'aes_gcm_decrypt',
        title: 'Step 5: AES-256-GCM Authenticated Decryption',
        description: 'Executing subtleCrypto.decrypt. Verifying 128-bit authentication tag.',
        status: 'running'
      });

      const plaintextBuffer = await decryptFilePayload(ciphertextBuffer, aesKey, nonce, aad);
      const plaintextHash = await computeSHA256(plaintextBuffer);

      updateLastEvent({
        status: 'success',
        durationMs: Math.round(performance.now() - step5Start),
        metadata: {
          decryptedSizeBytes: plaintextBuffer.byteLength,
          gcmAuthenticationTag: 'VALID',
          plaintextSHA256: plaintextHash
        }
      });

      // Step 6: Browser File Download
      const blob = new Blob([plaintextBuffer], { type: authData.content_type || 'application/octet-stream' });
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = authData.original_filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);

      // Step 7: Submit Audit Event
      await api.files.reportDecryptionResult(file.id, { status: 'SUCCESS' });

      setFeedback({
        type: 'success',
        message: `Successfully decrypted "${authData.original_filename}"! File saved to your local downloads.`
      });
      loadInbox();
    } catch (err: any) {
      console.error('Decryption failed', err);
      await api.files.reportDecryptionResult(file.id, {
        status: 'FAILED',
        error_message: err.message || 'Decryption integrity failure'
      });
      addEvent({
        stageKey: 'decrypt_failed',
        title: 'AES-GCM Decryption / Integrity Failure',
        description: err.message || 'Authentication tag mismatch or wrong private key.',
        status: 'failed'
      });
      setFeedback({
        type: 'error',
        message: `Decryption failed: ${err.message || 'Ciphertext authentication check failed.'}`
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const executeTamperingDemo = async (file: SharedFile, privateKey: CryptoKey) => {
    setIsProcessing(true);
    setEvents([]);
    try {
      addEvent({
        stageKey: 'tamper_start',
        title: 'Tampering Demo: In-Memory Alteration Test',
        description: 'Retrieving an in-memory bit-flipped copy of the ciphertext to test AES-GCM integrity rejection.',
        status: 'running'
      });

      const authData = await api.files.authorizeDownload(file.id);
      const tamperedBuffer = await api.files.getTamperedContent(file.id);
      const aesKey = await unwrapAESKeyWithPrivateKey(authData.recipient_envelope.encrypted_aes_key, privateKey);
      const nonce = new Uint8Array(base64ToArrayBuffer(authData.nonce));
      const aad = createCanonicalAAD(authData.file_id, authData.sender_id, authData.crypto_version);

      addEvent({
        stageKey: 'tamper_verify',
        title: 'Executing AES-GCM Decryption on Tampered Bytes',
        description: 'SubtleCrypto will verify the 128-bit authentication tag against modified bytes.',
        status: 'running'
      });

      try {
        await decryptFilePayload(tamperedBuffer, aesKey, nonce, aad);
        updateLastEvent({ status: 'failed', description: 'CRITICAL: Tampered ciphertext was accepted!' });
      } catch (cryptoErr) {
        updateLastEvent({
          status: 'success',
          title: 'Tampering Detected & Blocked (Tag Mismatch)',
          description: 'Web Crypto threw OperationError as expected! The 128-bit GCM authentication tag did not match.',
          metadata: {
            authTagVerification: 'REJECTED_AS_EXPECTED',
            plaintextReleased: 'NO (Security guarantee preserved)'
          }
        });

        await api.files.reportTamperingDemo(file.id, { result: 'TAMPER_DETECTED' });
        setFeedback({
          type: 'success',
          message: 'Tampering Demo Passed: AES-GCM authentication tag rejected modified ciphertext bytes. Zero plaintext was released!'
        });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Tampering test failed' });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="w-full space-y-10">
      {/* Editorial Header */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <span className="text-[10px] font-mono tracking-widest uppercase text-slate-400">
            Inbound Deliveries
          </span>
          <h2 className="text-3xl font-normal text-slate-900 tracking-tight font-serif mt-1">
            Encrypted Inbox
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Files shared with you. Plaintext is only recoverable in this browser using your local private key.
          </p>
        </div>
        <button
          onClick={loadInbox}
          className="text-xs font-semibold text-slate-900 hover:text-slate-600 flex items-center gap-1.5 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </button>
      </div>

      {feedback && (
        <div className={`py-3 px-4 border-l-2 text-xs flex items-start gap-3 ${
          feedback.type === 'success'
            ? 'border-emerald-600 bg-emerald-50/70 text-emerald-950'
            : 'border-rose-600 bg-rose-50/70 text-rose-950'
        }`}>
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <AlertOctagon className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          )}
          <div className="min-w-0">
            <span className="font-semibold">{feedback.type === 'success' ? 'Verification Passed: ' : 'Cryptographic Alert: '}</span>
            <span className="break-words-anywhere">{feedback.message}</span>
          </div>
        </div>
      )}

      {!hasLocalKey && (
        <div className="py-3 px-4 border-l-2 border-amber-500 bg-amber-50/60 text-xs text-amber-900 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            <strong>Local Private Key Missing:</strong> Your browser has no private key stored in IndexedDB. You cannot decrypt received deliveries.
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
        {/* Left Column: Open Deliveries List (No card box) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 pb-2 border-b border-slate-100 flex justify-between">
            <span>Received Deliveries</span>
            <span className="font-mono text-slate-500 font-normal">{files.length} available</span>
          </div>

          {isLoading ? (
            <div className="py-12 text-slate-400 text-xs font-mono">Loading inbox...</div>
          ) : files.length === 0 ? (
            <div className="py-12 text-slate-400 text-xs space-y-1">
              <p className="font-medium text-slate-700">No files in your inbox.</p>
              <p className="text-slate-400">Log in as Alice (Sender) and share a file with this account.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {files.map((file) => {
                const isSelected = activeFile?.id === file.id;
                return (
                  <div
                    key={file.id}
                    className={`py-4 space-y-2.5 transition-colors ${isSelected ? 'bg-slate-50/60 px-2' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="font-semibold text-slate-900 text-xs break-words-anywhere leading-snug">
                          {file.original_filename}
                        </div>
                        <div className="text-[11px] text-slate-500 break-words-anywhere font-mono">
                          From: {file.sender_name || file.sender_email} • {(file.file_size / 1024).toFixed(1)} KB
                        </div>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400 shrink-0">
                        {file.encryption_algorithm}
                      </span>
                    </div>

                    <div className="text-[11px] font-mono text-slate-400 break-words-anywhere">
                      Digest: {file.ciphertext_sha256.substring(0, 24)}...
                    </div>

                    <div className="flex items-center space-x-4 pt-1">
                      <button
                        onClick={() => triggerDownloadAndDecrypt(file)}
                        disabled={isProcessing}
                        className="text-xs font-semibold text-slate-900 hover:text-slate-600 flex items-center gap-1.5 transition-colors disabled:opacity-40"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download & Decrypt</span>
                      </button>

                      <span className="text-slate-200">|</span>

                      <button
                        onClick={() => triggerTamperingDemo(file)}
                        disabled={isProcessing}
                        className="text-xs font-medium text-rose-700 hover:text-rose-900 transition-colors disabled:opacity-40"
                      >
                        Tamper Test
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Execution Monitor (Open, seamless) */}
        <div className="lg:col-span-7">
          <ExecutionMonitor
            events={events}
            activeOperationTitle={
              activeFile
                ? `Decryption & Verification of "${activeFile.original_filename}"`
                : 'Select a delivery to begin cryptographic decryption'
            }
            onReset={() => setEvents([])}
          />
        </div>
      </div>

      <PassphraseModal
        isOpen={isPassphraseModalOpen}
        onClose={() => setIsPassphraseModalOpen(false)}
        onSuccess={handlePassphraseSuccess}
      />
    </div>
  );
};
