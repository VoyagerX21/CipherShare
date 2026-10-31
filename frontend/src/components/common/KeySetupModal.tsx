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
import { CheckCircle2, Lock, AlertTriangle, X } from 'lucide-react';

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
    <div className="fixed inset-0 z-50 bg-slate-900/30 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-slate-300 max-w-lg w-full p-6 sm:p-8 space-y-6 shadow-xl">
        {step === 'prompt' ? (
          <div className="space-y-6">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-semibold text-slate-900 tracking-tight">
                  Establish RSA-OAEP 3072-bit Key Vault
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Private keys are encrypted in IndexedDB and never transmitted to the server.
                </p>
              </div>
              <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="border-l-2 border-slate-900 pl-4 py-1 text-xs text-slate-600 space-y-1">
              <span className="font-semibold text-slate-900 block">Zero-Knowledge Key Architecture</span>
              <p>
                The browser generates an asymmetric key pair. The <strong>public key</strong> is published for key envelopes. Your <strong>private key</strong> is encrypted locally using PBKDF2 (600,000 iterations) + AES-GCM and never leaves this machine.
              </p>
            </div>

            {error && (
              <div className="py-2.5 px-3 border-l-2 border-rose-600 bg-rose-50 text-rose-900 text-xs">
                {error}
              </div>
            )}

            <form onSubmit={handleGenerateAndRegister} className="space-y-4">
              <div className="space-y-1">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Private Key Passphrase
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-0 top-3" />
                  <input
                    type="password"
                    value={passphrase}
                    onChange={(e) => setPassphrase(e.target.value)}
                    placeholder="Enter master passphrase (min 8 chars)"
                    className="w-full border-b border-slate-300 py-2.5 pl-7 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-900 bg-transparent"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Confirm Passphrase
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-0 top-3" />
                  <input
                    type="password"
                    value={confirmPassphrase}
                    onChange={(e) => setConfirmPassphrase(e.target.value)}
                    placeholder="Confirm master passphrase"
                    className="w-full border-b border-slate-300 py-2.5 pl-7 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-900 bg-transparent"
                    required
                  />
                </div>
              </div>

              <div className="border-l-2 border-amber-600 pl-3 py-1 text-[11px] text-amber-900 flex items-start gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Important:</strong> Clearing browser cache or storage without key material will permanently prevent recovering dispatches.
                </span>
              </div>

              <div className="flex justify-end space-x-4 pt-3 border-t border-slate-100 text-xs">
                <button
                  type="button"
                  onClick={onClose}
                  className="font-medium text-slate-500 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isGenerating}
                  className="py-2 px-5 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-semibold tracking-wide disabled:opacity-50 transition-colors"
                >
                  {isGenerating ? 'Generating 3072-bit Key...' : 'Generate & Register Key'}
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center space-x-2 text-emerald-700">
              <CheckCircle2 className="w-5 h-5" />
              <h3 className="text-base font-semibold text-slate-900">Key Pair Established</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Your RSA-OAEP 3072-bit public key has been registered on the server and the encrypted private key is safely preserved in local IndexedDB.
            </p>

            <div className="space-y-1">
              <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 block">
                Public Key Fingerprint (RFC 7638 SHA-256)
              </span>
              <span className="font-mono text-xs text-slate-900 break-words-anywhere select-all block py-2 border-b border-slate-100">
                {generatedFingerprint}
              </span>
            </div>

            <div className="pt-2">
              <button
                onClick={() => {
                  onClose();
                  if (onSuccess) onSuccess();
                }}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-semibold tracking-wide transition-colors"
              >
                Continue to Workspace
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
