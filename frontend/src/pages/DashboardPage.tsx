import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext';
import { api } from '../lib/api/client';
import { SharedFile, AuditEventItem } from '../types';
import {
  Send,
  Inbox,
  Sparkles,
  ShieldAlert,
  ShieldCheck,
  KeyRound,
  FileText,
  Clock,
  ArrowUpRight,
  Lock,
  Unlock,
  AlertTriangle,
  FileCheck
} from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const { user, publicKey, hasLocalKey, isKeyUnlocked } = useAuth();
  const [inboxCount, setInboxCount] = useState<number>(0);
  const [sentCount, setSentCount] = useState<number>(0);
  const [recentEvents, setRecentEvents] = useState<AuditEventItem[]>([]);
  const [recentFiles, setRecentFiles] = useState<SharedFile[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    async function loadDashboard() {
      try {
        const [inboxRes, sentRes, auditRes] = await Promise.all([
          api.files.getInbox(),
          api.files.getSent(),
          api.audit.getRecent(),
        ]);
        setInboxCount(inboxRes.files.length);
        setSentCount(sentRes.files.length);
        setRecentFiles(inboxRes.files.slice(0, 5));
        setRecentEvents(auditRes.events.slice(0, 6));
      } catch (err) {
        console.error('Failed to load dashboard data', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadDashboard();
  }, []);

  return (
    <div className="w-full space-y-8">
      {/* Page Title & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">System Overview</h2>
          <p className="text-xs text-slate-500 mt-1">
            Client-side authenticated hybrid encryption • Active persona: <span className="font-semibold text-slate-800">{user?.name}</span> ({user?.email})
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <Link
            to="/share"
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors flex items-center gap-2"
          >
            <Send className="w-3.5 h-3.5 text-sky-400" />
            <span>Share a File</span>
          </Link>
          <Link
            to="/inbox"
            className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs font-medium shadow-2xs transition-colors flex items-center gap-2"
          >
            <Inbox className="w-3.5 h-3.5 text-slate-500" />
            <span>View Inbox</span>
          </Link>
        </div>
      </div>

      {/* Key State Notification (if needed) */}
      {!publicKey ? (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between gap-4">
          <div className="flex items-center space-x-3 min-w-0">
            <KeyRound className="w-5 h-5 text-amber-600 shrink-0" />
            <div className="min-w-0">
              <h4 className="text-xs font-bold text-amber-900">No Asymmetric Key Pair Established</h4>
              <p className="text-xs text-amber-700 mt-0.5">Other users cannot share encrypted files with you until your public key is registered.</p>
            </div>
          </div>
          <Link
            to="/keys"
            className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold shrink-0 shadow-xs"
          >
            Setup Key
          </Link>
        </div>
      ) : !hasLocalKey ? (
        <div className="p-4 bg-slate-100 border border-slate-300 rounded-xl flex items-center justify-between gap-4">
          <div className="flex items-center space-x-3 min-w-0">
            <AlertTriangle className="w-5 h-5 text-slate-600 shrink-0" />
            <div className="min-w-0">
              <h4 className="text-xs font-bold text-slate-900">Local Private Key Not Stored on this Browser</h4>
              <p className="text-xs text-slate-600 mt-0.5">You can dispatch encrypted files to others, but cannot decrypt files sent to you on this device.</p>
            </div>
          </div>
          <Link
            to="/keys"
            className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shrink-0"
          >
            Key Details
          </Link>
        </div>
      ) : null}

      {/* Metrics Row (Full Width, Crisp & Classic) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Inbox Deliveries</span>
            <div className="p-2 bg-slate-100 rounded-lg text-slate-600">
              <Inbox className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 mt-2">{inboxCount}</div>
          <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
            <span>Encrypted files for you</span>
          </div>
        </div>

        <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Dispatched Files</span>
            <div className="p-2 bg-slate-100 rounded-lg text-slate-600">
              <Send className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 mt-2">{sentCount}</div>
          <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
            <span>Ciphertext blobs sent</span>
          </div>
        </div>

        <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Key Vault</span>
            <div className="p-2 bg-slate-100 rounded-lg text-slate-600">
              <KeyRound className="w-4 h-4" />
            </div>
          </div>
          <div className="text-base font-bold text-slate-900 mt-3 flex items-center gap-1.5">
            {isKeyUnlocked ? (
              <span className="text-emerald-700 flex items-center gap-1.5">
                <Unlock className="w-4 h-4 text-emerald-600" />
                Unlocked in RAM
              </span>
            ) : hasLocalKey ? (
              <span className="text-slate-700 flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-slate-500" />
                Protected (Locked)
              </span>
            ) : (
              <span className="text-amber-700">Missing Key</span>
            )}
          </div>
          <div className="text-xs text-slate-500 mt-1">PBKDF2-SHA-256 + AES-GCM</div>
        </div>

        <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Audit Trail</span>
            <div className="p-2 bg-slate-100 rounded-lg text-slate-600">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 mt-2">{recentEvents.length}</div>
          <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>Tamper-evident logs</span>
          </div>
        </div>
      </div>

      {/* Two Column Layout (Full Page, Clean Tables) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Recent Inbox Deliveries Table */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Recent Inbox Deliveries</h3>
              <p className="text-xs text-slate-500">Awaiting client-side recipient decryption</p>
            </div>
            <Link to="/inbox" className="text-xs text-sky-700 font-semibold hover:text-sky-800 flex items-center gap-1">
              <span>View all files</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {recentFiles.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              <FileText className="w-8 h-8 mx-auto mb-2 text-slate-300 stroke-1" />
              <p>No files in your inbox yet.</p>
              <p className="text-slate-400 mt-0.5">Switch to Alice (Sender) to share an encrypted file.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {recentFiles.map((file) => (
                <div key={file.id} className="py-3 flex items-center justify-between gap-4">
                  <div className="flex items-center space-x-3 min-w-0">
                    <div className="p-2 bg-slate-100 rounded-lg text-slate-700 shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-900 break-words-anywhere">{file.original_filename}</div>
                      <div className="text-[11px] text-slate-500 truncate max-w-sm">
                        Sender: {file.sender_name || file.sender_email} • {(file.file_size / 1024).toFixed(1)} KB
                      </div>
                    </div>
                  </div>
                  <Link
                    to="/inbox"
                    className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-medium shrink-0 transition-colors"
                  >
                    Decrypt
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Security Audit Feed */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Security Audit Stream</h3>
              <p className="text-xs text-slate-500">Live cryptographic verification events</p>
            </div>
            <Link to="/security" className="text-xs text-sky-700 font-semibold hover:text-sky-800 flex items-center gap-1">
              <span>Security Center</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-2.5">
            {recentEvents.map((evt) => (
              <div key={evt.id} className="p-3 bg-slate-50/70 border border-slate-200/80 rounded-xl text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    evt.result === 'SUCCESS' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' :
                    evt.result === 'DENIED' ? 'bg-rose-50 text-rose-800 border border-rose-200' :
                    'bg-slate-100 text-slate-700 border border-slate-200'
                  }`}>
                    {evt.result}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {new Date(evt.created_at).toLocaleTimeString()}
                  </span>
                </div>
                <div className="font-semibold text-slate-800 break-words-anywhere">{evt.event_type}</div>
                <div className="text-[11px] text-slate-500 break-words-anywhere">
                  Actor: {evt.actor_email || 'system'}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
