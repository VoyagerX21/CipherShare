import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../features/auth/AuthContext';
import { api } from '../../lib/api/client';
import { KeySetupModal } from '../common/KeySetupModal';
import { PassphraseModal } from '../common/PassphraseModal';
import {
  Shield,
  Send,
  Inbox,
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
  X,
  ChevronRight,
  ShieldCheck,
  RefreshCw
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
  const [inboxBadge, setInboxBadge] = useState<number | null>(null);

  useEffect(() => {
    async function fetchBadge() {
      if (user) {
        try {
          const res = await api.files.getInbox();
          setInboxBadge(res.files.length);
        } catch {}
      }
    }
    fetchBadge();
  }, [user, location.pathname]);

  if (!user) {
    return <>{children}</>;
  }

  const navLinks = [
    { to: '/dashboard', label: 'Dashboard', icon: Shield, description: 'System overview & status' },
    { to: '/share', label: 'Share File', icon: Send, description: 'Encrypt & dispatch file' },
    { to: '/inbox', label: 'Encrypted Inbox', icon: Inbox, badge: inboxBadge, description: 'Decrypt received files' },
    { to: '/sent', label: 'Sent Dispatches', icon: FileCheck, description: 'Outbound encrypted files' },
    { to: '/security', label: 'Security & Audit', icon: Clock, description: 'Tamper-evident log stream' },
    { to: '/playground', label: 'Crypto Playground', icon: Sparkles, description: 'Hands-on algorithm lab' },
    { to: '/keys', label: 'Key Vault', icon: KeyRound, description: 'RSA-3072 & IndexedDB' },
    { to: '/demo', label: 'Demo Workspace', icon: Users, description: 'Evaluation presentations' },
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
    <div className="min-h-screen flex flex-col md:flex-row bg-[#f8fafc]">
      {/* Mobile Top Header */}
      <header className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <Link to="/dashboard" className="flex items-center space-x-2">
          <div className="p-1.5 bg-slate-900 text-white rounded-lg">
            <Shield className="w-5 h-5 text-sky-400" />
          </div>
          <span className="font-bold text-slate-900 tracking-tight">CipherShare</span>
        </Link>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Sidebar Navigation */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-72 bg-white border-r border-slate-200 flex flex-col justify-between transition-transform duration-200 ease-in-out md:static md:translate-x-0 ${
          isMobileMenuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full overflow-y-auto">
          {/* Brand Header */}
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <Link to="/dashboard" className="flex items-center space-x-3 group">
              <div className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center shadow-sm group-hover:bg-slate-800 transition-colors">
                <Shield className="w-5 h-5 text-sky-400" />
              </div>
              <div>
                <h1 className="font-bold text-base text-slate-900 tracking-tight leading-none">CipherShare</h1>
                <p className="text-[11px] text-slate-500 font-medium tracking-wide mt-1">Hybrid Cryptography</p>
              </div>
            </Link>

            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="md:hidden text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Links */}
          <div className="px-3 py-4 flex-1 space-y-1">
            <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Workspace Navigation
            </div>
            {navLinks.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`group flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-slate-900 text-white font-semibold shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center space-x-3 min-w-0">
                    <Icon className={`w-4 h-4 shrink-0 transition-colors ${isActive ? 'text-sky-400' : 'text-slate-400 group-hover:text-slate-600'}`} />
                    <span className="truncate">{item.label}</span>
                  </div>
                  {item.badge !== undefined && item.badge !== null && item.badge > 0 && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      isActive ? 'bg-sky-500 text-slate-900' : 'bg-slate-100 text-slate-700'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}

            {/* Cryptographic Key Vault Status Widget in Sidebar */}
            <div className="pt-5 pb-2">
              <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Key Vault Status
              </div>
              <div className="mx-2 p-3 bg-slate-50 border border-slate-200/80 rounded-xl space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-600 font-medium">Local Private Key</span>
                  <span className="flex items-center space-x-1 font-semibold text-[11px]">
                    {isKeyUnlocked ? (
                      <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Unlocked
                      </span>
                    ) : hasLocalKey ? (
                      <span className="text-slate-700 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded flex items-center gap-1">
                        <Lock className="w-3 h-3 text-slate-500" />
                        Locked
                      </span>
                    ) : (
                      <span className="text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 text-amber-500" />
                        Missing
                      </span>
                    )}
                  </span>
                </div>

                <div className="text-[11px] text-slate-500 font-mono break-words-anywhere">
                  {publicKey ? (
                    <span title={publicKey.fingerprint}>
                      FP: {publicKey.fingerprint.substring(0, 16)}...
                    </span>
                  ) : (
                    <span className="text-rose-500 font-sans">No public key registered</span>
                  )}
                </div>

                <div className="pt-1">
                  {!publicKey || !hasLocalKey ? (
                    <button
                      onClick={() => setIsKeySetupOpen(true)}
                      className="w-full py-1.5 px-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
                    >
                      <KeyRound className="w-3.5 h-3.5 text-sky-400" />
                      <span>Setup Key Pair</span>
                    </button>
                  ) : isKeyUnlocked ? (
                    <button
                      onClick={lockKey}
                      className="w-full py-1.5 px-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Lock className="w-3.5 h-3.5 text-slate-500" />
                      <span>Lock In RAM</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => setIsPassphraseOpen(true)}
                      className="w-full py-1.5 px-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <Unlock className="w-3.5 h-3.5" />
                      <span>Unlock with Passphrase</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Demo Persona Switcher in Sidebar */}
            <div className="pt-2">
              <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                <span>Demo Personas</span>
                <span className="text-[9px] text-slate-400 font-normal">1-Click</span>
              </div>
              <div className="mx-2 space-y-1">
                <button
                  onClick={() => handleQuickSwitch('sender@demo.local', 'DemoSender123!')}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-colors flex items-center justify-between ${
                    user.email === 'sender@demo.local'
                      ? 'bg-sky-50 text-sky-900 font-semibold border border-sky-200'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span className="truncate">Alice (Sender)</span>
                  <span className="text-[10px] text-slate-400 font-mono">sender</span>
                </button>
                <button
                  onClick={() => handleQuickSwitch('recipient@demo.local', 'DemoRecipient123!')}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-colors flex items-center justify-between ${
                    user.email === 'recipient@demo.local'
                      ? 'bg-emerald-50 text-emerald-900 font-semibold border border-emerald-200'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span className="truncate">Bob (Recipient)</span>
                  <span className="text-[10px] text-slate-400 font-mono">recipient</span>
                </button>
                <button
                  onClick={() => handleQuickSwitch('intruder@demo.local', 'DemoIntruder123!')}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-colors flex items-center justify-between ${
                    user.email === 'intruder@demo.local'
                      ? 'bg-rose-50 text-rose-900 font-semibold border border-rose-200'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span className="truncate">Eve (Intruder)</span>
                  <span className="text-[10px] text-slate-400 font-mono">intruder</span>
                </button>
              </div>
            </div>
          </div>

          {/* User Account Footer */}
          <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between gap-2">
            <Link
              to="/keys"
              className="flex items-center space-x-2.5 min-w-0 hover:opacity-80 transition-opacity"
              title="View account keys"
            >
              <div className="w-8 h-8 rounded-full bg-slate-200 border border-slate-300 text-slate-700 font-bold flex items-center justify-center text-xs shrink-0">
                {user.name.charAt(0)}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-slate-900 truncate">{user.name}</div>
                <div className="text-[11px] text-slate-500 truncate max-w-[130px]" title={user.email}>
                  {user.email}
                </div>
              </div>
            </Link>

            <button
              onClick={logout}
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors shrink-0"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area - Full Page Width */}
      <div className="flex-1 min-w-0 flex flex-col min-h-screen">
        {/* Top Header Bar for Desktop */}
        <header className="hidden md:flex items-center justify-between px-8 py-3.5 bg-white border-b border-slate-200">
          <div className="flex items-center space-x-2 text-xs text-slate-500">
            <span className="font-semibold text-slate-700">CipherShare</span>
            <span>/</span>
            <span className="text-slate-900 font-medium capitalize">
              {location.pathname.replace('/', '') || 'Dashboard'}
            </span>
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 text-xs text-slate-500 bg-slate-50 border border-slate-200 px-3 py-1 rounded-lg">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="font-medium text-slate-700">Web Crypto API Active</span>
              <span className="text-slate-300">|</span>
              <span>Zero Server Plaintext</span>
            </div>
          </div>
        </header>

        {/* Child Pages - Full Page Width, not constrained to center box */}
        <main className="flex-1 w-full p-6 sm:p-8 lg:p-10">
          {children}
        </main>
      </div>

      {/* Global Modals */}
      <KeySetupModal isOpen={isKeySetupOpen} onClose={() => setIsKeySetupOpen(false)} />
      <PassphraseModal isOpen={isPassphraseOpen} onClose={() => setIsPassphraseOpen(false)} />
    </div>
  );
};
