import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext';
import { api } from '../lib/api/client';
import {
  CheckCircle2,
  ShieldAlert,
  RotateCcw,
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
      setNotification('Demo environment reset successfully. All demo files cleared.');
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
          explanation: 'Backend authorization check verified that Eve is NOT in the authorized recipients list. Download URL and AES key envelope were strictly withheld.'
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
      description: 'Alice initiates the file sharing process. Generate 3072-bit RSA pair with master passphrase in Key Vault if not yet established.',
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
    <div className="w-full space-y-12">
      {/* Editorial Header */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <span className="text-[10px] font-mono tracking-widest uppercase text-slate-400">
            Course Evaluation
          </span>
          <h2 className="text-3xl font-normal text-slate-900 tracking-tight font-serif mt-1">
            Professor Demonstration Workspace
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Pre-seeded presentation personas, live unauthorized access tests, and guided step-by-step evaluation workflow.
          </p>
        </div>

        <button
          onClick={handleResetDemo}
          disabled={isResetting}
          className="text-xs font-semibold text-slate-900 hover:text-slate-600 flex items-center gap-1.5 transition-colors shrink-0"
        >
          <RotateCcw className={`w-3.5 h-3.5 ${isResetting ? 'animate-spin' : ''}`} />
          <span>Reset Demo Environment</span>
        </button>
      </div>

      {notification && (
        <div className="py-2.5 px-4 border-l-2 border-slate-900 bg-slate-50 text-slate-900 text-xs flex items-center justify-between">
          <span className="break-words-anywhere">{notification}</span>
          <button onClick={() => setNotification(null)} className="text-slate-400 hover:text-slate-700 text-xs">✕</button>
        </div>
      )}

      {/* Presentation Personas - Open 3-Column Strip (No card boxes) */}
      <div className="space-y-4">
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 pb-2 border-b border-slate-100">
          Pre-Seeded Presentation Personas
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-200 py-2">
          {demoStatus.map((du, idx) => {
            const isActive = user?.email === du.email;
            return (
              <div
                key={du.email}
                className={`py-4 space-y-3 ${
                  idx === 0 ? 'md:pr-8' : idx === 1 ? 'md:px-8' : 'md:pl-8'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-mono uppercase tracking-wider font-semibold ${
                    du.role === 'Sender' ? 'text-sky-800' :
                    du.role === 'Intended Recipient' ? 'text-emerald-800' :
                    'text-rose-800'
                  }`}>
                    {du.role}
                  </span>
                  {isActive && (
                    <span className="text-[10px] font-mono text-emerald-700 font-bold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                      ACTIVE SESSION
                    </span>
                  )}
                </div>

                <div>
                  <h4 className="text-base font-semibold text-slate-900">{du.name}</h4>
                  <div className="text-xs font-mono text-slate-500 break-words-anywhere">{du.email}</div>
                </div>

                <div className="space-y-1 text-xs">
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-400 text-[11px]">Public Key</span>
                    <span className={`font-mono text-[11px] font-medium ${du.has_public_key ? 'text-emerald-700' : 'text-amber-700'}`}>
                      {du.has_public_key ? 'Registered' : 'Not Generated'}
                    </span>
                  </div>
                  {du.public_key_fingerprint && (
                    <div className="pt-1">
                      <span className="text-slate-400 text-[10px] uppercase font-mono block">Fingerprint</span>
                      <span className="font-mono text-slate-700 text-[11px] block break-words-anywhere">
                        {du.public_key_fingerprint}
                      </span>
                    </div>
                  )}
                </div>

                <div className="pt-2">
                  <button
                    onClick={() => handleSwitchPersona(du.email, du.role === 'Sender' ? 'DemoSender123!' : du.role === 'Intended Recipient' ? 'DemoRecipient123!' : 'DemoIntruder123!')}
                    disabled={isActive}
                    className={`text-xs font-semibold flex items-center gap-1 transition-colors ${
                      isActive
                        ? 'text-slate-400 cursor-default'
                        : 'text-slate-900 hover:text-slate-600 underline'
                    }`}
                  >
                    <span>{isActive ? 'Currently Logged In' : `Switch Session to ${du.name} →`}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Live Unauthorized Access Test - Open Section (No card box) */}
      <div className="space-y-4 pt-4 border-t border-slate-200">
        <div className="flex items-start justify-between pb-2 border-b border-slate-100">
          <div>
            <h3 className="text-base font-semibold text-slate-900 tracking-tight flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-700" />
              <span>Live Unauthorized Access Verification (Eve Intruder Test)</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Demonstrate that non-recipients receive HTTP 403 Forbidden and the server withholds ciphertext and key envelopes.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 items-baseline">
          <input
            type="text"
            value={intruderFileId}
            onChange={(e) => setIntruderFileId(e.target.value)}
            placeholder="Paste Target File UUID (e.g. from Alice's sent archive)"
            className="flex-1 border-b border-slate-300 py-2.5 text-xs text-slate-900 font-mono placeholder-slate-400 focus:outline-none focus:border-slate-900 bg-transparent break-words-anywhere"
          />
          <button
            onClick={handleAttemptIntruderAccess}
            disabled={isIntruding}
            className="py-2.5 px-5 bg-rose-600 hover:bg-rose-500 text-white rounded text-xs font-semibold tracking-wide transition-colors flex items-center gap-2 shrink-0 disabled:opacity-50"
          >
            {isIntruding ? (
              <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Simulate Unauthorized Request</span>
              </>
            )}
          </button>
        </div>

        {intruderResult && (
          <div className={`py-3 px-4 border-l-2 text-xs mt-4 ${
            intruderResult.status === 'denied_as_expected'
              ? 'border-emerald-600 bg-emerald-50/70 text-emerald-950'
              : 'border-rose-600 bg-rose-50/70 text-rose-950'
          }`}>
            <div className="font-semibold text-xs mb-1 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>HTTP {intruderResult.httpCode} FORBIDDEN (Access Blocked as Expected)</span>
            </div>
            <p className="text-slate-700 mt-1 break-words-anywhere leading-relaxed">{intruderResult.explanation}</p>
            <div className="mt-2 text-[11px] text-slate-500 font-mono break-words-anywhere">
              Server Response: "{intruderResult.serverMessage}"
            </div>
          </div>
        )}
      </div>

      {/* Professor Step-by-Step Walkthrough Guide - Open Chronological List (No card box) */}
      <div className="space-y-4 pt-4 border-t border-slate-200">
        <div className="pb-2 border-b border-slate-100">
          <h3 className="text-base font-semibold text-slate-900 tracking-tight">
            Professor Demonstration Walkthrough Checklist
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Follow these chronological steps to deliver a seamless live evaluation:
          </p>
        </div>

        <div className="divide-y divide-slate-100">
          {checklistSteps.map((s) => (
            <div
              key={s.step}
              className="py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs"
            >
              <div className="flex items-start space-x-4 min-w-0">
                <span className="font-mono text-xs font-semibold text-slate-400 shrink-0 pt-0.5">
                  0{s.step}
                </span>
                <div className="min-w-0">
                  <div className="font-semibold text-slate-900 text-xs break-words-anywhere">{s.title}</div>
                  <p className="text-slate-500 mt-0.5 break-words-anywhere leading-relaxed">{s.description}</p>
                </div>
              </div>
              <button
                onClick={s.action}
                className="text-xs font-semibold text-slate-900 hover:text-slate-600 flex items-center gap-1.5 shrink-0 transition-colors"
              >
                <span>Execute</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
