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
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex flex-col justify-between">
      {/* Top Bar */}
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-gradient-to-br from-sky-500 to-indigo-600 rounded-xl text-white shadow-lg shadow-sky-500/20">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              CipherShare
              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20">
                WebCrypto Course Project
              </span>
            </h1>
            <p className="text-xs text-slate-400">Secure Cloud File Sharing Using Hybrid Cryptography</p>
          </div>
        </div>

        <div className="hidden sm:flex items-center space-x-2 text-xs font-mono text-slate-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Zero Server-Side Plaintext Exposure</span>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        {/* Left Hero & Explanations */}
        <div className="lg:col-span-7 space-y-6">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 text-xs">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Authenticated End-to-End Hybrid Encryption</span>
          </div>

          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
            Files encrypted in browser. <br />
            <span className="bg-gradient-to-r from-sky-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
              Cloud never sees plaintext.
            </span>
          </h2>

          <p className="text-sm sm:text-base text-slate-300 max-w-2xl leading-relaxed">
            CipherShare combines <strong>AES-256-GCM</strong> authenticated symmetric encryption for high-performance file payloads with <strong>RSA-OAEP 3072-bit</strong> asymmetric cryptography for secure multi-recipient key encapsulation.
          </p>

          {/* Cryptographic Architecture Highlights */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <div className="bg-[#111827] border border-slate-800 p-4 rounded-xl">
              <div className="p-2 bg-sky-500/10 text-sky-400 w-fit rounded-lg mb-2">
                <Cpu className="w-4 h-4" />
              </div>
              <h4 className="text-xs font-bold text-slate-200">AES-256-GCM</h4>
              <p className="text-[11px] text-slate-400 mt-1">
                Authenticated encryption with 128-bit integrity tag & 96-bit fresh nonces per file.
              </p>
            </div>

            <div className="bg-[#111827] border border-slate-800 p-4 rounded-xl">
              <div className="p-2 bg-indigo-500/10 text-indigo-400 w-fit rounded-lg mb-2">
                <KeyRound className="w-4 h-4" />
              </div>
              <h4 className="text-xs font-bold text-slate-200">RSA-OAEP 3072</h4>
              <p className="text-[11px] text-slate-400 mt-1">
                Zero-server private key storage; per-recipient key envelopes.
              </p>
            </div>

            <div className="bg-[#111827] border border-slate-800 p-4 rounded-xl">
              <div className="p-2 bg-emerald-500/10 text-emerald-400 w-fit rounded-lg mb-2">
                <Layers className="w-4 h-4" />
              </div>
              <h4 className="text-xs font-bold text-slate-200">Canonical AAD</h4>
              <p className="text-[11px] text-slate-400 mt-1">
                Binds file metadata into the cryptographic ciphertext payload.
              </p>
            </div>
          </div>

          {/* 1-Click Demo Persona Shortcuts */}
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-sky-400" />
                <span>Professor & Evaluation Demo Login (1-Click)</span>
              </span>
            </div>
            <p className="text-xs text-slate-400 mb-3">
              Instant login for presentation personas with pre-configured passwords:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleDemoLogin('sender@demo.local', 'DemoSender123!')}
                className="px-3 py-2 rounded-xl bg-sky-950/40 border border-sky-500/30 text-left hover:bg-sky-900/30 transition-colors"
              >
                <div className="text-xs font-bold text-sky-300">Alice (Sender)</div>
                <div className="text-[10px] text-slate-400 font-mono">sender@demo.local</div>
              </button>

              <button
                type="button"
                onClick={() => handleDemoLogin('recipient@demo.local', 'DemoRecipient123!')}
                className="px-3 py-2 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-left hover:bg-emerald-900/30 transition-colors"
              >
                <div className="text-xs font-bold text-emerald-300">Bob (Recipient)</div>
                <div className="text-[10px] text-slate-400 font-mono">recipient@demo.local</div>
              </button>

              <button
                type="button"
                onClick={() => handleDemoLogin('intruder@demo.local', 'DemoIntruder123!')}
                className="px-3 py-2 rounded-xl bg-rose-950/40 border border-rose-500/30 text-left hover:bg-rose-900/30 transition-colors"
              >
                <div className="text-xs font-bold text-rose-300">Eve (Intruder)</div>
                <div className="text-[10px] text-slate-400 font-mono">intruder@demo.local</div>
              </button>
            </div>
          </div>
        </div>

        {/* Right Authentication Form Card */}
        <div className="lg:col-span-5">
          <div className="bg-[#111827] border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl">
            {/* Tabs */}
            <div className="flex bg-[#0b0f19] p-1 rounded-xl mb-6 border border-slate-800">
              <button
                type="button"
                onClick={() => { setMode('login'); setError(null); }}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-colors ${
                  mode === 'login' ? 'bg-sky-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => { setMode('register'); setError(null); }}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-colors ${
                  mode === 'register' ? 'bg-sky-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Create Account
              </button>
            </div>

            {error && (
              <div className="bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs p-3 rounded-xl mb-4">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'register' && (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Full Name</label>
                  <div className="relative">
                    <UserIcon className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Alice Smith"
                      className="w-full bg-[#0b0f19] border border-slate-700 rounded-xl py-2 pl-9 pr-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500"
                      required
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="user@example.com"
                    className="w-full bg-[#0b0f19] border border-slate-700 rounded-xl py-2 pl-9 pr-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-[#0b0f19] border border-slate-700 rounded-xl py-2 pl-9 pr-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 rounded-xl text-xs font-bold bg-sky-500 hover:bg-sky-400 text-slate-950 disabled:opacity-50 flex items-center justify-center gap-2 mt-2 transition-colors"
              >
                {isSubmitting ? (
                  <span className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span>{mode === 'login' ? 'Sign In to Workspace' : 'Register & Setup Keys'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-slate-800/80 py-6 text-center text-xs text-slate-500">
        <p>CipherShare — Academic Cryptography Course Prototype</p>
        <p className="mt-1 text-[11px] text-slate-600">
          Client-side Web Crypto API • Flask Backend • Local / Supabase Object Storage • Argon2id
        </p>
      </div>
    </div>
  );
};
