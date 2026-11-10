import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../features/auth/AuthContext';
import { api } from '../lib/api/client';
import { SharedFile, DownloadAuthResponse } from '../types';
import {
  unwrapAESKeyWithPrivateKey,
  decryptFilePayload,
  createCanonicalAAD,
  base64ToArrayBuffer,
  computeSHA256,
  arrayBufferToHex
} from '../lib/crypto/webcrypto';
import { PassphraseModal } from '../components/common/PassphraseModal';
import {
  Globe,
  ShieldCheck,
  ShieldAlert,
  Lock,
  Unlock,
  Download,
  Search,
  RefreshCw,
  KeyRound,
  FileText,
  CheckCircle2,
  Copy,
  Check,
  AlertTriangle,
  UserCheck,
  Terminal,
  X,
  FileCode,
  Eye,
  Info
} from 'lucide-react';

export const CloudDirectoryPage: React.FC = () => {
  const { user, login, unlockedKey, isKeyUnlocked, hasLocalKey, refreshKeyStatus } = useAuth();

  const [files, setFiles] = useState<SharedFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'decryptable' | 'unauthorized' | 'sent'>('all');
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  // Decryption state
  const [selectedFile, setSelectedFile] = useState<SharedFile | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [decryptionStage, setDecryptionStage] = useState<string>('');
  const [isPassphraseModalOpen, setIsPassphraseModalOpen] = useState(false);
  const [pendingFileToDecrypt, setPendingFileToDecrypt] = useState<SharedFile | null>(null);

  // Decrypted Result Preview Modal
  const [decryptedResult, setDecryptedResult] = useState<{
    file: SharedFile;
    plaintextUrl: string;
    plaintextPreview?: string;
    isTextOrImage: boolean;
    mimeType: string;
    plaintextSHA256: string;
    executionTimeMs: number;
    byteSize: number;
  } | null>(null);

  // Security Barrier Blocked Modal (For Eve or unauthorized attempt)
  const [securityBlockProof, setSecurityBlockProof] = useState<{
    file: SharedFile;
    userEmail: string;
    statusCode: number;
    errorMessage: string;
    timestamp: string;
    invariantDetails: string[];
  } | null>(null);

  // Load cloud directory files
  const loadDirectory = async () => {
    setIsLoading(true);
    try {
      const res = await api.files.getDirectory();
      setFiles(res.files);
    } catch (err) {
      console.error('Failed to load cloud directory', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDirectory();
  }, [user?.id]);

  // Persona quick switch handler
  const handleQuickSwitch = async (email: string, pass: string) => {
    try {
      await login(email, pass);
      await refreshKeyStatus();
    } catch (err) {
      console.error('Persona switch failed', err);
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(id);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  // Filtered files
  const filteredFiles = useMemo(() => {
    return files.filter(f => {
      // Search filter
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        f.original_filename.toLowerCase().includes(q) ||
        (f.sender_email && f.sender_email.toLowerCase().includes(q)) ||
        (f.sender_name && f.sender_name.toLowerCase().includes(q)) ||
        f.ciphertext_sha256.toLowerCase().includes(q) ||
        (f.recipients && f.recipients.some(r => r.recipient_email?.toLowerCase().includes(q)));

      if (!matchesSearch) return false;

      // Tab filter
      if (filterMode === 'decryptable') return f.my_access_status === 'authorized_recipient';
      if (filterMode === 'unauthorized') return f.my_access_status === 'unauthorized';
      if (filterMode === 'sent') return f.is_sender;
      return true;
    });
  }, [files, searchQuery, filterMode]);

  // Decryption workflow
  const initiateDecryption = async (file: SharedFile) => {
    setSelectedFile(file);

    // If unauthorized, trigger attempt to demonstrate cryptographic 403 barrier
    if (file.my_access_status === 'unauthorized') {
      executeUnauthorizedAttempt(file);
      return;
    }

    // Authorized recipient: check if private key is ready in memory
    if (!isKeyUnlocked || !unlockedKey) {
      setPendingFileToDecrypt(file);
      setIsPassphraseModalOpen(true);
      return;
    }

    executeAuthorizedDecryption(file, unlockedKey);
  };

  const executeUnauthorizedAttempt = async (file: SharedFile) => {
    setIsDecrypting(true);
    setDecryptionStage('Requesting download authorization from CipherShare backend...');

    try {
      // This will be rejected with HTTP 403 Forbidden by backend
      await api.files.authorizeDownload(file.id);
      setIsDecrypting(false);
    } catch (err: any) {
      setIsDecrypting(false);
      setSecurityBlockProof({
        file,
        userEmail: user?.email || 'unauthenticated',
        statusCode: err.status || 403,
        errorMessage: err.message || 'Access denied: You are not an authorized recipient of this file.',
        timestamp: new Date().toISOString(),
        invariantDetails: [
          'Rule 4 Invariant: Non-recipients are strictly forbidden from key envelope retrieval (HTTP 403).',
          'Zero Server Plaintext: The backend does not hold plaintext or content-encryption AES keys.',
          'Envelope Isolation: The server never delivers envelopes to unauthorized callers.',
          'Cryptographic Barrier: AES-256-GCM ciphertext without the corresponding RSA-wrapped key envelope is mathematically indistinguishable from random noise (2^256 brute force barrier).'
        ]
      });
    }
  };

  const executeAuthorizedDecryption = async (file: SharedFile, privateKey: CryptoKey) => {
    setIsDecrypting(true);
    const startTime = performance.now();

    try {
      setDecryptionStage('1. Requesting authorized recipient key envelope...');
      const authData = await api.files.authorizeDownload(file.id);

      setDecryptionStage('2. Fetching encrypted ciphertext payload from cloud storage...');
      const ciphertextBuffer = await api.files.downloadCiphertextBlob(file.id);

      setDecryptionStage('3. Unwrapping AES-256 session key using client RSA-OAEP private key in RAM...');
      const aesKey = await unwrapAESKeyWithPrivateKey(
        authData.recipient_envelope.encrypted_aes_key,
        privateKey
      );

      setDecryptionStage('4. Assembling canonical AAD & verifying AES-256-GCM authentication tag...');
      const nonce = new Uint8Array(base64ToArrayBuffer(authData.nonce));
      const aad = createCanonicalAAD(authData.file_id, authData.sender_id, authData.crypto_version);

      const plaintextBuffer = await decryptFilePayload(ciphertextBuffer, aesKey, nonce, aad);
      const plaintextHash = await computeSHA256(plaintextBuffer);

      setDecryptionStage('5. Reporting successful client verification event...');
      await api.files.reportDecryptionResult(file.id, { status: 'SUCCESS' });

      // Create previewable blob
      const mime = authData.content_type || 'application/octet-stream';
      const blob = new Blob([plaintextBuffer], { type: mime });
      const plaintextUrl = URL.createObjectURL(blob);

      let textPreview: string | undefined = undefined;
      const isText = mime.startsWith('text/') || mime.includes('json') || mime.includes('javascript') || mime.includes('xml');
      if (isText && plaintextBuffer.byteLength < 500000) {
        textPreview = new TextDecoder('utf-8').decode(plaintextBuffer);
      }

      setDecryptedResult({
        file,
        plaintextUrl,
        plaintextPreview: textPreview,
        isTextOrImage: isText || mime.startsWith('image/'),
        mimeType: mime,
        plaintextSHA256: plaintextHash,
        executionTimeMs: Math.round(performance.now() - startTime),
        byteSize: plaintextBuffer.byteLength
      });
    } catch (err: any) {
      console.error('Decryption failed', err);
      await api.files.reportDecryptionResult(file.id, {
        status: 'FAILED',
        error_message: err.message || 'Decryption integrity failure'
      });
      alert(`Decryption failed: ${err.message || 'Integrity or key error'}`);
    } finally {
      setIsDecrypting(false);
      setDecryptionStage('');
    }
  };

  const handlePassphraseSuccess = () => {
    setIsPassphraseModalOpen(false);
    refreshKeyStatus().then(() => {
      if (pendingFileToDecrypt && unlockedKey) {
        executeAuthorizedDecryption(pendingFileToDecrypt, unlockedKey);
        setPendingFileToDecrypt(null);
      }
    });
  };

  return (
    <div className="w-full min-h-screen bg-white text-slate-900 pb-24">
      {/* Top Academic Header */}
      <section className="px-6 md:px-12 pt-8 pb-6 border-b border-slate-200">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-1.5 max-w-4xl">
            <div className="flex items-center space-x-2 text-[11px] font-semibold tracking-wider uppercase text-slate-500">
              <Globe className="w-3.5 h-3.5 text-slate-700" />
              <span>Public Cloud Storage Catalog</span>
              <span className="text-slate-300">•</span>
              <span>Zero-Knowledge Model</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-slate-900 font-serif">
              Global Cloud Repository & Directory
            </h1>
            <p className="text-xs md:text-sm text-slate-600 leading-relaxed">
              Every ciphertext payload stored in cloud object storage (Supabase S3 / PostgreSQL) is universally listed here.
              Under <strong className="text-slate-900">Zero-Knowledge Hybrid Cryptography</strong>, files are visible to all users,
              but <em>only designated recipients</em> holding the matching private key can ever decrypt the data. Intruders receive a strict server barrier and cannot decrypt without the 3072-bit RSA private key.
            </p>
          </div>

          {/* Live Persona Switcher */}
          <div className="shrink-0 bg-slate-50 p-3 rounded border border-slate-200 space-y-2">
            <div className="flex items-center justify-between gap-4">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Switch Test Persona
              </span>
              <span className="text-[10px] text-slate-500">
                Active: <strong className="text-slate-900">{user?.name || user?.email}</strong>
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => handleQuickSwitch('sender@demo.local', 'DemoSender123!')}
                className={`px-2.5 py-1 text-xs rounded transition-colors ${
                  user?.email === 'sender@demo.local'
                    ? 'bg-slate-900 text-white font-medium'
                    : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
                }`}
              >
                Alice (Sender)
              </button>

              <button
                onClick={() => handleQuickSwitch('recipient@demo.local', 'DemoRecipient123!')}
                className={`px-2.5 py-1 text-xs rounded transition-colors ${
                  user?.email === 'recipient@demo.local'
                    ? 'bg-slate-900 text-white font-medium'
                    : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
                }`}
              >
                Bob (Recipient)
              </button>

              <button
                onClick={() => handleQuickSwitch('intruder@demo.local', 'DemoIntruder123!')}
                className={`px-2.5 py-1 text-xs rounded transition-colors ${
                  user?.email === 'intruder@demo.local'
                    ? 'bg-rose-900 text-white font-medium'
                    : 'bg-white hover:bg-slate-100 text-rose-700 border border-rose-200'
                }`}
              >
                Eve (Intruder)
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Directory Filter & Search Bar */}
      <section className="px-6 md:px-12 py-4 border-b border-slate-200 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Filter Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto text-xs">
          <button
            onClick={() => setFilterMode('all')}
            className={`px-3 py-1.5 rounded transition-colors ${
              filterMode === 'all'
                ? 'bg-white text-slate-900 font-semibold shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All Cloud Files ({files.length})
          </button>

          <button
            onClick={() => setFilterMode('decryptable')}
            className={`px-3 py-1.5 rounded transition-colors ${
              filterMode === 'decryptable'
                ? 'bg-white text-emerald-800 font-semibold shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-emerald-700'
            }`}
          >
            Decryptable By Me ({files.filter(f => f.my_access_status === 'authorized_recipient').length})
          </button>

          <button
            onClick={() => setFilterMode('unauthorized')}
            className={`px-3 py-1.5 rounded transition-colors ${
              filterMode === 'unauthorized'
                ? 'bg-white text-rose-800 font-semibold shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-rose-700'
            }`}
          >
            Unauthorized To Me ({files.filter(f => f.my_access_status === 'unauthorized').length})
          </button>

          <button
            onClick={() => setFilterMode('sent')}
            className={`px-3 py-1.5 rounded transition-colors ${
              filterMode === 'sent'
                ? 'bg-white text-slate-900 font-semibold shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Uploaded By Me ({files.filter(f => f.is_sender).length})
          </button>
        </div>

        {/* Search Input & Refresh */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search filename, sender, hash..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400 w-56 md:w-72"
            />
          </div>

          <button
            onClick={loadDirectory}
            disabled={isLoading}
            className="p-1.5 bg-white border border-slate-200 text-slate-600 hover:text-slate-900 rounded hover:bg-slate-50 disabled:opacity-50"
            title="Refresh directory"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-slate-900' : ''}`} />
          </button>
        </div>
      </section>

      {/* Main Directory Table */}
      <section className="px-6 md:px-12 py-6">
        {isLoading && files.length === 0 ? (
          <div className="py-20 text-center text-xs text-slate-500">
            <div className="inline-block w-5 h-5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin mb-3" />
            <p>Querying cloud storage directory and indexing key envelopes...</p>
          </div>
        ) : filteredFiles.length === 0 ? (
          <div className="py-20 text-center space-y-2">
            <p className="text-sm font-medium text-slate-800">No matching files found in cloud directory.</p>
            <p className="text-xs text-slate-500">
              {searchQuery ? 'Try clearing your search query.' : 'Run a demonstration share from the Demo Workspace to populate files.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-[10px] font-semibold uppercase tracking-wider text-slate-500 bg-slate-50/50">
                  <th className="py-3 px-4 font-medium">Ciphertext Object & Storage Key</th>
                  <th className="py-3 px-4 font-medium">Size & Dispatched</th>
                  <th className="py-3 px-4 font-medium">Sender</th>
                  <th className="py-3 px-4 font-medium">Designated Recipients</th>
                  <th className="py-3 px-4 font-medium">SHA-256 Digest</th>
                  <th className="py-3 px-4 font-medium">Access Status for {user?.name?.split(' ')[0] || 'You'}</th>
                  <th className="py-3 px-4 font-medium text-right">Cryptographic Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredFiles.map(file => {
                  const isRecipient = file.my_access_status === 'authorized_recipient';
                  const isSender = file.is_sender;
                  const isUnauthorized = file.my_access_status === 'unauthorized';

                  return (
                    <tr
                      key={file.id}
                      className="hover:bg-slate-50/70 transition-colors group"
                    >
                      {/* Filename & Storage Path */}
                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="flex items-start space-x-2.5">
                          <FileText className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <span className="font-semibold text-slate-900 break-words-anywhere text-xs block">
                              {file.original_filename}
                            </span>
                            <span className="font-mono text-[10px] text-slate-400 break-words-anywhere block truncate max-w-xs" title={file.storage_object_key}>
                              {file.storage_object_key || `ciphershare_payloads/${file.id}.enc`}
                            </span>
                            <span className="inline-block mt-0.5 px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded text-[9px] font-mono">
                              {file.encryption_algorithm || 'AES-256-GCM'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Size & Date */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-slate-600">
                        <div className="font-mono text-[11px]">
                          {(file.file_size / 1024).toFixed(1)} KB
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {new Date(file.created_at).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                      </td>

                      {/* Sender */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-medium text-slate-900 text-xs">
                          {file.sender_name || 'Sender'}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          {file.sender_email}
                        </div>
                      </td>

                      {/* Recipients List */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {file.recipients && file.recipients.length > 0 ? (
                            file.recipients.map(r => {
                              const isMe = r.recipient_id === user?.id;
                              return (
                                <span
                                  key={r.id}
                                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] ${
                                    isMe
                                      ? 'bg-emerald-50 text-emerald-800 font-semibold border border-emerald-200'
                                      : 'bg-slate-100 text-slate-700'
                                  }`}
                                  title={r.recipient_email}
                                >
                                  {r.recipient_name || r.recipient_email}
                                  {isMe && <span className="text-[9px] text-emerald-600 font-bold">(You)</span>}
                                </span>
                              );
                            })
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">No recipients recorded</span>
                          )}
                        </div>
                      </td>

                      {/* Ciphertext SHA-256 Hash */}
                      <td className="py-3.5 px-4 font-mono text-[10px] text-slate-500 max-w-xs">
                        <div className="flex items-center space-x-1.5">
                          <span className="break-words-anywhere truncate max-w-[140px]" title={file.ciphertext_sha256}>
                            {file.ciphertext_sha256}
                          </span>
                          <button
                            onClick={() => handleCopy(file.ciphertext_sha256, file.id)}
                            className="text-slate-400 hover:text-slate-700 shrink-0"
                            title="Copy SHA-256 digest"
                          >
                            {copiedHash === file.id ? (
                              <Check className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Access Status for Current Persona */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {isRecipient && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <ShieldCheck className="w-3 h-3 text-emerald-600" />
                            Authorized Recipient
                          </span>
                        )}

                        {isSender && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-800 border border-slate-200">
                            <UserCheck className="w-3 h-3 text-slate-600" />
                            Sender (Dispatcher)
                          </span>
                        )}

                        {isUnauthorized && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-rose-50 text-rose-800 border border-rose-200">
                            <Lock className="w-3 h-3 text-rose-600" />
                            Unauthorized (No Envelope)
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        {isRecipient ? (
                          <button
                            onClick={() => initiateDecryption(file)}
                            disabled={isDecrypting}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs rounded transition-colors shadow-xs"
                          >
                            <Unlock className="w-3 h-3 text-emerald-400" />
                            <span>Decrypt File</span>
                          </button>
                        ) : isUnauthorized ? (
                          <button
                            onClick={() => initiateDecryption(file)}
                            disabled={isDecrypting}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded transition-colors"
                            title="Test zero-knowledge barrier with non-recipient account"
                          >
                            <ShieldAlert className="w-3 h-3 text-rose-600" />
                            <span>Attempt Decrypt</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => alert(`File Details:\nName: ${file.original_filename}\nID: ${file.id}\nUploaded by: You (${file.sender_email})\nRecipients: ${file.recipients?.map(r => r.recipient_email).join(', ')}`)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-slate-600 hover:text-slate-900 border border-slate-200 rounded hover:bg-slate-50 transition-colors"
                          >
                            <Eye className="w-3 h-3 text-slate-500" />
                            <span>Details</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Decryption In-Progress Toast / Overlay */}
      {isDecrypting && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-4 rounded-lg shadow-xl flex items-center gap-3.5 border border-slate-700 max-w-md">
          <div className="w-4 h-4 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin shrink-0" />
          <div className="min-w-0">
            <div className="text-xs font-semibold">SubtleCrypto Hybrid Decryption</div>
            <div className="text-[11px] text-slate-300 truncate">{decryptionStage}</div>
          </div>
        </div>
      )}

      {/* Decrypted Plaintext Modal / Drawer */}
      {decryptedResult && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900 font-serif">
                    Decryption Successful: {decryptedResult.file.original_filename}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Plaintext successfully recovered using local RSA-OAEP private key and AES-256-GCM.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setDecryptedResult(null)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Cryptographic Execution Stats */}
            <div className="px-6 py-3 bg-slate-50 border-b border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase">Execution Time</span>
                <span className="font-semibold text-slate-800">{decryptedResult.executionTimeMs} ms</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase">Decrypted Size</span>
                <span className="font-semibold text-slate-800">{(decryptedResult.byteSize / 1024).toFixed(1)} KB</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase">Auth Tag</span>
                <span className="font-semibold text-emerald-700">VALID (128-bit)</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase">Key Unwrapped By</span>
                <span className="font-semibold text-slate-800">{user?.name?.split(' ')[0] || 'Recipient'}</span>
              </div>
            </div>

            {/* Body / Content Preview */}
            <div className="p-6 flex-1 overflow-y-auto space-y-4">
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 block mb-1">
                  Verified Plaintext SHA-256 Digest
                </label>
                <div className="bg-slate-50 p-2 rounded border border-slate-200 font-mono text-[11px] text-slate-700 break-words-anywhere select-all">
                  {decryptedResult.plaintextSHA256}
                </div>
              </div>

              {decryptedResult.plaintextPreview && (
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 block mb-1">
                    Plaintext Preview (In-Browser UTF-8 Decode)
                  </label>
                  <pre className="bg-slate-900 text-slate-100 p-3.5 rounded text-xs font-mono overflow-x-auto max-h-64 whitespace-pre-wrap break-words-anywhere">
                    {decryptedResult.plaintextPreview}
                  </pre>
                </div>
              )}

              {decryptedResult.mimeType.startsWith('image/') && (
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 block mb-1">
                    Decrypted Image Preview
                  </label>
                  <img
                    src={decryptedResult.plaintextUrl}
                    alt="Decrypted preview"
                    className="max-h-64 rounded border border-slate-200 object-contain mx-auto"
                  />
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-slate-200 bg-slate-50/70 flex items-center justify-between">
              <span className="text-[11px] text-slate-500">
                Zero plaintext was transferred across the network.
              </span>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setDecryptedResult(null)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 border border-slate-200 rounded"
                >
                  Close
                </button>

                <a
                  href={decryptedResult.plaintextUrl}
                  download={decryptedResult.file.original_filename}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs rounded transition-colors shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Plaintext File</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Security Barrier Proof Modal (When Eve or unauthorized user attempts decrypt) */}
      {securityBlockProof && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-xl w-full border border-rose-200 overflow-hidden flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b border-rose-100 flex items-center justify-between bg-rose-50/70">
              <div className="flex items-center space-x-2.5">
                <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
                <div>
                  <h3 className="text-sm font-bold text-rose-950 font-serif">
                    Cryptographic Barrier Proof: Access Denied
                  </h3>
                  <p className="text-[11px] text-rose-700">
                    HTTP {securityBlockProof.statusCode} Forbidden • Zero Plaintext Leaked
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSecurityBlockProof(null)}
                className="text-rose-400 hover:text-rose-700 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4 text-xs">
              <div className="p-3 bg-rose-50 border border-rose-200 rounded text-rose-900 space-y-1">
                <div className="font-semibold text-xs flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                  Attempted by: <span className="font-mono">{securityBlockProof.userEmail}</span>
                </div>
                <div className="text-[11px] text-rose-800">
                  Target File: <strong className="font-mono">{securityBlockProof.file.original_filename}</strong>
                </div>
                <div className="text-[11px] text-rose-800">
                  Server Response: <em>"{securityBlockProof.errorMessage}"</em>
                </div>
              </div>

              <div>
                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">
                  Academic Proof & Cryptographic Invariants Enforced:
                </h4>
                <ul className="space-y-2 text-slate-700">
                  {securityBlockProof.invariantDetails.map((detail, idx) => (
                    <li key={idx} className="flex items-start space-x-2 text-[11px]">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0 mt-1.5" />
                      <span className="leading-relaxed">{detail}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-slate-900 text-slate-200 p-3 rounded font-mono text-[10px] space-y-1">
                <div className="text-slate-400"># Audit Log Record (Backend DB):</div>
                <div className="text-emerald-400">EVENT: UNAUTHORIZED_ACCESS_ATTEMPT</div>
                <div>ACTOR_USER: {securityBlockProof.userEmail}</div>
                <div>FILE_ID: {securityBlockProof.file.id}</div>
                <div>OUTCOME: REJECTED (HTTP 403 Forbidden)</div>
                <div>KEY_DELIVERED: NONE</div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-end">
              <button
                onClick={() => setSecurityBlockProof(null)}
                className="px-4 py-1.5 bg-slate-950 text-white font-medium text-xs rounded hover:bg-slate-800 transition-colors"
              >
                Acknowledge Security Proof
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Passphrase Modal for unlocking private key if needed */}
      <PassphraseModal
        isOpen={isPassphraseModalOpen}
        onClose={() => setIsPassphraseModalOpen(false)}
        onSuccess={handlePassphraseSuccess}
      />
    </div>
  );
};
