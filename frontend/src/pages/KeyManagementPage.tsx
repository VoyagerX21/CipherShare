import React, { useState, useEffect } from 'react';
import { useAuth } from '../features/auth/AuthContext';
import { getLocalKeyBlob, deleteLocalKeyBlob } from '../lib/crypto/keyStore';
import { KeySetupModal } from '../components/common/KeySetupModal';
import { PassphraseModal } from '../components/common/PassphraseModal';
import { LocalEncryptedKeyBlob } from '../types';
import {
  KeyRound,
  ShieldAlert,
  ShieldCheck,
  Lock,
  Unlock,
  AlertTriangle,
  RotateCcw,
  Fingerprint,
  Cpu,
  Layers
} from 'lucide-react';

export const KeyManagementPage: React.FC = () => {
  const { user, publicKey, hasLocalKey, isKeyUnlocked, lockKey, refreshKeyStatus } = useAuth();
  const [localBlob, setLocalBlob] = useState<LocalEncryptedKeyBlob | null>(null);
  const [isKeySetupOpen, setIsKeySetupOpen] = useState(false);
  const [isPassphraseOpen, setIsPassphraseOpen] = useState(false);

  useEffect(() => {
    async function loadBlob() {
      if (user) {
        const b = await getLocalKeyBlob(user.id);
        setLocalBlob(b);
      }
    }
    loadBlob();
  }, [user, hasLocalKey]);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
          <KeyRound className="w-8 h-8 text-sky-400" />
          <span>Cryptographic Key Management</span>
        </h2>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Inspect your asymmetric RSA-OAEP public key and local private key vault status.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left: Registered Public Key */}
        <div className="bg-[#111827] border border-slate-800 rounded-3xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-sky-400" />
              <span>Public Key (Published to Server)</span>
            </h3>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-500/10 text-sky-400 border border-sky-500/20">
              RSA-OAEP-3072
            </span>
          </div>

          {publicKey ? (
            <div className="space-y-3 text-xs">
              <div className="bg-slate-900 p-3 rounded-2xl border border-slate-800 space-y-1">
                <span className="text-slate-400 font-semibold block text-[11px] flex items-center gap-1.5">
                  <Fingerprint className="w-3.5 h-3.5 text-sky-400" />
                  <span>Public Key Fingerprint (RFC 7638 SHA-256):</span>
                </span>
                <span className="font-mono text-sky-300 break-all select-all block text-xs">
                  {publicKey.fingerprint}
                </span>
                <span className="text-[10px] text-slate-500 block pt-1">
                  Other users verify this fingerprint before wrapping file keys for you.
                </span>
              </div>

              <div className="space-y-1.5 text-[11px] bg-slate-900/60 p-3 rounded-xl border border-slate-800/60">
                <div className="flex justify-between">
                  <span className="text-slate-400">Key Version:</span>
                  <span className="font-mono text-slate-200">v{publicKey.key_version}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Algorithm:</span>
                  <span className="font-mono text-slate-200">{publicKey.algorithm} (SHA-256)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Registered:</span>
                  <span className="font-mono text-slate-200">{new Date(publicKey.created_at).toLocaleString()}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-6 text-slate-500 text-xs">
              <p>No public key currently registered for this account.</p>
              <button
                onClick={() => setIsKeySetupOpen(true)}
                className="mt-3 px-4 py-2 rounded-xl text-xs font-bold bg-sky-500 text-slate-950"
              >
                Generate Key Pair
              </button>
            </div>
          )}
        </div>

        {/* Right: Local Private Key Vault */}
        <div className="bg-[#111827] border border-slate-800 rounded-3xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
              <Lock className="w-4 h-4 text-indigo-400" />
              <span>Local Private Key Vault (IndexedDB)</span>
            </h3>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
              isKeyUnlocked
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : hasLocalKey
                ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
            }`}>
              {isKeyUnlocked ? 'UNLOCKED IN RAM' : hasLocalKey ? 'ENCRYPTED AT REST' : 'MISSING'}
            </span>
          </div>

          {hasLocalKey ? (
            <div className="space-y-3 text-xs">
              <div className="bg-slate-900 p-3 rounded-2xl border border-slate-800 space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-400">Storage Location:</span>
                  <span className="font-mono text-slate-200">IndexedDB (Browser Local)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Vault Cipher:</span>
                  <span className="font-mono text-slate-200">AES-256-GCM (128-bit tag)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">KDF Derivation:</span>
                  <span className="font-mono text-slate-200">PBKDF2-SHA-256 ({localBlob?.iterations || 600000} iters)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Server Transmission:</span>
                  <span className="font-mono text-emerald-400">NEVER (Zero Transmission)</span>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                {isKeyUnlocked ? (
                  <button
                    onClick={lockKey}
                    className="flex-1 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center justify-center gap-1.5"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>Lock Key in Memory</span>
                  </button>
                ) : (
                  <button
                    onClick={() => setIsPassphraseOpen(true)}
                    className="flex-1 py-2 rounded-xl text-xs font-bold bg-indigo-500 hover:bg-indigo-400 text-white flex items-center justify-center gap-1.5"
                  >
                    <Unlock className="w-3.5 h-3.5" />
                    <span>Unlock Private Key</span>
                  </button>
                )}

                <button
                  onClick={() => setIsKeySetupOpen(true)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                >
                  Regenerate
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-6 text-slate-500 text-xs">
              <p>No local private key backup found on this device.</p>
              <button
                onClick={() => setIsKeySetupOpen(true)}
                className="mt-3 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-500 text-white"
              >
                Create Local Key Backup
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Warning Box */}
      <div className="bg-amber-950/20 border border-amber-500/20 rounded-3xl p-6 text-xs text-amber-300/90 space-y-2">
        <div className="font-bold text-sm text-amber-200 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-400" />
          <span>Crucial Security Boundary: Local Private Key Preservation</span>
        </div>
        <p>
          In a genuine end-to-end zero-knowledge architecture, the server never stores or knows your private key. If you clear browser cache/storage or switch to another browser, you will not be able to decrypt files previously shared with this account unless you restore your local key material.
        </p>
      </div>

      <KeySetupModal isOpen={isKeySetupOpen} onClose={() => setIsKeySetupOpen(false)} />
      <PassphraseModal isOpen={isPassphraseOpen} onClose={() => setIsPassphraseOpen(false)} />
    </div>
  );
};
