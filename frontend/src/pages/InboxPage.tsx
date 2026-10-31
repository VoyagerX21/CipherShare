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
  ShieldCheck,
  AlertTriangle,
  Lock,
  Unlock,
  FileText,
  Clock,
  Sparkles,
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
      if (pendingAction === 'decrypt') {
        // Will use the newly unlocked key from context
        setTimeout(() => {
          window.location.reload(); // Refresh memory key or trigger
        }, 100);
      }
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
        description: 'Checking authenticated JWT token against authorized recipient list on Flask backend.',
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
        message: `Successfully decrypted "${authData.original_filename}"! File downloaded to your device.`
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
        message: `Decryption failed: ${err.message || 'Ciphertext integrity check failed.'}`
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
        description: 'Requesting an in-memory bit-flipped copy of the ciphertext to test AES-GCM integrity rejection.',
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
        // If it succeeded, that would be a cryptographic failure!
        updateLastEvent({ status: 'failed', description: 'CRITICAL: Tampered ciphertext was accepted!' });
      } catch (cryptoErr) {
        // Expected failure! AES-GCM successfully rejected tampered ciphertext
        updateLastEvent({
          status: 'success',
          title: 'Tampering Detected & Blocked (AES-GCM Tag Rejected)',
          description: 'Web Crypto threw OperationError as expected! The 128-bit GCM authentication tag did not match.',
          metadata: {
            authTagVerification: 'REJECTED_AS_EXPECTED',
            plaintextReleased: 'NO (Security guarantee preserved)'
          }
        });

        await api.files.reportTamperingDemo(file.id, { result: 'TAMPER_DETECTED' });
        setFeedback({
          type: 'success',
          message: 'Tampering Demo Successful: AES-GCM authentication tag rejected modified ciphertext bytes. Zero plaintext was released!'
        });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Tampering test failed' });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <Inbox className="w-8 h-8 text-sky-400" />
            <span>Encrypted Inbox</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Files shared with you. Plaintext is only recoverable in this browser using your local private key.
          </p>
        </div>
        <button
          onClick={loadInbox}
          className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white border border-slate-700 flex items-center gap-1.5 text-xs"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </button>
      </div>

      {feedback && (
        <div className={`p-4 rounded-2xl text-xs flex items-start gap-3 border ${
          feedback.type === 'success'
            ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300'
            : 'bg-rose-950/30 border-rose-500/30 text-rose-300'
        }`}>
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          ) : (
            <AlertOctagon className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          )}
          <div>
            <div className="font-semibold">{feedback.type === 'success' ? 'Verification Passed' : 'Verification Alert'}</div>
            <p className="mt-0.5">{feedback.message}</p>
          </div>
        </div>
      )}

      {!hasLocalKey && (
        <div className="bg-amber-950/20 border border-amber-500/30 rounded-2xl p-4 text-xs text-amber-300 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
          <span>
            <strong>Local Private Key Missing:</strong> Your browser has no private key stored in IndexedDB. You cannot decrypt received files until you import or establish your key pair.
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Files List */}
        <div className="lg:col-span-5 space-y-3">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
            Available Shares ({files.length})
          </h3>

          {isLoading ? (
            <div className="p-8 text-center text-slate-500 text-xs">Loading received files...</div>
          ) : files.length === 0 ? (
            <div className="p-8 text-center bg-[#111827] border border-slate-800 rounded-3xl text-slate-500 text-xs">
              <FileText className="w-8 h-8 mx-auto mb-2 opacity-40 stroke-1" />
              <p>No files shared with you yet.</p>
              <p className="mt-1 text-[11px] text-slate-600">
                Log in as Alice (Sender) and share a file with this account.
              </p>
            </div>
          ) : (
            files.map((file) => {
              const isSelected = activeFile?.id === file.id;
              return (
                <div
                  key={file.id}
                  className={`p-4 rounded-2xl border transition-all text-xs ${
                    isSelected
                      ? 'bg-sky-950/30 border-sky-500/50 shadow-lg shadow-sky-950/20'
                      : 'bg-[#111827] border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center space-x-2.5">
                      <div className="p-2 bg-sky-500/10 text-sky-400 rounded-xl">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-bold text-slate-100 text-sm">{file.original_filename}</div>
                        <div className="text-[11px] text-slate-400">
                          Sender: {file.sender_name || file.sender_email}
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                      {(file.file_size / 1024).toFixed(1)} KB
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-400 space-y-0.5 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/60 mb-3">
                    <div className="flex justify-between">
                      <span>Encryption:</span>
                      <span className="font-mono text-slate-300">{file.encryption_algorithm}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Key Wrapping:</span>
                      <span className="font-mono text-slate-300">{file.key_wrapping_algorithm}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Ciphertext Digest:</span>
                      <span className="font-mono text-sky-400 text-[10px]">{file.ciphertext_sha256.substring(0, 16)}...</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => triggerDownloadAndDecrypt(file)}
                      disabled={isProcessing}
                      className="flex-1 py-2 rounded-xl text-xs font-bold bg-sky-500 hover:bg-sky-400 text-slate-950 flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download & Decrypt</span>
                    </button>

                    <button
                      onClick={() => triggerTamperingDemo(file)}
                      disabled={isProcessing}
                      className="px-3 py-2 rounded-xl text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 transition-colors flex items-center gap-1"
                      title="Run controlled tampering test on modified copy"
                    >
                      <span>Tamper Test</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right: Live Decryption Execution Monitor */}
        <div className="lg:col-span-7 space-y-4">
          <ExecutionMonitor
            events={events}
            activeOperationTitle={
              activeFile
                ? `Decryption & Verification of "${activeFile.original_filename}"`
                : 'Select an inbox file to begin decryption workflow'
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
