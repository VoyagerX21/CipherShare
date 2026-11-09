import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../features/auth/AuthContext';
import { api } from '../../lib/api/client';
import { KeySetupModal } from '../common/KeySetupModal';
import { PassphraseModal } from '../common/PassphraseModal';
import {
  Shield,
  Send,
  FileCheck,
  Clock,
  Sparkles,
  KeyRound,
  Users,
  LogOut,
  Lock,
  Unlock,
  AlertTriangle,
  Menu,
  X
} from 'lucide-react';

interface AppLayoutProps {
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const { user, publicKey, hasLocalKey, isKeyUnlocked, lockKey, logout, login } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [isKeySetupOpen, setIsKeySetupOpen] = useState(false);
  const [isPassphraseOpen, setIsPassphraseOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  if (!user) {
    return <>{children}</>;
  }

  const navLinks = [
    { to: '/demo', label: 'Demonstration', icon: Sparkles },
    { to: '/share', label: 'Share File', icon: Send },
    { to: '/sent', label: 'Sent Dispatches', icon: FileCheck },
    { to: '/security', label: 'Security & Audit', icon: Clock },
    { to: '/keys', label: 'Key Vault', icon: KeyRound },
    { to: '/dashboard', label: 'System Overview', icon: Shield },
  ];

  const handleQuickSwitch = async (email: string, pass: string) => {
    try {
      await login(email, pass);
      setIsMobileMenuOpen(false);
      navigate('/dashboard');
    } catch (err) {
      console.error('Quick switch failed', err);
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-white text-slate-900 font-sans">
      {/* Mobile Top Header */}
      <header className="md:hidden flex items-center justify-between px-5 py-3.5 bg-white border-b border-slate-200 sticky top-0 z-30">
        <Link to="/dashboard" className="flex items-center space-x-2">
          <Shield className="w-5 h-5 text-slate-900" />
          <span className="font-semibold text-slate-900 tracking-tight text-sm">CipherShare</span>
        </Link>

        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-1.5 text-slate-600 hover:text-slate-900"
        >
          {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </header>

      {/* Sidebar - Classic, Minimalist, Non-Boxy */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-slate-200 flex flex-col justify-between transition-transform duration-200 ease-in-out md:static md:translate-x-0 ${
          isMobileMenuOpen ? 'translate-x-0 shadow-xl' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full overflow-y-auto">
          {/* Brand Header */}
          <div className="px-6 py-6 border-b border-slate-100 flex items-center justify-between">
            <Link to="/dashboard" className="space-y-0.5">
              <div className="flex items-center space-x-2">
                <Shield className="w-4 h-4 text-slate-900" />
                <span className="font-bold text-sm tracking-tight text-slate-900 uppercase">CipherShare</span>
              </div>
              <p className="text-[10px] tracking-wider uppercase text-slate-400 font-medium pl-6">
                Hybrid Cryptography
              </p>
            </Link>

            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="md:hidden text-slate-400 hover:text-slate-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Nav Items */}
          <div className="px-4 py-5 flex-1 space-y-6">
            <div className="space-y-0.5">
              <div className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Workspace
              </div>
              {navLinks.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.to;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center justify-between px-2.5 py-2 rounded-md text-xs transition-colors ${
                      isActive
                        ? 'text-slate-900 font-semibold bg-slate-100/80'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5 min-w-0">
                      <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-slate-900' : 'text-slate-400'}`} />
                      <span className="truncate">{item.label}</span>
                    </div>
                  </Link>
                );
              })}
            </div>

            {/* Key Status (Clean minimal lines, no heavy box) */}
            <div className="pt-2 border-t border-slate-100 px-2 space-y-2">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Key Vault
              </div>
              <div className="text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 text-[11px]">Private Key</span>
                  <span className="flex items-center gap-1.5 text-[11px] font-medium">
                    {isKeyUnlocked ? (
                      <span className="text-emerald-700 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                        Unlocked in RAM
                      </span>
                    ) : hasLocalKey ? (
                      <span className="text-slate-700 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                        Locked (IndexedDB)
                      </span>
                    ) : (
                      <span className="text-amber-700 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        Missing Key
                      </span>
                    )}
                  </span>
                </div>

                <div className="text-[11px] text-slate-400 font-mono break-words-anywhere">
                  {publicKey ? (
                    <span title={publicKey.fingerprint}>
                      FP: {publicKey.fingerprint.substring(0, 16)}...
                    </span>
                  ) : (
                    <span className="text-slate-400 font-sans">No public key</span>
                  )}
                </div>

                <div className="pt-1">
                  {!publicKey || !hasLocalKey ? (
                    <button
                      onClick={() => setIsKeySetupOpen(true)}
                      className="text-xs font-semibold text-slate-900 hover:underline flex items-center gap-1"
                    >
                      <span>Setup Key Pair →</span>
                    </button>
                  ) : isKeyUnlocked ? (
                    <button
                      onClick={lockKey}
                      className="text-[11px] text-slate-500 hover:text-slate-900 underline"
                    >
                      Lock in RAM
                    </button>
                  ) : (
                    <button
                      onClick={() => setIsPassphraseOpen(true)}
                      className="text-[11px] text-slate-900 hover:underline font-medium"
                    >
                      Unlock with Passphrase →
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Presentation Personas (Clean minimal list, no heavy box) */}
            <div className="pt-2 border-t border-slate-100 px-2 space-y-1.5">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Presentation Personas
              </div>
              <div className="space-y-0.5 text-xs">
                <button
                  onClick={() => handleQuickSwitch('sender@demo.local', 'DemoSender123!')}
                  className={`w-full text-left py-1 flex items-center justify-between text-xs transition-colors ${
                    user.email === 'sender@demo.local'
                      ? 'text-slate-900 font-semibold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <span>Alice (Sender)</span>
                  {user.email === 'sender@demo.local' && <span className="text-[10px] text-slate-400 font-mono">active</span>}
                </button>
                <button
                  onClick={() => handleQuickSwitch('recipient@demo.local', 'DemoRecipient123!')}
                  className={`w-full text-left py-1 flex items-center justify-between text-xs transition-colors ${
                    user.email === 'recipient@demo.local'
                      ? 'text-slate-900 font-semibold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <span>Bob (Recipient)</span>
                  {user.email === 'recipient@demo.local' && <span className="text-[10px] text-slate-400 font-mono">active</span>}
                </button>
                <button
                  onClick={() => handleQuickSwitch('intruder@demo.local', 'DemoIntruder123!')}
                  className={`w-full text-left py-1 flex items-center justify-between text-xs transition-colors ${
                    user.email === 'intruder@demo.local'
                      ? 'text-slate-900 font-semibold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <span>Eve (Intruder)</span>
                  {user.email === 'intruder@demo.local' && <span className="text-[10px] text-slate-400 font-mono">active</span>}
                </button>
              </div>
            </div>
          </div>

          {/* User Account Footer (Clean line divider) */}
          <div className="p-4 border-t border-slate-100 flex items-center justify-between gap-2">
            <Link
              to="/keys"
              className="min-w-0 hover:opacity-75 transition-opacity"
              title="View account keys"
            >
              <div className="text-xs font-semibold text-slate-900 truncate">{user.name}</div>
              <div className="text-[11px] text-slate-400 truncate max-w-[150px]" title={user.email}>
                {user.email}
              </div>
            </Link>

            <button
              onClick={logout}
              className="p-1.5 text-slate-400 hover:text-slate-800 rounded transition-colors shrink-0"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area - Full Page Width, Pure Canvas */}
      <div className="flex-1 min-w-0 flex flex-col min-h-screen bg-white">
        {/* Top Hairline Header */}
        <header className="hidden md:flex items-center justify-between px-8 py-3.5 border-b border-slate-100">
          <div className="flex items-center space-x-2 text-xs text-slate-400">
            <span className="text-slate-600">CipherShare</span>
            <span>/</span>
            <span className="text-slate-900 font-medium capitalize">
              {location.pathname.replace('/', '') || 'Overview'}
            </span>
          </div>

          <div className="flex items-center space-x-3 text-xs text-slate-500 font-mono text-[11px]">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-600" />
            <span>WebCrypto Client-Side Engine</span>
            <span className="text-slate-300">•</span>
            <span>Zero Server Plaintext</span>
          </div>
        </header>

        {/* Child Pages - Full Page, open, airy, non-boxy */}
        <main className="flex-1 w-full px-8 sm:px-12 py-8 lg:py-10">
          {children}
        </main>
      </div>

      {/* Global Modals */}
      <KeySetupModal isOpen={isKeySetupOpen} onClose={() => setIsKeySetupOpen(false)} />
      <PassphraseModal isOpen={isPassphraseOpen} onClose={() => setIsPassphraseOpen(false)} />
    </div>
  );
};
