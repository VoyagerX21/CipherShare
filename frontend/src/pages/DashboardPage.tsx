import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext';
import { api } from '../lib/api/client';
import { SharedFile, AuditEventItem } from '../types';
import {
  Send,
  Inbox,
  Clock,
  ArrowRight,
  Lock,
  Unlock,
  AlertTriangle,
  FileText
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
        setRecentFiles(inboxRes.files.slice(0, 6));
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
    <div className="w-full space-y-12">
      {/* Editorial Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <span className="text-[10px] font-mono tracking-widest uppercase text-slate-400">
            System Dashboard
          </span>
          <h2 className="text-3xl font-normal text-slate-900 tracking-tight font-serif mt-1">
            Welcome, {user?.name}
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Authenticated session: <span className="font-mono text-slate-700">{user?.email}</span> • Client-side hybrid cryptographic isolation active.
          </p>
        </div>

        <div className="flex items-center space-x-4 shrink-0">
          <Link
            to="/share"
            className="text-xs font-semibold text-slate-900 hover:text-slate-600 flex items-center gap-1.5 transition-colors"
          >
            <span>Share File</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
          <span className="text-slate-200">|</span>
          <Link
            to="/inbox"
            className="text-xs font-semibold text-slate-900 hover:text-slate-600 flex items-center gap-1.5 transition-colors"
          >
            <span>Open Inbox</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Warnings - Clean hairline banner without boxy card wrapper */}
      {!publicKey ? (
        <div className="py-3 px-4 border-l-2 border-amber-600 bg-amber-50/60 flex items-center justify-between gap-4 text-xs">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="text-amber-900">
              <strong>Asymmetric Key Required:</strong> Generate your RSA-3072 key pair so other users can encrypt files for you.
            </span>
          </div>
          <Link to="/keys" className="font-semibold text-amber-900 hover:underline shrink-0">
            Setup Key →
          </Link>
        </div>
      ) : !hasLocalKey ? (
        <div className="py-3 px-4 border-l-2 border-slate-400 bg-slate-50 flex items-center justify-between gap-4 text-xs">
          <span className="text-slate-700">
            <strong>Local Key Missing:</strong> Your private key is not present in this browser's IndexedDB. You cannot decrypt deliveries in this session.
          </span>
          <Link to="/keys" className="font-semibold text-slate-900 hover:underline shrink-0">
            Manage Keys →
          </Link>
        </div>
      ) : null}

      {/* Metrics Row: Pure Numbers, hairline dividers, no boxes */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-8 py-2 border-b border-slate-200">
        <div className="space-y-1">
          <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
            Inbox Deliveries
          </div>
          <div className="text-4xl font-light text-slate-900 tracking-tight">
            {inboxCount}
          </div>
          <div className="text-[11px] text-slate-500 font-mono">
            Awaiting recipient recovery
          </div>
        </div>

        <div className="space-y-1">
          <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
            Dispatched Files
          </div>
          <div className="text-4xl font-light text-slate-900 tracking-tight">
            {sentCount}
          </div>
          <div className="text-[11px] text-slate-500 font-mono">
            Client-side encrypted blobs
          </div>
        </div>

        <div className="space-y-1">
          <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
            Vault State
          </div>
          <div className="text-lg font-medium text-slate-900 mt-2 flex items-center gap-1.5">
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
          <div className="text-[11px] text-slate-500 font-mono">
            PBKDF2-SHA-256 (600k)
          </div>
        </div>

        <div className="space-y-1">
          <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
            Audit Trail
          </div>
          <div className="text-4xl font-light text-slate-900 tracking-tight">
            {recentEvents.length}
          </div>
          <div className="text-[11px] text-slate-500 font-mono">
            Verifiable records
          </div>
        </div>
      </div>

      {/* Main Content Sections: Open, Spacious, Non-Boxy */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
        {/* Left Column: Recent Deliveries (Open Table, no surrounding box) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-baseline justify-between pb-2 border-b border-slate-100">
            <div>
              <h3 className="text-base font-semibold text-slate-900 tracking-tight">
                Recent Inbox Deliveries
              </h3>
              <p className="text-xs text-slate-500">
                Encrypted payloads stored in cloud object storage
              </p>
            </div>
            <Link to="/inbox" className="text-xs font-semibold text-slate-700 hover:underline">
              View all →
            </Link>
          </div>

          {recentFiles.length === 0 ? (
            <div className="py-12 text-slate-400 text-xs font-mono">
              No files currently shared with your account.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {recentFiles.map((file) => (
                <div key={file.id} className="py-3.5 flex items-center justify-between gap-6 hover:bg-slate-50/50 transition-colors px-1">
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="text-xs font-semibold text-slate-900 break-words-anywhere leading-snug">
                      {file.original_filename}
                    </div>
                    <div className="text-[11px] text-slate-500 break-words-anywhere font-mono">
                      From: {file.sender_name || file.sender_email} • {(file.file_size / 1024).toFixed(1)} KB • {file.encryption_algorithm}
                    </div>
                  </div>
                  <Link
                    to="/inbox"
                    className="text-xs font-semibold text-slate-900 hover:text-slate-600 shrink-0"
                  >
                    Decrypt →
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Security Stream (Clean Chronological Timeline, no box) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-baseline justify-between pb-2 border-b border-slate-100">
            <div>
              <h3 className="text-base font-semibold text-slate-900 tracking-tight">
                Cryptographic Audit Log
              </h3>
              <p className="text-xs text-slate-500">
                Tamper-evident verification events
              </p>
            </div>
            <Link to="/security" className="text-xs font-semibold text-slate-700 hover:underline">
              Full log →
            </Link>
          </div>

          <div className="space-y-4 divide-y divide-slate-100">
            {recentEvents.map((evt) => (
              <div key={evt.id} className="pt-3 first:pt-0 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-mono uppercase tracking-wider font-semibold ${
                    evt.result === 'SUCCESS' ? 'text-emerald-700' :
                    evt.result === 'DENIED' ? 'text-rose-700 font-bold' :
                    'text-slate-600'
                  }`}>
                    {evt.result}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {new Date(evt.created_at).toLocaleTimeString()}
                  </span>
                </div>
                <div className="font-semibold text-slate-900 break-words-anywhere text-xs">
                  {evt.event_type}
                </div>
                <div className="text-[11px] text-slate-500 break-words-anywhere font-mono">
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
