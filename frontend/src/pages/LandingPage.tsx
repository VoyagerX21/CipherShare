import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext';
import {
  Shield,
  Lock,
  Mail,
  User as UserIcon,
  ArrowRight
} from 'lucide-react';

export const LandingPage: React.FC = () => {
  const { login, register, user } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  React.useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register(name, email, password);
      }
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDemoLogin = async (demoEmail: string, demoPass: string) => {
    setError(null);
    setIsSubmitting(true);
    try {
      await login(demoEmail, demoPass);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Demo login failed. Make sure demo accounts are seeded.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col justify-between font-sans">
      {/* Top Header */}
      <header className="w-full border-b border-slate-200 px-8 sm:px-16 py-6 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Shield className="w-5 h-5 text-slate-900" />
          <div>
            <h1 className="text-base font-bold tracking-tight text-slate-900 uppercase">CipherShare</h1>
            <p className="text-[10px] uppercase font-mono tracking-wider text-slate-400">
              Secure Cloud File Sharing Using Hybrid Cryptography
            </p>
          </div>
        </div>

        <div className="hidden sm:flex items-center space-x-2 text-xs font-mono text-slate-500">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
          <span>Zero Server Plaintext Invariant</span>
        </div>
      </header>

      {/* Main Hero & Auth Section - Full width, classic editorial look */}
      <main className="w-full px-8 sm:px-16 py-12 lg:py-16 grid grid-cols-1 lg:grid-cols-12 gap-16 items-start flex-1">
        {/* Left Column: Architectural Explanations (Open, spacious, classic) */}
        <div className="lg:col-span-7 space-y-8">
          <div className="space-y-4">
            <span className="text-[10px] font-mono tracking-widest uppercase text-slate-400 block">
              Academic Course Prototype & Evaluation System
            </span>
            <h2 className="text-4xl sm:text-5xl font-normal text-slate-900 tracking-tight font-serif leading-tight">
              Client-Side Hybrid Cryptography. <br />
              <span className="italic text-slate-500">The cloud never possesses plaintext.</span>
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed max-w-2xl">
              CipherShare implements genuine <strong>AES-256-GCM</strong> authenticated symmetric payload encryption coupled with <strong>RSA-OAEP 3072-bit</strong> asymmetric recipient key wrapping. Files are encrypted client-side prior to cloud transmission, and user private keys reside exclusively in browser volatile memory or encrypted local IndexedDB storage.
            </p>
          </div>

          {/* Three Pillars - Open 3-column list (No card boxes) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 pt-6 border-t border-slate-200 text-xs">
            <div className="space-y-1">
              <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-semibold">
                AES-256-GCM
              </div>
              <h4 className="font-semibold text-slate-900 text-xs">Authenticated Encryption</h4>
              <p className="text-slate-500 text-[11px] leading-relaxed">
                128-bit authentication tag with fresh 96-bit random nonces per transmission.
              </p>
            </div>

            <div className="space-y-1">
              <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-semibold">
                RSA-OAEP 3072
              </div>
              <h4 className="font-semibold text-slate-900 text-xs">Key Envelopes</h4>
              <p className="text-slate-500 text-[11px] leading-relaxed">
                Per-recipient wrapped key envelopes. Private keys are never transmitted to server.
              </p>
            </div>

            <div className="space-y-1">
              <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-semibold">
                Canonical AAD
              </div>
              <h4 className="font-semibold text-slate-900 text-xs">Integrity Binding</h4>
              <p className="text-slate-500 text-[11px] leading-relaxed">
                Cryptographically binds fileId, senderId, and version into the payload tag.
              </p>
            </div>
          </div>

          {/* 1-Click Evaluation Personas - Open strip (No card boxes) */}
          <div className="pt-6 border-t border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
                Professor & Evaluation Login (1-Click)
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Immediate access to seeded demonstration accounts:
            </p>
            <div className="flex flex-wrap gap-4 text-xs pt-1">
              <button
                type="button"
                onClick={() => handleDemoLogin('sender@demo.local', 'DemoSender123!')}
                className="text-left group"
              >
                <div className="font-semibold text-slate-900 group-hover:underline">Alice (Sender) →</div>
                <div className="text-[11px] text-slate-400 font-mono">sender@demo.local</div>
              </button>

              <span className="text-slate-200">|</span>

              <button
                type="button"
                onClick={() => handleDemoLogin('recipient@demo.local', 'DemoRecipient123!')}
                className="text-left group"
              >
                <div className="font-semibold text-slate-900 group-hover:underline">Bob (Recipient) →</div>
                <div className="text-[11px] text-slate-400 font-mono">recipient@demo.local</div>
              </button>

              <span className="text-slate-200">|</span>

              <button
                type="button"
                onClick={() => handleDemoLogin('intruder@demo.local', 'DemoIntruder123!')}
                className="text-left group"
              >
                <div className="font-semibold text-slate-900 group-hover:underline">Eve (Intruder) →</div>
                <div className="text-[11px] text-slate-400 font-mono">intruder@demo.local</div>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Sign In / Register Form (Open editorial column, no card box) */}
        <div className="lg:col-span-5 space-y-6 lg:border-l lg:border-slate-200 lg:pl-16">
          {/* Mode Switcher */}
          <div className="flex border-b border-slate-200 pb-3 space-x-6 text-xs font-semibold">
            <button
              type="button"
              onClick={() => { setMode('login'); setError(null); }}
              className={`transition-colors ${
                mode === 'login'
                  ? 'text-slate-900 font-bold border-b-2 border-slate-900 pb-3 -mb-3.5'
                  : 'text-slate-400 hover:text-slate-700'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setMode('register'); setError(null); }}
              className={`transition-colors ${
                mode === 'register'
                  ? 'text-slate-900 font-bold border-b-2 border-slate-900 pb-3 -mb-3.5'
                  : 'text-slate-400 hover:text-slate-700'
              }`}
            >
              Create Account
            </button>
          </div>

          {error && (
            <div className="py-2.5 px-3 border-l-2 border-rose-600 bg-rose-50 text-rose-900 text-xs">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {mode === 'register' && (
              <div className="space-y-1">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Full Name
                </label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-slate-400 absolute left-0 top-3" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Alice Smith"
                    className="w-full border-b border-slate-300 py-2.5 pl-7 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-900 bg-transparent"
                    required
                  />
                </div>
              </div>
            )}

            <div className="space-y-1">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-0 top-3" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="user@demo.local"
                  className="w-full border-b border-slate-300 py-2.5 pl-7 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-900 bg-transparent"
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-0 top-3" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full border-b border-slate-300 py-2.5 pl-7 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-900 bg-transparent"
                  required
                />
              </div>
            </div>

            <div className="pt-4">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-semibold tracking-wide disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
              >
                {isSubmitting ? (
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span>{mode === 'login' ? 'Authenticate & Enter' : 'Create & Register Key'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-slate-200 px-8 sm:px-16 py-6 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
        <p>CipherShare — Academic Cryptography Course Demonstration System</p>
        <p className="text-[11px] text-slate-400 font-mono">
          Web Crypto API • Flask REST • Zero Server Plaintext • Argon2id
        </p>
      </footer>
    </div>
  );
};
