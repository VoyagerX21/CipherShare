import React, { useState, useEffect } from 'react';
import { api } from '../lib/api/client';
import { AuditEventItem } from '../types';
import {
  ShieldAlert,
  ShieldCheck,
  Clock,
  Filter,
  RefreshCw,
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info
} from 'lucide-react';

export const SecurityCenterPage: React.FC = () => {
  const [events, setEvents] = useState<AuditEventItem[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [filterEventType, setFilterEventType] = useState<string>('');
  const [filterResult, setFilterResult] = useState<string>('');
  const [selectedMeta, setSelectedMeta] = useState<Record<string, any> | null>(null);

  const loadAuditLogs = async () => {
    setIsLoading(true);
    try {
      const res = await api.audit.getAll({
        event_type: filterEventType || undefined,
        result: filterResult || undefined,
        limit: 50
      });
      setEvents(res.events);
      setTotal(res.total);
    } catch (err) {
      console.error('Failed to load audit events', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAuditLogs();
  }, [filterEventType, filterResult]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <ShieldAlert className="w-8 h-8 text-sky-400" />
            <span>Security Center & Audit Logs</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Tamper-evident system activity and cryptographic integrity event records.
          </p>
        </div>
        <button
          onClick={loadAuditLogs}
          className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white border border-slate-700 flex items-center gap-1.5 text-xs"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Logs</span>
        </button>
      </div>

      {/* Security Architecture & Threat Model Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#111827] border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center gap-2 text-sky-400 font-bold text-xs uppercase tracking-wider mb-2">
            <ShieldCheck className="w-4 h-4" />
            <span>Cryptographic Controls</span>
          </div>
          <ul className="text-xs text-slate-300 space-y-1.5">
            <li>• <strong>AES-256-GCM:</strong> 128-bit authentication tag + 96-bit nonce.</li>
            <li>• <strong>RSA-OAEP-3072:</strong> Per-recipient wrapped key envelopes.</li>
            <li>• <strong>Canonical AAD:</strong> Binds fileId, senderId, and version.</li>
            <li>• <strong>PBKDF2-SHA-256:</strong> 600,000 iterations for local key vault.</li>
          </ul>
        </div>

        <div className="bg-[#111827] border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-wider mb-2">
            <ShieldCheck className="w-4 h-4" />
            <span>Access Boundaries</span>
          </div>
          <ul className="text-xs text-slate-300 space-y-1.5">
            <li>• Intruders denied HTTP 403 upon unauthorized download attempts.</li>
            <li>• Recipient download requests deliver ONLY that user's envelope.</li>
            <li>• Storage buckets are private; filenames use random UUIDs.</li>
            <li>• Private keys NEVER transmitted across the network.</li>
          </ul>
        </div>

        <div className="bg-[#111827] border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider mb-2">
            <AlertTriangle className="w-4 h-4" />
            <span>Stated Limitations</span>
          </div>
          <ul className="text-xs text-slate-300 space-y-1.5">
            <li>• Compomised client device could expose in-memory plaintext.</li>
            <li>• Server-side file metadata (names, sizes) is visible to backend.</li>
            <li>• Academic prototype — not formally audited for production.</li>
            <li>• Loss of browser IndexedDB storage requires key recovery.</li>
          </ul>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-[#111827] border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center gap-4 text-xs">
        <div className="flex items-center gap-2 text-slate-400">
          <Filter className="w-4 h-4" />
          <span>Filters:</span>
        </div>

        <select
          value={filterResult}
          onChange={(e) => setFilterResult(e.target.value)}
          className="bg-[#0b0f19] border border-slate-700 rounded-xl px-3 py-1.5 text-slate-200 focus:outline-none focus:border-sky-500"
        >
          <option value="">All Results</option>
          <option value="SUCCESS">SUCCESS</option>
          <option value="DENIED">DENIED (Unauthorized)</option>
          <option value="FAILED">FAILED</option>
          <option value="TAMPER_DETECTED">TAMPER_DETECTED</option>
        </select>

        <select
          value={filterEventType}
          onChange={(e) => setFilterEventType(e.target.value)}
          className="bg-[#0b0f19] border border-slate-700 rounded-xl px-3 py-1.5 text-slate-200 focus:outline-none focus:border-sky-500"
        >
          <option value="">All Event Types</option>
          <option value="FILE_SHARE_INITIATED">FILE_SHARE_INITIATED</option>
          <option value="FILE_UPLOAD_COMPLETED">FILE_UPLOAD_COMPLETED</option>
          <option value="DOWNLOAD_AUTHORIZED">DOWNLOAD_AUTHORIZED</option>
          <option value="UNAUTHORIZED_ACCESS_ATTEMPT">UNAUTHORIZED_ACCESS_ATTEMPT</option>
          <option value="CLIENT_DECRYPTION_RESULT">CLIENT_DECRYPTION_RESULT</option>
          <option value="TAMPERING_DEMO_TEST">TAMPERING_DEMO_TEST</option>
          <option value="PUBLIC_KEY_REGISTERED">PUBLIC_KEY_REGISTERED</option>
        </select>

        <span className="text-slate-500 ml-auto font-mono">
          Showing {events.length} of {total} events
        </span>
      </div>

      {/* Audit Log Table */}
      <div className="bg-[#111827] border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0f172a] border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider font-semibold">
              <tr>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Result</th>
                <th className="py-3 px-4">Event Type</th>
                <th className="py-3 px-4">Actor</th>
                <th className="py-3 px-4">Target File</th>
                <th className="py-3 px-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    Loading audit stream...
                  </td>
                </tr>
              ) : events.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    No matching audit logs found.
                  </td>
                </tr>
              ) : (
                events.map((evt) => (
                  <tr key={evt.id} className="hover:bg-slate-900/40 transition-colors">
                    <td className="py-3 px-4 font-mono text-slate-400 whitespace-nowrap">
                      {new Date(evt.created_at).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        evt.result === 'SUCCESS' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                        evt.result === 'DENIED' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                        evt.result === 'TAMPER_DETECTED' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' :
                        'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }`}>
                        {evt.result}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-200">
                      {evt.event_type}
                    </td>
                    <td className="py-3 px-4 text-slate-400 truncate max-w-[150px]">
                      {evt.actor_email || 'anonymous'}
                    </td>
                    <td className="py-3 px-4 text-slate-400 truncate max-w-[150px]">
                      {evt.original_filename || (evt.file_id ? evt.file_id.substring(0, 8) + '...' : '—')}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => setSelectedMeta(evt.safe_metadata)}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-mono transition-colors"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Metadata Inspector Modal */}
      {selectedMeta && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
                <Info className="w-4 h-4 text-sky-400" />
                <span>Sanitized Audit Metadata</span>
              </h3>
              <button
                onClick={() => setSelectedMeta(null)}
                className="text-slate-400 hover:text-slate-200 text-xs"
              >
                ✕ Close
              </button>
            </div>
            <pre className="bg-[#0b0f19] p-4 rounded-xl text-xs font-mono text-sky-300 overflow-x-auto max-h-80 border border-slate-800 select-all">
              {JSON.stringify(selectedMeta, null, 2)}
            </pre>
            <div className="mt-4 text-[11px] text-slate-500">
              Note: Confidential keys, plaintext, and passphrases are strictly scrubbed prior to audit persistence.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
