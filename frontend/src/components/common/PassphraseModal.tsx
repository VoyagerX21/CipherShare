import React, { useState } from 'react';
import { useAuth } from '../../features/auth/AuthContext';
import { Lock, ShieldAlert, X } from 'lucide-react';

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
  description = 'Enter your master passphrase to decrypt your private key into browser memory.'
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
      setError('Incorrect passphrase or corrupted local key vault. Decryption failed.');
    } finally {
      setIsUnlocking(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/30 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-slate-300 max-w-md w-full p-6 sm:p-8 space-y-6 shadow-xl">
        <div className="flex items-start justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-base font-semibold text-slate-900 tracking-tight">{title}</h3>
            <p className="text-xs text-slate-500 mt-0.5">{description}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="py-2.5 px-3 border-l-2 border-rose-600 bg-rose-50 text-rose-900 text-xs flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span className="break-words-anywhere">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
              Master Passphrase
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-0 top-3" />
              <input
                type="password"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                placeholder="Enter passphrase"
                autoFocus
                className="w-full border-b border-slate-300 py-2.5 pl-7 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-900 bg-transparent"
                required
              />
            </div>
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
              disabled={isUnlocking}
              className="py-2 px-5 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-semibold tracking-wide disabled:opacity-50 transition-colors"
            >
              {isUnlocking ? 'Unlocking...' : 'Unlock Key'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
