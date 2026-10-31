import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext';
import {
  Shield,
  Lock,
  Mail,
  User as UserIcon,
  KeyRound,
  ArrowRight,
  ShieldCheck,
  Cpu,
  Layers,
  Sparkles
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
    <div className="min-h-screen bg-white text-slate-800 flex flex-col justify-between">
      {/* Top Header */}
      <header className="w-full border-b border-slate-200 px-6 sm:px-12 py-5 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center shadow-sm">
            <Shield className="w-5 h-5 text-sky-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-slate-900 leading-none">CipherShare</h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">Secure Cloud File Sharing Using Hybrid Cryptography</p>
          </div>
        </div>

        <div className="hidden sm:flex items-center space-x-2 text-xs text-slate-600 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="font-semibold text-slate-800">Zero Server Plaintext</span>
        </div>
      </header>

      {/* Main Hero & Auth Section - Full width, classic look */}
      <div className="w-full px-6 sm:px-12 py-12 lg:py-16 grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">
        {/* Left Column: Architectural Explanations */}
        <div className="lg:col-span-7 space-y-6">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-sky-50 border border-sky-200 text-sky-800 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Academic Course Prototype & Demonstration System</span>
          </div>

          <h2 className="text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight">
            Client-Side Hybrid Cryptography. <br />
            <span className="text-sky-700">The cloud never sees plaintext.</span>
          </h2>

          <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-2xl">
            CipherShare integrates <strong>AES-256-GCM</strong> authenticated symmetric encryption with <strong>RSA-OAEP 3072-bit</strong> asymmetric cryptography. File payloads are encrypted in the browser prior to transmission, and user private keys reside exclusively in local browser memory.
          </p>

          {/* Three Pillars (Clean, open presentation) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-100">
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="p-2 bg-white text-slate-900 w-fit rounded-lg mb-2 shadow-2xs border border-slate-200">
                <Cpu className="w-4 h-4 text-sky-600" />
              </div>
              <h4 className="text-xs font-bold text-slate-900">AES-256-GCM</h4>
              <p className="text-xs text-slate-500 mt-1">
                128-bit authentication tag with fresh 96-bit random nonces per transmission.
              </p>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="p-2 bg-white text-slate-900 w-fit rounded-lg mb-2 shadow-2xs border border-slate-200">
                <KeyRound className="w-4 h-4 text-indigo-600" />
              </div>
              <h4 className="text-xs font-bold text-slate-900">RSA-OAEP 3072</h4>
              <p className="text-xs text-slate-500 mt-1">
                Per-recipient wrapped key envelopes. Zero server private key storage.
              </p>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="p-2 bg-white text-slate-900 w-fit rounded-lg mb-2 shadow-2xs border border-slate-200">
                <Layers className="w-4 h-4 text-emerald-600" />
              </div>
              <h4 className="text-xs font-bold text-slate-900">Canonical AAD</h4>
              <p className="text-xs text-slate-500 mt-1">
                Binds fileId, senderId, and version into the cryptographic payload tag.
              </p>
            </div>
          </div>

          {/* 1-Click Evaluation Personas */}
          <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-sky-600" />
                <span>Professor & Evaluation Login (1-Click)</span>
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Immediate access to seeded evaluation personas:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleDemoLogin('sender@demo.local', 'DemoSender123!')}
                className="p-3 bg-white border border-slate-200 rounded-xl text-left hover:border-slate-400 hover:shadow-xs transition-all"
              >
                <div className="text-xs font-bold text-slate-900">Alice (Sender)</div>
                <div className="text-[11px] text-slate-500 font-mono truncate">sender@demo.local</div>
              </button>

              <button
                type="button"
                onClick={() => handleDemoLogin('recipient@demo.local', 'DemoRecipient123!')}
                className="p-3 bg-white border border-slate-200 rounded-xl text-left hover:border-slate-400 hover:shadow-xs transition-all"
              >
                <div className="text-xs font-bold text-slate-900">Bob (Recipient)</div>
                <div className="text-[11px] text-slate-500 font-mono truncate">recipient@demo.local</div>
              </button>

              <button
                type="button"
                onClick={() => handleDemoLogin('intruder@demo.local', 'DemoIntruder123!')}
                className="p-3 bg-white border border-slate-200 rounded-xl text-left hover:border-slate-400 hover:shadow-xs transition-all"
              >
                <div className="text-xs font-bold text-slate-900">Eve (Intruder)</div>
                <div className="text-[11px] text-slate-500 font-mono truncate">intruder@demo.local</div>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Sign In / Register Form */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
          {/* Tabs */}
          <div className="flex border-b border-slate-200 mb-6">
            <button
              type="button"
              onClick={() => { setMode('login'); setError(null); }}
              className={`pb-3 px-4 text-xs font-bold border-b-2 transition-colors ${
                mode === 'login'
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setMode('register'); setError(null); }}
              className={`pb-3 px-4 text-xs font-bold border-b-2 transition-colors ${
                mode === 'register'
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              Create Account
            </button>
          </div>

          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3.5 rounded-xl mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Full Name</label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Alice Smith"
                    className="w-full bg-white border border-slate-300 rounded-xl py-2 pl-9 pr-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800"
                    required
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="user@demo.local"
                  className="w-full bg-white border border-slate-300 rounded-xl py-2 pl-9 pr-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-white border border-slate-300 rounded-xl py-2 pl-9 pr-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm transition-colors mt-2"
            >
              {isSubmitting ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>{mode === 'login' ? 'Sign In' : 'Create & Register Key'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Footer */}
      <footer className="w-full border-t border-slate-200 px-6 sm:px-12 py-6 text-center text-xs text-slate-500">
        <p>CipherShare — Academic Cryptography Course Prototype</p>
        <p className="mt-1 text-[11px] text-slate-400">
          Client-side Web Crypto API • Python Flask • Local & Supabase Object Storage • Argon2id
        </p>
      </footer>
    </div>
  );
};
