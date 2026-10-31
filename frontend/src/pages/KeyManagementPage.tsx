import React, { useState, useEffect } from 'react';
import { useAuth } from '../features/auth/AuthContext';
import { getLocalKeyBlob } from '../lib/crypto/keyStore';
import { KeySetupModal } from '../components/common/KeySetupModal';
import { PassphraseModal } from '../components/common/PassphraseModal';
import { LocalEncryptedKeyBlob } from '../types';
import {
  ShieldCheck,
  Lock,
  Unlock,
  AlertTriangle,
  Fingerprint,
  RefreshCw
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
    <div className="w-full space-y-12">
      {/* Editorial Header */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <span className="text-[10px] font-mono tracking-widest uppercase text-slate-400">
            Cryptographic Vault
          </span>
          <h2 className="text-3xl font-normal text-slate-900 tracking-tight font-serif mt-1">
            Asymmetric Keys & Vault Status
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Inspect your RSA-OAEP public key published to the cloud and your private key encrypted in local browser storage.
          </p>
        </div>

        <div className="flex items-center space-x-3 shrink-0">
          <button
            onClick={() => setIsKeySetupOpen(true)}
            className="text-xs font-semibold text-slate-900 hover:text-slate-600 flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Generate New Key Pair</span>
          </button>
        </div>
      </div>

      {/* Main Two-Column Editorial Layout (No card boxes) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
        {/* Left Column: Public Key (Published) */}
        <div className="lg:col-span-6 space-y-6">
          <div className="pb-3 border-b border-slate-200 flex items-baseline justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-slate-900" />
              <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">
                Published Public Key
              </h3>
            </div>
            <span className="text-[11px] font-mono text-slate-500">
              RSA-OAEP 3072-bit
            </span>
          </div>

          {publicKey ? (
            <div className="space-y-6 text-xs">
              <div className="space-y-1.5">
                <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Fingerprint className="w-3.5 h-3.5 text-slate-400" />
                  <span>RFC 7638 SHA-256 Fingerprint:</span>
                </span>
                <div className="font-mono text-slate-900 break-words-anywhere select-all py-2 border-b border-slate-100 text-xs font-semibold">
                  {publicKey.fingerprint}
                </div>
                <p className="text-[11px] text-slate-400 pt-1">
                  Other users verify this hash thumbprint before wrapping AES content encryption keys for your account.
                </p>
              </div>

              <dl className="divide-y divide-slate-100 text-xs">
                <div className="py-2.5 flex justify-between">
                  <dt className="text-slate-500">Key Version</dt>
                  <dd className="font-mono text-slate-900 font-medium">v{publicKey.key_version}</dd>
                </div>
                <div className="py-2.5 flex justify-between">
                  <dt className="text-slate-500">Algorithm Specification</dt>
                  <dd className="font-mono text-slate-900">{publicKey.algorithm} (SHA-256)</dd>
                </div>
                <div className="py-2.5 flex justify-between">
                  <dt className="text-slate-500">Modulus Length</dt>
                  <dd className="font-mono text-slate-900">3072 bits</dd>
                </div>
                <div className="py-2.5 flex justify-between">
                  <dt className="text-slate-500">Registered On Server</dt>
                  <dd className="font-mono text-slate-900">{new Date(publicKey.created_at).toLocaleString()}</dd>
                </div>
                <div className="py-2.5 flex justify-between">
                  <dt className="text-slate-500">Cloud Storage</dt>
                  <dd className="font-mono text-slate-900">Public Key Only (Zero Plaintext)</dd>
                </div>
              </dl>
            </div>
          ) : (
            <div className="py-8 text-slate-400 text-xs space-y-2">
              <p>No asymmetric public key currently published for this account.</p>
              <button
                onClick={() => setIsKeySetupOpen(true)}
                className="py-2 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-semibold tracking-wide transition-colors"
              >
                Generate Key Pair Now
              </button>
            </div>
          )}
        </div>

        {/* Right Column: Local Private Key Vault */}
        <div className="lg:col-span-6 space-y-6">
          <div className="pb-3 border-b border-slate-200 flex items-baseline justify-between">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-slate-900" />
              <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">
                Local Private Key Vault
              </h3>
            </div>
            <span className={`text-[11px] font-mono font-semibold ${
              isKeyUnlocked
                ? 'text-emerald-700'
                : hasLocalKey
                ? 'text-slate-600'
                : 'text-rose-700'
            }`}>
              {isKeyUnlocked ? '● UNLOCKED IN RAM' : hasLocalKey ? '○ ENCRYPTED AT REST' : '✕ MISSING'}
            </span>
          </div>

          {hasLocalKey ? (
            <div className="space-y-6 text-xs">
              <dl className="divide-y divide-slate-100 text-xs">
                <div className="py-2.5 flex justify-between">
                  <dt className="text-slate-500">Storage Location</dt>
                  <dd className="font-mono text-slate-900">Browser IndexedDB (Volatile/Local)</dd>
                </div>
                <div className="py-2.5 flex justify-between">
                  <dt className="text-slate-500">Vault Cipher</dt>
                  <dd className="font-mono text-slate-900">AES-256-GCM (128-bit authentication tag)</dd>
                </div>
                <div className="py-2.5 flex justify-between">
                  <dt className="text-slate-500">Key Derivation (KDF)</dt>
                  <dd className="font-mono text-slate-900">PBKDF2-SHA-256 ({localBlob?.iterations || 600000} iterations)</dd>
                </div>
                <div className="py-2.5 flex justify-between">
                  <dt className="text-slate-500">Server Transmission</dt>
                  <dd className="font-mono text-emerald-700 font-semibold">NEVER (Zero Transmission Invariant)</dd>
                </div>
                <div className="py-2.5 flex justify-between">
                  <dt className="text-slate-500">Vault Created</dt>
                  <dd className="font-mono text-slate-900">{localBlob?.createdDate ? new Date(localBlob.createdDate).toLocaleString() : 'Active'}</dd>
                </div>
              </dl>

              {/* Action Buttons */}
              <div className="flex items-center gap-4 pt-2">
                {isKeyUnlocked ? (
                  <button
                    onClick={lockKey}
                    className="py-2 px-4 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <Lock className="w-3.5 h-3.5 text-slate-500" />
                    <span>Lock Key in RAM</span>
                  </button>
                ) : (
                  <button
                    onClick={() => setIsPassphraseOpen(true)}
                    className="py-2 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <Unlock className="w-3.5 h-3.5" />
                    <span>Unlock with Passphrase</span>
                  </button>
                )}

                <button
                  onClick={() => setIsKeySetupOpen(true)}
                  className="text-xs font-semibold text-slate-600 hover:text-slate-900 underline"
                >
                  Regenerate Vault
                </button>
              </div>
            </div>
          ) : (
            <div className="py-8 text-slate-400 text-xs space-y-2">
              <p>No local private key backup found on this browser.</p>
              <button
                onClick={() => setIsKeySetupOpen(true)}
                className="py-2 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-semibold tracking-wide transition-colors"
              >
                Create Local Key Vault
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Security Boundary Notice (Editorial border-l callout, no rounded card box) */}
      <div className="border-l-2 border-slate-900 pl-6 py-2 space-y-1.5 text-xs text-slate-600 max-w-4xl">
        <div className="font-semibold text-slate-900 flex items-center gap-2 text-sm">
          <AlertTriangle className="w-4 h-4 text-slate-800" />
          <span>Security Invariant: Local Private Key Preservation</span>
        </div>
        <p className="leading-relaxed">
          In a genuine end-to-end zero-knowledge architecture, the cloud server never receives or stores your private key. If you clear browser IndexedDB storage or open an incognito session, you will not be able to decrypt files previously shared with this account unless you restore your local key material.
        </p>
      </div>

      <KeySetupModal isOpen={isKeySetupOpen} onClose={() => setIsKeySetupOpen(false)} />
      <PassphraseModal isOpen={isPassphraseOpen} onClose={() => setIsPassphraseOpen(false)} />
    </div>
  );
};
