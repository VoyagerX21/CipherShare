import React, { useState, useEffect } from 'react';
import { api } from '../lib/api/client';
import { AuditEventItem } from '../types';
import {
  ShieldAlert,
  ShieldCheck,
  Clock,
  Filter,
  RefreshCw,
  AlertTriangle,
  Info,
  X
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
    <div className="w-full space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Security & Audit Center</h2>
          <p className="text-xs text-slate-500 mt-1">
            Tamper-evident system activity and cryptographic integrity event records.
          </p>
        </div>
        <button
          onClick={loadAuditLogs}
          className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl flex items-center gap-1.5 text-xs font-medium shadow-2xs transition-colors shrink-0"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Stream</span>
        </button>
      </div>

      {/* Security Architecture & Boundaries */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-xs uppercase tracking-wider mb-2">
            <ShieldCheck className="w-4 h-4 text-sky-600" />
            <span>Cryptographic Primitives</span>
          </div>
          <ul className="text-xs text-slate-600 space-y-2">
            <li>• <strong>AES-256-GCM:</strong> 128-bit authentication tag + 96-bit random nonce.</li>
            <li>• <strong>RSA-OAEP-3072:</strong> Per-recipient wrapped key envelopes.</li>
            <li>• <strong>Canonical AAD:</strong> Binds fileId, senderId, and protocol version.</li>
            <li>• <strong>PBKDF2-SHA-256:</strong> 600,000 iterations for local key vault.</li>
          </ul>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-xs uppercase tracking-wider mb-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Access Boundaries</span>
          </div>
          <ul className="text-xs text-slate-600 space-y-2">
            <li>• Intruders denied HTTP 403 upon unauthorized download attempts.</li>
            <li>• Download requests deliver ONLY the requesting recipient's envelope.</li>
            <li>• Storage buckets are private; filenames use random UUIDs.</li>
            <li>• Private keys NEVER transmitted across the network.</li>
          </ul>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-xs uppercase tracking-wider mb-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span>Stated Limitations</span>
          </div>
          <ul className="text-xs text-slate-600 space-y-2">
            <li>• Compromised client device RAM could expose in-memory plaintext.</li>
            <li>• Server-side file metadata (names, sizes) is visible to backend.</li>
            <li>• Academic prototype — not formally audited for production.</li>
            <li>• Loss of browser IndexedDB storage requires key recovery.</li>
          </ul>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-wrap items-center gap-4 text-xs shadow-2xs">
        <div className="flex items-center gap-2 text-slate-500 font-semibold">
          <Filter className="w-4 h-4 text-slate-400" />
          <span>Filters:</span>
        </div>

        <select
          value={filterResult}
          onChange={(e) => setFilterResult(e.target.value)}
          className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-slate-900/10"
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
          className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-slate-900/10"
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

        <span className="text-slate-400 ml-auto font-mono text-[11px]">
          Showing {events.length} of {total} total records
        </span>
      </div>

      {/* Audit Log Table (Clean, Classic, Open) */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase text-[10px] tracking-wider font-bold">
              <tr>
                <th className="py-3.5 px-5">Timestamp</th>
                <th className="py-3.5 px-5">Result</th>
                <th className="py-3.5 px-5">Event Type</th>
                <th className="py-3.5 px-5">Actor</th>
                <th className="py-3.5 px-5">Target File</th>
                <th className="py-3.5 px-5 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    Loading audit stream...
                  </td>
                </tr>
              ) : events.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 font-medium">
                    No matching audit records found.
                  </td>
                </tr>
              ) : (
                events.map((evt) => (
                  <tr key={evt.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-5 font-mono text-slate-500 whitespace-nowrap text-[11px]">
                      {new Date(evt.created_at).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-5 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        evt.result === 'SUCCESS' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' :
                        evt.result === 'DENIED' ? 'bg-rose-50 text-rose-800 border border-rose-200' :
                        evt.result === 'TAMPER_DETECTED' ? 'bg-purple-50 text-purple-800 border border-purple-200' :
                        'bg-slate-100 text-slate-700 border border-slate-200'
                      }`}>
                        {evt.result}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 font-bold text-slate-800 break-words-anywhere">
                      {evt.event_type}
                    </td>
                    <td className="py-3.5 px-5 text-slate-600 break-words-anywhere max-w-xs">
                      {evt.actor_email || 'anonymous'}
                    </td>
                    <td className="py-3.5 px-5 text-slate-600 break-words-anywhere max-w-xs">
                      {evt.original_filename || (evt.file_id ? evt.file_id.substring(0, 8) + '...' : '—')}
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      <button
                        onClick={() => setSelectedMeta(evt.safe_metadata)}
                        className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-mono transition-colors border border-slate-200"
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
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Info className="w-4 h-4 text-sky-600" />
                <span>Sanitized Audit Metadata</span>
              </h3>
              <button
                onClick={() => setSelectedMeta(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <pre className="bg-slate-50 p-4 rounded-xl text-xs font-mono text-slate-800 overflow-x-auto max-h-80 border border-slate-200 select-all break-words-anywhere">
              {JSON.stringify(selectedMeta, null, 2)}
            </pre>
            <div className="mt-4 text-[11px] text-slate-500">
              Zero-Exposure Invariant: Passwords, private keys, and plaintext file bytes are strictly scrubbed prior to audit persistence.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
