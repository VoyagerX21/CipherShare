import React, { useState } from 'react';
import { useAuth } from '../../features/auth/AuthContext';
import {
  generateUserKeyPair,
  exportPublicKeyJWK,
  computeJWKFingerprint,
  encryptPrivateKeyWithPassphrase
} from '../../lib/crypto/webcrypto';
import { saveLocalKeyBlob } from '../../lib/crypto/keyStore';
import { api } from '../../lib/api/client';
import { ShieldAlert, KeyRound, CheckCircle2, Lock, AlertTriangle, X } from 'lucide-react';

interface KeySetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const KeySetupModal: React.FC<KeySetupModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { user, refreshKeyStatus } = useAuth();
  const [passphrase, setPassphrase] = useState('');
  const [confirmPassphrase, setConfirmPassphrase] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'prompt' | 'done'>('prompt');
  const [generatedFingerprint, setGeneratedFingerprint] = useState('');

  if (!isOpen || !user) return null;

  const handleGenerateAndRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (passphrase.length < 8) {
      setError('Passphrase must be at least 8 characters long.');
      return;
    }
    if (passphrase !== confirmPassphrase) {
      setError('Passphrases do not match.');
      return;
    }

    setIsGenerating(true);
    try {
      // 1. Generate RSA-OAEP 3072-bit key pair in browser
      const keyPair = await generateUserKeyPair();

      // 2. Export public key as JWK and compute fingerprint
      const publicJwkJson = await exportPublicKeyJWK(keyPair.publicKey);
      const jwkObj = JSON.parse(publicJwkJson);
      const fingerprint = await computeJWKFingerprint(jwkObj);
      setGeneratedFingerprint(fingerprint);

      // 3. Encrypt private key with user passphrase using PBKDF2 + AES-GCM
      const encryptedBlob = await encryptPrivateKeyWithPassphrase(keyPair.privateKey, passphrase);

      // 4. Save encrypted blob to local IndexedDB (NEVER send to server)
      await saveLocalKeyBlob({
        userId: user.id,
        encryptedPkcs8Base64: encryptedBlob.encryptedBase64,
        saltBase64: encryptedBlob.saltBase64,
        ivBase64: encryptedBlob.ivBase64,
        iterations: encryptedBlob.iterations,
        fingerprint,
        createdDate: new Date().toISOString()
      });

      // 5. Register ONLY public key with backend
      await api.keys.register({
        public_key_jwk: publicJwkJson,
        key_type: 'RSA-OAEP-3072',
        algorithm: 'RSA-OAEP',
        fingerprint
      });

      await refreshKeyStatus();
      setStep('done');
    } catch (err: any) {
      console.error('Key generation failure', err);
      setError(err.message || 'Failed to generate and register cryptographic key pair.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 sm:p-8 shadow-xl">
        {step === 'prompt' ? (
          <div>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-slate-100 text-slate-800 rounded-xl border border-slate-200">
                  <KeyRound className="w-5 h-5 text-sky-600" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Setup Asymmetric Key Pair</h3>
                  <p className="text-xs text-slate-500">RSA-OAEP 3072-bit Cryptographic Vault</p>
                </div>
              </div>
              <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 mb-5 text-xs text-slate-600 space-y-1.5">
              <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-sky-600" />
                <span>Zero-Knowledge Key Architecture</span>
              </div>
              <p>
                Your browser generates a 3072-bit RSA pair. The <strong>public key</strong> is published so other users can encrypt content for you.
              </p>
              <p>
                Your <strong>private key</strong> is encrypted locally in IndexedDB using PBKDF2 (600,000 iterations) + AES-GCM and <strong>never leaves your device</strong>.
              </p>
            </div>

            {error && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3 rounded-xl mb-4">
                {error}
              </div>
            )}

            <form onSubmit={handleGenerateAndRegister} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Private Key Unlock Passphrase
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="password"
                    value={passphrase}
                    onChange={(e) => setPassphrase(e.target.value)}
                    placeholder="Enter master passphrase"
                    className="w-full bg-white border border-slate-300 rounded-xl py-2 pl-9 pr-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Confirm Passphrase
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="password"
                    value={confirmPassphrase}
                    onChange={(e) => setConfirmPassphrase(e.target.value)}
                    placeholder="Confirm master passphrase"
                    className="w-full bg-white border border-slate-300 rounded-xl py-2 pl-9 pr-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800"
                    required
                  />
                </div>
              </div>

              <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3 text-[11px] text-amber-800 flex gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Important:</strong> If you clear browser data without an exported key backup, previously shared files cannot be decrypted.
                </span>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isGenerating}
                  className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white disabled:opacity-50 flex items-center gap-2 shadow-sm"
                >
                  {isGenerating ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Generating 3072-bit Key...</span>
                    </>
                  ) : (
                    <span>Generate & Register Key</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div className="text-center py-4 space-y-4">
            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto border border-emerald-200">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Key Pair Established!</h3>
              <p className="text-xs text-slate-500 mt-1">
                Your RSA-OAEP 3072-bit public key has been registered and the encrypted private key is safely stored in IndexedDB.
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-left">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-bold">
                Public Key Fingerprint (SHA-256)
              </span>
              <span className="font-mono text-xs text-slate-800 break-words-anywhere select-all block mt-1">
                {generatedFingerprint}
              </span>
            </div>

            <button
              onClick={() => {
                onClose();
                if (onSuccess) onSuccess();
              }}
              className="w-full py-2.5 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white shadow-sm"
            >
              Continue to Workspace
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
