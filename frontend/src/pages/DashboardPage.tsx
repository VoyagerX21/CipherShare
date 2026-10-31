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
  AlertTriangle
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-sky-950/40 via-indigo-950/30 to-[#111827] border border-sky-500/20 rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 text-xs font-mono">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Authenticated Zero-Knowledge Gateway</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Welcome back, {user?.name}
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 max-w-xl">
            Client-side hybrid encryption active. Private keys never leave this browser.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/share"
            className="px-5 py-2.5 rounded-xl text-xs font-bold bg-sky-500 hover:bg-sky-400 text-slate-950 transition-colors flex items-center gap-2 shadow-lg shadow-sky-500/20"
          >
            <Send className="w-4 h-4" />
            <span>Share a File</span>
          </Link>
          <Link
            to="/inbox"
            className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors flex items-center gap-2"
          >
            <Inbox className="w-4 h-4" />
            <span>View Inbox</span>
          </Link>
        </div>
      </div>

      {/* Key State Warning (if missing or locked) */}
      {!publicKey ? (
        <div className="bg-rose-950/20 border border-rose-500/30 rounded-2xl p-4 flex items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-rose-500/20 text-rose-400 rounded-xl">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-rose-200">No Asymmetric Public Key Registered</h4>
              <p className="text-xs text-rose-300/80">Other users cannot share encrypted files with you until you generate a key pair.</p>
            </div>
          </div>
          <Link
            to="/keys"
            className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-500 hover:bg-rose-400 text-slate-950 shrink-0"
          >
            Setup Key Pair
          </Link>
        </div>
      ) : !hasLocalKey ? (
        <div className="bg-amber-950/20 border border-amber-500/30 rounded-2xl p-4 flex items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-xl">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-amber-200">Local Private Key Not Found on This Browser</h4>
              <p className="text-xs text-amber-300/80">
                You can send files to others, but you cannot decrypt files sent to you on this device without your local private key backup.
              </p>
            </div>
          </div>
          <Link
            to="/keys"
            className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 shrink-0"
          >
            Key Management
          </Link>
        </div>
      ) : null}

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="bg-[#111827] border border-slate-800 rounded-2xl p-5 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Inbox Files</span>
            <div className="text-2xl font-bold text-white mt-1">{inboxCount}</div>
            <span className="text-[11px] text-sky-400">Encrypted for you</span>
          </div>
          <div className="p-3 bg-sky-500/10 text-sky-400 rounded-xl">
            <Inbox className="w-5 h-5" />
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-[#111827] border border-slate-800 rounded-2xl p-5 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Sent Files</span>
            <div className="text-2xl font-bold text-white mt-1">{sentCount}</div>
            <span className="text-[11px] text-indigo-400">Client-encrypted blobs</span>
          </div>
          <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl">
            <Send className="w-5 h-5" />
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-[#111827] border border-slate-800 rounded-2xl p-5 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Key Status</span>
            <div className="text-sm font-bold text-white mt-1 flex items-center gap-1.5">
              {isKeyUnlocked ? (
                <>
                  <Unlock className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-400">Unlocked</span>
                </>
              ) : hasLocalKey ? (
                <>
                  <Lock className="w-4 h-4 text-indigo-400" />
                  <span className="text-indigo-400">Locked (Protected)</span>
                </>
              ) : (
                <span className="text-rose-400">Missing</span>
              )}
            </div>
            <span className="text-[11px] text-slate-500">PBKDF2-AES-GCM vault</span>
          </div>
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl">
            <KeyRound className="w-5 h-5" />
          </div>
        </div>

        {/* Metric 4 */}
        <div className="bg-[#111827] border border-slate-800 rounded-2xl p-5 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Audit Events</span>
            <div className="text-2xl font-bold text-white mt-1">{recentEvents.length}</div>
            <span className="text-[11px] text-emerald-400">Tamper-evident log</span>
          </div>
          <div className="p-3 bg-purple-500/10 text-purple-400 rounded-xl">
            <Clock className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Recent Files */}
        <div className="lg:col-span-7 bg-[#111827] border border-slate-800 rounded-3xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-100 text-base">Recent Inbox Deliveries</h3>
              <p className="text-xs text-slate-400">Encrypted files awaiting recipient decryption</p>
            </div>
            <Link to="/inbox" className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1">
              <span>View all</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {recentFiles.length === 0 ? (
            <div className="text-center py-10 text-slate-500 text-xs">
              <FileText className="w-8 h-8 mx-auto mb-2 opacity-40 stroke-1" />
              <p>No files in your inbox yet.</p>
              <p className="mt-1 text-[11px]">Share a file with Bob Recipient to test delivery.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentFiles.map((file) => (
                <div
                  key={file.id}
                  className="p-3.5 bg-slate-900/60 border border-slate-800/80 rounded-2xl flex items-center justify-between"
                >
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-sky-500/10 text-sky-400 rounded-xl">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-200">{file.original_filename}</div>
                      <div className="text-[11px] text-slate-400">
                        From: {file.sender_name || file.sender_email} • {(file.file_size / 1024).toFixed(1)} KB
                      </div>
                    </div>
                  </div>
                  <Link
                    to="/inbox"
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-sky-500/15 text-sky-300 border border-sky-500/30 hover:bg-sky-500/25 transition-colors"
                  >
                    Decrypt
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Security Audit Timeline */}
        <div className="lg:col-span-5 bg-[#111827] border border-slate-800 rounded-3xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-100 text-base">Security Audit Stream</h3>
              <p className="text-xs text-slate-400">Live cryptographic verification events</p>
            </div>
            <Link to="/security" className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1">
              <span>Security Center</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-3">
            {recentEvents.map((evt) => (
              <div key={evt.id} className="p-3 bg-slate-900/40 border border-slate-800 rounded-xl text-xs">
                <div className="flex items-center justify-between mb-1">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    evt.result === 'SUCCESS' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                    evt.result === 'DENIED' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                    'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  }`}>
                    {evt.result}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {new Date(evt.created_at).toLocaleTimeString()}
                  </span>
                </div>
                <div className="font-medium text-slate-200 text-xs">{evt.event_type}</div>
                <div className="text-[11px] text-slate-400 mt-0.5 truncate">
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
