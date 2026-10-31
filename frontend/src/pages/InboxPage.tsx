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
  Inbox,
  Download,
  AlertTriangle,
  FileText,
  CheckCircle2,
  AlertOctagon,
  RefreshCw,
  ShieldAlert
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
      // Step 1: Request Download Authorization from Backend
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

      // Step 2: Download Ciphertext Blob from Storage
      const step2Start = performance.now();
      addEvent({
        stageKey: 'fetch_ciphertext',
        title: 'Step 2: Retrieve Encrypted Ciphertext Blob',
        description: 'Downloading raw encrypted binary payload from private cloud storage.',
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

      // Step 3: Unwrap AES Key with RSA-OAEP Private Key
      const step3Start = performance.now();
      addEvent({
        stageKey: 'unwrap_aes_key',
        title: 'Step 3: RSA-OAEP Private-Key AES Key Unwrapping',
        description: 'Unwrapping recipient key envelope using local RSA-OAEP 3072 private key in Web Crypto.',
        status: 'running',
        metadata: {
          algorithm: 'RSA-OAEP-SHA256',
          recipientEnvelopePresent: true
        }
      });

      const aesKey = await unwrapAESKeyWithPrivateKey(
        authData.recipient_envelope.encrypted_aes_key,
        privateKey
      );

      updateLastEvent({
        status: 'success',
        durationMs: Math.round(performance.now() - step3Start),
        metadata: {
          recoveredKeyType: 'AES-256-GCM',
          keyExtractable: true
        }
      });

      // Step 4: Reconstruct Canonical AAD and Nonce
      const step4Start = performance.now();
      const nonce = new Uint8Array(base64ToArrayBuffer(authData.nonce));
      const aad = createCanonicalAAD(authData.file_id, authData.sender_id, authData.crypto_version);

      addEvent({
        stageKey: 'prepare_aad',
        title: 'Step 4: AAD Reconstruction & Nonce Verification',
        description: 'Assembled canonical Additional Authenticated Data binding for tag verification.',
        status: 'success',
        durationMs: Math.round(performance.now() - step4Start),
        metadata: {
          nonceBytes: nonce.length,
          canonicalAADString: new TextDecoder().decode(aad)
        }
      });

      // Step 5: AES-256-GCM Decryption and Tag Authentication
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

      // Step 7: Submit Client-Reported Decryption Audit Event
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
        title: 'Tampering Demo: Altered Ciphertext Test',
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
    <div className="w-full space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Encrypted Inbox</h2>
          <p className="text-xs text-slate-500 mt-1">
            Files shared with you. Plaintext is only recoverable in this browser using your local private key.
          </p>
        </div>
        <button
          onClick={loadInbox}
          className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl flex items-center gap-1.5 text-xs font-medium shadow-2xs transition-colors shrink-0"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh List</span>
        </button>
      </div>

      {feedback && (
        <div className={`p-4 rounded-xl text-xs flex items-start gap-3 border ${
          feedback.type === 'success'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
            : 'bg-rose-50 border-rose-200 text-rose-900'
        }`}>
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <AlertOctagon className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          )}
          <div className="min-w-0">
            <div className="font-bold">{feedback.type === 'success' ? 'Operation Verified' : 'Cryptographic Alert'}</div>
            <p className="mt-0.5 break-words-anywhere">{feedback.message}</p>
          </div>
        </div>
      )}

      {!hasLocalKey && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
          <div className="min-w-0">
            <strong>Local Private Key Missing:</strong> Your browser has no private key stored in IndexedDB. You cannot decrypt received files until your key pair is imported or established.
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Files List */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-500 font-semibold uppercase tracking-wider">
            <span>Available Deliveries</span>
            <span>{files.length} items</span>
          </div>

          {isLoading ? (
            <div className="py-12 text-center text-slate-400 text-xs">Loading received files...</div>
          ) : files.length === 0 ? (
            <div className="p-8 text-center bg-white border border-slate-200 rounded-2xl text-slate-400 text-xs shadow-2xs">
              <FileText className="w-8 h-8 mx-auto mb-2 text-slate-300 stroke-1" />
              <p className="font-semibold text-slate-600">No files in your inbox yet.</p>
              <p className="mt-0.5 text-slate-400">Log in as Alice (Sender) and share a file with this account.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {files.map((file) => {
                const isSelected = activeFile?.id === file.id;
                return (
                  <div
                    key={file.id}
                    className={`p-4 bg-white rounded-2xl border transition-all text-xs shadow-2xs ${
                      isSelected
                        ? 'border-slate-900 ring-1 ring-slate-900/10'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-2.5">
                      <div className="flex items-start space-x-3 min-w-0">
                        <div className="p-2 bg-slate-100 rounded-xl text-slate-700 shrink-0 mt-0.5">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 text-sm break-words-anywhere leading-snug">
                            {file.original_filename}
                          </div>
                          <div className="text-[11px] text-slate-500 break-words-anywhere mt-0.5">
                            From: {file.sender_name || file.sender_email}
                          </div>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600 shrink-0">
                        {(file.file_size / 1024).toFixed(1)} KB
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 mb-3 space-y-1">
                      <div className="flex justify-between">
                        <span>Encryption:</span>
                        <span className="font-mono text-slate-800">{file.encryption_algorithm}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Key Wrapping:</span>
                        <span className="font-mono text-slate-800">{file.key_wrapping_algorithm}</span>
                      </div>
                      <div className="flex justify-between items-baseline gap-2">
                        <span className="shrink-0">Digest:</span>
                        <span className="font-mono text-slate-500 text-[10px] break-words-anywhere">
                          {file.ciphertext_sha256.substring(0, 20)}...
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => triggerDownloadAndDecrypt(file)}
                        disabled={isProcessing}
                        className="flex-1 py-2 px-3 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white flex items-center justify-center gap-1.5 shadow-xs transition-colors disabled:opacity-50"
                      >
                        <Download className="w-3.5 h-3.5 text-sky-400" />
                        <span>Download & Decrypt</span>
                      </button>

                      <button
                        onClick={() => triggerTamperingDemo(file)}
                        disabled={isProcessing}
                        className="px-3 py-2 rounded-xl text-xs font-medium bg-white hover:bg-rose-50 text-rose-700 border border-slate-200 hover:border-rose-200 transition-colors shrink-0"
                        title="Simulate bit-flip tampering test"
                      >
                        <span>Tamper Test</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Live Decryption Execution Monitor (Full Width) */}
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
