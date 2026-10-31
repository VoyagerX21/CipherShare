import React, { useState } from 'react';
import { useAuth } from '../../features/auth/AuthContext';
import { Lock, KeyRound, ShieldAlert } from 'lucide-react';

interface PassphraseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  title?: string;
  description?: string;
}

export const PassphraseModal: React.FC<PassphraseModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  title = 'Unlock Private Key',
  description = 'Enter your master key passphrase to unlock your private key in memory for this operation.'
}) => {
  const { unlockKey } = useAuth();
  const [passphrase, setPassphrase] = useState('');
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsUnlocking(true);
    try {
      await unlockKey(passphrase);
      setPassphrase('');
      onClose();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error('Unlock error', err);
      setError('Incorrect passphrase or corrupted local key data. Decryption failed.');
    } finally {
      setIsUnlocking(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#111827] border border-[#1e293b] rounded-2xl max-w-md w-full p-6 shadow-2xl">
        <div className="flex items-center space-x-3 mb-4">
          <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-100">{title}</h3>
            <p className="text-xs text-slate-400">{description}</p>
          </div>
        </div>

        {error && (
          <div className="bg-rose-950/30 border border-rose-500/30 rounded-xl p-3 mb-4 text-xs text-rose-300 flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Key Passphrase
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="password"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                placeholder="Enter key passphrase"
                autoFocus
                className="w-full bg-[#0b0f19] border border-slate-700 rounded-xl py-2 pl-9 pr-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500"
                required
              />
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isUnlocking}
              className="px-5 py-2 rounded-xl text-xs font-semibold bg-sky-500 hover:bg-sky-400 text-slate-950 disabled:opacity-50 flex items-center gap-2"
            >
              {isUnlocking ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  <span>Unlocking...</span>
                </>
              ) : (
                <span>Unlock Key</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
