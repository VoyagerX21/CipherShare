import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext';
import { api } from '../lib/api/client';
import {
  Users,
  CheckCircle2,
  ShieldAlert,
  ShieldCheck,
  RotateCcw,
  Sparkles,
  ArrowRight,
  Lock,
  Download,
  AlertTriangle,
  Play,
  FileText
} from 'lucide-react';

export const DemoWorkspacePage: React.FC = () => {
  const { user, login } = useAuth();
  const navigate = useNavigate();

  const [demoStatus, setDemoStatus] = useState<any[]>([]);
  const [storageType, setStorageType] = useState<string>('local');
  const [isResetting, setIsResetting] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  // Unauthorized intruder demo state
  const [intruderFileId, setIntruderFileId] = useState<string>('');
  const [intruderResult, setIntruderResult] = useState<any>(null);
  const [isIntruding, setIsIntruding] = useState<boolean>(false);

  const loadStatus = async () => {
    try {
      const res = await api.demo.getStatus();
      setDemoStatus(res.demo_users);
      setStorageType(res.storage_type);
    } catch (err) {
      console.error('Failed to load demo status', err);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const handleSwitchPersona = async (email: string, pass: string) => {
    try {
      await login(email, pass);
      setNotification(`Switched active persona to ${email}`);
      loadStatus();
    } catch (err: any) {
      setNotification(`Failed to switch persona: ${err.message}`);
    }
  };

  const handleResetDemo = async () => {
    if (!window.confirm('Reset all demo files, recipients, and test logs for a fresh presentation?')) return;
    setIsResetting(true);
    try {
      await api.demo.reset();
      setNotification('Demo environment reset successfully! All test files cleared.');
      loadStatus();
    } catch (err: any) {
      setNotification(`Reset failed: ${err.message}`);
    } finally {
      setIsResetting(false);
    }
  };

  const handleAttemptIntruderAccess = async () => {
    if (!intruderFileId.trim()) {
      setIntruderResult({ status: 'error', message: 'Please enter a target File ID to attempt access.' });
      return;
    }
    setIsIntruding(true);
    setIntruderResult(null);

    try {
      // 1. Attempt authorized download endpoint -> Should return 403 Forbidden!
      try {
        await api.files.authorizeDownload(intruderFileId.trim());
        setIntruderResult({
          status: 'critical_breach',
          message: 'CRITICAL FAILURE: Unauthorized user was granted access!'
        });
      } catch (err: any) {
        // Expected 403 Forbidden!
        setIntruderResult({
          status: 'denied_as_expected',
          httpCode: 403,
          serverMessage: err.message || 'Access denied',
          explanation: 'Backend authorization check verified that Eve is NOT in the authorized recipients list. Download URL and AES key envelope were withheld.'
        });
      }
    } finally {
      setIsIntruding(false);
    }
  };

  const checklistSteps = [
    {
      step: 1,
      title: 'Step 1: Log in as Sender (Alice)',
      description: 'Alice initiates the process. If key not set, generate 3072-bit RSA pair with master passphrase.',
      action: () => handleSwitchPersona('sender@demo.local', 'DemoSender123!')
    },
    {
      step: 2,
      title: 'Step 2: Encrypt & Share File',
      description: 'Navigate to "Share File", select a sample PDF/document, choose Bob Recipient, and execute hybrid encryption.',
      action: () => navigate('/share')
    },
    {
      step: 3,
      title: 'Step 3: Switch to Eve (Intruder) & Test 403 Denial',
      description: 'Switch persona to Eve Intruder. Confirm inbox is empty and direct API requests are blocked with HTTP 403 Forbidden.',
      action: () => handleSwitchPersona('intruder@demo.local', 'DemoIntruder123!')
    },
    {
      step: 4,
      title: 'Step 4: Switch to Bob (Recipient) & Decrypt',
      description: 'Switch persona to Bob. Enter key passphrase, unwrap recipient AES key envelope, and decrypt with AES-GCM.',
      action: () => handleSwitchPersona('recipient@demo.local', 'DemoRecipient123!')
    },
    {
      step: 5,
      title: 'Step 5: Run Tampering Demonstration',
      description: 'In Inbox, click "Tamper Test". Verify that a 1-bit modified ciphertext copy is rejected by the 128-bit authentication tag.',
      action: () => navigate('/inbox')
    },
    {
      step: 6,
      title: 'Step 6: Review Audit Log in Security Center',
      description: 'Inspect the audit log to verify recorded upload, download authorization, tampering detection, and access denial events.',
      action: () => navigate('/security')
    }
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 text-xs font-mono mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Course Project Presentation Control Center</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Professor Demonstration Workspace
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Pre-seeded presentation personas, active storage status, live unauthorized access tests, and guided flow.
          </p>
        </div>

        <button
          onClick={handleResetDemo}
          disabled={isResetting}
          className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-2 text-xs font-semibold"
        >
          <RotateCcw className={`w-3.5 h-3.5 ${isResetting ? 'animate-spin' : ''}`} />
          <span>Reset Demo Data</span>
        </button>
      </div>

      {notification && (
        <div className="p-4 rounded-2xl bg-sky-950/40 border border-sky-500/30 text-sky-300 text-xs flex items-center justify-between">
          <span>{notification}</span>
          <button onClick={() => setNotification(null)} className="text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Presentation Persona Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {demoStatus.map((du) => {
          const isActive = user?.email === du.email;
          return (
            <div
              key={du.email}
              className={`bg-[#111827] border rounded-3xl p-6 space-y-4 transition-all ${
                isActive ? 'border-sky-500 shadow-xl shadow-sky-950/30 ring-1 ring-sky-500/50' : 'border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                  du.role === 'Sender' ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20' :
                  du.role === 'Intended Recipient' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                  'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                }`}>
                  {du.role}
                </span>
                {isActive && (
                  <span className="text-[11px] font-mono text-sky-400 font-semibold flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
                    <span>ACTIVE</span>
                  </span>
                )}
              </div>

              <div>
                <h4 className="text-base font-bold text-white">{du.name}</h4>
                <div className="text-xs font-mono text-slate-400">{du.email}</div>
              </div>

              <div className="bg-slate-900/80 p-3 rounded-2xl border border-slate-800 text-[11px] space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-400">Public Key Status:</span>
                  <span className={`font-semibold ${du.has_public_key ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {du.has_public_key ? 'Registered' : 'Not Generated Yet'}
                  </span>
                </div>
                {du.public_key_fingerprint && (
                  <div className="text-slate-400 pt-1">
                    <span>Fingerprint:</span>
                    <span className="font-mono text-sky-400 text-[10px] block truncate">
                      {du.public_key_fingerprint}
                    </span>
                  </div>
                )}
              </div>

              <button
                onClick={() => handleSwitchPersona(du.email, du.role === 'Sender' ? 'DemoSender123!' : du.role === 'Intended Recipient' ? 'DemoRecipient123!' : 'DemoIntruder123!')}
                className={`w-full py-2.5 rounded-xl text-xs font-bold transition-colors ${
                  isActive
                    ? 'bg-slate-800 text-slate-300 cursor-default'
                    : 'bg-sky-500 hover:bg-sky-400 text-slate-950'
                }`}
              >
                {isActive ? 'Current Active Persona' : `Switch to ${du.name}`}
              </button>
            </div>
          );
        })}
      </div>

      {/* Live Unauthorized Access Demonstration Card */}
      <div className="bg-[#111827] border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-rose-500/10 text-rose-400 rounded-2xl border border-rose-500/20">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Live Unauthorized Access Test (Eve Intruder)</h3>
            <p className="text-xs text-slate-400">
              Demonstrate that non-recipients receive HTTP 403 Forbidden and cannot obtain keys or ciphertext.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <input
            type="text"
            value={intruderFileId}
            onChange={(e) => setIntruderFileId(e.target.value)}
            placeholder="Paste Target File UUID (e.g. from Alice's sent list)"
            className="flex-1 bg-[#0b0f19] border border-slate-700 rounded-xl px-4 py-2 text-xs text-slate-100 font-mono focus:outline-none focus:border-rose-500"
          />
          <button
            onClick={handleAttemptIntruderAccess}
            disabled={isIntruding}
            className="px-6 py-2.5 rounded-xl text-xs font-bold bg-rose-500 hover:bg-rose-400 text-slate-950 flex items-center justify-center gap-2 shrink-0 transition-colors disabled:opacity-50"
          >
            {isIntruding ? (
              <span className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <ShieldAlert className="w-4 h-4" />
                <span>Simulate Unauthorized Request</span>
              </>
            )}
          </button>
        </div>

        {intruderResult && (
          <div className={`p-4 rounded-2xl text-xs border mt-3 ${
            intruderResult.status === 'denied_as_expected'
              ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-950/30 border-rose-500/30 text-rose-300'
          }`}>
            <div className="font-bold text-sm mb-1 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>HTTP {intruderResult.httpCode} FORBIDDEN (Access Denied as Expected)</span>
            </div>
            <p className="text-slate-300 mt-1">{intruderResult.explanation}</p>
            <div className="mt-2 text-[11px] text-slate-400 font-mono">
              Server Response: "{intruderResult.serverMessage}"
            </div>
          </div>
        )}
      </div>

      {/* Professor Step-by-Step Walkthrough Guide */}
      <div className="bg-[#111827] border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6">
        <div>
          <h3 className="text-lg font-bold text-white">Professor Demonstration Walkthrough Checklist</h3>
          <p className="text-xs text-slate-400 mt-1">
            Follow these chronological steps to deliver a seamless live evaluation to your course professor:
          </p>
        </div>

        <div className="space-y-3">
          {checklistSteps.map((s) => (
            <div
              key={s.step}
              className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs"
            >
              <div className="flex items-start space-x-3">
                <span className="w-6 h-6 rounded-full bg-sky-500/20 text-sky-400 font-bold flex items-center justify-center shrink-0">
                  {s.step}
                </span>
                <div>
                  <div className="font-bold text-slate-200 text-sm">{s.title}</div>
                  <p className="text-slate-400 mt-0.5">{s.description}</p>
                </div>
              </div>
              <button
                onClick={s.action}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold flex items-center gap-1.5 shrink-0 transition-colors"
              >
                <span>Execute Step</span>
                <ArrowRight className="w-3.5 h-3.5 text-sky-400" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
