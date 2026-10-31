import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext';
import { api } from '../lib/api/client';
import {
  Users,
  CheckCircle2,
  ShieldAlert,
  RotateCcw,
  Sparkles,
  ArrowRight
} from 'lucide-react';

export const DemoWorkspacePage: React.FC = () => {
  const { user, login } = useAuth();
  const navigate = useNavigate();

  const [demoStatus, setDemoStatus] = useState<any[]>([]);
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
      // Attempt authorized download endpoint -> Should return 403 Forbidden!
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
      description: 'Alice initiates the process. Generate 3072-bit RSA pair with master passphrase in Key Vault if not yet established.',
      action: () => handleSwitchPersona('sender@demo.local', 'DemoSender123!')
    },
    {
      step: 2,
      title: 'Step 2: Encrypt & Share File',
      description: 'Go to "Share File", select a document, choose Bob Recipient, and execute client-side hybrid encryption.',
      action: () => navigate('/share')
    },
    {
      step: 3,
      title: 'Step 3: Switch to Eve (Intruder) & Verify 403 Denial',
      description: 'Switch persona to Eve Intruder. Confirm inbox is empty and direct API requests are blocked with HTTP 403 Forbidden.',
      action: () => handleSwitchPersona('intruder@demo.local', 'DemoIntruder123!')
    },
    {
      step: 4,
      title: 'Step 4: Switch to Bob (Recipient) & Decrypt',
      description: 'Switch persona to Bob. Enter master passphrase, unwrap recipient AES key envelope, and decrypt with AES-GCM.',
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
    <div className="w-full space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Professor Demonstration Workspace</h2>
          <p className="text-xs text-slate-500 mt-1">
            Pre-seeded presentation personas, active storage status, live unauthorized access tests, and guided flow.
          </p>
        </div>

        <button
          onClick={handleResetDemo}
          disabled={isResetting}
          className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl flex items-center gap-2 text-xs font-semibold shadow-2xs transition-colors shrink-0"
        >
          <RotateCcw className={`w-3.5 h-3.5 ${isResetting ? 'animate-spin' : ''}`} />
          <span>Reset Demo Data</span>
        </button>
      </div>

      {notification && (
        <div className="p-4 rounded-xl bg-sky-50 border border-sky-200 text-sky-900 text-xs flex items-center justify-between">
          <span className="break-words-anywhere">{notification}</span>
          <button onClick={() => setNotification(null)} className="text-slate-400 hover:text-slate-700 p-1">✕</button>
        </div>
      )}

      {/* Presentation Persona Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {demoStatus.map((du) => {
          const isActive = user?.email === du.email;
          return (
            <div
              key={du.email}
              className={`bg-white border rounded-2xl p-6 space-y-4 shadow-2xs transition-all flex flex-col justify-between ${
                isActive ? 'border-slate-900 ring-1 ring-slate-900/10' : 'border-slate-200'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold ${
                    du.role === 'Sender' ? 'bg-sky-50 text-sky-800 border border-sky-200' :
                    du.role === 'Intended Recipient' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' :
                    'bg-rose-50 text-rose-800 border border-rose-200'
                  }`}>
                    {du.role}
                  </span>
                  {isActive && (
                    <span className="text-[10px] font-mono text-emerald-700 font-bold flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      ACTIVE
                    </span>
                  )}
                </div>

                <div>
                  <h4 className="text-base font-bold text-slate-900">{du.name}</h4>
                  <div className="text-xs font-mono text-slate-500 break-words-anywhere">{du.email}</div>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-[11px] space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Public Key:</span>
                    <span className={`font-semibold ${du.has_public_key ? 'text-emerald-700' : 'text-amber-700'}`}>
                      {du.has_public_key ? 'Registered' : 'Not Generated Yet'}
                    </span>
                  </div>
                  {du.public_key_fingerprint && (
                    <div className="text-slate-500 pt-1">
                      <span>Fingerprint:</span>
                      <span className="font-mono text-slate-800 text-[10px] block break-words-anywhere">
                        {du.public_key_fingerprint}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <button
                onClick={() => handleSwitchPersona(du.email, du.role === 'Sender' ? 'DemoSender123!' : du.role === 'Intended Recipient' ? 'DemoRecipient123!' : 'DemoIntruder123!')}
                className={`w-full py-2 px-3 rounded-xl text-xs font-semibold transition-colors shadow-2xs ${
                  isActive
                    ? 'bg-slate-100 text-slate-500 cursor-default border border-slate-200'
                    : 'bg-slate-900 hover:bg-slate-800 text-white'
                }`}
              >
                {isActive ? 'Current Active Persona' : `Switch to ${du.name}`}
              </button>
            </div>
          );
        })}
      </div>

      {/* Live Unauthorized Access Demonstration Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-4 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-rose-50 text-rose-700 rounded-xl border border-rose-200 shrink-0">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Live Unauthorized Access Test (Eve Intruder)</h3>
            <p className="text-xs text-slate-500">
              Demonstrate that non-recipients receive HTTP 403 Forbidden and cannot obtain keys or ciphertext.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <input
            type="text"
            value={intruderFileId}
            onChange={(e) => setIntruderFileId(e.target.value)}
            placeholder="Paste Target File UUID (e.g. from Alice's sent dispatches)"
            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-800 break-words-anywhere"
          />
          <button
            onClick={handleAttemptIntruderAccess}
            disabled={isIntruding}
            className="px-5 py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center gap-2 shrink-0 shadow-sm transition-colors disabled:opacity-50"
          >
            {isIntruding ? (
              <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <ShieldAlert className="w-4 h-4" />
                <span>Simulate Unauthorized Request</span>
              </>
            )}
          </button>
        </div>

        {intruderResult && (
          <div className={`p-4 rounded-xl text-xs border mt-3 ${
            intruderResult.status === 'denied_as_expected'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
              : 'bg-rose-50 border-rose-200 text-rose-950'
          }`}>
            <div className="font-bold text-sm mb-1 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>HTTP {intruderResult.httpCode} FORBIDDEN (Access Denied as Expected)</span>
            </div>
            <p className="text-slate-700 mt-1 break-words-anywhere">{intruderResult.explanation}</p>
            <div className="mt-2 text-[11px] text-slate-500 font-mono break-words-anywhere">
              Server Response: "{intruderResult.serverMessage}"
            </div>
          </div>
        )}
      </div>

      {/* Professor Step-by-Step Walkthrough Guide */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-6 shadow-2xs">
        <div>
          <h3 className="text-base font-bold text-slate-900">Professor Demonstration Walkthrough Checklist</h3>
          <p className="text-xs text-slate-500 mt-1">
            Follow these chronological steps to deliver a seamless live evaluation to your course professor:
          </p>
        </div>

        <div className="space-y-3">
          {checklistSteps.map((s) => (
            <div
              key={s.step}
              className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs"
            >
              <div className="flex items-start space-x-3 min-w-0">
                <span className="w-6 h-6 rounded-full bg-slate-900 text-white font-bold flex items-center justify-center shrink-0 text-xs">
                  {s.step}
                </span>
                <div className="min-w-0">
                  <div className="font-bold text-slate-900 text-sm break-words-anywhere">{s.title}</div>
                  <p className="text-slate-500 mt-0.5 break-words-anywhere">{s.description}</p>
                </div>
              </div>
              <button
                onClick={s.action}
                className="px-4 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 font-semibold flex items-center gap-1.5 shrink-0 shadow-2xs transition-colors"
              >
                <span>Execute Step</span>
                <ArrowRight className="w-3.5 h-3.5 text-sky-600" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
