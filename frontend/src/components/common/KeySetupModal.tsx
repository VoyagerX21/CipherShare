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
import { ShieldAlert, KeyRound, CheckCircle2, Lock, AlertTriangle } from 'lucide-react';

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
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#111827] border border-[#1e293b] rounded-2xl max-w-lg w-full p-6 shadow-2xl">
        {step === 'prompt' ? (
          <div>
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-3 bg-sky-500/10 text-sky-400 rounded-xl border border-sky-500/20">
                <KeyRound className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-100">Setup Asymmetric Key Pair</h3>
                <p className="text-xs text-slate-400">RSA-OAEP 3072-bit Asymmetric Cryptography</p>
              </div>
            </div>

            <div className="bg-sky-950/20 border border-sky-500/20 rounded-xl p-3 mb-4 text-xs text-slate-300 space-y-1.5">
              <div className="font-semibold text-sky-300 flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-sky-400" />
                <span>Zero-Server Private Key Architecture</span>
              </div>
              <p>
                Your browser will generate a 3072-bit RSA key pair. The <strong>public key</strong> is published to the server so other users can encrypt files for you.
              </p>
              <p>
                The <strong>private key</strong> is encrypted locally in IndexedDB using AES-GCM and a key derived via PBKDF2 (600,000 iterations) from your unlock passphrase. It <strong>never leaves this device</strong>.
              </p>
            </div>

            {error && (
              <div className="bg-rose-950/30 border border-rose-500/30 rounded-xl p-3 mb-4 text-xs text-rose-300">
                {error}
              </div>
            )}

            <form onSubmit={handleGenerateAndRegister} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Private Key Unlock Passphrase
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="password"
                    value={passphrase}
                    onChange={(e) => setPassphrase(e.target.value)}
                    placeholder="Enter a strong passphrase"
                    className="w-full bg-[#0b0f19] border border-slate-700 rounded-xl py-2 pl-9 pr-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Confirm Passphrase
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="password"
                    value={confirmPassphrase}
                    onChange={(e) => setConfirmPassphrase(e.target.value)}
                    placeholder="Re-enter passphrase"
                    className="w-full bg-[#0b0f19] border border-slate-700 rounded-xl py-2 pl-9 pr-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500"
                    required
                  />
                </div>
              </div>

              <div className="bg-amber-950/20 border border-amber-500/20 rounded-xl p-3 text-[11px] text-amber-300/90 flex gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Important:</strong> If you clear your browser data or sign in from a different browser without importing this key backup, you cannot decrypt previously shared files.
                </span>
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isGenerating}
                  className="px-5 py-2 rounded-xl text-xs font-semibold bg-sky-500 hover:bg-sky-400 text-slate-950 disabled:opacity-50 flex items-center gap-2"
                >
                  {isGenerating ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                      <span>Generating 3072-bit Key...</span>
                    </>
                  ) : (
                    <span>Generate & Register Key Pair</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div className="text-center py-4 space-y-4">
            <div className="w-12 h-12 bg-emerald-500/20 text-emerald-400 rounded-2xl flex items-center justify-center mx-auto border border-emerald-500/30">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-100">Key Pair Established!</h3>
              <p className="text-xs text-slate-400 mt-1">
                Your RSA-OAEP 3072-bit public key has been registered and your encrypted private key is safely stored locally.
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-left">
              <span className="text-[11px] text-slate-400 uppercase tracking-wider block font-semibold">
                Public Key Fingerprint (SHA-256)
              </span>
              <span className="font-mono text-xs text-sky-400 break-all select-all block mt-1">
                {generatedFingerprint}
              </span>
            </div>

            <button
              onClick={() => {
                onClose();
                if (onSuccess) onSuccess();
              }}
              className="w-full py-2.5 rounded-xl text-xs font-semibold bg-sky-500 hover:bg-sky-400 text-slate-950"
            >
              Continue to Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
