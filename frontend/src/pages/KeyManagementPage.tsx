import React, { useState, useEffect } from 'react';
import { useAuth } from '../features/auth/AuthContext';
import { getLocalKeyBlob } from '../lib/crypto/keyStore';
import { KeySetupModal } from '../components/common/KeySetupModal';
import { PassphraseModal } from '../components/common/PassphraseModal';
import { LocalEncryptedKeyBlob } from '../types';
import {
  KeyRound,
  ShieldCheck,
  Lock,
  Unlock,
  AlertTriangle,
  Fingerprint
} from 'lucide-react';

export const KeyManagementPage: React.FC = () => {
  const { user, publicKey, hasLocalKey, isKeyUnlocked, lockKey } = useAuth();
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
    <div className="w-full space-y-8">
      {/* Title */}
      <div className="pb-6 border-b border-slate-200">
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Cryptographic Key Vault</h2>
        <p className="text-xs text-slate-500 mt-1">
          Inspect your asymmetric RSA-OAEP public key and local private key vault status.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
        {/* Left: Registered Public Key */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-sky-600" />
              <span>Public Key (Published to Server)</span>
            </h3>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
              RSA-OAEP-3072
            </span>
          </div>

          {publicKey ? (
            <div className="space-y-3 text-xs">
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1">
                <span className="text-slate-500 font-bold block text-[11px] flex items-center gap-1.5">
                  <Fingerprint className="w-3.5 h-3.5 text-sky-600" />
                  <span>Public Key Fingerprint (RFC 7638 SHA-256):</span>
                </span>
                <span className="font-mono text-slate-900 break-words-anywhere select-all block text-xs font-semibold mt-1">
                  {publicKey.fingerprint}
                </span>
                <span className="text-[10px] text-slate-500 block pt-1">
                  Other users verify this fingerprint before wrapping file keys for you.
                </span>
              </div>

              <div className="space-y-1.5 text-[11px] bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div className="flex justify-between">
                  <span className="text-slate-500">Key Version:</span>
                  <span className="font-mono text-slate-800 font-semibold">v{publicKey.key_version}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Algorithm:</span>
                  <span className="font-mono text-slate-800">{publicKey.algorithm} (SHA-256)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Registered:</span>
                  <span className="font-mono text-slate-800">{new Date(publicKey.created_at).toLocaleString()}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-slate-400 text-xs">
              <p>No public key currently registered for this account.</p>
              <button
                onClick={() => setIsKeySetupOpen(true)}
                className="mt-3 px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 text-white shadow-sm"
              >
                Generate Key Pair
              </button>
            </div>
          )}
        </div>

        {/* Right: Local Private Key Vault */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Lock className="w-4 h-4 text-indigo-600" />
              <span>Local Private Key Vault (IndexedDB)</span>
            </h3>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
              isKeyUnlocked
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : hasLocalKey
                ? 'bg-slate-100 text-slate-700 border border-slate-200'
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}>
              {isKeyUnlocked ? 'UNLOCKED IN RAM' : hasLocalKey ? 'ENCRYPTED AT REST' : 'MISSING'}
            </span>
          </div>

          {hasLocalKey ? (
            <div className="space-y-3 text-xs">
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1.5 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-500">Storage Location:</span>
                  <span className="font-mono text-slate-800">IndexedDB (Browser Local)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Vault Cipher:</span>
                  <span className="font-mono text-slate-800">AES-256-GCM (128-bit tag)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">KDF Derivation:</span>
                  <span className="font-mono text-slate-800">PBKDF2-SHA-256 ({localBlob?.iterations || 600000} iters)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Server Transmission:</span>
                  <span className="font-mono text-emerald-700 font-semibold">NEVER (Zero Transmission)</span>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                {isKeyUnlocked ? (
                  <button
                    onClick={lockKey}
                    className="flex-1 py-2 px-3 rounded-xl text-xs font-semibold bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Lock className="w-3.5 h-3.5 text-slate-500" />
                    <span>Lock Key in Memory</span>
                  </button>
                ) : (
                  <button
                    onClick={() => setIsPassphraseOpen(true)}
                    className="flex-1 py-2 px-3 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white flex items-center justify-center gap-1.5 shadow-sm transition-colors"
                  >
                    <Unlock className="w-3.5 h-3.5 text-sky-400" />
                    <span>Unlock Private Key</span>
                  </button>
                )}

                <button
                  onClick={() => setIsKeySetupOpen(true)}
                  className="px-4 py-2 rounded-xl text-xs font-medium bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 transition-colors"
                >
                  Regenerate
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-slate-400 text-xs">
              <p>No local private key backup found on this device.</p>
              <button
                onClick={() => setIsKeySetupOpen(true)}
                className="mt-3 px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 text-white shadow-sm"
              >
                Create Local Key Backup
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Warning Box */}
      <div className="p-6 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-600 space-y-2">
        <div className="font-bold text-slate-900 flex items-center gap-2 text-sm">
          <AlertTriangle className="w-4 h-4 text-amber-600" />
          <span>Security Boundary: Local Private Key Preservation</span>
        </div>
        <p className="leading-relaxed">
          In a genuine end-to-end zero-knowledge architecture, the server never stores or knows your private key. If you clear browser cache/storage or switch to another browser, you will not be able to decrypt files previously shared with this account unless you restore your local key material.
        </p>
      </div>

      <KeySetupModal isOpen={isKeySetupOpen} onClose={() => setIsKeySetupOpen(false)} />
      <PassphraseModal isOpen={isPassphraseOpen} onClose={() => setIsPassphraseOpen(false)} />
    </div>
  );
};
