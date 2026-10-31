import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../features/auth/AuthContext';
import { KeySetupModal } from './KeySetupModal';
import { PassphraseModal } from './PassphraseModal';
import {
  Shield,
  KeyRound,
  Lock,
  Unlock,
  Send,
  Inbox,
  Clock,
  Sparkles,
  Users,
  LogOut,
  ChevronDown,
  FileCheck
} from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, publicKey, hasLocalKey, isKeyUnlocked, lockKey, logout, login } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [isKeySetupOpen, setIsKeySetupOpen] = useState(false);
  const [isPassphraseOpen, setIsPassphraseOpen] = useState(false);
  const [isDemoMenuOpen, setIsDemoMenuOpen] = useState(false);

  if (!user) return null;

  const navLinks = [
    { to: '/dashboard', label: 'Dashboard', icon: Shield },
    { to: '/share', label: 'Share File', icon: Send },
    { to: '/inbox', label: 'Inbox', icon: Inbox },
    { to: '/sent', label: 'Sent', icon: FileCheck },
    { to: '/security', label: 'Security Center', icon: Clock },
    { to: '/playground', label: 'Playground', icon: Sparkles },
    { to: '/demo', label: 'Demo Workspace', icon: Users },
  ];

  const handleQuickSwitch = async (email: string, pass: string) => {
    setIsDemoMenuOpen(false);
    try {
      await login(email, pass);
      navigate('/dashboard');
    } catch (err) {
      console.error('Quick switch failed', err);
    }
  };

  return (
    <>
      <nav className="bg-[#0f172a] border-b border-[#1e293b] sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Brand Logo */}
            <div className="flex items-center space-x-6">
              <Link to="/dashboard" className="flex items-center space-x-2.5">
                <div className="p-2 bg-gradient-to-br from-sky-500 to-indigo-600 rounded-xl text-white shadow-lg shadow-sky-500/20">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <span className="font-bold text-lg text-slate-100 tracking-tight flex items-center gap-1.5">
                    CipherShare
                    <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">
                      Hybrid Crypto
                    </span>
                  </span>
                </div>
              </Link>

              {/* Desktop Navigation Links */}
              <div className="hidden md:flex items-center space-x-1">
                {navLinks.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.to;
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center space-x-1.5 ${
                        isActive
                          ? 'bg-sky-500/15 text-sky-300 border border-sky-500/30'
                          : 'text-slate-300 hover:text-slate-100 hover:bg-slate-800/60'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Right side controls */}
            <div className="flex items-center space-x-3">
              {/* Key Status Pill */}
              {!publicKey ? (
                <button
                  onClick={() => setIsKeySetupOpen(true)}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/30 hover:bg-rose-500/20 flex items-center space-x-1.5"
                  title="No public key registered yet. Click to generate."
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Setup Key Pair</span>
                </button>
              ) : !hasLocalKey ? (
                <button
                  onClick={() => setIsKeySetupOpen(true)}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium bg-amber-500/10 text-amber-300 border border-amber-500/30 hover:bg-amber-500/20 flex items-center space-x-1.5"
                  title="Private key not found in this browser's IndexedDB."
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Missing Local Key</span>
                </button>
              ) : isKeyUnlocked ? (
                <button
                  onClick={lockKey}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 flex items-center space-x-1.5"
                  title="Private key unlocked in memory. Click to lock."
                >
                  <Unlock className="w-3.5 h-3.5" />
                  <span>Key Unlocked</span>
                </button>
              ) : (
                <button
                  onClick={() => setIsPassphraseOpen(true)}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/20 flex items-center space-x-1.5"
                  title="Private key locked. Click to unlock."
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Key Locked</span>
                </button>
              )}

              {/* Demo 1-Click Role Switcher */}
              <div className="relative">
                <button
                  onClick={() => setIsDemoMenuOpen(!isDemoMenuOpen)}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-800 text-slate-300 hover:text-white border border-slate-700 flex items-center space-x-1"
                  title="Switch between demo presentation personas"
                >
                  <Users className="w-3.5 h-3.5 text-sky-400" />
                  <span className="hidden sm:inline">Demo Switch</span>
                  <ChevronDown className="w-3 h-3 text-slate-400" />
                </button>

                {isDemoMenuOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-[#111827] border border-slate-700 rounded-xl shadow-2xl py-1 z-50 text-xs">
                    <div className="px-3 py-1.5 font-semibold text-slate-400 border-b border-slate-800 text-[11px] uppercase tracking-wider">
                      Presentation Personas
                    </div>
                    <button
                      onClick={() => handleQuickSwitch('sender@demo.local', 'DemoSender123!')}
                      className="w-full px-3 py-2 text-left hover:bg-slate-800/80 flex items-center justify-between text-slate-200"
                    >
                      <div>
                        <div className="font-medium text-sky-400">Alice (Sender)</div>
                        <div className="text-[10px] text-slate-500">sender@demo.local</div>
                      </div>
                      {user.email === 'sender@demo.local' && <span className="text-[10px] text-emerald-400">active</span>}
                    </button>
                    <button
                      onClick={() => handleQuickSwitch('recipient@demo.local', 'DemoRecipient123!')}
                      className="w-full px-3 py-2 text-left hover:bg-slate-800/80 flex items-center justify-between text-slate-200"
                    >
                      <div>
                        <div className="font-medium text-emerald-400">Bob (Recipient)</div>
                        <div className="text-[10px] text-slate-500">recipient@demo.local</div>
                      </div>
                      {user.email === 'recipient@demo.local' && <span className="text-[10px] text-emerald-400">active</span>}
                    </button>
                    <button
                      onClick={() => handleQuickSwitch('intruder@demo.local', 'DemoIntruder123!')}
                      className="w-full px-3 py-2 text-left hover:bg-slate-800/80 flex items-center justify-between text-slate-200"
                    >
                      <div>
                        <div className="font-medium text-rose-400">Eve (Intruder)</div>
                        <div className="text-[10px] text-slate-500">intruder@demo.local</div>
                      </div>
                      {user.email === 'intruder@demo.local' && <span className="text-[10px] text-emerald-400">active</span>}
                    </button>
                  </div>
                )}
              </div>

              {/* User Avatar & Logout */}
              <div className="flex items-center space-x-2 border-l border-slate-800 pl-3">
                <Link
                  to="/keys"
                  className="hidden sm:flex flex-col text-right hover:opacity-80 transition-opacity"
                  title="Manage cryptographic keys"
                >
                  <span className="text-xs font-semibold text-slate-200">{user.name}</span>
                  <span className="text-[10px] text-slate-400 truncate max-w-[120px]">{user.email}</span>
                </Link>
                <button
                  onClick={logout}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                  title="Logout"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Navigation bar */}
        <div className="md:hidden flex items-center justify-around px-2 py-2 border-t border-slate-800/60 overflow-x-auto text-xs">
          {navLinks.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`p-2 rounded-lg flex flex-col items-center shrink-0 ${
                  isActive ? 'text-sky-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="text-[10px] mt-0.5">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Modals */}
      <KeySetupModal isOpen={isKeySetupOpen} onClose={() => setIsKeySetupOpen(false)} />
      <PassphraseModal isOpen={isPassphraseOpen} onClose={() => setIsPassphraseOpen(false)} />
    </>
  );
};
